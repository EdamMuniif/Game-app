export const DEFAULT_RULES = [
  { id: 'rule-eligibility', title: 'Player eligibility', text: 'Only players submitted on the approved team list may participate.' },
  { id: 'rule-draw', title: 'Team draw', text: 'The official draw determines placement in the tournament structure.' },
  { id: 'rule-results', title: 'Results', text: 'Tournament officials confirm all recorded results and tie-break decisions.' }
];

export const SPORT_DEFAULTS = {
  Football: {
    playersPerTeam: 11,
    maxRoster: 18,
    matchDurationMinutes: 45,
    halfMinutes: 20,
    breakMinutes: 5,
    bestOfSets: 1,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0
  },
  Futsal: {
    playersPerTeam: 5,
    maxRoster: 12,
    futsalFormat: '5v5',
    matchDurationMinutes: 35,
    halfMinutes: 15,
    breakMinutes: 5,
    bestOfSets: 1,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0
  },
  Volleyball: {
    playersPerTeam: 6,
    maxRoster: 12,
    matchDurationMinutes: 45,
    halfMinutes: 15,
    breakMinutes: 5,
    bestOfSets: 3,
    setTarget: 25,
    decidingSetTarget: 15,
    winBy: 2,
    winPoints: 3,
    drawPoints: 0,
    lossPoints: 0
  },
  Badminton: {
    playersPerTeam: 1,
    maxRoster: 2,
    badmintonEvent: 'Singles',
    matchDurationMinutes: 30,
    bestOfGames: 3,
    gameTarget: 21,
    winBy: 2,
    maxGameScore: 30,
    winPoints: 1,
    drawPoints: 0,
    lossPoints: 0
  },
  Other: {
    playersPerTeam: 1,
    maxRoster: 12,
    matchDurationMinutes: 30,
    bestOfSets: 1,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0
  }
};

