import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck, Lock, ServerCog } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { Btn, Field } from '@/components/ui';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password, twoFactorCode || undefined);
      toast.success('Willkommen zurück!');
    } catch (err: unknown) {
      const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (axiosMessage === '2FA-Code erforderlich') {
        setShow2FA(true);
        toast('Bitte 2FA-Code eingeben', { icon: '🔐' });
      } else {
        const message = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
        toast.error(axiosMessage || message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand hero */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-14 text-white lg:flex"
        style={{ background: 'var(--grad-hero)' }}
      >
        <div
          className="pointer-events-none absolute -bottom-1/2 -right-1/3 h-[600px] w-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle at center, rgba(255,177,122,.55), transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-md bg-grad-brand font-extrabold"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}
          >
            O
          </div>
          <span className="h-display text-2xl">Orynthia</span>
        </div>

        <div className="relative max-w-md">
          <p className="h-display text-[2.4rem] leading-[1.15]">
            Finanzen,
            <br />
            die einfach <span style={{ color: 'var(--peach-2)' }}>passen</span>.
          </p>
          <p className="mt-4 text-[0.95rem] opacity-85">
            Behalte deine Konten, Budgets und Sparziele im Blick — vertrauenswürdig wie ein Privatbank-Cockpit.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-4 text-[0.78rem] opacity-85">
          <TrustBadge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="PSD2-konform" />
          <TrustBadge icon={<Lock className="h-3.5 w-3.5" />} label="256-bit Verschlüsselung" />
          <TrustBadge icon={<ServerCog className="h-3.5 w-3.5" />} label="Hosting in DE" />
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-bg p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className="grid h-10 w-10 place-items-center rounded-md bg-grad-brand font-extrabold text-white"
              style={{ boxShadow: '0 4px 12px rgba(66,71,105,.18)' }}
            >
              O
            </div>
            <span className="h-display text-2xl text-ink">Orynthia</span>
          </div>

          <h2 className="h-page m-0 mb-1">Willkommen zurück</h2>
          <p className="mb-6 text-sm text-ink-3">Melde dich an, um deine Finanzen zu verwalten.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-Mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="deine@email.de"
                required
                autoFocus
              />
            </Field>

            <Field label="Passwort">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                  aria-label="Passwort anzeigen"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-ink-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-indigo"
                />
                Angemeldet bleiben
              </label>
              <a href="#" className="text-indigo hover:underline">
                Passwort vergessen?
              </a>
            </div>

            {show2FA && (
              <Field label="2FA-Code">
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </Field>
            )}

            <Btn type="submit" variant="grad" disabled={loading} className="w-full justify-center">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anmelden'}
            </Btn>
          </form>

          <p className="mt-5 text-center text-sm text-ink-3">
            Noch kein Konto?{' '}
            <Link to="/register" className="font-semibold text-indigo hover:underline">
              Jetzt registrieren
            </Link>
          </p>

          <div
            className="mt-6 rounded-md border border-line p-4 text-center"
            style={{ background: 'var(--bg-soft)' }}
          >
            <p className="text-xs text-ink-3">
              Demo-Zugang: <span className="text-ink-2 font-mono">demo@orynthia.local</span> /{' '}
              <span className="text-ink-2 font-mono">demo1234</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5"
      style={{ background: 'rgba(255,255,255,.1)' }}
    >
      {icon}
      {label}
    </span>
  );
}
