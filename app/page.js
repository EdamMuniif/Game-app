'use client';

import Link from 'next/link';
import AppShell from '../components/AppShell';
import { useTournament } from '../lib/tournament-context';
import { formatLabel, formatDate, workflowState } from '../lib/tournament';

export default function DashboardPage() {
  const { state } = useTournament();
  const { settings, teams, matches, activity } = state;
  const drawComplete = teams.length > 0 && teams.every((team) => team.letter);
  const completedMatches = matches.filter((match) => match.status === 'final').length;
  const progress = Math.min(100, Math.round((teams.length / Math.max(1, settings.maxTeams)) * 100));
  const workflow = workflowState(state);

  return (
    <AppShell pageTitle="Dashboard">
      <section className="hero-card">
        <div>
          <p className="eyebrow light">TOURNAMENT CONTROL</p>
          <h2>{settings.tournamentName}</h2>
          <p>{settings.venue || 'Venue not set'} • {formatDate(settings.date)}</p>
          <div className="button-row">
            <Link className="btn btn-light" href="/teams">Manage teams</Link>
            <Link className="btn btn-outline-light" href="/draw">Open draw</Link><Link className="btn btn-outline-light" href="/control">Match control</Link><Link className="btn btn-outline-light" href="/bracket">Bracket</Link><Link className="btn btn-outline-light" href="/live">Live view</Link>
          </div>
        </div>
        <div className="hero-ball" aria-hidden="true">🏐</div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>Submitted Teams</span><strong>{teams.length} / {settings.maxTeams}</strong><small>{Math.max(0, settings.maxTeams - teams.length)} places remaining</small></article>
        <article className="stat-card"><span>Tournament Format</span><strong>{formatLabel(settings.format)}</strong><small>{settings.format === 'knockout' ? 'Single elimination' : 'Group competition enabled'}</small></article>
        <article className="stat-card"><span>Draw Status</span><strong>{drawComplete ? 'Complete' : 'Pending'}</strong><small>{drawComplete ? 'Letters assigned' : 'Draw letters not assigned'}</small></article>
        <article className="stat-card"><span>Matches</span><strong>{matches.length}</strong><small>{completedMatches} completed</small></article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">REGISTRATION</p><h3>Team submission progress</h3></div><Link className="text-link" href="/teams">View teams →</Link></div>
          <div className="progress-row"><span>{teams.length} of {settings.maxTeams} teams submitted</span><strong>{progress}%</strong></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="deadline-card"><span className="deadline-icon">📅</span><div><strong>Submission deadline</strong><span>{formatDate(settings.submissionDeadline)}</span></div></div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">EVENT INFORMATION</p><h3>Tournament details</h3></div><Link className="text-link" href="/settings">Edit →</Link></div>
          <dl className="details-list">
            <div><dt>Venue</dt><dd>{settings.venue || 'Not set'}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(settings.date)}</dd></div>
            <div><dt>Format</dt><dd>{formatLabel(settings.format)}</dd></div>
            <div><dt>Match format</dt><dd>{settings.bestOfSets === 1 ? '1 set' : `Best of ${settings.bestOfSets} sets`}</dd></div>
          </dl>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">NEXT STEP</p><h3>Tournament workflow</h3></div></div>
          <ol className="workflow">
            {workflow.map((item) => <li key={item.label} className={item.done ? 'done' : item.current ? 'current' : ''}><span>{item.done ? '✓' : item.number}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div></li>)}
          </ol>
        </article>
        <article className="panel">
          <div className="panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Latest updates</h3></div></div>
          <div className="activity-list">
            {activity.length ? activity.slice(0, 8).map((item) => <div className="activity-item" key={item.id}><span>{item.text}</span><small>{item.time}</small></div>) : <div className="empty-mini">No activity recorded yet.</div>}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
