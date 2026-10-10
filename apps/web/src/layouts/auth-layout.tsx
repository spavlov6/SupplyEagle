import { Outlet } from 'react-router';
import { Logo } from '../components/logo';

export function AuthLayout() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Logo />
        <Outlet />
      </section>
    </main>
  );
}