export const DEFAULT_STATE = {
  id: 'legacy-spike-cup-26',
  status: 'upcoming',
  public: true,
  durationType: '1_day',
  createdAt: null,
  updatedAt: null,
  completedAt: null,
  archivedAt: null,
  settings: {
    tournamentName: 'SPIKE CUP 26',
    sport: 'Volleyball',
    otherSportName: '',
    venue: 'Thilafushi Shipyard Stadium',
    date: '2026-10-22',
    endDate: '2026-10-22',
    submissionDeadline: '2026-10-18',
    durationType: '1_day',
    maxTeams: 15,
    playersPerTeam: 6,
    maxRoster: 12,
    format: 'knockout',
    groupCount: 2,
    advancePerGroup: 2,
    futsalFormat: '5v5',
    badmintonEvent: 'Singles',
    bestOfSets: 3,
    setTarget: 25,
    decidingSetTarget: 15,
    bestOfGames: 3,
    gameTarget: 21,
    maxGameScore: 30,
    winBy: 2,
    winPoints: 3,
    drawPoints: 0,
    lossPoints: 0,
    knockoutTieBreak: 'penalties',
    courts: 1,
    playingAreas: ['Court 1'],
    startTime: '18:00',
    endTime: '23:30',
    halfMinutes: 15,
    matchDurationMinutes: 35,
    breakMinutes: 5,
    betweenMatchesMinutes: 10,
    minimumRestMinutes: 20,
    blockedPeriods: [],
    availableDates: []
  },
  teams: [],
  draw: {
    type: 'letters',
    status: 'not_started',
    completedAt: null,
    lockedAt: null
  },
  matches: [],
  rules: DEFAULT_RULES,
  activity: [],
  statusHistory: [],
  schedulePublishedAt: null,
  scheduleVersion: 0,
  knockoutGeneratedFromGroups: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createId(prefix = 'id') {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + '-' + suffix;
}

export function slugify(value) {
  return String(value || 'tournament').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'tournament';
}

export function sportDefaults(sport, extra = {}) {
  const base = SPORT_DEFAULTS[sport] || SPORT_DEFAULTS.Other;
  const result = { ...base, ...extra };
  if (sport === 'Badminton') {
    const event = extra.badmintonEvent || result.badmintonEvent || 'Singles';
    result.playersPerTeam = event === 'Singles' ? 1 : 2;
    result.maxRoster = event === 'Singles' ? 1 : 2;
  }
  if (sport === 'Futsal') {
    const format = extra.futsalFormat || result.futsalFormat || '5v5';
    const count = Number(String(format).split('v')[0]) || 5;
    if (!extra.playersPerTeam) result.playersPerTeam = count;
  }
  return result;
}

export function hasDrawNumber(team) {
  const value = team?.drawNumber;
  if (value === null || value === undefined || value === '') return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1;
}

export function createTournamentState(input = {}) {
  const base = clone(DEFAULT_STATE);
  const parsed = input && typeof input === 'object' ? input : {};
  const parsedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
  const sport = parsedSettings.sport || parsed.sport || base.settings.sport;
  const defaults = sportDefaults(sport, parsedSettings);
  const settings = {
    ...base.settings,
    ...defaults,
    ...parsedSettings,
    sport,
    durationType: parsedSettings.durationType || parsed.durationType || base.settings.durationType
  };
  const teams = Array.isArray(parsed.teams) ? parsed.teams.map((team) => ({
    players: [],
    letter: null,
    drawNumber: null,
    drawIndex: null,
    group: null,
    ...team,
    players: Array.isArray(team.players) ? team.players : []
  })) : [];
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
  const hasLetters = teams.some((team) => Boolean(team.letter));
  const hasNumbers = teams.some(hasDrawNumber);
  const drawType = parsed.draw?.type || (hasLetters ? 'letters' : 'numbers');
  const assignedCount = teams.filter((team) => drawType === 'letters' ? Boolean(team.letter) : hasDrawNumber(team)).length;
  let drawStatus = parsed.draw?.status || 'not_started';
  if (assignedCount === 0) {
    drawStatus = 'not_started';
  } else if (assignedCount < teams.length) {
    drawStatus = 'in_progress';
  } else if (drawStatus !== 'locked') {
    drawStatus = matches.length ? 'locked' : 'completed';
  }
  const now = new Date().toISOString();
  const status = parsed.status || deriveTournamentStatus({ ...parsed, settings, teams, matches });
  const id = parsed.id || ('legacy-' + slugify(settings.tournamentName));
  const history = Array.isArray(parsed.statusHistory) && parsed.statusHistory.length
    ? parsed.statusHistory
    : [{ status, at: parsed.createdAt || now }];

  return {
    ...base,
    ...parsed,
    id,
    status,
    public: parsed.public !== false,
    durationType: parsed.durationType || settings.durationType || '1_day',
    createdAt: parsed.createdAt || now,
    updatedAt: parsed.updatedAt || now,
    settings,
    teams,
    draw: {
      ...base.draw,
      ...(parsed.draw || {}),
      type: drawType,
      status: drawStatus,
      completedAt: parsed.draw?.completedAt || (assignedCount === teams.length && teams.length ? parsed.updatedAt || now : null),
      lockedAt: parsed.draw?.lockedAt || (drawStatus === 'locked' ? parsed.updatedAt || now : null)
    },
    matches,
    rules: Array.isArray(parsed.rules) ? parsed.rules : clone(DEFAULT_RULES),
    activity: Array.isArray(parsed.activity) ? parsed.activity : [],
    statusHistory: history,
    schedulePublishedAt: parsed.schedulePublishedAt || null,
    scheduleVersion: Number(parsed.scheduleVersion) || 0,
    knockoutGeneratedFromGroups: Boolean(parsed.knockoutGeneratedFromGroups)
  };
}

export function normalizeDatabaseState(input) {
  const parsed = input && typeof input === 'object' ? input : {};
  if (Number(parsed.schemaVersion) >= 2 && Array.isArray(parsed.tournaments)) {
    const tournaments = parsed.tournaments.map((item) => createTournamentState(item));
    const firstId = tournaments[0]?.id || null;
    const activeTournamentId = tournaments.some((item) => item.id === parsed.activeTournamentId)
      ? parsed.activeTournamentId
      : firstId;
    return {
      schemaVersion: 2,
      revision: Number(parsed.revision) || 0,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      activeTournamentId,
      tournaments
    };
  }

  const tournament = createTournamentState(parsed);
  return {
    schemaVersion: 2,
    revision: 0,
    updatedAt: new Date().toISOString(),
    activeTournamentId: tournament.id,
    tournaments: [tournament]
  };
}

export function formatDate(value) {
  if (!value) return 'Not set';
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return value;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function formatLabel(format) {
  if (format === 'knockout') return 'Knockout';
  if (format === 'round_robin') return 'Round Robin';
  if (format === 'groups') return 'Group Stage';
  if (format === 'groups_knockout') return 'Groups + Knockout';
  return String(format || 'Not set');
}

export function drawLetters(count) {
  return Array.from({ length: count }, (_, index) => {
    let n = index;
    let letter = '';
    do {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return letter;
  });
}

export function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function drawValue(team) {
  if (!team) return null;
  if (hasDrawNumber(team)) return Number(team.drawNumber);
  return team.letter || null;
}

export function drawSortValue(team) {
  if (hasDrawNumber(team)) return Number(team.drawNumber);
  if (team?.letter) return team.letter.charCodeAt(0) - 64;
  return 9999;
}

export function assignGroups(teams, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  return teams.map((team) => {
    const index = Number.isFinite(Number(team.drawIndex)) ? Number(team.drawIndex) : Math.max(0, drawSortValue(team) - 1);
    return { ...team, group: 'Group ' + String.fromCharCode(65 + (index % count)) };
  });
}

export function groupedTeams(teams) {
  return teams.reduce((groups, team) => {
    if (!team.group) return groups;
    (groups[team.group] ||= []).push(team);
    return groups;
  }, {});
}

export function nextPowerOfTwo(value) {
  let n = 1;
  while (n < value) n *= 2;
  return n;
}

export function knockoutRoundName(size) {
  if (size <= 2) return 'Final';
  if (size === 4) return 'Semi-final';
  if (size === 8) return 'Quarter-final';
  return 'Round of ' + size;
}

export function knockoutByeInfo(participantCount) {
  const count = Math.max(0, Number(participantCount) || 0);
  if (count < 2) return { bracketSize: count, byeCount: 0, openingRound: null, byeTo: null };
  const bracketSize = nextPowerOfTwo(count);
  const openingRound = knockoutRoundName(bracketSize);
  if (bracketSize === count) return { bracketSize, byeCount: 0, openingRound, byeTo: null };
  return {
    bracketSize,
    byeCount: bracketSize - count,
    openingRound,
    byeTo: knockoutRoundName(bracketSize / 2)
  };
}

function emptyMatch(overrides = {}) {
  return {
    id: createId('match'),
    kind: 'group',
    stage: '',
    round: '',
    matchNo: 0,
    scoreA: null,
    scoreB: null,
    status: 'scheduled',
    winnerId: null,
    winnerOverrideId: null,
    resultType: 'normal',
    resultDetails: null,
    date: '',
    time: '',
    court: '',
    scheduleStatus: 'unscheduled',
    scheduleLocked: false,
    ...overrides
  };
}

export function createRoundRobinMatches(teams, startMatchNo = 1, stageLabel = 'Round Robin') {
  if (teams.length < 2) return [];
  const ordered = [...teams];
  if (ordered.length % 2 === 1) ordered.push(null);
  const count = ordered.length;
  const rounds = count - 1;
  const half = count / 2;
  let rotating = [...ordered];
  const matches = [];
  let matchNo = startMatchNo;

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotating[i];
      const b = rotating[count - 1 - i];
      if (a && b) {
        matches.push(emptyMatch({
          kind: 'group',
          stage: stageLabel,
          round: 'Round ' + (round + 1),
          matchNo: matchNo++,
          teamAId: a.id,
          teamBId: b.id
        }));
      }
    }
    rotating = [rotating[0], rotating[count - 1], ...rotating.slice(1, count - 1)];
  }
  return matches;
}

export function createGroupMatches(teams, startMatchNo = 1) {
  const groups = groupedTeams(teams);
  const matches = [];
  let matchNo = startMatchNo;
  Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).forEach(([group, members]) => {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        matches.push(emptyMatch({
          kind: 'group',
          stage: group,
          round: group,
          matchNo: matchNo++,
          teamAId: members[i].id,
          teamBId: members[j].id
        }));
      }
    }
  });
  return matches;
}

