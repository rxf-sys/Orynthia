import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { ForgotPasswordPage } from '@/pages/ForgotPassword';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { DashboardPage } from '@/pages/Dashboard';
import { TransactionsPage } from '@/pages/Transactions';
import { BudgetsPage } from '@/pages/Budgets';
import { AccountsPage } from '@/pages/Accounts';
import { RecurringPaymentsPage } from '@/pages/RecurringPayments';
import { SavingsGoalsPage } from '@/pages/SavingsGoals';
import { ContractsPage } from '@/pages/Contracts';
import { SavingsPotentialPage } from '@/pages/SavingsPotential';
import { AssistantPage } from '@/pages/Assistant';
import { InvestmentsPage } from '@/pages/Investments';
import { SettingsPage } from '@/pages/Settings';
import { ConfirmProvider } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo" />
          <p className="text-sm text-ink-3">Laden…</p>
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
  // Touch theme store so it initializes on mount and applies data-theme
  useThemeStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="recurring" element={<RecurringPaymentsPage />} />
          <Route path="savings" element={<SavingsGoalsPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="savings-potential" element={<SavingsPotentialPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}
