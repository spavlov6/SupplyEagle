import { Navigate, Outlet } from 'react-router';
import { readAccessToken } from './access-token';
import { useCurrentUserQuery } from './use-auth';

export function RedirectIfAuthenticated() {
  const token = readAccessToken();
  const currentUser = useCurrentUserQuery();

  if (token && currentUser.isPending) {
    return (
      <main className="page">
        <p>Checking your session…</p>
      </main>
    );
  }

  if (currentUser.data) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
