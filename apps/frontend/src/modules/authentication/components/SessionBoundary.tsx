import { Navigate, Outlet } from 'react-router';
import { useSession } from '../hooks/useSession';
import styles from '../styles/Authentication.module.css';

export function SessionBoundary({ authenticated }: { authenticated: boolean }) {
  const session = useSession();
  if (session.isPending)
    return (
      <section className={styles.card} role="status">
        Restoring your session…
      </section>
    );
  if (session.isError)
    return (
      <section className={styles.card}>
        <h1>Unable to connect</h1>
        <p role="alert">We could not check your session. Please try again.</p>
        <button
          className={styles.button}
          disabled={session.isFetching}
          onClick={() => void session.refetch()}
        >
          {session.isFetching ? 'Retrying…' : 'Retry connection'}
        </button>
      </section>
    );
  if (authenticated && !session.data.user)
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ sessionExpired: session.data.expired }}
      />
    );
  if (!authenticated && session.data.user)
    return <Navigate to="/app" replace />;
  return <Outlet />;
}
