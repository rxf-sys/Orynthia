import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-brand-950 via-surface-950 to-surface-900 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Finanzguru</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Deine Finanzen.<br />
            <span className="text-brand-400">Unter Kontrolle.</span>
          </h1>
          <p className="text-lg text-surface-400 max-w-md">
            Verbinde deine Bankkonten, analysiere deine Ausgaben und erreiche deine finanziellen Ziele.
          </p>
        </div>

        <p className="text-sm text-surface-600">
          © 2025 Finanzguru. Sicher & DSGVO-konform.
        </p>
      </div>

      {/* Right - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-surface-950 p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Finanzguru</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Anmelden</h2>
            <p className="mt-2 text-surface-400">
              Melde dich an, um deine Finanzen zu verwalten.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="deine@email.de"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Passwort</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {show2FA && (
              <div className="animate-slide-up">
                <label className="label">2FA-Code</label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input font-mono text-center tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anmelden'}
            </button>
          </form>

          <p className="text-center text-sm text-surface-400">
            Noch kein Konto?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Jetzt registrieren
            </Link>
          </p>

          {/* Demo Login Hint */}
          <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
            <p className="text-xs text-surface-500 text-center">
              Demo-Zugang: <span className="text-surface-300">demo@finanzguru.local</span> / <span className="text-surface-300">demo1234</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
