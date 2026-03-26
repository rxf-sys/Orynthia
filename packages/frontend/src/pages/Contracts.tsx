import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, ShieldCheck, ExternalLink, TrendingDown, Sparkles, FileText } from 'lucide-react';
import { contractsApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Contract, CreateContractData, DetectedContract } from '@/lib/types';
import toast from 'react-hot-toast';

const contractTypeLabels: Record<string, { label: string; icon: string; group: string }> = {
  INSURANCE_LIABILITY: { label: 'Haftpflicht', icon: '🛡️', group: 'Versicherungen' },
  INSURANCE_HOUSEHOLD: { label: 'Hausrat', icon: '🏠', group: 'Versicherungen' },
  INSURANCE_HEALTH: { label: 'Krankenversicherung', icon: '🏥', group: 'Versicherungen' },
  INSURANCE_DENTAL: { label: 'Zahnzusatz', icon: '🦷', group: 'Versicherungen' },
  INSURANCE_LIFE: { label: 'Lebensversicherung', icon: '❤️', group: 'Versicherungen' },
  INSURANCE_CAR: { label: 'KFZ-Versicherung', icon: '🚗', group: 'Versicherungen' },
  INSURANCE_LEGAL: { label: 'Rechtsschutz', icon: '⚖️', group: 'Versicherungen' },
  INSURANCE_DISABILITY: { label: 'Berufsunfähigkeit', icon: '🏗️', group: 'Versicherungen' },
  INSURANCE_OTHER: { label: 'Sonstige Versicherung', icon: '📋', group: 'Versicherungen' },
  ENERGY_ELECTRICITY: { label: 'Strom', icon: '⚡', group: 'Energie' },
  ENERGY_GAS: { label: 'Gas', icon: '🔥', group: 'Energie' },
  TELECOM_MOBILE: { label: 'Mobilfunk', icon: '📱', group: 'Telekommunikation' },
  TELECOM_INTERNET: { label: 'Internet', icon: '🌐', group: 'Telekommunikation' },
  TELECOM_LANDLINE: { label: 'Festnetz', icon: '📞', group: 'Telekommunikation' },
  STREAMING: { label: 'Streaming', icon: '🎬', group: 'Abos' },
  GYM: { label: 'Fitness', icon: '💪', group: 'Abos' },
  SUBSCRIPTION: { label: 'Sonstiges Abo', icon: '📦', group: 'Abos' },
  RENT: { label: 'Miete', icon: '🏘️', group: 'Wohnen' },
  LEASE: { label: 'Leasing', icon: '🚙', group: 'Sonstige' },
  LOAN: { label: 'Kredit', icon: '🏦', group: 'Sonstige' },
  OTHER: { label: 'Sonstige', icon: '📄', group: 'Sonstige' },
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
  const [activeTab, setActiveTab] = useState<Tab>('contracts');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateContractData>>({
    name: '', provider: '', contractType: 'SUBSCRIPTION', billingCycle: 'MONTHLY',
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
    mutationFn: (det: DetectedContract) => contractsApi.createFromDetection({
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

  // Gruppierung nach Typ-Gruppe
  const grouped = new Map<string, Contract[]>();
  for (const c of contracts) {
    const group = contractTypeLabels[c.contractType]?.group || 'Sonstige';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(c);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Verträge</h1>
          <p className="text-surface-400 mt-1">
            Monatlich: <span className="text-white font-semibold">{formatCurrency(data?.totalMonthly || 0)}</span>
            {' / '}
            Jährlich: <span className="text-white font-semibold">{formatCurrency(data?.totalYearly || 0)}</span>
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Abbrechen' : 'Neuer Vertrag'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1 w-fit">
        {[
          { key: 'contracts' as Tab, label: 'Meine Verträge', icon: FileText },
          { key: 'detect' as Tab, label: 'Auto-Erkennung', icon: Sparkles },
          { key: 'compare' as Tab, label: 'Anbietervergleich', icon: TrendingDown },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === key ? 'bg-brand-600 text-white' : 'text-surface-400 hover:text-surface-200')}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Neuen Vertrag erfassen</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name || !form.provider || !form.contractType) { toast.error('Bitte Name, Anbieter und Typ ausfüllen'); return; }
              createMutation.mutate(form as CreateContractData);
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="label">Vertragsname *</label>
              <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="z.B. Haftpflicht, Strom..." required />
            </div>
            <div>
              <label className="label">Anbieter *</label>
              <input value={form.provider || ''} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="input" placeholder="z.B. Allianz, Vattenfall..." required />
            </div>
            <div>
              <label className="label">Vertragstyp *</label>
              <select value={form.contractType || ''} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className="input" required>
                {Object.entries(contractTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Monatliche Kosten</label>
              <input type="number" value={form.monthlyCost || ''} onChange={(e) => setForm({ ...form, monthlyCost: Number(e.target.value) || undefined })} className="input" placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="label">Jährliche Kosten</label>
              <input type="number" value={form.yearlyCost || ''} onChange={(e) => setForm({ ...form, yearlyCost: Number(e.target.value) || undefined })} className="input" placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="label">Abrechnungszyklus</label>
              <select value={form.billingCycle || 'MONTHLY'} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className="input">
                {Object.entries(billingLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Vertragsnummer</label>
              <input value={form.contractNumber || ''} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label">Kündigungsfrist</label>
              <input value={form.noticePeriod || ''} onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })} className="input" placeholder="z.B. 3 Monate" />
            </div>
            <div>
              <label className="label">Vertragsbeginn</label>
              <input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vertrag speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Meine Verträge */}
      {activeTab === 'contracts' && (
        isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-surface-500">Noch keine Verträge erfasst.</p>
            <p className="text-surface-600 text-sm mt-1">Nutze die Auto-Erkennung oder erfasse Verträge manuell.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                <h3 className="text-sm font-medium text-surface-500 mb-3">{group}</h3>
                <div className="space-y-2">
                  {items.map((contract) => {
                    const typeInfo = contractTypeLabels[contract.contractType] || { label: contract.contractType, icon: '📄' };
                    return (
                      <div key={contract.id} className="card-hover group flex items-center gap-4">
                        <span className="text-xl flex-shrink-0">{typeInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-surface-200 truncate">{contract.name}</h4>
                            <span className="text-xs text-surface-500">{contract.provider}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                            <span>{billingLabels[contract.billingCycle] || contract.billingCycle}</span>
                            {contract.noticePeriod && <span>Kündigungsfrist: {contract.noticePeriod}</span>}
                            {contract.contractNumber && <span>Nr. {contract.contractNumber}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-semibold text-white tabular-nums">{formatCurrency(contract.monthlyCost)}/M</p>
                          <p className="text-xs text-surface-500">{formatCurrency(contract.yearlyCost)}/J</p>
                        </div>
                        <button
                          onClick={() => { if (confirm('Vertrag wirklich löschen?')) deleteMutation.mutate(contract.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Tab: Auto-Erkennung */}
      {activeTab === 'detect' && (
        <div>
          <p className="text-sm text-surface-400 mb-4">
            Analyse der letzten 12 Monate. Wiederkehrende Zahlungen mit mindestens 3 Buchungen werden erkannt.
          </p>
          {loadingDetect ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-surface-500" />
            </div>
          ) : !detected || detected.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-surface-500">Keine neuen Verträge erkannt.</p>
              <p className="text-surface-600 text-sm mt-1">Alle wiederkehrenden Zahlungen sind bereits erfasst.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {detected.map((det, i) => {
                const typeInfo = contractTypeLabels[det.suggestedType] || { label: det.suggestedType, icon: '📄' };
                return (
                  <div key={i} className="card-hover flex items-center gap-4">
                    <span className="text-xl flex-shrink-0">{typeInfo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-surface-200 truncate">{det.counterpartName}</h4>
                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                        <span>{det.occurrences}x in 12 Monaten</span>
                        <span>Erkannt als: {typeInfo.label}</span>
                        <span>Letzte: {new Date(det.lastDate).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-semibold text-white tabular-nums">{formatCurrency(det.avgAmount)}</p>
                      <p className="text-xs text-surface-500">Durchschnitt</p>
                    </div>
                    <button
                      onClick={() => adoptMutation.mutate(det)}
                      disabled={adoptMutation.isPending}
                      className="btn-primary text-sm px-3 py-1.5 flex-shrink-0"
                    >
                      {adoptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Übernehmen
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Anbietervergleich */}
      {activeTab === 'compare' && (
        <div>
          <p className="text-sm text-surface-400 mb-4">
            Vergleich deiner Verträge mit deutschen Marktdurchschnitten. Preise basierend auf Check24/Verivox Referenzwerten.
          </p>
          {loadingCompare ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-surface-500" />
            </div>
          ) : !comparison || comparison.comparisons.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-surface-500">Noch keine vergleichbaren Verträge vorhanden.</p>
              <p className="text-surface-600 text-sm mt-1">Erfasse Versicherungen und Energieverträge um Sparpotential zu sehen.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comparison.totalSavingsYearly > 0 && (
                <div className="card bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="h-6 w-6 text-emerald-400" />
                    <div>
                      <p className="text-lg font-bold text-emerald-400">
                        Bis zu {formatCurrency(comparison.totalSavingsYearly)}/Jahr Sparpotential
                      </p>
                      <p className="text-sm text-surface-400">
                        Das sind {formatCurrency(comparison.totalSavingsMonthly)} pro Monat
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {comparison.comparisons.map((comp) => {
                const typeInfo = contractTypeLabels[comp.contractType] || { label: comp.contractType, icon: '📄' };
                const ratingColor = comp.rating === 'GOOD' ? 'text-emerald-400 bg-emerald-500/10' : comp.rating === 'OK' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
                const ratingLabel = comp.rating === 'GOOD' ? 'Gut' : comp.rating === 'OK' ? 'OK' : 'Teuer';

                return (
                  <div key={comp.contractId} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{typeInfo.icon}</span>
                        <div>
                          <h4 className="font-medium text-surface-200">{comp.contractName}</h4>
                          <p className="text-xs text-surface-500">{comp.provider}</p>
                        </div>
                      </div>
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', ratingColor)}>
                        {ratingLabel}
                        {comp.percentAboveAvg > 0 && ` (+${comp.percentAboveAvg}%)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-surface-500">Dein Preis</p>
                        <p className="text-lg font-semibold text-white">{formatCurrency(comp.currentMonthly)}/M</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-500">Marktdurchschnitt</p>
                        <p className="text-lg font-semibold text-surface-300">{formatCurrency(comp.marketAvgMonthly)}/M</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-500">Sparpotential</p>
                        <p className={cn('text-lg font-semibold', comp.savingsPotentialYearly > 0 ? 'text-emerald-400' : 'text-surface-500')}>
                          {comp.savingsPotentialYearly > 0 ? `${formatCurrency(comp.savingsPotentialYearly)}/J` : '--'}
                        </p>
                      </div>
                    </div>

                    {comp.tips.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-surface-400 mb-1">Tipps:</p>
                        <ul className="text-xs text-surface-500 space-y-0.5">
                          {comp.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ShieldCheck className="h-3 w-3 text-brand-400 mt-0.5 flex-shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {comp.compareUrls.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {comp.compareUrls.map((url, i) => {
                          const domain = new URL(url).hostname.replace('www.', '');
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                              <ExternalLink className="h-3 w-3" />
                              {domain}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
