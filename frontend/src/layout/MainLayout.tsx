import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  ApartmentOutlined,
  TagsOutlined,
  SwapOutlined,
  FileTextOutlined,
  HistoryOutlined,
  DesktopOutlined,
  PieChartOutlined,
  GoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/books', icon: <BookOutlined />, label: '账套管理' },
  { key: '/accounts', icon: <ApartmentOutlined />, label: '会计科目' },
  { key: '/auxiliary', icon: <TagsOutlined />, label: '辅助核算' },
  { key: '/cashflow', icon: <SwapOutlined />, label: '现金流量' },
  { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
  { key: '/ledgers', icon: <HistoryOutlined />, label: '账簿查询' },
  { key: '/closing', icon: <DesktopOutlined />, label: '期末处理' },
  { key: '/reports', icon: <PieChartOutlined />, label: '财务报表' },
  { key: '/assets', icon: <GoldOutlined />, label: '固定资产' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username') ?? '用户';
  const selectedKey = location.pathname === '/' ? '/' : location.pathname;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div
          style={{
            color: '#fff',
            padding: 16,
            fontSize: 16,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          账本记账系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            paddingInline: 16,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Space>
            <Typography.Text>{username}</Typography.Text>
            <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
              退出
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
