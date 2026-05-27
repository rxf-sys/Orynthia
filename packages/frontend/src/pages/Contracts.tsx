import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  ExternalLink,
  TrendingDown,
  Sparkles,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { contractsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Contract, CreateContractData, DetectedContract } from '@/lib/types';
import toast from 'react-hot-toast';
import { Card, Btn, Field, PageHead, Tag, useConfirm } from '@/components/ui';

const contractTypeLabels: Record<string, { label: string; icon: string; group: string; color?: string }> = {
  INSURANCE_LIABILITY: { label: 'Haftpflicht', icon: '🛡️', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_HOUSEHOLD: { label: 'Hausrat', icon: '🏠', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_HEALTH: { label: 'Krankenversicherung', icon: '🏥', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_DENTAL: { label: 'Zahnzusatz', icon: '🦷', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_LIFE: { label: 'Lebensversicherung', icon: '❤️', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_CAR: { label: 'KFZ-Versicherung', icon: '🚗', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_LEGAL: { label: 'Rechtsschutz', icon: '⚖️', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_DISABILITY: { label: 'Berufsunfähigkeit', icon: '🏗️', group: 'Versicherungen', color: '#5b8def' },
  INSURANCE_OTHER: { label: 'Sonstige Versicherung', icon: '📋', group: 'Versicherungen', color: '#5b8def' },
  ENERGY_ELECTRICITY: { label: 'Strom', icon: '⚡', group: 'Energie', color: '#d99a2b' },
  ENERGY_GAS: { label: 'Gas', icon: '🔥', group: 'Energie', color: '#d99a2b' },
  TELECOM_MOBILE: { label: 'Mobilfunk', icon: '📱', group: 'Telekommunikation', color: '#b97aff' },
  TELECOM_INTERNET: { label: 'Internet', icon: '🌐', group: 'Telekommunikation', color: '#b97aff' },
  TELECOM_LANDLINE: { label: 'Festnetz', icon: '📞', group: 'Telekommunikation', color: '#b97aff' },
  STREAMING: { label: 'Streaming', icon: '🎬', group: 'Abos', color: '#e76b8d' },
  GYM: { label: 'Fitness', icon: '💪', group: 'Abos', color: '#1f8a5b' },
  SUBSCRIPTION: { label: 'Sonstiges Abo', icon: '📦', group: 'Abos', color: '#e76b8d' },
  RENT: { label: 'Miete', icon: '🏘️', group: 'Wohnen', color: '#424769' },
  LEASE: { label: 'Leasing', icon: '🚙', group: 'Sonstige', color: '#3aa3a5' },
  LOAN: { label: 'Kredit', icon: '🏦', group: 'Sonstige', color: '#3aa3a5' },
  OTHER: { label: 'Sonstige', icon: '📄', group: 'Sonstige', color: '#878f9d' },
};

const billingLabels: Record<string, string> = {
  MONTHLY: 'Monatlich',
  QUARTERLY: 'Vierteljährlich',
  BIANNUALLY: 'Halbjährlich',
  YEARLY: 'Jährlich',
};

type Tab = 'contracts' | 'detect' | 'compare';

export function ContractsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<Tab>('contracts');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateContractData>>({
    name: '',
    provider: '',
    contractType: 'SUBSCRIPTION',
    billingCycle: 'MONTHLY',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractsApi.getAll().then((r) => r.data),
  });

  const { data: detected, isLoading: loadingDetect } = useQuery({
    queryKey: ['contracts-detect'],
    queryFn: () => contractsApi.detect().then((r) => r.data),
    enabled: activeTab === 'detect',
  });

  const { data: comparison, isLoading: loadingCompare } = useQuery({
    queryKey: ['contracts-compare'],
    queryFn: () => contractsApi.compare().then((r) => r.data),
    enabled: activeTab === 'compare',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateContractData) => contractsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
      setForm({ name: '', provider: '', contractType: 'SUBSCRIPTION', billingCycle: 'MONTHLY' });
      toast.success('Vertrag erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-compare'] });
      toast.success('Vertrag gelöscht');
    },
  });

  const adoptMutation = useMutation({
    mutationFn: (det: DetectedContract) =>
      contractsApi.createFromDetection({
        counterpartName: det.counterpartName,
        counterpartIban: det.counterpartIban,
        avgAmount: det.avgAmount,
        frequency: det.frequency,
        contractType: det.suggestedType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts-detect'] });
      toast.success('Vertrag übernommen');
    },
    onError: () => toast.error('Fehler'),
  });

  const contracts = data?.contracts || [];

  const grouped = new Map<string, Contract[]>();
  for (const c of contracts) {
    const group = contractTypeLabels[c.contractType]?.group || 'Sonstige';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(c);
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Verträge"
        sub={`${contracts.length} laufende Verträge`}
        actions={
          <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Abbrechen' : 'Neuer Vertrag'}
          </Btn>
        }
      />

      {/* Hero: savings potential */}
      <Card variant="hero">
        <div className="relative z-[2] grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="text-[0.78rem] uppercase tracking-[0.08em] opacity-90">
              Sparpotential
            </div>
            <div className="h-display mt-1 text-[2.4rem] leading-[1.1]">
              Du könntest{' '}
              <span style={{ color: 'var(--peach-2)' }} className="tnum">
                {formatCurrency(comparison?.totalSavingsYearly || 0)}
              </span>
              /Jahr sparen
            </div>
            <div className="mt-1 text-[0.9rem] opacity-85">
              Wir vergleichen deine Verträge mit Marktdurchschnitten.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-white">
            <HeroTile label="Monatlich" value={formatCurrency(data?.totalMonthly || 0)} />
            <HeroTile label="Jährlich" value={formatCurrency(data?.totalYearly || 0)} />
            <HeroTile label="Verträge" value={`${contracts.length}`} />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-pill border border-line bg-soft p-1 sm:w-fit">
        {(
          [
            { key: 'contracts', label: 'Meine Verträge', icon: FileText },
            { key: 'detect', label: 'Auto-Erkennung', icon: Sparkles },
            { key: 'compare', label: 'Anbietervergleich', icon: TrendingDown },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition sm:flex-none',
              activeTab === key ? 'bg-elev text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <Card
          className="animate-fade-in"
          style={{
            borderStyle: 'dashed',
            borderColor: 'var(--peach)',
            background: 'rgba(255,177,122,.05)',
          }}
        >
          <h3 className="mb-4 text-lg font-bold text-ink">Neuen Vertrag erfassen</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name || !form.provider || !form.contractType) {
                toast.error('Bitte Name, Anbieter und Typ ausfüllen');
                return;
              }
              createMutation.mutate(form as CreateContractData);
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Vertragsname" required>
              <input
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="z. B. Haftpflicht, Strom…"
                required
              />
            </Field>
            <Field label="Anbieter" required>
              <input
                value={form.provider || ''}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="input"
                placeholder="z. B. Allianz, Vattenfall…"
                required
              />
            </Field>
            <Field label="Vertragstyp" required>
              <select
                value={form.contractType || ''}
                onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                className="select"
                required
              >
                {Object.entries(contractTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monatliche Kosten">
              <input
                type="number"
                value={form.monthlyCost ?? ''}
                onChange={(e) => setForm({ ...form, monthlyCost: Number(e.target.value) || undefined })}
                className="input tnum"
                placeholder="0,00"
                step="0.01"
              />
            </Field>
            <Field label="Jährliche Kosten">
              <input
                type="number"
                value={form.yearlyCost ?? ''}
                onChange={(e) => setForm({ ...form, yearlyCost: Number(e.target.value) || undefined })}
                className="input tnum"
                placeholder="0,00"
                step="0.01"
              />
            </Field>
            <Field label="Abrechnungszyklus">
              <select
                value={form.billingCycle || 'MONTHLY'}
                onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                className="select"
              >
                {Object.entries(billingLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vertragsnummer">
              <input
                value={form.contractNumber || ''}
                onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className="input"
                placeholder="Optional"
              />
            </Field>
            <Field label="Kündigungsfrist">
              <input
                value={form.noticePeriod || ''}
                onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })}
                className="input"
                placeholder="z. B. 3 Monate"
              />
            </Field>
            <Field label="Vertragsbeginn">
              <input
                type="date"
                value={form.startDate || ''}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
              />
            </Field>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Btn type="submit" variant="grad" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vertrag speichern'}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Tab content */}
      {activeTab === 'contracts' &&
        (isLoading ? (
          <Loader />
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10 text-ink-4" />}
            title="Noch keine Verträge erfasst"
            sub="Nutze die Auto-Erkennung oder erfasse Verträge manuell."
          />
        ) : (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                <h3 className="mb-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {group}
                </h3>
                <Card className="!p-0">
                  {items.map((contract, idx) => {
                    const info =
                      contractTypeLabels[contract.contractType] || {
                        label: contract.contractType,
                        icon: '📄',
                        color: '#878f9d',
                      };
                    return (
                      <div
                        key={contract.id}
                        className={cn(
                          'group flex items-center gap-4 px-5 py-3.5',
                          idx > 0 && 'border-t',
                        )}
                        style={idx > 0 ? { borderColor: 'var(--line-2)' } : undefined}
                      >
                        <div
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-lg"
                          style={{
                            background: `${info.color}1f`,
                            color: info.color,
                          }}
                        >
                          {info.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-semibold text-ink">{contract.name}</h4>
                            <Tag>{info.label}</Tag>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                            <span>{contract.provider}</span>
                            <span>·</span>
                            <span>{billingLabels[contract.billingCycle] || contract.billingCycle}</span>
                            {contract.noticePeriod && (
                              <>
                                <span>·</span>
                                <span>Frist: {contract.noticePeriod}</span>
                              </>
                            )}
                            {contract.contractNumber && (
                              <>
                                <span>·</span>
                                <span>Nr. {contract.contractNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="tnum text-[1.05rem] font-bold">
                            {formatCurrency(contract.monthlyCost)}
                          </div>
                          <div className="text-[0.72rem] text-ink-3 tnum">
                            {formatCurrency(contract.yearlyCost)}/J
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Vertrag löschen?',
                              description: `${contract.name} (${contract.provider})`,
                              confirmLabel: 'Löschen',
                              destructive: true,
                            });
                            if (ok) deleteMutation.mutate(contract.id);
                          }}
                          className="opacity-100 transition-opacity hover:text-neg sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                          aria-label="Vertrag löschen"
                        >
                          <Trash2 className="h-4 w-4 text-ink-3" />
                        </button>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        ))}

      {activeTab === 'detect' && (
        <div>
          <p className="mb-4 text-sm text-ink-3">
            Analyse der letzten 12 Monate. Wiederkehrende Zahlungen mit mindestens 3 Buchungen werden erkannt.
          </p>
          {loadingDetect ? (
            <Loader />
          ) : !detected || detected.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-10 w-10 text-ink-4" />}
              title="Keine neuen Verträge erkannt"
              sub="Alle wiederkehrenden Zahlungen sind bereits erfasst."
            />
          ) : (
            <Card className="!p-0">
              {detected.map((det, i) => {
                const info =
                  contractTypeLabels[det.suggestedType] || {
                    label: det.suggestedType,
                    icon: '📄',
                    color: '#878f9d',
                  };
                return (
                  <div
                    key={i}
                    className={cn('flex items-center gap-4 px-5 py-3.5', i > 0 && 'border-t')}
                    style={i > 0 ? { borderColor: 'var(--line-2)' } : undefined}
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-lg"
                      style={{ background: `${info.color}1f`, color: info.color }}
                    >
                      {info.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate font-semibold text-ink">{det.counterpartName}</h4>
                        <Tag variant="info">{det.occurrences}× in 12 Mon.</Tag>
                        <Tag variant="accent">{info.label}</Tag>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        Letzte: {new Date(det.lastDate).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tnum text-[1.05rem] font-bold">{formatCurrency(det.avgAmount)}</div>
                      <div className="text-[0.72rem] text-ink-3">Durchschnitt</div>
                    </div>
                    <Btn
                      size="sm"
                      variant="grad"
                      icon={Plus}
                      onClick={() => adoptMutation.mutate(det)}
                      disabled={adoptMutation.isPending}
                    >
                      Übernehmen
                    </Btn>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-4">
          <p className="text-sm text-ink-3">
            Vergleich deiner Verträge mit deutschen Marktdurchschnitten. Preise basierend auf Check24/Verivox-Referenzwerten.
          </p>
          {loadingCompare ? (
            <Loader />
          ) : !comparison || comparison.comparisons.length === 0 ? (
            <EmptyState
              icon={<TrendingDown className="h-10 w-10 text-ink-4" />}
              title="Keine vergleichbaren Verträge"
              sub="Erfasse Versicherungen und Energieverträge, um Sparpotential zu sehen."
            />
          ) : (
            <>
              {comparison.totalSavingsYearly > 0 && (
                <Card
                  className="flex items-center gap-3"
                  style={{ background: 'var(--pos-bg)', borderColor: 'transparent' }}
                >
                  <TrendingDown className="h-6 w-6 text-pos" />
                  <div>
                    <p className="tnum text-lg font-bold text-pos">
                      Bis zu {formatCurrency(comparison.totalSavingsYearly)}/Jahr Sparpotential
                    </p>
                    <p className="text-sm text-ink-2">
                      Das sind {formatCurrency(comparison.totalSavingsMonthly)} pro Monat
                    </p>
                  </div>
                </Card>
              )}

              {comparison.comparisons.map((comp) => {
                const info =
                  contractTypeLabels[comp.contractType] || {
                    label: comp.contractType,
                    icon: '📄',
                    color: '#878f9d',
                  };
                const ratingVariant: 'pos' | 'warn' | 'neg' =
                  comp.rating === 'GOOD' ? 'pos' : comp.rating === 'OK' ? 'warn' : 'neg';
                const ratingLabel =
                  comp.rating === 'GOOD' ? 'Gut' : comp.rating === 'OK' ? 'OK' : 'Teuer';

                return (
                  <Card key={comp.contractId}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="grid h-10 w-10 place-items-center rounded-md text-lg"
                          style={{ background: `${info.color}1f`, color: info.color }}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold text-ink">{comp.contractName}</h4>
                          <p className="text-xs text-ink-3">{comp.provider}</p>
                        </div>
                      </div>
                      <Tag variant={ratingVariant}>
                        {ratingLabel}
                        {comp.percentAboveAvg > 0 && ` (+${comp.percentAboveAvg}%)`}
                      </Tag>
                    </div>

                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <CompareKpi label="Dein Tarif" value={formatCurrency(comp.currentMonthly)} />
                      <CompareKpi
                        label="Marktdurchschnitt"
                        value={formatCurrency(comp.marketAvgMonthly)}
                        muted
                      />
                      <CompareKpi
                        label="Ersparnis"
                        value={
                          comp.savingsPotentialYearly > 0
                            ? `${formatCurrency(comp.savingsPotentialYearly)}/J`
                            : '—'
                        }
                        positive={comp.savingsPotentialYearly > 0}
                      />
                    </div>

                    {comp.tips.length > 0 && (
                      <div
                        className="mb-3 flex items-start gap-2 rounded-md p-3"
                        style={{ background: 'var(--bg-soft)' }}
                      >
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach" />
                        <ul className="space-y-0.5 text-xs text-ink-2">
                          {comp.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-indigo" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {comp.compareUrls.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {comp.compareUrls.map((url, i) => {
                          let host = url;
                          try {
                            host = new URL(url).hostname.replace('www.', '');
                          } catch {
                            /* keep as is */
                          }
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-pill border border-line bg-elev px-3 py-1 text-xs font-semibold text-ink-2 hover:text-indigo"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {host}
                            </a>
                          );
                        })}
                        <Btn size="sm" variant="grad" className="ml-auto">
                          Wechseln
                        </Btn>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HeroTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-3 backdrop-blur"
      style={{ background: 'rgba(255,255,255,.12)' }}
    >
      <div className="text-[0.72rem] opacity-85">{label}</div>
      <div className="tnum mt-0.5 text-[1.1rem] font-bold">{value}</div>
    </div>
  );
}

function CompareKpi({
  label,
  value,
  muted,
  positive,
}: {
  label: string;
  value: string;
  muted?: boolean;
  positive?: boolean;
}) {
  return (
    <div>
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <div
        className={cn('tnum mt-1 text-lg font-bold', muted && 'text-ink-3')}
        style={positive ? { color: 'var(--pos)' } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <Card className="text-center" style={{ padding: '48px 24px' }}>
      <div className="mb-3 inline-flex">{icon}</div>
      <p className="font-semibold text-ink">{title}</p>
      {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
    </Card>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-indigo" />
    </div>
  );
}
