'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTournament } from '../lib/tournament-context';

const navItems = [
  ['/', '⌂', 'Home'],
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
  ['/', '⌂', 'Home'],
  ['/teams', '👥', 'Teams'],
  ['/draw', '🎲', 'Draw'],
  ['/matches', '🏐', 'Matches']
];

export default function AppShell({ pageTitle, children }) {
  const pathname = usePathname();
  const fileRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { state, exportBackup, importBackup } = useTournament();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ok = window.confirm('Import this backup and replace current tournament data?');
    if (ok) {
      try {
        importBackup(text);
      } catch {
        window.alert('Invalid backup file.');
      }
    }
    event.target.value = '';
  }

  const moreActive = !mobilePrimary.some(([href]) => pathname === href);

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
          <strong>{state.settings.tournamentName}</strong>
          <span>{pageTitle}</span>
        </div>
      </header>

      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-mobile-head">
          <span>Navigation</span>
          <button className="sidebar-close-btn" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button>
        </div>

        <div className="brand">
          <div className="brand-ball" aria-hidden="true">◉</div>
          <div><strong>{state.settings.tournamentName}</strong><span>Tournament Manager</span></div>
        </div>

        <nav className="nav-list">
          {navItems.map(([href, icon, label]) => (
            <Link
              key={href}
              className={`nav-item ${pathname === href ? 'active' : ''}`}
              href={href}
              onClick={() => setMobileNavOpen(false)}
            >
              <span aria-hidden="true">{icon}</span>
              <strong>{label}</strong>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-utility-actions">
            <button className="sidebar-utility-btn" type="button" onClick={exportBackup}>Export backup</button>
            <button className="sidebar-utility-btn" type="button" onClick={() => fileRef.current?.click()}>Import backup</button>
          </div>
          <div className="mini-status"><span>Saved locally</span><span className="status-dot" /></div>
        </div>
      </aside>

      <button
        className={`sidebar-overlay ${mobileNavOpen ? 'show' : ''}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setMobileNavOpen(false)}
      />

      <main className="main-content" id="main-content">
        <div className="content-frame">
          <header className="topbar">
            <div className="topbar-title">
              <p className="eyebrow">VOLLEYBALL TOURNAMENT</p>
              <h1>{pageTitle}</h1>
            </div>
            <div className="topbar-actions">
              <button className="btn btn-ghost topbar-secondary-action" onClick={exportBackup}>Export backup</button>
              <button className="btn btn-ghost topbar-secondary-action" onClick={() => fileRef.current?.click()}>Import backup</button>
            </div>
          </header>
          {children}
        </div>
      </main>

      <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobilePrimary.map(([href, icon, label]) => (
          <Link key={href} className={pathname === href ? 'active' : ''} href={href}>
            <span aria-hidden="true">{icon}</span>
            <strong>{label}</strong>
          </Link>
        ))}
        <button className={moreActive ? 'active' : ''} type="button" onClick={() => setMobileNavOpen(true)}>
          <span aria-hidden="true">☰</span>
          <strong>More</strong>
        </button>
      </nav>
    </div>
  );
}