export function createKnockoutMatches(participants, startMatchNo = 1, stageLabel = 'Knockout') {
  const participantIds = participants.map((item) => typeof item === 'string' ? item : item.id).filter(Boolean);
  const participantCount = participantIds.length;
  if (participantCount < 2) return [];

  const bracketSize = nextPowerOfTwo(participantCount);
  const hasOpeningByes = bracketSize !== participantCount;
  const mainSize = hasOpeningByes ? bracketSize / 2 : bracketSize;
  const preliminaryMatchCount = hasOpeningByes ? participantCount - mainSize : 0;
  const byeCount = hasOpeningByes ? bracketSize - participantCount : 0;
  const matches = [];
  let matchNo = startMatchNo;
  let mainSources = [];

  if (hasOpeningByes) {
    const byeTeams = participantIds.slice(0, byeCount);
    const preliminaryTeams = participantIds.slice(byeCount);
    const preliminaryWinnerSources = [];
    const preliminaryRound = knockoutRoundName(bracketSize);

    for (let i = 0; i < preliminaryMatchCount; i += 1) {
      const id = createId('match');
      matches.push(emptyMatch({
        id,
        kind: 'knockout',
        stage: stageLabel,
        round: preliminaryRound,
        matchNo: matchNo++,
        sourceA: { type: 'team', id: preliminaryTeams[i * 2] },
        sourceB: { type: 'team', id: preliminaryTeams[(i * 2) + 1] }
      }));
      preliminaryWinnerSources.push({ type: 'winner', matchId: id });
    }

    let byeIndex = 0;
    let winnerIndex = 0;
    while (mainSources.length < mainSize) {
      if (byeIndex < byeTeams.length) mainSources.push({ type: 'team', id: byeTeams[byeIndex++] });
      if (winnerIndex < preliminaryWinnerSources.length && mainSources.length < mainSize) {
        mainSources.push(preliminaryWinnerSources[winnerIndex++]);
      }
    }
  } else {
    mainSources = participantIds.map((id) => ({ type: 'team', id }));
  }

  let roundSources = mainSources;
  while (roundSources.length >= 2) {
    const roundName = knockoutRoundName(roundSources.length);
    const nextRoundSources = [];
    for (let i = 0; i < roundSources.length; i += 2) {
      const id = createId('match');
      matches.push(emptyMatch({
        id,
        kind: 'knockout',
        stage: stageLabel,
        round: roundName,
        matchNo: matchNo++,
        sourceA: roundSources[i],
        sourceB: roundSources[i + 1]
      }));
      nextRoundSources.push({ type: 'winner', matchId: id });
    }
    roundSources = nextRoundSources;
  }

  return recomputeKnockout(matches);
}

