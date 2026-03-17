import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      toast.success('Konto erfolgreich erstellt!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen';
      const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(axiosMessage || message);
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Finanzguru</span>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white">Konto erstellen</h2>
          <p className="mt-2 text-surface-400">Starte jetzt mit deinem persönlichen Finanzmanagement.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vorname</label>
              <input type="text" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className="input" placeholder="Max" />
            </div>
            <div>
              <label className="label">Nachname</label>
              <input type="text" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className="input" placeholder="Mustermann" />
            </div>
          </div>

          <div>
            <label className="label">E-Mail *</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input" placeholder="deine@email.de" required />
          </div>

          <div>
            <label className="label">Passwort *</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} className="input" placeholder="Mind. 8 Zeichen" required minLength={8} />
          </div>

          <div>
            <label className="label">Passwort bestätigen *</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="input" placeholder="Passwort wiederholen" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrieren'}
          </button>
        </form>

        <p className="text-center text-sm text-surface-400">
          Bereits ein Konto?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Anmelden</Link>
        </p>
      </div>
    </div>
  );
}
