import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useBook } from '../context/BookContext';
import { useRole } from '../hooks/useRole';
import { VOUCHER_STATUS, errorMessage } from '../lib/format';
import VoucherEdit from './VoucherEdit';

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

export default function VoucherList() {
  const { books, bookId, setBookId, book, loading: booksLoading } = useBook();
  const requireApproval = book?.requireApproval ?? false;
  const { canApprove, canPost, canVoid } = useRole();

  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const startPeriod = range?.[0]?.format('YYYY-MM');
  const endPeriod = range?.[1]?.format('YYYY-MM');
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchList = useCallback(async () => {
    if (bookId == null) return;
    setLoading(true);
    try {
      const { data } = await api.get('/vouchers', {
        params: {
          bookId,
          period: endPeriod,
          startPeriod,
          status,
          keyword: keyword || undefined,
          page,
          pageSize,
        },
      });
      setData(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      message.error(errorMessage(e, '加载凭证失败'));
    } finally {
      setLoading(false);
    }
  }, [bookId, startPeriod, endPeriod, status, keyword, page, pageSize]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const runQuery = async () => {
    setQuerying(true);
    setPage(1);
    try {
      await fetchList();
    } finally {
      setQuerying(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      void fetchList();
    } catch (e) {
      message.error(errorMessage(e, '操作失败'));
    }
  };

  const statusOptions = useMemo(
    () =>
      Object.entries(VOUCHER_STATUS).map(([value, m]) => ({
        value,
        label: m.text,
      })),
    [],
  );

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
        const m = VOUCHER_STATUS[s] ?? { text: s, color: 'default' };
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
      width: 250,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'draft' &&
            (requireApproval ? (
              <Tooltip title="提交后进入审核环节，草稿将不可直接修改">
                <Button
                  size="small"
                  onClick={() =>
                    void run(() => api.post(`/vouchers/${r.id}/submit`), '已提交')
                  }
                >
                  提交
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="单人模式：草稿可直接记账入账">
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    void run(() => api.post(`/vouchers/${r.id}/post`), '已记账')
                  }
                >
                  记账
                </Button>
              </Tooltip>
            ))}
          {r.status === 'submitted' && canApprove && (
            <Tooltip title="审核人不能与制单人相同">
              <Button
                size="small"
                type="primary"
                onClick={() => void run(() => api.post(`/vouchers/${r.id}/approve`), '已审核')}
              >
                审核
              </Button>
            </Tooltip>
          )}
          {r.status === 'approved' && canPost && (
            <Button
              size="small"
              type="primary"
              onClick={() => void run(() => api.post(`/vouchers/${r.id}/post`), '已记账')}
            >
              记账
            </Button>
          )}
          {r.status === 'posted' && canPost && (
            <Popconfirm
              title="确认红字冲销该凭证？"
              description="系统会生成一张反方向的冲销凭证，原凭证保留。"
              okText="确认冲销"
              cancelText="取消"
              onConfirm={() => void run(() => api.post(`/vouchers/${r.id}/reverse`), '已冲销')}
            >
              <Button size="small" danger>
                冲销
              </Button>
            </Popconfirm>
          )}
          {r.status !== 'posted' && r.status !== 'voided' && canVoid && (
            <Popconfirm
              title="确认作废该凭证？"
              description="作废后凭证号仍占用，不可恢复。"
              okText="确认作废"
              cancelText="取消"
              onConfirm={() => void run(() => api.delete(`/vouchers/${r.id}`), '已作废')}
            >
              <Button size="small" danger>
                作废
              </Button>
            </Popconfirm>
          )}
          <Button
            size="small"
            onClick={() => window.open(`/print/voucher/${r.id}`, '_blank')}
          >
            打印
          </Button>
        </Space>
      ),
    },
  ];

  const hasFilter = !!range || !!status || !!keyword;

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="凭证管理"
        description="按账套与期间检索凭证；审核/记账按钮依据当前角色显示，避免无效点击。"
        extra={
          <Space wrap>
            <Button
              disabled={!selectedIds.length}
              onClick={() =>
                window.open(`/print/vouchers?ids=${selectedIds.join(',')}`, '_blank')
              }
            >
              批量打印{selectedIds.length ? `（${selectedIds.length}）` : ''}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              新增凭证
            </Button>
          </Space>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <DatePicker.RangePicker
            picker="month"
            value={range}
            onChange={(v) =>
              setRange(v && v[0] && v[1] ? [v[0], v[1]] : null)
            }
            placeholder={['起始月', '结束月']}
            style={{ width: 240 }}
          />
          <Select
            allowClear
            placeholder="状态（全部）"
            style={{ width: 140 }}
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <Input
            allowClear
            placeholder="摘要 / 凭证号"
            style={{ width: 180 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => void runQuery()}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={querying}
            onClick={() => void runQuery()}
          >
            查询
          </Button>
          <Button
            icon={<ReloadOutlined />}
            disabled={!hasFilter}
            onClick={() => {
              setRange(null);
              setStatus(undefined);
              setKeyword('');
              setPage(1);
            }}
          >
            重置筛选
          </Button>
        </Space>
      </Card>

      <Table
        size="small"
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        loading={loading}
        columns={columns}
        dataSource={data}
        scroll={{ x: 1200 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                hasFilter
                  ? '当前筛选条件下没有凭证，试试放宽期间或清空关键词'
                  : '本期还没有凭证，点击右上角开始录入第一张凭证'
              }
            />
          ),
        }}
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
        width={1080}
        open={drawerOpen}
        onClose={() => {
          if (dirty) {
            Modal.confirm({
              title: '凭证内容尚未保存',
              content: '关闭后本次录入的内容将丢失，确认关闭？',
              okText: '放弃并关闭',
              okButtonProps: { danger: true },
              cancelText: '继续录入',
              // Drawer 与 Modal 默认同为 1000，这里抬高避免确认框被抽屉盖住
              zIndex: 1100,
              onOk: () => {
                setDirty(false);
                setDrawerOpen(false);
              },
            });
            return;
          }
          setDrawerOpen(false);
        }}
        destroyOnHidden
        styles={{ body: { paddingTop: 8 } }}
      >
        <VoucherEdit
          bookId={bookId}
          onDirtyChange={setDirty}
          onSaved={() => {
            setDirty(false);
            setDrawerOpen(false);
            void fetchList();
          }}
        />
      </Drawer>
    </div>
  );
}
