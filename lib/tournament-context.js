'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_STATE, assignGroups, createGroupMatches, createKnockoutMatches, drawLetters,
  groupStandings, recomputeKnockout, shuffle
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
      else teams = [...current.teams, { id: crypto.randomUUID(), ...data, letter: null, drawIndex: null, group: null }];
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

  function resetDraw() {
    mutate((current) => ({ ...current, teams: clearStructure(current.teams), matches: [], knockoutGeneratedFromGroups: false, activity: addActivity(current, 'Team draw reset') }));
  }

  function generateFixtures() {
    mutate((current) => {
      if (!current.teams.length || !current.teams.every((team) => team.letter)) throw new Error('Complete the team draw first.');
      let teams = current.teams;
      let matches;
      if (current.settings.format === 'knockout') {
        matches = createKnockoutMatches([...teams].sort((a, b) => a.drawIndex - b.drawIndex));
      } else {
        teams = assignGroups(teams, current.settings.groupCount);
        matches = createGroupMatches(teams);
      }
      return { ...current, teams, matches, knockoutGeneratedFromGroups: false, activity: addActivity(current, `Fixtures generated: ${matches.length} matches`) };
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
      return { ...current, matches: [...groupMatches, ...knockout], knockoutGeneratedFromGroups: true, activity: addActivity(current, `Knockout stage generated with ${qualifiers.length} qualifiers`) };
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
      const structural = next.format !== current.settings.format || Number(next.groupCount) !== Number(current.settings.groupCount) || Number(next.maxTeams) !== Number(current.settings.maxTeams) || Number(next.advancePerGroup) !== Number(current.settings.advancePerGroup);
      return {
        ...current,
        settings: next,
        teams: structural ? clearStructure(current.teams) : current.teams,
        matches: structural ? [] : current.matches,
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
    state, hydrated, saveTeam, deleteTeam, runDraw, resetDraw, generateFixtures, updateMatch,
    clearMatches, generateKnockoutFromGroups, saveRule, deleteRule, saveSettings, resetAll,
    exportBackup, importBackup
  }), [state, hydrated]);

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used inside TournamentProvider.');
  return context;
}
