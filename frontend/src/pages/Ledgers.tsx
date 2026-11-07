import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Empty,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';
import AccountSelect from '../components/AccountSelect';
import PageHeader from '../components/PageHeader';
import { useAccounts } from '../hooks/useAccounts';
import { useBook } from '../context/BookContext';
import { errorMessage } from '../lib/format';

interface BalanceRow {
  accountId: number;
  code: string;
  name: string;
  category: string;
  balanceSide: string;
  initialDebit: string;
  initialCredit: string;
  currentDebit: string;
  currentCredit: string;
  finalDebit: string;
  finalCredit: string;
}

interface DetailLine {
  date: string;
  voucherType: string;
  voucherNo: number;
  summary: string;
  debit: string;
  credit: string;
  balance: string;
  balanceDirection: string;
}

interface DetailResult {
  account: { accountId: number; code: string; name: string };
  opening: { amount: string; direction: string };
  currentDebit: string;
  currentCredit: string;
  closing: { amount: string; direction: string };
  lines: DetailLine[];
}

interface JournalLine {
  date: string;
  voucherType: string;
  voucherNo: number;
  summary: string;
  oppositeAccount: string;
  income: string;
  expense: string;
  balance: string;
  balanceDirection: string;
}

interface JournalResult {
  account: { code: string; name: string };
  opening: { amount: string; direction: string };
  summary: {
    totalIncome: string;
    totalExpense: string;
    closing: string;
    direction: string;
  };
  lines: JournalLine[];
}

interface TrialBalance {
  balanced: boolean;
  initialDebit: string;
  initialCredit: string;
  currentDebit: string;
  currentCredit: string;
  finalDebit: string;
  finalCredit: string;
}

const categoryText: Record<string, string> = {
  asset: '资产',
  liability: '负债',
  common: '共同',
  equity: '权益',
  cost: '成本',
  pnl: '损益',
};

const balanceColumns: ColumnsType<BalanceRow> = [
  { title: '科目编码', dataIndex: 'code', width: 110 },
  { title: '科目名称', dataIndex: 'name', width: 160 },
  {
    title: '类别',
    dataIndex: 'category',
    width: 80,
    render: (v: string) => categoryText[v] ?? v,
  },
  { title: '期初借方', dataIndex: 'initialDebit', align: 'right' },
  { title: '期初贷方', dataIndex: 'initialCredit', align: 'right' },
  { title: '本期借方', dataIndex: 'currentDebit', align: 'right' },
  { title: '本期贷方', dataIndex: 'currentCredit', align: 'right' },
  { title: '期末借方', dataIndex: 'finalDebit', align: 'right' },
  { title: '期末贷方', dataIndex: 'finalCredit', align: 'right' },
];

const dirText = (d: string) => (d === 'debit' ? '借' : '贷');

