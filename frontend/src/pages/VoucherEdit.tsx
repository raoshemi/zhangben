import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  CheckCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningFilled,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';
import AccountSelect from '../components/AccountSelect';
import AmountInput from '../components/AmountInput';
import { useAccounts, type Account } from '../hooks/useAccounts';
import { useBooks } from '../hooks/useBooks';
import {
  AUX_TYPE_LABEL,
  VOUCHER_TYPES,
  centsToMoney,
  errorMessage,
  toArray,
  toCents,
} from '../lib/format';

const { Text } = Typography;

interface CashFlowItem {
  id: number;
  code: string;
  name: string;
}

interface AuxItem {
  id: number;
  auxType: string;
  code: string;
  name: string;
}

type Direction = 'debit' | 'credit';

interface EntryRow {
  key: string;
  summary: string;
  accountId?: number;
  direction: Direction;
  /** 用户手动改过方向后，选科目不再自动覆盖 */
  directionTouched: boolean;
  amount: string;
  cashflowItemId?: number;
  auxIds: number[];
}

type RowField = 'summary' | 'account' | 'amount' | 'cashflow';
type RowErrors = Record<string, Partial<Record<RowField, string>>>;

let rowSeq = 0;
function newRow(): EntryRow {
  rowSeq += 1;
  return {
    key: `row-${Date.now()}-${rowSeq}`,
    summary: '',
    direction: 'debit',
    directionTouched: false,
    amount: '',
    auxIds: [],
  };
}

