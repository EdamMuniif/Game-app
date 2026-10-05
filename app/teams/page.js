'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';

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
      setMessage(editingId ? 'Team updated.' : 'Team added. Add players from the Roster button.');
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
    if (window.confirm(`Delete ${team.name}? This will clear the draw and fixtures.`)) deleteTeam(team.id);
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
      setMessage(editingPlayerId ? 'Player updated.' : 'Player added to roster.');
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
    if (window.confirm(`Remove ${player.name} from ${rosterTeam.name}?`)) {
      deletePlayer(rosterTeam.id, player.id);
      if (editingPlayerId === player.id) {
        setEditingPlayerId('');
        setPlayerForm(EMPTY_PLAYER);
      }
    }
  }

  const players = rosterTeam?.players || [];

  return (
    <AppShell pageTitle="Teams">
      {message && <div className="notice">{message}</div>}

      <section className="page-grid teams-layout">
        <article className="panel form-panel">
          <div className="panel-head">
            <div><p className="eyebrow">TEAM REGISTRATION</p><h3>{editingId ? 'Edit team' : 'Add team'}</h3></div>
          </div>
          <form className="stack-form" onSubmit={submit}>
            <label>Team name<input name="name" required maxLength="60" value={form.name} onChange={change} placeholder="e.g. Engineering A" /></label>
            <label>Department / Section<input name="department" maxLength="60" value={form.department} onChange={change} placeholder="Department or section" /></label>
            <label>Manager / Coordinator<input name="manager" maxLength="60" value={form.manager} onChange={change} placeholder="One team manager" /></label>
            <label>Manager / Team contact<input name="contact" maxLength="30" value={form.contact} onChange={change} placeholder="Contact number" /></label>
            <div className="team-rule-note">
              <strong>Roster rule</strong>
              <span>Maximum 12 players total. The captain must be one of those 12 players. One manager is recorded separately and does not count as a player.</span>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Save changes' : 'Add team'}</button>
              {editingId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }}>Cancel</button>}
            </div>
          </form>
        </article>

        <article className="panel">
          <div className="panel-head wrap">
            <div><p className="eyebrow">SUBMITTED TEAMS</p><h3>{state.teams.length} registered</h3></div>
            <div className="chip">{state.teams.length} / {state.settings.maxTeams}</div>
          </div>

          {state.teams.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Team</th><th>Department</th><th>Players</th><th>Captain</th><th>Manager</th><th>Letter</th><th>Group</th><th>Actions</th></tr></thead>
                <tbody>
                  {state.teams.map((team, index) => {
                    const count = Array.isArray(team.players) ? team.players.length : 0;
                    return (
                      <tr key={team.id}>
                        <td>{index + 1}</td>
                        <td><strong>{team.name}</strong></td>
                        <td>{team.department || '—'}</td>
                        <td><span className={count === 12 ? 'roster-count full' : 'roster-count'}>{count}/12</span></td>
                        <td>{team.captain || '—'}</td>
                        <td>{team.manager || '—'}</td>
                        <td>{team.letter || '—'}</td>
                        <td>{team.group || '—'}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-ghost roster-btn" onClick={() => openRoster(team)}>Roster</button>
                            <button className="icon-btn" onClick={() => edit(team)}>✎</button>
                            <button className="icon-btn danger" onClick={() => remove(team)}>×</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><span>👥</span><strong>No teams submitted yet</strong><p>Add the first team using the registration form.</p></div>
          )}
        </article>
      </section>

      {rosterTeam && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal roster-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">TEAM ROSTER</p>
                <h3>{rosterTeam.name}</h3>
                <p className="muted">{players.length}/12 players • Manager: {rosterTeam.manager || 'Not set'}</p>
              </div>
              <button className="icon-btn" onClick={() => { setRosterTeamId(''); setEditingPlayerId(''); setPlayerForm(EMPTY_PLAYER); }}>×</button>
            </div>

            <div className="roster-layout">
              <form className="stack-form roster-player-form" onSubmit={submitPlayer}>
                <div className="roster-form-head">
                  <strong>{editingPlayerId ? 'Edit player' : 'Add player'}</strong>
                  <span>{players.length}/12</span>
                </div>
                <label>Player name<input required maxLength="60" value={playerForm.name} onChange={(event) => setPlayerForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Jersey number<input inputMode="numeric" maxLength="3" value={playerForm.jersey} onChange={(event) => setPlayerForm((current) => ({ ...current, jersey: event.target.value.replace(/[^0-9]/g, '') }))} placeholder="Optional" /></label>
                <label>Position
                  <select value={playerForm.position} onChange={(event) => setPlayerForm((current) => ({ ...current, position: event.target.value }))}>
                    <option value="">Not specified</option>
                    <option value="Setter">Setter</option>
                    <option value="Outside Hitter">Outside Hitter</option>
                    <option value="Opposite">Opposite</option>
                    <option value="Middle Blocker">Middle Blocker</option>
                    <option value="Libero">Libero</option>
                    <option value="Defensive Specialist">Defensive Specialist</option>
                  </select>
                </label>
                <label className="captain-check">
                  <input type="checkbox" checked={playerForm.isCaptain} onChange={(event) => setPlayerForm((current) => ({ ...current, isCaptain: event.target.checked }))} />
                  <span>Make this player team captain</span>
                </label>
                <button className="btn btn-primary" type="submit" disabled={!editingPlayerId && players.length >= 12}>{editingPlayerId ? 'Save player' : 'Add player'}</button>
                {editingPlayerId && <button className="btn btn-ghost" type="button" onClick={() => { setEditingPlayerId(''); setPlayerForm(EMPTY_PLAYER); }}>Cancel edit</button>}
              </form>

              <div className="roster-list-wrap">
                <div className="roster-summary">
                  <div><span>Players</span><strong>{players.length}/12</strong></div>
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
                          <small>Jersey {player.jersey || '—'} • {player.position || 'Position not set'}</small>
                        </div>
                        <button className="icon-btn" onClick={() => editPlayer(player)}>✎</button>
                        <button className="icon-btn danger" onClick={() => removePlayer(player)}>×</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-mini">No players added yet.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
