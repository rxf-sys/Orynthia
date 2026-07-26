import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Layout } from '@/components/Layout';
import { ConfirmProvider } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Route-basiertes Code-Splitting: jede Seite ist ein eigener Chunk, damit der
// initiale Download klein bleibt (insb. Recharts lädt nur, wo Charts sind).
const LoginPage = lazy(() => import('@/features/auth/pages/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/pages/Register').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import('@/features/finance/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() => import('@/features/finance/pages/Transactions').then((m) => ({ default: m.TransactionsPage })));
const BudgetsPage = lazy(() => import('@/features/finance/pages/Budgets').then((m) => ({ default: m.BudgetsPage })));
const AccountsPage = lazy(() => import('@/features/finance/pages/Accounts').then((m) => ({ default: m.AccountsPage })));
const RecurringPaymentsPage = lazy(() => import('@/features/finance/pages/RecurringPayments').then((m) => ({ default: m.RecurringPaymentsPage })));
const SavingsGoalsPage = lazy(() => import('@/features/finance/pages/SavingsGoals').then((m) => ({ default: m.SavingsGoalsPage })));
const ContractsPage = lazy(() => import('@/features/finance/pages/Contracts').then((m) => ({ default: m.ContractsPage })));
const SavingsPotentialPage = lazy(() => import('@/features/finance/pages/SavingsPotential').then((m) => ({ default: m.SavingsPotentialPage })));
const AssistantPage = lazy(() => import('@/features/assistant/pages/Assistant').then((m) => ({ default: m.AssistantPage })));
const InvestmentsPage = lazy(() => import('@/features/finance/pages/Investments').then((m) => ({ default: m.InvestmentsPage })));
const SettingsPage = lazy(() => import('@/features/settings/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const HomePage = lazy(() => import('@/features/home/pages/Home').then((m) => ({ default: m.HomePage })));
const TasksPage = lazy(() => import('@/features/tasks/pages/Tasks').then((m) => ({ default: m.TasksPage })));
const CalendarPage = lazy(() => import('@/features/calendar/pages/Calendar').then((m) => ({ default: m.CalendarPage })));

// Alte Finanz-Routen leben als Redirects weiter – inklusive Query-String,
// damit z. B. der Enable-Banking-Callback (/accounts?code=…) weiter ankommt.
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

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
              <Route index element={<HomePage />} />

              {/* Modul: Finanzen */}
              <Route path="finance" element={<DashboardPage />} />
              <Route path="finance/transactions" element={<TransactionsPage />} />
              <Route path="finance/budgets" element={<BudgetsPage />} />
              <Route path="finance/accounts" element={<AccountsPage />} />
              <Route path="finance/recurring" element={<RecurringPaymentsPage />} />
              <Route path="finance/savings" element={<SavingsGoalsPage />} />
              <Route path="finance/contracts" element={<ContractsPage />} />
              <Route path="finance/savings-potential" element={<SavingsPotentialPage />} />
              <Route path="finance/investments" element={<InvestmentsPage />} />

              {/* Module: Kalender & Aufgaben */}
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="tasks" element={<TasksPage />} />

              <Route path="assistant" element={<AssistantPage />} />
              <Route path="settings" element={<SettingsPage />} />

              {/* Redirects der alten Finanz-Routen */}
              <Route path="transactions" element={<LegacyRedirect to="/finance/transactions" />} />
              <Route path="budgets" element={<LegacyRedirect to="/finance/budgets" />} />
              <Route path="accounts" element={<LegacyRedirect to="/finance/accounts" />} />
              <Route path="recurring" element={<LegacyRedirect to="/finance/recurring" />} />
              <Route path="savings" element={<LegacyRedirect to="/finance/savings" />} />
              <Route path="contracts" element={<LegacyRedirect to="/finance/contracts" />} />
              <Route path="savings-potential" element={<LegacyRedirect to="/finance/savings-potential" />} />
              <Route path="investments" element={<LegacyRedirect to="/finance/investments" />} />
            </Route>

            {/* Fallback: echte 404 statt stillem Redirect */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}