export default function VoucherEdit({
  bookId = 1,
  onSaved,
  onDirtyChange,
}: {
  bookId?: number;
  onSaved?: () => void;
  /** 供外层（如抽屉）判断是否需要"未保存离开"确认 */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [voucherType, setVoucherType] = useState<string>('记');
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [rows, setRows] = useState<EntryRow[]>(() => [newRow(), newRow()]);
  const [cashFlowItems, setCashFlowItems] = useState<CashFlowItem[]>([]);
  const [auxItems, setAuxItems] = useState<AuxItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaTick, setMetaTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | undefined>();

  const { books } = useBooks();
  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);

  const {
    leafAccounts,
    byId: accountById,
    loading: accountsLoading,
    error: accountsError,
    reload: reloadAccounts,
  } = useAccounts(bookId);

  /** 现金流量项目 / 辅助核算项：与账套绑定，缺失时给出可重试提示而不是静默空下拉 */
  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);
    Promise.allSettled([
      api.get('/cashflow', { params: { bookId } }),
      api.get('/auxiliary', { params: { bookId } }),
    ]).then(([cf, aux]) => {
      if (cancelled) return;
      const failed: string[] = [];
      if (cf.status === 'fulfilled') {
        setCashFlowItems(toArray(cf.value.data) as CashFlowItem[]);
      } else {
        setCashFlowItems([]);
        failed.push('现金流量项目');
      }
      if (aux.status === 'fulfilled') {
        setAuxItems(toArray(aux.value.data) as AuxItem[]);
      } else {
        setAuxItems([]);
        failed.push('辅助核算项');
      }
      setMetaError(
        failed.length ? `${failed.join('、')}加载失败，相关字段暂不可选` : null,
      );
      setMetaLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, metaTick]);

  const accountOf = useCallback(
    (row: EntryRow): Account | undefined =>
      row.accountId != null ? accountById.get(row.accountId) : undefined,
    [accountById],
  );

  // 抽屉/弹窗用它决定「有内容未保存，确认关闭？」避免误关丢单
  const dirty =
    attachmentCount > 0 ||
    rows.some(
      (r) =>
        !!r.summary.trim() ||
        r.accountId != null ||
        toCents(r.amount) > 0 ||
        r.cashflowItemId != null ||
        r.auxIds.length > 0,
    );
  const dirtyCbRef = useRef(onDirtyChange);
  useEffect(() => {
    dirtyCbRef.current = onDirtyChange;
  });
  useEffect(() => {
    dirtyCbRef.current?.(dirty);
  }, [dirty]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const r of rows) {
      const cents = toCents(r.amount);
      if (r.direction === 'debit') debit += cents;
      else credit += cents;
    }
    return { debit, credit, diff: debit - credit, balanced: debit === credit };
  }, [rows]);

  const updateRow = (key: string, patch: Partial<EntryRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const clearFieldError = (key: string, field: RowField) => {
    setRowErrors((prev) => {
      const rowErr = prev[key];
      if (!rowErr || !rowErr[field]) return prev;
      const nextRow = { ...rowErr };
      delete nextRow[field];
      const next = { ...prev };
      if (Object.keys(nextRow).length === 0) delete next[key];
      else next[key] = nextRow;
      return next;
    });
    setErrorSummary(null);
  };

  /**
   * 科目联动的三件事：
   * 1) 按科目余额方向自动带出借贷方向（用户手动改过则尊重用户）；
   * 2) 摘要为空时用科目名称预填，减少重复打字；
   * 3) 清空与新科目不匹配的现金流量项目 / 辅助核算项，避免后端 400。
   */
  const applyAccount = (key: string, accountId?: number) => {
    const account = accountId != null ? accountById.get(accountId) : undefined;
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next: EntryRow = {
          ...r,
          accountId,
          cashflowItemId: undefined,
          auxIds: [],
        };
        if (account) {
          if (!r.directionTouched) {
            next.direction = account.balanceSide === 'credit' ? 'credit' : 'debit';
          }
          if (!r.summary.trim()) next.summary = account.name;
        }
        return next;
      }),
    );
    clearFieldError(key, 'account');
  };

  const addRow = (focus = true) => {
    const row = newRow();
    setRows((prev) => [...prev, row]);
    if (focus) setFocusKey(row.key);
  };

  const duplicateRow = (key: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) return prev;
      const src = prev[idx];
      rowSeq += 1;
      const copy: EntryRow = {
        ...src,
        key: `row-${Date.now()}-${rowSeq}`,
        // 方向与科目保留，金额清空，避免复制出等额分录造成不平衡
        amount: '',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length > 2 ? prev.filter((r) => r.key !== key) : prev));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setErrorSummary(null);
  };

  const reset = () => {
    setVoucherType('记');
    setDate(dayjs());
    setAttachmentCount(0);
    setRows([newRow(), newRow()]);
    setRowErrors({});
    setErrorSummary(null);
  };

  const validate = () => {
    const errors: RowErrors = {};
    let count = 0;
    for (const r of rows) {
      const account = accountOf(r);
      const flags = account?.auxFlags ?? [];
      const e: Partial<Record<RowField, string>> = {};
      if (!r.summary.trim()) e.summary = '必填';
      if (!r.accountId) e.account = '请选择明细科目';
      if (toCents(r.amount) <= 0) e.amount = '金额需大于 0';
      if (flags.includes('cashflow') && !r.cashflowItemId) {
        e.cashflow = '现金/银行科目需指定现金流量项目';
      }
      if (Object.keys(e).length) {
        errors[r.key] = e;
        count += Object.keys(e).length;
      }
    }
    return { errors, count };
  };

  const buildEntries = () =>
    rows.map((r) => {
      const account = accountOf(r);
      const flags = account?.auxFlags ?? [];
      return {
        summary: r.summary.trim(),
        accountId: r.accountId!,
        direction: r.direction,
        amount: toCents(r.amount) > 0 ? centsToMoney(toCents(r.amount)) : r.amount,
        // 科目未启用对应辅助核算时不下发，避免后端「科目未启用 xx 辅助核算」报错
        cashflowItemId: flags.includes('cashflow') ? r.cashflowItemId : undefined,
        auxs: r.auxIds
          .map((id) => {
            const item = auxItems.find((a) => a.id === id);
            return item && flags.includes(item.auxType)
              ? { auxType: item.auxType, auxiliaryItemId: id }
              : null;
          })
          .filter(Boolean),
      };
    });

  const focusFirstError = (errors: RowErrors) => {
    const firstKey = rows.find((r) => errors[r.key])?.key;
    if (!firstKey) return;
    window.setTimeout(() => {
      const el = document.querySelector(`tr[data-row-key="${firstKey}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 0);
  };

  const handleSave = async (keepOpen = false) => {
    if (!date) {
      message.error('请选择凭证日期');
      return;
    }
    if (!totals.balanced) {
      setErrorSummary(
        `借贷不平衡：借方合计 ${centsToMoney(totals.debit)} 元，贷方合计 ${centsToMoney(
          totals.credit,
        )} 元，差额 ${centsToMoney(Math.abs(totals.diff))} 元`,
      );
      message.error(`借贷不平衡，差额 ${centsToMoney(Math.abs(totals.diff))} 元`);
      return;
    }
    if (totals.debit === 0) {
      setErrorSummary('借贷合计不能为 0，请填写分录金额');
      message.error('借贷合计不能为 0');
      return;
    }
    const { errors, count } = validate();
    if (count > 0) {
      setRowErrors(errors);
      setErrorSummary(`还有 ${count} 处分录信息需要修正，已在表格中标红`);
      focusFirstError(errors);
      message.error(`还有 ${count} 处分录信息需要修正`);
      return;
    }

    const period = date.format('YYYY-MM');
    const payload = {
      bookId,
      period,
      date: date.format('YYYY-MM-DD'),
      voucherType,
      attachmentCount,
      entries: buildEntries(),
    };

    setSaving(true);
    setErrorSummary(null);
    try {
      await api.post('/vouchers', payload);
      message.success(keepOpen ? '已保存，继续录入下一张' : '凭证已保存');
      if (keepOpen) {
        const nextRows = [newRow(), newRow()];
        setRows(nextRows);
        setRowErrors({});
        setFocusKey(nextRows[0].key);
      } else {
        reset();
        onSaved?.();
      }
    } catch (e) {
      const msg = errorMessage(e, '保存失败');
      setErrorSummary(msg);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/⌘ + S 保存：会计录入时最常按的快捷键
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const outOfBookRange =
    !!book &&
    !!date &&
    ((book.startDate && date.isBefore(dayjs(book.startDate), 'day')) ||
      (book.endDate && date.isAfter(dayjs(book.endDate), 'day')));

  const columns: TableColumnsType<EntryRow> = [
    {
      title: '#',
      key: 'seq',
      width: 48,
      align: 'center',
      render: (_, __, index) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {index + 1}
        </Text>
      ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 230,
      render: (_, r) => (
        <div>
          <Input
            value={r.summary}
            placeholder="摘要"
            maxLength={200}
            autoFocus={focusKey === r.key}
            status={rowErrors[r.key]?.summary ? 'error' : undefined}
            onChange={(e) => {
              updateRow(r.key, { summary: e.target.value });
              clearFieldError(r.key, 'summary');
            }}
            onPressEnter={() => {
              if (rows[rows.length - 1].key === r.key) addRow();
            }}
          />
          {rowErrors[r.key]?.summary && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {rowErrors[r.key]?.summary}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '科目',
      dataIndex: 'accountId',
      width: 260,
      render: (_, r) => (
        <div>
          <AccountSelect
            accounts={leafAccounts}
            value={r.accountId}
            loading={accountsLoading}
            status={rowErrors[r.key]?.account ? 'error' : ''}
            onChange={(id) => applyAccount(r.key, id)}
            onEnter={() => {
              if (rows[rows.length - 1].key === r.key) addRow();
            }}
          />
          {rowErrors[r.key]?.account && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {rowErrors[r.key]?.account}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="默认按科目余额方向自动带出，可手动调整">
          <span>方向</span>
        </Tooltip>
      ),
      dataIndex: 'direction',
      width: 96,
      render: (_, r) => (
        <Segmented
          size="small"
          block
          value={r.direction}
          options={[
            { label: '借', value: 'debit' },
            { label: '贷', value: 'credit' },
          ]}
          onChange={(v) =>
            updateRow(r.key, {
              direction: v as Direction,
              directionTouched: true,
            })
          }
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 150,
      align: 'right',
      render: (_, r) => (
        <div>
          <AmountInput
            value={r.amount}
            status={rowErrors[r.key]?.amount ? 'error' : ''}
            onChange={(v) => {
              updateRow(r.key, { amount: v });
              clearFieldError(r.key, 'amount');
            }}
            onPressEnter={() => {
              if (rows[rows.length - 1].key === r.key) addRow();
            }}
          />
          {rowErrors[r.key]?.amount && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {rowErrors[r.key]?.amount}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="科目启用「现金流量」辅助核算时必填，否则留空">
          <span>
            现金流量项目 <span style={{ color: '#ff4d4f' }}>*</span>
          </span>
        </Tooltip>
      ),
      dataIndex: 'cashflowItemId',
      width: 210,
      render: (_, r) => {
        const flags = accountOf(r)?.auxFlags ?? [];
        const need = flags.includes('cashflow');
        return (
          <div>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              status={rowErrors[r.key]?.cashflow ? 'error' : undefined}
              value={r.cashflowItemId}
              disabled={!need}
              placeholder={need ? '必选现金流量项目' : '当前科目无需填列'}
              onChange={(v) => {
                updateRow(r.key, { cashflowItemId: v });
                clearFieldError(r.key, 'cashflow');
              }}
              loading={metaLoading}
              options={cashFlowItems.map((c) => ({
                value: c.id,
                label: `${c.code} ${c.name}`,
              }))}
            />
            {rowErrors[r.key]?.cashflow && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {rowErrors[r.key]?.cashflow}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: '辅助核算',
      dataIndex: 'auxIds',
      width: 210,
      render: (_, r) => {
        const flags = accountOf(r)?.auxFlags ?? [];
        const options = auxItems
          .filter((a) => flags.includes(a.auxType))
          .map((a) => ({
            value: a.id,
            label: `${a.code} ${a.name}（${AUX_TYPE_LABEL[a.auxType] ?? a.auxType}）`,
          }));
        return (
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%' }}
            value={r.auxIds}
            disabled={options.length === 0}
            placeholder={
              options.length === 0 ? '当前科目未启用' : '按科目启用的类型选择'
            }
            onChange={(v) => updateRow(r.key, { auxIds: v })}
            options={options}
            maxTagCount="responsive"
            loading={metaLoading}
          />
        );
      },
    },
    {
      title: '',
      key: 'op',
      width: 92,
      fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Tooltip title="复制本行（金额清空）">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => duplicateRow(r.key)}
            />
          </Tooltip>
          <Tooltip title={rows.length <= 2 ? '至少保留两行分录' : '删除本行'}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={rows.length <= 2}
              onClick={() => removeRow(r.key)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const emptyAmountRows = rows.filter((r) => toCents(r.amount) === 0);

  return (
    <Card title="凭证录入" size="small">
      {accountsError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`科目表加载失败：${accountsError}`}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={reloadAccounts}>
              重试
            </Button>
          }
        />
      )}
      {metaError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={metaError}
          action={
            <Button size="small" onClick={() => setMetaTick((t) => t + 1)}>
              重试
            </Button>
          }
        />
      )}
      {outOfBookRange && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`凭证日期超出版套启用期间：${book?.startDate ?? '—'} ~ ${
            book?.endDate ?? '—'
          }`}
        />
      )}
      {errorSummary && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={errorSummary}
          closable
          onClose={() => setErrorSummary(null)}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }} size={12}>
        <Space size={4}>
          <Text type="secondary">凭证字</Text>
          <Select
            value={voucherType}
            style={{ width: 84 }}
            onChange={setVoucherType}
            options={VOUCHER_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">凭证号</Text>
          <Tooltip title="保存时按期间自动连续编号，不允许手工指定">
            <InputNumber value={undefined} placeholder="自动" disabled style={{ width: 84 }} />
          </Tooltip>
        </Space>
        <Space size={4}>
          <Text type="secondary">日期</Text>
          <DatePicker
            value={date}
            onChange={setDate}
            allowClear={false}
            status={outOfBookRange ? 'warning' : undefined}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">附件</Text>
          <InputNumber
            min={0}
            value={attachmentCount}
            onChange={(v) => setAttachmentCount(Number(v) || 0)}
            style={{ width: 84 }}
          />
        </Space>
        <Space size={4}>
          <Text type="secondary">账套</Text>
          <Text strong>{book ? book.name : `#${bookId}`}</Text>
        </Space>
      </Space>

      <Table
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1360 }}
        loading={accountsLoading && leafAccounts.length === 0}
      />

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Space size={12} wrap>
          <Button icon={<PlusOutlined />} onClick={() => addRow()}>
            添加分录
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Enter 在末行追加分录 · Ctrl/⌘ + S 保存
          </Text>
        </Space>
        <Space size={16} wrap>
          <span>
            借方合计：<b>{centsToMoney(totals.debit)}</b>
          </span>
          <span>
            贷方合计：<b>{centsToMoney(totals.credit)}</b>
          </span>
          {totals.balanced ? (
            <Tag icon={<CheckCircleFilled />} color="green">
              借贷平衡
            </Tag>
          ) : (
            <Tag icon={<WarningFilled />} color="red">
              借贷不平衡（差额 {centsToMoney(Math.abs(totals.diff))}）
            </Tag>
          )}
          {!totals.balanced && emptyAmountRows.length === 1 && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                const target = emptyAmountRows[0];
                const cents = Math.abs(totals.diff);
                updateRow(target.key, {
                  amount: centsToMoney(cents),
                  direction: totals.diff > 0 ? 'credit' : 'debit',
                  directionTouched: true,
                });
                clearFieldError(target.key, 'amount');
              }}
            >
              按差额补足 {centsToMoney(Math.abs(totals.diff))} 元
            </Button>
          )}
        </Space>
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={reset}>重置</Button>
          <Button loading={saving} onClick={() => handleSave(true)} disabled={saving}>
            保存并继续录入
          </Button>
          <Button type="primary" loading={saving} onClick={() => handleSave(false)}>
            保存凭证
          </Button>
        </Space>
      </div>
    </Card>
  );
}
