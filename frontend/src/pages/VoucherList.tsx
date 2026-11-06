import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/client';
import VoucherEdit from './VoucherEdit';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'blue' },
  approved: { text: '已审核', color: 'cyan' },
  posted: { text: '已记账', color: 'green' },
  voided: { text: '已作废', color: 'red' },
};

interface Entry {
  lineNo: number;
  summary: string;
  direction: string;
  amount: string;
  account?: { code: string; name: string };
}

interface Voucher {
  id: number;
  bookId: number;
  period: string;
  date: string;
  voucherType: string;
  voucherNo: number;
  attachmentCount: number;
  status: string;
  entries: Entry[];
  creator?: { displayName?: string | null; username: string };
}

function fmtDate(s?: string | null): string {
  if (!s) return '';
  return String(s).slice(0, 10);
}

function getUserRole(): string {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      return (u && u.role) || 'viewer';
    }
  } catch {
    /* ignore */
  }
  return 'viewer';
}

export default function VoucherList() {
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [bookId, setBookId] = useState(1);
  const [period, setPeriod] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const role = getUserRole();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vouchers', {
        params: {
          bookId,
          period,
          status,
          keyword: keyword || undefined,
          page,
          pageSize,
        },
      });
      setData(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '加载凭证失败');
    } finally {
      setLoading(false);
    }
  }, [bookId, period, status, keyword, page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      fetchList();
    } catch (e: any) {
      message.error(e?.response?.data?.message || '操作失败');
    }
  };

  const columns: TableColumnsType<Voucher> = [
    { title: '期间', dataIndex: 'period', width: 90 },
    {
      title: '凭证字号',
      key: 'no',
      width: 110,
      render: (_, r) => `${r.voucherType}-${r.voucherNo}`,
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (v: string) => fmtDate(v),
    },
    {
      title: '摘要',
      dataIndex: 'entries',
      ellipsis: true,
      render: (entries: Entry[]) => entries?.[0]?.summary ?? '',
    },
    {
      title: '借方合计',
      key: 'debit',
      width: 120,
      align: 'right',
      render: (_, r) =>
        r.entries
          .filter((e) => e.direction === 'debit')
          .reduce((s, e) => s + Number(e.amount), 0)
          .toFixed(2),
    },
    {
      title: '贷方合计',
      key: 'credit',
      width: 120,
      align: 'right',
      render: (_, r) =>
        r.entries
          .filter((e) => e.direction === 'credit')
          .reduce((s, e) => s + Number(e.amount), 0)
          .toFixed(2),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const m = STATUS_MAP[s] ?? { text: s, color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '制单人',
      key: 'creator',
      width: 100,
      render: (_, r) => r.creator?.displayName || r.creator?.username || '',
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'draft' && (
            <Button
              size="small"
              onClick={() =>
                run(() => api.post(`/vouchers/${r.id}/submit`), '已提交')
              }
            >
              提交
            </Button>
          )}
          {r.status === 'submitted' && (role === 'approver' || role === 'admin') && (
            <Button
              size="small"
              type="primary"
              onClick={() =>
                run(() => api.post(`/vouchers/${r.id}/approve`), '已审核')
              }
            >
              审核
            </Button>
          )}
          {r.status === 'approved' && (role === 'poster' || role === 'admin') && (
            <Button
              size="small"
              type="primary"
              onClick={() =>
                run(() => api.post(`/vouchers/${r.id}/post`), '已记账')
              }
            >
              记账
            </Button>
          )}
          {r.status === 'posted' && (role === 'poster' || role === 'admin') && (
            <Popconfirm
              title="确认红字冲销该凭证？"
              onConfirm={() =>
                run(() => api.post(`/vouchers/${r.id}/reverse`), '已冲销')
              }
            >
              <Button size="small" danger>
                冲销
              </Button>
            </Popconfirm>
          )}
          {r.status !== 'posted' && r.status !== 'voided' && (
            <Popconfirm
              title="确认作废该凭证？"
              onConfirm={() =>
                run(() => api.delete(`/vouchers/${r.id}`), '已作废')
              }
            >
              <Button size="small" danger>
                作废
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space wrap style={{ marginBottom: 16 }}>
        <span>账套</span>
        <InputNumber
          min={1}
          value={bookId}
          onChange={(v) => setBookId(Number(v) || 1)}
          style={{ width: 90 }}
        />
        <DatePicker
          picker="month"
          value={period ? dayjs(period, 'YYYY-MM') : null}
          onChange={(d: Dayjs | null) => setPeriod(d ? d.format('YYYY-MM') : undefined)}
          placeholder="会计期间"
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(STATUS_MAP).map(([value, m]) => ({
            value,
            label: m.text,
          }))}
        />
        <Input
          allowClear
          placeholder="摘要/凭证号"
          style={{ width: 180 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => {
            setPage(1);
            fetchList();
          }}
        />
        <Button type="primary" onClick={() => setPage(1)}>
          查询
        </Button>
        <Button onClick={() => setDrawerOpen(true)}>新增凭证</Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Drawer
        title="新增凭证"
        width={960}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        <VoucherEdit
          bookId={bookId}
          onSaved={() => {
            setDrawerOpen(false);
            fetchList();
          }}
        />
      </Drawer>
    </div>
  );
}
