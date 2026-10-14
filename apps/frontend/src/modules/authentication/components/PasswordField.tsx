import { useState } from 'react';
import { passwordChecks } from '../validation/authentication.validation';
import type { AuthenticationMode } from '../types/authentication';
import styles from '../styles/PasswordField.module.css';

export function PasswordField({
  mode,
  error,
}: {
  mode: AuthenticationMode;
  error: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  return (
    <div className={styles.field}>
      <label htmlFor="password">Password</label>
      <div className={styles.inputRow}>
        {/* Native maxLength counts UTF-16 units; validation counts characters. */}
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          required
          minLength={mode === 'sign-up' ? 8 : undefined}
          maxLength={256}
          autoComplete={
            mode === 'sign-up' ? 'new-password' : 'current-password'
          }
          aria-invalid={Boolean(error)}
          aria-describedby={
            `${mode === 'sign-up' ? 'password-guidance ' : ''}${error ? 'password-error' : ''}`.trim() ||
            undefined
          }
          onChange={
            mode === 'sign-up'
              ? (event) => setValue(event.target.value)
              : undefined
          }
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {mode === 'sign-up' && (
        <ul
          id="password-guidance"
          className={styles.guidance}
          aria-label="Password requirements"
        >
          {passwordChecks(value).map((check) => (
            <li key={check.label} data-valid={check.valid}>
              <span aria-hidden="true">{check.valid ? '✓' : '○'} </span>
              {check.label}
              <span className={styles.visuallyHidden}>
                {check.valid ? ' — met' : ' — not met'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id="password-error" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
