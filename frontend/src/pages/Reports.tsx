import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/client';

const { Title } = Typography;

interface Book {
  id: number;
  name: string;
  accountingStandard: string;
}

interface ReportRow {
  key: string;
  label: string;
  value: string;
  type: 'section' | 'item' | 'subtotal' | 'total';
}

interface ReportSection {
  lines: ReportRow[];
  total: string;
}

interface BalanceSheetData {
  bookId: number;
  period: string;
  standard: string;
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  totalAssets: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
  difference: string;
}

interface IncomeStatementData {
  bookId: number;
  period: string;
  standard: string;
  rows: ReportRow[];
  netProfit: string;
}

interface CashFlowData {
  bookId: number;
  period: string;
  standard: string;
  operating: ReportSection;
  investing: ReportSection;
  financing: ReportSection;
  netIncrease: string;
  beginningCash: string;
  endingCash: string;
  reconciled: boolean;
  difference: string;
}

type ReportData =
  | { kind: 'balance'; data: BalanceSheetData }
  | { kind: 'income'; data: IncomeStatementData }
  | { kind: 'cashflow'; data: CashFlowData };

const columns: ColumnsType<ReportRow> = [
  {
    title: '项目',
    dataIndex: 'label',
    key: 'label',
    onCell: (row) => (row.type === 'section' ? { colSpan: 2 } : {}),
    render: (value: string, row) => {
      if (row.type === 'section') {
        return <strong style={{ color: '#1677ff' }}>{value}</strong>;
      }
      if (row.type === 'total' || row.type === 'subtotal') {
        return <strong>{value}</strong>;
      }
      return value;
    },
  },
  {
    title: '金额（元）',
    dataIndex: 'value',
    key: 'value',
    align: 'right',
    onCell: (row) => (row.type === 'section' ? { colSpan: 0 } : {}),
    render: (value: string, row) => {
      if (row.type === 'section') return null;
      const cls =
        row.type === 'total' || row.type === 'subtotal'
          ? { fontWeight: 700 as const }
          : undefined;
      return <span style={cls}>{value}</span>;
    },
  },
];

