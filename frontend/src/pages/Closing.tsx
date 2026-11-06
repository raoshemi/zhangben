import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import api from '../api/client';

const { Title, Text } = Typography;

interface Book {
  id: number;
  name: string;
  accountingStandard: string;
}

interface PeriodRow {
  bookId: number;
  period: string;
  status: 'open' | 'closed';
  isYearEnd: boolean;
  closedAt: string | null;
}

export default function Closing() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<number>();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [acting, setActing] = useState<string>();

  useEffect(() => {
    api
      .get<{ rows: Book[] }>('/ledgers/books')
      .then((r) => {
        setBooks(r.data.rows);
        if (r.data.rows.length && bookId == null) setBookId(r.data.rows[0].id);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const loadPeriods = useCallback(async () => {
    if (bookId == null) return;
    setLoading(true);
    setError(undefined);
    try {
      const r = await api.get<{ rows: PeriodRow[] }>('/closing/periods', {
        params: { bookId },
      });
      setPeriods(r.data.rows ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? '加载期间失败');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const act = async (
    period: string,
    endpoint: 'profit-transfer' | 'close' | 'reopen',
  ) => {
    setActing(period);
    setError(undefined);
    try {
      const r = await api.post(`/closing/${endpoint}`, null, {
        params: { bookId, period },
      });
      message.success(`${endpoint} 成功`);
      void r;
      await loadPeriods();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? e?.message ?? '操作失败');
    } finally {
      setActing(undefined);
    }
  };

  const columns: ColumnsType<PeriodRow> = [
    { title: '会计期间', dataIndex: 'period', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) =>
        v === 'closed' ? <Tag color="red">已结账</Tag> : <Tag color="green">未结账</Tag>,
    },
    {
      title: '年结',
      dataIndex: 'isYearEnd',
      width: 80,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '结账时间',
      dataIndex: 'closedAt',
      width: 200,
      render: (v: string | null) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            disabled={row.status === 'closed'}
            loading={acting === row.period}
            onClick={() => act(row.period, 'profit-transfer')}
          >
            损益结转
          </Button>
          <Popconfirm
            title="确认结账？"
            description="结账前请确认已损益结转且试算平衡。"
            onConfirm={() => act(row.period, 'close')}
            disabled={row.status === 'closed'}
          >
            <Button
              size="small"
              type="primary"
              disabled={row.status === 'closed'}
              loading={acting === row.period}
            >
              结账
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认反结账？"
            description="仅当后续无已结账期间才允许。"
            onConfirm={() => act(row.period, 'reopen')}
            disabled={row.status !== 'closed'}
          >
            <Button
              size="small"
              danger
              disabled={row.status !== 'closed'}
              loading={acting === row.period}
            >
              反结账
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ margin: 24 }}>
      <Title level={4}>期末处理</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <span>账套：</span>
        <Select
          style={{ width: 200 }}
          placeholder="选择账套"
          value={bookId}
          onChange={(v) => setBookId(v)}
          options={books.map((b) => ({ value: b.id, label: b.name }))}
        />
      </Space>

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />
      )}

      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        期末流程：损益结转 → 结账（校验损益已结转 + 试算平衡）→ 锁定期间；反结账仅当后续无已结账期间。
      </Text>

      <Table
        rowKey="period"
        columns={columns}
        dataSource={periods}
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无期间数据（请先在账套中建立会计期间）' }}
      />
    </Card>
  );
}
