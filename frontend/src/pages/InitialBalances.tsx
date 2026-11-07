import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  InputNumber,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';
import { centsToMoney, errorMessage, toCents } from '../lib/format';

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

/**
 * 期初余额录入（期初建账）。
 * 金蝶/用友通行做法：按科目天然方向录一个金额，Σ借=Σ贷 才能保存；已记账后锁定。
 */
export default function InitialBalances() {
  const { bookId, book } = useBook();
  const { isReadOnly } = useRole();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amounts, setAmounts] = useState<Record<number, number>>({});
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
        api.get('/vouchers', {
          params: { bookId, status: 'posted', pageSize: 1 },
        }),
      ]);
      const list = (acctRes.data as Account[]).filter((a) => a.isLeaf);
      setAccounts(list);
      const map: Record<number, number> = {};
      for (const a of list) {
        const raw = a.balanceSide === 'credit' ? a.initialCredit : a.initialDebit;
        map[a.id] = toCents(raw);
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

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const a of accounts) {
      const v = toCents(amounts[a.id] ?? 0);
      if (a.balanceSide === 'credit') credit += v;
      else debit += v;
    }
    return { debit, credit, diff: debit - credit };
  }, [accounts, amounts]);

  const save = async () => {
    if (!bookId) return;
    if (totals.diff !== 0) {
      message.error(
        `期初余额借贷不平衡：差额 ${centsToMoney(Math.abs(totals.diff))}，请先调整`,
      );
      return;
    }
    setSaving(true);
    try {
      const items = accounts.map((a) => {
        const money = centsToMoney(amounts[a.id] ?? 0);
        const isCredit = a.balanceSide === 'credit';
        return {
          accountId: a.id,
          initialDebit: isCredit ? '0' : money,
          initialCredit: isCredit ? money : '0',
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

  const columns: ColumnsType<Account> = [
    { title: '科目编码', dataIndex: 'code', width: 120 },
    { title: '科目名称', dataIndex: 'name' },
    {
      title: '方向',
      dataIndex: 'balanceSide',
      width: 70,
      render: (v: string) => (v === 'credit' ? '贷' : '借'),
    },
    {
      title: '期初余额',
      key: 'initial',
      width: 180,
      align: 'right',
      render: (_, r) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={(amounts[r.id] ?? 0) / 100}
          disabled={isReadOnly || locked}
          onChange={(v) =>
            setAmounts((prev) => ({ ...prev, [r.id]: toCents(Number(v) || 0) }))
          }
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="期初余额"
        description={`录入建账期间各明细科目的期初余额，借贷必须平衡；当前账套：${book?.name ?? '—'}`}
        extra={
          <Space>
            <Tag color={totals.diff === 0 ? 'green' : 'red'}>
              {totals.diff === 0
                ? '借贷平衡'
                : `不平衡 差额 ${centsToMoney(Math.abs(totals.diff))}`}
            </Tag>
            <Button onClick={() => void load()} loading={loading}>
              刷新
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
        }
      />

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}
      {locked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="该账套已有已记账凭证，期初余额已锁定；如需修改请先反记账"
        />
      )}

      <Card size="small">
        <Space size={28} style={{ marginBottom: 12 }}>
          <Typography.Text>
            期初借方合计：<b>{centsToMoney(totals.debit)}</b>
          </Typography.Text>
          <Typography.Text>
            期初贷方合计：<b>{centsToMoney(totals.credit)}</b>
          </Typography.Text>
          <Typography.Text type="secondary">
            按科目天然方向录入（借方科目填借方、贷方科目填贷方）
          </Typography.Text>
        </Space>
        <Table
          rowKey="id"
          size="small"
          dataSource={accounts}
          columns={columns}
          loading={loading}
          pagination={false}
          scroll={{ y: 520 }}
        />
      </Card>
    </div>
  );
}
