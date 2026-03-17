import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { Wallet, PiggyBank, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { dashboardApi, transactionsApi } from '@/lib/api';
import { formatCurrency, formatDateRelative, cn } from '@/lib/utils';
import type { MonthlyOverview } from '@/lib/types';

export function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getData().then((r) => r.data),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['monthly-overview'],
    queryFn: () => transactionsApi.getMonthlyOverview(6).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const overview = dashboard?.overview;
  const monthNames: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mär', '04': 'Apr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
  };

  const chartData = monthlyData?.map((m: MonthlyOverview) => ({
    name: monthNames[m.month.split('-')[1]] || m.month,
    Einnahmen: m.income,
    Ausgaben: m.expenses,
  })) || [];

  const COLORS = ['#338dff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-surface-400 mt-1">Dein finanzieller Überblick</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Gesamtsaldo"
          value={formatCurrency(overview?.totalBalance || 0)}
          icon={<Wallet className="h-5 w-5" />}
          color="brand"
        />
        <KpiCard
          title="Einnahmen (Monat)"
          value={formatCurrency(overview?.monthlyIncome || 0)}
          icon={<ArrowUpRight className="h-5 w-5" />}
          color="green"
        />
        <KpiCard
          title="Ausgaben (Monat)"
          value={formatCurrency(overview?.monthlyExpenses || 0)}
          icon={<ArrowDownRight className="h-5 w-5" />}
          color="red"
        />
        <KpiCard
          title="Sparquote"
          value={`${overview?.savingsRate || 0}%`}
          icon={<PiggyBank className="h-5 w-5" />}
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - Monatlicher Verlauf */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">Einnahmen vs. Ausgaben</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="Einnahmen" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Ausgaben nach Kategorie */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Ausgaben nach Kategorie</h3>
          {dashboard?.expensesByCategory?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dashboard.expensesByCategory}
                    dataKey="amount"
                    nameKey="category.name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {dashboard.expensesByCategory.map((entry: { categoryId?: string }, i: number) => (
                      <Cell key={entry.categoryId || i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {dashboard.expensesByCategory.slice(0, 5).map((item: { categoryId?: string; category?: { name?: string; icon?: string }; amount: number }, i: number) => (
                  <div key={item.categoryId || i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-surface-300">{item.category?.icon} {item.category?.name}</span>
                    </div>
                    <span className="text-surface-200 font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-surface-500 text-sm text-center py-8">Keine Daten vorhanden</p>
          )}
        </div>
      </div>

      {/* Recent Transactions & Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">Letzte Transaktionen</h3>
          <div className="space-y-1">
            {dashboard?.recentTransactions?.length > 0 ? (
              dashboard.recentTransactions.map((tx: { id: string; category?: { name?: string; icon?: string }; counterpartName?: string; purpose?: string; amount: number | string; date: string }) => (
                <div key={tx.id} className="flex items-center justify-between py-3 border-b border-surface-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-800 text-lg">
                      {tx.category?.icon || '💳'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-200">
                        {tx.counterpartName || tx.purpose || 'Transaktion'}
                      </p>
                      <p className="text-xs text-surface-500">
                        {tx.category?.name || 'Unkategorisiert'} · {formatDateRelative(tx.date)}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold',
                    Number(tx.amount) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {Number(tx.amount) >= 0 ? '+' : ''}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-surface-500 text-sm text-center py-8">Noch keine Transaktionen</p>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Meine Konten</h3>
          <div className="space-y-3">
            {dashboard?.accounts?.map((acc: { id: string; accountName: string; bankName: string; balance: number | string }) => (
              <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/50">
                <div>
                  <p className="text-sm font-medium text-surface-200">{acc.accountName}</p>
                  <p className="text-xs text-surface-500">{acc.bankName}</p>
                </div>
                <span className="text-sm font-semibold text-surface-100">
                  {formatCurrency(Number(acc.balance))}
                </span>
              </div>
            ))}
            {(!dashboard?.accounts || dashboard.accounts.length === 0) && (
              <p className="text-surface-500 text-sm text-center py-4">Keine Konten verknüpft</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KPI Card Component ---
function KpiCard({ title, value, icon, color }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-500/10 text-brand-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  };

  return (
    <div className="card-hover">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-400">{title}</p>
        <div className={cn('rounded-lg p-2', colorMap[color])}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
