import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portfolioApi } from '@/lib/api';
import type { CreateHoldingData } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Briefcase, Plus, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

const holdingTypeLabels: Record<string, string> = {
  STOCK: 'Aktien', ETF: 'ETFs', BOND: 'Anleihen',
  CRYPTO: 'Kryptowährungen', FUND: 'Fonds', OTHER: 'Sonstiges',
};

export function PortfolioPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateHoldingData>({
    symbol: '', name: '', holdingType: 'ETF', quantity: 0, avgBuyPrice: 0, currentPrice: 0,
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => portfolioApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateHoldingData) => portfolioApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); setShowForm(false); toast.success('Position hinzugefügt'); },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => portfolioApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); toast.success('Gelöscht'); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-brand-400" /> Portfolio
        </h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Neue Position
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Investiert</p>
            <p className="text-xl font-bold text-white">{formatCurrency(summary.totalInvested)}</p>
          </div>
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Aktueller Wert</p>
            <p className="text-xl font-bold text-white">{formatCurrency(summary.totalCurrentValue)}</p>
          </div>
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Gewinn/Verlust</p>
            <p className={`text-xl font-bold flex items-center gap-1 ${summary.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.totalProfitLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(summary.totalProfitLoss)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-surface-400 text-sm">Performance</p>
            <p className={`text-xl font-bold ${summary.totalProfitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.totalProfitLossPercent >= 0 ? '+' : ''}{summary.totalProfitLossPercent}%
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="card p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">Symbol</label>
            <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} className="input" placeholder="z.B. AAPL, BTC" required />
          </div>
          <div>
            <label className="label">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="z.B. Apple Inc." required />
          </div>
          <div>
            <label className="label">Typ</label>
            <select value={form.holdingType} onChange={(e) => setForm({ ...form, holdingType: e.target.value })} className="input">
              {Object.entries(holdingTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Anzahl</label>
            <input type="number" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" step="0.00000001" required />
          </div>
          <div>
            <label className="label">Ø Kaufpreis</label>
            <input type="number" value={form.avgBuyPrice || ''} onChange={(e) => setForm({ ...form, avgBuyPrice: Number(e.target.value) })} className="input" step="0.01" required />
          </div>
          <div>
            <label className="label">Aktueller Preis</label>
            <input type="number" value={form.currentPrice || ''} onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) })} className="input" step="0.01" required />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Position speichern'}
            </button>
          </div>
        </form>
      )}

      {/* Holdings table */}
      {summary && summary.holdings.length > 0 && (
        <div className="card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-surface-400 border-b border-surface-700">
                  <th className="text-left py-2">Position</th>
                  <th className="text-right py-2">Anzahl</th>
                  <th className="text-right py-2">Ø Kauf</th>
                  <th className="text-right py-2">Aktuell</th>
                  <th className="text-right py-2">Wert</th>
                  <th className="text-right py-2">G/V</th>
                  <th className="text-right py-2">%</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {summary.holdings.map((h) => (
                  <tr key={h.id} className="border-b border-surface-800">
                    <td className="py-3">
                      <div className="text-white font-medium">{h.symbol}</div>
                      <div className="text-surface-500 text-xs">{h.name}</div>
                    </td>
                    <td className="py-3 text-right text-surface-300">{h.quantity}</td>
                    <td className="py-3 text-right text-surface-300">{formatCurrency(h.avgBuyPrice)}</td>
                    <td className="py-3 text-right text-white">{formatCurrency(h.currentPrice)}</td>
                    <td className="py-3 text-right text-white font-medium">{formatCurrency(h.currentValue)}</td>
                    <td className={`py-3 text-right font-medium ${h.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(h.profitLoss)}
                    </td>
                    <td className={`py-3 text-right ${h.profitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {h.profitLossPercent >= 0 ? '+' : ''}{h.profitLossPercent}%
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => removeMutation.mutate(h.id)} className="text-surface-500 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary && summary.holdings.length === 0 && (
        <div className="card p-12 text-center text-surface-400">
          Noch keine Positionen. Füge deine Aktien, ETFs oder Krypto hinzu.
        </div>
      )}
    </div>
  );
}
