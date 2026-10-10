import { Building2, LayoutDashboard, ListChecks, Route } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Logo } from '../components/logo';
import { useCurrentUserQuery, useSignOut } from '../features/auth/use-auth';
import { ScanBanner } from '../features/pipeline/scan-banner';
import { usePinLocalClock } from '../features/pipeline/use-pipeline';
import { useSupplierRealtime } from '../features/suppliers/use-supplier-realtime';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/suppliers', label: 'Suppliers', icon: Building2, end: false },
  { to: '/routes', label: 'Routes', icon: Route, end: false },
  {
    to: '/recommendations',
    label: 'Recommendations',
    icon: ListChecks,
    end: false,
  },
] as const;

export function MainLayout() {
  const currentUser = useCurrentUserQuery();
  const signOut = useSignOut();
  const pinClock = usePinLocalClock();
  const pinned = useRef(false);
  useSupplierRealtime();

  useEffect(() => {
    if (pinned.current || !currentUser.data) {
      return;
    }
    pinned.current = true;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    pinClock.mutate(timezone);
  }, [currentUser.data, pinClock]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Logo className="logo-header" />
        <UserMenu email={currentUser.data?.email} onSignOut={signOut} />
      </header>
      <nav className="app-subnav" aria-label="Primary">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              aria-label={item.label}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <ScanBanner />
      <Outlet />
    </div>
  );
}

function UserMenu({
  email,
  onSignOut,
}: {
  email: string | undefined;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const letters = initials(email);

  return (
    <div className="user-menu" ref={menu}>
      <button
        type="button"
        className="user-avatar"
        aria-expanded={open}
        aria-haspopup="menu"
        title={email}
        onClick={() => setOpen((current) => !current)}
      >
        {letters}
      </button>
      {open ? (
        <div className="user-dropdown" role="menu">
          {email ? <p>{email}</p> : null}
          <button type="button" role="menuitem" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function initials(email: string | undefined): string {
  const local = email?.split('@')[0] ?? '';
  const letters = local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
  return letters.length > 0 ? letters.toUpperCase() : 'SE';
}
