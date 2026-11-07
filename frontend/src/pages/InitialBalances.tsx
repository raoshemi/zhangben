import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { BookRequiredState } from '../components/BooksEmptyHint';
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';
import {
  ACCOUNT_CATEGORY_LABEL,
  AUX_TYPE_LABEL,
  centsToMoney,
  errorMessage,
  fmtMoney,
  normalizeAmount,
  sanitizeAmount,
  toCents,
} from '../lib/format';

interface Account {
  id: number;
  code: string;
  name: string;
  category: string;
  balanceSide: string;
  isLeaf: boolean;
  initialDebit: string;
  initialCredit: string;
  auxFlags?: string[] | null;
}
interface AuxItem {
  id: number;
  auxType: string;
  code: string;
  name: string;
}
interface AuxRow {
  accountId: number;
  auxType: string;
  auxItemId: number;
  debit: string;
  credit: string;
}
type AuxAmounts = Record<number, Record<number, { debit: string; credit: string }>>;

const CATEGORY_ORDER = ['asset', 'liability', 'common', 'equity', 'cost', 'pnl'] as const;

/** 余额型辅助（现金流量不是余额维度，不参与期初辅助） */
const balanceAuxFlags = (a: Account) =>
  (a.auxFlags ?? []).filter((f) => f !== 'cashflow');

