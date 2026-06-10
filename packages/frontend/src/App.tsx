import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Layout } from '@/components/Layout';
import { ConfirmProvider } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Route-basiertes Code-Splitting: jede Seite ist ein eigener Chunk, damit der
// initiale Download klein bleibt (insb. Recharts lädt nur, wo Charts sind).
const LoginPage = lazy(() => import('@/pages/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/Register').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() => import('@/pages/Transactions').then((m) => ({ default: m.TransactionsPage })));
const BudgetsPage = lazy(() => import('@/pages/Budgets').then((m) => ({ default: m.BudgetsPage })));
const AccountsPage = lazy(() => import('@/pages/Accounts').then((m) => ({ default: m.AccountsPage })));
const RecurringPaymentsPage = lazy(() => import('@/pages/RecurringPayments').then((m) => ({ default: m.RecurringPaymentsPage })));
const SavingsGoalsPage = lazy(() => import('@/pages/SavingsGoals').then((m) => ({ default: m.SavingsGoalsPage })));
const ContractsPage = lazy(() => import('@/pages/Contracts').then((m) => ({ default: m.ContractsPage })));
const SavingsPotentialPage = lazy(() => import('@/pages/SavingsPotential').then((m) => ({ default: m.SavingsPotentialPage })));
const AssistantPage = lazy(() => import('@/pages/Assistant').then((m) => ({ default: m.AssistantPage })));
const InvestmentsPage = lazy(() => import('@/pages/Investments').then((m) => ({ default: m.InvestmentsPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));

function FullscreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        <p className="text-sm text-ink-3">Laden…</p>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <p className="text-6xl font-extrabold text-ink-4">404</p>
      <h1 className="text-xl font-bold text-ink">Diese Seite gibt es nicht</h1>
      <p className="max-w-sm text-sm text-ink-3">
        Der Link ist veraltet oder die Adresse wurde falsch eingegeben.
      </p>
      <Link
        to="/"
        className="rounded-md bg-grad-brand px-4 py-2 text-sm font-semibold text-white"
        style={{ boxShadow: 'var(--shadow-btn)' }}
      >
        Zum Dashboard
      </Link>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <FullscreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <FullscreenLoader />;
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
        <Suspense fallback={<FullscreenLoader />}>
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

            {/* Fallback: echte 404 statt stillem Redirect */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}
