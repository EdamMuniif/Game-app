export const DEFAULT_STATE = {
  settings: {
    tournamentName: 'SPIKE CUP 26',
    sport: 'Volleyball',
    venue: 'Thilafushi Shipyard Stadium',
    date: '2026-10-22',
    submissionDeadline: '2026-10-18',
    maxTeams: 8,
    format: 'knockout',
    groupCount: 2,
    advancePerGroup: 2,
    bestOfSets: 3,
    winPoints: 3,
    courts: 1,
    startTime: '18:00',
    halfMinutes: 15,
    breakMinutes: 5,
    betweenMatchesMinutes: 10
  },
  teams: [],
  matches: [],
  rules: [
    { id: 'rule-eligibility', title: 'Player eligibility', text: 'Only players submitted on the approved team list may participate.' },
    { id: 'rule-draw', title: 'Team draw', text: 'The official draw letter determines placement in the tournament structure.' },
    { id: 'rule-results', title: 'Results', text: 'A final match result must identify a winner. Tournament officials confirm all recorded results.' }
  ],
  activity: [],
  knockoutGeneratedFromGroups: false
};

export function formatDate(value) {
  if (!value) return 'Not set';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function formatLabel(format) {
  return format === 'knockout' ? 'Knockout' : format === 'groups' ? 'Group Stage' : 'Groups + Knockout';
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

export function assignGroups(teams, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  return teams.map((team) => ({ ...team, group: `Group ${String.fromCharCode(65 + (team.drawIndex % count))}` }));
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
  return `Round of ${size}`;
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

export function createGroupMatches(teams) {
  const groups = groupedTeams(teams);
  const matches = [];
  let matchNo = 1;
  Object.entries(groups).forEach(([group, members]) => {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        matches.push({
          id: crypto.randomUUID(), kind: 'group', stage: group, round: group, matchNo: matchNo++,
          teamAId: members[i].id, teamBId: members[j].id, scoreA: null, scoreB: null,
          status: 'scheduled', date: '', time: '', court: ''
        });
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
      const id = crypto.randomUUID();
      const sourceA = { type: 'team', id: preliminaryTeams[i * 2] };
      const sourceB = { type: 'team', id: preliminaryTeams[(i * 2) + 1] };
      matches.push({
        id, kind: 'knockout', stage: stageLabel, round: preliminaryRound, matchNo: matchNo++, sourceA, sourceB,
        scoreA: null, scoreB: null, status: 'scheduled', winnerId: null, date: '', time: '', court: ''
      });
      preliminaryWinnerSources.push({ type: 'winner', matchId: id });
    }

    let byeIndex = 0;
    let winnerIndex = 0;
    while (mainSources.length < mainSize) {
      if (byeIndex < byeTeams.length) {
        mainSources.push({ type: 'team', id: byeTeams[byeIndex++] });
      }
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
      const id = crypto.randomUUID();
      matches.push({
        id, kind: 'knockout', stage: stageLabel, round: roundName, matchNo: matchNo++,
        sourceA: roundSources[i], sourceB: roundSources[i + 1],
        scoreA: null, scoreB: null, status: 'scheduled', winnerId: null, date: '', time: '', court: ''
      });
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
  if (match.kind === 'group') return [match.teamAId, match.teamBId];
  return [sourceTeamId(match.sourceA, matches), sourceTeamId(match.sourceB, matches)];
}

export function recomputeKnockout(input) {
  const matches = input.map((match) => ({ ...match }));
  matches.filter((match) => match.kind === 'knockout').forEach((match) => {
    const [a, b] = resolvedTeams(match, matches);
    let winner = null;

    if (
      a && b &&
      match.status === 'final' &&
      Number.isFinite(Number(match.scoreA)) &&
      Number.isFinite(Number(match.scoreB)) &&
      Number(match.scoreA) !== Number(match.scoreB)
    ) {
      winner = Number(match.scoreA) > Number(match.scoreB) ? a : b;
    }

    match.winnerId = winner;
  });
  return matches;
}

export function groupStandings(state, group) {
  const table = {};
  state.teams.filter((team) => team.group === group).forEach((team) => {
    table[team.id] = { team, p: 0, w: 0, l: 0, sf: 0, sa: 0, sd: 0, pts: 0 };
  });
  state.matches.filter((match) => match.kind === 'group' && match.stage === group && match.status === 'final').forEach((match) => {
    const a = table[match.teamAId];
    const b = table[match.teamBId];
    if (!a || !b) return;
    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) return;
    a.p += 1; b.p += 1; a.sf += scoreA; a.sa += scoreB; b.sf += scoreB; b.sa += scoreA;
    if (scoreA > scoreB) { a.w += 1; b.l += 1; a.pts += state.settings.winPoints; }
    else { b.w += 1; a.l += 1; b.pts += state.settings.winPoints; }
  });
  Object.values(table).forEach((row) => { row.sd = row.sf - row.sa; });
  return Object.values(table).sort((a, b) => b.pts - a.pts || b.sd - a.sd || b.sf - a.sf || (a.team.drawIndex ?? 999) - (b.team.drawIndex ?? 999));
}


export function addDays(dateValue, days) {
  if (!dateValue || !days) return dateValue || '';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function scheduleMatches(input, settings) {
  const matches = input.map((match) => ({ ...match }));
  if (!matches.length) return matches;

  const courts = Math.max(1, Number(settings.courts) || 1);
  const halfMinutes = Math.max(1, Number(settings.halfMinutes) || 1);
  const breakMinutes = Math.max(0, Number(settings.breakMinutes) || 0);
  const betweenMatchesMinutes = Math.max(0, Number(settings.betweenMatchesMinutes) || 0);
  const matchBlockMinutes = (halfMinutes * 2) + breakMinutes;
  const slotMinutes = Math.max(1, matchBlockMinutes + betweenMatchesMinutes);
  const [hoursRaw, minutesRaw] = String(settings.startTime || '09:00').split(':').map(Number);
  const startMinutes = (Number.isFinite(hoursRaw) ? hoursRaw : 9) * 60 + (Number.isFinite(minutesRaw) ? minutesRaw : 0);

  return matches.map((match, index) => {
    const slotIndex = Math.floor(index / courts);
    const courtIndex = index % courts;
    const absoluteMinutes = startMinutes + (slotIndex * slotMinutes);
    const dayOffset = Math.floor(absoluteMinutes / 1440);
    const minuteOfDay = ((absoluteMinutes % 1440) + 1440) % 1440;
    const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
    const minutes = String(minuteOfDay % 60).padStart(2, '0');

    return {
      ...match,
      date: addDays(settings.date, dayOffset),
      time: `${hours}:${minutes}`,
      court: `Court ${courtIndex + 1}`
    };
  });
}

export function workflowState(state) {
  const registered = state.teams.length > 0;
  const drawComplete = registered && state.teams.every((team) => team.letter);
  const fixtures = state.matches.length > 0;
  const completed = fixtures && state.matches.every((match) => match.status === 'final');
  const stages = [
    ['Register teams', registered, `${state.teams.length} team${state.teams.length === 1 ? '' : 's'} submitted`],
    ['Run official draw', drawComplete, drawComplete ? 'Draw letters assigned' : 'Assign a letter to each team'],
    ['Generate fixtures', fixtures, fixtures ? `${state.matches.length} matches generated` : 'Build the competition structure'],
    ['Record results', completed, completed ? 'All matches completed' : 'Update scores and standings']
  ];
  const firstIncomplete = stages.findIndex((stage) => !stage[1]);
  return stages.map(([label, done, hint], index) => ({ label, done, hint, number: index + 1, current: index === firstIncomplete }));
}
