'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_STATE,
  assignGroups,
  buildMatchResult,
  createGroupMatches,
  createKnockoutMatches,
  createRoundRobinMatches,
  createTournamentState,
  deriveTournamentStatus,
  drawLetters,
  drawSortValue,
  drawValue,
  groupStandings,
  normalizeDatabaseState,
  recomputeKnockout,
  scheduleMatches,
  shuffle,
  sportDefaults,
  validateScheduleChange
} from './tournament';

const STORAGE_KEY = 'src-tournament-manager-v3';
const LEGACY_STORAGE_KEY = 'spike-cup-26-nextjs-v2';
const SELECTED_KEY = 'src-selected-tournament';
const ADMIN_SESSION_KEY = 'spike-cup-admin-pin';
const TournamentContext = createContext(null);

function nowLabel() {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function addActivity(state, text, type = 'update') {
  return [{
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type,
    text,
    time: nowLabel(),
    at: new Date().toISOString()
  }, ...(state.activity || [])].slice(0, 100);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clearTeamStructure(teams) {
  return teams.map((team) => ({
    ...team,
    letter: null,
    drawNumber: null,
    drawIndex: null,
    group: null
  }));
}

function resetDrawRecord(type = 'numbers') {
  return {
    type,
    status: 'not_started',
    completedAt: null,
    lockedAt: null
  };
}

function tournamentHasDraw(state) {
  return state.teams.some((team) => drawValue(team) != null);
}

function tournamentDrawComplete(state) {
  return state.teams.length > 0 && state.teams.every((team) => drawValue(team) != null);
}

function sanitizeTeamData(data) {
  return {
    name: String(data.name || '').trim(),
    department: String(data.department || '').trim(),
    manager: String(data.manager || '').trim(),
    contact: String(data.contact || '').trim()
  };
}

export function TournamentProvider({ children }) {
  const initialDatabase = normalizeDatabaseState(DEFAULT_STATE);
  const [database, setDatabase] = useState(initialDatabase);
  const [selectedTournamentId, setSelectedTournamentId] = useState(initialDatabase.activeTournamentId);
  const [hydrated, setHydrated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPromptOpen, setAdminPromptOpen] = useState(false);
  const [adminNotice, setAdminNotice] = useState('');
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [lastSync, setLastSync] = useState('');
  const [migrationAvailable, setMigrationAvailable] = useState(false);

  const databaseRef = useRef(initialDatabase);
  const selectedRef = useRef(initialDatabase.activeTournamentId);
  const adminPinRef = useRef('');
  const localSnapshotRef = useRef(null);
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);

  const state = useMemo(() => {
    const selected = database.tournaments.find((item) => item.id === selectedTournamentId);
    return selected || database.tournaments.find((item) => item.id === database.activeTournamentId) || database.tournaments[0] || createTournamentState(DEFAULT_STATE);
  }, [database, selectedTournamentId]);

  const tournaments = database.tournaments;

  function applyDatabase(next) {
    databaseRef.current = next;
    setDatabase(next);
    const currentSelected = selectedRef.current;
    if (!next.tournaments.some((item) => item.id === currentSelected)) {
      const fallback = next.activeTournamentId || next.tournaments[0]?.id || '';
      selectedRef.current = fallback;
      setSelectedTournamentId(fallback);
      if (typeof window !== 'undefined') localStorage.setItem(SELECTED_KEY, fallback);
    }
  }

  function headersFor(pin = adminPinRef.current) {
    return pin ? { 'x-admin-pin': pin } : {};
  }

  async function fetchRemote(pin = adminPinRef.current) {
    const response = await fetch('/api/tournament', {
      method: 'GET',
      headers: headersFor(pin),
      cache: 'no-store'
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.error || 'Unable to load shared tournament data.');
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function persistRemote(nextDatabase, pin = adminPinRef.current) {
    if (!pin) return false;
    savingRef.current = true;
    setSyncStatus('saving');

    try {
      const response = await fetch('/api/tournament', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin
        },
        body: JSON.stringify(nextDatabase)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save shared tournament data.');
      }

      setSyncStatus('online');
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setAdminNotice('Shared save failed. Your latest data is still kept in this browser.');
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  function queueRemoteSave(nextDatabase) {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistRemote(nextDatabase);
    }, 220);
  }

  function nextDatabaseWithTournament(currentDb, tournament, select = false) {
    const now = new Date().toISOString();
    const next = {
      ...currentDb,
      schemaVersion: 2,
      revision: (Number(currentDb.revision) || 0) + 1,
      updatedAt: now,
      activeTournamentId: select ? tournament.id : currentDb.activeTournamentId || tournament.id,
      tournaments: currentDb.tournaments.map((item) => item.id === tournament.id ? { ...tournament, updatedAt: now } : item)
    };
    return next;
  }

  function mutateTournament(updater) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin();
      return false;
    }

    const currentDb = databaseRef.current;
    const id = selectedRef.current || currentDb.activeTournamentId;
    const current = currentDb.tournaments.find((item) => item.id === id);
    if (!current) throw new Error('Select a tournament first.');

    const updated = updater(clone(current));
    const next = nextDatabaseWithTournament(currentDb, updated, false);
    applyDatabase(next);
    queueRemoteSave(next);
    return true;
  }

  function mutateDatabase(updater) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin();
      return false;
    }
    const current = databaseRef.current;
    const updated = updater(clone(current));
    const next = {
      ...updated,
      schemaVersion: 2,
      revision: (Number(current.revision) || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    applyDatabase(next);
    queueRemoteSave(next);
    return true;
  }

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let localDatabase = null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (saved) localDatabase = normalizeDatabaseState(JSON.parse(saved));
      } catch {}

      localSnapshotRef.current = localDatabase;

      const rememberedSelection = localStorage.getItem(SELECTED_KEY) || '';
      const sessionPin = sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
      if (sessionPin) adminPinRef.current = sessionPin;

      try {
        const payload = await fetchRemote(sessionPin);
        if (cancelled) return;

        const remoteDatabase = normalizeDatabaseState(payload.state);
        const remoteWasLegacy = !(Number(payload.state?.schemaVersion) >= 2 && Array.isArray(payload.state?.tournaments));

        if (payload.access === 'admin' && sessionPin) {
          setIsAdmin(true);
        } else {
          adminPinRef.current = '';
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }

        const useLocal = remoteDatabase.tournaments.length === 0 && localDatabase?.tournaments?.length;
        const chosen = useLocal ? localDatabase : remoteDatabase;
        applyDatabase(chosen);

        const selected = chosen.tournaments.some((item) => item.id === rememberedSelection)
          ? rememberedSelection
          : chosen.activeTournamentId || chosen.tournaments[0]?.id || '';
        selectedRef.current = selected;
        setSelectedTournamentId(selected);

        setMigrationAvailable(Boolean(remoteWasLegacy));
        setSyncStatus(useLocal ? 'local' : 'online');
        if (!useLocal) setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (error) {
        if (cancelled) return;
        if (localDatabase) {
          applyDatabase(localDatabase);
          setSyncStatus('local');
        } else {
          applyDatabase(initialDatabase);
          setSyncStatus('error');
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  }, [database, hydrated]);

  useEffect(() => {
    if (!hydrated) return undefined;

    const timer = window.setInterval(async () => {
      if (savingRef.current) return;
      try {
        const payload = await fetchRemote();
        const remote = normalizeDatabaseState(payload.state);
        applyDatabase(remote);
        setSyncStatus('online');
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch {
        setSyncStatus('error');
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hydrated, isAdmin]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  async function loginAdmin(pin) {
    const normalizedPin = String(pin || '').trim();
    if (!normalizedPin) throw new Error('Enter the admin PIN.');

    let payload;
    try {
      payload = await fetchRemote(normalizedPin);
    } catch (error) {
      if (error.status === 401) throw new Error('Incorrect admin PIN.');
      throw error;
    }

    if (payload.access !== 'admin') throw new Error('Incorrect admin PIN.');

    adminPinRef.current = normalizedPin;
    sessionStorage.setItem(ADMIN_SESSION_KEY, normalizedPin);
    setIsAdmin(true);
    setAdminPromptOpen(false);
    setAdminNotice('');

    const remoteWasLegacy = !(Number(payload.state?.schemaVersion) >= 2 && Array.isArray(payload.state?.tournaments));
    const remoteDatabase = normalizeDatabaseState(payload.state);
    applyDatabase(remoteDatabase);

    const remembered = localStorage.getItem(SELECTED_KEY) || '';
    const selected = remoteDatabase.tournaments.some((item) => item.id === remembered)
      ? remembered
      : remoteDatabase.activeTournamentId || remoteDatabase.tournaments[0]?.id || '';
    selectedRef.current = selected;
    setSelectedTournamentId(selected);

    if (remoteWasLegacy) {
      const published = await persistRemote(remoteDatabase, normalizedPin);
      if (published) {
        setMigrationAvailable(false);
        setAdminNotice('Existing tournament data was upgraded to the multi-tournament database.');
      }
    } else {
      setMigrationAvailable(false);
      setSyncStatus('online');
    }

    return true;
  }

  async function logoutAdmin() {
    adminPinRef.current = '';
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
    setAdminNotice('');
    try {
      const payload = await fetchRemote('');
      applyDatabase(normalizeDatabaseState(payload.state));
      setSyncStatus('online');
    } catch {
      setSyncStatus('error');
    }
  }

  function requestAdmin(message = 'Admin access is required to make changes.') {
    setAdminNotice(message);
    setAdminPromptOpen(true);
  }

  function selectTournament(id) {
    const current = databaseRef.current;
    if (!current.tournaments.some((item) => item.id === id)) return false;
    selectedRef.current = id;
    setSelectedTournamentId(id);
    localStorage.setItem(SELECTED_KEY, id);
    return true;
  }

  function saveTeam(data, id = '') {
    const clean = sanitizeTeamData(data);
    if (!clean.name) throw new Error('Team name is required.');

    return mutateTournament((current) => {
      if (!id && current.teams.length >= Number(current.settings.maxTeams || 0)) {
        throw new Error('Maximum team limit reached.');
      }

      let teams;
      if (id) {
        teams = current.teams.map((team) => team.id === id ? { ...team, ...clean } : team);
      } else {
        teams = [...current.teams, {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          ...clean,
          captain: '',
          players: [],
          letter: null,
          drawNumber: null,
          drawIndex: null,
          group: null
        }];
      }

      const hadStructure = tournamentHasDraw(current) || current.matches.length > 0;
      if (hadStructure) teams = clearTeamStructure(teams);

      return {
        ...current,
        teams,
        draw: hadStructure ? resetDrawRecord(current.draw?.type || 'numbers') : current.draw,
        matches: hadStructure ? [] : current.matches,
        knockoutGeneratedFromGroups: hadStructure ? false : current.knockoutGeneratedFromGroups,
        activity: addActivity(current, (id ? 'Team updated: ' : 'Team registered: ') + clean.name, id ? 'team_updated' : 'team_created')
      };
    });
  }

  function savePlayer(teamId, data, playerId = '') {
    return mutateTournament((current) => {
      const team = current.teams.find((item) => item.id === teamId);
      if (!team) throw new Error('Team not found.');

      const players = Array.isArray(team.players) ? [...team.players] : [];
      const maxRoster = Math.max(1, Number(current.settings.maxRoster) || 12);
      if (!playerId && players.length >= maxRoster) throw new Error('Maximum ' + maxRoster + ' participants allowed for this entry.');

      const name = String(data.name || '').trim();
      const jersey = String(data.jersey || '').trim();
      const position = String(data.position || '').trim();
      const isCaptain = Boolean(data.isCaptain);
      if (!name) throw new Error('Player name is required.');
      if (jersey && players.some((player) => player.id !== playerId && String(player.jersey || '').trim() === jersey)) {
        throw new Error('Jersey number ' + jersey + ' is already used in this team.');
      }

      let nextPlayers;
      if (playerId) {
        if (!players.some((player) => player.id === playerId)) throw new Error('Player not found.');
        nextPlayers = players.map((player) => player.id === playerId
          ? { ...player, name, jersey, position, isCaptain }
          : { ...player, isCaptain: isCaptain ? false : player.isCaptain });
      } else {
        nextPlayers = [
          ...players.map((player) => ({ ...player, isCaptain: isCaptain ? false : player.isCaptain })),
          {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            name,
            jersey,
            position,
            isCaptain
          }
        ];
      }

      const captain = nextPlayers.find((player) => player.isCaptain)?.name || '';
      return {
        ...current,
        teams: current.teams.map((item) => item.id === teamId ? { ...item, players: nextPlayers, captain } : item),
        activity: addActivity(current, (playerId ? 'Participant updated: ' : 'Participant added: ') + name + ' • ' + team.name, 'roster')
      };
    });
  }

  function deletePlayer(teamId, playerId) {
    return mutateTournament((current) => {
      const team = current.teams.find((item) => item.id === teamId);
      if (!team) throw new Error('Team not found.');
      const players = (Array.isArray(team.players) ? team.players : []).filter((player) => player.id !== playerId);
      const captain = players.find((player) => player.isCaptain)?.name || '';
      return {
        ...current,
        teams: current.teams.map((item) => item.id === teamId ? { ...item, players, captain } : item),
        activity: addActivity(current, 'Participant removed from ' + team.name, 'roster')
      };
    });
  }

  function deleteTeam(id) {
    return mutateTournament((current) => {
      const removed = current.teams.find((team) => team.id === id);
      const teams = clearTeamStructure(current.teams.filter((team) => team.id !== id));
      return {
        ...current,
        teams,
        draw: resetDrawRecord(current.draw?.type || 'numbers'),
        matches: [],
        knockoutGeneratedFromGroups: false,
        activity: addActivity(current, 'Team deleted: ' + (removed?.name || 'Unknown team'), 'team_deleted')
      };
    });
  }

  function runDraw() {
    return mutateTournament((current) => {
      if (current.teams.length < 2) throw new Error('Add at least two teams before running the draw.');
      const type = current.draw?.type || 'numbers';
      const shuffledTeams = shuffle(current.teams);
      let teams;

      if (type === 'letters') {
        const letters = drawLetters(current.teams.length);
        teams = shuffledTeams.map((team, index) => ({
          ...team,
          letter: letters[index],
          drawNumber: null,
          drawIndex: index,
          group: null
        }));
      } else {
        const numbers = shuffle(Array.from({ length: current.teams.length }, (_, index) => index + 1));
        teams = current.teams.map((team, index) => ({
          ...team,
          letter: null,
          drawNumber: numbers[index],
          drawIndex: numbers[index] - 1,
          group: null
        }));
      }

      if (['groups', 'groups_knockout'].includes(current.settings.format)) teams = assignGroups(teams, current.settings.groupCount);

      return {
        ...current,
        teams,
        draw: {
          type,
          status: 'completed',
          completedAt: new Date().toISOString(),
          lockedAt: null
        },
        matches: [],
        knockoutGeneratedFromGroups: false,
        activity: addActivity(current, 'Official team draw completed', 'draw_completed')
      };
    });
  }

  function assignDrawLetter(teamId, letter) {
    return mutateTournament((current) => {
      const normalized = String(letter || '').trim().toUpperCase();
      if (!/^[A-Z]$/.test(normalized)) throw new Error('Draw letter must be A–Z.');
      const target = current.teams.find((team) => team.id === teamId);
      if (!target) throw new Error('Selected team was not found.');
      if (current.teams.some((team) => team.id !== teamId && team.letter === normalized)) {
        throw new Error('That letter has already been assigned.');
      }

      const drawIndex = normalized.charCodeAt(0) - 65;
      const groupCount = Math.max(1, Number(current.settings.groupCount) || 1);
      const isGroup = ['groups', 'groups_knockout'].includes(current.settings.format);
      const teams = current.teams.map((team) => team.id === teamId ? {
        ...team,
        letter: normalized,
        drawNumber: null,
        drawIndex,
        group: isGroup ? 'Group ' + String.fromCharCode(65 + (drawIndex % groupCount)) : null
      } : team);
      const complete = teams.every((team) => Boolean(team.letter));

      return {
        ...current,
        teams,
        draw: {
          type: 'letters',
          status: complete ? 'completed' : 'in_progress',
          completedAt: complete ? new Date().toISOString() : null,
          lockedAt: null
        },
        matches: [],
        knockoutGeneratedFromGroups: false,
        activity: addActivity(current, 'Draw letter ' + normalized + ' assigned to ' + target.name, 'draw_assignment')
      };
    });
  }

  function assignDrawNumber(teamId, number) {
    return mutateTournament((current) => {
      const normalized = Number(number);
      if (!Number.isInteger(normalized) || normalized < 1 || normalized > current.teams.length) {
        throw new Error('Draw number must be between 1 and ' + current.teams.length + '.');
      }
      const target = current.teams.find((team) => team.id === teamId);
      if (!target) throw new Error('Selected team was not found.');
      if (current.teams.some((team) => team.id !== teamId && Number(team.drawNumber) === normalized)) {
        throw new Error('That draw number has already been assigned.');
      }

      const groupCount = Math.max(1, Number(current.settings.groupCount) || 1);
      const isGroup = ['groups', 'groups_knockout'].includes(current.settings.format);
      const teams = current.teams.map((team) => team.id === teamId ? {
        ...team,
        letter: null,
        drawNumber: normalized,
        drawIndex: normalized - 1,
        group: isGroup ? 'Group ' + String.fromCharCode(65 + ((normalized - 1) % groupCount)) : null
      } : team);
      const complete = teams.every((team) => Number.isFinite(Number(team.drawNumber)));

      return {
        ...current,
        teams,
        draw: {
          type: 'numbers',
          status: complete ? 'completed' : 'in_progress',
          completedAt: complete ? new Date().toISOString() : null,
          lockedAt: null
        },
        matches: [],
        knockoutGeneratedFromGroups: false,
        activity: addActivity(current, 'Draw number ' + normalized + ' assigned to ' + target.name, 'draw_assignment')
      };
    });
  }

  function lockDraw() {
    return mutateTournament((current) => {
      if (!tournamentDrawComplete(current)) throw new Error('Complete the draw before locking it.');
      return {
        ...current,
        draw: {
          ...(current.draw || {}),
          status: 'locked',
          completedAt: current.draw?.completedAt || new Date().toISOString(),
          lockedAt: new Date().toISOString()
        },
        activity: addActivity(current, 'Official draw confirmed and locked', 'draw_locked')
      };
    });
  }

  function resetDraw() {
    return mutateTournament((current) => ({
      ...current,
      teams: clearTeamStructure(current.teams),
      draw: resetDrawRecord(current.draw?.type || 'numbers'),
      matches: [],
      knockoutGeneratedFromGroups: false,
      activity: addActivity(current, 'Team draw reset', 'draw_reset')
    }));
  }

  function generateFixtures() {
    return mutateTournament((current) => {
      if (current.teams.length < 2) throw new Error('At least two teams are required.');
      if (!tournamentDrawComplete(current)) throw new Error('Complete the team draw first.');
      if (current.draw?.status !== 'locked') throw new Error('Confirm and lock the official draw before generating fixtures.');

      let teams = [...current.teams].sort((a, b) => drawSortValue(a) - drawSortValue(b));
      let matches = [];

      if (current.settings.format === 'knockout') {
        matches = createKnockoutMatches(teams);
      } else if (current.settings.format === 'round_robin') {
        teams = teams.map((team) => ({ ...team, group: 'Round Robin' }));
        matches = createRoundRobinMatches(teams);
      } else {
        teams = assignGroups(teams, current.settings.groupCount);
        matches = createGroupMatches(teams);
      }

      matches = scheduleMatches(matches, current.settings);
      const unscheduled = matches.filter((match) => match.scheduleStatus === 'unscheduled').length;

      return {
        ...current,
        teams,
        matches,
        knockoutGeneratedFromGroups: false,
        activity: addActivity(
          current,
          'Fixtures generated: ' + matches.length + ' matches' + (unscheduled ? ' • ' + unscheduled + ' unscheduled' : ''),
          'fixtures_generated'
        )
      };
    });
  }

  function updateMatch(id, patch) {
    return mutateTournament((current) => {
      const schedulePatch = ['date', 'time', 'court'].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
      if (schedulePatch && patch.date && patch.time && patch.court) {
        const conflicts = validateScheduleChange(current, id, patch);
        if (conflicts.length) throw new Error(conflicts[0]);
      }

      let matches = current.matches.map((match) => match.id === id ? { ...match, ...patch } : match);
      matches = recomputeKnockout(matches);
      const target = matches.find((match) => match.id === id);
      const nextStatus = deriveTournamentStatus({ ...current, matches });
      const changedStatus = nextStatus !== current.status && !['cancelled', 'archived'].includes(current.status);
      const statusHistory = changedStatus
        ? [...(current.statusHistory || []), { status: nextStatus, at: new Date().toISOString() }]
        : current.statusHistory;

      return {
        ...current,
        matches,
        status: changedStatus ? nextStatus : current.status,
        completedAt: changedStatus && nextStatus === 'completed' ? new Date().toISOString() : current.completedAt,
        statusHistory,
        activity: addActivity(current, 'Match ' + (target?.matchNo || '') + ' updated', patch.status === 'final' ? 'result_saved' : 'match_updated')
      };
    });
  }

  function saveSportResult(id, input) {
    const current = databaseRef.current.tournaments.find((item) => item.id === selectedRef.current);
    if (!current) throw new Error('Tournament not found.');
    const match = current.matches.find((item) => item.id === id);
    if (!match) throw new Error('Match not found.');
    const patch = buildMatchResult(current, match, input);
    return updateMatch(id, patch);
  }

  function rescheduleMatches() {
    return mutateTournament((current) => {
      const preserved = current.matches.map((match) => (
        ['final', 'live'].includes(match.status)
          ? { ...match, scheduleLocked: true }
          : match
      ));
      const matches = scheduleMatches(preserved, current.settings).map((match, index) => ({
        ...match,
        scheduleLocked: current.matches[index]?.scheduleLocked || ['final', 'live'].includes(current.matches[index]?.status)
      }));
      return {
        ...current,
        matches,
        activity: addActivity(current, 'Match schedule recalculated', 'schedule_generated')
      };
    });
  }

  function publishSchedule() {
    return mutateTournament((current) => {
      const unscheduled = current.matches.filter((match) => match.scheduleStatus === 'unscheduled' || !match.date || !match.time || !match.court);
      if (unscheduled.length) throw new Error(unscheduled.length + ' match' + (unscheduled.length === 1 ? '' : 'es') + ' must be scheduled before publishing.');
      return {
        ...current,
        schedulePublishedAt: new Date().toISOString(),
        scheduleVersion: (Number(current.scheduleVersion) || 0) + 1,
        activity: addActivity(current, 'Official schedule published', 'schedule_published')
      };
    });
  }

  function clearMatches() {
    return mutateTournament((current) => ({
      ...current,
      matches: [],
      schedulePublishedAt: null,
      knockoutGeneratedFromGroups: false,
      activity: addActivity(current, 'Fixtures cleared', 'fixtures_cleared')
    }));
  }

  function generateKnockoutFromGroups() {
    return mutateTournament((current) => {
      const groupMatches = current.matches.filter((match) => match.kind === 'group');
      if (!groupMatches.length || !groupMatches.every((match) => match.status === 'final')) {
        throw new Error('Complete all group matches first.');
      }

      const groups = [...new Set(current.teams.map((team) => team.group).filter((group) => group && group !== 'Round Robin'))].sort();
      const qualifiers = [];
      groups.forEach((group) => {
        qualifiers.push(...groupStandings(current, group).slice(0, Number(current.settings.advancePerGroup) || 1).map((row) => row.team));
      });
      if (qualifiers.length < 2) throw new Error('Not enough qualifying teams.');

      const knockout = createKnockoutMatches(
        qualifiers,
        groupMatches.length + 1,
        'Knockout Stage'
      );
      const matches = scheduleMatches([...groupMatches, ...knockout], current.settings);

      return {
        ...current,
        matches,
        knockoutGeneratedFromGroups: true,
        activity: addActivity(current, 'Knockout stage generated with ' + qualifiers.length + ' qualifiers', 'knockout_generated')
      };
    });
  }

  function saveRule(data, id = '') {
    return mutateTournament((current) => ({
      ...current,
      rules: id
        ? current.rules.map((rule) => rule.id === id ? { ...rule, ...data } : rule)
        : [...current.rules, {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            ...data
          }],
      activity: addActivity(current, (id ? 'Rule updated: ' : 'Rule added: ') + data.title, 'rule')
    }));
  }

  function deleteRule(id) {
    return mutateTournament((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.id !== id),
      activity: addActivity(current, 'Tournament rule deleted', 'rule')
    }));
  }

  function saveSettings(next) {
    return mutateTournament((current) => {
      if (Number(next.maxTeams) < current.teams.length) {
        throw new Error('Maximum teams cannot be below ' + current.teams.length + '.');
      }
      if (Number(next.maxTeams) < 2 || Number(next.maxTeams) > 64) {
        throw new Error('Maximum teams must be between 2 and 64.');
      }
      if (Number(next.matchDurationMinutes) < 1) throw new Error('Match duration must be at least 1 minute.');
      if (Number(next.breakMinutes) < 0 || Number(next.betweenMatchesMinutes) < 0 || Number(next.minimumRestMinutes) < 0) {
        throw new Error('Break and rest times cannot be negative.');
      }

      const structural = (
        next.sport !== current.settings.sport ||
        next.format !== current.settings.format ||
        Number(next.groupCount) !== Number(current.settings.groupCount) ||
        Number(next.maxTeams) !== Number(current.settings.maxTeams) ||
        Number(next.advancePerGroup) !== Number(current.settings.advancePerGroup) ||
        next.futsalFormat !== current.settings.futsalFormat ||
        next.badmintonEvent !== current.settings.badmintonEvent
      );

      const timingChanged = (
        next.date !== current.settings.date ||
        next.endDate !== current.settings.endDate ||
        next.startTime !== current.settings.startTime ||
        next.endTime !== current.settings.endTime ||
        next.durationType !== current.settings.durationType ||
        Number(next.courts) !== Number(current.settings.courts) ||
        Number(next.matchDurationMinutes) !== Number(current.settings.matchDurationMinutes) ||
        Number(next.breakMinutes) !== Number(current.settings.breakMinutes) ||
        Number(next.betweenMatchesMinutes) !== Number(current.settings.betweenMatchesMinutes) ||
        Number(next.minimumRestMinutes) !== Number(current.settings.minimumRestMinutes) ||
        JSON.stringify(next.playingAreas || []) !== JSON.stringify(current.settings.playingAreas || []) ||
        JSON.stringify(next.blockedPeriods || []) !== JSON.stringify(current.settings.blockedPeriods || [])
      );

      const teams = structural ? clearTeamStructure(current.teams) : current.teams;
      const draw = structural ? resetDrawRecord('numbers') : current.draw;
      const matches = structural ? [] : timingChanged ? scheduleMatches(current.matches, next) : current.matches;

      return {
        ...current,
        durationType: next.durationType || current.durationType,
        settings: next,
        teams,
        draw,
        matches,
        schedulePublishedAt: structural || timingChanged ? null : current.schedulePublishedAt,
        knockoutGeneratedFromGroups: structural ? false : current.knockoutGeneratedFromGroups,
        activity: addActivity(current, 'Tournament settings updated', 'settings_updated')
      };
    });
  }

  function updateTournamentMeta(patch) {
    return mutateTournament((current) => {
      const nextStatus = patch.status || current.status;
      const changedStatus = nextStatus !== current.status;
      return {
        ...current,
        ...patch,
        status: nextStatus,
        statusHistory: changedStatus
          ? [...(current.statusHistory || []), { status: nextStatus, at: new Date().toISOString() }]
          : current.statusHistory,
        archivedAt: nextStatus === 'archived' ? new Date().toISOString() : current.archivedAt,
        activity: addActivity(current, 'Tournament record updated', 'tournament_updated')
      };
    });
  }

  function createTournament(data) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin('Admin access is required to create a tournament.');
      return null;
    }

    const currentDb = databaseRef.current;
    const sport = data.sport || 'Volleyball';
    const defaults = sportDefaults(sport, {
      futsalFormat: data.futsalFormat,
      badmintonEvent: data.badmintonEvent
    });
    const id = (String(data.tournamentName || 'tournament').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'tournament')
      + '-' + Math.random().toString(36).slice(2, 7);

    const settings = {
      ...clone(DEFAULT_STATE.settings),
      ...defaults,
      tournamentName: String(data.tournamentName || '').trim(),
      sport,
      otherSportName: String(data.otherSportName || '').trim(),
      venue: String(data.venue || '').trim(),
      date: data.date || '',
      endDate: data.endDate || data.date || '',
      durationType: data.durationType || '1_day',
      maxTeams: Math.max(2, Number(data.maxTeams) || 2),
      playersPerTeam: Math.max(1, Number(data.playersPerTeam) || defaults.playersPerTeam || 1),
      maxRoster: Math.max(1, Number(data.maxRoster) || defaults.maxRoster || data.playersPerTeam || 12),
      format: data.format || 'knockout',
      groupCount: Math.max(1, Number(data.groupCount) || 2),
      advancePerGroup: Math.max(1, Number(data.advancePerGroup) || 2),
      futsalFormat: data.futsalFormat || defaults.futsalFormat || '5v5',
      badmintonEvent: data.badmintonEvent || defaults.badmintonEvent || 'Singles',
      courts: Math.max(1, Number(data.courts) || 1),
      playingAreas: Array.isArray(data.playingAreas) && data.playingAreas.length ? data.playingAreas : ['Court 1'],
      startTime: data.startTime || '09:00',
      endTime: data.endTime || '23:00',
      matchDurationMinutes: Math.max(1, Number(data.matchDurationMinutes) || defaults.matchDurationMinutes || 30),
      minimumRestMinutes: Math.max(0, Number(data.minimumRestMinutes) || 15),
      blockedPeriods: Array.isArray(data.blockedPeriods) ? data.blockedPeriods : []
    };

    const teamNames = Array.isArray(data.teamNames) ? data.teamNames : [];
    const teams = teamNames.slice(0, settings.maxTeams).map((name, index) => ({
      id: 'team-' + Math.random().toString(36).slice(2) + '-' + index,
      name: String(name || '').trim() || 'Team ' + (index + 1),
      department: '',
      manager: '',
      contact: '',
      captain: '',
      players: [],
      letter: null,
      drawNumber: null,
      drawIndex: null,
      group: null
    }));

    const tournament = createTournamentState({
      id,
      status: data.status || 'draft',
      public: Boolean(data.public),
      durationType: settings.durationType,
      settings,
      teams,
      draw: resetDrawRecord('numbers'),
      matches: [],
      rules: clone(DEFAULT_STATE.rules),
      activity: []
    });

    tournament.activity = addActivity(tournament, 'Tournament created', 'tournament_created');

    const next = {
      ...currentDb,
      schemaVersion: 2,
      revision: (Number(currentDb.revision) || 0) + 1,
      updatedAt: new Date().toISOString(),
      activeTournamentId: id,
      tournaments: [...currentDb.tournaments, tournament]
    };

    applyDatabase(next);
    selectedRef.current = id;
    setSelectedTournamentId(id);
    localStorage.setItem(SELECTED_KEY, id);
    queueRemoteSave(next);
    return id;
  }

  function duplicateTournament(id) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin();
      return null;
    }
    const source = databaseRef.current.tournaments.find((item) => item.id === id);
    if (!source) throw new Error('Tournament not found.');

    const copyId = source.id + '-copy-' + Math.random().toString(36).slice(2, 6);
    const teamMap = new Map();
    const teams = source.teams.map((team, index) => {
      const newId = 'team-' + Math.random().toString(36).slice(2) + '-' + index;
      teamMap.set(team.id, newId);
      return {
        ...team,
        id: newId,
        players: (team.players || []).map((player) => ({ ...player, id: 'player-' + Math.random().toString(36).slice(2) })),
        letter: null,
        drawNumber: null,
        drawIndex: null,
        group: null
      };
    });

    const copy = createTournamentState({
      ...source,
      id: copyId,
      status: 'draft',
      public: false,
      completedAt: null,
      archivedAt: null,
      settings: { ...source.settings, tournamentName: source.settings.tournamentName + ' Copy' },
      teams,
      draw: resetDrawRecord('numbers'),
      matches: [],
      activity: [],
      statusHistory: [{ status: 'draft', at: new Date().toISOString() }]
    });
    copy.activity = addActivity(copy, 'Tournament duplicated from ' + source.settings.tournamentName, 'tournament_created');

    const currentDb = databaseRef.current;
    const next = {
      ...currentDb,
      revision: (Number(currentDb.revision) || 0) + 1,
      updatedAt: new Date().toISOString(),
      activeTournamentId: copyId,
      tournaments: [...currentDb.tournaments, copy]
    };
    applyDatabase(next);
    selectedRef.current = copyId;
    setSelectedTournamentId(copyId);
    localStorage.setItem(SELECTED_KEY, copyId);
    queueRemoteSave(next);
    return copyId;
  }

  function archiveTournament(id) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin();
      return false;
    }
    selectTournament(id);
    return updateTournamentMeta({ status: 'archived' });
  }

  function resetAll() {
    return mutateTournament((current) => {
      const base = createTournamentState({
        ...DEFAULT_STATE,
        id: current.id,
        settings: {
          ...DEFAULT_STATE.settings,
          tournamentName: current.settings.tournamentName,
          sport: current.settings.sport,
          venue: current.settings.venue,
          date: current.settings.date
        },
        status: 'draft',
        public: current.public,
        draw: resetDrawRecord(current.draw?.type || 'numbers')
      });
      base.activity = addActivity(base, 'Tournament working data reset', 'reset');
      return base;
    });
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    downloadJson({
      backupFormat: 'shipyard-recreation-club-tournament-manager',
      backupVersion: 1,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scope: 'database',
      data: databaseRef.current
    }, 'src-tournament-manager-backup-' + new Date().toISOString().slice(0, 10) + '.json');
  }

  function exportTournamentBackup() {
    const current = databaseRef.current.tournaments.find((item) => item.id === selectedRef.current);
    if (!current) return;
    downloadJson({
      backupFormat: 'shipyard-recreation-club-tournament-manager',
      backupVersion: 1,
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scope: 'tournament',
      data: current
    }, String(current.settings.tournamentName || 'tournament').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-backup.json');
  }

  function importBackup(text) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin();
      return false;
    }

    const parsed = JSON.parse(text);
    const payload = parsed?.backupFormat ? parsed.data : parsed;
    if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file.');

    if (Number(payload.schemaVersion) >= 2 && Array.isArray(payload.tournaments)) {
      const next = normalizeDatabaseState(payload);
      if (new Set(next.tournaments.map((item) => item.id)).size !== next.tournaments.length) {
        throw new Error('Backup contains duplicate tournament IDs.');
      }
      next.revision = (Number(databaseRef.current.revision) || 0) + 1;
      next.updatedAt = new Date().toISOString();
      applyDatabase(next);
      selectedRef.current = next.activeTournamentId || next.tournaments[0]?.id || '';
      setSelectedTournamentId(selectedRef.current);
      queueRemoteSave(next);
      return true;
    }

    if (payload.settings && Array.isArray(payload.teams)) {
      const tournament = createTournamentState(payload);
      const currentDb = databaseRef.current;
      const activeId = selectedRef.current;
      const exists = currentDb.tournaments.some((item) => item.id === activeId);
      const replacement = { ...tournament, id: exists ? activeId : tournament.id, updatedAt: new Date().toISOString() };
      const next = {
        ...currentDb,
        revision: (Number(currentDb.revision) || 0) + 1,
        updatedAt: new Date().toISOString(),
        activeTournamentId: replacement.id,
        tournaments: exists
          ? currentDb.tournaments.map((item) => item.id === activeId ? replacement : item)
          : [...currentDb.tournaments, replacement]
      };
      applyDatabase(next);
      selectedRef.current = replacement.id;
      setSelectedTournamentId(replacement.id);
      queueRemoteSave(next);
      return true;
    }

    throw new Error('Backup schema is not recognized.');
  }

  async function askAssistant(question) {
    if (!isAdmin || !adminPinRef.current) {
      requestAdmin('Admin access is required to use the AI tournament assistant.');
      throw new Error('Admin access required.');
    }
    const prompt = String(question || '').trim();
    if (!prompt) throw new Error('Enter a question.');

    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': adminPinRef.current
      },
      body: JSON.stringify({
        tournamentId: selectedRef.current,
        question: prompt
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'AI assistant request failed.');
    return payload.answer || 'No answer returned.';
  }

  const value = useMemo(() => ({
    database,
    tournaments,
    state,
    selectedTournamentId,
    hydrated,
    isAdmin,
    adminPromptOpen,
    adminNotice,
    syncStatus,
    lastSync,
    migrationAvailable,
    loginAdmin,
    logoutAdmin,
    requestAdmin,
    setAdminPromptOpen,
    setAdminNotice,
    selectTournament,
    createTournament,
    duplicateTournament,
    archiveTournament,
    updateTournamentMeta,
    saveTeam,
    deleteTeam,
    savePlayer,
    deletePlayer,
    runDraw,
    assignDrawLetter,
    assignDrawNumber,
    lockDraw,
    resetDraw,
    generateFixtures,
    updateMatch,
    saveSportResult,
    rescheduleMatches,
    publishSchedule,
    clearMatches,
    generateKnockoutFromGroups,
    saveRule,
    deleteRule,
    saveSettings,
    resetAll,
    exportBackup,
    exportTournamentBackup,
    importBackup,
    askAssistant
  }), [
    database,
    tournaments,
    state,
    selectedTournamentId,
    hydrated,
    isAdmin,
    adminPromptOpen,
    adminNotice,
    syncStatus,
    lastSync,
    migrationAvailable
  ]);

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used inside TournamentProvider.');
  return context;
}
