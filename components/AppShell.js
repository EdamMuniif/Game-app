'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTournament } from '../lib/tournament-context';
import SportMotionLayer from './SportMotionLayer';
import TournamentAssistant from './TournamentAssistant';

const mainNav = [
  ['/', '⌂', 'Dashboard'],
  ['/tournaments', '🏆', 'Tournaments'],
  ['/datasheet', '▤', 'Datasheet']
];

const workspaceNav = [
  ['/teams', '👥', 'Teams'],
  ['/draw', '🎲', 'Draw'],
  ['/matches', '🏐', 'Matches'],
  ['/control', '⏱', 'Match Control'],
  ['/bracket', '◫', 'Bracket'],
  ['/live', '◉', 'Live View'],
  ['/reports', '▤', 'Reports'],
  ['/rules', '📋', 'Rules'],
  ['/settings', '⚙', 'Settings']
];

const mobilePrimary = [
  ['/', '⌂', 'Dashboard'],
  ['/tournaments', '🏆', 'Tournaments'],
  ['/teams', '👥', 'Teams'],
  ['/matches', '🏐', 'Matches'],
  ['/datasheet', '▤', 'Datasheet']
];

function activePath(pathname, href) {
  if (href === '/') return pathname === '/';
  if (href === '/tournaments') return pathname === '/tournaments' || pathname.startsWith('/tournaments/');
  return pathname === href;
}

export default function AppShell({ pageTitle, children }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navRef = useRef(null);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const [theme, setTheme] = useState('light');
  const {
    state,
    tournaments,
    selectedTournamentId,
    selectTournament,
    isAdmin,
    adminPromptOpen,
    setAdminPromptOpen,
    adminNotice,
    setAdminNotice,
    loginAdmin,
    logoutAdmin,
    syncStatus
  } = useTournament();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeItem = navRef.current?.querySelector('.nav-item.active');
      activeItem?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, mobileNavOpen]);

  useEffect(() => {
    const current = document.documentElement.dataset.theme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(current);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('spike-cup-theme', next);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', next === 'dark' ? '#07111f' : '#f4f8fc');
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setAdminError('');
    try {
      await loginAdmin(adminPin);
      setAdminPin('');
    } catch (error) {
      setAdminError(error.message || 'Unable to sign in.');
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="mobile-appbar">
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-appbar-title">
          <strong>SRC Tournament Manager</strong>
          <span>{pageTitle}</span>
        </div>
        <button
          className="theme-toggle theme-toggle-mobile"
          type="button"
          aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
          title={theme === 'dark' ? 'Day mode' : 'Night mode'}
          onClick={toggleTheme}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
        </button>
      </header>

      <aside className={'sidebar ' + (mobileNavOpen ? 'mobile-open' : '')} aria-label="Primary navigation">
        <div className="sidebar-mobile-head">
          <span>Navigation</span>
          <button className="sidebar-close-btn" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button>
        </div>

        <div className="brand">
          <div className="brand-ball" aria-hidden="true">SRC</div>
          <div><strong>Shipyard Recreation Club</strong><span>Tournament Management System</span></div>
        </div>

        <nav className="nav-list" ref={navRef}>
          <div className="nav-section-label">MAIN</div>
          {mainNav.map(([href, icon, label]) => (
            <Link
              key={href}
              className={'nav-item ' + (activePath(pathname, href) ? 'active' : '')}
              href={href}
              onClick={() => setMobileNavOpen(false)}
            >
              <span aria-hidden="true">{icon}</span>
              <strong>{label}</strong>
            </Link>
          ))}

          <div className="nav-section-label workspace-label">CURRENT TOURNAMENT</div>
          <div className="sidebar-tournament-select">
            <select
              value={selectedTournamentId || ''}
              onChange={(event) => selectTournament(event.target.value)}
              aria-label="Current tournament"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.settings.tournamentName}
                </option>
              ))}
            </select>
          </div>

          {workspaceNav.map(([href, icon, label]) => (
            <Link
              key={href}
              className={'nav-item nav-workspace ' + (activePath(pathname, href) ? 'active' : '')}
              href={href}
              onClick={() => setMobileNavOpen(false)}
            >
              <span aria-hidden="true">{icon}</span>
              <strong>{label}</strong>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {isAdmin ? (
            <button
              className={'sidebar-admin-live ' + (syncStatus === 'error' || syncStatus === 'local' ? 'has-error' : '')}
              type="button"
              onClick={logoutAdmin}
              title="Admin is active. Click to log out."
            >
              <strong>{syncStatus === 'error' || syncStatus === 'local' ? 'Admin - sync issue' : 'Admin - live'}</strong>
              <span className="admin-live-dot" aria-label={syncStatus === 'error' || syncStatus === 'local' ? 'Sync issue' : 'Live'} />
            </button>
          ) : (
            <button
              className="sidebar-admin-live login"
              type="button"
              onClick={() => {
                setAdminNotice('Enter the admin PIN to edit tournament data.');
                setAdminPromptOpen(true);
                setMobileNavOpen(false);
              }}
            >
              <strong>Admin login</strong>
            </button>
          )}
        </div>
      </aside>

      <button
        className={'sidebar-overlay ' + (mobileNavOpen ? 'show' : '')}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />

      <main className="main-content" id="main-content">
        <SportMotionLayer sport={state.settings.sport} />
        <div className="content-frame">
          <header className="topbar">
            <div className="topbar-title">
              <p className="eyebrow">{state.settings.sport || 'SPORT'} TOURNAMENT</p>
              <h1>{pageTitle}</h1>
            </div>
            <div className="topbar-actions">
              <span className="active-tournament-chip">{state.settings.tournamentName}</span>
              <button
                className="theme-toggle"
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
                title={theme === 'dark' ? 'Day mode' : 'Night mode'}
              >
                <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
              </button>
            </div>
          </header>

          {!isAdmin && (
            <div className="public-mode-banner">
              <span>Public view</span>
              <strong>Only tournaments marked public are visible. Admin PIN is required to make changes.</strong>
              <button type="button" onClick={() => setAdminPromptOpen(true)}>Admin login</button>
            </div>
          )}
          {children}
        </div>
      </main>

      {adminPromptOpen && (
        <div className="modal-backdrop admin-login-backdrop" role="dialog" aria-modal="true" aria-label="Admin login">
          <div className="modal admin-login-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">ADMIN ACCESS</p>
                <h3>Unlock tournament editing</h3>
              </div>
              <button className="icon-btn" type="button" onClick={() => { setAdminPromptOpen(false); setAdminError(''); }}>×</button>
            </div>
            <p className="muted">{adminNotice || 'Enter the tournament admin PIN.'}</p>
            <form className="stack-form" onSubmit={handleAdminLogin}>
              <label>Admin PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={adminPin}
                  onChange={(event) => setAdminPin(event.target.value)}
                  placeholder="Enter PIN"
                  required
                />
              </label>
              {adminError && <div className="admin-login-error">{adminError}</div>}
              <button className="btn btn-primary" type="submit">Unlock editing</button>
            </form>
          </div>
        </div>
      )}

      <TournamentAssistant />

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobilePrimary.map(([href, icon, label]) => (
          <Link key={href} className={activePath(pathname, href) ? 'active' : ''} href={href}>
            <span aria-hidden="true">{icon}</span>
            <strong>{label}</strong>
          </Link>
        ))}
      </nav>
    </div>
  );
}
