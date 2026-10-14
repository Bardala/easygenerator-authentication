import type { PropsWithChildren } from 'react';
import styles from '../styles/Authentication.module.css';

export function AuthenticationLayout({ children }: PropsWithChildren) {
  return <section className={styles.card}>{children}</section>;
}
