'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import {
  formatDate, formatTimer, resolvedTeams, timerElapsedSeconds,
  timerPhaseLabel, timerRemainingSeconds
} from '../../lib/tournament';

export default function MatchControlPage() {
  const { state, updateMatch } = useTournament();
  const [selectedId, setSelectedId] = useState('');
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const teamMap = useMemo(
    () => Object.fromEntries(state.teams.map((team) => [team.id, team])),
    [state.teams]
  );

  const playableMatches = useMemo(() => state.matches.filter((match) => {
    if (match.status === 'final') return false;
    const [a, b] = resolvedTeams(match, state.matches);
    return Boolean(a && b);
  }), [state.matches]);

  const liveMatches = useMemo(
    () => state.matches.filter((match) => match.status === 'live'),
    [state.matches]
  );

  useEffect(() => {
    const currentExists = playableMatches.some((match) => match.id === selectedId);
    if (!currentExists) {
      const preferred = liveMatches[0] || playableMatches[0];
      setSelectedId(preferred?.id || '');
    }
  }, [playableMatches, liveMatches, selectedId]);

  const selectedMatch = state.matches.find((match) => match.id === selectedId) || null;
  const [teamAId, teamBId] = selectedMatch ? resolvedTeams(selectedMatch, state.matches) : [null, null];

  useEffect(() => {
    if (!selectedMatch) return;
    setScoreA(Number(selectedMatch.scoreA ?? 0));
    setScoreB(Number(selectedMatch.scoreB ?? 0));
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (!selectedMatch?.timer?.running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [selectedMatch?.timer?.running, selectedMatch?.id]);

  function teamName(id) {
    return teamMap[id]?.name || 'TBD';
  }

  function beginPhase(phase, minutes) {
    if (!selectedMatch) return;
    const durationSec = Math.max(0, Number(minutes) || 0) * 60;
    updateMatch(selectedMatch.id, {
      status: 'live',
      timer: {
        phase,
        durationSec,
        elapsedSec: 0,
        startedAt: Date.now(),
        running: true
      }
    });
    setNow(Date.now());
    setMessage(`${timerPhaseLabel(phase)} started.`);
  }

  function startMatch() {
    beginPhase('period1', state.settings.halfMinutes);
  }

  function pauseTimer() {
    if (!selectedMatch?.timer) return;
    const elapsedSec = timerElapsedSeconds(selectedMatch.timer, Date.now());
    updateMatch(selectedMatch.id, {
      timer: { ...selectedMatch.timer, elapsedSec, startedAt: null, running: false }
    });
    setMessage('Timer paused.');
  }

  function resumeTimer() {
    if (!selectedMatch?.timer) return;
    updateMatch(selectedMatch.id, {
      status: 'live',
      timer: { ...selectedMatch.timer, startedAt: Date.now(), running: true }
    });
    setNow(Date.now());
    setMessage('Timer resumed.');
  }

  function resetCurrentTimer() {
    if (!selectedMatch?.timer) return;
    updateMatch(selectedMatch.id, {
      timer: { ...selectedMatch.timer, elapsedSec: 0, startedAt: null, running: false }
    });
    setNow(Date.now());
    setMessage('Current phase timer reset.');
  }

  function nextPhase() {
    const phase = selectedMatch?.timer?.phase;
    if (phase === 'period1') {
      if (Number(state.settings.breakMinutes) > 0) beginPhase('break', state.settings.breakMinutes);
      else beginPhase('period2', state.settings.halfMinutes);
    } else if (phase === 'break') {
      beginPhase('period2', state.settings.halfMinutes);
    }
  }

  function finishMatch() {
    if (!selectedMatch) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setMessage('Enter a valid score for both teams.');
      return;
    }
    if (a === b) {
      setMessage('A final match result cannot be a tie.');
      return;
    }
    const elapsedSec = selectedMatch.timer ? timerElapsedSeconds(selectedMatch.timer, Date.now()) : 0;
    updateMatch(selectedMatch.id, {
      scoreA: a,
      scoreB: b,
      status: 'final',
      timer: {
        ...(selectedMatch.timer || {}),
        phase: 'finished',
        elapsedSec,
        startedAt: null,
        running: false
      }
    });
    setMessage(`Match ${selectedMatch.matchNo} completed. Winner advanced automatically where applicable.`);
  }

  const remaining = selectedMatch?.timer ? timerRemainingSeconds(selectedMatch.timer, now) : 0;
  const timerExpired = Boolean(selectedMatch?.timer && remaining === 0);
  const phase = selectedMatch?.timer?.phase || null;
  const canNextPhase = phase === 'period1' || phase === 'break';

  return (
    <AppShell pageTitle="Match Control">
      {message && <div className="notice">{message}</div>}

      <section className="control-stats">
        <article><span>Live now</span><strong>{liveMatches.length}</strong></article>
        <article><span>Ready matches</span><strong>{playableMatches.length}</strong></article>
        <article><span>Completed</span><strong>{state.matches.filter((match) => match.status === 'final').length}</strong></article>
        <article><span>Courts</span><strong>{state.settings.courts}</strong></article>
      </section>

      <section className="panel control-selector">
        <div>
          <p className="eyebrow">MATCH SELECTION</p>
          <h3>Choose the match to control</h3>
        </div>
        <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(''); }}>
          <option value="">Select a match</option>
          {playableMatches.map((match) => {
            const [aId, bId] = resolvedTeams(match, state.matches);
            return <option key={match.id} value={match.id}>Match {match.matchNo} • {teamName(aId)} vs {teamName(bId)} • {match.court || 'Court TBD'}</option>;
          })}
        </select>
      </section>

      {!selectedMatch ? (
        <section className="panel empty-state"><span>⏱</span><strong>No playable match is ready</strong><p>Generate fixtures or complete the previous knockout match first.</p></section>
      ) : (
        <>
          <section className="match-control-board">
            <article className="control-match-card">
              <div className="control-match-top">
                <div><span>{selectedMatch.round || selectedMatch.stage}</span><strong>Match {selectedMatch.matchNo}</strong></div>
                <div><span>{selectedMatch.date ? formatDate(selectedMatch.date) : 'Date TBD'}</span><strong>{selectedMatch.time || 'Time TBD'} • {selectedMatch.court || 'Court TBD'}</strong></div>
              </div>

              <div className="control-teams">
                <div><small>TEAM A</small><strong>{teamName(teamAId)}</strong></div>
                <span>VS</span>
                <div><small>TEAM B</small><strong>{teamName(teamBId)}</strong></div>
              </div>

              <div className={`control-timer ${timerExpired && selectedMatch.timer ? 'expired' : ''}`}>
                <small>{timerPhaseLabel(phase)}</small>
                <strong>{selectedMatch.timer ? formatTimer(remaining) : formatTimer(Number(state.settings.halfMinutes) * 60)}</strong>
                <span>{selectedMatch.timer?.running ? 'RUNNING' : selectedMatch.timer ? 'PAUSED / READY' : 'NOT STARTED'}</span>
              </div>

              {timerExpired && selectedMatch.timer && phase !== 'finished' && (
                <div className="timer-expired-note">Time is up for {timerPhaseLabel(phase)}. Use the phase control below when the official is ready.</div>
              )}

              <div className="control-actions">
                {!selectedMatch.timer && <button className="btn btn-primary control-main-btn" onClick={startMatch}>START MATCH</button>}
                {selectedMatch.timer && phase !== 'finished' && (
                  <>
                    {selectedMatch.timer.running
                      ? <button className="btn btn-ghost" onClick={pauseTimer}>Pause timer</button>
                      : <button className="btn btn-primary" onClick={resumeTimer}>Resume timer</button>}
                    <button className="btn btn-ghost" onClick={resetCurrentTimer}>Reset phase timer</button>
                    {canNextPhase && <button className="btn btn-primary" onClick={nextPhase}>{phase === 'period1' ? (Number(state.settings.breakMinutes) > 0 ? 'START BREAK' : 'START PERIOD 2') : 'START PERIOD 2'}</button>}
                  </>
                )}
              </div>
            </article>

            <aside className="control-score-card">
              <p className="eyebrow">LIVE SCORE</p>
              <h3>Match result</h3>
              <div className="control-score-grid">
                <label><span>{teamName(teamAId)}</span><input type="number" min="0" max="99" value={scoreA} onChange={(event) => setScoreA(event.target.value)} /></label>
                <strong>:</strong>
                <label><span>{teamName(teamBId)}</span><input type="number" min="0" max="99" value={scoreB} onChange={(event) => setScoreB(event.target.value)} /></label>
              </div>
              <p className="muted">Finish the match only after the official result is confirmed. Knockout winners advance automatically.</p>
              <button className="btn btn-primary control-finish-btn" onClick={finishMatch}>END MATCH & SAVE RESULT</button>
            </aside>
          </section>

          <section className="panel court-board">
            <div className="panel-head"><div><p className="eyebrow">COURT BOARD</p><h3>Current live matches</h3></div><span className="chip">{liveMatches.length} live</span></div>
            {liveMatches.length ? (
              <div className="court-live-grid">
                {liveMatches.map((match) => {
                  const [aId, bId] = resolvedTeams(match, state.matches);
                  const left = match.timer ? timerRemainingSeconds(match.timer, now) : 0;
                  return <button key={match.id} className={match.id === selectedId ? 'court-live-card selected' : 'court-live-card'} onClick={() => setSelectedId(match.id)}>
                    <span>{match.court || 'Court'}</span>
                    <strong>{teamName(aId)} <em>vs</em> {teamName(bId)}</strong>
                    <small>{timerPhaseLabel(match.timer?.phase)} • {match.timer ? formatTimer(left) : 'Live'}</small>
                  </button>;
                })}
              </div>
            ) : <div className="empty-mini">No match is currently live.</div>}
          </section>
        </>
      )}
    </AppShell>
  );
}
