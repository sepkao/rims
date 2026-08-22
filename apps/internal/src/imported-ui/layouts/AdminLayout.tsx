import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type IconName = 'overview' | 'menu' | 'users' | 'inventory' | 'logs' | 'expired';

const navigation: Array<{ name: string; shortName: string; path: string; icon: IconName }> = [
  { name: 'Overview', shortName: 'Overview', path: '/admin', icon: 'overview' },
  { name: 'Menu Management', shortName: 'Menu', path: '/admin/menu', icon: 'menu' },
  { name: 'User Management', shortName: 'Team', path: '/admin/user', icon: 'users' },
  { name: 'Inventory Logs', shortName: 'Inventory', path: '/admin/inventory-logs', icon: 'inventory' },
  { name: 'System Logs', shortName: 'System logs', path: '/admin/system-logs', icon: 'logs' },
  { name: 'Expired Inventory', shortName: 'Expired', path: '/admin/expired-inventory', icon: 'expired' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => item.path === location.pathname) ?? navigation[0];

  const goTo = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FFF8EF] font-sans text-[#2D1B17]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-[#2D1B17]/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col overflow-hidden border-r-2 border-[#2D1B17] bg-[#2D1B17] text-white transition-transform duration-300 lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border-[26px] border-[#B97861]/20" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full border-[24px] border-[#D9B99A]/10" />

        <div className="relative flex items-center justify-between px-6 pb-5 pt-7">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 rotate-[-5deg] items-center justify-center rounded-2xl border-2 border-[#2D1B17] bg-[#B97861] text-lg font-black text-[#2D1B17] shadow-[4px_4px_0_#D9B99A]">SS</span>
            <div>
              <h1 className="text-lg font-black leading-tight tracking-[.1em]">SHABU STOCK</h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#D4A996]">Owner console ✦</p>
            </div>
          </div>
          <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg lg:hidden">×</button>
        </div>

        <nav className="relative mt-5 flex-1 px-3">
          <div className="mb-3 flex items-center justify-between px-4">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#BCA29A]">Owner workspace</p>
            <span className="rounded-full bg-[#E8D8CA] px-2 py-0.5 text-[9px] font-black text-[#5A4037]">LIVE</span>
          </div>
          <ul className="space-y-1.5">
            {navigation.map((item) => {
              const active = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => goTo(item.path)}
                    className={`group flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[13px] font-bold transition-all ${active ? 'translate-x-1 border-[#2D1B17] bg-[#E7C7B8] text-[#2D1B17] shadow-[4px_4px_0_#B97861]' : 'border-transparent text-[#EADBD5] hover:border-white/10 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className={active ? 'text-[#8B5746]' : 'text-[#C9B1A9]'}><NavIcon name={item.icon} /></span>
                    {item.name}
                    {active && <span className="ml-auto text-sm">↗</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="relative m-3 rounded-2xl border border-white/10 bg-white/[.06] p-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8D8CA] text-xs font-black text-[#5A4037]">OW</span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">Owner / Admin</p>
              <p className="text-[10px] text-[#BCA29A]">Full system access ✦</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="w-full rounded-lg bg-white/10 px-3 py-2 text-left text-[11px] font-bold text-[#EADBD5] transition hover:bg-white/15">Log out →</button>
        </div>
      </aside>

      <main
        className="flex min-h-screen flex-col bg-[#FFF8EF] lg:ml-[280px]"
        style={{ backgroundImage: 'radial-gradient(circle at 88% 4%, rgba(185,120,97,.15), transparent 23%), radial-gradient(circle at 12% 96%, rgba(232,216,202,.38), transparent 24%)' }}
      >
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b-2 border-[#2D1B17]/10 bg-[#FFF8EF]/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#2D1B17] bg-[#E8D8CA] shadow-[2px_2px_0_#2D1B17] lg:hidden">
              <MenuIcon />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden rounded-full bg-[#2D1B17] px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-white sm:inline">Owner</span>
              <span className="hidden text-[#B4998F] sm:inline">/</span>
              <span className="truncate font-black text-[#2D1B17]">{current.shortName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border-2 border-[#2D1B17] bg-[#D9B99A] px-3 py-1 text-[10px] font-black text-[#2D1B17] shadow-[2px_2px_0_#2D1B17] sm:block">SYSTEM HEALTHY</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2D1B17] bg-[#B97861] text-xs font-black text-[#2D1B17]">OW</span>
          </div>
        </header>

        <div className="admin-content flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function MenuIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}

function NavIcon({ name }: { name: IconName }) {
  const path = {
    overview: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    menu: <><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" /></>,
    inventory: <><path d="M4 7h15m0 0-4-4m4 4-4 4M20 17H5m0 0 4 4m-4-4 4-4" /></>,
    logs: <><path d="M6 3h12a2 2 0 0 1 2 2v16H4V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    expired: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /><path d="M4.5 4.5 3 3m16.5 1.5L21 3" /></>,
  }[name];

  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}
