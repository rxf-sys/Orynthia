import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Building2, CreditCard, PiggyBank, TrendingUp, RefreshCw, Link2, Search } from 'lucide-react';
import { accountsApi, bankingApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { BankAccount, CreateAccountData } from '@/lib/types';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

const accountTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CHECKING: { label: 'Girokonto', icon: <Building2 className="h-5 w-5" />, color: 'text-blue-400 bg-blue-500/10' },
  SAVINGS: { label: 'Sparkonto', icon: <PiggyBank className="h-5 w-5" />, color: 'text-emerald-400 bg-emerald-500/10' },
  CREDIT_CARD: { label: 'Kreditkarte', icon: <CreditCard className="h-5 w-5" />, color: 'text-amber-400 bg-amber-500/10' },
  DEPOT: { label: 'Depot', icon: <TrendingUp className="h-5 w-5" />, color: 'text-purple-400 bg-purple-500/10' },
};

type Tab = 'manual' | 'bank';

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('bank');
  const [form, setForm] = useState({ bankName: '', accountName: '', iban: '', accountType: 'CHECKING', balance: '' });
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string; logo?: string } | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then((r) => r.data),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['accounts-balance'],
    queryFn: () => accountsApi.getBalance().then((r) => r.data),
  });

  const { data: institutions, isLoading: loadingBanks } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => bankingApi.getInstitutions('DE').then((r) => r.data),
    enabled: showForm && activeTab === 'bank',
    staleTime: 5 * 60 * 1000,
  });

  // Callback nach Bank-Authentifizierung
  useEffect(() => {
    const bankConnected = searchParams.get('bankConnected');
    if (bankConnected === 'true') {
      // Letzte Verbindung laden und Callback auslösen
      bankingApi.getConnections().then((r) => {
        const latest = r.data?.[0];
        if (latest?.externalConnectionId) {
          bankingApi.handleCallback(latest.externalConnectionId).then((res) => {
            toast.success(res.data?.message || 'Konten importiert');
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
            queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
          }).catch(() => toast.error('Fehler beim Importieren der Konten'));
        }
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      setShowForm(false);
      setForm({ bankName: '', accountName: '', iban: '', accountType: 'CHECKING', balance: '' });
      toast.success('Konto hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Hinzufügen'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      toast.success('Konto entfernt');
    },
  });

  const connectMutation = useMutation({
    mutationFn: (institutionId: string) => bankingApi.connectBank(institutionId),
    onSuccess: (res) => {
      // Weiterleitung zur Bank-Authentifizierung
      window.location.href = res.data.authUrl;
    },
    onError: () => toast.error('Fehler beim Verbinden mit der Bank'),
  });

  const syncMutation = useMutation({
    mutationFn: (accountId: string) => bankingApi.syncAccount(accountId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const data = res.data;
      toast.success(`${data.newTransactions} neue Transaktionen synchronisiert`);
    },
    onError: () => toast.error('Sync fehlgeschlagen'),
  });

  const syncAllMutation = useMutation({
    mutationFn: () => bankingApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Alle Konten synchronisiert');
    },
    onError: () => toast.error('Sync fehlgeschlagen'),
  });

  const filteredInstitutions = institutions?.filter((inst) =>
    inst.name.toLowerCase().includes(bankSearch.toLowerCase())
  ) || [];

  const hasConnectedAccounts = accounts?.some((acc: BankAccount) => acc.lastSynced);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Konten</h1>
          <p className="text-surface-400 mt-1">
            Gesamtsaldo: <span className="text-white font-semibold">{formatCurrency(balanceData?.totalBalance || 0)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {hasConnectedAccounts && (
            <button
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
              className="btn-ghost"
              title="Alle Konten synchronisieren"
            >
              <RefreshCw className={cn('h-4 w-4', syncAllMutation.isPending && 'animate-spin')} />
              Sync
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Abbrechen' : 'Konto hinzufügen'}
          </button>
        </div>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <div className="card animate-slide-up">
          {/* Tab Toggle */}
          <div className="flex gap-1 bg-surface-800 rounded-xl p-1 mb-6 w-fit">
            <button
              onClick={() => setActiveTab('bank')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === 'bank' ? 'bg-brand-600 text-white' : 'text-surface-400 hover:text-surface-200')}
            >
              <Link2 className="h-4 w-4" />
              Bank verbinden
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === 'manual' ? 'bg-brand-600 text-white' : 'text-surface-400 hover:text-surface-200')}
            >
              <Plus className="h-4 w-4" />
              Manuell
            </button>
          </div>

          {/* Bank Connect Tab */}
          {activeTab === 'bank' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Bank verbinden</h3>
              <p className="text-sm text-surface-400 mb-4">
                Verbinde dein Bankkonto per Open Banking (PSD2). Transaktionen und Kontostände werden automatisch synchronisiert.
              </p>

              {selectedBank ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-surface-800 rounded-xl p-4">
                    {selectedBank.logo && <img src={selectedBank.logo} alt="" className="h-8 w-8 rounded" />}
                    <div>
                      <p className="text-white font-medium">{selectedBank.name}</p>
                      <p className="text-xs text-surface-500">Weiterleitung zur Bank-Authentifizierung</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => connectMutation.mutate(selectedBank.id)}
                      disabled={connectMutation.isPending}
                      className="btn-primary"
                    >
                      {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Jetzt verbinden
                    </button>
                    <button onClick={() => setSelectedBank(null)} className="btn-ghost">
                      Andere Bank
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Bank suchen (z.B. Sparkasse, DKB, ING...)"
                      className="input pl-10"
                      autoFocus
                    />
                  </div>
                  {loadingBanks ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredInstitutions.slice(0, 50).map((inst) => (
                        <button
                          key={inst.id}
                          onClick={() => setSelectedBank(inst)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800 transition-colors text-left"
                        >
                          {inst.logo && <img src={inst.logo} alt="" className="h-6 w-6 rounded" />}
                          <span className="text-sm text-surface-200">{inst.name}</span>
                        </button>
                      ))}
                      {filteredInstitutions.length === 0 && bankSearch && (
                        <p className="text-sm text-surface-500 text-center py-4">Keine Bank gefunden</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Konto manuell hinzufügen</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate({ ...form, balance: Number(form.balance) || 0, accountType: form.accountType as CreateAccountData['accountType'] });
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <label className="label">Bankname *</label>
                  <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="input" placeholder="z.B. Sparkasse" required />
                </div>
                <div>
                  <label className="label">Kontoname *</label>
                  <input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} className="input" placeholder="z.B. Girokonto" required />
                </div>
                <div>
                  <label className="label">IBAN</label>
                  <input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="input" placeholder="DE89 3704 0044 ..." />
                </div>
                <div>
                  <label className="label">Kontotyp</label>
                  <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} className="input">
                    <option value="CHECKING">Girokonto</option>
                    <option value="SAVINGS">Sparkonto</option>
                    <option value="CREDIT_CARD">Kreditkarte</option>
                    <option value="DEPOT">Depot</option>
                  </select>
                </div>
                <div>
                  <label className="label">Aktueller Kontostand</label>
                  <input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="input" placeholder="0.00" step="0.01" />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Konto erstellen'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Account List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : accounts?.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-500">Noch keine Konten hinzugefügt.</p>
          <p className="text-surface-600 text-sm mt-1">Verbinde deine Bank oder erstelle ein Konto manuell.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts?.map((acc: BankAccount) => {
            const config = accountTypeConfig[acc.accountType] || accountTypeConfig.CHECKING;
            const isLinked = !!acc.lastSynced;
            return (
              <div key={acc.id} className="card-hover group">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('rounded-xl p-2.5', config.color)}>
                    {config.icon}
                  </div>
                  <div className="flex items-center gap-1">
                    {isLinked && (
                      <button
                        onClick={() => syncMutation.mutate(acc.id)}
                        disabled={syncMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-brand-400 p-1"
                        title="Konto synchronisieren"
                      >
                        <RefreshCw className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')} />
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm('Konto wirklich entfernen?')) deleteMutation.mutate(acc.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-white">{acc.accountName}</h4>
                <p className="text-sm text-surface-500">{acc.bankName}</p>
                {acc.iban && <p className="text-xs text-surface-600 mt-1 font-mono">{acc.iban}</p>}
                <div className="mt-4 pt-4 border-t border-surface-800">
                  <p className="text-2xl font-bold text-white">{formatCurrency(Number(acc.balance))}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-surface-500">{config.label}</p>
                    {isLinked && (
                      <p className="text-xs text-surface-600">
                        Sync: {new Date(acc.lastSynced!).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
