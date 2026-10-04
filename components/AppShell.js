'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { useTournament } from '../lib/tournament-context';

const navItems = [
  ['/', '⌂', 'Home'],
  ['/teams', '👥', 'Teams'],
  ['/draw', '🎲', 'Draw'],
  ['/matches', '🏐', 'Matches'],
  ['/rules', '📋', 'Rules'],
  ['/settings', '⚙', 'Settings']
];

export default function AppShell({ pageTitle, children }) {
  const pathname = usePathname();
  const fileRef = useRef(null);
  const { state, exportBackup, importBackup } = useTournament();

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

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-ball" aria-hidden="true">◉</div>
          <div><strong>{state.settings.tournamentName}</strong><span>Tournament Manager</span></div>
        </div>
        <nav className="nav-list">
          {navItems.map(([href, icon, label]) => (
            <Link key={href} className={`nav-item ${pathname === href ? 'active' : ''}`} href={href}><span>{icon}</span>{label}</Link>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="mini-status"><span>Saved locally</span><span className="status-dot" /></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">VOLLEYBALL TOURNAMENT</p><h1>{pageTitle}</h1></div>
          <div className="topbar-actions">
            <button className="btn btn-ghost" onClick={exportBackup}>Export backup</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />
            <Link className="btn btn-primary" href="/teams">+ Add team</Link>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
