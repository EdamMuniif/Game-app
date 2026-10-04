'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { groupedTeams } from '../../lib/tournament';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function DrawPage() {
  const router = useRouter();
  const { state, assignDrawLetter, resetDraw, generateFixtures } = useTournament();
  const [message, setMessage] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamDisplay, setTeamDisplay] = useState('READY');
  const [letterDisplay, setLetterDisplay] = useState('A');
  const [spinningTeam, setSpinningTeam] = useState(false);
  const [spinningLetter, setSpinningLetter] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const teamIntervalRef = useRef(null);
  const teamTimeoutRef = useRef(null);
  const letterIntervalRef = useRef(null);
  const letterTimeoutRef = useRef(null);

  const selectedTeam = state.teams.find((team) => team.id === selectedTeamId) || null;
  const assignedTeams = useMemo(
    () => state.teams.filter((team) => team.letter).sort((a, b) => a.letter.localeCompare(b.letter)),
    [state.teams]
  );
  const unassignedTeams = useMemo(
    () => state.teams.filter((team) => !team.letter && team.id !== selectedTeamId),
    [state.teams, selectedTeamId]
  );
  const usedLetters = useMemo(() => new Set(state.teams.map((team) => team.letter).filter(Boolean)), [state.teams]);
  const availableLetters = useMemo(() => ALPHABET.filter((letter) => !usedLetters.has(letter)), [usedLetters]);
  const drawn = state.teams.length > 0 && state.teams.every((team) => team.letter);
  const ordered = [...assignedTeams];
  const groups = groupedTeams(state.teams);

  useEffect(() => () => {
    window.clearInterval(teamIntervalRef.current);
    window.clearTimeout(teamTimeoutRef.current);
    window.clearInterval(letterIntervalRef.current);
    window.clearTimeout(letterTimeoutRef.current);
  }, []);

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function startTeamSpin() {
    if (state.teams.length < 2) {
      setMessage('Add at least two teams before starting the draw.');
      return;
    }
    if (state.teams.length > 26) {
      setMessage('This draw supports a maximum of 26 teams because letters are limited to A–Z.');
      return;
    }
    if (selectedTeamId) {
      setMessage('Complete the letter spin for the selected team first.');
      return;
    }

    const pool = state.teams.filter((team) => !team.letter);
    if (!pool.length) {
      setMessage('All submitted teams already have draw letters.');
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
      setMessage(`${winner.name} selected. Now spin for the team letter.`);
    }, 1000);
  }

  function startLetterSpin() {
    if (!selectedTeam) {
      setMessage('Select a team with the team spinner first.');
      return;
    }
    if (!availableLetters.length) {
      setMessage('No letters remain in the A–Z pool.');
      return;
    }

    const letters = [...availableLetters];
    setMessage('');
    setSpinningLetter(true);
    setLetterDisplay(randomItem(letters));

    letterIntervalRef.current = window.setInterval(() => {
      setLetterDisplay(randomItem(letters));
    }, 70);

    letterTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(letterIntervalRef.current);
      const finalLetter = randomItem(letters);

      try {
        assignDrawLetter(selectedTeam.id, finalLetter);
        setLetterDisplay(finalLetter);
        setLastResult({ teamName: selectedTeam.name, letter: finalLetter });
        setSelectedTeamId('');
        setSpinningLetter(false);
        setMessage(`${selectedTeam.name} has been assigned letter ${finalLetter}.`);
      } catch (error) {
        setSpinningLetter(false);
        setMessage(error.message);
      }
    }, 1000);
  }

  function doReset() {
    if (spinningTeam || spinningLetter) return;
    const hasAssignments = state.teams.some((team) => team.letter);
    if (!hasAssignments || window.confirm('Reset all team and letter draw assignments and clear fixtures?')) {
      resetDraw();
      setSelectedTeamId('');
      setTeamDisplay('READY');
      setLetterDisplay('A');
      setLastResult(null);
      setMessage('Draw reset.');
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
          <p className="eyebrow">LIVE TEAM DRAW</p>
          <h3>Two-stage random draw</h3>
          <p className="muted">Spin one remaining team for 1 second, then spin one unused letter from A–Z for that team. Assigned teams and letters are removed from their pools.</p>
        </div>
        <div className="button-row">
          <span className="chip">{assignedTeams.length} / {state.teams.length} assigned</span>
          <button className="btn btn-ghost" disabled={spinningTeam || spinningLetter} onClick={doReset}>Reset draw</button>
        </div>
      </section>

      <section className="live-draw-grid">
        <article className="panel live-draw-card">
          <div className="draw-step-head">
            <span className="draw-step-no">1</span>
            <div>
              <p className="eyebrow">TEAM SPINNER</p>
              <h3>Pick a random team</h3>
            </div>
          </div>

          <div className={`spin-window team-spin-window ${spinningTeam ? 'spinning' : ''}`}>
            <small>{spinningTeam ? 'ROLLING TEAMS…' : selectedTeam ? 'SELECTED TEAM' : 'READY TO SPIN'}</small>
            <strong className="spin-value">{teamDisplay}</strong>
          </div>

          <button
            className="btn btn-primary spin-start-btn"
            disabled={spinningTeam || spinningLetter || Boolean(selectedTeamId) || drawn || state.teams.length < 2}
            onClick={startTeamSpin}
          >
            {spinningTeam ? 'SPINNING…' : drawn ? 'DRAW COMPLETE' : 'START TEAM SPIN'}
          </button>

          <div className="draw-pool">
            <div className="draw-pool-head">
              <strong>Teams still in draw</strong>
              <span>{unassignedTeams.length}</span>
            </div>
            <div className="draw-pool-list">
              {unassignedTeams.length ? unassignedTeams.map((team) => (
                <span key={team.id}>{team.name}</span>
              )) : <em>{selectedTeam ? 'Selected team moved to letter draw.' : 'No teams remaining.'}</em>}
            </div>
          </div>
        </article>

        <article className={`panel live-draw-card ${selectedTeam ? 'ready-for-letter' : ''}`}>
          <div className="draw-step-head">
            <span className="draw-step-no">2</span>
            <div>
              <p className="eyebrow">LETTER SPINNER</p>
              <h3>Assign A–Z</h3>
            </div>
          </div>

          <div className="selected-team-banner">
            <span>Team</span>
            <strong>{selectedTeam?.name || lastResult?.teamName || 'Waiting for team spin'}</strong>
          </div>

          <div className={`spin-window letter-spin-window ${spinningLetter ? 'spinning' : ''}`}>
            <small>{spinningLetter ? 'ROLLING LETTERS…' : selectedTeam ? 'READY FOR LETTER' : 'LETTER RESULT'}</small>
            <strong className="spin-value spin-letter">{letterDisplay}</strong>
          </div>

          <button
            className="btn btn-primary spin-start-btn"
            disabled={!selectedTeam || spinningTeam || spinningLetter}
            onClick={startLetterSpin}
          >
            {spinningLetter ? 'SPINNING…' : 'START LETTER SPIN'}
          </button>

          <div className="draw-pool">
            <div className="draw-pool-head">
              <strong>Unused letters</strong>
              <span>{availableLetters.length}</span>
            </div>
            <div className="letter-pool">
              {availableLetters.map((letter) => <span key={letter}>{letter}</span>)}
            </div>
          </div>
        </article>
      </section>

      {lastResult && (
        <section className="draw-result-flash" aria-live="polite">
          <span>{lastResult.letter}</span>
          <div><small>LATEST DRAW</small><strong>{lastResult.teamName}</strong></div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">SUBMITTED TEAMS</p><h3>Live letter assignments</h3></div>
          <span className="chip">{drawn ? 'Complete' : 'In progress'}</span>
        </div>
        {state.teams.length ? (
          <div className="draw-assignment-list">
            {state.teams.map((team, index) => (
              <div className={team.letter ? 'assigned' : ''} key={team.id}>
                <span className="assignment-number">{index + 1}</span>
                <strong>{team.name}</strong>
                <span className={team.letter ? 'assignment-letter' : 'assignment-letter pending'}>{team.letter || '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span>🏐</span><strong>No teams submitted</strong><p>Add teams before starting the draw.</p></div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">STRUCTURE PREVIEW</p><h3>{state.settings.format === 'knockout' ? 'Knockout letter order' : 'Group allocation'}</h3></div>
          <button className="btn btn-primary" disabled={!drawn || spinningTeam || spinningLetter} onClick={buildFixtures}>Generate fixtures</button>
        </div>
        {!drawn ? <p className="muted">Complete both spins for every submitted team to generate fixtures.</p> : state.settings.format === 'knockout' ? (
          <div className="preview-list">{ordered.map((team, index) => <div key={team.id}><span>{team.letter}</span><strong>{team.name}</strong><small>{index % 2 === 0 ? `Match ${Math.floor(index / 2) + 1} — side A` : `Match ${Math.floor(index / 2) + 1} — side B`}</small></div>)}</div>
        ) : (
          <div className="group-preview">{Object.entries(groups).sort().map(([group, teams]) => <article key={group}><h4>{group}</h4>{teams.sort((a, b) => a.letter.localeCompare(b.letter)).map((team) => <div key={team.id}><span>{team.letter}</span>{team.name}</div>)}</article>)}</div>
        )}
      </section>
    </AppShell>
  );
}
