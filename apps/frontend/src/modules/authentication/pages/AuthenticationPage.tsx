import { Link, useLocation } from 'react-router';
import { AuthenticationLayout } from '../components/AuthenticationLayout';
import { PasswordField } from '../components/PasswordField';
import { useAuthenticationForm } from '../hooks/useAuthenticationForm';
import type { AuthenticationMode } from '../types/authentication';
import styles from '../styles/Authentication.module.css';

export function AuthenticationPage({ mode }: { mode: AuthenticationMode }) {
  const signup = mode === 'sign-up';
  const title = signup ? 'Create your account' : 'Sign in';
  const location = useLocation();
  const { csrf, mutation, errors, failure, failureRef, blur, submit } =
    useAuthenticationForm(mode);
  return (
    <AuthenticationLayout>
      <p className={styles.eyebrow}>Welcome{signup ? ' aboard' : ' back'}</p>
      <h1>{title}</h1>
      <p className={styles.description}>
        {signup
          ? 'Create an account to get started.'
          : 'Enter your details to continue.'}
      </p>
      {location.state?.sessionExpired && (
        <p role="status" className={styles.notice}>
          Your session expired. Please sign in again.
        </p>
      )}
      {csrf.isPending && <p role="status">Preparing your secure form…</p>}
      {csrf.isError && (
        <div className={styles.notice}>
          <p role="alert">Unable to prepare the secure form. Please retry.</p>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={csrf.isFetching}
            onClick={() => void csrf.refetch()}
          >
            Retry security token
          </button>
        </div>
      )}
      <form
        onSubmit={(event) => void submit(event)}
        onBlur={blur}
        noValidate
        aria-label={title}
        aria-busy={mutation.isPending}
      >
        <fieldset className={styles.fields} disabled={mutation.isPending}>
          {signup && (
            <div className={styles.field}>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={3}
                maxLength={200}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className={styles.error}>
                  {errors.name}
                </p>
              )}
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className={styles.error}>
                {errors.email}
              </p>
            )}
          </div>
          <PasswordField mode={mode} error={errors.password} />
          {failure && (
            <p
              role="alert"
              tabIndex={-1}
              ref={failureRef}
              className={styles.error}
            >
              {failure}
            </p>
          )}
          <button
            className={styles.button}
            type="submit"
            disabled={
              !csrf.data ||
              csrf.isFetching ||
              csrf.isError ||
              mutation.isPending
            }
          >
            {mutation.isPending
              ? signup
                ? 'Creating account…'
                : 'Signing in…'
              : signup
                ? 'Create account'
                : 'Sign in'}
          </button>
        </fieldset>
      </form>
      <p className={styles.switch}>
        {signup ? 'Already have an account?' : 'New here?'}{' '}
        <Link to={signup ? '/sign-in' : '/sign-up'}>
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </AuthenticationLayout>
  );
}
