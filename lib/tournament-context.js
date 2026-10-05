'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STATE, assignGroups, createGroupMatches, createKnockoutMatches, drawLetters,
  groupStandings, recomputeKnockout, scheduleMatches, shuffle
} from './tournament';

const STORAGE_KEY = 'spike-cup-26-nextjs-v2';
const TournamentContext = createContext(null);

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function nowLabel() {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function addActivity(state, text) {
  return [{ id: crypto.randomUUID(), text, time: nowLabel() }, ...(state.activity || [])].slice(0, 30);
}

export function TournamentProvider({ children }) {
  const [state, setState] = useState(cloneDefault);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasLegacyByeFixtures = Array.isArray(parsed.matches) && parsed.matches.some(
          (match) => match.kind === 'knockout' && (!match.sourceA || !match.sourceB)
        );
        if (hasLegacyByeFixtures) parsed.matches = [];
        setState({ ...cloneDefault(), ...parsed, settings: { ...cloneDefault().settings, ...(parsed.settings || {}) } });
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  function mutate(updater) {
    setState((current) => updater(current));
  }

  function clearStructure(teams) {
    return teams.map((team) => ({ ...team, letter: null, drawIndex: null, group: null }));
  }

  function saveTeam(data, id = '') {
    mutate((current) => {
      if (!id && current.teams.length >= current.settings.maxTeams) throw new Error('Maximum team limit reached.');
      let teams;
      if (id) teams = current.teams.map((team) => team.id === id ? { ...team, ...data } : team);
      else teams = [...current.teams, { id: crypto.randomUUID(), ...data, captain: data.captain || '', players: [], letter: null, drawIndex: null, group: null }];
      const hadStructure = current.teams.some((team) => team.letter) || current.matches.length > 0;
      if (hadStructure) teams = clearStructure(teams);
      return {
        ...current,
        teams,
        matches: hadStructure ? [] : current.matches,
        knockoutGeneratedFromGroups: hadStructure ? false : current.knockoutGeneratedFromGroups,
        activity: addActivity(current, `${id ? 'Team updated' : 'Team registered'}: ${data.name}`)
      };
    });
  }

  function savePlayer(teamId, data, playerId = '') {
    mutate((current) => {
      const team = current.teams.find((item) => item.id === teamId);
      if (!team) throw new Error('Team not found.');

      const players = Array.isArray(team.players) ? [...team.players] : [];
      if (!playerId && players.length >= 12) throw new Error('Maximum 12 players allowed per team.');

      const name = String(data.name || '').trim();
      const jersey = String(data.jersey || '').trim();
      const position = String(data.position || '').trim();
      const isCaptain = Boolean(data.isCaptain);

      if (!name) throw new Error('Player name is required.');
      if (jersey && players.some((player) => player.id !== playerId && String(player.jersey || '').trim() === jersey)) {
        throw new Error(`Jersey number ${jersey} is already used in this team.`);
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
          { id: crypto.randomUUID(), name, jersey, position, isCaptain }
        ];
      }

      const captain = nextPlayers.find((player) => player.isCaptain)?.name || '';
      const teams = current.teams.map((item) => item.id === teamId ? { ...item, players: nextPlayers, captain } : item);
      return {
        ...current,
        teams,
        activity: addActivity(current, `${playerId ? 'Player updated' : 'Player added'}: ${name} • ${team.name}`)
      };
    });
  }

  function deletePlayer(teamId, playerId) {
    mutate((current) => {
      const team = current.teams.find((item) => item.id === teamId);
      if (!team) throw new Error('Team not found.');
      const players = (Array.isArray(team.players) ? team.players : []).filter((player) => player.id !== playerId);
      const captain = players.find((player) => player.isCaptain)?.name || '';
      const teams = current.teams.map((item) => item.id === teamId ? { ...item, players, captain } : item);
      return {
        ...current,
        teams,
        activity: addActivity(current, `Player removed from ${team.name}`)
      };
    });
  }

  function deleteTeam(id) {
    mutate((current) => {
      const removed = current.teams.find((team) => team.id === id);
      const teams = clearStructure(current.teams.filter((team) => team.id !== id));
      return { ...current, teams, matches: [], knockoutGeneratedFromGroups: false, activity: addActivity(current, `Team deleted: ${removed?.name || 'Unknown team'}`) };
    });
  }

  function runDraw() {
    mutate((current) => {
      if (current.teams.length < 2) throw new Error('Add at least two teams before running the draw.');
      const letters = drawLetters(current.teams.length);
      const randomized = shuffle(current.teams).map((team, index) => ({ ...team, letter: letters[index], drawIndex: index, group: null }));
      const teams = ['groups', 'groups_knockout'].includes(current.settings.format) ? assignGroups(randomized, current.settings.groupCount) : randomized;
      return { ...current, teams, matches: [], knockoutGeneratedFromGroups: false, activity: addActivity(current, 'Official team draw completed') };
    });
  }


  function assignDrawLetter(teamId, letter) {
    mutate((current) => {
      const normalized = String(letter || '').trim().toUpperCase();
      if (!/^[A-Z]$/.test(normalized)) throw new Error('Draw letter must be A–Z.');
      const target = current.teams.find((team) => team.id === teamId);
      if (!target) throw new Error('Selected team was not found.');
      if (current.teams.some((team) => team.id !== teamId && team.letter === normalized)) {
        throw new Error('That letter has already been assigned.');
      }

      const drawIndex = normalized.charCodeAt(0) - 65;
      const isGroupFormat = ['groups', 'groups_knockout'].includes(current.settings.format);
      const groupCount = Math.max(1, Number(current.settings.groupCount) || 1);
      const group = isGroupFormat ? 'Group ' + String.fromCharCode(65 + (drawIndex % groupCount)) : null;
      const teams = current.teams.map((team) => team.id === teamId
        ? { ...team, letter: normalized, drawIndex, group }
        : team);

      return {
        ...current,
        teams,
        matches: [],
        knockoutGeneratedFromGroups: false,
        activity: addActivity(current, 'Draw letter ' + normalized + ' assigned to ' + target.name)
      };
    });
  }

  function resetDraw() {
    mutate((current) => ({ ...current, teams: clearStructure(current.teams), matches: [], knockoutGeneratedFromGroups: false, activity: addActivity(current, 'Team draw reset') }));
  }

  function generateFixtures() {
    mutate((current) => {
      if (!current.teams.length || !current.teams.every((team) => team.letter)) throw new Error('Complete the team draw first.');
      let teams = current.teams;
      let matches;
      if (current.settings.format === 'knockout') {
        matches = createKnockoutMatches([...teams].sort((a, b) => a.letter.localeCompare(b.letter)));
      } else {
        teams = assignGroups(teams, current.settings.groupCount);
        matches = createGroupMatches(teams);
      }
      matches = scheduleMatches(matches, current.settings);
      return { ...current, teams, matches, knockoutGeneratedFromGroups: false, activity: addActivity(current, `Fixtures generated and scheduled: ${matches.length} matches`) };
    });
  }

  function updateMatch(id, patch) {
    mutate((current) => {
      let matches = current.matches.map((match) => match.id === id ? { ...match, ...patch } : match);
      matches = recomputeKnockout(matches);
      const target = matches.find((match) => match.id === id);
      return { ...current, matches, activity: addActivity(current, `Result updated for Match ${target?.matchNo || ''}`) };
    });
  }

  function rescheduleMatches() {
    mutate((current) => ({
      ...current,
      matches: scheduleMatches(current.matches, current.settings),
      activity: addActivity(current, 'Match schedule recalculated')
    }));
  }

  function clearMatches() {
    mutate((current) => ({ ...current, matches: [], knockoutGeneratedFromGroups: false, activity: addActivity(current, 'Fixtures cleared') }));
  }

  function generateKnockoutFromGroups() {
    mutate((current) => {
      const groupMatches = current.matches.filter((match) => match.kind === 'group');
      if (!groupMatches.length || !groupMatches.every((match) => match.status === 'final')) throw new Error('Complete all group matches first.');
      const groups = [...new Set(current.teams.map((team) => team.group).filter(Boolean))].sort();
      const qualifiers = [];
      groups.forEach((group) => qualifiers.push(...groupStandings(current, group).slice(0, current.settings.advancePerGroup).map((row) => row.team)));
      if (qualifiers.length < 2) throw new Error('Not enough qualifying teams.');
      const knockout = createKnockoutMatches(qualifiers, groupMatches.length + 1, 'Knockout Stage');
      const matches = scheduleMatches([...groupMatches, ...knockout], current.settings);
      return { ...current, matches, knockoutGeneratedFromGroups: true, activity: addActivity(current, `Knockout stage generated with ${qualifiers.length} qualifiers`) };
    });
  }

  function saveRule(data, id = '') {
    mutate((current) => ({
      ...current,
      rules: id ? current.rules.map((rule) => rule.id === id ? { ...rule, ...data } : rule) : [...current.rules, { id: crypto.randomUUID(), ...data }],
      activity: addActivity(current, id ? `Rule updated: ${data.title}` : `Rule added: ${data.title}`)
    }));
  }

  function deleteRule(id) {
    mutate((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== id), activity: addActivity(current, 'Tournament rule deleted') }));
  }

  function saveSettings(next) {
    mutate((current) => {
      if (Number(next.maxTeams) < current.teams.length) throw new Error(`Maximum teams cannot be below ${current.teams.length}.`);
      if (Number(next.maxTeams) > 26) throw new Error('Maximum teams cannot exceed 26 while using A–Z draw letters.');
      if (Number(next.halfMinutes) < 1) throw new Error('Half / playing period must be at least 1 minute.');
      if (Number(next.breakMinutes) < 0 || Number(next.betweenMatchesMinutes) < 0) throw new Error('Break times cannot be negative.');
      const structural = next.format !== current.settings.format || Number(next.groupCount) !== Number(current.settings.groupCount) || Number(next.maxTeams) !== Number(current.settings.maxTeams) || Number(next.advancePerGroup) !== Number(current.settings.advancePerGroup);
      const timingChanged = next.date !== current.settings.date || next.startTime !== current.settings.startTime || Number(next.courts) !== Number(current.settings.courts) || Number(next.halfMinutes) !== Number(current.settings.halfMinutes) || Number(next.breakMinutes) !== Number(current.settings.breakMinutes) || Number(next.betweenMatchesMinutes) !== Number(current.settings.betweenMatchesMinutes);
      return {
        ...current,
        settings: next,
        teams: structural ? clearStructure(current.teams) : current.teams,
        matches: structural ? [] : timingChanged ? scheduleMatches(current.matches, next) : current.matches,
        knockoutGeneratedFromGroups: structural ? false : current.knockoutGeneratedFromGroups,
        activity: addActivity(current, 'Tournament settings updated')
      };
    });
  }

  function resetAll() {
    setState(cloneDefault());
    localStorage.removeItem(STORAGE_KEY);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'spike-cup-26-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(text) {
    const parsed = JSON.parse(text);
    if (!parsed.settings || !Array.isArray(parsed.teams)) throw new Error('Invalid backup');
    setState({ ...cloneDefault(), ...parsed, settings: { ...cloneDefault().settings, ...(parsed.settings || {}) } });
  }

  const value = useMemo(() => ({
    state, hydrated, saveTeam, deleteTeam, savePlayer, deletePlayer, runDraw, assignDrawLetter, resetDraw, generateFixtures, updateMatch,
    rescheduleMatches, clearMatches, generateKnockoutFromGroups, saveRule, deleteRule, saveSettings, resetAll,
    exportBackup, importBackup
  }), [state, hydrated]);

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used inside TournamentProvider.');
  return context;
}
