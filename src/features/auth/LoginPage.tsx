import { KeyRound, LoaderCircle, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const authStatus = useAppStore((state) => state.authStatus);
  const setSessionUser = useAppStore((state) => state.setSessionUser);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authStatus === 'authenticated') {
    const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await api.login({ username, password });
      setSessionUser(session.user);
      const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="panel flex flex-col justify-between overflow-hidden p-8 lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">EdgeOps Cloud</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-text">A cleaner control plane for switches, wireless, and distributed sites.</h1>
            <p className="mt-4 max-w-xl text-base text-muted">
              Sign in to manage live FortiGate-backed inventory, site health, firmware posture, and operator workflows.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <ValueCard icon={ShieldCheck} title="Session-backed access" description="Real server-side sessions now protect every live inventory route." />
            <ValueCard icon={UserCircle2} title="Role-aware UI" description="Super admin, site admin, and read-only views stay aligned with backend policy." />
            <ValueCard icon={KeyRound} title="Scoped operations" description="Site-scoped users only see and operate within their assigned environment." />
          </div>
        </section>

        <section className="panel flex items-center p-8 lg:p-10">
          <form className="w-full space-y-6" onSubmit={handleSubmit}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted">Sign In</p>
              <h2 className="mt-3 text-3xl font-semibold text-text">Operator Login</h2>
              <p className="mt-2 text-sm text-muted">Use the seeded super admin account or one of the managed users from Settings once your first admin signs in.</p>
            </div>

            {error ? <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Username</span>
              <input className={inputClassName} onChange={(event) => setUsername(event.target.value)} value={username} />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Password</span>
              <input className={inputClassName} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
            </label>

            <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign In
            </button>

            <div className="rounded-3xl border border-border bg-soft p-4 text-sm text-muted">
              Default local bootstrap credentials are controlled by the backend environment. The shipped fallback is <span className="font-medium text-text">admin</span> with password <span className="font-medium text-text">edgeops-admin</span>.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

const inputClassName = 'focus-ring w-full rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text placeholder:text-muted';

const ValueCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) => (
  <div className="rounded-3xl border border-border bg-soft p-4">
    <div className="rounded-2xl bg-accent-muted p-2 text-accent w-fit">
      <Icon className="h-4 w-4" />
    </div>
    <p className="mt-4 font-medium text-text">{title}</p>
    <p className="mt-2 text-sm text-muted">{description}</p>
  </div>
);
