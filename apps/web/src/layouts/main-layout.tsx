import { NavLink, Outlet } from 'react-router';
import { Logo } from '../components/logo';
import { useCurrentUserQuery, useSignOut } from '../features/auth/use-auth';

export function MainLayout() {
  const currentUser = useCurrentUserQuery();
  const signOut = useSignOut();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-start">
          <Logo className="logo-header" />
          <nav className="app-nav" aria-label="Primary">
            <NavLink to="/" end>
              Status
            </NavLink>
            <NavLink to="/suppliers">Suppliers</NavLink>
          </nav>
        </div>
        <div className="app-header-actions">
          <span>{currentUser.data?.email}</span>
          <button type="button" className="button-secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
