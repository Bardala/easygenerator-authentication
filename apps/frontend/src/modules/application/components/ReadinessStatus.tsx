import { ApiError } from '../../../lib/http';
import { useReadiness } from '../hooks/useReadiness';
import styles from '../styles/Application.module.css';

export function ReadinessStatus() {
  const readiness = useReadiness();
  const unavailable =
    readiness.isError ||
    (readiness.data !== undefined && readiness.data.status !== 'ok');
  const message = readiness.isPending
    ? 'Checking backend and database…'
    : unavailable
      ? readiness.error instanceof ApiError && readiness.error.status === 503
        ? 'Backend is running; MongoDB is unavailable.'
        : 'Cannot reach the backend. Start it, then retry.'
      : 'Backend and MongoDB are ready.';

  return (
    <div className={styles.readiness}>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <button
        className={styles.button}
        type="button"
        disabled={readiness.isFetching}
        onClick={() => void readiness.refetch()}
      >
        {readiness.isFetching ? 'Checking…' : 'Check again'}
      </button>
    </div>
  );
}
