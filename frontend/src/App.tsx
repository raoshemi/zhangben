import { ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
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
            <MainLayout />
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
        <Route path="assets" element={<Assets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
