'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../../lib/tournament-context';
import SportMotionLayer from '../../components/SportMotionLayer';
import {
  formatDate,
  formatTimer,
  groupStandings,
  groupedTeams,
  resolvedTeams,
  timerPhaseLabel,
  timerRemainingSeconds
} from '../../lib/tournament';

export default function LivePage() {
  const { state, tournaments, selectedTournamentId, selectTournament } = useTournament();
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
    const intervalMs = liveMatch?.timer?.running ? 250 : 1000;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
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

  const firstScheduledMatch = useMemo(() => {
    return state.matches
      .filter((match) => match.date && match.time)
      .slice()
      .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time))[0] || null;
  }, [state.matches]);

  const tournamentStart = useMemo(() => {
    const date = firstScheduledMatch?.date || state.settings.date;
    const time = String(firstScheduledMatch?.time || state.settings.startTime || '00:00').slice(0, 5);
    if (!date) return null;
    const timestamp = Date.parse(date + 'T' + time + ':00+05:00');
    return Number.isFinite(timestamp) ? timestamp : null;
  }, [firstScheduledMatch?.date, firstScheduledMatch?.time, state.settings.date, state.settings.startTime]);

  const startRemaining = tournamentStart ? Math.max(0, Math.floor((tournamentStart - now) / 1000)) : 0;
  const showStartCountdown = Boolean(tournamentStart && startRemaining > 0);
  const countdown = {
    days: Math.floor(startRemaining / 86400),
    hours: Math.floor((startRemaining % 86400) / 3600),
    minutes: Math.floor((startRemaining % 3600) / 60),
    seconds: startRemaining % 60
  };

  return (
    <div className="public-live-page">
      <SportMotionLayer sport={state.settings.sport} compact />

      <header className="public-live-header">
        <div>
          <div className="public-live-indicator" aria-label="Live tournament view">
            <span className="public-live-dot" />
            <strong>LIVE TOURNAMENT VIEW</strong>
          </div>
          <p className="live-club-name">SHIPYARD RECREATION CLUB</p>
          <h1>{state.settings.tournamentName}</h1>
          <p>{state.settings.sport} • {state.settings.venue || 'Venue not set'} • {formatDate(state.settings.date)}</p>
        </div>
        <div className="public-live-actions">
          {tournaments.length > 1 && (
            <select value={selectedTournamentId || ''} onChange={(event) => selectTournament(event.target.value)} aria-label="Choose public tournament">
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.settings.tournamentName}</option>
              ))}
            </select>
          )}
          <Link className="btn btn-light" href="/">Manager Home</Link>
        </div>
      </header>

      {showStartCountdown && (
        <section className="tournament-countdown" aria-label="Tournament start countdown">
          <div className="tournament-countdown-head">
            <span>TOURNAMENT STARTS IN</span>
            <small>{formatDate(firstScheduledMatch?.date || state.settings.date)} • {firstScheduledMatch?.time || state.settings.startTime || '00:00'}</small>
          </div>
          <div className="tournament-countdown-grid">
            <div><strong>{String(countdown.days).padStart(2, '0')}</strong><span>Days</span></div>
            <div><strong>{String(countdown.hours).padStart(2, '0')}</strong><span>Hours</span></div>
            <div><strong>{String(countdown.minutes).padStart(2, '0')}</strong><span>Minutes</span></div>
            <div><strong>{String(countdown.seconds).padStart(2, '0')}</strong><span>Seconds</span></div>
          </div>
        </section>
      )}

      {champion && (
        <section className="champion-card">
          <span>🏆</span>
          <div><small>CHAMPION</small><strong>{champion.name}</strong></div>
        </section>
      )}

      {liveMatch?.timer && (
        <section className="public-live-banner">
          <div><span className="live-pulse" /> LIVE NOW • {liveMatch.court || 'Playing area'}</div>
          <strong>{name(matchTeams(liveMatch)[0])} <em>vs</em> {name(matchTeams(liveMatch)[1])}</strong>
          <div className="public-live-clock"><small>{timerPhaseLabel(liveMatch.timer.phase)}</small><span>{formatTimer(liveRemaining)}</span></div>
        </section>
      )}

      <section className="public-stats">
        <article><span>Entries</span><strong>{state.teams.length}</strong></article>
        <article><span>Matches</span><strong>{state.matches.length}</strong></article>
        <article><span>Completed</span><strong>{state.matches.filter((match) => match.status === 'final').length}</strong></article>
        <article><span>Playing Areas</span><strong>{(state.settings.playingAreas || []).length || state.settings.courts || 1}</strong></article>
      </section>

      <section className="public-grid">
        <article className="public-card next-match-card">
          <p className="eyebrow">{liveMatch ? 'CURRENT MATCH' : 'NEXT MATCH'}</p>
          {nextMatch ? (
            <>
              <div className="public-match-stage">{nextMatch.round || nextMatch.stage} • Match {nextMatch.matchNo}</div>
              <div className="public-versus"><strong>{name(nextA)}</strong><span>VS</span><strong>{name(nextB)}</strong></div>
              <div className="public-match-meta">
                <span>{nextMatch.time || 'TBD'}</span>
                <span>{nextMatch.court || 'Area TBD'}</span>
                <span>{nextMatch.date ? formatDate(nextMatch.date) : 'Date TBD'}</span>
              </div>
            </>
          ) : <div className="empty-mini">No upcoming match.</div>}
        </article>

        <article className="public-card">
          <p className="eyebrow">TOURNAMENT STATUS</p>
          <div className="public-timing">
            <div><span>Status</span><strong>{state.status}</strong></div>
            <div><span>Format</span><strong>{String(state.settings.format || '').replaceAll('_', ' ')}</strong></div>
            <div><span>Schedule</span><strong>{state.schedulePublishedAt ? 'Published v' + state.scheduleVersion : 'Draft'}</strong></div>
          </div>
        </article>
      </section>

      {groupNames.length > 0 && (
        <section className="public-section">
          <div className="public-section-head"><div><p className="eyebrow">STANDINGS</p><h2>Competition tables</h2></div></div>
          <div className="standings-grid">
            {groupNames.map((group) => (
              <article className="standings-card" key={group}>
                <h4>{group}</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Entry</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
                    <tbody>
                      {groupStandings(state, group).map((row, index) => (
                        <tr key={row.team.id}>
                          <td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.d}</td><td>{row.l}</td><td><strong>{row.pts}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="public-section">
        <div className="public-section-head">
          <div><p className="eyebrow">FIXTURES</p><h2>Latest & upcoming</h2></div>
          <Link className="text-link" href="/bracket">Open bracket →</Link>
        </div>
        <div className="public-fixtures">
          {state.matches.slice(0, 16).map((match) => {
            const [aId, bId] = matchTeams(match);
            return (
              <div key={match.id}>
                <span>Match {match.matchNo}</span>
                <strong>{name(aId)} <em>{match.scoreA ?? '—'} : {match.scoreB ?? '—'}</em> {name(bId)}</strong>
                <small>{match.date ? formatDate(match.date) + ' • ' : ''}{match.time || 'TBD'} • {match.court || 'Area TBD'} • {match.status}</small>
              </div>
            );
          })}
          {!state.matches.length && <div className="empty-mini">No fixtures generated yet.</div>}
        </div>
      </section>
    </div>
  );
}
