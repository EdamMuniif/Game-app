'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';

export default function SettingsPage() {
  const { state, saveSettings, resetAll } = useTournament();
  const [form, setForm] = useState(state.settings);
  const [message, setMessage] = useState('');

  useEffect(() => { setForm(state.settings); }, [state.settings]);

  function change(event) {
    const { name, value, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'number' ? Number(value) : value }));
  }

  function submit(event) {
    event.preventDefault();
    const structural = form.format !== state.settings.format || Number(form.groupCount) !== Number(state.settings.groupCount) || Number(form.maxTeams) !== Number(state.settings.maxTeams) || Number(form.advancePerGroup) !== Number(state.settings.advancePerGroup);
    if (structural && (state.matches.length || state.teams.some((team) => team.letter)) && !window.confirm('These settings change the tournament structure. Clear the draw and fixtures?')) return;
    try { saveSettings(form); setMessage('Settings saved.'); } catch (error) { setMessage(error.message); }
  }

  const groupMode = ['groups', 'groups_knockout'].includes(form.format);

  return (
    <AppShell pageTitle="Settings">
      {message && <div className="notice">{message}</div>}
      <article className="panel settings-panel">
        <div className="panel-head"><div><p className="eyebrow">TOURNAMENT SETTINGS</p><h3>Competition configuration</h3></div></div>
        <form className="settings-form" onSubmit={submit}>
          <div className="form-section"><h4>Event</h4><div className="form-grid">
            <label>Tournament name<input name="tournamentName" required value={form.tournamentName} onChange={change} /></label>
            <label>Sport<select name="sport" value={form.sport} onChange={change}><option>Volleyball</option><option>Futsal</option><option>Football</option><option>Basketball</option><option>Badminton</option><option>Other</option></select></label>
            <label>Venue<input name="venue" value={form.venue} onChange={change} /></label>
            <label>Tournament date<input name="date" type="date" value={form.date} onChange={change} /></label>
            <label>Submission deadline<input name="submissionDeadline" type="date" value={form.submissionDeadline} onChange={change} /></label>
          </div></div>

          <div className="form-section"><h4>Teams & format</h4><div className="form-grid">
            <label>Maximum teams<input name="maxTeams" type="number" min="2" max="64" required value={form.maxTeams} onChange={change} /></label>
            <label>Tournament format<select name="format" value={form.format} onChange={change}><option value="knockout">Knockout only</option><option value="groups">Group stage only</option><option value="groups_knockout">Groups + knockout</option></select></label>
            {groupMode && <><label>Number of groups<input name="groupCount" type="number" min="1" max="16" value={form.groupCount} onChange={change} /></label><label>Teams advancing per group<input name="advancePerGroup" type="number" min="1" max="8" value={form.advancePerGroup} onChange={change} /></label></>}
          </div></div>

          <div className="form-section"><h4>Match rules</h4><div className="form-grid">
            <label>Best of sets<select name="bestOfSets" value={form.bestOfSets} onChange={change}><option value={1}>1 set</option><option value={3}>Best of 3</option><option value={5}>Best of 5</option></select></label>
            <label>Points for group win<input name="winPoints" type="number" min="1" max="5" value={form.winPoints} onChange={change} /></label>
            <label>Courts<input name="courts" type="number" min="1" max="10" value={form.courts} onChange={change} /></label>
            <label>First match time<input name="startTime" type="time" value={form.startTime} onChange={change} /></label>
          </div></div>

          <div className="settings-actions"><button className="btn btn-primary" type="submit">Save settings</button><button className="btn btn-danger" type="button" onClick={() => { if (window.confirm('Reset all teams, draw, matches, rules and settings? This cannot be undone.')) { resetAll(); setMessage('Tournament data reset.'); } }}>Reset all tournament data</button></div>
        </form>
      </article>
    </AppShell>
  );
}
