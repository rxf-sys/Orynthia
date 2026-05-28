import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Btn, Field } from '@/components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Anfrage fehlgeschlagen';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-[400px]">
        <Link to="/login" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Zur Anmeldung
        </Link>
        <h2 className="h-page m-0 mb-1">Passwort vergessen?</h2>
        <p className="mb-6 text-sm text-ink-3">
          Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.
        </p>

        {done ? (
          <div className="rounded-md border border-line bg-soft p-4 text-sm text-ink-2">
            <Mail className="mb-2 h-5 w-5 text-indigo" />
            <p className="font-semibold text-ink">E-Mail unterwegs (sofern Account existiert)</p>
            <p className="mt-1 text-ink-3">
              Prüfe dein Postfach. Der Link ist 60 Minuten gültig. Schau ggf. im Spam-Ordner nach.
            </p>
            <p className="mt-3 text-xs text-ink-3">
              Hinweis: Self-Hosted ohne SMTP-Setup? Dann liegt der Link im Backend-Log
              (<code className="rounded bg-bg px-1">docker logs orynthia-backend</code>).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-Mail" required>
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
            <Btn type="submit" variant="grad" disabled={loading} className="w-full justify-center">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset-Link senden'}
            </Btn>
          </form>
        )}
      </div>
    </div>
  );
}
