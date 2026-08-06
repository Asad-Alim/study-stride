// src/components/layout/Sidebar.jsx  (FULL REPLACEMENT)

import { NavLink, Link } from 'react-router-dom';

// Profile and Sign out are now in the TopBar — removed from here
const nav = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/upload', icon: '↑', label: 'Upload' },
  { to: '/chat', icon: '💬', label: 'Ask Anything' },
];

const Sidebar = ({ collapsed, onToggle }) => {
  return (
    <aside
      className="h-screen flex flex-col border-r border-[var(--border)] bg-[var(--surface-0)] fixed left-0 top-0 z-40 transition-all duration-200"
      style={{ width: collapsed ? '52px' : '224px' }}
    >
      {/* Logo */}
      <div className="px-3 border-b border-[var(--border)] flex items-center justify-between shrink-0" style={{ height: '48px' }}>
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">S</div>
            <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)] truncate">Study Stride</span>
          </Link>
        )}
        {collapsed && (
          <Link to="/dashboard" className="w-6 h-6 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold mx-auto">S</Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--surface-2)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <span className="text-base shrink-0">{icon}</span>
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle arrow */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--surface-0)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all shadow-sm z-50"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span style={{ display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s', fontSize: '10px' }}>›</span>
      </button>
    </aside>
  );
};

export default Sidebar;