import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  X,
  Loader2,
  Building2,
  CreditCard,
  PiggyBank,
  TrendingUp,
  RefreshCw,
  Link2,
  Search,
  Pencil,
  Landmark,
  Wallet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { accountsApi, bankingApi } from '@/lib/api';
import { formatCurrency, cn, parseDecimal, parseApiError } from '@/lib/utils';
import type { BankAccount, CreateAccountData } from '@/lib/types';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Btn,
  Field,
  PageHead,
  Modal,
  EmptyState,
  useConfirm,
  pickCategoryColor,
} from '@/components/ui';

const accountTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  CHECKING: { label: 'Girokonto', icon: <Building2 className="h-5 w-5" /> },
  SAVINGS: { label: 'Sparkonto', icon: <PiggyBank className="h-5 w-5" /> },
  CREDIT_CARD: { label: 'Kreditkarte', icon: <CreditCard className="h-5 w-5" /> },
  DEPOT: { label: 'Depot', icon: <TrendingUp className="h-5 w-5" /> },
  LOAN: { label: 'Kredit / Darlehen', icon: <Landmark className="h-5 w-5" /> },
  OTHER: { label: 'Sonstiges', icon: <Wallet className="h-5 w-5" /> },
};

const accountTypeOptions: { value: BankAccount['accountType']; label: string }[] = [
  { value: 'CHECKING', label: 'Girokonto' },
  { value: 'SAVINGS', label: 'Sparkonto' },
  { value: 'CREDIT_CARD', label: 'Kreditkarte' },
  { value: 'DEPOT', label: 'Depot' },
  { value: 'LOAN', label: 'Kredit / Darlehen' },
  { value: 'OTHER', label: 'Sonstiges' },
];

type Tab = 'manual' | 'bank';

