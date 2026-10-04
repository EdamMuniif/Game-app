'use client';

import { useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';

const EMPTY_FORM = { name: '', department: '', captain: '', manager: '', contact: '' };

export default function TeamsPage() {
  const { state, saveTeam, deleteTeam } = useTournament();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      saveTeam(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])), editingId);
      setForm(EMPTY_FORM); setEditingId(''); setMessage(editingId ? 'Team updated.' : 'Team added.');
    } catch (error) { setMessage(error.message); }
  }

  function edit(team) {
    setEditingId(team.id);
    setForm({ name: team.name || '', department: team.department || '', captain: team.captain || '', manager: team.manager || '', contact: team.contact || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(team) {
    if (window.confirm(`Delete ${team.name}? This will clear the draw and fixtures.`)) deleteTeam(team.id);
  }

  return (
    <AppShell pageTitle="Teams">
      {message && <div className="notice">{message}</div>}
      <section className="page-grid teams-layout">
        <article className="panel form-panel">
          <div className="panel-head"><div><p className="eyebrow">TEAM REGISTRATION</p><h3>{editingId ? 'Edit team' : 'Add team'}</h3></div></div>
          <form className="stack-form" onSubmit={submit}>
            <label>Team name<input name="name" required maxLength="60" value={form.name} onChange={change} placeholder="e.g. Engineering A" /></label>
            <label>Department / Section<input name="department" maxLength="60" value={form.department} onChange={change} placeholder="Department or section" /></label>
            <label>Team captain<input name="captain" maxLength="60" value={form.captain} onChange={change} placeholder="Captain name" /></label>
            <label>Manager / Coordinator<input name="manager" maxLength="60" value={form.manager} onChange={change} placeholder="Coordinator name" /></label>
            <label>Contact number<input name="contact" maxLength="30" value={form.contact} onChange={change} placeholder="Contact number" /></label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Save changes' : 'Add team'}</button>
              {editingId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>Cancel</button>}
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panel-head wrap"><div><p className="eyebrow">SUBMITTED TEAMS</p><h3>{state.teams.length} registered</h3></div><div className="chip">{state.teams.length} / {state.settings.maxTeams}</div></div>
          {state.teams.length ? (
            <div className="table-wrap"><table><thead><tr><th>#</th><th>Team</th><th>Department</th><th>Captain</th><th>Letter</th><th>Group</th><th>Actions</th></tr></thead><tbody>
              {state.teams.map((team, index) => <tr key={team.id}><td>{index + 1}</td><td><strong>{team.name}</strong></td><td>{team.department || '—'}</td><td>{team.captain || '—'}</td><td>{team.letter || '—'}</td><td>{team.group || '—'}</td><td><div className="table-actions"><button className="icon-btn" onClick={() => edit(team)}>✎</button><button className="icon-btn danger" onClick={() => remove(team)}>×</button></div></td></tr>)}
            </tbody></table></div>
          ) : <div className="empty-state"><span>👥</span><strong>No teams submitted yet</strong><p>Add the first team using the registration form.</p></div>}
        </article>
      </section>
    </AppShell>
  );
}
