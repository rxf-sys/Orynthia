import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck, Lock, ServerCog } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { parseApiError } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Btn, Field } from '@/components/ui';

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error('Bitte akzeptiere die AGB');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      toast.success('Konto erfolgreich erstellt!');
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Registrierung fehlgeschlagen'));
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand hero */}
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
            Starte deinen
            <br />
            <span style={{ color: 'var(--peach-2)' }}>Finanzüberblick</span>.
          </p>
          <p className="mt-4 text-[0.95rem] opacity-85">
            In wenigen Schritten zum vollständigen Bild deiner Finanzen.
          </p>
          <ol className="mt-6 space-y-2 text-[0.92rem]">
            <Step n={1} active>Konto anlegen</Step>
            <Step n={2}>Bankkonten verbinden</Step>
            <Step n={3}>Loslegen & sparen</Step>
          </ol>
        </div>

        <div className="relative flex flex-wrap gap-4 text-[0.78rem] opacity-85">
          <TrustBadge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="PSD2-konform" />
          <TrustBadge icon={<Lock className="h-3.5 w-3.5" />} label="256-bit Verschlüsselung" />
          <TrustBadge icon={<ServerCog className="h-3.5 w-3.5" />} label="Hosting in DE" />
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-bg p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className="grid h-10 w-10 place-items-center rounded-md bg-grad-brand font-extrabold text-white"
              style={{ boxShadow: '0 4px 12px rgba(66,71,105,.18)' }}
            >
              O
            </div>
            <span className="h-display text-2xl text-ink">Orynthia</span>
          </div>

          <h2 className="h-page m-0 mb-1">Konto erstellen</h2>
          <p className="mb-6 text-sm text-ink-3">
            Starte mit deinem persönlichen Finanzmanagement.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={loading} className="contents space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorname">
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  className="input"
                  placeholder="Max"
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Nachname">
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  className="input"
                  placeholder="Mustermann"
                  autoComplete="family-name"
                />
              </Field>
            </div>

            <Field label="E-Mail" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input"
                placeholder="deine@email.de"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Passwort" required hint="Mindestens 8 Zeichen.">
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>

            <Field
              label="Passwort bestätigen"
              required
              error={passwordMismatch ? 'Passwörter stimmen nicht überein' : undefined}
            >
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className="input"
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
                required
              />
            </Field>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line accent-indigo"
              />
              <span>
                Ich akzeptiere die <a href="#" className="font-semibold text-indigo hover:underline">AGB</a> und die <a href="#" className="font-semibold text-indigo hover:underline">Datenschutzerklärung</a>.
              </span>
            </label>

            <Btn
              type="submit"
              variant="grad"
              disabled={loading || passwordMismatch}
              className="w-full justify-center"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Konto erstellen'}
            </Btn>
            </fieldset>
          </form>

          <p className="mt-5 text-center text-sm text-ink-3">
            Bereits ein Konto?{' '}
            <Link to="/login" className="font-semibold text-indigo hover:underline">
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, active, children }: { n: number; active?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-bold"
        style={{
          background: active ? 'var(--peach)' : 'rgba(255,255,255,.15)',
          color: active ? 'var(--navy)' : 'rgba(255,255,255,.85)',
        }}
      >
        {n}
      </span>
      <span style={{ opacity: active ? 1 : 0.7 }}>{children}</span>
    </li>
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