export function sourceTeamId(source, matches) {
  if (!source) return null;
  if (source.type === 'team') return source.id;
  if (source.type === 'winner') return matches.find((match) => match.id === source.matchId)?.winnerId || null;
  return null;
}

export function resolvedTeams(match, matches) {
  if (!match) return [null, null];
  if (match.kind === 'group') return [match.teamAId || null, match.teamBId || null];
  return [sourceTeamId(match.sourceA, matches), sourceTeamId(match.sourceB, matches)];
}

function clearInvalidResult(match) {
  return {
    ...match,
    scoreA: null,
    scoreB: null,
    status: 'scheduled',
    winnerId: null,
    winnerOverrideId: null,
    resultType: 'normal',
    resultDetails: null,
    resultParticipantIds: null,
    resultNote: ''
  };
}

export function recomputeKnockout(input) {
  const matches = input.map((match) => ({ ...match })).sort((a, b) => Number(a.matchNo) - Number(b.matchNo));

  matches.filter((match) => match.kind === 'knockout').forEach((match) => {
    const [a, b] = resolvedTeams(match, matches);
    if (match.status === 'final' && Array.isArray(match.resultParticipantIds)) {
      const oldA = match.resultParticipantIds[0] || null;
      const oldB = match.resultParticipantIds[1] || null;
      if (oldA !== a || oldB !== b) {
        Object.assign(match, clearInvalidResult(match));
        return;
      }
    }

    let winner = null;
    if (match.status === 'final' && match.winnerOverrideId && [a, b].includes(match.winnerOverrideId)) {
      winner = match.winnerOverrideId;
    } else if (
      a && b && match.status === 'final' &&
      Number.isFinite(Number(match.scoreA)) &&
      Number.isFinite(Number(match.scoreB)) &&
      Number(match.scoreA) !== Number(match.scoreB)
    ) {
      winner = Number(match.scoreA) > Number(match.scoreB) ? a : b;
    }
    match.winnerId = winner;
  });

  return matches.sort((a, b) => Number(a.matchNo) - Number(b.matchNo));
}

export function matchOutcomeLabel(match) {
  if (match?.resultType === 'walkover') return 'Walkover';
  if (match?.resultType === 'forfeit') return 'Forfeit';
  return '';
}

export function sportScoringMode(sport) {
  if (sport === 'Volleyball') return 'sets';
  if (sport === 'Badminton') return 'games';
  if (sport === 'Football' || sport === 'Futsal') return 'goals';
  return 'score';
}

function validVolleyballSet(a, b, target, winBy) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 || a === b) return false;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return high >= target && high - low >= winBy;
}

function validBadmintonGame(a, b, target, winBy, maxScore) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 || a === b) return false;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high > maxScore || low >= maxScore) return false;
  if (high === maxScore) return low >= maxScore - 2;
  return high >= target && high - low >= winBy;
}

