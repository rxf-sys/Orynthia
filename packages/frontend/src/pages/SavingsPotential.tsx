import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Sparkles,
  TrendingDown,
  Repeat,
  FileText,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, PageHead, Tag, EmptyState } from '@/components/ui';

export function SavingsPotentialPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['savings-potential'],
    queryFn: () => dashboardApi.getSavingsPotential().then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
      </div>
    );
  }

  const hasAnyData =
    data.totalFixedMonthly > 0 ||
    data.subscriptions.items.length > 0 ||
    data.providerSavings.topCandidates.length > 0 ||
    data.overspendingCategories.length > 0;

  return (
    <div className="space-y-5">
      <PageHead
        title="Sparpotenzial"
        sub="Wo deine fixen Kosten stecken und wo du am meisten herausholen kannst"
      />

      {!hasAnyData ? (
        <EmptyState
          icon={Sparkles}
          title="Noch keine Auswertung möglich"
          description="Sobald du Verträge, wiederkehrende Zahlungen oder einige Monate Transaktionen erfasst hast, zeigen wir hier dein Sparpotenzial."
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Fixkosten / Monat
              </div>
              <div className="tnum mt-2 text-[1.85rem] font-bold">
                {formatCurrency(data.totalFixedMonthly)}
              </div>
              <div className="mt-1 text-xs text-ink-3">
                ≈ {formatCurrency(data.totalFixedYearly)}/Jahr
              </div>
            </Card>
            <Card>
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Abos & Subscriptions
              </div>
              <div className="tnum mt-2 text-[1.85rem] font-bold">
                {formatCurrency(data.subscriptions.total)}
              </div>
              <div className="mt-1 text-xs text-ink-3">
                {data.subscriptions.count} {data.subscriptions.count === 1 ? 'Posten' : 'Posten'} / Monat
              </div>
            </Card>
            <Card>
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Anbieterwechsel-Potenzial
              </div>
              <div
                className="tnum mt-2 text-[1.85rem] font-bold"
                style={{ color: data.providerSavings.totalYearly > 0 ? 'var(--pos)' : undefined }}
              >
                {formatCurrency(data.providerSavings.totalYearly)}
              </div>
              <div className="mt-1 text-xs text-ink-3">pro Jahr durch Vergleich</div>
            </Card>
            <Card variant="soft" style={{ background: 'var(--grad-soft)' }}>
              <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Tipp
              </div>
              <p className="mt-2 text-sm text-ink">
                Geh deine Abos einmal pro Quartal durch und kündige, was du nicht aktiv nutzt — die
                meisten lassen sich mit einem Klick reaktivieren.
              </p>
            </Card>
          </div>

          {/* Subscriptions */}
          {data.subscriptions.items.length > 0 && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[1.05rem] font-bold text-ink">Deine Abos im Überblick</div>
                  <div className="text-[0.78rem] text-ink-3">
                    Streaming, Fitness und sonstige laufende Subscriptions
                  </div>
                </div>
                <Tag variant="pos">
                  {formatCurrency(data.subscriptions.total)} / Monat
                </Tag>
              </div>
              <div className="space-y-1">
                {data.subscriptions.items.map((s) => (
                  <div
                    key={`${s.kind}-${s.id}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-soft"
                  >
                    <div
                      className="grid h-8 w-8 place-items-center rounded-md"
                      style={{ background: 'rgba(0,0,0,.04)' }}
                    >
                      {s.kind === 'contract' ? (
                        <FileText className="h-4 w-4 text-indigo" />
                      ) : (
                        <Repeat className="h-4 w-4 text-indigo" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                      <div className="truncate text-xs text-ink-3">
                        {s.provider}
                        {s.lastChargeDate &&
                          ` · zuletzt ${new Date(s.lastChargeDate).toLocaleDateString('de-DE')}`}
                      </div>
                    </div>
                    <div className="tnum w-24 text-right text-sm font-bold">
                      {formatCurrency(s.monthlyCost)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Provider savings */}
          {data.providerSavings.topCandidates.length > 0 && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[1.05rem] font-bold text-ink flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-pos" />
                    Anbieter wechseln und sparen
                  </div>
                  <div className="text-[0.78rem] text-ink-3">
                    Verträge mit Kosten über dem Marktdurchschnitt – Vergleich öffnet sich extern
                  </div>
                </div>
                <Link
                  to="/contracts"
                  className="text-[0.85rem] font-semibold text-indigo hover:underline"
                >
                  Alle Verträge →
                </Link>
              </div>
              <div className="space-y-2">
                {data.providerSavings.topCandidates.map((c) => (
                  <div
                    key={c.contractId}
                    className="flex items-center gap-3 rounded-md border border-line bg-soft px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">
                        {c.contractName}{' '}
                        <span className="text-ink-3">({c.provider})</span>
                      </div>
                      <div className="text-xs text-ink-3 tnum">
                        Aktuell {formatCurrency(c.currentMonthly)} / Monat ·
                        Marktschnitt {formatCurrency(c.marketAvgMonthly)} ({c.percentAboveAvg}% über)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tnum text-sm font-bold text-pos">
                        -{formatCurrency(c.savingsPotentialYearly)}/J
                      </div>
                      {c.compareUrls[0] && (
                        <a
                          href={c.compareUrls[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-0.5 text-[0.72rem] text-indigo hover:underline"
                        >
                          Vergleichen <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Overspending categories */}
          {data.overspendingCategories.length > 0 && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warn" />
                <div className="text-[1.05rem] font-bold text-ink">Diesen Monat ungewöhnlich teuer</div>
              </div>
              <div className="text-[0.78rem] text-ink-3 mb-3">
                Kategorien, in denen du aktuell mindestens 20 % über deinem Median (Median der letzten 5 Monate) liegst.
              </div>
              <div className="space-y-2">
                {data.overspendingCategories.map((row) => (
                  <div
                    key={row.category!.id}
                    className="flex items-center gap-3 rounded-md border border-line bg-soft px-3 py-2.5"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md" style={{ background: 'rgba(0,0,0,.04)' }}>
                      {row.category!.icon ?? '📌'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{row.category!.name}</div>
                      <div className="text-xs text-ink-3 tnum">
                        Aktuell {formatCurrency(row.currentMonth)} · Median {formatCurrency(row.median)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tnum text-sm font-bold text-neg">
                        +{formatCurrency(row.overBy)}
                      </div>
                      <div className="text-[0.72rem] text-ink-3">+{row.overByPercent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
