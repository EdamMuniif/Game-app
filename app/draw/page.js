'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { drawLetters, drawSortValue, drawValue, groupedTeams, knockoutByeInfo } from '../../lib/tournament';

export default function DrawPage() {
  const router = useRouter();
  const {
    state,
    assignDrawLetter,
    assignDrawNumber,
    lockDraw,
    resetDraw,
    generateFixtures
  } = useTournament();

  const [message, setMessage] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamDisplay, setTeamDisplay] = useState('READY');
  const [valueDisplay, setValueDisplay] = useState('1');
  const [spinningTeam, setSpinningTeam] = useState(false);
  const [spinningValue, setSpinningValue] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const teamIntervalRef = useRef(null);
  const teamTimeoutRef = useRef(null);
  const valueIntervalRef = useRef(null);
  const valueTimeoutRef = useRef(null);

  const drawType = state.draw?.type || 'numbers';
  const locked = state.draw?.status === 'locked';
  const selectedTeam = state.teams.find((team) => team.id === selectedTeamId) || null;

  const values = useMemo(() => (
    drawType === 'letters'
      ? drawLetters(state.teams.length)
      : Array.from({ length: state.teams.length }, (_, index) => index + 1)
  ), [drawType, state.teams.length]);

  const assignedTeams = useMemo(
    () => state.teams.filter((team) => drawValue(team) != null).sort((a, b) => drawSortValue(a) - drawSortValue(b)),
    [state.teams]
  );

  const usedValues = useMemo(() => new Set(state.teams.map(drawValue).filter((value) => value != null).map(String)), [state.teams]);
  const availableValues = useMemo(() => values.filter((value) => !usedValues.has(String(value))), [values, usedValues]);
  const unassignedTeams = useMemo(
    () => state.teams.filter((team) => drawValue(team) == null && team.id !== selectedTeamId),
    [state.teams, selectedTeamId]
  );
  const complete = state.teams.length > 0 && state.teams.every((team) => drawValue(team) != null);
  const groups = groupedTeams(state.teams);
  const byeInfo = useMemo(
    () => state.settings.format === 'knockout' ? knockoutByeInfo(state.teams.length) : null,
    [state.settings.format, state.teams.length]
  );

  useEffect(() => () => {
    window.clearInterval(teamIntervalRef.current);
    window.clearTimeout(teamTimeoutRef.current);
    window.clearInterval(valueIntervalRef.current);
    window.clearTimeout(valueTimeoutRef.current);
  }, []);

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function spinDuration() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 1000;
  }

  function startTeamSpin() {
    if (locked) {
      setMessage('The official draw is locked. Reset it first if a redraw is required.');
      return;
    }
    if (state.teams.length < 2) {
      setMessage('Add at least two entries before starting the draw.');
      return;
    }
    if (selectedTeamId) {
      setMessage('Complete the draw position for the selected entry first.');
      return;
    }
    const pool = state.teams.filter((team) => drawValue(team) == null);
    if (!pool.length) {
      setMessage('All entries already have draw positions.');
      return;
    }

    setMessage('');
    setLastResult(null);
    setSpinningTeam(true);
    setTeamDisplay(randomItem(pool).name);

    teamIntervalRef.current = window.setInterval(() => {
      setTeamDisplay(randomItem(pool).name);
    }, 70);

    teamTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(teamIntervalRef.current);
      const winner = randomItem(pool);
      setTeamDisplay(winner.name);
      setSelectedTeamId(winner.id);
      setSpinningTeam(false);
      setMessage(winner.name + ' selected. Now spin for the draw ' + (drawType === 'letters' ? 'letter.' : 'number.'));
    }, spinDuration());
  }

  function startValueSpin() {
    if (!selectedTeam) {
      setMessage('Select an entry with the team spinner first.');
      return;
    }
    if (!availableValues.length) {
      setMessage('No draw positions remain.');
      return;
    }

    const pool = [...availableValues];
    setMessage('');
    setSpinningValue(true);
    setValueDisplay(String(randomItem(pool)));

    valueIntervalRef.current = window.setInterval(() => {
      setValueDisplay(String(randomItem(pool)));
    }, 70);

    valueTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(valueIntervalRef.current);
      const finalValue = randomItem(pool);

      try {
        if (drawType === 'letters') assignDrawLetter(selectedTeam.id, finalValue);
        else assignDrawNumber(selectedTeam.id, finalValue);
        setValueDisplay(String(finalValue));
        setLastResult({ teamName: selectedTeam.name, value: finalValue });
        setSelectedTeamId('');
        setSpinningValue(false);
        setMessage(selectedTeam.name + ' has been assigned ' + finalValue + '.');
      } catch (error) {
        setSpinningValue(false);
        setMessage(error.message);
      }
    }, spinDuration());
  }

  function doReset() {
    if (spinningTeam || spinningValue) return;
    const hasAssignments = state.teams.some((team) => drawValue(team) != null);
    if (!hasAssignments || window.confirm('Reset all draw assignments and clear fixtures? This requires a new official draw.')) {
      resetDraw();
      setSelectedTeamId('');
      setTeamDisplay('READY');
      setValueDisplay(drawType === 'letters' ? 'A' : '1');
      setLastResult(null);
      setMessage('Draw reset.');
    }
  }

  function confirmLock() {
    if (!complete) {
      setMessage('Complete all draw assignments first.');
      return;
    }
    if (!window.confirm('Confirm and lock this official draw? Changes after locking require a reset.')) return;
    try {
      lockDraw();
      setMessage('Official draw locked.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function buildFixtures() {
    try {
      generateFixtures();
      router.push('/matches');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <AppShell pageTitle="Draw">
      {message && <div className="notice">{message}</div>}

      <section className="panel draw-toolbar">
        <div>
          <p className="eyebrow">OFFICIAL TEAM DRAW</p>
          <h3>{drawType === 'letters' ? 'Legacy letter draw' : 'Unique number draw'}</h3>
          <p className="muted">
            Each entry receives one unique {drawType === 'letters' ? 'letter' : 'number from 1 to ' + state.teams.length}. Confirm and lock the result before generating fixtures.
          </p>
        </div>
        <div className="button-row">
          <span className="chip">{assignedTeams.length} / {state.teams.length} assigned</span>
          <span className={'status-pill ' + (locked ? 'status-completed' : 'status-upcoming')}>{locked ? 'Locked' : state.draw?.status || 'Not started'}</span>
          {!locked && complete && <button className="btn btn-primary" type="button" onClick={confirmLock}>Confirm & lock</button>}
          <button className="btn btn-ghost" type="button" disabled={spinningTeam || spinningValue} onClick={doReset}>Reset draw</button>
        </div>
      </section>

      <section className="live-draw-grid">
        <article className="panel live-draw-card">
          <div className="draw-step-head">
            <span className="draw-step-no">1</span>
            <div><p className="eyebrow">ENTRY SPINNER</p><h3>Pick a random entry</h3></div>
          </div>

          <div className={'spin-window team-spin-window ' + (spinningTeam ? 'spinning' : '')}>
            <small>{spinningTeam ? 'ROLLING ENTRIES…' : selectedTeam ? 'SELECTED ENTRY' : 'READY TO SPIN'}</small>
            <strong className="spin-value">{teamDisplay}</strong>
          </div>

          <button
            className="btn btn-primary spin-start-btn"
            type="button"
            disabled={locked || spinningTeam || spinningValue || Boolean(selectedTeamId) || complete || state.teams.length < 2}
            onClick={startTeamSpin}
          >
            {spinningTeam ? 'SPINNING…' : complete ? 'DRAW COMPLETE' : 'START ENTRY SPIN'}
          </button>

          <div className="draw-pool">
            <div className="draw-pool-head"><strong>Entries still in draw</strong><span>{unassignedTeams.length}</span></div>
            <div className="draw-pool-list">
              {unassignedTeams.length
                ? unassignedTeams.map((team) => <span key={team.id}>{team.name}</span>)
                : <em>{selectedTeam ? 'Selected entry moved to position draw.' : 'No entries remaining.'}</em>}
            </div>
          </div>
        </article>

        <article className={'panel live-draw-card ' + (selectedTeam ? 'ready-for-letter' : '')}>
          <div className="draw-step-head">
            <span className="draw-step-no">2</span>
            <div><p className="eyebrow">POSITION SPINNER</p><h3>{drawType === 'letters' ? 'Assign letter' : 'Assign number'}</h3></div>
          </div>

          <div className="selected-team-banner">
            <span>Entry</span>
            <strong>{selectedTeam?.name || lastResult?.teamName || 'Waiting for entry spin'}</strong>
          </div>

          <div className={'spin-window letter-spin-window ' + (spinningValue ? 'spinning' : '')}>
            <small>{spinningValue ? 'ROLLING POSITIONS…' : selectedTeam ? 'READY FOR POSITION' : 'DRAW RESULT'}</small>
            <strong className="spin-value spin-letter">{valueDisplay}</strong>
          </div>

          <button
            className="btn btn-primary spin-start-btn"
            type="button"
            disabled={locked || !selectedTeam || spinningTeam || spinningValue}
            onClick={startValueSpin}
          >
            {spinningValue ? 'SPINNING…' : 'START POSITION SPIN'}
          </button>

          <div className="draw-pool">
            <div className="draw-pool-head"><strong>Unused positions</strong><span>{availableValues.length}</span></div>
            <div className={drawType === 'letters' ? 'letter-pool' : 'number-pool'}>
              {availableValues.map((value) => <span key={value}>{value}</span>)}
            </div>
          </div>
        </article>
      </section>

      {lastResult && (
        <section className="draw-result-flash" aria-live="polite">
          <span>{lastResult.value}</span>
          <div><small>LATEST DRAW</small><strong>{lastResult.teamName}</strong></div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">DRAW ASSIGNMENTS</p><h3>Official positions</h3></div>
          <span className="chip">{locked ? 'Locked' : complete ? 'Complete — not locked' : 'In progress'}</span>
        </div>
        {state.teams.length ? (
          <div className="draw-assignment-list">
            {state.teams.map((team, index) => (
              <div className={drawValue(team) != null ? 'assigned' : ''} key={team.id}>
                <span className="assignment-number">{index + 1}</span>
                <strong>{team.name}</strong>
                <span className={drawValue(team) != null ? 'assignment-letter' : 'assignment-letter pending'}>{drawValue(team) ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span>🏆</span><strong>No entries submitted</strong><p>Add entries before starting the draw.</p></div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">STRUCTURE PREVIEW</p><h3>{state.settings.format === 'knockout' ? 'Knockout order' : 'Competition allocation'}</h3></div>
          <button className="btn btn-primary" type="button" disabled={!locked || spinningTeam || spinningValue} onClick={buildFixtures}>Generate fixtures</button>
        </div>

        {!complete ? <p className="muted">Complete the draw for every entry first.</p> : state.settings.format === 'knockout' ? (
          <>
            {byeInfo?.byeCount > 0 && (
              <div className="bye-notice">
                <strong>{byeInfo.byeCount} bye{byeInfo.byeCount === 1 ? '' : 's'}</strong>
                <span>Opening byes are created automatically. A bye is not counted as a played match.</span>
              </div>
            )}
            <div className="preview-list">
              {assignedTeams.map((team, index) => (
                <div key={team.id}>
                  <span>{drawValue(team)}</span>
                  <strong>{team.name}</strong>
                  <small>Bracket position {index + 1}</small>
                </div>
              ))}
            </div>
          </>
        ) : state.settings.format === 'round_robin' ? (
          <p className="muted">Every entry will play every other entry once. Odd entry counts receive a rest round.</p>
        ) : (
          <div className="group-preview">
            {Object.entries(groups).sort().map(([group, teams]) => (
              <article key={group}>
                <h4>{group}</h4>
                {teams.sort((a, b) => drawSortValue(a) - drawSortValue(b)).map((team) => <div key={team.id}><span>{drawValue(team)}</span>{team.name}</div>)}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
