import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '../api/client';
import BookSelect from '../components/BookSelect';
import BooksEmptyHint from '../components/BooksEmptyHint';
import PageHeader from '../components/PageHeader';
import { useBooks } from '../hooks/useBooks';
import { useRole } from '../hooks/useRole';
import { errorMessage } from '../lib/format';

const { Text } = Typography;

interface PeriodRow {
  bookId: number;
  period: string;
  status: 'open' | 'closed';
  isYearEnd: boolean;
  closedAt: string | null;
}

const ACTION_LABEL: Record<'profit-transfer' | 'close' | 'reopen', string> = {
  'profit-transfer': '损益结转',
  close: '结账',
  reopen: '反结账',
};

export default function Closing() {
  const { books, loading: booksLoading } = useBooks();
  const { isReadOnly, canRunClosing } = useRole();

  const [bookId, setBookId] = useState<number>();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [acting, setActing] = useState<string>();

  useEffect(() => {
    if (bookId == null && books.length) setBookId(books[0].id);
  }, [books, bookId]);

  const loadPeriods = useCallback(async () => {
    if (bookId == null) return;
    setLoading(true);
    setError(undefined);
    try {
      const r = await api.get<{ rows: PeriodRow[] }>('/closing/periods', {
        params: { bookId },
      });
      setPeriods(r.data.rows ?? []);
    } catch (e) {
      setError(errorMessage(e, '加载期间失败'));
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const act = async (
    period: string,
    endpoint: 'profit-transfer' | 'close' | 'reopen',
  ) => {
    setActing(period);
    setError(undefined);
    try {
      await api.post(`/closing/${endpoint}`, null, { params: { bookId, period } });
      message.success(`${ACTION_LABEL[endpoint]}成功`);
      await loadPeriods();
    } catch (e) {
      message.error(errorMessage(e, `${ACTION_LABEL[endpoint]}失败`));
    } finally {
      setActing(undefined);
    }
  };

  const columns: ColumnsType<PeriodRow> = [
    { title: '会计期间', dataIndex: 'period', width: 130 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) =>
        v === 'closed' ? <Tag color="red">已结账</Tag> : <Tag color="green">未结账</Tag>,
    },
    {
      title: '年结',
      dataIndex: 'isYearEnd',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="gold">是</Tag> : '否'),
    },
    {
      title: '结账时间',
      dataIndex: 'closedAt',
      width: 200,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString('zh-CN') : <Text type="secondary">—</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_, row) => {
        const closed = row.status === 'closed';
        return (
          <Space wrap size={4}>
            <Tooltip title={closed ? '该期间已结账，需先反结账' : '将损益类科目余额转入本年利润'}>
              <Button
                size="small"
                disabled={closed || !canRunClosing}
                loading={acting === row.period}
                onClick={() => void act(row.period, 'profit-transfer')}
              >
                损益结转
              </Button>
            </Tooltip>
            <Popconfirm
              title="确认结账？"
              description="结账前请确认已损益结转且试算平衡；结账后该期间禁止新增/修改凭证。"
              okText="确认结账"
              cancelText="取消"
              onConfirm={() => void act(row.period, 'close')}
              disabled={closed || !canRunClosing}
            >
              <Tooltip title={!canRunClosing ? '仅系统管理员可执行结账' : undefined}>
                <Button
                  size="small"
                  type="primary"
                  disabled={closed || !canRunClosing}
                  loading={acting === row.period}
                >
                  结账
                </Button>
              </Tooltip>
            </Popconfirm>
            <Popconfirm
              title="确认反结账？"
              description="仅当后续期间未结账时才允许反结账，反结账后可继续录凭证。"
              okText="确认反结账"
              cancelText="取消"
              onConfirm={() => void act(row.period, 'reopen')}
              disabled={!closed || !canRunClosing}
            >
              <Button
                size="small"
                danger
                disabled={!closed || !canRunClosing}
                loading={acting === row.period}
              >
                反结账
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="期末处理"
        description="按月推进：损益结转 → 结账（校验已结转 + 试算平衡）→ 锁定期间，反结账仅在后续无已结账期间时可用"
        extra={
          <Space>
            <BookSelect
              books={books}
              value={bookId}
              onChange={setBookId}
              loading={booksLoading}
              style={{ width: 240 }}
            />
          </Space>
        }
      />

      <BooksEmptyHint books={books} loading={booksLoading} />

      {isReadOnly && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前角色可查看期末状态，但损益结转/结账/反结账需系统管理员执行"
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={error}
          action={
            <Button size="small" onClick={() => void loadPeriods()}>
              重试
            </Button>
          }
        />
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="期末流程"
        description="损益结转 → 结账（校验损益已结转 + 试算平衡）→ 锁定期间；反结账仅当后续无已结账期间。每一步都可在下表按期间执行。"
      />

      <Card size="small">
        <Table
          rowKey="period"
          columns={columns}
          dataSource={periods}
          loading={loading}
          pagination={false}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无期间数据（期间随账套创建自动生成）"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
