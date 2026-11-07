import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  AuditOutlined,
  BookOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FileTextOutlined,
  FundOutlined,
  HistoryOutlined,
  LogoutOutlined,
  NodeIndexOutlined,
  SettingOutlined,
  SwapOutlined,
  TagsOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useBook } from '../context/BookContext';import { useRole } from '../hooks/useRole';
import BooksEmptyHint from '../components/BooksEmptyHint';
import BookSelect from '../components/BookSelect';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  admin: '系统管理员',
  approver: '审核员',
  poster: '记账员',
  bookkeeper: '制单员',
  accountant: '会计',
  viewer: '查看者',
};

interface RouteMeta {
  group?: string;
  label: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/': { group: '日常核算', label: '仪表盘' },
  '/vouchers': { group: '日常核算', label: '凭证管理' },
  '/assets': { group: '日常核算', label: '固定资产' },
  '/ledgers': { group: '账簿与报表', label: '账簿查询' },
  '/reports': { group: '账簿与报表', label: '财务报表' },
  '/closing': { group: '账簿与报表', label: '期末处理' },
  '/books': { group: '系统设置', label: '账套管理' },
  '/accounts': { group: '系统设置', label: '会计科目' },
  '/initial-balances': { group: '系统设置', label: '期初余额' },
  '/auxiliary': { group: '系统设置', label: '辅助核算' },
  '/cashflow': { group: '系统设置', label: '现金流量项目' },
};

const SETTINGS_KEYS = ['/books', '/accounts', '/initial-balances', '/auxiliary', '/cashflow'];
const SETTINGS_PARENT = 'settings';

/** 最长前缀匹配：/vouchers/12 → /vouchers，避免子路由丢失菜单高亮 */
export function resolveMenuKey(pathname: string): string {
  if (pathname === '/') return '/';
  return (
    Object.keys(ROUTE_META)
      .filter((k) => k !== '/')
      .sort((a, b) => b.length - a.length)
      .find((k) => pathname === k || pathname.startsWith(`${k}/`)) ?? '/'
  );
}

function buildMenuItems(canManageAssets: boolean): MenuProps['items'] {
  return [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    {
      key: 'd',
      type: 'group',
      label: '日常核算',
      children: [
        { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
        ...(canManageAssets
          ? [{ key: '/assets', icon: <WalletOutlined />, label: '固定资产' }]
          : []),
      ],
    },
    {
      key: 'g',
      type: 'group',
      label: '账簿与报表',
      children: [
        { key: '/ledgers', icon: <HistoryOutlined />, label: '账簿查询' },
        { key: '/reports', icon: <FundOutlined />, label: '财务报表' },
        { key: '/closing', icon: <DesktopOutlined />, label: '期末处理' },
      ],
    },
    {
      key: SETTINGS_PARENT,
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        { key: '/books', icon: <BookOutlined />, label: '账套管理' },
        { key: '/accounts', icon: <ApartmentOutlined />, label: '会计科目' },
        { key: '/initial-balances', icon: <AuditOutlined />, label: '期初余额' },
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
  const { books, loading, error, bookId, setBookId, status, reload } = useBook();
  const [switchTarget, setSwitchTarget] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // 路由是菜单状态的唯一事实来源：任何入口跳转到设置页，菜单都会自动展开并高亮
  const menuKey = resolveMenuKey(location.pathname);
  const meta = ROUTE_META[menuKey] ?? ROUTE_META['/'];
  const menuItems = useMemo(() => buildMenuItems(canManageAssets), [canManageAssets]);

  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    SETTINGS_KEYS.includes(menuKey) ? [SETTINGS_PARENT] : [],
  );

  useEffect(() => {
    if (!SETTINGS_KEYS.includes(menuKey)) return;
    setOpenKeys((prev) =>
      prev.includes(SETTINGS_PARENT) ? prev : [...prev, SETTINGS_PARENT],
    );
  }, [menuKey]);

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
        collapsed={collapsed}
        onCollapse={setCollapsed}
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
          {collapsed ? '周' : '周会计记账系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          // 折叠态必须把控制权交还 antd 的悬浮子菜单，否则系统设置点不开
          {...(collapsed
            ? { openKeys: [] as string[] }
            : { openKeys, onOpenChange: (keys: string[]) => setOpenKeys(keys) })}
          items={menuItems}
          onClick={(e) => {
            if (!e.key.startsWith('/')) return;
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
            {status === 'error' ? (
              <Button size="small" danger onClick={reload}>
                账套加载失败，重试
              </Button>
            ) : status === 'empty' ? (
              // 全局状态用中性灰表达，不抢页面自己的主操作
              <Tag color="default" style={{ marginInlineEnd: 0 }}>
                没有可用账套
              </Tag>
            ) : (
              <BookSelect
                books={books}
                size="middle"
                value={status === 'ready' ? bookId : undefined}
                onChange={(v) => {
                  if (v == null || v === bookId) return;
                  // 首次进入（原先没选）直接生效，不弹"切换"确认
                  if (bookId == null) {
                    setBookId(v);
                    return;
                  }
                  setSwitchTarget(v);
                }}
                status={status === 'unselected' || status === 'invalid' ? 'warning' : undefined}
                placeholder={loading ? '账套加载中…' : '请选择账套'}
                disabled={loading}
                style={{ minWidth: 200 }}
              />
            )}
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
          {/* 非阻塞引导条：所有页面都可访问，这里只解释"为什么是空的 + 下一步做什么" */}
          <BooksEmptyHint />
          <Outlet />
        </Content>
      </Layout>

      <Modal
        open={switchTarget != null}
        title="切换账套"
        okText="切换"
        cancelText="取消"
        onOk={() => {
          if (switchTarget != null) setBookId(switchTarget);
          setSwitchTarget(null);
        }}
        onCancel={() => setSwitchTarget(null)}
      >
        确定切换到「{books.find((b) => b.id === switchTarget)?.name ?? ''}」吗？切换后各页面数据都会跟随该账套刷新。
      </Modal>
    </Layout>
  );
}
