import { Link, Route, Routes } from 'react-router';
import { AppShell } from '../components/AppShell/AppShell';
import { AuthenticationPlaceholderPage } from '../modules/authentication/pages/AuthenticationPlaceholderPage';
import { FoundationPage } from '../modules/application/pages/FoundationPage';
import { ApplicationPlaceholderPage } from '../modules/application/pages/ApplicationPlaceholderPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<FoundationPage />} />
        <Route
          path="/sign-up"
          element={<AuthenticationPlaceholderPage mode="sign-up" />}
        />
        <Route
          path="/sign-in"
          element={<AuthenticationPlaceholderPage mode="sign-in" />}
        />
        <Route path="/app" element={<ApplicationPlaceholderPage />} />
        <Route
          path="*"
          element={
            <section>
              <h1>Page not found</h1>
              <Link to="/">Return to setup</Link>
            </section>
          }
        />
      </Routes>
    </AppShell>
  );
}
