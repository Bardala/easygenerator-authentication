import { Link } from 'react-router';
import { AuthenticationLayout } from '../components/AuthenticationLayout';
import type { AuthenticationPageMode } from '../types/authentication-page';
import styles from '../styles/Authentication.module.css';

export function AuthenticationPlaceholderPage({
  mode,
}: {
  mode: AuthenticationPageMode;
}) {
  return (
    <AuthenticationLayout>
      <p className={styles.eyebrow}>Authentication module</p>
      <h1>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</h1>
      <p className={styles.description}>
        This route is scaffolded. The native React form and session integration
        will be implemented in Phase 3.
      </p>
      <Link to="/">Return to setup</Link>
    </AuthenticationLayout>
  );
}
