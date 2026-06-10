import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { TrendingDown, TrendingUp, Loader2, CalendarClock, RefreshCw } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card } from './ui/Card';
import { Btn } from './ui/Btn';

const RANGES: { id: number; label: string }[] = [
  { id: 30, label: '30 Tage' },
  { id: 60, label: '60 Tage' },
  { id: 90, label: '90 Tage' },
];

export function ForecastCard() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['forecast', days],
    queryFn: () => dashboardApi.getForecast(days).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[1.05rem] font-bold text-ink flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-indigo" />
            Liquiditätsvorschau
          </div>
          <div className="text-[0.78rem] text-ink-3">
            Schätzung aus laufenden Verträgen, wiederkehrenden Zahlungen und Tages-Median
          </div>
        </div>
        <div className="flex gap-1 rounded-pill border border-line bg-soft p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setDays(r.id)}
              className={
                days === r.id
                  ? 'rounded-pill bg-elev px-3 py-1 text-xs font-semibold text-ink shadow-sm'
                  : 'rounded-pill px-3 py-1 text-xs font-semibold text-ink-3'
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm text-ink-3">Prognose konnte nicht geladen werden</p>
          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => refetch()}>
            Erneut versuchen
          </Btn>
        </div>
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Tile label="Heute" value={data.startBalance} />
            <Tile
              label={`In ${data.horizonDays} Tagen`}
              value={data.endBalance}
              delta={data.endBalance - data.startBalance}
            />
            <Tile label="Tiefstwert" value={data.lowestBalance} dateHint={data.lowestDate} negative={data.lowestBalance < 0} />
            <Tile label="Tagesdurchschnitt" value={data.medianDailySpend} suffix="/Tag" />
          </div>

          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  interval="preserveStartEnd"
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fill: 'var(--ink-3)', fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v / 100) / 10}k`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  formatter={(value: number) => [formatCurrency(value), 'Prognose']}
                />
                <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="projectedBalance"
                  stroke="var(--indigo)"
                  strokeWidth={2}
                  fill="url(#forecastFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {data.lowestBalance < 0 && (
            <p className="mt-3 rounded-md border border-neg/30 bg-soft p-3 text-xs text-ink-2">
              Achtung: Im prognostizierten Zeitraum wird dein Saldo am{' '}
              <strong>{new Date(data.lowestDate).toLocaleDateString('de-DE')}</strong> negativ
              ({formatCurrency(data.lowestBalance)}).
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Tile({
  label,
  value,
  delta,
  suffix,
  dateHint,
  negative,
}: {
  label: string;
  value: number;
  delta?: number;
  suffix?: string;
  dateHint?: string;
  negative?: boolean;
}) {
  const hasDelta = typeof delta === 'number';
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-md border border-line bg-soft px-3 py-2.5">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <div
        className="tnum mt-1 text-[1.2rem] font-bold leading-tight"
        style={{ color: negative ? 'var(--neg)' : undefined }}
      >
        {formatCurrency(value)}
        {suffix && <span className="ml-1 text-xs font-normal text-ink-3">{suffix}</span>}
      </div>
      {hasDelta && (
        <div
          className="tnum mt-0.5 flex items-center gap-1 text-[0.72rem]"
          style={{ color: positive ? 'var(--pos)' : 'var(--neg)' }}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? '+' : ''}
          {formatCurrency(delta!)}
        </div>
      )}
      {dateHint && (
        <div className="mt-0.5 text-[0.7rem] text-ink-3">{new Date(dateHint).toLocaleDateString('de-DE')}</div>
      )}
    </div>
  );
}
