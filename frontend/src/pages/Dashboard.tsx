import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import {
  BarChartOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PieChartOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { toArray } from '../lib/format';
import { useBook } from '../context/BookContext';

const { Text } = Typography;

interface DashboardStats {
  accountCount: number;
  voucherCount: number;
  draftCount: number;
}

const EMPTY_STATS: DashboardStats = {
  accountCount: 0,
  voucherCount: 0,
  draftCount: 0,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { bookId, book, books } = useBook();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const next: DashboardStats = { ...EMPTY_STATS };
        const [acct, vou, draft] = await Promise.allSettled([
          api.get('/accounts', { params: { bookId } }),
          api.get('/vouchers', { params: { bookId, page: 1, pageSize: 1 } }),
          api.get('/vouchers', {
            params: { bookId, page: 1, pageSize: 1, status: 'draft' },
          }),
        ]);
        if (acct.status === 'fulfilled') {
          next.accountCount = toArray(acct.value.data).length;
        }
        if (vou.status === 'fulfilled') {
          next.voucherCount = Number(vou.value.data?.total ?? 0) || 0;
        }
        if (draft.status === 'fulfilled') {
          next.draftCount = Number(draft.value.data?.total ?? 0) || 0;
        }
        if (!cancelled) setStats(next);
      } catch {
        if (!cancelled) setError('仪表盘数据加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="仪表盘"
        description={
          book
            ? `当前账套：${book.name}｜符合国内会计制度，支持企业会计准则与小企业会计准则（不含进销存）`
            : '符合国内会计制度，支持企业会计准则与小企业会计准则（功能覆盖记账、查询与财务报表，不含进销存）'
        }
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/vouchers')}
            >
              录入凭证
            </Button>
            <Button icon={<HistoryOutlined />} onClick={() => navigate('/ledgers')}>
              账簿查询
            </Button>
            <Button icon={<PieChartOutlined />} onClick={() => navigate('/reports')}>
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
              value={books.length}
              loading={loading}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="会计科目数（当前账套）"
              value={stats.accountCount}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="凭证数量（当前账套）"
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前账套里已保存、但还没「提交审核」的凭证数
            </Text>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 16 }}>
        <Text type="secondary">
          建议流程：新建账套 → 初始化科目 / 辅助核算 / 现金流量项目 → 录入并审核凭证 → 期末损益结转与结账 →
          查看报表。所有页面共享顶栏的「当前账套」，切换账套后各页数据会自动跟随。
        </Text>
      </Card>
    </div>
  );
}
