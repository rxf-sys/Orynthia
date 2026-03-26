import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '@/lib/api';
import type { CreateAssetData } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Landmark, Plus, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

const assetTypeLabels: Record<string, string> = {
  REAL_ESTATE: 'Immobilien', VEHICLE: 'Fahrzeuge', INVESTMENT: 'Investments',
  CRYPTO: 'Krypto', CASH: 'Bargeld', OTHER_ASSET: 'Sonstiges',
  MORTGAGE: 'Hypothek', CONSUMER_LOAN: 'Konsumkredit',
  STUDENT_LOAN: 'Studienkredit', OTHER_LIABILITY: 'Sonstige Schulden',
};

const liabilityTypes = ['MORTGAGE', 'CONSUMER_LOAN', 'STUDENT_LOAN', 'OTHER_LIABILITY'];

export function NetWorthPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateAssetData>({
    name: '', assetType: 'REAL_ESTATE', value: 0, isLiability: false,
  });

  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.getAll().then(r => r.data) });
  const netWorthQuery = useQuery({ queryKey: ['net-worth'], queryFn: () => assetsApi.getNetWorth().then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (data: CreateAssetData) => assetsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['net-worth'] }); setShowForm(false); toast.success('Vermögenswert hinzugefügt'); },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => assetsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['net-worth'] }); toast.success('Gelöscht'); },
  });

  const nw = netWorthQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Landmark className="h-6 w-6 text-brand-400" /> Vermögensübersicht
        </h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Neuer Wert
        </button>
      </div>

      {nw && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Vermögen</p>
            <p className="text-xl font-bold text-green-400 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> {formatCurrency(nw.totalAssets)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Verbindlichkeiten</p>
            <p className="text-xl font-bold text-red-400 flex items-center gap-1">
              <TrendingDown className="h-4 w-4" /> {formatCurrency(nw.totalLiabilities)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Nettovermögen</p>
            <p className={`text-xl font-bold ${nw.netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(nw.netWorth)}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="card p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Typ</label>
            <select value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value, isLiability: liabilityTypes.includes(e.target.value) })} className="input">
              {Object.entries(assetTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Wert (EUR)</label>
            <input type="number" value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="input" step="0.01" required />
          </div>
          <div>
            <label className="label">Institution</label>
            <input value={form.institution || ''} onChange={(e) => setForm({ ...form, institution: e.target.value })} className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Zinssatz (%)</label>
            <input type="number" value={form.interestRate || ''} onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) || undefined })} className="input" step="0.01" placeholder="Optional" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
            </button>
          </div>
        </form>
      )}

      {/* Assets list grouped by type */}
      {nw?.byType.map((group) => (
        <div key={group.type} className="card p-6">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold text-white">{assetTypeLabels[group.type] || group.type}</h2>
            <span className="text-surface-400">{formatCurrency(group.total)}</span>
          </div>
          <div className="space-y-2">
            {group.items.map((item) => (
              <div key={item.name} className="flex justify-between text-sm items-center">
                <span className="text-surface-300">{item.name}</span>
                <span className="text-white font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Bank accounts */}
      {nw?.bankAccounts.accounts.length ? (
        <div className="card p-6">
          <div className="flex justify-between mb-3">
            <h2 className="font-semibold text-white">Bankkonten</h2>
            <span className="text-surface-400">{formatCurrency(nw.bankAccounts.total)}</span>
          </div>
          <div className="space-y-2">
            {nw.bankAccounts.accounts.map((a) => (
              <div key={a.name} className="flex justify-between text-sm">
                <span className="text-surface-300">{a.name}</span>
                <span className="text-white font-medium">{formatCurrency(a.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Asset list with delete */}
      {assetsQuery.data && assetsQuery.data.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-3">Alle Vermögenswerte verwalten</h2>
          <div className="space-y-2">
            {assetsQuery.data.map((asset) => (
              <div key={asset.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-surface-300">{asset.name}</span>
                  <span className="text-surface-500 ml-2">{assetTypeLabels[asset.assetType] || asset.assetType}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-medium ${asset.isLiability ? 'text-red-400' : 'text-green-400'}`}>
                    {asset.isLiability ? '-' : ''}{formatCurrency(asset.value)}
                  </span>
                  <button onClick={() => removeMutation.mutate(asset.id)} className="text-surface-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
