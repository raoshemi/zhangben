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
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';
import {
  ACCOUNT_CATEGORY_LABEL,
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

const CATEGORY_ORDER = ['asset', 'liability', 'common', 'equity', 'cost', 'pnl'] as const;

/**
 * 期初余额录入（期初建账）。
 *
 * 交互按金蝶/用友的成熟做法重做：
 * - 按会计要素分组折叠，不会一进来就是 100+ 行；
 * - 支持按编码/名称搜索、"只看已填"；
 * - 底部常驻借贷合计与差额，三态提示（未录入/平衡/不平衡）；
 * - 纯文本输入避免 InputNumber 吃掉方向键，回车跳到下一格。
 */
export default function InitialBalances() {
  const { bookId, book } = useBook();
  const { isReadOnly } = useRole();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
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
      const [acctRes, posted] = await Promise.all([
        api.get('/accounts', { params: { bookId } }),
        api.get('/vouchers', { params: { bookId, status: 'posted', pageSize: 1 } }),
      ]);
      const list = (acctRes.data as Account[]).filter((a) => a.isLeaf);
      setAccounts(list);
      const map: Record<number, string> = {};
      for (const a of list) {
        const raw = a.balanceSide === 'credit' ? a.initialCredit : a.initialDebit;
        const cents = toCents(raw);
        map[a.id] = cents === 0 ? '' : centsToMoney(cents);
      }
      setAmounts(map);
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

  /** 合计：amounts 以「元」字符串保存，这里只 toCents 一次（修掉之前重复换算导致 100 倍的问题） */
  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let filled = 0;
    for (const a of accounts) {
      const cents = toCents(amounts[a.id] ?? '');
      if (cents !== 0) filled += 1;
      if (a.balanceSide === 'credit') credit += cents;
      else debit += cents;
    }
    return { debit, credit, diff: debit - credit, filled };
  }, [accounts, amounts]);

  const balanceState =
    totals.debit === 0 && totals.credit === 0
      ? 'todo'
      : totals.diff === 0
        ? 'balanced'
        : 'unbalanced';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (onlyFilled && toCents(amounts[a.id] ?? '') === 0) return false;
      if (!q) return true;
      return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    });
  }, [accounts, amounts, search, onlyFilled]);

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
        const cents = toCents(amounts[a.id] ?? '');
        if (cents !== 0) filled += 1;
        if (a.balanceSide === 'credit') credit += cents;
        else debit += cents;
      }
      return { cat, label: ACCOUNT_CATEGORY_LABEL[cat] ?? cat, rows, debit, credit, filled };
    });
  }, [filtered, amounts]);

  const save = async () => {
    if (!bookId) return;
    if (totals.diff !== 0) {
      message.error(`借贷不平衡，差额 ${centsToMoney(Math.abs(totals.diff))}，请先调整`);
      return;
    }
    setSaving(true);
    try {
      // 始终提交全量明细科目：避免"只提交有余额的行"绕过平衡校验
      const items = accounts.map((a) => {
        const cents = toCents(amounts[a.id] ?? '');
        const money = centsToMoney(cents);
        const isCredit = a.balanceSide === 'credit';
        return {
          accountId: a.id,
          initialDebit: isCredit ? '0.00' : money,
          initialCredit: isCredit ? money : '0.00',
        };
      });
      await api.put('/accounts/initial-balances', { bookId, items });
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
      render: (_, r) => (
        <Input
          className="ib-amount"
          value={amounts[r.id] ?? ''}
          disabled={isReadOnly || locked}
          placeholder="0.00"
          inputMode="decimal"
          style={{ textAlign: 'right' }}
          onChange={(e) =>
            setAmounts((prev) => ({ ...prev, [r.id]: sanitizeAmount(e.target.value) }))
          }
          onBlur={() =>
            setAmounts((prev) => ({ ...prev, [r.id]: normalizeAmount(prev[r.id] ?? '') }))
          }
          onKeyDown={onAmountKeyDown}
        />
      ),
    },
    {
      title: '辅助核算',
      key: 'aux',
      width: 150,
      render: (_, r) =>
        r.auxFlags && r.auxFlags.length ? (
          <Space size={4} wrap>
            {r.auxFlags
              .filter((f) => f !== 'cashflow')
              .map((f) => (
                <Tag key={f} color="blue">
                  {f === 'customer'
                    ? '客户'
                    : f === 'supplier'
                      ? '供应商'
                      : f === 'department'
                        ? '部门'
                        : f === 'employee'
                          ? '职员'
                          : '项目'}
                </Tag>
              ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

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
                  />
                ),
              }))}
            />
          )}
        </div>
      </Card>

      {/* 常驻合计栏 */}
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
            <Tag color={balanceState === 'balanced' ? 'green' : balanceState === 'unbalanced' ? 'red' : 'default'}>
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
