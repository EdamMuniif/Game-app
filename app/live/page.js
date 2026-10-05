'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../../lib/tournament-context';
import {
  formatDate, formatTimer, groupStandings, groupedTeams, resolvedTeams,
  timerPhaseLabel, timerRemainingSeconds
} from '../../lib/tournament';

export default function LivePage() {
  const { state } = useTournament();
  const [now, setNow] = useState(Date.now());
  const teamMap = useMemo(() => Object.fromEntries(state.teams.map((team) => [team.id, team])), [state.teams]);
  const groupNames = Object.keys(groupedTeams(state.teams)).sort();
  const liveMatch = state.matches.find((match) => match.status === 'live') || null;
  const remaining = state.matches.filter((match) => match.status !== 'final');
  const nextMatch = liveMatch || remaining.find((match) => {
    const [a, b] = resolvedTeams(match, state.matches);
    return a && b;
  }) || remaining[0] || null;
  const finalMatch = [...state.matches].reverse().find((match) => match.kind === 'knockout' && match.round === 'Final');
  const champion = finalMatch?.winnerId ? teamMap[finalMatch.winnerId] : null;

  useEffect(() => {
    if (!liveMatch?.timer?.running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [liveMatch?.id, liveMatch?.timer?.running]);

  function name(id) {
    return teamMap[id]?.name || 'TBD';
  }

  function matchTeams(match) {
    return match ? resolvedTeams(match, state.matches) : [null, null];
  }

  const [nextA, nextB] = matchTeams(nextMatch);
  const liveRemaining = liveMatch?.timer ? timerRemainingSeconds(liveMatch.timer, now) : null;

  return (
    <div className="public-live-page">
      <header className="public-live-header">
        <div>
          <div className="public-live-indicator" aria-label="Live"><span className="public-live-dot" /></div>
          <h1>{state.settings.tournamentName}</h1>
          <p>{state.settings.venue} • {formatDate(state.settings.date)}</p>
        </div>
        <Link className="btn btn-light" href="/">Tournament Manager</Link>
      </header>

      {champion && <section className="champion-card"><span>🏆</span><div><small>CHAMPION</small><strong>{champion.name}</strong></div></section>}

      {liveMatch?.timer && (
        <section className="public-live-banner">
          <div><span className="live-pulse" /> LIVE NOW • {liveMatch.court || 'Court'}</div>
          <strong>{name(matchTeams(liveMatch)[0])} <em>vs</em> {name(matchTeams(liveMatch)[1])}</strong>
          <div className="public-live-clock"><small>{timerPhaseLabel(liveMatch.timer.phase)}</small><span>{formatTimer(liveRemaining)}</span></div>
        </section>
      )}

      <section className="public-stats">
        <article><span>Teams</span><strong>{state.teams.length}</strong></article>
        <article><span>Matches</span><strong>{state.matches.length}</strong></article>
        <article><span>Completed</span><strong>{state.matches.filter((match) => match.status === 'final').length}</strong></article>
        <article><span>Courts</span><strong>{state.settings.courts}</strong></article>
      </section>

      <section className="public-grid">
        <article className="public-card next-match-card">
          <p className="eyebrow">{liveMatch ? 'CURRENT MATCH' : 'NEXT MATCH'}</p>
          {nextMatch ? (
            <>
              <div className="public-match-stage">{nextMatch.round || nextMatch.stage} • Match {nextMatch.matchNo}</div>
              <div className="public-versus"><strong>{name(nextA)}</strong><span>VS</span><strong>{name(nextB)}</strong></div>
              <div className="public-match-meta"><span>{nextMatch.time || 'TBD'}</span><span>{nextMatch.court || 'Court TBD'}</span><span>{nextMatch.date ? formatDate(nextMatch.date) : 'Date TBD'}</span></div>
            </>
          ) : <div className="empty-mini">No upcoming match.</div>}
        </article>

        <article className="public-card">
          <p className="eyebrow">MATCH TIMING</p>
          <div className="public-timing">
            <div><span>Playing period</span><strong>{state.settings.halfMinutes} min</strong></div>
            <div><span>Break</span><strong>{state.settings.breakMinutes} min</strong></div>
            <div><span>Between matches</span><strong>{state.settings.betweenMatchesMinutes} min</strong></div>
          </div>
        </article>
      </section>

      {groupNames.length > 0 && (
        <section className="public-section">
          <div className="public-section-head"><div><p className="eyebrow">STANDINGS</p><h2>Group tables</h2></div></div>
          <div className="standings-grid">
            {groupNames.map((group) => (
              <article className="standings-card" key={group}>
                <h4>{group}</h4>
                <div className="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>
                  {groupStandings(state, group).map((row, index) => <tr key={row.team.id}><td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.l}</td><td><strong>{row.pts}</strong></td></tr>)}
                </tbody></table></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="public-section">
        <div className="public-section-head"><div><p className="eyebrow">FIXTURES</p><h2>Latest & upcoming</h2></div><Link className="text-link" href="/bracket">Open bracket →</Link></div>
        <div className="public-fixtures">
          {state.matches.slice(0, 12).map((match) => {
            const [aId, bId] = matchTeams(match);
            return <div key={match.id}><span>Match {match.matchNo}</span><strong>{name(aId)} <em>{match.scoreA ?? '—'} : {match.scoreB ?? '—'}</em> {name(bId)}</strong><small>{match.time || 'TBD'} • {match.court || 'Court TBD'} • {match.status}</small></div>;
          })}
          {!state.matches.length && <div className="empty-mini">No fixtures generated yet.</div>}
        </div>
      </section>
    </div>
  );
}
