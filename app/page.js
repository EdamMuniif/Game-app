'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../components/AppShell';
import BadmintonShuttle from '../components/BadmintonShuttle';
import { useTournament } from '../lib/tournament-context';
import { formatDate, formatLabel, tournamentYear, workflowState } from '../lib/tournament';

const SPORT_HERO_ICON = {
  Football: '⚽',
  Futsal: '⚽',
  Volleyball: '🏐',
  Badminton: '',
  Other: '🏆'
};

export default function DashboardPage() {
  const router = useRouter();
  const { tournaments, state, selectTournament } = useTournament();
  const years = useMemo(() => [...new Set(tournaments.map(tournamentYear).filter(Boolean))].sort((a, b) => b - a), [tournaments]);
  const [year, setYear] = useState('all');

  const filtered = useMemo(() => tournaments.filter((tournament) => (
    year === 'all' || String(tournamentYear(tournament)) === String(year)
  )), [tournaments, year]);

  const totalTeams = filtered.reduce((sum, tournament) => sum + tournament.teams.length, 0);
  const totalMatches = filtered.reduce((sum, tournament) => sum + tournament.matches.length, 0);
  const completed = filtered.filter((tournament) => tournament.status === 'completed').length;
  const active = filtered.filter((tournament) => ['upcoming', 'ongoing'].includes(tournament.status)).length;
  const workflow = workflowState(state);

  function openTournament(id, path = '/teams') {
    selectTournament(id);
    router.push(path);
  }

  return (
    <AppShell pageTitle="Dashboard">
      <section className="dashboard-global-head">
        <div>
          <p className="eyebrow">SHIPYARD RECREATION CLUB</p>
          <h2>Tournament overview</h2>
          <p className="muted">Create, run, and retain sports tournaments across multiple years.</p>
        </div>
        <div className="dashboard-filter-actions">
          <label>Year
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">All years</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Link className="btn btn-primary" href="/tournaments/new">Create tournament</Link>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>Tournaments</span><strong>{filtered.length}</strong><small>{year === 'all' ? 'All recorded years' : year}</small></article>
        <article className="stat-card"><span>Upcoming / Ongoing</span><strong>{active}</strong><small>Operational tournaments</small></article>
        <article className="stat-card"><span>Completed</span><strong>{completed}</strong><small>Historical records retained</small></article>
        <article className="stat-card"><span>Teams / Entries</span><strong>{totalTeams}</strong><small>{totalMatches} matches recorded</small></article>
      </section>

      <section className="panel">
        <div className="panel-head wrap">
          <div><p className="eyebrow">TOURNAMENT REGISTER</p><h3>Recent tournaments</h3></div>
          <Link className="text-link" href="/tournaments">View all →</Link>
        </div>
        {filtered.length ? (
          <div className="tournament-card-grid">
            {filtered
              .slice()
              .sort((a, b) => String(b.settings.date || '').localeCompare(String(a.settings.date || '')))
              .slice(0, 8)
              .map((tournament) => (
                <article className="tournament-summary-card" key={tournament.id}>
                  <div className="tournament-card-top">
                    <span className={'status-pill status-' + tournament.status}>{tournament.status}</span>
                    <span>{tournament.settings.sport}</span>
                  </div>
                  <h3>{tournament.settings.tournamentName}</h3>
                  <p>{formatDate(tournament.settings.date)} • {tournament.settings.venue || 'Venue not set'}</p>
                  <div className="tournament-card-metrics">
                    <span><strong>{tournament.teams.length}</strong> entries</span>
                    <span><strong>{tournament.matches.length}</strong> matches</span>
                    <span><strong>{formatLabel(tournament.settings.format)}</strong></span>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={() => openTournament(tournament.id)}>Open tournament</button>
                </article>
              ))}
          </div>
        ) : (
          <div className="empty-state"><span>🏆</span><strong>No tournaments for this filter</strong><p>Create a tournament or select another year.</p></div>
        )}
      </section>

      <section className="hero-card current-tournament-hero">
        <div className="current-tournament-copy">
          <p className="eyebrow light">CURRENT TOURNAMENT</p>
          <h2>{state.settings.tournamentName}</h2>
          <p>{state.settings.sport} • {state.settings.venue || 'Venue not set'} • {formatDate(state.settings.date)}</p>
          <div className="button-row">
            <Link className="btn btn-light" href="/teams">Teams</Link>
            <Link className="btn btn-outline-light" href="/draw">Draw</Link>
            <Link className="btn btn-outline-light" href="/matches">Matches</Link>
            <Link className="btn btn-outline-light" href="/control">Match control</Link>
            <Link className="btn btn-outline-light" href="/live">Live view</Link>
          </div>
        </div>

        <div
          className={'hero-sport-motion hero-sport-' + String(state.settings.sport || 'Other').toLowerCase()}
          aria-hidden="true"
        >
          <span className="hero-sport-shadow" />
          {state.settings.sport === 'Badminton' ? (
            <BadmintonShuttle className="hero-badminton-shuttle" />
          ) : (
            <span className="hero-sport-object">
              {SPORT_HERO_ICON[state.settings.sport] || SPORT_HERO_ICON.Other}
            </span>
          )}
        </div>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">WORKFLOW</p><h3>Current tournament readiness</h3></div></div>
          <ol className="workflow">
            {workflow.map((item) => (
              <li key={item.label} className={item.done ? 'done' : item.current ? 'current' : ''}>
                <span>{item.done ? '✓' : item.number}</span>
                <div><strong>{item.label}</strong><small>{item.hint}</small></div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>{state.settings.tournamentName}</h3></div></div>
          <div className="activity-list">
            {state.activity.length
              ? state.activity.slice(0, 10).map((item) => (
                  <div className="activity-item" key={item.id}>
                    <span>{item.text}</span>
                    <small>{item.time}</small>
                  </div>
                ))
              : <div className="empty-mini">No activity recorded yet.</div>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
