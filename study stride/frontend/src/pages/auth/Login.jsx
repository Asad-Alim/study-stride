import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-1)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent)] text-white font-bold text-lg mb-4">S</div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Study Stride</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Sign in to your workspace</p>
        </div>

        <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          {error && <div className="text-xs text-[var(--critical)] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">{error}</div>}

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
              <input
                type="email" name="email" value={form.email} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
              <input
                type="password" name="password" value={form.password} onChange={handle} required
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full justify-center mt-2">Sign in</Button>
          </form>

          <p className="text-xs text-center text-[var(--text-muted)]">
            No account?{' '}
            <Link to="/register" className="text-[var(--accent)] hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;