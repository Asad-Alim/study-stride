// src/components/layout/AppLayout.jsx  (FULL REPLACEMENT)

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from '../common/ThemeToggle';
import { useAuth } from '../../context/AuthContext';

// Class upgrade popup — shown in March/April
const ClassUpgradeModal = () => {
  const { user, upgradeClass, dismissUpgrade } = useAuth();

  // Guess next level simply — you can make this smarter
  const guessNext = (current) => {
    if (!current) return current;
    const match = current.match(/Class (\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (n < 10) return `Class ${n + 1}`;
      if (n === 10) return 'Class 11 (Science)'; // default — let user pick
      if (n === 11) return current.replace('11', '12');
      if (n === 12) return 'B.Tech 1st Year';
    }
    const yearMatch = current.match(/(\d+)(st|nd|rd|th) Year/);
    if (yearMatch) {
      const n = parseInt(yearMatch[1]);
      const suffix = ['', 'st', 'nd', 'rd', 'th'];
      return current.replace(`${n}${yearMatch[2]} Year`, `${n + 1}${suffix[n + 1] || 'th'} Year`);
    }
    return current;
  };

  const nextLevel = guessNext(user?.declaredLevel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl p-7 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-3xl mb-3 text-center">🎓</div>
        <h2 className="text-base font-semibold text-[var(--text-primary)] text-center mb-1">
          New academic year?
        </h2>
        <p className="text-sm text-[var(--text-muted)] text-center mb-5">
          It's March/April — did you move up from <strong className="text-[var(--text-primary)]">{user?.declaredLevel}</strong>?
          Your AI content level will update automatically.
        </p>
        <div className="space-y-2">
          {nextLevel && nextLevel !== user?.declaredLevel && (
            <button onClick={() => upgradeClass(nextLevel)}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Yes, I'm now in {nextLevel}
            </button>
          )}
          <button onClick={() => upgradeClass(user?.declaredLevel)}
            className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors">
            Yes but let me pick my new level
          </button>
          <button onClick={dismissUpgrade}
            className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Not yet — remind me later
          </button>
        </div>
      </div>
    </div>
  );
};

// Top bar — profile avatar, theme toggle, sign out
const TopBar = ({ sidebarWidth }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div
      className="fixed top-0 right-0 z-30 flex items-center justify-end gap-2 px-4 h-12 border-b border-[var(--border)] bg-[var(--surface-0)]"
      style={{ left: sidebarWidth }}
    >
      <ThemeToggle />

      {/* Profile avatar button */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors"
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-[var(--accent)] flex items-center justify-center shrink-0">
            {user?.photo
              ? <img src={user.photo} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            }
          </div>
          <span className="text-xs font-medium text-[var(--text-primary)] hidden sm:block max-w-[100px] truncate">
            {user?.name}
          </span>
          <span className="text-[var(--text-muted)] text-xs">▾</span>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--surface-0)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                {user?.declaredLevel && (
                  <span className="inline-block mt-1 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
                    {user.declaredLevel}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="w-full text-left px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-[var(--critical)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { showUpgradePrompt } = useAuth();
  const sidebarWidth = collapsed ? 52 : 224;

  return (
    <div className="flex min-h-screen bg-[var(--surface-1)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <TopBar sidebarWidth={sidebarWidth} />
      <main
        className="flex-1 min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarWidth, paddingTop: '48px' }}
      >
        {children}
      </main>
      {showUpgradePrompt && <ClassUpgradeModal />}
    </div>
  );
};

export default AppLayout;