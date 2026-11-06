import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  LoadingOutlined,
  PrinterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';
import BookSelect from '../components/BookSelect';
import BooksEmptyHint from '../components/BooksEmptyHint';
import PageHeader from '../components/PageHeader';
import { useBook } from '../context/BookContext';
import { STANDARD_LABEL, errorMessage } from '../lib/format';

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

type TabKey = 'balance' | 'income' | 'cashflow';

const TAB_META: Record<TabKey, { title: string; url: string }> = {
  balance: { title: '资产负债表', url: '/reports/balance-sheet' },
  income: { title: '利润表', url: '/reports/income-statement' },
  cashflow: { title: '现金流量表', url: '/reports/cash-flow' },
};

const TAB_KEYS: TabKey[] = ['balance', 'income', 'cashflow'];

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
          ? { fontWeight: 700 as const, fontVariantNumeric: 'tabular-nums' }
          : { fontVariantNumeric: 'tabular-nums' as const };
      return <span style={cls}>{value}</span>;
    },
  },
];

export default function Reports() {
  const { books, bookId, setBookId, loading: booksLoading } = useBook();
  const [period, setPeriod] = useState<Dayjs | null>(dayjs());
  const [activeTab, setActiveTab] = useState<TabKey>('balance');

  const [data, setData] = useState<Partial<Record<TabKey, unknown>>>({});
  const [errors, setErrors] = useState<Partial<Record<TabKey, string>>>({});
  const [loadingTabs, setLoadingTabs] = useState<TabKey[]>([]);
  const [queried, setQueried] = useState<{
    bookId: number;
    period: string;
    at: string;
  } | null>(null);
  const [querying, setQuerying] = useState(false);

  // 请求序号：切账套/期间后，旧请求的回包不允许覆盖新结果
  const reqIdRef = useRef(0);

  const fetchReport = useCallback(
    async (key: TabKey, params: { bookId: number; period: string }, reqId: number) => {
      try {
        const res = await api.get(TAB_META[key].url, { params });
        if (reqIdRef.current !== reqId) return;
        setData((prev) => ({ ...prev, [key]: res.data }));
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (e) {
        if (reqIdRef.current !== reqId) return;
        setErrors((prev) => ({
          ...prev,
          [key]: errorMessage(e, `${TAB_META[key].title}查询失败`),
        }));
      } finally {
        if (reqIdRef.current === reqId) {
          setLoadingTabs((prev) => prev.filter((k) => k !== key));
        }
      }
    },
    [],
  );

  /**
   * 一次查询 → 三张报表并发拉取。
   * 切换标签只读本地 state，不再发请求；单张失败也只影响该标签页。
   */
  const runQuery = useCallback(
    async (nextBookId?: number, nextPeriod?: Dayjs | null) => {
      const b = nextBookId ?? bookId;
      const p = nextPeriod ?? period;
      if (!b || !p) {
        message.warning('请先选择账套与期间');
        return;
      }
      const periodStr = p.format('YYYY-MM');
      const reqId = ++reqIdRef.current;
      setQuerying(true);
      setData({});
      setErrors({});
      setLoadingTabs([...TAB_KEYS]);
      setQueried({
        bookId: b,
        period: periodStr,
        at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
      const params = { bookId: b, period: periodStr };
      await Promise.all(TAB_KEYS.map((key) => fetchReport(key, params, reqId)));
      if (reqIdRef.current === reqId) setQuerying(false);
    },
    [bookId, period, fetchReport],
  );

  // 账套/期间变化时自动加载本期报表（账套已全局选择，跟随顶栏切换）
  useEffect(() => {
    if (!bookId || !period) return;
    void runQuery(bookId, period);
  }, [bookId, period, runQuery]);

  const retryTab = async (key: TabKey) => {
    if (!bookId || !period) return;
    const reqId = ++reqIdRef.current;
    setLoadingTabs((prev) => [...new Set([...prev, key])]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await fetchReport(key, { bookId, period: period.format('YYYY-MM') }, reqId);
  };

  const periodStr = period?.format('YYYY-MM') ?? '';
  const stale =
    !!queried && (queried.bookId !== bookId || queried.period !== periodStr);
  const loadedCount = TAB_KEYS.filter((k) => !!data[k]).length;

  const bookName = useMemo(
    () => books.find((b) => b.id === bookId)?.name ?? '未选择账套',
    [books, bookId],
  );
  const standard = useMemo(() => {
    const book = books.find((b) => b.id === bookId);
    const key = book?.accountingStandard ?? '';
    return STANDARD_LABEL[key] ?? '—';
  }, [books, bookId]);

  const renderBalance = (b: BalanceSheetData) => {
    const rows: ReportRow[] = [
      { key: 'sec-a', label: '资产', value: '', type: 'section' },
      ...(b.assets?.lines ?? []).map((l, i) => ({ ...l, key: `a-${i}` })),
      { key: 'a-total', label: '资产总计', value: b.totalAssets, type: 'total' },
      { key: 'sec-l', label: '负债', value: '', type: 'section' },
      ...(b.liabilities?.lines ?? []).map((l, i) => ({ ...l, key: `l-${i}` })),
      {
        key: 'l-total',
        label: '负债合计',
        value: b.liabilities?.total ?? '0.00',
        type: 'total',
      },
      { key: 'sec-e', label: '所有者权益（或股东权益）', value: '', type: 'section' },
      ...(b.equity?.lines ?? []).map((l, i) => ({ ...l, key: `e-${i}` })),
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
    <>
      <Table
        rowKey="key"
        columns={columns}
        dataSource={(d.rows ?? []).map((r, i) => ({ ...r, key: `i-${i}` }))}
        pagination={false}
        size="small"
        bordered
      />
      <div style={{ marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message={`本期净利润：${d.netProfit ?? '0.00'} 元`}
        />
      </div>
    </>
  );

  const renderCashflow = (d: CashFlowData) => {
    const rows: ReportRow[] = [
      { key: 'sec-o', label: '一、经营活动产生的现金流量', value: '', type: 'section' },
      ...(d.operating?.lines ?? []).map((l, i) => ({ ...l, key: `o-${i}` })),
      { key: 'sec-i', label: '二、投资活动产生的现金流量', value: '', type: 'section' },
      ...(d.investing?.lines ?? []).map((l, i) => ({ ...l, key: `iv-${i}` })),
      { key: 'sec-f', label: '三、筹资活动产生的现金流量', value: '', type: 'section' },
      ...(d.financing?.lines ?? []).map((l, i) => ({ ...l, key: `f-${i}` })),
      {
        key: 'net',
        label: '现金及现金等价物净增加额',
        value: d.netIncrease,
        type: 'subtotal',
      },
      {
        key: 'begin',
        label: '加：期初现金及现金等价物余额',
        value: d.beginningCash,
        type: 'item',
      },
      {
        key: 'end',
        label: '期末现金及现金等价物余额',
        value: d.endingCash,
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

  const tabBadge = (key: TabKey) => {
    if (loadingTabs.includes(key)) {
      return <LoadingOutlined style={{ marginInlineStart: 6, color: '#1677ff' }} />;
    }
    if (errors[key]) {
      return (
        <ExclamationCircleFilled style={{ marginInlineStart: 6, color: '#ff4d4f' }} />
      );
    }
    if (data[key]) {
      return (
        <CheckCircleFilled style={{ marginInlineStart: 6, color: '#52c41a' }} />
      );
    }
    return null;
  };

  const renderActive = () => {
    const key = activeTab;
    if (loadingTabs.includes(key)) {
      return <Skeleton active paragraph={{ rows: 10 }} style={{ padding: 16 }} />;
    }
    if (errors[key]) {
      return (
        <Alert
          type="error"
          showIcon
          message={`${TAB_META[key].title}加载失败`}
          description={errors[key]}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => void retryTab(key)}>
              只重试本表
            </Button>
          }
        />
      );
    }
    if (data[key]) {
      if (key === 'balance') return renderBalance(data[key] as BalanceSheetData);
      if (key === 'income') return renderIncome(data[key] as IncomeStatementData);
      return renderCashflow(data[key] as CashFlowData);
    }
    return (
      <Empty
        description="请选择账套与期间后点击查询"
        style={{ padding: 48 }}
      />
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="财务报表"
        description={
          queried
            ? `${bookName} · 本期 ${queried.period} · ${standard}｜上次查询 ${queried.at}，已加载 ${loadedCount}/3 张`
            : '选择账套与期间后一次查询，三张报表同时加载，切换标签不再重复请求'
        }
        extra={
          <Space>
            <Tag color={loadedCount === 3 ? 'green' : 'default'}>
              已加载 {loadedCount}/3
            </Tag>
            {querying && <Tag color="processing">查询中…</Tag>}
          </Space>
        }
      />

      <BooksEmptyHint books={books} loading={booksLoading} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Space size={4}>
            <Typography.Text type="secondary">账套</Typography.Text>
            <BookSelect
              books={books}
              value={bookId}
              onChange={setBookId}
              loading={booksLoading}
              style={{ width: 300 }}
            />
          </Space>
          <Space size={4}>
            <Typography.Text type="secondary">期间</Typography.Text>
            <DatePicker
              picker="month"
              value={period}
              onChange={setPeriod}
              allowClear={false}
            />
          </Space>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={querying}
            onClick={() => void runQuery()}
          >
            查询
          </Button>
          <Tooltip
            title={
              data[activeTab] ? '打印当前标签页' : '当前标签页暂无数据，请先查询'
            }
          >
            <Button
              icon={<PrinterOutlined />}
              disabled={!data[activeTab] || !bookId || !period}
              onClick={() => {
                if (!bookId || !period) {
                  message.error('请先选择账套与期间');
                  return;
                }
                window.open(
                  `/print/report?bookId=${bookId}&period=${period.format(
                    'YYYY-MM',
                  )}&type=${activeTab}`,
                  '_blank',
                );
              }}
            >
              打印
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {stale && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="查询条件已变更，当前展示的仍是上一次查询结果，点击「查询」刷新"
        />
      )}

      <Card size="small">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
          items={TAB_KEYS.map((key) => ({
            key,
            label: (
              <span>
                {TAB_META[key].title}
                {tabBadge(key)}
              </span>
            ),
          }))}
        />
        {renderActive()}
      </Card>
    </div>
  );
}
