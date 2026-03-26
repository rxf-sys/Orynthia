import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { DashboardPage } from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { BudgetsPage } from '@/pages/Budgets';
import { AccountsPage } from '@/pages/Accounts';
import { RecurringPaymentsPage } from '@/pages/RecurringPayments';
import { SavingsGoalsPage } from '@/pages/SavingsGoals';
import { ContractsPage } from '@/pages/Contracts';
import { ReportsPage } from '@/pages/Reports';
import { NetWorthPage } from '@/pages/NetWorth';
import { CashflowPage } from '@/pages/Cashflow';
import { PortfolioPage } from '@/pages/Portfolio';
import { SharedExpensesPage } from '@/pages/SharedExpenses';
import { ImportPage } from '@/pages/Import';
import { SettingsPage } from '@/pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-surface-400 text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="recurring" element={<RecurringPaymentsPage />} />
        <Route path="savings" element={<SavingsGoalsPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="net-worth" element={<NetWorthPage />} />
        <Route path="cashflow" element={<CashflowPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="shared" element={<SharedExpensesPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
