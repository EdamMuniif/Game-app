'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import {
  formatDate, formatLabel, groupStandings, groupedTeams, matchOutcomeLabel, resolvedTeams
} from '../../lib/tournament';

export default function ReportsPage() {
  const { state } = useTournament();
  const [mode, setMode] = useState('all');
  const teamMap = useMemo(() => Object.fromEntries(state.teams.map((team) => [team.id, team])), [state.teams]);
  const groups = groupedTeams(state.teams);
  const sortedDraw = [...state.teams].filter((team) => team.letter).sort((a, b) => a.letter.localeCompare(b.letter));
  const knockoutMatches = state.matches.filter((match) => match.kind === 'knockout');
  const championMatch = knockoutMatches.find((match) => match.round === 'Final' && match.status === 'final');
  const champion = championMatch?.winnerId ? teamMap[championMatch.winnerId] : null;

  function name(id) {
    return teamMap[id]?.name || 'TBD';
  }

  function show(section) {
    return mode === 'all' || mode === section;
  }

  return (
    <AppShell pageTitle="Reports">
      <section className="panel report-actions">
        <div>
          <p className="eyebrow">TOURNAMENT REPORTS</p>
          <h3>Printable sheets & PDF export</h3>
          <p className="muted">Choose a sheet, then use Print / Save PDF. In the browser print dialog, select “Save as PDF” for a PDF file.</p>
        </div>
        <div className="report-action-controls">
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="all">Complete tournament report</option>
            <option value="teams">Team registration sheet</option>
            <option value="draw">Official draw sheet</option>
            <option value="schedule">Match schedule</option>
            <option value="results">Results & standings</option>
            <option value="bracket">Knockout bracket sheet</option>
          </select>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </section>

      <div className="report-print-root">
        <header className="report-print-header">
          <div><span>VOLLEYBALL TOURNAMENT</span><h1>{state.settings.tournamentName}</h1></div>
          <dl>
            <div><dt>Venue</dt><dd>{state.settings.venue || '—'}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(state.settings.date)}</dd></div>
            <div><dt>Format</dt><dd>{formatLabel(state.settings.format)}</dd></div>
          </dl>
        </header>

        {champion && <div className="report-champion"><span>CHAMPION</span><strong>{champion.name}</strong></div>}

        {show('teams') && (
          <section className="report-sheet">
            <div className="report-sheet-title"><span>01</span><div><p>TEAM REGISTRATION</p><h2>Submitted teams</h2></div></div>
            <table className="report-table">
              <thead><tr><th>#</th><th>Team</th><th>Department</th><th>Captain</th><th>Manager</th><th>Contact</th></tr></thead>
              <tbody>{state.teams.map((team, index) => <tr key={team.id}><td>{index + 1}</td><td><strong>{team.name}</strong></td><td>{team.department || '—'}</td><td>{team.captain || '—'}</td><td>{team.manager || '—'}</td><td>{team.contact || '—'}</td></tr>)}</tbody>
            </table>
          </section>
        )}

        {show('draw') && (
          <section className="report-sheet">
            <div className="report-sheet-title"><span>02</span><div><p>OFFICIAL DRAW</p><h2>Team letter assignments</h2></div></div>
            <table className="report-table compact">
              <thead><tr><th>Letter</th><th>Team</th><th>Department</th><th>Group</th></tr></thead>
              <tbody>{sortedDraw.map((team) => <tr key={team.id}><td className="report-letter">{team.letter}</td><td><strong>{team.name}</strong></td><td>{team.department || '—'}</td><td>{team.group || '—'}</td></tr>)}</tbody>
            </table>
            {!sortedDraw.length && <p className="report-empty">Official draw has not been completed.</p>}
          </section>
        )}

        {show('schedule') && (
          <section className="report-sheet">
            <div className="report-sheet-title"><span>03</span><div><p>MATCH SCHEDULE</p><h2>Fixtures</h2></div></div>
            <table className="report-table">
              <thead><tr><th>Match</th><th>Round</th><th>Team A</th><th>Team B</th><th>Date</th><th>Time</th><th>Court</th></tr></thead>
              <tbody>{state.matches.map((match) => {
                const [aId, bId] = resolvedTeams(match, state.matches);
                return <tr key={match.id}><td>{match.matchNo}</td><td>{match.round || match.stage}</td><td>{name(aId)}</td><td>{name(bId)}</td><td>{match.date ? formatDate(match.date) : '—'}</td><td>{match.time || '—'}</td><td>{match.court || '—'}</td></tr>;
              })}</tbody>
            </table>
            {!state.matches.length && <p className="report-empty">No fixtures generated.</p>}
          </section>
        )}

        {show('results') && (
          <section className="report-sheet">
            <div className="report-sheet-title"><span>04</span><div><p>RESULTS</p><h2>Match results & standings</h2></div></div>
            <table className="report-table">
              <thead><tr><th>Match</th><th>Round</th><th>Fixture</th><th>Score</th><th>Outcome</th><th>Status</th></tr></thead>
              <tbody>{state.matches.map((match) => {
                const [aId, bId] = resolvedTeams(match, state.matches);
                const score = match.scoreA == null || match.scoreB == null ? '—' : `${match.scoreA} : ${match.scoreB}`;
                return <tr key={match.id}><td>{match.matchNo}</td><td>{match.round || match.stage}</td><td>{name(aId)} vs {name(bId)}</td><td><strong>{score}</strong></td><td>{matchOutcomeLabel(match) || 'Normal'}</td><td>{match.status}</td></tr>;
              })}</tbody>
            </table>

            {Object.keys(groups).length > 0 && (
              <div className="report-standings">
                {Object.keys(groups).sort().map((group) => (
                  <div key={group}>
                    <h3>{group}</h3>
                    <table className="report-table compact">
                      <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>SD</th><th>Pts</th></tr></thead>
                      <tbody>{groupStandings(state, group).map((row, index) => <tr key={row.team.id}><td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.l}</td><td>{row.sd}</td><td><strong>{row.pts}</strong></td></tr>)}</tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {show('bracket') && (
          <section className="report-sheet">
            <div className="report-sheet-title"><span>05</span><div><p>KNOCKOUT</p><h2>Bracket pathway</h2></div></div>
            {knockoutMatches.length ? (
              <div className="report-bracket">
                {[...new Set(knockoutMatches.map((match) => match.round))].map((round) => (
                  <div className="report-bracket-round" key={round}>
                    <h3>{round}</h3>
                    {knockoutMatches.filter((match) => match.round === round).map((match) => {
                      const [aId, bId] = resolvedTeams(match, state.matches);
                      return <div className="report-bracket-match" key={match.id}><span>M{match.matchNo}</span><strong>{name(aId)}</strong><em>{match.scoreA ?? '—'} : {match.scoreB ?? '—'}</em><strong>{name(bId)}</strong></div>;
                    })}
                  </div>
                ))}
              </div>
            ) : <p className="report-empty">No knockout bracket generated.</p>}
          </section>
        )}

        <footer className="report-print-footer">
          <span>{state.settings.tournamentName}</span>
          <span>Generated from Tournament Manager</span>
        </footer>
      </div>
    </AppShell>
  );
}
