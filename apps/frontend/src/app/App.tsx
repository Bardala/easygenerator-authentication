import { Link, Navigate, Route, Routes } from 'react-router';
import { AppShell } from '../components/AppShell/AppShell';
import { AuthenticationPage } from '../modules/authentication/pages/AuthenticationPage';
import { AuthenticationNavigation } from '../modules/authentication/components/AuthenticationNavigation';
import { SessionBoundary } from '../modules/authentication/components/SessionBoundary';
import { ApplicationPage } from '../modules/application/pages/ApplicationPage';
export function App() {
  return (
    <AppShell navigation={<AuthenticationNavigation />}>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route element={<SessionBoundary authenticated={false} />}>
          <Route
            path="/sign-up"
            element={<AuthenticationPage key="sign-up" mode="sign-up" />}
          />
          <Route
            path="/sign-in"
            element={<AuthenticationPage key="sign-in" mode="sign-in" />}
          />
        </Route>
        <Route element={<SessionBoundary authenticated />}>
          <Route path="/app" element={<ApplicationPage />} />
        </Route>
        <Route
          path="*"
          element={
            <section>
              <h1>Page not found</h1>
              <Link to="/">Return home</Link>
            </section>
          }
        />
      </Routes>
    </AppShell>
  );
}
