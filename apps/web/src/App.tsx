import { Route, Routes } from 'react-router';
import { RedirectIfAuthenticated } from './features/auth/redirect-if-authenticated';
import { RequireAuth } from './features/auth/require-auth';
import { SignInPage } from './features/auth/sign-in-page';
import { SignUpPage } from './features/auth/sign-up-page';
import { HealthPage } from './features/health/health-page';
import { AuthLayout } from './layouts/auth-layout';
import { MainLayout } from './layouts/main-layout';

export function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route element={<AuthLayout />}>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HealthPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
