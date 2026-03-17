import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Shield, Bell, Loader2, Check, Eye, EyeOff, Copy } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'security' | 'notifications';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs = [
    { id: 'profile' as Tab, label: 'Profil', icon: User },
    { id: 'security' as Tab, label: 'Sicherheit', icon: Shield },
    { id: 'notifications' as Tab, label: 'Benachrichtigungen', icon: Bell },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
        <p className="text-surface-400 mt-1">Verwalte dein Profil und deine Einstellungen</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-surface-900 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-surface-800 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-200'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>
    </div>
  );
}

/* ─── Profile Tab ─── */
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

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-6">Persönliche Daten</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(form);
          }}
          className="space-y-4 max-w-lg"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Vorname</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="input"
                placeholder="Max"
              />
            </div>
            <div>
              <label className="label">Nachname</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="input"
                placeholder="Mustermann"
              />
            </div>
          </div>
          <div>
            <label className="label">E-Mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Speichern
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="card border border-red-500/20">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Gefahrenzone</h3>
        <p className="text-sm text-surface-400 mb-4">
          Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht.
        </p>
        <button
          onClick={() => {
            if (confirm('Bist du sicher? Alle Daten werden unwiderruflich gelöscht!')) {
              deleteAccountMutation.mutate();
            }
          }}
          className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
        >
          Konto löschen
        </button>
      </div>
    </div>
  );
}

/* ─── Security Tab ─── */
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
      api.patch('/users/profile', { password: data.newPassword }),
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
    <div className="space-y-6">
      {/* Password Change */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Passwort ändern</h3>
            <p className="text-sm text-surface-400">Ändere dein Anmeldepasswort</p>
          </div>
          {!showPasswordForm && (
            <button onClick={() => setShowPasswordForm(true)} className="btn-ghost text-sm">
              Ändern
            </button>
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
            className="space-y-4 max-w-lg animate-slide-up"
          >
            <div className="relative">
              <label className="label">Aktuelles Passwort</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-[38px] text-surface-500 hover:text-surface-300"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <label className="label">Neues Passwort</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="label">Neues Passwort bestätigen</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="input"
                required
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={passwordMutation.isPending} className="btn-primary">
                {passwordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="btn-ghost"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2FA */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Zwei-Faktor-Authentifizierung</h3>
            <p className="text-sm text-surface-400">
              Schütze dein Konto mit einem zusätzlichen Sicherheitscode
            </p>
          </div>
          <span
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              user?.twoFactorEnabled
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-surface-800 text-surface-400'
            )}
          >
            {user?.twoFactorEnabled ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>

        {!user?.twoFactorEnabled && !qrCode && (
          <button
            onClick={() => generate2faMutation.mutate()}
            disabled={generate2faMutation.isPending}
            className="btn-primary"
          >
            {generate2faMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            2FA aktivieren
          </button>
        )}

        {qrCode && (
          <div className="space-y-4 animate-slide-up">
            <p className="text-sm text-surface-300">
              Scanne diesen QR-Code mit deiner Authenticator-App (z.B. Google Authenticator, Authy):
            </p>
            <div className="bg-white p-4 rounded-xl w-fit">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
            {totpSecret && (
              <div className="flex items-center gap-2">
                <code className="text-xs bg-surface-800 px-3 py-2 rounded-lg text-surface-300 font-mono">
                  {totpSecret}
                </code>
                <button
                  aria-label="Secret in Zwischenablage kopieren"
                  onClick={() => {
                    navigator.clipboard.writeText(totpSecret);
                    toast.success('Secret kopiert');
                  }}
                  className="text-surface-500 hover:text-surface-300"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 max-w-xs">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-stelliger Code"
                className="input font-mono text-center tracking-widest"
                maxLength={6}
              />
              <button
                onClick={() => enable2faMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || enable2faMutation.isPending}
                className="btn-primary shrink-0"
              >
                {enable2faMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bestätigen'}
              </button>
            </div>
          </div>
        )}

        {user?.twoFactorEnabled && (
          <div className="space-y-3">
            <p className="text-sm text-surface-400">
              2FA ist aktiv. Gib deinen aktuellen Code ein, um 2FA zu deaktivieren.
            </p>
            <div className="flex items-center gap-3 max-w-xs">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-stelliger Code"
                className="input font-mono text-center tracking-widest"
                maxLength={6}
              />
              <button
                onClick={() => disable2faMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || disable2faMutation.isPending}
                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors shrink-0"
              >
                {disable2faMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deaktivieren'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Sessions Info */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-2">Aktive Sitzungen</h3>
        <p className="text-sm text-surface-400 mb-4">
          Verwalte deine aktiven Anmeldesitzungen
        </p>
        <div className="bg-surface-800/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <div>
              <p className="text-sm text-surface-200">Aktuelle Sitzung</p>
              <p className="text-xs text-surface-500">Dieses Gerät</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400">Aktiv</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Notifications Tab ─── */
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
      description: 'Benachrichtigung wenn 80% oder 100% eines Budgets erreicht sind',
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
    <div className="card">
      <h3 className="text-lg font-semibold text-white mb-6">Benachrichtigungseinstellungen</h3>
      <div className="space-y-1">
        {notificationOptions.map((opt) => (
          <div
            key={opt.key}
            className="flex items-center justify-between py-4 px-2 rounded-lg hover:bg-surface-800/30 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-surface-200">{opt.label}</p>
              <p className="text-xs text-surface-500 mt-0.5">{opt.description}</p>
            </div>
            <button
              role="switch"
              aria-checked={settings[opt.key]}
              aria-label={opt.label}
              onClick={() => toggleSetting(opt.key)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4',
                settings[opt.key] ? 'bg-brand-500' : 'bg-surface-700'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                  settings[opt.key] ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
