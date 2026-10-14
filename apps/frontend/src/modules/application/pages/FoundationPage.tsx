import { ReadinessStatus } from '../components/ReadinessStatus';
import styles from '../styles/Application.module.css';

export function FoundationPage() {
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>Development setup</p>
      <h1>Application foundation</h1>
      <p className={styles.description}>
        React routing, module styles, and the API connection are ready for
        review.
      </p>
      <ReadinessStatus />
      <p className={styles.note}>
        Authentication endpoints are planned for Phase 2. Forms and route
        protection follow in Phase 3.
      </p>
    </section>
  );
}
