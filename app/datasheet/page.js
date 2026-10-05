'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { useTournament } from '../../lib/tournament-context';
import {
  drawValue,
  formatDate,
  formatLabel,
  groupStandings,
  groupedTeams,
  resolvedTeams,
  tournamentYear
} from '../../lib/tournament';

const TABS = [
  ['tournaments', 'Tournaments'],
  ['teams', 'Teams / Entries'],
  ['draws', 'Draws'],
  ['matches', 'Matches'],
  ['standings', 'Standings'],
  ['history', 'History']
];

function cell(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DatasheetPage() {
  const { tournaments, exportBackup, deleteTournament, isAdmin, requestAdmin } = useTournament();
  const [tab, setTab] = useState('tournaments');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState('all');
  const [sport, setSport] = useState('all');
  const [status, setStatus] = useState('all');
  const [duration, setDuration] = useState('all');
  const [tournamentId, setTournamentId] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const years = useMemo(() => [...new Set(tournaments.map(tournamentYear).filter(Boolean))].sort((a, b) => b - a), [tournaments]);
  const sports = useMemo(() => [...new Set(tournaments.map((item) => item.settings.sport).filter(Boolean))].sort(), [tournaments]);

  const filteredTournaments = useMemo(() => tournaments.filter((tournament) => {
    if (year !== 'all' && String(tournamentYear(tournament)) !== String(year)) return false;
    if (sport !== 'all' && tournament.settings.sport !== sport) return false;
    if (status !== 'all' && tournament.status !== status) return false;
    if (duration !== 'all' && (tournament.durationType || tournament.settings.durationType) !== duration) return false;
    if (tournamentId !== 'all' && tournament.id !== tournamentId) return false;
    return true;
  }), [tournaments, year, sport, status, duration, tournamentId]);

  const dataset = useMemo(() => {
    const rows = [];
    const q = search.trim().toLowerCase();

    filteredTournaments.forEach((tournament) => {
      const base = {
        year: tournamentYear(tournament) || '',
        tournament: tournament.settings.tournamentName,
        sport: tournament.settings.sport
      };

      if (tab === 'tournaments') {
        rows.push({
          _tournamentId: tournament.id,
          Year: base.year,
          Tournament: base.tournament,
          Sport: base.sport,
          Date: formatDate(tournament.settings.date),
          Duration: tournament.durationType || tournament.settings.durationType,
          Venue: tournament.settings.venue,
          Entries: tournament.teams.length,
          Matches: tournament.matches.length,
          Format: formatLabel(tournament.settings.format),
          Status: tournament.status,
          Visibility: tournament.public ? 'Public' : 'Private'
        });
      }

      if (tab === 'teams') {
        tournament.teams.forEach((team) => rows.push({
          Year: base.year,
          Tournament: base.tournament,
          Sport: base.sport,
          Entry: team.name,
          Department: team.department,
          Players: Array.isArray(team.players) ? team.players.length : 0,
          Captain: team.captain,
          Manager: team.manager,
          Draw: drawValue(team),
          Group: team.group
        }));
      }

      if (tab === 'draws') {
        tournament.teams.filter((team) => drawValue(team) != null).forEach((team) => rows.push({
          Year: base.year,
          Tournament: base.tournament,
          Sport: base.sport,
          Entry: team.name,
          'Draw Type': tournament.draw?.type || 'legacy',
          'Draw Position': drawValue(team),
          Group: team.group,
          'Draw Status': tournament.draw?.status || '',
          'Locked At': tournament.draw?.lockedAt || ''
        }));
      }

      if (tab === 'matches') {
        const teamMap = Object.fromEntries(tournament.teams.map((team) => [team.id, team.name]));
        tournament.matches.forEach((match) => {
          const [aId, bId] = resolvedTeams(match, tournament.matches);
          rows.push({
            Year: base.year,
            Tournament: base.tournament,
            Sport: base.sport,
            Match: match.matchNo,
            Date: match.date ? formatDate(match.date) : '',
            Time: match.time,
            Area: match.court,
            Stage: match.stage,
            Round: match.round,
            'Entry A': teamMap[aId] || 'TBD',
            'Entry B': teamMap[bId] || 'TBD',
            Score: match.scoreA == null || match.scoreB == null ? '' : match.scoreA + ' : ' + match.scoreB,
            Status: match.status,
            Result: match.resultType || 'normal'
          });
        });
      }

      if (tab === 'standings') {
        const groups = groupedTeams(tournament.teams);
        Object.keys(groups).sort().forEach((group) => {
          groupStandings(tournament, group).forEach((standing, index) => rows.push({
            Year: base.year,
            Tournament: base.tournament,
            Sport: base.sport,
            Group: group,
            Position: index + 1,
            Entry: standing.team.name,
            Played: standing.p,
            Won: standing.w,
            Drawn: standing.d,
            Lost: standing.l,
            For: standing.gf,
            Against: standing.ga,
            Difference: standing.gd,
            Points: standing.pts
          }));
        });
      }

      if (tab === 'history') {
        (tournament.activity || []).forEach((event) => rows.push({
          Year: base.year,
          Tournament: base.tournament,
          Sport: base.sport,
          Event: event.text,
          Type: event.type || 'update',
          Time: event.at || event.time || ''
        }));
      }
    });

    if (!q) return rows;
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(q));
  }, [filteredTournaments, tab, search]);

  const columns = dataset.length ? Object.keys(dataset[0]).filter((key) => !key.startsWith('_')) : (
    tab === 'tournaments'
      ? ['Year', 'Tournament', 'Sport', 'Date', 'Duration', 'Venue', 'Entries', 'Matches', 'Format', 'Status', 'Visibility']
      : []
  );

  function exportCsv() {
    if (!dataset.length) return;
    const lines = [
      columns.map(csvEscape).join(','),
      ...dataset.map((row) => columns.map((column) => csvEscape(row[column])).join(','))
    ];
    downloadBlob(lines.join('\r\n'), 'text/csv;charset=utf-8', 'src-' + tab + '-datasheet.csv');
  }

  function exportExcel() {
    if (!dataset.length) return;
    const head = columns.map((column) => '<th>' + cell(column) + '</th>').join('');
    const body = dataset.map((row) => '<tr>' + columns.map((column) => '<td>' + cell(row[column]).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '</td>').join('') + '</tr>').join('');
    const html = '<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></body></html>';
    downloadBlob(html, 'application/vnd.ms-excel;charset=utf-8', 'src-' + tab + '-datasheet.xls');
  }

  function backup() {
    if (!isAdmin) {
      requestAdmin('Admin access is required to export the full JSON backup.');
      return;
    }
    exportBackup();
  }

  function openDelete(row) {
    const target = tournaments.find((item) => item.id === row._tournamentId);
    if (!target) return;
    setDeleteTarget(target);
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
      if (tournamentId === deleteTarget.id) setTournamentId('all');
      setDeleteTarget(null);
      setDeletePin('');
    } catch (error) {
      setDeleteError(error.message || 'Unable to delete tournament.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell pageTitle="Datasheet">
      {message && <div className="notice">{message}</div>}
      <section className="panel datasheet-toolbar">
        <div>
          <p className="eyebrow">HISTORICAL DATA</p>
          <h3>Search, filter & export</h3>
          <p className="muted">Tournament records remain available across future years. Exports use the same live data shown here.</p>
        </div>
        <div className="button-row">
          <button className="btn btn-ghost" type="button" disabled={!dataset.length} onClick={exportCsv}>CSV</button>
          <button className="btn btn-ghost" type="button" disabled={!dataset.length} onClick={exportExcel}>Excel</button>
          <button className="btn btn-ghost" type="button" onClick={() => window.print()}>Print / PDF</button>
          <button className="btn btn-primary" type="button" onClick={backup}>Full JSON backup</button>
        </div>
      </section>

      <section className="panel">
        <div className="datasheet-tabs" role="tablist">
          {TABS.map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        <div className="datasheet-filters">
          <label className="search-field">Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search current datasheet…" />
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
          <label>Duration
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option value="all">All</option>
              <option value="1_day">1-Day Cup</option>
              <option value="2_day">2-Day Cup</option>
              <option value="weekly">Weekly Cup</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>Tournament
            <select value={tournamentId} onChange={(event) => setTournamentId(event.target.value)}>
              <option value="all">All</option>
              {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.settings.tournamentName}</option>)}
            </select>
          </label>
        </div>

        <div className="datasheet-count">{dataset.length} record{dataset.length === 1 ? '' : 's'}</div>

        <div className="table-wrap datasheet-table-wrap">
          <table className="datasheet-table">
            <thead>
              <tr>
                {columns.map((column) => <th key={column}>{column}</th>)}
                {tab === 'tournaments' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {dataset.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => <td key={column}>{cell(row[column])}</td>)}
                  {tab === 'tournaments' && (
                    <td>
                      <button className="btn btn-danger" type="button" onClick={() => openDelete(row)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!dataset.length && <tr><td colSpan={Math.max(1, columns.length + (tab === 'tournaments' ? 1 : 0))}>No records match the selected filters.</td></tr>}
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
                disabled={deleting}
                onClick={() => {
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
              <p>Teams, rosters, draw, fixtures, scores, standings, schedule, and history will be removed from the shared database.</p>
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
