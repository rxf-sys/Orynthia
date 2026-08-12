import { Link } from 'react-router-dom';
import { CalendarRange, ChefHat, Receipt, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMealFlow } from '@/stores/flowStore';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';

interface Step {
  icon: LucideIcon;
  label: string;
  to: string;
  value: (flow: ReturnType<typeof useMealFlow.getState>) => string;
}

/**
 * „Der Fluss der Woche“ — Rezept → Wochenplan → Einkaufsliste → Ausgabe.
 *
 * Der Fortschritt ist Zustand, kein Text: Schritte bis zum erreichten
 * Punkt sind aktiv, die dahinter grau. Ohne laufende Kette zeigt die Karte
 * denselben Weg als Einladung, ihn zu gehen.
 */
const STEPS: Step[] = [
  { icon: ChefHat, label: 'Rezept', to: '/recipes', value: () => 'aus deiner Sammlung' },
  {
    icon: CalendarRange,
    label: 'Wochenplan',
    to: '/meal-plan',
    value: (f) => (f.meals ? `${f.meals} Mahlzeit${f.meals === 1 ? '' : 'en'} geplant` : 'Mahlzeiten einplanen'),
  },
  {
    icon: ShoppingCart,
    label: 'Einkaufsliste',
    to: '/lists',
    value: (f) =>
      f.step >= 1 && f.added !== undefined
        ? `${f.added} Zutaten übernommen${f.merged ? `, ${f.merged} zusammengeführt` : ''}`
        : 'Zutaten übernehmen',
  },
  {
    icon: Receipt,
    label: 'Ausgabe',
    to: '/finance/transactions',
    value: (f) =>
      f.step >= 2 && f.amount !== undefined
        ? `${formatCurrency(-Math.abs(f.amount))} gebucht`
        : 'Einkauf buchen',
  },
];

export function WeekFlowCard() {
  const flow = useMealFlow();
  // Schritt 0 der Kette ist „Rezept“; erreicht ist alles bis flow.step + 1.
  const reached = flow.step === 0 ? 0 : flow.step + 1;

  return (
    <Card className="flex flex-col">
      <h3 className="text-[1rem] font-bold text-ink">Der Fluss der Woche</h3>
      <p className="mt-1 text-[0.78rem] leading-[1.55] text-ink-3">
        Vom Rezept bis zur gebuchten Ausgabe – jeder Schritt übergibt seine Daten an den nächsten.
      </p>

      <ol className="mt-4 flex flex-col gap-2.5">
        {STEPS.map((step, i) => {
          const active = i <= reached;
          return (
            <li key={step.label}>
              <Link
                to={step.to}
                className={cn(
                  'flex items-center gap-3 rounded-[13px] px-3.5 py-3 transition-colors',
                  active ? 'bg-soft' : 'bg-soft/50',
                )}
              >
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
                  style={{
                    background: active
                      ? 'color-mix(in oklab, var(--violet) 18%, transparent)'
                      : 'transparent',
                    color: active ? 'var(--violet)' : 'var(--text-4)',
                    border: active ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-[0.66rem] font-bold uppercase tracking-[0.08em]',
                      active ? 'text-ink-3' : 'text-ink-4',
                    )}
                  >
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      'block truncate text-[0.8rem] font-medium',
                      active ? 'text-ink' : 'text-ink-4',
                    )}
                  >
                    {step.value(flow)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
