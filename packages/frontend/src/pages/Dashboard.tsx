import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  RefreshCw,
  Plus,
  ArrowUpRight,
  Search as SearchIcon,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { dashboardApi, transactionsApi } from '@/lib/api';
import { formatCurrency, formatDateRelative } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import type { MonthlyOverview, BankAccount, Transaction } from '@/lib/types';
import { Card, Btn, PageHead, Tag, CategoryIcon, CategoryDot, pickCategoryColor } from '@/components/ui';
import { ForecastCard } from '@/components/ForecastCard';

const CHART_COLORS = {
  income: 'var(--pos)',
  expense: 'var(--indigo)',
  grid: 'var(--line)',
  axis: 'var(--text-3)',
  tooltipBg: 'var(--bg-elev)',
  tooltipBorder: 'var(--line)',
};

const CATEGORY_PALETTE = ['#424769', '#ffb17a', '#5b8def', '#1f8a5b', '#b97aff', '#e76b8d', '#3aa3a5', '#d99a2b'];

// Neutrale Farbe für den Sammelposten "Sonstige" im Kategorie-Chart
const OTHER_CATEGORY_COLOR = 'var(--text-4, #aeb3c4)';

const TOP_CATEGORIES_LIMIT = 5;
const RECENT_TX_LIMIT = 6;

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mär',
  '04': 'Apr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Aug',
  '09': 'Sep',
  '10': 'Okt',
  '11': 'Nov',
  '12': 'Dez',
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: dashboard, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getData().then((r) => r.data),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['monthly-overview'],
    queryFn: () => transactionsApi.getMonthlyOverview(6).then((r) => r.data),
  });

  const expensesByCategory = dashboard?.expensesByCategory;

  // Einheitliche Datenbasis für Pie-Chart UND Legende:
  // Top 5 Kategorien + Sammelposten "Sonstige" für den Rest.
  const categoryChartData = useMemo(() => {
    const items = expensesByCategory ?? [];
    const top = items.slice(0, TOP_CATEGORIES_LIMIT).map((item, i) => ({
      key: item.categoryId || String(i),
      name: item.category?.name || 'Unkategorisiert',
      icon: item.category?.icon,
      color: item.category?.color || CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      amount: item.amount,
    }));
    const rest = items.slice(TOP_CATEGORIES_LIMIT);
    if (rest.length > 0) {
      top.push({
        key: 'sonstige',
        name: 'Sonstige',
        icon: undefined,
        color: OTHER_CATEGORY_COLOR,
        amount: rest.reduce((sum, item) => sum + item.amount, 0),
      });
    }
    return top;
  }, [expensesByCategory]);

  // Loader strikt VOR dem Rendern der Kennzahlen halten,
  // damit während des Ladens keine 0-Werte aufblitzen.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm font-semibold text-ink">Dashboard konnte nicht geladen werden</p>
        <Btn variant="ghost" icon={RefreshCw} onClick={() => refetch()}>
          Erneut versuchen
        </Btn>
      </Card>
    );
  }

  const overview = dashboard?.overview;
  const totalBalance = overview?.totalBalance ?? 0;
  const monthlyIncome = overview?.monthlyIncome ?? 0;
  const monthlyExpenses = overview?.monthlyExpenses ?? 0;
  const savingsRate = overview?.savingsRate ?? 0;
  const available = monthlyIncome - monthlyExpenses;

  const chartData =
    monthlyData?.map((m: MonthlyOverview) => ({
      name: MONTH_NAMES[m.month.split('-')[1]] || m.month,
      Einnahmen: m.income,
      Ausgaben: m.expenses,
    })) || [];

  const greeting = user?.firstName ? `Hallo ${user.firstName} 👋` : 'Willkommen 👋';
  const today = new Date();
  const dateLabel = today.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const monthLabel = today.toLocaleDateString('de-DE', { month: 'long' });

  return (
    <div className="space-y-5">
      <PageHead
        title={greeting}
        sub={`Heute ist ${dateLabel} · ${monthLabel}-Übersicht`}
        actions={
          <>
            <Btn variant="ghost" icon={RefreshCw}>
              Synchronisieren
            </Btn>
            <Link to="/transactions">
              <Btn variant="grad" icon={Plus}>
                Transaktion
              </Btn>
            </Link>
          </>
        }
      />

      {/* Hero band */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card variant="hero">
          <div className="relative z-[2]">
            <div className="flex items-center gap-2.5 text-[0.78rem] uppercase tracking-[0.08em] opacity-90">
              <TrendingUp className="h-3.5 w-3.5" /> Nettovermögen
              {totalBalance !== 0 && (
                <span
                  className="ml-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.7rem] font-semibold"
                  style={{ background: 'rgba(255,255,255,.18)' }}
                >
                  <ArrowUpRight className="h-3 w-3" /> Live
                </span>
              )}
            </div>
            <div className="h-display mt-1 text-[3.4rem] leading-[1.05] tnum">
              {formatCurrency(totalBalance)}
            </div>
            <div className="mt-4 flex flex-wrap gap-7">
              <div>
                <div className="text-[0.78rem] opacity-80">Einnahmen {monthLabel}</div>
                <div className="text-[1.15rem] font-bold tnum">{formatCurrency(monthlyIncome)}</div>
              </div>
              <div>
                <div className="text-[0.78rem] opacity-80">Ausgaben {monthLabel}</div>
                <div className="text-[1.15rem] font-bold tnum">{formatCurrency(monthlyExpenses)}</div>
              </div>
              <div>
                <div className="text-[0.78rem] opacity-80">Sparquote</div>
                <div className="text-[1.15rem] font-bold tnum">{savingsRate}%</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card className="flex gap-3.5">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
              style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}
            >
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Verfügbar diesen Monat
              </div>
              <div className="tnum mt-1 text-[1.8rem] font-bold">{formatCurrency(available)}</div>
              <div className="mt-0.5 text-[0.82rem] text-ink-3">
                Einnahmen minus Ausgaben in {monthLabel}
              </div>
            </div>
          </Card>
          <Card className="flex gap-3.5">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
              style={{ background: 'rgba(255,177,122,.2)', color: 'var(--peach-press)' }}
            >
              <SearchIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Sparpotential bei Verträgen
              </div>
              <div className="tnum mt-1 text-[1.8rem] font-bold">—</div>
              <Link
                to="/contracts"
                className="mt-1 inline-block text-[0.82rem] font-semibold text-indigo hover:underline"
              >
                Verträge prüfen →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Cashflow + Categories */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[1.05rem] font-bold text-ink">Cashflow</div>
              <div className="text-[0.85rem] text-ink-3">Letzte 6 Monate · Einnahmen vs. Ausgaben</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: CHART_COLORS.tooltipBg,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: 12,
                  color: 'var(--text)',
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-3)' }} />
              <Bar dataKey="Einnahmen" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ausgaben" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="text-[1.05rem] font-bold text-ink">Ausgaben nach Kategorie</div>
          <div className="mb-3.5 text-[0.85rem] text-ink-3">{monthLabel} {today.getFullYear()}</div>
          {categoryChartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="var(--bg-elev)"
                    strokeWidth={2}
                  >
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: 12,
                      color: 'var(--text)',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {categoryChartData.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <CategoryDot cat={{ color: item.color, name: item.name }} />
                    <span className="flex-1 truncate text-ink-2">
                      {item.icon} {item.name}
                    </span>
                    <span className="tnum font-semibold text-ink">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-ink-3">Keine Daten vorhanden</p>
          )}
        </Card>
      </div>

      {/* Forecast */}
      <ForecastCard />

      {/* Accounts strip */}
      <Card>
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-[1.05rem] font-bold text-ink">Deine Konten</div>
          <Link to="/accounts" className="text-[0.85rem] font-semibold text-indigo hover:underline">
            Alle ansehen →
          </Link>
        </div>
        {(dashboard?.accounts?.length ?? 0) > 0 ? (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
          >
            {dashboard!.accounts.map((acc: BankAccount) => {
              const color = pickCategoryColor(acc.bankName);
              return (
                <div
                  key={acc.id}
                  className="relative overflow-hidden rounded-lg border border-line p-4"
                >
                  <div
                    className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-20"
                    style={{ background: color }}
                  />
                  <div className="mb-3 flex items-center gap-2.5">
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[0.75rem] font-bold text-white"
                      style={{ background: color }}
                    >
                      {acc.bankName[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[0.85rem] font-semibold">{acc.bankName}</div>
                      <div className="text-[0.72rem] text-ink-3">{acc.accountName}</div>
                    </div>
                  </div>
                  <div
                    className="tnum text-[1.4rem] font-bold"
                    style={{ color: Number(acc.balance) < 0 ? 'var(--neg)' : 'var(--text)' }}
                  >
                    {formatCurrency(Number(acc.balance))}
                  </div>
                  {acc.lastSynced && (
                    <div className="mt-0.5 text-[0.72rem] text-ink-3">
                      Sync: {formatDateRelative(acc.lastSynced)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-3">Keine Konten verknüpft</p>
        )}
      </Card>

      {/* Lower row */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        {/* Recent Transactions */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[1.05rem] font-bold text-ink">Letzte Transaktionen</div>
            <Link
              to="/transactions"
              className="text-[0.85rem] font-semibold text-indigo hover:underline"
            >
              Alle →
            </Link>
          </div>
          {(dashboard?.recentTransactions?.length ?? 0) > 0 ? (
            <div>
              {dashboard!.recentTransactions.slice(0, RECENT_TX_LIMIT).map((tx: Transaction) => {
                const amount = Number(tx.amount);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3.5 border-b py-3 last:border-0"
                    style={{ borderColor: 'var(--line-2)' }}
                  >
                    <CategoryIcon cat={tx.category} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.9rem] font-semibold">
                        {tx.counterpartName || tx.purpose || 'Transaktion'}
                      </div>
                      <div className="text-[0.75rem] text-ink-3">
                        {tx.category?.name || 'Unkategorisiert'} · {formatDateRelative(tx.date)}
                      </div>
                    </div>
                    <div
                      className="tnum text-sm font-bold"
                      style={{ color: amount > 0 ? 'var(--pos)' : 'var(--text)' }}
                    >
                      {amount > 0 ? '+' : ''}
                      {formatCurrency(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ink-3">Noch keine Transaktionen</p>
          )}
        </Card>

        {/* Quick stats */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[1.05rem] font-bold text-ink">Diesen Monat</div>
              <div className="text-[0.78rem] text-ink-3">Übersicht {monthLabel}</div>
            </div>
            <Tag variant={savingsRate >= 20 ? 'pos' : savingsRate >= 10 ? 'info' : 'warn'}>
              {savingsRate}% Sparquote
            </Tag>
          </div>
          <div className="space-y-3">
            <StatRow label="Einnahmen" value={monthlyIncome} positive />
            <StatRow label="Ausgaben" value={monthlyExpenses} />
            <StatRow label="Differenz" value={available} positive={available >= 0} bold />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-2">{label}</span>
      <span
        className={`tnum text-sm ${bold ? 'font-bold' : 'font-semibold'}`}
        style={positive ? { color: 'var(--pos)' } : undefined}
      >
        {positive && value > 0 ? '+' : ''}
        {formatCurrency(value)}
      </span>
    </div>
  );
}
