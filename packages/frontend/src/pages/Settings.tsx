import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Shield,
  Bell,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Copy,
  Palette,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Card, Btn, Field, PageHead, Tag, Avatar } from '@/components/ui';

type Tab = 'profile' | 'security' | 'notifications' | 'appearance';

const tabs: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'security', label: 'Sicherheit', icon: Shield },
  { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
  { id: 'appearance', label: 'Darstellung', icon: Palette },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="space-y-5">
      <PageHead title="Einstellungen" sub="Verwalte dein Profil und deine Einstellungen" />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2.5 whitespace-nowrap rounded-md border border-transparent px-3 py-2.5 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-soft text-indigo'
                  : 'text-ink-2 hover:bg-soft hover:text-ink',
              )}
              style={activeTab === tab.id ? { borderColor: 'var(--line)' } : undefined}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 animate-fade-in">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch('/users/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      toast.success('Profil aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/users/account'),
    onSuccess: () => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    },
  });

  const fullName = `${form.firstName} ${form.lastName}`.trim() || form.email;

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={fullName} size={64} />
          <div>
            <h3 className="text-lg font-bold text-ink">{fullName || 'Profil'}</h3>
            <p className="text-sm text-ink-3">{form.email}</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(form);
          }}
          className="grid max-w-2xl gap-4 sm:grid-cols-2"
        >
          <Field label="Vorname">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="input"
              placeholder="Max"
            />
          </Field>
          <Field label="Nachname">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="input"
              placeholder="Mustermann"
            />
          </Field>
          <Field label="E-Mail" required className="sm:col-span-2">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Btn type="submit" variant="grad" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Speichern
            </Btn>
          </div>
        </form>
      </Card>

      <Card style={{ borderColor: 'var(--neg)' }}>
        <h3 className="mb-1 text-lg font-bold text-neg">Gefahrenzone</h3>
        <p className="mb-4 text-sm text-ink-3">
          Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht.
        </p>
        <Btn
          variant="danger"
          icon={Trash2}
          onClick={() => {
            if (confirm('Bist du sicher? Alle Daten werden unwiderruflich gelöscht!')) {
              deleteAccountMutation.mutate();
            }
          }}
        >
          Konto löschen
        </Btn>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/users/change-password', data),
    onSuccess: () => {
      toast.success('Passwort geändert');
      setShowPasswordForm(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: () => toast.error('Fehler beim Ändern des Passworts'),
  });

  const generate2faMutation = useMutation({
    mutationFn: () => api.get('/auth/2fa/generate').then((r) => r.data),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
    },
  });

  const enable2faMutation = useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/enable', { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setQrCode(null);
      setTotpSecret(null);
      setVerifyCode('');
      toast.success('2FA aktiviert');
    },
    onError: () => toast.error('Ungültiger Code'),
  });

  const disable2faMutation = useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/disable', { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      toast.success('2FA deaktiviert');
    },
    onError: () => toast.error('Ungültiger Code'),
  });

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Passwort ändern</h3>
            <p className="text-sm text-ink-3">Aktualisiere dein Anmeldepasswort regelmäßig.</p>
          </div>
          {!showPasswordForm && (
            <Btn variant="ghost" onClick={() => setShowPasswordForm(true)}>
              Ändern
            </Btn>
          )}
        </div>

        {showPasswordForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                toast.error('Passwörter stimmen nicht überein');
                return;
              }
              if (passwordForm.newPassword.length < 8) {
                toast.error('Passwort muss mindestens 8 Zeichen lang sein');
                return;
              }
              passwordMutation.mutate({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
              });
            }}
            className="max-w-md space-y-4 animate-fade-in"
          >
            <Field label="Aktuelles Passwort">
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                  aria-label="Passwort anzeigen"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Neues Passwort">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input"
                required
                minLength={8}
              />
            </Field>
            <Field label="Neues Passwort bestätigen">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="input"
                required
              />
            </Field>
            <div className="flex gap-3">
              <Btn type="submit" variant="grad" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Speichern'
                )}
              </Btn>
              <Btn type="button" variant="ghost" onClick={() => setShowPasswordForm(false)}>
                Abbrechen
              </Btn>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Zwei-Faktor-Authentifizierung</h3>
            <p className="text-sm text-ink-3">
              Schütze dein Konto mit einem zusätzlichen Sicherheitscode.
            </p>
          </div>
          <Tag variant={user?.twoFactorEnabled ? 'pos' : 'default'}>
            {user?.twoFactorEnabled ? 'Aktiv' : 'Inaktiv'}
          </Tag>
        </div>

        {!user?.twoFactorEnabled && !qrCode && (
          <Btn
            variant="grad"
            icon={Shield}
            onClick={() => generate2faMutation.mutate()}
            disabled={generate2faMutation.isPending}
          >
            {generate2faMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '2FA aktivieren'
            )}
          </Btn>
        )}

        {qrCode && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-ink-2">
              Scanne diesen QR-Code mit deiner Authenticator-App (z. B. Google Authenticator, Authy).
            </p>
            <div className="w-fit rounded-lg bg-white p-4">
              <img src={qrCode} alt="2FA QR Code" className="h-48 w-48" />
            </div>
            {totpSecret && (
              <div className="flex items-center gap-2">
                <code className="rounded-md bg-soft px-3 py-2 font-mono text-xs text-ink-2">
                  {totpSecret}
                </code>
                <button
                  aria-label="Secret in Zwischenablage kopieren"
                  onClick={() => {
                    navigator.clipboard.writeText(totpSecret);
                    toast.success('Secret kopiert');
                  }}
                  className="text-ink-3 hover:text-ink"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex max-w-xs items-center gap-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-stelliger Code"
                className="input text-center font-mono tracking-widest"
                maxLength={6}
              />
              <Btn
                variant="grad"
                onClick={() => enable2faMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || enable2faMutation.isPending}
              >
                {enable2faMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Bestätigen'
                )}
              </Btn>
            </div>
          </div>
        )}

        {user?.twoFactorEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">
              2FA ist aktiv. Gib deinen aktuellen Code ein, um 2FA zu deaktivieren.
            </p>
            <div className="flex max-w-xs items-center gap-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-stelliger Code"
                className="input text-center font-mono tracking-widest"
                maxLength={6}
              />
              <Btn
                variant="danger"
                onClick={() => disable2faMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || disable2faMutation.isPending}
              >
                {disable2faMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Deaktivieren'
                )}
              </Btn>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 text-lg font-bold text-ink">Aktive Sitzungen</h3>
        <p className="mb-4 text-sm text-ink-3">Verwalte deine aktiven Anmeldesitzungen.</p>
        <div
          className="flex items-center justify-between rounded-md p-4"
          style={{ background: 'var(--bg-soft)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-pos" />
            <div>
              <p className="text-sm font-semibold text-ink">Aktuelle Sitzung</p>
              <p className="text-xs text-ink-3">Dieses Gerät</p>
            </div>
          </div>
          <Tag variant="pos">Aktiv</Tag>
        </div>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  const [settings, setSettings] = useState({
    budgetWarnings: true,
    newTransactions: true,
    weeklyReport: true,
    monthlyReport: true,
    unusualActivity: true,
    savingsGoals: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success('Einstellung gespeichert');
  };

  const notificationOptions = [
    {
      key: 'budgetWarnings' as const,
      label: 'Budget-Warnungen',
      description: 'Benachrichtigung wenn 80 % oder 100 % eines Budgets erreicht sind',
    },
    {
      key: 'newTransactions' as const,
      label: 'Neue Transaktionen',
      description: 'Benachrichtigung bei neuen Kontobewegungen',
    },
    {
      key: 'weeklyReport' as const,
      label: 'Wöchentlicher Bericht',
      description: 'Zusammenfassung deiner wöchentlichen Ausgaben',
    },
    {
      key: 'monthlyReport' as const,
      label: 'Monatlicher Bericht',
      description: 'Detaillierter Monatsbericht per E-Mail',
    },
    {
      key: 'unusualActivity' as const,
      label: 'Ungewöhnliche Aktivitäten',
      description: 'Warnung bei auffällig hohen oder ungewöhnlichen Ausgaben',
    },
    {
      key: 'savingsGoals' as const,
      label: 'Sparziel-Updates',
      description: 'Fortschrittsbenachrichtigungen für deine Sparziele',
    },
  ];

  return (
    <Card className="!p-0">
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--line-2)' }}>
        <h3 className="text-lg font-bold text-ink">Benachrichtigungen</h3>
        <p className="mt-0.5 text-sm text-ink-3">Wähle, worüber wir dich informieren sollen.</p>
      </div>
      <div>
        {notificationOptions.map((opt, i) => (
          <div
            key={opt.key}
            className={cn(
              'flex items-center justify-between gap-4 px-5 py-4',
              i < notificationOptions.length - 1 && 'border-b',
            )}
            style={
              i < notificationOptions.length - 1 ? { borderColor: 'var(--line-2)' } : undefined
            }
          >
            <div>
              <p className="text-sm font-semibold text-ink">{opt.label}</p>
              <p className="mt-0.5 text-xs text-ink-3">{opt.description}</p>
            </div>
            <label
              className="inline-flex shrink-0 cursor-pointer items-center"
              title={settings[opt.key] ? 'Aus' : 'An'}
            >
              <input
                type="checkbox"
                checked={settings[opt.key]}
                onChange={() => toggleSetting(opt.key)}
                className="peer sr-only"
                aria-label={opt.label}
              />
              <div
                className={cn(
                  'relative h-6 w-11 rounded-pill transition-colors',
                  settings[opt.key] ? 'bg-indigo' : 'bg-sunken',
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                    settings[opt.key] ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </div>
            </label>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AppearanceTab() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.set);

  return (
    <Card>
      <h3 className="mb-1 text-lg font-bold text-ink">Theme</h3>
      <p className="mb-4 text-sm text-ink-3">
        Wähle das Erscheinungsbild der App. Wird auf diesem Gerät gespeichert.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeOption
          active={theme === 'light'}
          onClick={() => setTheme('light')}
          icon={Sun}
          label="Hell"
          description="Helle Oberfläche, ideal bei viel Tageslicht."
        />
        <ThemeOption
          active={theme === 'dark'}
          onClick={() => setTheme('dark')}
          icon={Moon}
          label="Dunkel"
          description="Dunkle Oberfläche, schont die Augen am Abend."
        />
      </div>
    </Card>
  );
}

function ThemeOption({
  active,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sun;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-md border-2 p-4 text-left transition-all',
        active ? 'border-peach bg-soft' : 'border-line bg-elev hover:bg-soft',
      )}
    >
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-md',
          active ? 'bg-peach text-navy' : 'bg-soft text-ink-2',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{label}</span>
          {active && <Tag variant="accent">Aktiv</Tag>}
        </div>
        <p className="mt-0.5 text-xs text-ink-3">{description}</p>
      </div>
    </button>
  );
}