export function AccountsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('bank');
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [sortBy, setSortBy] = useState<'balance-desc' | 'balance-asc' | 'name' | 'type'>('balance-desc');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [form, setForm] = useState({
    bankName: '',
    accountName: '',
    iban: '',
    accountType: 'CHECKING',
    balance: '',
  });
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string; logo?: string } | null>(null);

  // Banking-Callback-State: nach Redirect von der Bank wird hier die Status-UI gezeigt.
  type CallbackState =
    | { phase: 'idle' }
    | { phase: 'connecting' }
    | { phase: 'success'; message: string; accountsCount: number }
    | { phase: 'error'; message: string };
  const [callback, setCallback] = useState<CallbackState>({ phase: 'idle' });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then((r) => r.data),
  });

  const { data: balanceData } = useQuery({
    queryKey: ['accounts-balance'],
    queryFn: () => accountsApi.getBalance().then((r) => r.data),
  });

  const {
    data: institutions,
    isLoading: loadingBanks,
    isError: institutionsError,
    error: institutionsErrorObj,
  } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => bankingApi.getInstitutions('DE').then((r) => r.data),
    enabled: showForm && activeTab === 'bank',
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const code = searchParams.get('code');
    const bankConnected = searchParams.get('bankConnected');
    if (!code && bankConnected !== 'true') return;

    // URL sofort säubern, damit der Effect nicht bei Rerender erneut feuert.
    setSearchParams({}, { replace: true });
    setCallback({ phase: 'connecting' });

    (async () => {
      try {
        const conns = await bankingApi.getConnections();
        const latest = conns.data?.[0];
        if (!latest?.externalConnectionId) {
          setCallback({
            phase: 'error',
            message: 'Keine offene Bank-Verbindung gefunden. Bitte erneut starten.',
          });
          return;
        }
        const res = await bankingApi.handleCallback(latest.externalConnectionId, code || undefined);
        const accountsCount = res.data?.accounts?.length ?? 0;
        setCallback({
          phase: 'success',
          message: res.data?.message || `${accountsCount} Konto(en) importiert`,
          accountsCount,
        });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
        queryClient.invalidateQueries({ queryKey: ['bank-connections'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } catch (err: unknown) {
        setCallback({
          phase: 'error',
          message: parseApiError(
            err,
            'Konten konnten nicht importiert werden. Der Authorization-Code ist evtl. abgelaufen oder bereits verwendet.',
          ),
        });
      }
    })();
  }, [searchParams, setSearchParams, queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountData) => accountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      setShowForm(false);
      setForm({ bankName: '', accountName: '', iban: '', accountType: 'CHECKING', balance: '' });
      setBalanceError(null);
      toast.success('Konto hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Hinzufügen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAccountData> }) =>
      accountsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-balance'] });
      setEditing(null);
      toast.success('Konto aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
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

  const filteredInstitutions =
    institutions?.filter((inst) => inst.name.toLowerCase().includes(bankSearch.toLowerCase())) || [];

  const hasConnectedAccounts = accounts?.some((acc: BankAccount) => acc.lastSynced);
  const totalBalance = balanceData?.totalBalance ?? 0;
  const assets = (accounts || [])
    .filter((a: BankAccount) => Number(a.balance) >= 0)
    .reduce((s: number, a: BankAccount) => s + Number(a.balance), 0);
  const liabilities = (accounts || [])
    .filter((a: BankAccount) => Number(a.balance) < 0)
    .reduce((s: number, a: BankAccount) => s + Number(a.balance), 0);

  const sortedAccounts = (() => {
    const list = [...(accounts || [])];
    const filtered = typeFilter ? list.filter((a) => a.accountType === typeFilter) : list;
    const compare = (a: BankAccount, b: BankAccount) => {
      switch (sortBy) {
        case 'balance-desc':
          return Number(b.balance) - Number(a.balance);
        case 'balance-asc':
          return Number(a.balance) - Number(b.balance);
        case 'name':
          return a.bankName.localeCompare(b.bankName);
        case 'type':
          return a.accountType.localeCompare(b.accountType);
        default:
          return 0;
      }
    };
    return filtered.sort(compare);
  })();

  // Während Banking-Callback läuft: Vollbild-Status-Page statt Konten-Liste.
  if (callback.phase !== 'idle') {
    return <BankingCallbackPage state={callback} onDismiss={() => setCallback({ phase: 'idle' })} />;
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Konten"
        sub={`${accounts?.length ?? 0} Konten verwaltet`}
        actions={
          <>
            {hasConnectedAccounts && (
              <Btn
                variant="ghost"
                icon={RefreshCw}
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
              >
                {syncAllMutation.isPending ? 'Syncing…' : 'Sync'}
              </Btn>
            )}
            <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Abbrechen' : 'Konto hinzufügen'}
            </Btn>
          </>
        }
      />

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Nettovermögen" value={totalBalance} accent />
        <KpiTile label="Vermögen" value={assets} positive />
        <KpiTile label="Verbindlichkeiten" value={liabilities} negative />
        <KpiTile label="Aktive Konten" value={accounts?.length || 0} isNumber />
      </div>

      {/* Form */}
      {showForm && (
        <Card
          className="animate-fade-in"
          style={{
            borderStyle: 'dashed',
            borderColor: 'var(--peach)',
            background: 'rgba(255,177,122,.05)',
          }}
        >
          <div className="mb-5 flex gap-1 rounded-pill border border-line bg-soft p-1">
            <button
              onClick={() => setActiveTab('bank')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition',
                activeTab === 'bank' ? 'bg-elev text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              <Link2 className="h-4 w-4" />
              Bank verbinden
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-pill px-4 py-2 text-sm font-semibold transition',
                activeTab === 'manual' ? 'bg-elev text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              <Plus className="h-4 w-4" />
              Manuell
            </button>
          </div>

          {activeTab === 'bank' && (
            <div>
              <h3 className="mb-1 text-lg font-bold text-ink">Bank verbinden</h3>
              <p className="mb-4 text-sm text-ink-3">
                Verbinde dein Bankkonto per Open Banking (PSD2). Transaktionen und Kontostände werden automatisch synchronisiert.
              </p>

              {selectedBank ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-md border border-line bg-soft p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo/10 text-indigo">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{selectedBank.name}</p>
                      <p className="text-xs text-ink-3">Weiterleitung zur Bank-Authentifizierung</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Btn
                      variant="grad"
                      icon={connectMutation.isPending ? undefined : Link2}
                      onClick={() => connectMutation.mutate(selectedBank.id)}
                      disabled={connectMutation.isPending}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Jetzt verbinden'
                      )}
                    </Btn>
                    <Btn variant="ghost" onClick={() => setSelectedBank(null)}>
                      Andere Bank
                    </Btn>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    <input
                      type="text"
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      placeholder="Bank suchen (z. B. Sparkasse, DKB, ING…)"
                      className="input pl-10"
                      autoFocus
                    />
                  </div>
                  {loadingBanks ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
                    </div>
                  ) : institutionsError ? (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                      <p className="font-semibold">Banken konnten nicht geladen werden</p>
                      <p className="mt-1 text-red-300/80">
                        {parseApiError(
                          institutionsErrorObj,
                          'Prüfe ENABLE_BANKING_APP_ID und ENABLE_BANKING_PRIVATE_KEY in der .env, danach Backend neu starten.',
                        )}
                      </p>
                    </div>
                  ) : (institutions?.length ?? 0) === 0 ? (
                    <p className="py-4 text-center text-sm text-ink-3">
                      Keine Banken verfügbar – ist die Enable-Banking-App freigeschaltet?
                    </p>
                  ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {filteredInstitutions.slice(0, 50).map((inst) => (
                        <button
                          key={inst.id}
                          onClick={() => setSelectedBank(inst)}
                          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-soft"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo/10 text-indigo">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="text-sm text-ink">{inst.name}</span>
                        </button>
                      ))}
                      {filteredInstitutions.length === 0 && bankSearch && (
                        <p className="py-4 text-center text-sm text-ink-3">
                          Keine Bank gefunden für „{bankSearch}". {institutions?.length} Banken insgesamt verfügbar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div>
              <h3 className="mb-4 text-lg font-bold text-ink">Konto manuell hinzufügen</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const balance = form.balance.trim() ? parseDecimal(form.balance) : 0;
                  if (balance === null || !Number.isFinite(balance)) {
                    setBalanceError('Ungültiger Betrag');
                    return;
                  }
                  createMutation.mutate({
                    ...form,
                    balance,
                    accountType: form.accountType as CreateAccountData['accountType'],
                  });
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <fieldset disabled={createMutation.isPending} className="contents">
                <Field label="Bankname" required>
                  <input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="input"
                    placeholder="z. B. Sparkasse"
                    required
                  />
                </Field>
                <Field label="Kontoname" required>
                  <input
                    value={form.accountName}
                    onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                    className="input"
                    placeholder="z. B. Girokonto"
                    required
                  />
                </Field>
                <Field label="IBAN">
                  <input
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                    className="input font-mono"
                    placeholder="DE89 3704 0044 …"
                  />
                </Field>
                <Field label="Kontotyp">
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                    className="select"
                  >
                    {accountTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Aktueller Kontostand" error={balanceError}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.balance}
                    onChange={(e) => {
                      setForm({ ...form, balance: e.target.value });
                      setBalanceError(null);
                    }}
                    className="input tnum"
                    placeholder="0,00"
                  />
                </Field>
                <div className="flex items-end">
                  <Btn type="submit" variant="grad" disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Konto erstellen'
                    )}
                  </Btn>
                </div>
                </fieldset>
              </form>
            </div>
          )}
        </Card>
      )}

      {/* Accounts grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        </div>
      ) : accounts?.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Noch keine Konten hinzugefügt"
          description="Verbinde deine Bank per Open Banking oder lege ein Konto manuell an."
          action={{ label: 'Konto hinzufügen', icon: Plus, onClick: () => setShowForm(true) }}
        />
      ) : (
        <>
          {(accounts?.length ?? 0) > 1 && (
            <Card variant="flat" className="!py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="select w-full sm:w-48"
                  aria-label="Nach Kontotyp filtern"
                >
                  <option value="">Alle Kontotypen</option>
                  {accountTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="select w-full sm:w-56"
                  aria-label="Sortierung"
                >
                  <option value="balance-desc">Saldo (hoch → niedrig)</option>
                  <option value="balance-asc">Saldo (niedrig → hoch)</option>
                  <option value="name">Bankname (A → Z)</option>
                  <option value="type">Kontotyp</option>
                </select>
              </div>
            </Card>
          )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAccounts.map((acc: BankAccount) => {
            const cfg = accountTypeConfig[acc.accountType] || accountTypeConfig.CHECKING;
            const color = pickCategoryColor(acc.bankName);
            const isLinked = !!acc.lastSynced;
            return (
              <div
                key={acc.id}
                className="group overflow-hidden rounded-lg border border-line bg-elev shadow-sm"
              >
                {/* Bank Header */}
                <div
                  className="relative px-5 py-4 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full"
                    style={{ background: 'rgba(255,255,255,.15)' }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="grid h-10 w-10 place-items-center rounded-md font-bold backdrop-blur"
                        style={{ background: 'rgba(255,255,255,.22)' }}
                      >
                        {acc.bankName[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[0.85rem] font-semibold opacity-90">
                          {acc.bankName}
                        </div>
                        <div className="truncate text-[0.78rem] opacity-75">{acc.accountName}</div>
                      </div>
                    </div>
                    <span className="rounded-pill bg-white/20 px-2 py-0.5 text-[0.7rem] font-semibold">
                      {cfg.label}
                    </span>
                  </div>
                  <div className="tnum mt-4 text-[1.7rem] font-bold leading-none">
                    {formatCurrency(Number(acc.balance))}
                  </div>
                  {acc.iban && (
                    <div className="mt-1 font-mono text-[0.72rem] opacity-75">{acc.iban}</div>
                  )}
                </div>
                {/* Body */}
                <div className="flex items-center justify-between p-4">
                  <div className="text-[0.72rem] text-ink-3">
                    {isLinked
                      ? `Sync: ${new Date(acc.lastSynced!).toLocaleDateString('de-DE')}`
                      : 'Manuell verwaltet'}
                  </div>
                  <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    {isLinked && (
                      <button
                        onClick={() => syncMutation.mutate(acc.id)}
                        disabled={syncMutation.isPending}
                        className="rounded p-1.5 text-ink-3 hover:bg-soft hover:text-indigo"
                        title="Konto synchronisieren"
                        aria-label="Konto synchronisieren"
                      >
                        <RefreshCw className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')} />
                      </button>
                    )}
                    {!isLinked && (
                      <button
                        onClick={() => setEditing(acc)}
                        className="rounded p-1.5 text-ink-3 hover:bg-soft hover:text-indigo"
                        title="Konto bearbeiten"
                        aria-label="Konto bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Konto entfernen?',
                          description: `Alle Transaktionen dieses Kontos werden ebenfalls gelöscht. (${acc.bankName} – ${acc.accountName})`,
                          confirmLabel: 'Entfernen',
                          destructive: true,
                        });
                        if (ok) deleteMutation.mutate(acc.id);
                      }}
                      className="rounded p-1.5 text-ink-3 hover:bg-soft hover:text-neg"
                      aria-label="Konto entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          <button
            onClick={() => setShowForm(true)}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-ink-3 transition-colors hover:border-peach hover:bg-soft hover:text-ink"
            style={{ borderColor: 'var(--line)' }}
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-semibold">Bank verbinden</span>
          </button>
        </div>
        </>
      )}

      {editing && (
        <EditAccountModal
          account={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => updateMutation.mutate({ id: editing.id, data })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function EditAccountModal({
  account,
  onClose,
  onSave,
  isPending,
}: {
  account: BankAccount;
  onClose: () => void;
  onSave: (data: Partial<CreateAccountData>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    bankName: account.bankName,
    accountName: account.accountName,
    iban: account.iban || '',
    accountType: account.accountType,
    balance: String(account.balance ?? ''),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Konto bearbeiten"
      description={`${account.bankName} – ${account.accountName}`}
      size="md"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={isPending}>
            Abbrechen
          </Btn>
          <Btn
            variant="grad"
            disabled={isPending}
            onClick={() =>
              onSave({
                bankName: form.bankName,
                accountName: form.accountName,
                iban: form.iban || undefined,
                accountType: form.accountType,
                balance: form.balance === '' ? undefined : Number(form.balance),
              })
            }
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={isPending} className="contents">
        <Field label="Bankname" required>
          <input
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            className="input"
            required
          />
        </Field>
        <Field label="Kontoname" required>
          <input
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            className="input"
            required
          />
        </Field>
        <Field label="IBAN">
          <input
            value={form.iban}
            onChange={(e) => setForm({ ...form, iban: e.target.value })}
            className="input font-mono"
            placeholder="DE89 3704 0044 …"
          />
        </Field>
        <Field label="Kontotyp">
          <select
            value={form.accountType}
            onChange={(e) =>
              setForm({ ...form, accountType: e.target.value as BankAccount['accountType'] })
            }
            className="select"
          >
            {accountTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontostand">
          <input
            type="number"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className="input tnum"
            step="0.01"
          />
        </Field>
        </fieldset>
      </div>
    </Modal>
  );
}

function KpiTile({
  label,
  value,
  positive,
  negative,
  accent,
  isNumber,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  accent?: boolean;
  isNumber?: boolean;
}) {
  let valueColor: string | undefined;
  if (negative) valueColor = 'var(--neg)';
  else if (positive) valueColor = 'var(--pos)';

  return (
    <Card
      className={accent ? 'relative overflow-hidden' : ''}
      style={accent ? { background: 'var(--grad-soft)' } : undefined}
    >
      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {label}
      </div>
      <div className="tnum mt-2 text-[1.85rem] font-bold leading-none" style={{ color: valueColor }}>
        {isNumber ? value : formatCurrency(value)}
      </div>
    </Card>
  );
}

type BankingCallbackState =
  | { phase: 'connecting' }
  | { phase: 'success'; message: string; accountsCount: number }
  | { phase: 'error'; message: string };

function BankingCallbackPage({
  state,
  onDismiss,
}: {
  state: BankingCallbackState;
  onDismiss: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        {state.phase === 'connecting' && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo/10">
              <Loader2 className="h-7 w-7 animate-spin text-indigo" />
            </div>
            <h2 className="text-xl font-semibold text-ink">Verbindung wird hergestellt</h2>
            <p className="mt-2 text-sm text-ink-3">
              Deine Konten und Buchungen der letzten 30 Tage werden importiert. Bitte schließe
              dieses Fenster nicht.
            </p>
            <div className="mt-6 flex justify-center">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo" />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo"
                  style={{ animationDelay: '0.2s' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
            </div>
          </>
        )}

        {state.phase === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-semibold text-ink">Bank erfolgreich verbunden</h2>
            <p className="mt-2 text-sm text-ink-3">{state.message}</p>
            {state.accountsCount > 0 && (
              <p className="mt-1 text-xs text-ink-3">
                Folge-Synchronisationen laufen automatisch alle 6 Stunden.
              </p>
            )}
            <Btn variant="grad" className="mt-6 w-full" onClick={onDismiss}>
              Zu meinen Konten
            </Btn>
          </>
        )}

        {state.phase === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-ink">Verbindung fehlgeschlagen</h2>
            <p className="mt-2 text-sm text-ink-3">{state.message}</p>
            <div className="mt-6 flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={onDismiss}>
                Schließen
              </Btn>
              <Btn variant="grad" className="flex-1" onClick={onDismiss}>
                Erneut versuchen
              </Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
