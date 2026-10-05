'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { drawValue } from '../../lib/tournament';

const EMPTY_FORM = { name: '', department: '', manager: '', contact: '' };
const EMPTY_PLAYER = { name: '', jersey: '', position: '', isCaptain: false };

export default function TeamsPage() {
  const { state, saveTeam, deleteTeam, savePlayer, deletePlayer } = useTournament();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [message, setMessage] = useState('');
  const [rosterTeamId, setRosterTeamId] = useState('');
  const [playerForm, setPlayerForm] = useState(EMPTY_PLAYER);
  const [editingPlayerId, setEditingPlayerId] = useState('');

  const isBadminton = state.settings.sport === 'Badminton';
  const entryLabel = isBadminton ? (state.settings.badmintonEvent === 'Singles' ? 'Player entry' : 'Pair entry') : 'Team';
  const participantLabel = isBadminton ? 'Participant' : 'Player';
  const maxRoster = Math.max(1, Number(state.settings.maxRoster) || 12);

  const rosterTeam = useMemo(
    () => state.teams.find((team) => team.id === rosterTeamId) || null,
    [state.teams, rosterTeamId]
  );

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    try {
      saveTeam(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])), editingId);
      setForm(EMPTY_FORM);
      setEditingId('');
      setMessage(editingId ? entryLabel + ' updated.' : entryLabel + ' added. Add participants from the Roster button.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function edit(team) {
    setEditingId(team.id);
    setForm({
      name: team.name || '',
      department: team.department || '',
      manager: team.manager || '',
      contact: team.contact || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(team) {
    if (window.confirm('Delete ' + team.name + '? This will clear the draw and fixtures.')) deleteTeam(team.id);
  }

  function openRoster(team) {
    setRosterTeamId(team.id);
    setPlayerForm(EMPTY_PLAYER);
    setEditingPlayerId('');
    setMessage('');
  }

  function submitPlayer(event) {
    event.preventDefault();
    try {
      savePlayer(rosterTeamId, {
        name: playerForm.name.trim(),
        jersey: playerForm.jersey.trim(),
        position: playerForm.position.trim(),
        isCaptain: playerForm.isCaptain
      }, editingPlayerId);
      setPlayerForm(EMPTY_PLAYER);
      setEditingPlayerId('');
      setMessage(editingPlayerId ? participantLabel + ' updated.' : participantLabel + ' added to roster.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editPlayer(player) {
    setEditingPlayerId(player.id);
    setPlayerForm({
      name: player.name || '',
      jersey: player.jersey || '',
      position: player.position || '',
      isCaptain: Boolean(player.isCaptain)
    });
  }

  function removePlayer(player) {
    if (!rosterTeam) return;
    if (window.confirm('Remove ' + player.name + ' from ' + rosterTeam.name + '?')) {
      deletePlayer(rosterTeam.id, player.id);
      if (editingPlayerId === player.id) {
        setEditingPlayerId('');
        setPlayerForm(EMPTY_PLAYER);
      }
    }
  }

  const players = rosterTeam?.players || [];

  return (
    <AppShell pageTitle={isBadminton ? 'Entries' : 'Teams'}>
      {message && <div className="notice">{message}</div>}

      <section className="page-grid teams-layout">
        <article className="panel form-panel">
          <div className="panel-head">
            <div><p className="eyebrow">REGISTRATION</p><h3>{editingId ? 'Edit ' + entryLabel.toLowerCase() : 'Add ' + entryLabel.toLowerCase()}</h3></div>
          </div>
          <form className="stack-form" onSubmit={submit}>
            <label>{entryLabel} name<input name="name" required maxLength="60" value={form.name} onChange={change} placeholder={isBadminton ? 'Player or pair name' : 'e.g. Engineering A'} /></label>
            <label>Department / Section<input name="department" maxLength="60" value={form.department} onChange={change} placeholder="Department or section" /></label>
            <label>Manager / Coordinator<input name="manager" maxLength="60" value={form.manager} onChange={change} placeholder="Optional coordinator" /></label>
            <label>Contact<input name="contact" maxLength="30" value={form.contact} onChange={change} placeholder="Private organizer contact" /></label>
            <div className="team-rule-note">
              <strong>Roster rule</strong>
              <span>Maximum {maxRoster} participant{maxRoster === 1 ? '' : 's'} for this tournament. Captain is optional for individual events.</span>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Save changes' : 'Add ' + entryLabel.toLowerCase()}</button>
              {editingId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>Cancel</button>}
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panel-head wrap">
            <div><p className="eyebrow">REGISTERED ENTRIES</p><h3>{state.teams.length} registered</h3></div>
            <div className="chip">{state.teams.length} / {state.settings.maxTeams}</div>
          </div>

          {state.teams.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Entry</th><th>Department</th><th>Roster</th><th>Captain</th><th>Manager</th><th>Draw</th><th>Group</th><th>Actions</th></tr></thead>
                <tbody>
                  {state.teams.map((team, index) => {
                    const count = Array.isArray(team.players) ? team.players.length : 0;
                    return (
                      <tr key={team.id}>
                        <td>{index + 1}</td>
                        <td><strong>{team.name}</strong></td>
                        <td>{team.department || '—'}</td>
                        <td><span className={count >= maxRoster ? 'roster-count full' : 'roster-count'}>{count}/{maxRoster}</span></td>
                        <td>{team.captain || '—'}</td>
                        <td>{team.manager || '—'}</td>
                        <td>{drawValue(team) ?? '—'}</td>
                        <td>{team.group || '—'}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-ghost roster-btn" type="button" onClick={() => openRoster(team)}>Roster</button>
                            <button className="icon-btn" type="button" onClick={() => edit(team)}>✎</button>
                            <button className="icon-btn danger" type="button" onClick={() => remove(team)}>×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><span>👥</span><strong>No entries submitted yet</strong><p>Add the first entry using the registration form.</p></div>
          )}
        </article>
      </section>

      {rosterTeam && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal roster-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">ROSTER</p>
                <h3>{rosterTeam.name}</h3>
                <p className="muted">{players.length}/{maxRoster} participants • Manager: {rosterTeam.manager || 'Not set'}</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => { setRosterTeamId(''); setEditingPlayerId(''); setPlayerForm(EMPTY_PLAYER); }}>×</button>
            </div>

            <div className="roster-layout">
              <form className="stack-form roster-player-form" onSubmit={submitPlayer}>
                <div className="roster-form-head">
                  <strong>{editingPlayerId ? 'Edit participant' : 'Add participant'}</strong>
                  <span>{players.length}/{maxRoster}</span>
                </div>
                <label>Name<input required maxLength="60" value={playerForm.name} onChange={(event) => setPlayerForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Jersey / ID<input maxLength="12" value={playerForm.jersey} onChange={(event) => setPlayerForm((current) => ({ ...current, jersey: event.target.value }))} placeholder="Optional" /></label>
                <label>Position / Role<input maxLength="40" value={playerForm.position} onChange={(event) => setPlayerForm((current) => ({ ...current, position: event.target.value }))} placeholder="Optional" /></label>
                <label className="captain-check">
                  <input type="checkbox" checked={playerForm.isCaptain} onChange={(event) => setPlayerForm((current) => ({ ...current, isCaptain: event.target.checked }))} />
                  <span>Make this participant captain</span>
                </label>
                <button className="btn btn-primary" type="submit" disabled={!editingPlayerId && players.length >= maxRoster}>{editingPlayerId ? 'Save participant' : 'Add participant'}</button>
                {editingPlayerId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingPlayerId(''); setPlayerForm(EMPTY_PLAYER); }}>Cancel edit</button>}
              </form>

              <div className="roster-list-wrap">
                <div className="roster-summary">
                  <div><span>Roster</span><strong>{players.length}/{maxRoster}</strong></div>
                  <div><span>Captain</span><strong>{rosterTeam.captain || 'Not assigned'}</strong></div>
                  <div><span>Manager</span><strong>{rosterTeam.manager || 'Not assigned'}</strong></div>
                </div>

                {players.length ? (
                  <div className="roster-list">
                    {players.map((player, index) => (
                      <div className={player.isCaptain ? 'roster-player captain' : 'roster-player'} key={player.id}>
                        <span className="roster-index">{index + 1}</span>
                        <div className="roster-player-main">
                          <strong>{player.name}{player.isCaptain ? ' • Captain' : ''}</strong>
                          <small>{player.jersey ? 'ID ' + player.jersey + ' • ' : ''}{player.position || 'Role not set'}</small>
                        </div>
                        <button className="icon-btn" type="button" onClick={() => editPlayer(player)}>✎</button>
                        <button className="icon-btn danger" type="button" onClick={() => removePlayer(player)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-mini">No participants added yet.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