export function buildMatchResult(state, match, input = {}) {
  const [aId, bId] = resolvedTeams(match, state.matches);
  if (!aId || !bId) throw new Error('Both participants must be known before recording a result.');

  const status = input.status || 'final';
  const mode = sportScoringMode(state.settings.sport);
  const final = status === 'final';

  if (mode === 'sets' || mode === 'games') {
    const isVolleyball = mode === 'sets';
    const bestOf = Math.max(1, Number(isVolleyball ? state.settings.bestOfSets : state.settings.bestOfGames) || 3);
    const targetWins = Math.ceil(bestOf / 2);
    const raw = Array.isArray(input.periods) ? input.periods : [];
    const periods = [];
    let winsA = 0;
    let winsB = 0;

    for (let i = 0; i < Math.min(bestOf, raw.length); i += 1) {
      const item = raw[i] || {};
      if (item.a === '' || item.b === '' || item.a == null || item.b == null) continue;
      const a = Number(item.a);
      const b = Number(item.b);
      const target = isVolleyball && i === bestOf - 1
        ? Math.max(1, Number(state.settings.decidingSetTarget) || 15)
        : Math.max(1, Number(isVolleyball ? state.settings.setTarget : state.settings.gameTarget) || (isVolleyball ? 25 : 21));
      const winBy = Math.max(1, Number(state.settings.winBy) || 2);
      const valid = isVolleyball
        ? validVolleyballSet(a, b, target, winBy)
        : validBadmintonGame(a, b, target, winBy, Math.max(target, Number(state.settings.maxGameScore) || 30));
      if (!valid) throw new Error((isVolleyball ? 'Set ' : 'Game ') + (i + 1) + ' has an invalid score.');
      periods.push({ a, b });
      if (a > b) winsA += 1;
      else winsB += 1;
      if ((winsA >= targetWins || winsB >= targetWins) && i < raw.length - 1) {
        const laterFilled = raw.slice(i + 1).some((entry) => entry && entry.a !== '' && entry.b !== '' && entry.a != null && entry.b != null);
        if (laterFilled) throw new Error('Extra scores were entered after the match winner was already decided.');
      }
    }

    if (final && winsA < targetWins && winsB < targetWins) {
      throw new Error('The match is not complete yet. A participant must win ' + targetWins + ' ' + (isVolleyball ? 'sets.' : 'games.'));
    }

    const winnerId = final ? (winsA > winsB ? aId : bId) : null;
    return {
      scoreA: winsA,
      scoreB: winsB,
      status,
      resultType: 'normal',
      resultDetails: { mode, periods },
      winnerOverrideId: winnerId,
      resultParticipantIds: [aId, bId]
    };
  }

  const scoreA = Number(input.scoreA);
  const scoreB = Number(input.scoreB);
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0) {
    throw new Error('Enter valid non-negative scores.');
  }

  let winnerId = null;
  let tieBreak = null;
  if (final) {
    if (scoreA > scoreB) winnerId = aId;
    else if (scoreB > scoreA) winnerId = bId;
    else if (match.kind === 'knockout') {
      if (![aId, bId].includes(input.tieBreakWinnerId)) {
        throw new Error('A knockout match that finishes level requires a tie-break winner.');
      }
      winnerId = input.tieBreakWinnerId;
      tieBreak = {
        type: input.tieBreakType || state.settings.knockoutTieBreak || 'manual',
        winnerId
      };
    }
  }

  return {
    scoreA,
    scoreB,
    status,
    resultType: 'normal',
    resultDetails: tieBreak ? { mode, tieBreak } : { mode },
    winnerOverrideId: winnerId,
    resultParticipantIds: [aId, bId]
  };
}

