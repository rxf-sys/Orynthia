import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { dashboardApi, transactionsApi } from '@/features/finance/api';
import type { MonthlyOverview } from '@/features/finance/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { FORECAST_BUFFER, STATUS_STYLE, forecastStatus, monthStatus } from '@/lib/status';

/**
 * Hero des Home-Screens: links das Nettovermögen mit Kennzahlen, rechts
 * der Liquiditätsverlauf.
 *
 * Der Chart ist bewusst handgezeichnetes SVG statt Recharts: er zeigt nur
 * eine Linie mit drei Referenzen und lädt so nicht die Chart-Bibliothek
 * auf den Startbildschirm.
 */
export function HeroCard() {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getData().then((r) => r.data),
  });
  const { data: monthly } = useQuery({
    queryKey: ['monthly-overview'],
    queryFn: () => transactionsApi.getMonthlyOverview(2).then((r) => r.data),
  });
  const { data: forecast } = useQuery({
    queryKey: ['forecast', 60],
    queryFn: () => dashboardApi.getForecast(60).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const overview = dashboard?.overview;
  const accountCount = dashboard?.accounts.length ?? 0;
  const giro = dashboard?.accounts.find((a) => a.accountType === 'CHECKING');

  // Veränderung des Monatssaldos gegenüber dem Vormonat – eine echte
  // Aussage aus vorhandenen Daten, statt einer erfundenen Kennzahl.
  const delta = useMemo(() => {
    const months = (monthly ?? []) as MonthlyOverview[];
    if (months.length < 2) return null;
    const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];
    const value = curr.income - curr.expenses - (prev.income - prev.expenses);
    const label = new Date(`${prev.month}-01T00:00:00`).toLocaleDateString('de-DE', {
      month: 'long',
    });
    return { value, label };
  }, [monthly]);

  const riskDays = useMemo(
    () => (forecast?.points ?? []).filter((p) => p.projectedBalance < FORECAST_BUFFER).length,
    [forecast],
  );

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-elev p-5 sm:p-[34px]">
      {/* Lichtschein – rein dekorativ, deshalb ohne Zeigerereignisse */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[70%] -right-[25%] h-[520px] w-[520px]"
        style={{
          background:
            'radial-gradient(circle at center, color-mix(in oklab, var(--violet) 24%, transparent), transparent 64%)',
        }}
      />

      <div className="relative grid items-start gap-8 lg:gap-10 [grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr))]">
        <div className="min-w-0">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-ink-3">
            Nettovermögen über {accountCount} {accountCount === 1 ? 'Konto' : 'Konten'}
          </div>
          <div className="tnum mt-3 text-[2.4rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[3.4rem] lg:text-[4.1rem]">
            {overview ? formatCurrency(overview.totalBalance) : '—'}
          </div>

          {delta && (
            <DeltaPill value={delta.value} vsLabel={delta.label} />
          )}

          <dl className="mt-7 grid gap-5 border-t border-line pt-6 [grid-template-columns:repeat(auto-fit,minmax(min(120px,100%),1fr))]">
            <Kpi label="Girokonto" value={giro ? Number(giro.balance) : null} />
            <Kpi label="Einnahmen" value={overview?.monthlyIncome ?? null} tone="pos" />
            <Kpi label="Ausgaben" value={overview?.monthlyExpenses ?? null} />
            <Kpi
              label="Sparquote"
              value={overview?.savingsRate ?? null}
              format={(v) => formatPercent(v)}
            />
          </dl>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 text-[0.76rem] font-semibold">
            <span className="text-ink-2">Liquidität, 60 Tage</span>
            {riskDays > 0 && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--neg)' }}>
                <AlertCircle className="h-3.5 w-3.5" />
                {riskDays} {riskDays === 1 ? 'Risikotag' : 'Risikotage'}
              </span>
            )}
          </div>
          {forecast ? (
            <ForecastSpark
              points={forecast.points.map((p) => p.projectedBalance)}
              lowest={forecast.lowestBalance}
              lowestDate={forecast.lowestDate}
            />
          ) : (
            <div className="h-[200px] animate-pulse rounded-lg bg-soft" />
          )}
        </div>
      </div>
    </section>
  );
}

