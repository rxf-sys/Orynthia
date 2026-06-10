import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import { Btn, Field } from '@/components/ui';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Token einmalig aus der URL sichern, danach wird die URL bereinigt.
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Token aus der URL entfernen, damit er nicht in History/Referer landet.
    if (token) window.history.replaceState(null, '', '/reset-password');
  }, [token]);

  const passwordMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    if (password.length < 8) {
      toast.error('Mindestens 8 Zeichen');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Passwort geändert – bitte neu anmelden.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Reset fehlgeschlagen'));
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
        <h2 className="h-page m-0 mb-1">Neues Passwort setzen</h2>
        <p className="mb-6 text-sm text-ink-3">
          Wähle ein Passwort mit mindestens 8 Zeichen. Aktive Sessions werden beendet.
        </p>

        {!token ? (
          <div className="rounded-md border border-neg/40 bg-soft p-4 text-sm text-ink-2">
            Kein Token in der URL – bitte den Link aus deiner E-Mail nutzen.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={loading} className="contents space-y-4">
            <Field label="Neues Passwort" required>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                  aria-label="Passwort anzeigen"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field
              label="Passwort wiederholen"
              required
              error={passwordMismatch ? 'Passwörter stimmen nicht überein' : undefined}
            >
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
            <Btn
              type="submit"
              variant="grad"
              disabled={loading || passwordMismatch}
              className="w-full justify-center"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Passwort speichern'}
            </Btn>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
