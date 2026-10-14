import type { PropsWithChildren } from 'react';
import { Link, NavLink } from 'react-router';
import styles from './AppShell.module.css';

export function AppShell({ children }: PropsWithChildren) {
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
          <NavLink to="/sign-in">Sign in</NavLink>
          <NavLink to="/sign-up">Sign up</NavLink>
        </nav>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        Phase 1 · Development foundation
      </footer>
    </div>
  );
}