export default function Ledgers() {
  const { books, bookId, setBookId, loading: booksLoading } = useBook();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const startPeriod = range[0].format('YYYY-MM');
  const endPeriod = range[1].format('YYYY-MM');
  const [tab, setTab] = useState('general');

  const [generalRows, setGeneralRows] = useState<BalanceRow[]>([]);
  const [balanceRows, setBalanceRows] = useState<BalanceRow[]>([]);
  const [trial, setTrial] = useState<TrialBalance>();
  const [detail, setDetail] = useState<DetailResult>();
  const [journal, setJournal] = useState<JournalResult>();
  const [detailAccountId, setDetailAccountId] = useState<number>();
  const [journalType, setJournalType] = useState<'cash' | 'bank'>('cash');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const { leafAccounts, loading: accountsLoading } = useAccounts(bookId);

  const load = useCallback(async () => {
    if (bookId == null) return;
    setLoading(true);
    setError(undefined);
    try {
      if (tab === 'general') {
        const r = await api.get('/ledgers/general', {
          params: { bookId, period: endPeriod },
        });
        setGeneralRows(r.data.rows ?? []);
      } else if (tab === 'balance') {
        const r = await api.get('/ledgers/account-balance', {
          params: { bookId, period: endPeriod },
        });
        setBalanceRows(r.data.rows ?? []);
      } else if (tab === 'trial') {
        const r = await api.get('/ledgers/trial-balance', {
          params: { bookId, period: endPeriod },
        });
        setTrial(r.data);
      } else if (tab === 'detail') {
        if (detailAccountId == null) {
          setDetail(undefined);
        } else {
          const r = await api.get('/ledgers/detail', {
            params: {
              bookId,
              period: endPeriod,
              startPeriod,
              accountId: detailAccountId,
            },
          });
          setDetail(r.data);
        }
      } else if (tab === 'journal') {
        const r = await api.get('/ledgers/journal', {
          params: { bookId, period: endPeriod, startPeriod, type: journalType },
        });
        setJournal(r.data);
      }
    } catch (e) {
      setError(errorMessage(e, '查询失败'));
    } finally {
      setLoading(false);
    }
  }, [bookId, startPeriod, endPeriod, tab, detailAccountId, journalType]);

  useEffect(() => {
    void load();
  }, [load]);

  const detailColumns: ColumnsType<DetailLine> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '凭证字号',
      width: 110,
      render: (_, r) => `${r.voucherType}-${r.voucherNo}`,
    },
    { title: '摘要', dataIndex: 'summary' },
    { title: '借方', dataIndex: 'debit', align: 'right', width: 130 },
    { title: '贷方', dataIndex: 'credit', align: 'right', width: 130 },
    {
      title: '余额',
      align: 'right',
      width: 130,
      render: (_, r) => `${dirText(r.balanceDirection)} ${r.balance}`,
    },
  ];

  const journalColumns: ColumnsType<JournalLine> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '凭证字号',
      width: 110,
      render: (_, r) => `${r.voucherType}-${r.voucherNo}`,
    },
    { title: '摘要', dataIndex: 'summary' },
    { title: '对方科目', dataIndex: 'oppositeAccount', width: 180 },
    { title: '收入(借)', dataIndex: 'income', align: 'right', width: 130 },
    { title: '支出(贷)', dataIndex: 'expense', align: 'right', width: 130 },
    {
      title: '余额',
      align: 'right',
      width: 130,
      render: (_, r) => `${dirText(r.balanceDirection)} ${r.balance}`,
    },
  ];

  const trialRows = trial
    ? [
        { key: '期初', debit: trial.initialDebit, credit: trial.initialCredit },
        { key: '本期发生', debit: trial.currentDebit, credit: trial.currentCredit },
        { key: '期末', debit: trial.finalDebit, credit: trial.finalCredit },
      ]
    : [];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="账簿查询"
        description={`${startPeriod} ~ ${endPeriod} · 总账 / 明细账 / 日记账 / 余额表 / 试算平衡，共用同一「账套 + 起止期间」口径`}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
              刷新
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              打印
            </Button>
          </Space>
        }
      />


      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Typography.Text type="secondary">起止期间</Typography.Text>
            <DatePicker.RangePicker
              picker="month"
              value={range}
              onChange={(v) => {
                if (v && v[0] && v[1]) setRange([v[0], v[1]]);
              }}
              allowClear={false}
              style={{ width: 260 }}
            />
          </Space>
        </Space>
      </Card>

      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'general', label: '总账' },
            { key: 'detail', label: '明细账' },
            { key: 'journal', label: '日记账' },
            { key: 'balance', label: '科目余额表' },
            { key: 'trial', label: '试算平衡' },
          ]}
        />

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 12 }}
            action={
              <Button size="small" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        )}

        {tab === 'general' && (
          <Table
            rowKey="accountId"
            columns={balanceColumns}
            dataSource={generalRows}
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ x: 960 }}
            locale={{ emptyText: '本期暂无发生额（请确认已记账凭证所属期间）' }}
          />
        )}

        {tab === 'balance' && (
          <Table
            rowKey="accountId"
            columns={balanceColumns}
            dataSource={balanceRows}
            loading={loading}
            size="small"
            scroll={{ x: 960 }}
            locale={{ emptyText: '本期暂无科目余额数据' }}
          />
        )}

        {tab === 'trial' &&
          (trial ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type={trial.balanced ? 'success' : 'error'}
                showIcon
                message={trial.balanced ? '试算平衡' : '试算不平衡（借贷不等）'}
              />
              <Table
                rowKey="key"
                pagination={false}
                size="small"
                columns={[
                  { title: '项目', dataIndex: 'key', width: 160 },
                  { title: '借方合计', dataIndex: 'debit', align: 'right' },
                  { title: '贷方合计', dataIndex: 'credit', align: 'right' },
                ]}
                dataSource={trialRows}
              />
            </Space>
          ) : (
            <Empty description="正在读取试算平衡数据" />
          ))}

        {tab === 'detail' && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space size={8} wrap>
              <Typography.Text type="secondary">选择明细科目</Typography.Text>
              <AccountSelect
                accounts={leafAccounts}
                value={detailAccountId}
                loading={accountsLoading}
                showCategory
                onChange={(id) => setDetailAccountId(id)}
                placeholder="输入科目编码 / 名称，如 1001"
                style={{ width: 380 }}
              />
            </Space>
            {detail ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Descriptions
                  size="small"
                  bordered
                  column={{ xs: 1, sm: 2, md: 4 }}
                  items={[
                    {
                      key: 'account',
                      label: '科目',
                      children: `${detail.account.code} ${detail.account.name}`,
                    },
                    {
                      key: 'opening',
                      label: '期初余额',
                      children: `${dirText(detail.opening.direction)} ${detail.opening.amount}`,
                    },
                    {
                      key: 'debit',
                      label: '本期借方',
                      children: detail.currentDebit,
                    },
                    {
                      key: 'credit',
                      label: '本期贷方',
                      children: detail.currentCredit,
                    },
                    {
                      key: 'closing',
                      label: '期末余额',
                      children: `${dirText(detail.closing.direction)} ${detail.closing.amount}`,
                    },
                  ]}
                />
                <Table
                  rowKey={(r) => `${r.voucherType}-${r.voucherNo}-${r.summary}`}
                  columns={detailColumns}
                  dataSource={detail.lines}
                  loading={loading}
                  size="small"
                  scroll={{ x: 800 }}
                  locale={{ emptyText: '该科目本期无明细发生额' }}
                />
              </Space>
            ) : (
              <Empty description="请选择要查看的明细科目" />
            )}
          </Space>
        )}

        {tab === 'journal' && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space size={8}>
              <Typography.Text type="secondary">类型</Typography.Text>
              <Select
                style={{ width: 180 }}
                value={journalType}
                onChange={(v) => setJournalType(v)}
                options={[
                  { value: 'cash', label: '现金日记账' },
                  { value: 'bank', label: '银行日记账' },
                ]}
              />
            </Space>
            {journal ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Descriptions
                  size="small"
                  bordered
                  column={{ xs: 1, sm: 2, md: 4 }}
                  items={[
                    {
                      key: 'account',
                      label: '科目',
                      children: `${journal.account.code} ${journal.account.name}`,
                    },
                    {
                      key: 'opening',
                      label: '期初余额',
                      children: `${dirText(journal.opening.direction)} ${journal.opening.amount}`,
                    },
                    {
                      key: 'income',
                      label: '本月收入',
                      children: journal.summary.totalIncome,
                    },
                    {
                      key: 'expense',
                      label: '本月支出',
                      children: journal.summary.totalExpense,
                    },
                    {
                      key: 'closing',
                      label: '月末余额',
                      children: `${dirText(journal.summary.direction)} ${journal.summary.closing}`,
                    },
                  ]}
                />
                <Table
                  rowKey={(r) => `${r.voucherType}-${r.voucherNo}-${r.summary}`}
                  columns={journalColumns}
                  dataSource={journal.lines}
                  loading={loading}
                  size="small"
                  scroll={{ x: 900 }}
                  locale={{ emptyText: '该账户本期无收付记录' }}
                />
              </Space>
            ) : (
              <Empty description="无日记账数据" />
            )}
          </Space>
        )}
      </Card>
    </div>
  );
}
