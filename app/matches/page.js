'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { groupStandings, groupedTeams, resolvedTeams } from '../../lib/tournament';

export default function MatchesPage() {
  const { state, updateMatch, clearMatches, generateKnockoutFromGroups } = useTournament();
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const teamMap = useMemo(() => Object.fromEntries(state.teams.map((team) => [team.id, team])), [state.teams]);
  const groupNames = Object.keys(groupedTeams(state.teams)).sort();
  const groupMatches = state.matches.filter((match) => match.kind === 'group');
  const canAdvance = state.settings.format === 'groups_knockout' && groupMatches.length > 0 && !state.matches.some((match) => match.kind === 'knockout');
  const allGroupsFinal = groupMatches.length > 0 && groupMatches.every((match) => match.status === 'final');

  const blocks = state.matches.reduce((all, match) => {
    const key = match.kind === 'group' ? match.stage : `${match.stage} — ${match.round}`;
    (all[key] ||= []).push(match);
    return all;
  }, {});

  function teamName(id) { return teamMap[id]?.name || 'TBD'; }

  function saveScore(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const scoreA = Number(data.get('scoreA'));
    const scoreB = Number(data.get('scoreB'));
    const status = data.get('status');
    if (status === 'final' && scoreA === scoreB) { setMessage('A final match cannot end in a tie.'); return; }
    updateMatch(editing.id, { scoreA, scoreB, status });
    setEditing(null); setMessage('Result saved.');
  }

  function advance() {
    try { generateKnockoutFromGroups(); setMessage('Knockout stage generated.'); } catch (error) { setMessage(error.message); }
  }

  return (
    <AppShell pageTitle="Matches">
      {message && <div className="notice">{message}</div>}
      <section className="panel match-toolbar">
        <div><p className="eyebrow">MATCH CONTROL</p><h3>Fixtures & results</h3><p className="muted">{state.matches.length ? `${state.matches.length} fixtures • ${state.matches.filter((match) => match.status === 'final').length} completed` : 'Generate fixtures after completing the draw.'}</p></div>
        <div className="button-row">
          <button className="btn btn-ghost" disabled={!state.matches.length} onClick={() => { if (window.confirm('Clear all fixtures and results?')) clearMatches(); }}>Clear fixtures</button>
          {canAdvance && <button className="btn btn-primary" disabled={!allGroupsFinal} onClick={advance}>Generate knockout</button>}
        </div>
      </section>

      {groupMatches.length > 0 && <section className="standings-wrap"><div className="panel-head"><div><p className="eyebrow">GROUP STANDINGS</p><h3>Live table</h3></div></div><div className="standings-grid">
        {groupNames.map((group) => <article className="standings-card" key={group}><h4>{group}</h4><div className="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>SD</th><th>Pts</th></tr></thead><tbody>{groupStandings(state, group).map((row, index) => <tr key={row.team.id} className={index < state.settings.advancePerGroup && state.settings.format === 'groups_knockout' ? 'qualifier' : ''}><td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.l}</td><td>{row.sd}</td><td><strong>{row.pts}</strong></td></tr>)}</tbody></table></div></article>)}
      </div></section>}

      {!state.matches.length ? <section className="panel empty-state"><span>🏐</span><strong>No fixtures yet</strong><p>Complete the team draw and generate fixtures.</p></section> : Object.entries(blocks).map(([stage, matches]) => (
        <section className="stage-block" key={stage}><div className="stage-header"><h3>{stage}</h3><span className="chip">{matches.length} match{matches.length === 1 ? '' : 'es'}</span></div>{matches.map((match) => {
          const [aId, bId] = resolvedTeams(match, state.matches);
          const score = match.scoreA == null || match.scoreB == null ? '—' : `${match.scoreA} : ${match.scoreB}`;
          return <article className="match-card" key={match.id}><div className="match-no">Match {match.matchNo}</div><div className={!aId ? 'team-slot tbd' : 'team-slot'}>{teamName(aId)}</div><div className="score-badge">{score}</div><div className={!bId ? 'team-slot tbd' : 'team-slot'}>{teamName(bId)}</div><div><span className={`match-status status-${match.status}`}>{match.status}</span></div><div><button className="btn btn-ghost" disabled={!(aId && bId)} onClick={() => setEditing({ ...match, aName: teamName(aId), bName: teamName(bId) })}>Score</button></div></article>;
        })}</section>
      ))}

      {editing && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><div className="modal-head"><div><p className="eyebrow">MATCH RESULT</p><h3>Update score</h3></div><button className="icon-btn" onClick={() => setEditing(null)}>×</button></div><form className="stack-form" onSubmit={saveScore}><div className="score-teams"><div><span>{editing.aName}</span><input name="scoreA" type="number" min="0" max="9" defaultValue={editing.scoreA ?? 0} required /></div><strong>—</strong><div><span>{editing.bName}</span><input name="scoreB" type="number" min="0" max="9" defaultValue={editing.scoreB ?? 0} required /></div></div><label>Status<select name="status" defaultValue={editing.status}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select></label><div className="form-actions"><button className="btn btn-primary" type="submit">Save result</button><button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form></div></div>}
    </AppShell>
  );
}
