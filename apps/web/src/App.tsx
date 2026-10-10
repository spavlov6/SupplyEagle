import { Route, Routes } from 'react-router';
import { RedirectIfAuthenticated } from './features/auth/redirect-if-authenticated';
import { RequireAuth } from './features/auth/require-auth';
import { SignInPage } from './features/auth/sign-in-page';
import { SignUpPage } from './features/auth/sign-up-page';
import { OverviewPage } from './features/overview/overview-page';
import { RecommendationPage } from './features/recommendations/recommendation-page';
import { RecommendationsPage } from './features/recommendations/recommendations-page';
import { RouteDetailsPage } from './features/routes/route-details-page';
import { RoutesPage } from './features/routes/routes-page';
import { SupplierDetailsPage } from './features/suppliers/supplier-details-page';
import { SuppliersPage } from './features/suppliers/suppliers-page';
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
          <Route path="/" element={<OverviewPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route
            path="/recommendations/:recommendationId"
            element={<RecommendationPage />}
          />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route
            path="/suppliers/:supplierId"
            element={<SupplierDetailsPage />}
          />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/routes/:routeId" element={<RouteDetailsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