export default function InitialBalances() {
  const { bookId, book, status } = useBook();
  const { isReadOnly } = useRole();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [auxItems, setAuxItems] = useState<AuxItem[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [auxAmounts, setAuxAmounts] = useState<AuxAmounts>({});
  const [search, setSearch] = useState('');
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['asset', 'liability', 'equity']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string>();

  const load = async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const [acctRes, auxRes, savedAux, posted] = await Promise.all([
        api.get('/accounts', { params: { bookId } }),
        api.get('/auxiliary', { params: { bookId } }),
        api.get('/accounts/initial-balances/aux', { params: { bookId } }),
        api.get('/vouchers', { params: { bookId, status: 'posted', pageSize: 1 } }),
      ]);
      const list = (acctRes.data as Account[]).filter((a) => a.isLeaf);
      setAccounts(list);
      setAuxItems((auxRes.data as AuxItem[]) ?? []);

      const map: Record<number, string> = {};
      for (const a of list) {
        if (balanceAuxFlags(a).length > 0) continue; // 辅助科目由明细汇总
        const raw = a.balanceSide === 'credit' ? a.initialCredit : a.initialDebit;
        const cents = toCents(raw);
        map[a.id] = cents === 0 ? '' : centsToMoney(cents);
      }
      setAmounts(map);

      const auxMap: AuxAmounts = {};
      for (const r of (savedAux.data as AuxRow[]) ?? []) {
        const d = toCents(r.debit);
        const c = toCents(r.credit);
        if (d === 0 && c === 0) continue;
        const perAccount = auxMap[r.accountId] ?? {};
        perAccount[r.auxItemId] = {
          debit: d ? centsToMoney(d) : '',
          credit: c ? centsToMoney(c) : '',
        };
        auxMap[r.accountId] = perAccount;
      }
      setAuxAmounts(auxMap);
      setLocked(Number(posted.data?.total ?? 0) > 0);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e, '加载期初余额失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const auxSumOf = (accountId: number) => {
    const per = auxAmounts[accountId] ?? {};
    let debit = 0;
    let credit = 0;
    for (const v of Object.values(per)) {
      debit += toCents(v.debit);
      credit += toCents(v.credit);
    }
    return { debit, credit };
  };

  const isAuxAccount = (a: Account) => balanceAuxFlags(a).length > 0;

  /** 科目期初（分）：辅助科目取明细汇总，普通科目取输入值 */
  const amountOf = (a: Account) => {
    if (isAuxAccount(a)) {
      const s = auxSumOf(a.id);
      return a.balanceSide === 'credit' ? s.credit : s.debit;
    }
    return toCents(amounts[a.id] ?? '');
  };

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let filled = 0;
    for (const a of accounts) {
      const cents = isAuxAccount(a)
        ? (() => {
            const s = auxSumOf(a.id);
            return a.balanceSide === 'credit' ? s.credit : s.debit;
          })()
        : toCents(amounts[a.id] ?? '');
      if (cents !== 0) filled += 1;
      if (a.balanceSide === 'credit') credit += cents;
      else debit += cents;
    }
    return { debit, credit, diff: debit - credit, filled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, amounts, auxAmounts]);

  const balanceState =
    totals.debit === 0 && totals.credit === 0
      ? 'todo'
      : totals.diff === 0
        ? 'balanced'
        : 'unbalanced';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (onlyFilled && amountOf(a) === 0) return false;
      if (!q) return true;
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, amounts, auxAmounts, search, onlyFilled]);

  const groups = useMemo(() => {
    const byCat = new Map<string, Account[]>();
    for (const a of filtered) {
      const arr = byCat.get(a.category) ?? [];
      arr.push(a);
      byCat.set(a.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((cat) => {
      const rows = (byCat.get(cat) ?? []).sort((x, y) =>
        x.code.localeCompare(y.code, 'zh-CN', { numeric: true }),
      );
      let debit = 0;
      let credit = 0;
      let filled = 0;
      for (const a of rows) {
        const cents = amountOf(a);
        if (cents !== 0) filled += 1;
        if (a.balanceSide === 'credit') credit += cents;
        else debit += cents;
      }
      return { cat, label: ACCOUNT_CATEGORY_LABEL[cat] ?? cat, rows, debit, credit, filled };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, amounts, auxAmounts]);

  const save = async () => {
    if (!bookId) return;
    if (totals.diff !== 0) {
      message.error(`借贷不平衡，差额 ${centsToMoney(Math.abs(totals.diff))}，请先调整`);
      return;
    }
    setSaving(true);
    try {
      // 科目级：普通科目取输入，辅助科目取明细汇总
      const items = accounts.map((a) => {
        const isCredit = a.balanceSide === 'credit';
        const cents = amountOf(a);
        const money = centsToMoney(cents);
        return {
          accountId: a.id,
          initialDebit: isCredit ? '0.00' : money,
          initialCredit: isCredit ? money : '0.00',
        };
      });
      // 辅助明细：只提交有金额的行
      const auxPayload: {
        accountId: number;
        auxType: string;
        auxItemId: number;
        debit: string;
        credit: string;
      }[] = [];
      for (const a of accounts) {
        if (!isAuxAccount(a)) continue;
        const per = auxAmounts[a.id] ?? {};
        const itemById = new Map(auxItems.map((x) => [x.id, x]));
        for (const [itemIdStr, v] of Object.entries(per)) {
          const d = toCents(v.debit);
          const c = toCents(v.credit);
          if (d === 0 && c === 0) continue;
          const item = itemById.get(Number(itemIdStr));
          if (!item) continue;
          auxPayload.push({
            accountId: a.id,
            auxType: item.auxType,
            auxItemId: item.id,
            debit: centsToMoney(d),
            credit: centsToMoney(c),
          });
        }
      }
      await api.put('/accounts/initial-balances', {
        bookId,
        items,
        auxItems: auxPayload,
      });
      message.success('期初余额已保存，账簿与报表将使用该期初');
      void load();
    } catch (e) {
      message.error(errorMessage(e, '保存期初余额失败'));
    } finally {
      setSaving(false);
    }
  };

  const onAmountKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const all = Array.from(document.querySelectorAll<HTMLInputElement>('input.ib-amount'));
    const idx = all.indexOf(e.currentTarget);
    all[idx + 1]?.focus();
  };

  const amountInput = (
    value: string,
    onChange: (v: string) => void,
    disabled: boolean,
  ) => (
    <Input
      className="ib-amount"
      value={value}
      disabled={disabled}
      placeholder="0.00"
      inputMode="decimal"
      style={{ textAlign: 'right' }}
      onChange={(e) => onChange(sanitizeAmount(e.target.value))}
      onBlur={() => onChange(normalizeAmount(value))}
      onKeyDown={onAmountKeyDown}
    />
  );

  const renderAuxExpanded = (account: Account) => {
    const flags = balanceAuxFlags(account);
    const rows = auxItems.filter((x) => flags.includes(x.auxType));
    if (rows.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`该账套还没有「${flags.map((f) => AUX_TYPE_LABEL[f] ?? f).join('、')}」辅助核算项，请先到「系统设置 → 辅助核算」新增`}
        />
      );
    }
    const s = auxSumOf(account.id);
    const setAux = (itemId: number, field: 'debit' | 'credit', v: string) =>
      setAuxAmounts((prev) => ({
        ...prev,
        [account.id]: {
          ...(prev[account.id] ?? {}),
          [itemId]: {
            debit: prev[account.id]?.[itemId]?.debit ?? '',
            credit: prev[account.id]?.[itemId]?.credit ?? '',
            [field]: v,
          },
        },
      }));

    return (
      <div style={{ padding: '4px 0 4px 32px' }}>
        <Space style={{ marginBottom: 6 }} wrap>
          <Typography.Text type="secondary">
            辅助明细合计：借 {fmtMoney(s.debit / 100)} / 贷 {fmtMoney(s.credit / 100)}
          </Typography.Text>
          <Typography.Text type="secondary">
            （科目期初取此合计，不需再单独填科目行）
          </Typography.Text>
        </Space>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={rows}
          columns={[
            {
              title: '辅助项',
              key: 'item',
              render: (_, r) => `${r.code} ${r.name}`,
            },
            {
              title: `借方`,
              key: 'debit',
              width: 160,
              align: 'right',
              render: (_, r) =>
                amountInput(
                  auxAmounts[account.id]?.[r.id]?.debit ?? '',
                  (v) => setAux(r.id, 'debit', v),
                  isReadOnly || locked,
                ),
            },
            {
              title: `贷方`,
              key: 'credit',
              width: 160,
              align: 'right',
              render: (_, r) =>
                amountInput(
                  auxAmounts[account.id]?.[r.id]?.credit ?? '',
                  (v) => setAux(r.id, 'credit', v),
                  isReadOnly || locked,
                ),
            },
          ]}
        />
      </div>
    );
  };

  const columns: ColumnsType<Account> = [
    { title: '科目编码', dataIndex: 'code', width: 120 },
    { title: '科目名称', dataIndex: 'name' },
    {
      title: '方向',
      dataIndex: 'balanceSide',
      width: 64,
      render: (v: string) => (v === 'credit' ? '贷' : '借'),
    },
    {
      title: '期初余额',
      key: 'amount',
      width: 180,
      align: 'right',
      render: (_, r) =>
        isAuxAccount(r) ? (
          <Typography.Text type="secondary">
            {fmtMoney(amountOf(r) / 100)}（按明细汇总）
          </Typography.Text>
        ) : (
          amountInput(
            amounts[r.id] ?? '',
            (v) => setAmounts((prev) => ({ ...prev, [r.id]: v })),
            isReadOnly || locked,
          )
        ),
    },
    {
      title: '辅助核算',
      key: 'aux',
      width: 150,
      render: (_, r) =>
        balanceAuxFlags(r).length ? (
          <Space size={4} wrap>
            {balanceAuxFlags(r).map((f) => (
              <Tag key={f} color="blue">
                {AUX_TYPE_LABEL[f] ?? f}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  if (status !== 'ready') {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader
          title="期初余额"
          description="录入建账期间各明细科目的期初余额，借贷必须平衡"
        />
        <BookRequiredState hint="期初余额按账套隔离，选择账套后即可录入" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: 'calc(100vh - 96px)',
      }}
    >
      <PageHeader
        title="期初余额"
        description={`录入建账期间各明细科目的期初余额，借贷必须平衡；当前账套：${book?.name ?? '—'}`}
        extra={
          <Button
            type="primary"
            onClick={() => void save()}
            loading={saving}
            disabled={isReadOnly || locked}
          >
            保存期初
          </Button>
        }
      />

      {error && <Alert type="error" showIcon message={error} />}
      {locked && (
        <Alert
          type="warning"
          showIcon
          message="该账套已有已记账凭证，期初余额已锁定；如需修改请先反记账"
        />
      )}

      <Card
        size="small"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{
          body: {
            flex: 1,
            minHeight: 0,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Space wrap size={8} style={{ marginBottom: 8 }}>
          <Input
            placeholder="搜索科目编码 / 名称"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Segmented
            value={onlyFilled ? 'filled' : 'all'}
            onChange={(v) => setOnlyFilled(v === 'filled')}
            options={[
              { label: '全部科目', value: 'all' },
              { label: '只看已填', value: 'filled' },
            ]}
          />
          <Button size="small" onClick={() => setExpanded(groups.map((g) => g.cat))}>
            展开全部
          </Button>
          <Button size="small" onClick={() => setExpanded([])}>
            折叠全部
          </Button>
          <Typography.Text type="secondary">
            往来类科目（应收/应付等）点左侧三角展开，按客户/供应商录明细
          </Typography.Text>
        </Space>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {groups.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={search ? '没有匹配的科目' : '该账套暂无明细科目'}
              style={{ marginTop: 48 }}
            />
          ) : (
            <Collapse
              activeKey={expanded}
              onChange={(k) => setExpanded(Array.isArray(k) ? k : [k])}
              items={groups.map((g) => ({
                key: g.cat,
                label: (
                  <Space size={12} wrap>
                    <Tag color="default">{g.label}</Tag>
                    <Typography.Text type="secondary">
                      已填 {g.filled}/{g.rows.length}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      借 {fmtMoney(g.debit / 100)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      贷 {fmtMoney(g.credit / 100)}
                    </Typography.Text>
                  </Space>
                ),
                children: (
                  <Table
                    rowKey="id"
                    size="small"
                    dataSource={g.rows}
                    columns={columns}
                    loading={loading}
                    pagination={false}
                    expandable={{
                      rowExpandable: (r) => isAuxAccount(r),
                      expandedRowRender: (r) => renderAuxExpanded(r),
                    }}
                  />
                ),
              }))}
            />
          )}
        </div>
      </Card>

      <Card size="small">
        <Space
          size={24}
          style={{ width: '100%', justifyContent: 'space-between' }}
          wrap
        >
          <Space size={24} wrap>
            <Typography.Text>
              借方合计 <b>{fmtMoney(totals.debit / 100)}</b>
            </Typography.Text>
            <Typography.Text>
              贷方合计 <b>{fmtMoney(totals.credit / 100)}</b>
            </Typography.Text>
            <Tag
              color={
                balanceState === 'balanced'
                  ? 'green'
                  : balanceState === 'unbalanced'
                    ? 'red'
                    : 'default'
              }
            >
              {balanceState === 'todo'
                ? '未录入'
                : balanceState === 'balanced'
                  ? '借贷平衡'
                  : `不平衡 差额 ${centsToMoney(Math.abs(totals.diff))}`}
            </Tag>
            <Typography.Text type="secondary">
              已填 {totals.filled}/{accounts.length}
            </Typography.Text>
          </Space>
          <Space size={8}>
            <Button onClick={() => void load()} loading={loading}>
              重置
            </Button>
            <Button
              type="primary"
              onClick={() => void save()}
              loading={saving}
              disabled={isReadOnly || locked}
            >
              保存期初
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
