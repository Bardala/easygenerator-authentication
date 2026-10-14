import { useSignOut } from '../../authentication/hooks/useAuthentication';
import { useSession } from '../../authentication/hooks/useSession';
import styles from '../styles/Application.module.css';
export function ApplicationPage() {
  const session = useSession();
  const logout = useSignOut();
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Hello, {session.data?.user?.name}</p>
      <h1>Welcome to the application.</h1>
      <p className={styles.description}>
        You are signed in as {session.data?.user?.email}.
      </p>
      {logout.isError && (
        <p role="alert" className={styles.error}>
          Sign out could not be confirmed. Please try again.
        </p>
      )}
      <button
        type="button"
        className={styles.button}
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {logout.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </section>
  );
}