export function groupStandings(state, group) {
  const table = {};
  state.teams.filter((team) => team.group === group).forEach((team) => {
    table[team.id] = { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, sf: 0, sa: 0, sd: 0, pts: 0 };
  });

  state.matches.filter((match) => match.kind === 'group' && match.stage === group && match.status === 'final').forEach((match) => {
    const a = table[match.teamAId];
    const b = table[match.teamBId];
    if (!a || !b) return;
    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

    a.p += 1;
    b.p += 1;
    a.gf += scoreA;
    a.ga += scoreB;
    b.gf += scoreB;
    b.ga += scoreA;
    a.sf += scoreA;
    a.sa += scoreB;
    b.sf += scoreB;
    b.sa += scoreA;

    if (scoreA > scoreB) {
      a.w += 1;
      b.l += 1;
      a.pts += Number(state.settings.winPoints) || 0;
      b.pts += Number(state.settings.lossPoints) || 0;
    } else if (scoreB > scoreA) {
      b.w += 1;
      a.l += 1;
      b.pts += Number(state.settings.winPoints) || 0;
      a.pts += Number(state.settings.lossPoints) || 0;
    } else {
      a.d += 1;
      b.d += 1;
      a.pts += Number(state.settings.drawPoints) || 0;
      b.pts += Number(state.settings.drawPoints) || 0;
    }
  });

  Object.values(table).forEach((row) => {
    row.gd = row.gf - row.ga;
    row.sd = row.sf - row.sa;
  });

  return Object.values(table).sort((a, b) =>
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    drawSortValue(a.team) - drawSortValue(b.team)
  );
}

export function addDays(dateValue, days) {
  if (!dateValue) return '';
  const parts = String(dateValue).split('-').map(Number);
  if (parts.length !== 3) return dateValue;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function dateRange(start, end, maxDays = 31) {
  if (!start) return [];
  const values = [start];
  if (!end || end <= start) return values;
  let current = start;
  while (current < end && values.length < maxDays) {
    current = addDays(current, 1);
    values.push(current);
  }
  return values;
}

export function getScheduleDates(settings) {
  const explicit = Array.isArray(settings.availableDates)
    ? [...new Set(settings.availableDates.filter(Boolean))].sort()
    : [];
  if (explicit.length) return explicit;

  if (settings.durationType === '2_day') return [settings.date, addDays(settings.date, 1)].filter(Boolean);
  if (settings.durationType === 'weekly') {
    const count = Math.max(2, Math.min(12, Number(settings.weeklyCount) || 4));
    return Array.from({ length: count }, (_, index) => addDays(settings.date, index * 7)).filter(Boolean);
  }
  if (settings.durationType === 'custom' && settings.endDate) return dateRange(settings.date, settings.endDate);
  return settings.date ? [settings.date] : [];
}

export function getPlayingAreas(settings) {
  const explicit = Array.isArray(settings.playingAreas)
    ? settings.playingAreas.map((area) => typeof area === 'string' ? area.trim() : String(area?.name || '').trim()).filter(Boolean)
    : [];
  if (explicit.length) return [...new Set(explicit)];
  const count = Math.max(1, Number(settings.courts) || 1);
  const label = settings.sport === 'Football' ? 'Field' : settings.sport === 'Other' ? 'Area' : 'Court';
  return Array.from({ length: count }, (_, index) => label + ' ' + (index + 1));
}

function timeToMinutes(value, fallback) {
  const parts = String(value || fallback || '00:00').split(':').map(Number);
  const hour = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minute = Number.isFinite(parts[1]) ? parts[1] : 0;
  return hour * 60 + minute;
}

function stamp(date, minuteOfDay) {
  const parts = String(date || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return NaN;
  return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, Number(minuteOfDay) || 0) / 60000);
}

function stampFromDateTime(date, time) {
  return stamp(date, timeToMinutes(time, '00:00'));
}

