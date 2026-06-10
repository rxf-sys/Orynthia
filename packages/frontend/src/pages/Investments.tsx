import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Trash2,
  LineChart,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { investmentsApi } from '@/lib/api';
import { formatCurrency, parseDecimal } from '@/lib/utils';
import type { CreateInvestmentData, InvestmentPosition, InvestmentType } from '@/lib/types';
import { Card, Btn, Field, PageHead, EmptyState, Modal, useConfirm } from '@/components/ui';

const TYPE_LABELS: Record<InvestmentType, string> = {
  STOCK: 'Aktie',
  ETF: 'ETF',
  FUND: 'Fonds',
  CRYPTO: 'Krypto',
  BOND: 'Anleihe',
  OTHER: 'Sonstiges',
};

const TYPE_ORDER: InvestmentType[] = ['STOCK', 'ETF', 'FUND', 'CRYPTO', 'BOND', 'OTHER'];

// Lokales Datum (YYYY-MM-DD) statt toISOString(), das je nach Zeitzone ±1 Tag abweicht.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function InvestmentsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InvestmentPosition | null>(null);
  const [priceEdit, setPriceEdit] = useState<{ id: string; symbol: string; value: string } | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['investments'],
    queryFn: () => investmentsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateInvestmentData) => investmentsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setShowForm(false);
      toast.success('Position hinzugefügt');
    },
    onError: () => toast.error('Fehler beim Anlegen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInvestmentData> }) =>
      investmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setEditing(null);
      toast.success('Position aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const priceMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => investmentsApi.updatePrice(id, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      setPriceEdit(null);
      setPriceError(null);
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => investmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      toast.success('Position entfernt');
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
      </div>
    );
  }

  const { positions, summary, allocation } = data;

  return (
    <div className="space-y-5">
      <PageHead
        title="Depot"
        sub={`${summary.positionCount} ${summary.positionCount === 1 ? 'Position' : 'Positionen'} · Wertanlagen manuell verwaltet`}
        actions={
          <Btn variant="grad" icon={showForm ? X : Plus} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Abbrechen' : 'Position hinzufügen'}
          </Btn>
        }
      />

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Marktwert
          </div>
          <div className="tnum mt-2 text-[1.85rem] font-bold">
            {formatCurrency(summary.totalValue)}
          </div>
          <div className="mt-1 text-xs text-ink-3 tnum">
            Eingesetzt: {formatCurrency(summary.totalInvested)}
          </div>
        </Card>
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Gewinn / Verlust
          </div>
          <div
            className="tnum mt-2 text-[1.85rem] font-bold"
            style={{ color: summary.totalGainLoss >= 0 ? 'var(--pos)' : 'var(--neg)' }}
          >
            {summary.totalGainLoss >= 0 ? '+' : ''}
            {formatCurrency(summary.totalGainLoss)}
          </div>
          <div
            className="mt-1 text-xs tnum"
            style={{ color: summary.totalGainLoss >= 0 ? 'var(--pos)' : 'var(--neg)' }}
          >
            {summary.totalGainLossPercent >= 0 ? '+' : ''}
            {summary.totalGainLossPercent}%
          </div>
        </Card>
        <Card>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Allokation
          </div>
          {allocation.length === 0 ? (
            <div className="mt-2 text-sm text-ink-3">Noch keine Daten</div>
          ) : (
            <div className="mt-2 space-y-1">
              {allocation.slice(0, 4).map((a) => (
                <div key={a.type} className="flex items-center justify-between text-xs">
                  <span className="text-ink-2">{TYPE_LABELS[a.type]}</span>
                  <span className="tnum font-semibold text-ink">{a.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card variant="soft" style={{ background: 'var(--grad-soft)' }}>
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Hinweis
          </div>
          <p className="mt-2 text-sm text-ink">
            Kurse werden <strong>manuell</strong> gepflegt. Klick auf das <RefreshCw className="inline h-3 w-3" />
            -Symbol, um den aktuellen Preis einer Position zu aktualisieren.
          </p>
        </Card>
      </div>

      {showForm && (
        <PositionForm
          onClose={() => setShowForm(false)}
          onSubmit={(d) => createMutation.mutate(d)}
          isPending={createMutation.isPending}
        />
      )}

      {positions.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Noch keine Wertanlagen erfasst"
          description="Lege deine erste Position an – Aktien, ETFs, Krypto oder andere Anlagen."
          action={{ label: 'Position hinzufügen', icon: Plus, onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-4">
          {TYPE_ORDER.map((type) => {
            const group = positions.filter((p) => p.type === type);
            if (group.length === 0) return null;
            return (
              <Card key={type} className="!p-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-soft px-4 py-2 sm:px-5">
                  <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-ink-2">
                    {TYPE_LABELS[type]} · {group.length}
                  </div>
                  <div className="tnum text-[0.78rem] font-semibold text-ink-3">
                    {formatCurrency(group.reduce((s, p) => s + p.currentValue, 0))}
                  </div>
                </div>
                <div>
                  {group.map((p) => (
                    <PositionRow
                      key={p.id}
                      pos={p}
                      onEdit={() => setEditing(p)}
                      onUpdatePrice={() => {
                        setPriceError(null);
                        setPriceEdit({
                          id: p.id,
                          symbol: p.symbol,
                          value: String(p.currentPrice ?? p.averagePrice),
                        });
                      }}
                      onDelete={async () => {
                        const ok = await confirm({
                          title: 'Position löschen?',
                          description: `${p.symbol} – ${p.name}`,
                          confirmLabel: 'Löschen',
                          destructive: true,
                        });
                        if (ok) deleteMutation.mutate(p.id);
                      }}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <EditPositionModal
          position={editing}
          onClose={() => setEditing(null)}
          onSubmit={(d) => updateMutation.mutate({ id: editing.id, data: d })}
          isPending={updateMutation.isPending}
        />
      )}

      {priceEdit && (
        <Modal
          open
          onClose={() => setPriceEdit(null)}
          title="Kurs aktualisieren"
          description={priceEdit.symbol}
          size="sm"
          footer={
            <>
              <Btn variant="ghost" onClick={() => setPriceEdit(null)} disabled={priceMutation.isPending}>
                Abbrechen
              </Btn>
              <Btn
                variant="grad"
                disabled={priceMutation.isPending}
                onClick={() => {
                  const num = parseDecimal(priceEdit.value);
                  if (num === null || num <= 0) {
                    setPriceError('Ungültiger Betrag');
                    return;
                  }
                  priceMutation.mutate({ id: priceEdit.id, price: num });
                }}
              >
                {priceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
              </Btn>
            </>
          }
        >
          <Field label="Aktueller Kurs" required error={priceError}>
            <input
              type="text"
              inputMode="decimal"
              value={priceEdit.value}
              onChange={(e) => {
                setPriceEdit({ ...priceEdit, value: e.target.value });
                setPriceError(null);
              }}
              className="input tnum"
              autoFocus
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

function PositionRow({
  pos,
  onEdit,
  onUpdatePrice,
  onDelete,
}: {
  pos: InvestmentPosition;
  onEdit: () => void;
  onUpdatePrice: () => void;
  onDelete: () => void;
}) {
  const gain = pos.gainLoss;
  const positive = gain >= 0;
  return (
    <div className="group flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-soft sm:flex-nowrap sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-line bg-elev px-2 py-0.5 text-[0.7rem] font-bold text-ink-2 tnum">
            {pos.symbol}
          </span>
          <div className="truncate text-sm font-semibold text-ink">{pos.name}</div>
        </div>
        <div className="mt-0.5 text-[0.72rem] text-ink-3 tnum">
          {pos.quantity} × {formatCurrency(pos.averagePrice)} Ø
          {pos.currentPrice !== null && ` · aktuell ${formatCurrency(pos.currentPrice)}`}
          {pos.lastPriceUpdate &&
            ` · Stand ${new Date(pos.lastPriceUpdate).toLocaleDateString('de-DE')}`}
        </div>
      </div>
      <div className="w-32 text-right">
        <div className="tnum text-sm font-bold text-ink">{formatCurrency(pos.currentValue)}</div>
        <div
          className="mt-0.5 flex items-center justify-end gap-0.5 text-[0.72rem] tnum"
          style={{ color: positive ? 'var(--pos)' : 'var(--neg)' }}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? '+' : ''}
          {formatCurrency(gain)} ({positive ? '+' : ''}
          {pos.gainLossPercent}%)
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={onUpdatePrice}
          className="rounded p-1.5 text-ink-3 hover:bg-bg hover:text-indigo"
          aria-label="Kurs aktualisieren"
          title="Kurs aktualisieren"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-ink-3 hover:bg-bg hover:text-indigo"
          aria-label="Position bearbeiten"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-ink-3 hover:bg-bg hover:text-neg"
          aria-label="Position löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PositionForm({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (d: CreateInvestmentData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    symbol: '',
    name: '',
    type: 'STOCK' as InvestmentType,
    quantity: '',
    averagePrice: '',
    currentPrice: '',
    currency: 'EUR',
    purchaseDate: todayLocal(),
    notes: '',
  });

  return (
    <Card
      className="animate-fade-in"
      style={{ borderStyle: 'dashed', borderColor: 'var(--peach)', background: 'rgba(255,177,122,.05)' }}
    >
      <h3 className="mb-4 text-lg font-bold text-ink">Neue Position</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const symbol = form.symbol.trim();
          const name = form.name.trim();
          if (!symbol) return toast.error('Bitte Symbol angeben');
          if (!name) return toast.error('Bitte Bezeichnung angeben');
          const q = parseDecimal(form.quantity);
          const avg = Number(form.averagePrice);
          if (q === null || q <= 0) return toast.error('Stückzahl > 0 nötig');
          if (!isFinite(avg) || avg < 0) return toast.error('Kaufpreis muss ≥ 0 sein');
          onSubmit({
            symbol,
            name,
            type: form.type,
            quantity: q,
            averagePrice: avg,
            currentPrice: form.currentPrice ? Number(form.currentPrice) : undefined,
            currency: form.currency,
            purchaseDate: form.purchaseDate || undefined,
            notes: form.notes || undefined,
          });
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <fieldset disabled={isPending} className="contents">
        <Field label="Symbol / Ticker" required>
          <input
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            className="input font-mono"
            placeholder="AAPL"
            required
          />
        </Field>
        <Field label="Bezeichnung" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="Apple Inc."
            required
          />
        </Field>
        <Field label="Typ">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as InvestmentType })}
            className="select"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stückzahl" required>
          <input
            type="text"
            inputMode="decimal"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="input tnum"
            required
          />
        </Field>
        <Field label="Ø Kaufpreis" required>
          <input
            type="number"
            value={form.averagePrice}
            onChange={(e) => setForm({ ...form, averagePrice: e.target.value })}
            className="input tnum"
            step="0.0001"
            min="0"
            required
          />
        </Field>
        <Field label="Aktueller Kurs (optional)">
          <input
            type="number"
            value={form.currentPrice}
            onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
            className="input tnum"
            step="0.0001"
            min="0"
          />
        </Field>
        <Field label="Währung">
          <input
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 4) })}
            className="input font-mono"
            placeholder="EUR"
            maxLength={4}
          />
        </Field>
        <Field label="Kaufdatum">
          <input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            className="input"
          />
        </Field>
        <div className="flex items-end">
          <Btn type="submit" variant="grad" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Position anlegen'}
          </Btn>
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <Btn variant="ghost" type="button" onClick={onClose}>
            Schließen
          </Btn>
        </div>
        </fieldset>
      </form>
    </Card>
  );
}

function EditPositionModal({
  position,
  onClose,
  onSubmit,
  isPending,
}: {
  position: InvestmentPosition;
  onClose: () => void;
  onSubmit: (d: Partial<CreateInvestmentData>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    name: position.name,
    type: position.type,
    quantity: String(position.quantity),
    averagePrice: String(position.averagePrice),
    currentPrice: position.currentPrice !== null ? String(position.currentPrice) : '',
    notes: position.notes ?? '',
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Position bearbeiten"
      description={position.symbol}
      size="md"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={isPending}>
            Abbrechen
          </Btn>
          <Btn
            variant="grad"
            disabled={isPending}
            onClick={() => {
              const q = parseDecimal(form.quantity);
              const avg = Number(form.averagePrice);
              if (q === null || q <= 0) return toast.error('Stückzahl > 0 nötig');
              onSubmit({
                name: form.name,
                type: form.type,
                quantity: q,
                averagePrice: avg,
                currentPrice: form.currentPrice ? Number(form.currentPrice) : undefined,
                notes: form.notes || undefined,
              });
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bezeichnung" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            required
          />
        </Field>
        <Field label="Typ">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as InvestmentType })}
            className="select"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stückzahl">
          <input
            type="text"
            inputMode="decimal"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="input tnum"
          />
        </Field>
        <Field label="Ø Kaufpreis">
          <input
            type="number"
            value={form.averagePrice}
            onChange={(e) => setForm({ ...form, averagePrice: e.target.value })}
            className="input tnum"
            step="0.0001"
            min="0"
          />
        </Field>
        <Field label="Aktueller Kurs">
          <input
            type="number"
            value={form.currentPrice}
            onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
            className="input tnum"
            step="0.0001"
            min="0"
          />
        </Field>
        <Field label="Notizen" className="sm:col-span-2">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input min-h-[80px]"
          />
        </Field>
      </div>
    </Modal>
  );
}
