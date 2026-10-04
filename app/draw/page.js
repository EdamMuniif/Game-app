'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { groupedTeams } from '../../lib/tournament';

export default function DrawPage() {
  const router = useRouter();
  const { state, runDraw, resetDraw, generateFixtures } = useTournament();
  const [message, setMessage] = useState('');
  const drawn = state.teams.length > 0 && state.teams.every((team) => team.letter);
  const ordered = [...state.teams].sort((a, b) => (a.drawIndex ?? 999) - (b.drawIndex ?? 999));
  const groups = groupedTeams(state.teams);

  function doDraw() {
    if (drawn && !window.confirm('Run a new draw? Existing fixtures will be cleared.')) return;
    try { runDraw(); setMessage('Official draw completed.'); } catch (error) { setMessage(error.message); }
  }

  function doReset() {
    if (!drawn || window.confirm('Reset the draw and clear existing fixtures?')) { resetDraw(); setMessage('Draw reset.'); }
  }

  function buildFixtures() {
    try { generateFixtures(); router.push('/matches'); } catch (error) { setMessage(error.message); }
  }

  return (
    <AppShell pageTitle="Draw">
      {message && <div className="notice">{message}</div>}
      <section className="panel draw-toolbar">
        <div><p className="eyebrow">TEAM DRAW</p><h3>Assign draw letters</h3><p className="muted">Teams receive random letters. The draw order determines the competition structure.</p></div>
        <div className="button-row"><button className="btn btn-ghost" onClick={doReset}>Reset draw</button><button className="btn btn-primary" onClick={doDraw}>Run team draw</button></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">DRAW RESULT</p><h3>Letter assignment</h3></div><span className="chip">{drawn ? 'Complete' : 'Pending'}</span></div>
        {drawn ? <div className="draw-grid">{ordered.map((team) => <article className="draw-card" key={team.id}><span>{team.letter}</span><div><strong>{team.name}</strong><small>{team.group || 'Knockout placement'}</small></div></article>)}</div> : <div className="empty-state"><span>🎲</span><strong>Draw has not been completed</strong><p>Add teams, then run the random draw.</p></div>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">STRUCTURE PREVIEW</p><h3>{state.settings.format === 'knockout' ? 'Knockout draw order' : 'Group allocation'}</h3></div><button className="btn btn-primary" disabled={!drawn} onClick={buildFixtures}>Generate fixtures</button></div>
        {!drawn ? <p className="muted">Complete the draw to preview the competition structure.</p> : state.settings.format === 'knockout' ? (
          <div className="preview-list">{ordered.map((team, index) => <div key={team.id}><span>{team.letter}</span><strong>{team.name}</strong><small>{index % 2 === 0 ? `Match ${Math.floor(index / 2) + 1} — side A` : `Match ${Math.floor(index / 2) + 1} — side B`}</small></div>)}</div>
        ) : (
          <div className="group-preview">{Object.entries(groups).sort().map(([group, teams]) => <article key={group}><h4>{group}</h4>{teams.sort((a, b) => a.drawIndex - b.drawIndex).map((team) => <div key={team.id}><span>{team.letter}</span>{team.name}</div>)}</article>)}</div>
        )}
      </section>
    </AppShell>
  );
}
