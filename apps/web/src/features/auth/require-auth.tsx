import { Navigate, Outlet } from 'react-router';
import { readAccessToken } from './access-token';
import { useCurrentUserQuery } from './use-auth';

export function RequireAuth() {
  const token = readAccessToken();
  const currentUser = useCurrentUserQuery();

  if (!token || currentUser.isError) {
    return <Navigate to="/sign-in" replace />;
  }

  if (currentUser.isPending) {
    return (
      <main className="page">
        <p>Checking your session…</p>
      </main>
    );
  }

  return <Outlet />;
}
