import { Link } from 'react-router';
import styles from '../styles/Application.module.css';

export function ApplicationPlaceholderPage() {
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Application module</p>
      <h1>Application route scaffold</h1>
      <p className={styles.description}>
        The authenticated welcome page and route protection will be implemented
        in Phase 3.
      </p>
      <Link to="/">Return to setup</Link>
    </section>
  );
}
