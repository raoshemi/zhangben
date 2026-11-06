import { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';
import {
  Breadcrumb,
  Button,
  Dropdown,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FileTextOutlined,
  GoldOutlined,
  HistoryOutlined,
  LogoutOutlined,
  PieChartOutlined,
  SettingOutlined,
  SwapOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRole } from '../hooks/useRole';
import { useBook } from '../context/BookContext';
import { STANDARD_LABEL } from '../lib/format';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface RouteMeta {
  /** 所属分组，用于面包屑与菜单定位 */
  group: string;
  label: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/': { group: '工作台', label: '仪表盘' },
  '/vouchers': { group: '日常核算', label: '凭证管理' },
  '/assets': { group: '日常核算', label: '固定资产' },
  '/ledgers': { group: '账簿与报表', label: '账簿查询' },
  '/reports': { group: '账簿与报表', label: '财务报表' },
  '/closing': { group: '期末', label: '期末处理' },
  '/books': { group: '系统设置', label: '账套管理' },
  '/accounts': { group: '系统设置', label: '会计科目' },
  '/auxiliary': { group: '系统设置', label: '辅助核算' },
  '/cashflow': { group: '系统设置', label: '现金流量项目' },
};

const ROLE_LABEL: Record<string, string> = {
  admin: '系统管理员',
  approver: '审核员',
  poster: '记账员',
  accountant: '会计',
  viewer: '只读用户',
};

const SETTINGS_KEYS = ['/books', '/accounts', '/auxiliary', '/cashflow'];

/**
 * 菜单分组原则（业务流 → 账簿 → 期末 → 配置）：
 * 1) 高频业务（凭证、固定资产）放最上，减少向下找菜单的点击距离；
 * 2) 查询类（账簿、报表）成组，因为它们共享「账套 + 期间」查询范式；
 * 3) 账套 / 科目 / 辅助核算 / 现金流量项目都是「全局一次性配置」，
 *    统一收进「系统设置」子菜单，不再混在业务流中。
 */
function buildMenuItems(canManageAssets: boolean): MenuProps['items'] {
  return [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    {
      type: 'group',
      label: '日常核算',
      children: [
        { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
        ...(canManageAssets
          ? [{ key: '/assets', icon: <GoldOutlined />, label: '固定资产' }]
          : []),
      ],
    },
    {
      type: 'group',
      label: '账簿与报表',
      children: [
        { key: '/ledgers', icon: <HistoryOutlined />, label: '账簿查询' },
        { key: '/reports', icon: <PieChartOutlined />, label: '财务报表' },
      ],
    },
    {
      type: 'group',
      label: '期末',
      children: [{ key: '/closing', icon: <DesktopOutlined />, label: '期末处理' }],
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        { key: '/books', icon: <BookOutlined />, label: '账套管理' },
        { key: '/accounts', icon: <ApartmentOutlined />, label: '会计科目' },
        { key: '/auxiliary', icon: <TagsOutlined />, label: '辅助核算' },
        { key: '/cashflow', icon: <SwapOutlined />, label: '现金流量项目' },
      ],
    },
  ];
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canManageAssets, role } = useRole();
  const username = localStorage.getItem('username') ?? '用户';
  const { books, loading, bookId, setBookId, ready } = useBook();
  const [pending, setPending] = useState<number | undefined>();
  // 未选中有效账套时强制选择（含账套列表为空时引导去创建）
  const needPick = !loading && !ready;

  const selectedKey = location.pathname === '/' ? '/' : location.pathname;
  const meta = ROUTE_META[selectedKey] ?? ROUTE_META['/'];
  const menuItems = useMemo(() => buildMenuItems(canManageAssets), [canManageAssets]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        width={216}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <div
          style={{
            color: '#fff',
            padding: '18px 16px',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 1,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          账本记账系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={SETTINGS_KEYS.includes(selectedKey) ? ['settings'] : []}
          items={menuItems}
          onClick={(e) => {
            if (e.key === 'settings') return;
            navigate(e.key);
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            paddingInline: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Breadcrumb
            items={[
              { title: <Link to="/">首页</Link> },
              ...(meta.group && meta.group !== meta.label
                ? [{ title: meta.group }]
                : []),
              { title: meta.label },
            ]}
          />
          <Space size={12}>
            <Select
              size="small"
              value={bookId}
              onChange={setBookId}
              options={books.map((b) => ({ value: b.id, label: b.name }))}
              style={{ minWidth: 170 }}
              placeholder="选择账套"
              loading={loading}
              disabled={books.length === 0}
            />
            {role ? (
              <Tag color={role === 'admin' ? 'gold' : 'default'} style={{ marginInlineEnd: 0 }}>
                {ROLE_LABEL[role] ?? role}
              </Tag>
            ) : null}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                <Text>{username}</Text>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>

      <Modal
        open={needPick}
        title="请选择账套"
        closable={false}
        maskClosable={false}
        keyboard={false}
        okText="进入账套"
        cancelButtonProps={{ style: { display: 'none' } }}
        okButtonProps={{ disabled: pending == null }}
        onOk={() => {
          if (pending != null) setBookId(pending);
        }}
      >
        {books.length === 0 ? (
          <>
            <p>尚未创建账套，请先到「系统设置 → 账套管理」创建。</p>
            <Button type="primary" onClick={() => navigate('/books')}>
              去创建账套
            </Button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: 12 }}>
              记账是按账套连续的业务，先选择本次要操作的账套，避免串账。
            </p>
            <Select
              style={{ width: '100%' }}
              placeholder="选择账套"
              value={pending}
              onChange={setPending}
              options={books.map((b) => ({
                value: b.id,
                label: `${b.name}（${STANDARD_LABEL[b.accountingStandard] ?? b.accountingStandard}）`,
              }))}
            />
          </>
        )}
      </Modal>
    </Layout>
  );
}