function DeltaPill({ value, vsLabel }: { value: number; vsLabel: string }) {
  const style = STATUS_STYLE[monthStatus(value)];
  const Arrow = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className="tnum mt-3 inline-flex items-center gap-[7px] rounded-pill px-3.5 py-[7px] text-[0.82rem] font-bold"
      style={{ background: style.tint, color: style.color }}
    >
      <Arrow className="h-3.5 w-3.5" aria-hidden />
      {value >= 0 ? '+' : ''}
      {formatCurrency(value)} vs. {vsLabel}
    </span>
  );
}

function Kpi({
  label,
  value,
  tone,
  format = formatCurrency,
}: {
  label: string;
  value: number | null;
  tone?: 'pos';
  format?: (v: number) => string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-semibold text-ink-3">{label}</dt>
      <dd
        className="tnum mt-1 truncate text-[1.15rem] font-bold"
        style={tone === 'pos' ? { color: 'var(--pos)' } : undefined}
      >
        {value === null ? '—' : format(value)}
      </dd>
    </div>
  );
}

/**
 * Kompakter Liquiditätsverlauf. Ebenen von hinten nach vorn: Risikoband,
 * Puffergrenze (gestrichelt), Nulllinie (durchgezogen), Fläche, Linie.
 * Die Prognose ist gestrichelt – sie ist gerechnet, nicht gemessen.
 */
function ForecastSpark({
  points,
  lowest,
  lowestDate,
}: {
  points: number[];
  lowest: number;
  lowestDate: string;
}) {
  const W = 640;
  const H = 190;
  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points, FORECAST_BUFFER);
    const min = Math.min(...points, 0);
    const span = max - min || 1;
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => H - ((v - min) / span) * H;
    const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return {
      line,
      area: `${line} L${W},${H} L0,${H} Z`,
      yZero: y(0),
      yBuffer: y(FORECAST_BUFFER),
      lowIndex: points.indexOf(Math.min(...points)),
      x,
      y,
    };
  }, [points]);

  if (!geometry) return <div className="h-[200px] rounded-lg bg-soft" />;
  const status = forecastStatus(lowest);

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[200px] w-full"
        role="img"
        aria-label={`Liquiditätsverlauf über 60 Tage, Tiefstwert ${formatCurrency(lowest)}`}
      >
        <defs>
          <linearGradient id="hero-fc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Risikoband: alles unterhalb der Puffergrenze */}
        <rect
          x="0"
          y={geometry.yBuffer}
          width={W}
          height={Math.max(0, H - geometry.yBuffer)}
          fill="var(--neg)"
          fillOpacity="0.16"
        />
        <line
          x1="0"
          x2={W}
          y1={geometry.yBuffer}
          y2={geometry.yBuffer}
          stroke="var(--warn)"
          strokeDasharray="5 5"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          x2={W}
          y1={geometry.yZero}
          y2={geometry.yZero}
          stroke="var(--neg)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path d={geometry.area} fill="url(#hero-fc)" />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--violet)"
          strokeWidth="2.5"
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.72rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: 'var(--neg)' }} />
          Nulllinie
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4" style={{ borderTop: '2px dashed var(--warn)' }} />
          Puffer {formatCurrency(FORECAST_BUFFER)}
        </span>
      </div>
      <p className="tnum mt-1 text-[0.76rem] text-ink-2">
        Tiefstwert{' '}
        <strong style={{ color: STATUS_STYLE[status].color }}>{formatCurrency(lowest)}</strong> am{' '}
        {new Date(lowestDate).toLocaleDateString('de-DE')}
      </p>
    </>
  );
}
