import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './AppShell.module.css';

export function AppShell({
  children,
  navigation,
}: PropsWithChildren<{ navigation: ReactNode }>) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} to="/">
          Authentication application
        </Link>
        <nav className={styles.navigation} aria-label="Main navigation">
          {navigation}
        </nav>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        Secure access · Simple by design
      </footer>
    </div>
  );
}
