import { useQuery } from '@tanstack/react-query';
import { cashflowApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';

export function CashflowPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cashflow-forecast'],
    queryFn: () => cashflowApi.getForecast(6).then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-400" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-brand-400" /> Cashflow-Prognose
      </h1>

      {/* Current status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-surface-400 text-sm">Aktueller Kontostand</p>
          <p className="text-xl font-bold text-white">{formatCurrency(data.currentBalance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-surface-400 text-sm">Ende des Monats (geschätzt)</p>
          <p className={`text-xl font-bold ${data.endOfMonthEstimate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(data.endOfMonthEstimate)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-surface-400 text-sm">Monatliche Einnahmen</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(data.monthlyIncome)}</p>
        </div>
        <div className="card p-4">
          <p className="text-surface-400 text-sm">Monatliche Ausgaben</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(data.monthlyExpenses)}</p>
        </div>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          {data.warnings.map((w, i) => (
            <div key={i} className="card p-4 border-l-4 border-yellow-500 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-surface-300">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Einnahmen-Aufschlüsselung</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Wiederkehrend (Abos, Gehalt)</span>
              <span className="text-green-400 font-medium">{formatCurrency(data.recurring.income)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Variabel (Ø 3 Monate)</span>
              <span className="text-green-400 font-medium">{formatCurrency(data.variable.income)}</span>
            </div>
            <div className="border-t border-surface-700 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-white">Gesamt</span>
              <span className="text-green-400">{formatCurrency(data.monthlyIncome)}</span>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Ausgaben-Aufschlüsselung</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Wiederkehrend (Abos, Miete)</span>
              <span className="text-red-400 font-medium">{formatCurrency(data.recurring.expenses)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Variabel (Ø 3 Monate)</span>
              <span className="text-red-400 font-medium">{formatCurrency(data.variable.expenses)}</span>
            </div>
            <div className="border-t border-surface-700 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-white">Gesamt</span>
              <span className="text-red-400">{formatCurrency(data.monthlyExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast table */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">Prognose der nächsten Monate</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-400 border-b border-surface-700">
                <th className="text-left py-2">Monat</th>
                <th className="text-right py-2">Einnahmen</th>
                <th className="text-right py-2">Ausgaben</th>
                <th className="text-right py-2">Netto</th>
                <th className="text-right py-2">Kontostand</th>
              </tr>
            </thead>
            <tbody>
              {data.forecast.map((f) => (
                <tr key={f.month} className="border-b border-surface-800">
                  <td className="py-3 text-white">{f.label}</td>
                  <td className="py-3 text-right text-green-400">{formatCurrency(f.income)}</td>
                  <td className="py-3 text-right text-red-400">{formatCurrency(f.expenses)}</td>
                  <td className={`py-3 text-right font-medium ${f.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(f.net)}
                  </td>
                  <td className={`py-3 text-right font-bold ${f.projectedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatCurrency(f.projectedBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly net */}
      <div className="card p-6 text-center">
        <p className="text-surface-400">Monatliches Netto</p>
        <p className={`text-3xl font-bold mt-2 flex items-center justify-center gap-2 ${data.monthlyNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {data.monthlyNet >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          {formatCurrency(data.monthlyNet)}
          <span className="text-sm text-surface-400 font-normal">/Monat</span>
        </p>
      </div>
    </div>
  );
}
