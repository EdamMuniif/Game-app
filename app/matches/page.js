'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import {
  formatDate, groupStandings, groupedTeams, matchOutcomeLabel, resolvedTeams
} from '../../lib/tournament';

export default function MatchesPage() {
  const { state, updateMatch, rescheduleMatches, clearMatches, generateKnockoutFromGroups } = useTournament();
  const [editing, setEditing] = useState(null);
  const [fixtureEditing, setFixtureEditing] = useState(null);
  const [resultType, setResultType] = useState('normal');
  const [specialWinnerId, setSpecialWinnerId] = useState('');
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

  function teamName(id) {
    return teamMap[id]?.name || 'TBD';
  }

  function openResult(match, aId, bId) {
    setEditing({ ...match, aId, bId, aName: teamName(aId), bName: teamName(bId) });
    setResultType(match.resultType || 'normal');
    setSpecialWinnerId(match.winnerOverrideId || '');
  }

  function saveScore(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const note = String(data.get('resultNote') || '').trim();

    if (resultType === 'walkover' || resultType === 'forfeit') {
      if (![editing.aId, editing.bId].includes(specialWinnerId)) {
        setMessage('Choose the team that is awarded the match.');
        return;
      }
      const winningSets = Math.max(1, Math.ceil(Number(state.settings.bestOfSets || 3) / 2));
      const winnerIsA = specialWinnerId === editing.aId;
      updateMatch(editing.id, {
        scoreA: winnerIsA ? winningSets : 0,
        scoreB: winnerIsA ? 0 : winningSets,
        status: 'final',
        resultType,
        winnerOverrideId: specialWinnerId,
        resultNote: note,
        timer: editing.timer ? { ...editing.timer, phase: 'finished', running: false, startedAt: null } : editing.timer
      });
      setEditing(null);
      setMessage(`${resultType === 'walkover' ? 'Walkover' : 'Forfeit'} recorded. Winner advanced where applicable.`);
      return;
    }

    const scoreA = Number(data.get('scoreA'));
    const scoreB = Number(data.get('scoreB'));
    const status = data.get('status');
    if (status === 'final' && scoreA === scoreB) {
      setMessage('A final match cannot end in a tie.');
      return;
    }
    updateMatch(editing.id, {
      scoreA,
      scoreB,
      status,
      resultType: 'normal',
      winnerOverrideId: null,
      resultNote: note
    });
    setEditing(null);
    setMessage('Result saved.');
  }

  function saveFixture(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateMatch(fixtureEditing.id, {
      date: String(data.get('date') || ''),
      time: String(data.get('time') || ''),
      court: String(data.get('court') || '').trim()
    });
    setFixtureEditing(null);
    setMessage('Fixture date, time and court updated.');
  }

  function advance() {
    try {
      generateKnockoutFromGroups();
      setMessage('Knockout stage generated.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <AppShell pageTitle="Matches">
      {message && <div className="notice">{message}</div>}

      <section className="panel match-toolbar">
        <div>
          <p className="eyebrow">MATCH CONTROL</p>
          <h3>Fixtures & results</h3>
          <p className="muted">{state.matches.length ? `${state.matches.length} fixtures • ${state.matches.filter((match) => match.status === 'final').length} completed` : 'Generate fixtures after completing the draw.'}</p>
          <div className="timing-chips">
            <span>{state.settings.halfMinutes} min half / period</span>
            <span>{state.settings.breakMinutes} min break</span>
            <span>{state.settings.betweenMatchesMinutes} min between matches</span>
          </div>
        </div>
        <div className="button-row">
          <Link className="btn btn-primary" href="/control">Open match control</Link>
          <Link className="btn btn-ghost" href="/reports">Print / PDF</Link>
          <button className="btn btn-ghost" disabled={!state.matches.length} onClick={() => { rescheduleMatches(); setMessage('Match schedule recalculated from Settings.'); }}>Rebuild schedule</button>
          <button className="btn btn-ghost" disabled={!state.matches.length} onClick={() => { if (window.confirm('Clear all fixtures and results?')) clearMatches(); }}>Clear fixtures</button>
          {canAdvance && <button className="btn btn-primary" disabled={!allGroupsFinal} onClick={advance}>Generate knockout</button>}
        </div>
      </section>

      {groupMatches.length > 0 && (
        <section className="standings-wrap">
          <div className="panel-head"><div><p className="eyebrow">GROUP STANDINGS</p><h3>Live table</h3></div></div>
          <div className="standings-grid">
            {groupNames.map((group) => (
              <article className="standings-card" key={group}>
                <h4>{group}</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>SD</th><th>Pts</th></tr></thead>
                    <tbody>{groupStandings(state, group).map((row, index) => (
                      <tr key={row.team.id} className={index < state.settings.advancePerGroup && state.settings.format === 'groups_knockout' ? 'qualifier' : ''}>
                        <td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.l}</td><td>{row.sd}</td><td><strong>{row.pts}</strong></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!state.matches.length ? (
        <section className="panel empty-state"><span>🏐</span><strong>No fixtures yet</strong><p>Complete the team draw and generate fixtures.</p></section>
      ) : Object.entries(blocks).map(([stage, stageMatches]) => (
        <section className="stage-block" key={stage}>
          <div className="stage-header"><h3>{stage}</h3><span className="chip">{stageMatches.length} match{stageMatches.length === 1 ? '' : 'es'}</span></div>
          {stageMatches.map((match) => {
            const [aId, bId] = resolvedTeams(match, state.matches);
            const score = match.scoreA == null || match.scoreB == null ? '—' : `${match.scoreA} : ${match.scoreB}`;
            const outcome = matchOutcomeLabel(match);
            return (
              <article className="match-card" key={match.id}>
                <div className="match-no">Match {match.matchNo}</div>
                <div className={!aId ? 'team-slot tbd' : 'team-slot'}>{teamName(aId)}</div>
                <div className="score-badge">{score}</div>
                <div className={!bId ? 'team-slot tbd' : 'team-slot'}>{teamName(bId)}</div>
                <div>
                  <span className={`match-status status-${match.status}`}>{match.status}</span>
                  {outcome && <span className={`outcome-badge outcome-${match.resultType}`}>{outcome}</span>}
                </div>
                <div className="match-actions">
                  <button className="btn btn-ghost" disabled={!(aId && bId)} onClick={() => openResult(match, aId, bId)}>Result</button>
                  <button className="btn btn-ghost" onClick={() => setFixtureEditing({ ...match, aName: teamName(aId), bName: teamName(bId) })}>Edit</button>
                </div>
                <div className="match-meta">
                  <span>{match.date ? formatDate(match.date) : 'Date TBD'}</span>
                  <strong>{match.time || 'Time TBD'}</strong>
                  <span>{match.court || 'Court TBD'}</span>
                  {match.resultNote && <span>Note: {match.resultNote}</span>}
                </div>
              </article>
            );
          })}
        </section>
      ))}

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <div><p className="eyebrow">MATCH RESULT</p><h3>Update result</h3></div>
              <button className="icon-btn" onClick={() => setEditing(null)}>×</button>
            </div>
            <form className="stack-form" onSubmit={saveScore}>
              <label>Result type
                <select value={resultType} onChange={(event) => { setResultType(event.target.value); if (event.target.value === 'normal') setSpecialWinnerId(''); }}>
                  <option value="normal">Normal result</option>
                  <option value="walkover">Walkover</option>
                  <option value="forfeit">Forfeit</option>
                </select>
              </label>

              {resultType === 'normal' ? (
                <>
                  <div className="score-teams">
                    <div><span>{editing.aName}</span><input name="scoreA" type="number" min="0" max="99" defaultValue={editing.scoreA ?? 0} required /></div>
                    <strong>—</strong>
                    <div><span>{editing.bName}</span><input name="scoreB" type="number" min="0" max="99" defaultValue={editing.scoreB ?? 0} required /></div>
                  </div>
                  <label>Status
                    <select name="status" defaultValue={editing.status}>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="final">Final</option>
                    </select>
                  </label>
                </>
              ) : (
                <div className="special-result-box">
                  <strong>{resultType === 'walkover' ? 'Walkover' : 'Forfeit'}</strong>
                  <p>The selected winner will be marked Final and advanced automatically. The score is set from the configured best-of format.</p>
                  <label>Award match to
                    <select value={specialWinnerId} onChange={(event) => setSpecialWinnerId(event.target.value)} required>
                      <option value="">Choose winner</option>
                      <option value={editing.aId}>{editing.aName}</option>
                      <option value={editing.bId}>{editing.bName}</option>
                    </select>
                  </label>
                </div>
              )}

              <label>Official note
                <textarea name="resultNote" rows="3" defaultValue={editing.resultNote || ''} placeholder="Optional reason or official note" />
              </label>

              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Save result</button>
                <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fixtureEditing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <div><p className="eyebrow">FIXTURE EDITOR</p><h3>Match {fixtureEditing.matchNo}</h3></div>
              <button className="icon-btn" onClick={() => setFixtureEditing(null)}>×</button>
            </div>
            <div className="fixture-pairing-lock"><strong>{fixtureEditing.aName}</strong><span>vs</span><strong>{fixtureEditing.bName}</strong></div>
            <p className="muted">Team pairing is locked here to protect the knockout bracket. Date, time and court can be adjusted manually.</p>
            <form className="stack-form" onSubmit={saveFixture}>
              <label>Match date<input name="date" type="date" defaultValue={fixtureEditing.date || state.settings.date || ''} /></label>
              <label>Start time<input name="time" type="time" defaultValue={fixtureEditing.time || ''} /></label>
              <label>Court / venue area<input name="court" maxLength="40" defaultValue={fixtureEditing.court || ''} placeholder="e.g. Court 1" /></label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Save fixture</button>
                <button className="btn btn-ghost" type="button" onClick={() => setFixtureEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
