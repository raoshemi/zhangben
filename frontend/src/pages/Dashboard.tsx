import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import {
  BarChartOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PieChartOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { toArray } from '../lib/format';

const { Text } = Typography;

interface DashboardStats {
  bookCount: number;
  accountCount: number;
  voucherCount: number;
  draftCount: number;
  bookName?: string;
}

const EMPTY_STATS: DashboardStats = {
  bookCount: 0,
  accountCount: 0,
  voucherCount: 0,
  draftCount: 0,
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const booksRes = await api.get('/books');
        const books = toArray(booksRes.data) as { id: number; name: string }[];
        if (cancelled) return;
        const next: DashboardStats = { ...EMPTY_STATS, bookCount: books.length };
        const first = books[0];
        if (first) {
          next.bookName = first.name;
          const [acct, vou, draft] = await Promise.allSettled([
            api.get('/accounts', { params: { bookId: first.id } }),
            api.get('/vouchers', { params: { bookId: first.id, page: 1, pageSize: 1 } }),
            api.get('/vouchers', {
              params: { bookId: first.id, page: 1, pageSize: 1, status: 'draft' },
            }),
          ]);
          if (acct.status === 'fulfilled') {
            next.accountCount = toArray(acct.value.data).length;
          }
          // 凭证数量取分页 total：避免为了数数把全部凭证拉回来
          if (vou.status === 'fulfilled') {
            next.voucherCount = Number(vou.value.data?.total ?? 0) || 0;
          }
          if (draft.status === 'fulfilled') {
            next.draftCount = Number(draft.value.data?.total ?? 0) || 0;
          }
        }
        if (!cancelled) setStats(next);
      } catch (e) {
        if (!cancelled) setError('仪表盘数据加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="仪表盘"
        description={
          stats.bookName
            ? `当前主要账套：${stats.bookName}｜符合国内会计制度，支持企业会计准则与小企业会计准则（不含进销存）`
            : '符合国内会计制度，支持企业会计准则与小企业会计准则（功能覆盖记账、查询与财务报表，不含进销存）'
        }
        extra={
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} href="/vouchers">
              录入凭证
            </Button>
            <Button icon={<HistoryOutlined />} href="/ledgers">
              账簿查询
            </Button>
            <Button icon={<PieChartOutlined />} href="/reports">
              财务报表
            </Button>
          </Space>
        }
      />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="账套数量"
              value={stats.bookCount}
              loading={loading}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="会计科目数（默认账套）"
              value={stats.accountCount}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="凭证数量"
              value={stats.voucherCount}
              loading={loading}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待提交草稿"
              value={stats.draftCount}
              loading={loading}
              valueStyle={stats.draftCount > 0 ? { color: '#fa8c16' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <Text type="secondary">
          建议流程：新建账套 → 初始化科目 / 辅助核算 / 现金流量项目 → 录入并审核凭证 → 期末损益结转与结账 →
          查看报表。所有列表页都遵循「账套 + 期间」的查询口径，切换条件后点击查询即可刷新。
        </Text>
      </Card>
    </div>
  );
}