export default function Reports() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<Dayjs | null>(dayjs());
  const [activeTab, setActiveTab] = useState('balance');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/ledgers/books')
      .then((res) => setBooks(res.data.rows ?? []))
      .catch(() => setBooks([]));
  }, []);

  const query = useCallback(async () => {
    if (!bookId || !period) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        bookId,
        period: period.format('YYYY-MM'),
      };
      let res;
      if (activeTab === 'balance') {
        res = await api.get('/reports/balance-sheet', { params });
        setReport({ kind: 'balance', data: res.data });
      } else if (activeTab === 'income') {
        res = await api.get('/reports/income-statement', { params });
        setReport({ kind: 'income', data: res.data });
      } else {
        res = await api.get('/reports/cash-flow', { params });
        setReport({ kind: 'cashflow', data: res.data });
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? '报表查询失败';
      setError(Array.isArray(msg) ? msg.join('；') : String(msg));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [bookId, period, activeTab]);

  const standardLabel = (s: string) =>
    s === 'enterprise' ? '企业会计准则' : '小企业会计准则';

  const renderBalance = (b: BalanceSheetData) => {
    const rows: ReportRow[] = [
      { key: 'sec-a', label: '资产', value: '', type: 'section' },
      ...b.assets.lines.map((l, i) => ({ ...l, key: `a-${i}` })),
      { key: 'a-total', label: '资产总计', value: b.totalAssets, type: 'total' },
      { key: 'sec-l', label: '负债', value: '', type: 'section' },
      ...b.liabilities.lines.map((l, i) => ({ ...l, key: `l-${i}` })),
      { key: 'l-total', label: '负债合计', value: b.liabilities.total, type: 'total' },
      { key: 'sec-e', label: '所有者权益（或股东权益）', value: '', type: 'section' },
      ...b.equity.lines.map((l, i) => ({ ...l, key: `e-${i}` })),
      {
        key: 'e-total',
        label: '负债和所有者权益（或股东权益）总计',
        value: b.totalLiabilitiesAndEquity,
        type: 'total',
      },
    ];
    return (
      <>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          bordered
        />
        <div style={{ marginTop: 16 }}>
          {b.balanced ? (
            <Alert
              type="success"
              showIcon
              message="勾稽校验通过：资产总计 = 负债合计 + 所有者权益合计"
            />
          ) : (
            <Alert
              type="error"
              showIcon
              message={`勾稽校验未通过：资产总计与负债和所有者权益总计相差 ${b.difference} 元`}
            />
          )}
        </div>
      </>
    );
  };

  const renderIncome = (d: IncomeStatementData) => (
    <Table
      rowKey="label"
      columns={columns}
      dataSource={d.rows.map((r, i) => ({ ...r, key: `i-${i}` }))}
      pagination={false}
      size="small"
      bordered
    />
  );

  const renderCashflow = (d: CashFlowData) => {
    const rows: ReportRow[] = [
      { key: 'sec-o', label: '一、经营活动产生的现金流量', value: '', type: 'section' },
      ...d.operating.lines.map((l, i) => ({ ...l, key: `o-${i}` })),
      { key: 'sec-i', label: '二、投资活动产生的现金流量', value: '', type: 'section' },
      ...d.investing.lines.map((l, i) => ({ ...l, key: `iv-${i}` })),
      { key: 'sec-f', label: '三、筹资活动产生的现金流量', value: '', type: 'section' },
      ...d.financing.lines.map((l, i) => ({ ...l, key: `f-${i}` })),
      { key: 'net', label: '现金及现金等价物净增加额', value: d.netIncrease, type: 'subtotal' },
      { key: 'begin', label: '加：期初现金及现金等价物余额', value: d.beginningCash, type: 'item' },
      { key: 'end', label: '期末现金及现金等价物余额', value: d.endingCash, type: 'total' },
    ];
    return (
      <>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          bordered
        />
        <div style={{ marginTop: 16 }}>
          {d.reconciled ? (
            <Alert
              type="success"
              showIcon
              message="勾稽校验通过：期末现金及现金等价物余额 = 货币资金科目余额"
            />
          ) : (
            <Alert
              type="error"
              showIcon
              message={`勾稽校验未通过：三大活动净额与现金净增加额相差 ${d.difference} 元`}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>财务报表</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>账套：</span>
          <Select
            style={{ width: 260 }}
            placeholder="请选择账套"
            value={bookId}
            onChange={setBookId}
            options={books.map((b) => ({
              value: b.id,
              label: `${b.name}（${standardLabel(b.accountingStandard)}）`,
            }))}
          />
          <span>期间：</span>
          <DatePicker
            picker="month"
            value={period}
            onChange={setPeriod}
            allowClear={false}
          />
          <Button type="primary" loading={loading} onClick={query}>
            查询
          </Button>
          <Button
            onClick={() => {
              if (!bookId || !period) {
                message.error('请先选择账套与期间');
                return;
              }
              window.open(
                `/print/report?bookId=${bookId}&period=${period.format('YYYY-MM')}&type=${activeTab}`,
                '_blank',
              );
            }}
          >
            打印
          </Button>
        </Space>
      </Card>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Card size="small">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setReport(null);
          }}
          items={[
            { key: 'balance', label: '资产负债表' },
            { key: 'income', label: '利润表' },
            { key: 'cashflow', label: '现金流量表' },
          ]}
        />
        {!report ? (
          <Empty description="请选择账套与期间后点击查询" style={{ padding: 32 }} />
        ) : report.kind === 'balance' ? (
          renderBalance(report.data)
        ) : report.kind === 'income' ? (
          renderIncome(report.data)
        ) : (
          renderCashflow(report.data)
        )}
      </Card>
    </div>
  );
}
