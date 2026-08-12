import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { budgetsApi } from '@/features/finance/api';
import type { Budget } from '@/features/finance/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { STATUS_STYLE, budgetStatus, pace } from '@/lib/status';
import { Card, StatusBadge } from '@/components/ui';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Budgets als Ringe – der äußere Ring ist der Verbrauch, der dünne innere
 * der erwartete Monatsverlauf. Ohne diese zweite Referenz ist ein
 * Prozentwert nicht interpretierbar: 87 % sind am 11. viel, am 28. wenig.
 */
export function BudgetRings() {
  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsApi.getAll().then((r) => r.data),
  });

  const expected = pace();
  const list = (budgets ?? []) as Budget[];
  if (list.length === 0) return null;

  return (
    <Card className="[grid-column:1/-1]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[1rem] font-bold text-ink">
          <Target className="h-4 w-4 text-ink-3" />
          Budgets
        </h3>
        <span className="tnum text-[0.75rem] text-ink-3">
          Am {new Date().getDate()}. des Monats erwartet:{' '}
          <strong className="text-ink-2">{formatPercent(expected)}</strong>
        </span>
      </div>
      <p className="mb-4 max-w-[560px] text-[0.78rem] leading-[1.55] text-ink-3">
        Der äußere Ring ist der Verbrauch, der dünne innere Ring der erwartete Monatsverlauf —
        steht der äußere davor, gibst du schneller aus als geplant.
      </p>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(122px,100%),1fr))]">
        {list.map((budget) => (
          <BudgetRing key={budget.id} budget={budget} expected={expected} />
        ))}
      </div>
    </Card>
  );
}

function BudgetRing({ budget, expected }: { budget: Budget; expected: number }) {
  const status = budgetStatus(budget.percentage);
  const style = STATUS_STYLE[status];
  const shown = Math.min(budget.percentage, 100);
  const cat = budget.category;

  return (
    <Link
      to="/finance/budgets"
      className="flex flex-col items-center gap-2.5 rounded-[15px] bg-soft px-2 py-4 text-center transition-colors hover:bg-sunken"
    >
      <span className="relative grid h-[84px] w-[84px] place-items-center">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke={style.color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(shown / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
          {/* Pace: erwarteter Monatsverlauf als dünner Innenring */}
          <circle
            cx="32"
            cy="32"
            r="20.5"
            fill="none"
            stroke="var(--text-4)"
            strokeWidth="1.5"
            opacity="0.9"
            strokeDasharray={`${(expected / 100) * 2 * Math.PI * 20.5} ${2 * Math.PI * 20.5}`}
          />
        </svg>
        <span
          className="tnum absolute text-[0.8rem] font-extrabold"
          style={{ color: style.color }}
        >
          {budget.percentage}
          <span className="text-[0.6rem]">%</span>
        </span>
      </span>

      <span className="max-w-[110px] truncate text-[0.74rem] font-semibold text-ink">
        {cat?.icon} {cat?.name ?? 'Budget'}
      </span>
      <StatusBadge kind={status} size="sm" />
      <span className="tnum text-[0.68rem] text-ink-3">
        {budget.remaining >= 0
          ? `noch ${formatCurrency(budget.remaining)}`
          : `${formatCurrency(Math.abs(budget.remaining))} drüber`}
      </span>
    </Link>
  );
}
