import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, Download, TrendingUp, TrendingDown, Loader2, ArrowRightLeft } from 'lucide-react';

const GERMAN_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

export function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');

  const monthlyQuery = useQuery({
    queryKey: ['report-monthly', year, month],
    queryFn: () => reportsApi.getMonthly(year, month).then((r) => r.data),
    enabled: reportType === 'monthly',
  });

  const yearlyQuery = useQuery({
    queryKey: ['report-yearly', year],
    queryFn: () => reportsApi.getYearly(year).then((r) => r.data),
    enabled: reportType === 'yearly',
  });

  const handleExport = async () => {
    const res = await reportsApi.exportCsv(year, reportType === 'monthly' ? month : undefined);
    const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
    const a = document.createElement('a');
    a.href = url;
    a.download = reportType === 'monthly'
      ? `Orynthia_Bericht_${year}_${String(month).padStart(2, '0')}.csv`
      : `Orynthia_Jahresbericht_${year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const report = reportType === 'monthly' ? monthlyQuery.data : yearlyQuery.data;
  const isLoading = reportType === 'monthly' ? monthlyQuery.isLoading : yearlyQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-brand-400" /> Berichte
        </h1>
        <div className="flex gap-2 items-center">
          <select value={reportType} onChange={(e) => setReportType(e.target.value as 'monthly' | 'yearly')} className="input w-32">
            <option value="monthly">Monatlich</option>
            <option value="yearly">Jährlich</option>
          </select>
          {reportType === 'monthly' && (
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input w-36">
              {GERMAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input w-24">
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-400" /></div>
      ) : report ? (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Einnahmen</p>
              <p className="text-xl font-bold text-green-400 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> {formatCurrency(report.income.total)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Ausgaben</p>
              <p className="text-xl font-bold text-red-400 flex items-center gap-1">
                <TrendingDown className="h-4 w-4" /> {formatCurrency(report.expenses.total)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Bilanz</p>
              <p className={`text-xl font-bold ${report.balance >= 0 ? 'text-green-400' : 'text-red-400'} flex items-center gap-1`}>
                <ArrowRightLeft className="h-4 w-4" /> {formatCurrency(report.balance)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Sparquote</p>
              <p className={`text-xl font-bold ${report.savingsRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {report.savingsRate}%
              </p>
            </div>
          </div>

          {/* Expenses by Category */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Ausgaben nach Kategorie</h2>
            <div className="space-y-3">
              {report.expenses.byCategory.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm text-surface-300 w-40 truncate">{cat.category}</span>
                  <div className="flex-1 bg-surface-800 rounded-full h-4 overflow-hidden">
                    <div className="bg-brand-500 h-full rounded-full" style={{ width: `${cat.percentage}%` }} />
                  </div>
                  <span className="text-sm text-white w-24 text-right">{formatCurrency(cat.amount)}</span>
                  <span className="text-xs text-surface-400 w-10 text-right">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly comparison or top expenses */}
          {'topExpenses' in report && report.topExpenses.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Top Ausgaben-Empfänger</h2>
              <div className="space-y-2">
                {report.topExpenses.map((item) => (
                  <div key={item.counterpartName} className="flex justify-between text-sm">
                    <span className="text-surface-300">{item.counterpartName} <span className="text-surface-500">({item.count}x)</span></span>
                    <span className="text-white font-medium">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {'comparison' in report && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Vergleich zum Vormonat</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-surface-400 text-sm">Einnahmen-Änderung</p>
                  <p className={`text-lg font-bold ${report.comparison.change.incomePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {report.comparison.change.incomePercent >= 0 ? '+' : ''}{report.comparison.change.incomePercent}%
                  </p>
                </div>
                <div>
                  <p className="text-surface-400 text-sm">Ausgaben-Änderung</p>
                  <p className={`text-lg font-bold ${report.comparison.change.expensesPercent <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {report.comparison.change.expensesPercent >= 0 ? '+' : ''}{report.comparison.change.expensesPercent}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center text-surface-400">Keine Daten für diesen Zeitraum.</div>
      )}
    </div>
  );
}
