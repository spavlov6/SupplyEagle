import { Outlet } from 'react-router';
import { Logo } from '../components/logo';
import { useCurrentUserQuery, useSignOut } from '../features/auth/use-auth';

export function MainLayout() {
  const currentUser = useCurrentUserQuery();
  const signOut = useSignOut();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo className="logo-header" />
        <div className="app-header-actions">
          <span>{currentUser.data?.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