function minuteToTime(total) {
  const minute = ((Number(total) % 1440) + 1440) % 1440;
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function matchInterval(match, settings) {
  if (!match?.date || !match?.time) return null;
  const duration = Math.max(1, Number(settings.matchDurationMinutes) || ((Number(settings.halfMinutes) || 15) * 2 + (Number(settings.breakMinutes) || 0)));
  const turnaround = Math.max(0, Number(settings.betweenMatchesMinutes) || 0);
  const start = stampFromDateTime(match.date, match.time);
  if (!Number.isFinite(start)) return null;
  const matchEnd = match.scheduledEnd ? stampFromDateTime(match.date, match.scheduledEnd) : start + duration;
  const slotEnd = match.slotEnd ? stampFromDateTime(match.date, match.slotEnd) : matchEnd + turnaround;
  return { start, matchEnd, slotEnd };
}

function dependencyReadyStamp(match, matches, settings) {
  const rest = Math.max(0, Number(settings.minimumRestMinutes) || 0);
  const sources = [match.sourceA, match.sourceB].filter((source) => source?.type === 'winner');
  let earliest = -Infinity;
  sources.forEach((source) => {
    const previous = matches.find((item) => item.id === source.matchId);
    const interval = matchInterval(previous, settings);
    if (interval) earliest = Math.max(earliest, interval.matchEnd + rest);
  });
  return earliest;
}

function blockedFor(settings, date, area, start, end) {
  const blocks = Array.isArray(settings.blockedPeriods) ? settings.blockedPeriods : [];
  return blocks.some((block) => {
    if (!block || block.date !== date) return false;
    const targetArea = block.areaId || block.area || '';
    if (targetArea && targetArea !== area && targetArea !== 'All') return false;
    const blockStart = stampFromDateTime(date, block.start);
    const blockEnd = stampFromDateTime(date, block.end);
    return Number.isFinite(blockStart) && Number.isFinite(blockEnd) && overlaps(start, end, blockStart, blockEnd);
  });
}

export function scheduleMatches(input, settings) {
  const matches = input.map((match) => ({ ...match })).sort((a, b) => Number(a.matchNo) - Number(b.matchNo));
  if (!matches.length) return matches;

  const dates = getScheduleDates(settings);
  const areas = getPlayingAreas(settings);
  const duration = Math.max(1, Number(settings.matchDurationMinutes) || ((Number(settings.halfMinutes) || 15) * 2 + (Number(settings.breakMinutes) || 0)));
  const turnaround = Math.max(0, Number(settings.betweenMatchesMinutes) || 0);
  const rest = Math.max(0, Number(settings.minimumRestMinutes) || 0);
  const startMinute = timeToMinutes(settings.startTime, '09:00');
  let endMinute = timeToMinutes(settings.endTime, '23:30');
  if (endMinute <= startMinute) endMinute = 24 * 60;

  const allocations = [];

  function reserve(match) {
    const interval = matchInterval(match, settings);
    if (!interval || !match.court) return;
    allocations.push({
      id: match.id,
      area: match.court,
      start: interval.start,
      matchEnd: interval.matchEnd,
      slotEnd: interval.slotEnd,
      teams: resolvedTeams(match, matches).filter(Boolean)
    });
  }

  matches.forEach((match) => {
    if (match.scheduleLocked && match.date && match.time && match.court) reserve(match);
  });

  for (const match of matches) {
    if (match.scheduleLocked && match.date && match.time && match.court) {
      match.scheduleStatus = 'scheduled';
      continue;
    }

    let assigned = null;
    const teams = resolvedTeams(match, matches).filter(Boolean);
    const dependencyReady = dependencyReadyStamp(match, matches, settings);

    for (const date of dates) {
      if (assigned) break;
      for (let minute = startMinute; minute + duration + turnaround <= endMinute; minute += 5) {
        if (assigned) break;
        const start = stamp(date, minute);
        const matchEnd = start + duration;
        const slotEnd = matchEnd + turnaround;
        if (start < dependencyReady) continue;

        for (const area of areas) {
          if (blockedFor(settings, date, area, start, slotEnd)) continue;
          const conflict = allocations.some((item) => {
            if (item.area === area && overlaps(start, slotEnd, item.start, item.slotEnd)) return true;
            if (!teams.length || !item.teams.some((teamId) => teams.includes(teamId))) return false;
            if (overlaps(start, matchEnd, item.start, item.matchEnd)) return true;
            if (start >= item.matchEnd && start - item.matchEnd < rest) return true;
            if (item.start >= matchEnd && item.start - matchEnd < rest) return true;
            return false;
          });
          if (conflict) continue;

          assigned = {
            date,
            time: minuteToTime(minute),
            court: area,
            scheduledEnd: minuteToTime(minute + duration),
            slotEnd: minuteToTime(minute + duration + turnaround),
            scheduleStatus: 'scheduled'
          };
          allocations.push({ id: match.id, area, start, matchEnd, slotEnd, teams });
          break;
        }
      }
    }

    if (assigned) Object.assign(match, assigned);
    else {
      match.date = '';
      match.time = '';
      match.court = '';
      match.scheduledEnd = '';
      match.slotEnd = '';
      match.scheduleStatus = 'unscheduled';
    }
  }

  return matches;
}

export function validateScheduleChange(state, matchId, patch) {
  const target = state.matches.find((match) => match.id === matchId);
  if (!target) return ['Match not found.'];
  const candidate = { ...target, ...patch };
  if (!candidate.date || !candidate.time || !candidate.court) return [];
  const settings = state.settings;
  const interval = matchInterval(candidate, settings);
  if (!interval) return ['Invalid date or time.'];

  const errors = [];
  const dates = getScheduleDates(settings);
  if (dates.length && !dates.includes(candidate.date)) errors.push('The selected date is outside the tournament availability.');
  if (blockedFor(settings, candidate.date, candidate.court, interval.start, interval.slotEnd)) {
    errors.push('The selected time overlaps a blocked period.');
  }

  const teams = resolvedTeams(candidate, state.matches).filter(Boolean);
  const rest = Math.max(0, Number(settings.minimumRestMinutes) || 0);
  state.matches.filter((match) => match.id !== matchId && match.date && match.time).forEach((other) => {
    const otherInterval = matchInterval(other, settings);
    if (!otherInterval) return;
    if (other.court === candidate.court && overlaps(interval.start, interval.slotEnd, otherInterval.start, otherInterval.slotEnd)) {
      errors.push(candidate.court + ' is already occupied by Match ' + other.matchNo + '.');
    }
    const otherTeams = resolvedTeams(other, state.matches).filter(Boolean);
    if (teams.some((teamId) => otherTeams.includes(teamId))) {
      if (overlaps(interval.start, interval.matchEnd, otherInterval.start, otherInterval.matchEnd)) {
        errors.push('A participant is already scheduled in Match ' + other.matchNo + ' at this time.');
      } else if (interval.start >= otherInterval.matchEnd && interval.start - otherInterval.matchEnd < rest) {
        errors.push('Minimum participant rest time is not satisfied after Match ' + other.matchNo + '.');
      } else if (otherInterval.start >= interval.matchEnd && otherInterval.start - interval.matchEnd < rest) {
        errors.push('Minimum participant rest time is not satisfied before Match ' + other.matchNo + '.');
      }
    }
  });

  const dependencyReady = dependencyReadyStamp(candidate, state.matches, settings);
  if (Number.isFinite(dependencyReady) && interval.start < dependencyReady) {
    errors.push('This knockout match starts before its prerequisite match and rest period are complete.');
  }

  return [...new Set(errors)];
}

export function timerElapsedSeconds(timer, now = Date.now()) {
  if (!timer) return 0;
  const stored = Math.max(0, Number(timer.elapsedSec) || 0);
  if (!timer.running || !timer.startedAt) return stored;
  return stored + Math.max(0, Math.floor((now - Number(timer.startedAt)) / 1000));
}

export function timerRemainingSeconds(timer, now = Date.now()) {
  if (!timer) return 0;
  return Math.max(0, (Number(timer.durationSec) || 0) - timerElapsedSeconds(timer, now));
}

export function formatTimer(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const remainder = String(safe % 60).padStart(2, '0');
  return minutes + ':' + remainder;
}

export function timerPhaseLabel(phase) {
  if (phase === 'period1') return 'Period 1';
  if (phase === 'break') return 'Break';
  if (phase === 'period2') return 'Period 2';
  if (phase === 'finished') return 'Finished';
  return 'Not started';
}

export function deriveTournamentStatus(tournament) {
  if (tournament?.status === 'cancelled' || tournament?.status === 'archived') return tournament.status;
  const matches = Array.isArray(tournament?.matches) ? tournament.matches : [];
  if (!matches.length) {
    const date = tournament?.settings?.date;
    if (!date) return 'draft';
    return 'upcoming';
  }
  const completed = matches.filter((match) => match.status === 'final').length;
  const live = matches.some((match) => match.status === 'live');
  if (completed === matches.length && matches.length) return 'completed';
  if (completed > 0 || live) return 'ongoing';
  return 'upcoming';
}

export function workflowState(state) {
  const registered = state.teams.length > 0;
  const drawComplete = registered && state.teams.every((team) => drawValue(team) != null);
  const drawLocked = drawComplete && state.draw?.status === 'locked';
  const fixtures = state.matches.length > 0;
  const completed = fixtures && state.matches.every((match) => match.status === 'final');
  const stages = [
    ['Register teams', registered, state.teams.length + ' team' + (state.teams.length === 1 ? '' : 's') + ' submitted'],
    ['Run official draw', drawComplete, drawComplete ? 'Draw assignments completed' : 'Assign every team a draw position'],
    ['Lock draw', drawLocked, drawLocked ? 'Official draw locked' : 'Confirm the draw before fixtures'],
    ['Generate fixtures', fixtures, fixtures ? state.matches.length + ' matches generated' : 'Build the competition structure'],
    ['Record results', completed, completed ? 'All matches completed' : 'Update scores and standings']
  ];
  const firstIncomplete = stages.findIndex((stage) => !stage[1]);
  return stages.map(([label, done, hint], index) => ({ label, done, hint, number: index + 1, current: index === firstIncomplete }));
}

export function tournamentYear(tournament) {
  const value = tournament?.settings?.date || '';
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}
