'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import {
  formatDate,
  groupStandings,
  groupedTeams,
  matchOutcomeLabel,
  resolvedTeams,
  sportScoringMode
} from '../../lib/tournament';

function blankPeriods(count, existing = []) {
  return Array.from({ length: count }, (_, index) => ({
    a: existing[index]?.a ?? '',
    b: existing[index]?.b ?? ''
  }));
}

export default function MatchesPage() {
  const {
    state,
    updateMatch,
    saveSportResult,
    rescheduleMatches,
    publishSchedule,
    clearMatches,
    generateKnockoutFromGroups
  } = useTournament();

  const [editing, setEditing] = useState(null);
  const [fixtureEditing, setFixtureEditing] = useState(null);
  const [resultType, setResultType] = useState('normal');
  const [specialWinnerId, setSpecialWinnerId] = useState('');
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [status, setStatus] = useState('final');
  const [tieBreakWinnerId, setTieBreakWinnerId] = useState('');
  const [tieBreakType, setTieBreakType] = useState(state.settings.knockoutTieBreak || 'penalties');
  const [periods, setPeriods] = useState([]);
  const [message, setMessage] = useState('');

  const teamMap = useMemo(() => Object.fromEntries(state.teams.map((team) => [team.id, team])), [state.teams]);
  const groupNames = Object.keys(groupedTeams(state.teams)).sort();
  const groupMatches = state.matches.filter((match) => match.kind === 'group');
  const canAdvance = state.settings.format === 'groups_knockout' && groupMatches.length > 0 && !state.matches.some((match) => match.kind === 'knockout');
  const allGroupsFinal = groupMatches.length > 0 && groupMatches.every((match) => match.status === 'final');
  const scoringMode = sportScoringMode(state.settings.sport);
  const unscheduled = state.matches.filter((match) => !match.date || !match.time || !match.court || match.scheduleStatus === 'unscheduled').length;

  const blocks = state.matches.reduce((all, match) => {
    const key = match.kind === 'group' ? match.stage : match.stage + ' — ' + match.round;
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
    setScoreA(String(match.scoreA ?? 0));
    setScoreB(String(match.scoreB ?? 0));
    setStatus(match.status === 'final' ? 'final' : 'final');
    setTieBreakWinnerId(match.resultDetails?.tieBreak?.winnerId || '');
    setTieBreakType(match.resultDetails?.tieBreak?.type || state.settings.knockoutTieBreak || 'penalties');

    const bestOf = scoringMode === 'sets'
      ? Number(state.settings.bestOfSets) || 3
      : scoringMode === 'games'
        ? Number(state.settings.bestOfGames) || 3
        : 0;
    setPeriods(bestOf ? blankPeriods(bestOf, match.resultDetails?.periods || []) : []);
  }

  function saveScore(event) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const note = String(data.get('resultNote') || '').trim();

    try {
      if (resultType === 'walkover' || resultType === 'forfeit') {
        if (![editing.aId, editing.bId].includes(specialWinnerId)) {
          throw new Error('Choose the participant that is awarded the match.');
        }
        const bestOf = scoringMode === 'sets'
          ? Number(state.settings.bestOfSets) || 3
          : scoringMode === 'games'
            ? Number(state.settings.bestOfGames) || 3
            : 1;
        const winningCount = Math.max(1, Math.ceil(bestOf / 2));
        const winnerIsA = specialWinnerId === editing.aId;
        updateMatch(editing.id, {
          scoreA: winnerIsA ? winningCount : 0,
          scoreB: winnerIsA ? 0 : winningCount,
          status: 'final',
          resultType,
          winnerOverrideId: specialWinnerId,
          resultParticipantIds: [editing.aId, editing.bId],
          resultNote: note,
          timer: editing.timer ? { ...editing.timer, phase: 'finished', running: false, startedAt: null } : editing.timer
        });
        setMessage((resultType === 'walkover' ? 'Walkover' : 'Forfeit') + ' recorded.');
      } else {
        saveSportResult(editing.id, {
          status,
          scoreA,
          scoreB,
          periods,
          tieBreakWinnerId,
          tieBreakType
        });
        if (note) updateMatch(editing.id, { resultNote: note });
        setMessage('Official result saved. Standings and bracket were recalculated.');
      }
      setEditing(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function saveFixture(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      updateMatch(fixtureEditing.id, {
        date: String(data.get('date') || ''),
        time: String(data.get('time') || ''),
        court: String(data.get('court') || '').trim(),
        scheduleLocked: data.get('scheduleLocked') === 'on'
      });
      setFixtureEditing(null);
      setMessage('Fixture schedule updated.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function rebuildSchedule() {
    try {
      rescheduleMatches();
      setMessage('Schedule recalculated. Completed, live, and manually locked matches were preserved.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function publish() {
    try {
      publishSchedule();
      setMessage('Official schedule published.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function advance() {
    try {
      generateKnockoutFromGroups();
      setMessage('Knockout stage generated.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  const tiedKnockout = editing && editing.kind === 'knockout' && Number(scoreA) === Number(scoreB) && status === 'final';

  return (
    <AppShell pageTitle="Matches">
      {message && <div className="notice">{message}</div>}

      <section className="panel match-toolbar">
        <div>
          <p className="eyebrow">FIXTURES, SCHEDULE & RESULTS</p>
          <h3>{state.settings.sport} competition</h3>
          <p className="muted">
            {state.matches.length
              ? state.matches.length + ' fixtures • ' + state.matches.filter((match) => match.status === 'final').length + ' completed • ' + unscheduled + ' unscheduled'
              : 'Generate fixtures after completing and locking the draw.'}
          </p>
          <div className="timing-chips">
            <span>{state.settings.matchDurationMinutes} min slot</span>
            <span>{state.settings.minimumRestMinutes} min minimum rest</span>
            <span>{state.settings.betweenMatchesMinutes} min turnaround</span>
            {state.schedulePublishedAt && <span>Published v{state.scheduleVersion}</span>}
          </div>
        </div>
        <div className="button-row">
          <Link className="btn btn-primary" href="/control">Match control</Link>
          <Link className="btn btn-ghost" href="/reports">Reports / PDF</Link>
          <button className="btn btn-ghost" type="button" disabled={!state.matches.length} onClick={rebuildSchedule}>Generate schedule</button>
          <button className="btn btn-primary" type="button" disabled={!state.matches.length || unscheduled > 0} onClick={publish}>Publish schedule</button>
          <button className="btn btn-ghost" type="button" disabled={!state.matches.length} onClick={() => { if (window.confirm('Clear all fixtures and results?')) clearMatches(); }}>Clear fixtures</button>
          {canAdvance && <button className="btn btn-primary" type="button" disabled={!allGroupsFinal} onClick={advance}>Generate knockout</button>}
        </div>
      </section>

      {unscheduled > 0 && (
        <div className="schedule-warning">
          <strong>{unscheduled} match{unscheduled === 1 ? '' : 'es'} could not be scheduled.</strong>
          <span>Add another playing area, extend available hours, reduce rest time, or add another tournament date.</span>
        </div>
      )}

      {groupMatches.length > 0 && (
        <section className="standings-wrap">
          <div className="panel-head"><div><p className="eyebrow">STANDINGS</p><h3>Live competition table</h3></div></div>
          <div className="standings-grid">
            {groupNames.map((group) => (
              <article className="standings-card" key={group}>
                <h4>{group}</h4>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Entry</th><th>P</th><th>W</th><th>D</th><th>L</th><th>+/-</th><th>Pts</th></tr></thead>
                    <tbody>{groupStandings(state, group).map((row, index) => (
                      <tr key={row.team.id} className={index < state.settings.advancePerGroup && state.settings.format === 'groups_knockout' ? 'qualifier' : ''}>
                        <td>{index + 1}</td><td>{row.team.name}</td><td>{row.p}</td><td>{row.w}</td><td>{row.d}</td><td>{row.l}</td><td>{row.gd}</td><td><strong>{row.pts}</strong></td>
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
        <section className="panel empty-state"><span>🏆</span><strong>No fixtures yet</strong><p>Complete and lock the official draw, then generate fixtures.</p></section>
      ) : Object.entries(blocks).map(([stage, stageMatches]) => (
        <section className="stage-block" key={stage}>
          <div className="stage-header"><h3>{stage}</h3><span className="chip">{stageMatches.length} match{stageMatches.length === 1 ? '' : 'es'}</span></div>
          {stageMatches.map((match) => {
            const [aId, bId] = resolvedTeams(match, state.matches);
            const score = match.scoreA == null || match.scoreB == null ? '—' : match.scoreA + ' : ' + match.scoreB;
            const outcome = matchOutcomeLabel(match);
            return (
              <article className="match-card" key={match.id}>
                <div className="match-no">Match {match.matchNo}</div>
                <div className={!aId ? 'team-slot tbd' : 'team-slot'}>{teamName(aId)}</div>
                <div className="score-badge">{score}</div>
                <div className={!bId ? 'team-slot tbd' : 'team-slot'}>{teamName(bId)}</div>
                <div>
                  <span className={'match-status status-' + match.status}>{match.status}</span>
                  {outcome && <span className={'outcome-badge outcome-' + match.resultType}>{outcome}</span>}
                </div>
                <div className="match-actions">
                  <button className="btn btn-ghost" type="button" disabled={!(aId && bId)} onClick={() => openResult(match, aId, bId)}>Result</button>
                  <button className="btn btn-ghost" type="button" onClick={() => setFixtureEditing({ ...match, aName: teamName(aId), bName: teamName(bId) })}>Schedule</button>
                </div>
                <div className="match-meta">
                  <span>{match.date ? formatDate(match.date) : 'Date TBD'}</span>
                  <strong>{match.time || 'Time TBD'}</strong>
                  <span>{match.court || 'Area TBD'}</span>
                  {match.scheduleLocked && <span>Schedule locked</span>}
                  {match.resultNote && <span>Note: {match.resultNote}</span>}
                </div>
              </article>
            );
          })}
        </section>
      ))}

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal sport-result-modal">
            <div className="modal-head">
              <div><p className="eyebrow">{state.settings.sport.toUpperCase()} RESULT</p><h3>Match {editing.matchNo}</h3></div>
              <button className="icon-btn" type="button" onClick={() => setEditing(null)}>×</button>
            </div>

            <div className="fixture-pairing-lock"><strong>{editing.aName}</strong><span>vs</span><strong>{editing.bName}</strong></div>

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
                  {(scoringMode === 'sets' || scoringMode === 'games') ? (
                    <div className="period-score-editor">
                      <div className="period-score-head"><span>{scoringMode === 'sets' ? 'Set' : 'Game'}</span><strong>{editing.aName}</strong><strong>{editing.bName}</strong></div>
                      {periods.map((period, index) => (
                        <div className="period-score-row" key={index}>
                          <span>{index + 1}</span>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={period.a}
                            onChange={(event) => setPeriods((current) => current.map((item, position) => position === index ? { ...item, a: event.target.value } : item))}
                            aria-label={editing.aName + ' ' + scoringMode + ' ' + (index + 1)}
                          />
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={period.b}
                            onChange={(event) => setPeriods((current) => current.map((item, position) => position === index ? { ...item, b: event.target.value } : item))}
                            aria-label={editing.bName + ' ' + scoringMode + ' ' + (index + 1)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="score-teams">
                      <div><span>{editing.aName}</span><input type="number" min="0" max="999" value={scoreA} onChange={(event) => setScoreA(event.target.value)} required /></div>
                      <strong>—</strong>
                      <div><span>{editing.bName}</span><input type="number" min="0" max="999" value={scoreB} onChange={(event) => setScoreB(event.target.value)} required /></div>
                    </div>
                  )}

                  <label>Status
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="final">Final</option>
                    </select>
                  </label>

                  {tiedKnockout && (
                    <div className="special-result-box">
                      <strong>Tie-break required</strong>
                      <p>A knockout match cannot finish level. Record the method and official winner.</p>
                      <label>Tie-break method
                        <select value={tieBreakType} onChange={(event) => setTieBreakType(event.target.value)}>
                          <option value="penalties">Penalties</option>
                          <option value="extra_time">Extra time</option>
                          <option value="direct_penalties">Direct penalties</option>
                          <option value="manual">Manual decision</option>
                        </select>
                      </label>
                      <label>Winner
                        <select value={tieBreakWinnerId} onChange={(event) => setTieBreakWinnerId(event.target.value)}>
                          <option value="">Choose winner</option>
                          <option value={editing.aId}>{editing.aName}</option>
                          <option value={editing.bId}>{editing.bName}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <div className="special-result-box">
                  <strong>{resultType === 'walkover' ? 'Walkover' : 'Forfeit'}</strong>
                  <p>The selected winner will be marked final and advanced automatically.</p>
                  <label>Award match to
                    <select value={specialWinnerId} onChange={(event) => setSpecialWinnerId(event.target.value)} required>
                      <option value="">Choose winner</option>
                      <option value={editing.aId}>{editing.aName}</option>
                      <option value={editing.bId}>{editing.bName}</option>
                    </select>
                  </label>
                </div>
              )}

              <label>Official note<textarea name="resultNote" rows="3" defaultValue={editing.resultNote || ''} placeholder="Optional reason or official note" /></label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Save official result</button>
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
              <div><p className="eyebrow">SCHEDULE EDITOR</p><h3>Match {fixtureEditing.matchNo}</h3></div>
              <button className="icon-btn" type="button" onClick={() => setFixtureEditing(null)}>×</button>
            </div>
            <div className="fixture-pairing-lock"><strong>{fixtureEditing.aName}</strong><span>vs</span><strong>{fixtureEditing.bName}</strong></div>
            <p className="muted">Conflicting playing areas, participant overlaps, blocked periods, and insufficient rest are rejected.</p>
            <form className="stack-form" onSubmit={saveFixture}>
              <label>Match date<input name="date" type="date" defaultValue={fixtureEditing.date || state.settings.date || ''} /></label>
              <label>Start time<input name="time" type="time" defaultValue={fixtureEditing.time || ''} /></label>
              <label>Playing area
                <select name="court" defaultValue={fixtureEditing.court || ''}>
                  <option value="">Choose area</option>
                  {(state.settings.playingAreas || []).map((area) => <option key={area}>{area}</option>)}
                </select>
              </label>
              <label className="captain-check">
                <input name="scheduleLocked" type="checkbox" defaultChecked={Boolean(fixtureEditing.scheduleLocked)} />
                <span>Lock this assignment during automatic rescheduling</span>
              </label>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Save schedule</button>
                <button className="btn btn-ghost" type="button" onClick={() => setFixtureEditing(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
