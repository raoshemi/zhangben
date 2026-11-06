import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';

const { Title, Text } = Typography;

interface Book {
  id: number;
  name: string;
  accountingStandard: string;
}

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

export default function Ledgers() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<number>();
  const [period, setPeriod] = useState<string>(dayjs().format('YYYY-MM'));
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

  useEffect(() => {
    api
      .get<{ rows: Book[] }>('/ledgers/books')
      .then((r) => {
        setBooks(r.data.rows);
        if (r.data.rows.length && bookId == null) setBookId(r.data.rows[0].id);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const load = useCallback(async () => {
    if (bookId == null) return;
    setLoading(true);
    setError(undefined);
    try {
      if (tab === 'general') {
        const r = await api.get('/ledgers/general', {
          params: { bookId, period },
        });
        setGeneralRows(r.data.rows ?? []);
      } else if (tab === 'balance') {
        const r = await api.get('/ledgers/account-balance', {
          params: { bookId, period },
        });
        setBalanceRows(r.data.rows ?? []);
      } else if (tab === 'trial') {
        const r = await api.get('/ledgers/trial-balance', {
          params: { bookId, period },
        });
        setTrial(r.data);
      } else if (tab === 'detail') {
        if (detailAccountId == null) {
          setDetail(undefined);
        } else {
          const r = await api.get('/ledgers/detail', {
            params: { bookId, period, accountId: detailAccountId },
          });
          setDetail(r.data);
        }
      } else if (tab === 'journal') {
        const r = await api.get('/ledgers/journal', {
          params: { bookId, period, type: journalType },
        });
        setJournal(r.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? '查询失败');
    } finally {
      setLoading(false);
    }
  }, [bookId, period, tab, detailAccountId, journalType]);

  useEffect(() => {
    load();
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
      render: (_, r) => `${r.balanceDirection === 'debit' ? '借' : '贷'} ${r.balance}`,
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
      render: (_, r) => `${r.balanceDirection === 'debit' ? '借' : '贷'} ${r.balance}`,
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
    <Card style={{ margin: 24 }}>
      <Title level={4}>账簿查询</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <span>账套：</span>
        <Select
          style={{ width: 200 }}
          placeholder="选择账套"
          value={bookId}
          onChange={(v) => setBookId(v)}
          options={books.map((b) => ({ value: b.id, label: b.name }))}
        />
        <span>期间：</span>
        <DatePicker
          picker="month"
          value={period ? dayjs(period) : null}
          onChange={(d: Dayjs | null) => d && setPeriod(d.format('YYYY-MM'))}
          allowClear={false}
        />
        <Button onClick={() => window.print()}>打印</Button>
      </Space>

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
        />
      )}

      {tab === 'trial' &&
        (trial ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type={trial.balanced ? 'success' : 'error'}
              showIcon
              message={
                trial.balanced ? '试算平衡' : '试算不平衡（借贷不等）'
              }
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
          <Empty description="请先选择账套与期间" />
        ))}

      {tab === 'detail' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <span>科目 ID：</span>
            <InputNumber
              min={1}
              placeholder="输入科目 ID"
              value={detailAccountId}
              onChange={(v) => setDetailAccountId(v ?? undefined)}
            />
          </Space>
          {detail ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                {detail.account.code} {detail.account.name}｜期初{' '}
                {detail.opening.direction === 'debit' ? '借' : '贷'}{' '}
                {detail.opening.amount}｜本期借 {detail.currentDebit}｜本期贷{' '}
                {detail.currentCredit}｜期末{' '}
                {detail.closing.direction === 'debit' ? '借' : '贷'}{' '}
                {detail.closing.amount}
              </Text>
              <Table
                rowKey={(r) => `${r.voucherType}-${r.voucherNo}-${r.summary}`}
                columns={detailColumns}
                dataSource={detail.lines}
                loading={loading}
                size="small"
                scroll={{ x: 800 }}
              />
            </Space>
          ) : (
            <Empty description="请输入科目 ID 查询明细账" />
          )}
        </Space>
      )}

      {tab === 'journal' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <span>类型：</span>
            <Select
              style={{ width: 160 }}
              value={journalType}
              onChange={(v) => setJournalType(v)}
              options={[
                { value: 'cash', label: '现金日记账' },
                { value: 'bank', label: '银行日记账' },
              ]}
            />
          </Space>
          {journal ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                {journal.account.code} {journal.account.name}｜期初{' '}
                {journal.opening.direction === 'debit' ? '借' : '贷'}{' '}
                {journal.opening.amount}｜本月收入 {journal.summary.totalIncome}
                ｜本月支出 {journal.summary.totalExpense}｜月末余额{' '}
                {journal.summary.direction === 'debit' ? '借' : '贷'}{' '}
                {journal.summary.closing}
              </Text>
              <Table
                rowKey={(r) => `${r.voucherType}-${r.voucherNo}-${r.summary}`}
                columns={journalColumns}
                dataSource={journal.lines}
                loading={loading}
                size="small"
                scroll={{ x: 900 }}
              />
            </Space>
          ) : (
            <Empty description="无日记账数据" />
          )}
        </Space>
      )}

    </Card>
  );
}
