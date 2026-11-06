import { ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Result, Typography } from 'antd';
import MainLayout from './layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import Accounts from './pages/Accounts';
import Auxiliary from './pages/Auxiliary';
import CashFlow from './pages/CashFlow';
import VoucherList from './pages/VoucherList';
import Ledgers from './pages/Ledgers';
import Closing from './pages/Closing';
import Reports from './pages/Reports';
import Assets from './pages/Assets';
import VoucherPrint from './pages/VoucherPrint';
import ReportPrint from './pages/ReportPrint';
import { useRole } from './hooks/useRole';
import { BookProvider } from './context/BookContext';

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/**
 * 前端能力守卫：与后端 @Roles 对齐，避免用户点进必然 403 的页面。
 * 角色未知（例如旧缓存 / 自动化环境）时不拦截，交给后端兜底。
 */
function RequireAdmin({ children }: { children: ReactElement }) {
  const { role } = useRole();
  if (role != null && role !== 'admin') {
    return (
      <Result
        status="403"
        title="无访问权限"
        subTitle={
          <Typography.Text type="secondary">
            固定资产模块仅对系统管理员开放，当前角色为「{role}」。如需使用请联系管理员调整权限。
          </Typography.Text>
        }
      />
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/print/voucher/:id" element={<VoucherPrint />} />
      <Route path="/print/report" element={<ReportPrint />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <BookProvider>
              <MainLayout />
            </BookProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="books" element={<Books />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="auxiliary" element={<Auxiliary />} />
        <Route path="cashflow" element={<CashFlow />} />
        <Route path="vouchers" element={<VoucherList />} />
        <Route path="ledgers" element={<Ledgers />} />
        <Route path="closing" element={<Closing />} />
        <Route path="reports" element={<Reports />} />
        <Route
          path="assets"
          element={
            <RequireAdmin>
              <Assets />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
