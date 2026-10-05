'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import { formatDate, formatLabel, tournamentYear } from '../../lib/tournament';

export default function TournamentsPage() {
  const router = useRouter();
  const {
    tournaments,
    selectTournament,
    duplicateTournament,
    archiveTournament,
    deleteTournament,
    isAdmin,
    requestAdmin
  } = useTournament();

  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [sport, setSport] = useState('all');
  const [status, setStatus] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const years = useMemo(() => [...new Set(tournaments.map(tournamentYear).filter(Boolean))].sort((a, b) => b - a), [tournaments]);
  const sports = useMemo(() => [...new Set(tournaments.map((item) => item.settings.sport).filter(Boolean))].sort(), [tournaments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tournaments.filter((tournament) => {
      if (year !== 'all' && String(tournamentYear(tournament)) !== String(year)) return false;
      if (sport !== 'all' && tournament.settings.sport !== sport) return false;
      if (status !== 'all' && tournament.status !== status) return false;
      if (q) {
        const haystack = [
          tournament.settings.tournamentName,
          tournament.settings.sport,
          tournament.settings.venue,
          tournament.status
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tournaments, search, year, sport, status]);

  function openTournament(id) {
    selectTournament(id);
    router.push('/teams');
  }

  function duplicate(id) {
    if (!isAdmin) {
      requestAdmin('Admin access is required to duplicate tournaments.');
      return;
    }
    try {
      const newId = duplicateTournament(id);
      if (newId) router.push('/settings');
    } catch (error) {
      window.alert(error.message);
    }
  }

  function archive(tournament) {
    if (!isAdmin) {
      requestAdmin('Admin access is required to archive tournaments.');
      return;
    }
    if (!window.confirm('Archive ' + tournament.settings.tournamentName + '? The record will remain in history.')) return;
    archiveTournament(tournament.id);
  }

  function openDelete(tournament) {
    setDeleteTarget(tournament);
    setDeletePin('');
    setDeleteError('');
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (!deleteTarget || deleting) return;

    setDeleteError('');
    setDeleting(true);
    try {
      const result = await deleteTournament(deleteTarget.id, deletePin);
      setMessage(result.deletedName + ' was permanently deleted.');
      setDeleteTarget(null);
      setDeletePin('');
    } catch (error) {
      setDeleteError(error.message || 'Unable to delete tournament.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell pageTitle="Tournaments">
      {message && <div className="notice">{message}</div>}
      <section className="panel tournament-registry-toolbar">
        <div>
          <p className="eyebrow">TOURNAMENT REGISTER</p>
          <h3>All tournament records</h3>
          <p className="muted">Draft, upcoming, ongoing, completed, cancelled, and archived tournaments remain available for future reference.</p>
        </div>
        <Link className="btn btn-primary" href="/tournaments/new">New tournament</Link>
      </section>

      <section className="panel">
        <div className="datasheet-filters tournament-filters">
          <label className="search-field">Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tournament, sport, venue…" />
          </label>
          <label>Year
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">All</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Sport
            <select value={sport} onChange={(event) => setSport(event.target.value)}>
              <option value="all">All</option>
              {sports.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All</option>
              {['draft', 'upcoming', 'ongoing', 'completed', 'cancelled', 'archived'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="table-wrap tournament-register-table">
          <table>
            <thead>
              <tr><th>Year</th><th>Tournament</th><th>Sport</th><th>Date</th><th>Teams</th><th>Format</th><th>Status</th><th>Visibility</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((tournament) => (
                <tr key={tournament.id}>
                  <td>{tournamentYear(tournament) || '—'}</td>
                  <td><strong>{tournament.settings.tournamentName}</strong><small className="table-subtext">{tournament.settings.venue || 'Venue not set'}</small></td>
                  <td>{tournament.settings.sport}</td>
                  <td>{formatDate(tournament.settings.date)}</td>
                  <td>{tournament.teams.length}</td>
                  <td>{formatLabel(tournament.settings.format)}</td>
                  <td><span className={'status-pill status-' + tournament.status}>{tournament.status}</span></td>
                  <td>{tournament.public ? 'Public' : 'Private'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => openTournament(tournament.id)}>Open</button>
                      <button className="icon-btn" type="button" title="Duplicate" onClick={() => duplicate(tournament.id)}>⧉</button>
                      {tournament.status !== 'archived' && (
                        <button className="icon-btn danger" type="button" title="Archive" onClick={() => archive(tournament)}>⌁</button>
                      )}
                      <button
                        className="icon-btn danger"
                        type="button"
                        title="Permanently delete"
                        aria-label={'Permanently delete ' + tournament.settings.tournamentName}
                        onClick={() => openDelete(tournament)}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="9">No tournaments match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete tournament">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">PERMANENT DELETE</p>
                <h3>{deleteTarget.settings.tournamentName}</h3>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setDeleteTarget(null);
                  setDeletePin('');
                  setDeleteError('');
                }}
                aria-label="Close delete confirmation"
              >
                ×
              </button>
            </div>

            <div className="delete-warning">
              <strong>This permanently deletes the tournament.</strong>
              <p>Teams, rosters, draw, fixtures, scores, standings, schedule, and history for this tournament will be removed from the shared database.</p>
            </div>

            <form className="stack-form" onSubmit={confirmDelete}>
              <label>Admin PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={deletePin}
                  onChange={(event) => setDeletePin(event.target.value)}
                  placeholder="Enter admin PIN"
                  required
                  autoFocus
                />
              </label>

              {deleteError && <div className="admin-login-error">{deleteError}</div>}

              <div className="form-actions">
                <button className="btn btn-danger" type="submit" disabled={deleting || !deletePin.trim()}>
                  {deleting ? 'Deleting…' : 'Permanently delete'}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeletePin('');
                    setDeleteError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
