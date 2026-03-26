import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedExpensesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Users, Plus, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function SharedExpensesPage() {
  const qc = useQueryClient();
  const [showHouseholdForm, setShowHouseholdForm] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [memberNames, setMemberNames] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState<string | null>(null);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(0);

  const { data: households, isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => sharedExpensesApi.getHouseholds().then((r) => r.data),
  });

  const createHousehold = useMutation({
    mutationFn: () => sharedExpensesApi.createHousehold({
      name: householdName,
      memberNames: memberNames.split(',').map(n => n.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      setShowHouseholdForm(false);
      setHouseholdName('');
      setMemberNames('');
      toast.success('Haushalt erstellt');
    },
  });

  const createExpense = useMutation({
    mutationFn: (householdId: string) => sharedExpensesApi.createExpense({
      householdId,
      description: expenseDesc,
      amount: expenseAmount,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      setShowExpenseForm(null);
      setExpenseDesc('');
      setExpenseAmount(0);
      toast.success('Ausgabe hinzugefügt');
    },
  });

  const settleMutation = useMutation({
    mutationFn: (shareId: string) => sharedExpensesApi.settle(shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      toast.success('Beglichen');
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-brand-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-brand-400" /> Gemeinsame Ausgaben
        </h1>
        <button onClick={() => setShowHouseholdForm(!showHouseholdForm)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Neuer Haushalt
        </button>
      </div>

      {showHouseholdForm && (
        <form onSubmit={(e) => { e.preventDefault(); createHousehold.mutate(); }} className="card p-6 space-y-4 max-w-lg">
          <div>
            <label className="label">Haushalt-Name</label>
            <input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} className="input" placeholder="z.B. WG Hauptstraße" required />
          </div>
          <div>
            <label className="label">Mitglieder (kommagetrennt)</label>
            <input value={memberNames} onChange={(e) => setMemberNames(e.target.value)} className="input" placeholder="Max, Anna, Lukas" />
          </div>
          <button type="submit" disabled={createHousehold.isPending} className="btn-primary">
            {createHousehold.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erstellen'}
          </button>
        </form>
      )}

      {households && households.length === 0 && (
        <div className="card p-12 text-center text-surface-400">
          Erstelle einen Haushalt, um gemeinsame Ausgaben zu teilen.
        </div>
      )}

      {households?.map((hh) => (
        <div key={hh.id} className="card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">{hh.name}</h2>
            <div className="flex gap-2">
              <span className="text-sm text-surface-400">{hh.members.length} Mitglieder</span>
              <button onClick={() => setShowExpenseForm(showExpenseForm === hh.id ? null : hh.id)} className="text-brand-400 text-sm hover:underline">
                + Ausgabe
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="flex gap-2 flex-wrap">
            {hh.members.map((m) => (
              <span key={m.id} className="px-3 py-1 rounded-full bg-surface-800 text-surface-300 text-sm">
                {m.name} {m.role === 'ADMIN' && <span className="text-brand-400">★</span>}
              </span>
            ))}
          </div>

          {/* Add expense form */}
          {showExpenseForm === hh.id && (
            <form onSubmit={(e) => { e.preventDefault(); createExpense.mutate(hh.id); }} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Beschreibung</label>
                <input value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} className="input" placeholder="z.B. Einkauf" required />
              </div>
              <div className="w-32">
                <label className="label">Betrag</label>
                <input type="number" value={expenseAmount || ''} onChange={(e) => setExpenseAmount(Number(e.target.value))} className="input" step="0.01" required />
              </div>
              <button type="submit" disabled={createExpense.isPending} className="btn-primary">
                {createExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Hinzufügen'}
              </button>
            </form>
          )}

          {/* Recent expenses */}
          {hh.expenses && hh.expenses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-surface-400">Letzte Ausgaben</h3>
              {hh.expenses.slice(0, 10).map((exp) => (
                <div key={exp.id} className="flex justify-between items-center text-sm border-b border-surface-800 py-2">
                  <div>
                    <span className="text-surface-300">{exp.description}</span>
                    <span className="text-surface-500 ml-2">{new Date(exp.date).toLocaleDateString('de-DE')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{formatCurrency(Number(exp.amount))}</span>
                    <div className="flex gap-1">
                      {exp.shares?.map((share) => (
                        <button
                          key={share.id}
                          onClick={() => !share.isSettled && settleMutation.mutate(share.id)}
                          className={`text-xs px-2 py-0.5 rounded ${share.isSettled ? 'bg-green-900/30 text-green-400' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
                          disabled={share.isSettled}
                          title={`${share.member?.name || 'Mitglied'}: ${formatCurrency(Number(share.amount))}`}
                        >
                          {share.isSettled ? <CheckCircle className="h-3 w-3" /> : formatCurrency(Number(share.amount))}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
