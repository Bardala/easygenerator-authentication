import { NavLink } from 'react-router';
import { useSession } from '../hooks/useSession';
export function AuthenticationNavigation() {
  const session = useSession();
  if (!session.isSuccess) return null;
  return session.data.user ? (
    <NavLink to="/app">Application</NavLink>
  ) : (
    <>
      <NavLink to="/sign-in">Sign in</NavLink>
      <NavLink to="/sign-up">Sign up</NavLink>
    </>
  );
}
