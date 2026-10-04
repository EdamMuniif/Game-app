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
    startTime: '18:00'
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
  const participantIds = participants.map((item) => typeof item === 'string' ? item : item.id);
  const size = nextPowerOfTwo(Math.max(2, participantIds.length));
  const slots = [...participantIds];
  while (slots.length < size) slots.push(null);
  const rounds = Math.log2(size);
  const roundIds = [];
  const matches = [];
  let matchNo = startMatchNo;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const count = size / (2 ** (roundIndex + 1));
    const idsForRound = [];
    for (let i = 0; i < count; i += 1) {
      const id = crypto.randomUUID();
      idsForRound.push(id);
      const sourceA = roundIndex === 0
        ? (slots[i * 2] ? { type: 'team', id: slots[i * 2] } : null)
        : { type: 'winner', matchId: roundIds[roundIndex - 1][i * 2] };
      const sourceB = roundIndex === 0
        ? (slots[(i * 2) + 1] ? { type: 'team', id: slots[(i * 2) + 1] } : null)
        : { type: 'winner', matchId: roundIds[roundIndex - 1][(i * 2) + 1] };
      const roundName = count === 1 ? 'Final' : count === 2 ? 'Semi-final' : count === 4 ? 'Quarter-final' : `Round ${roundIndex + 1}`;
      matches.push({
        id, kind: 'knockout', stage: stageLabel, round: roundName, matchNo: matchNo++, sourceA, sourceB,
        scoreA: null, scoreB: null, status: 'scheduled', winnerId: null, date: '', time: '', court: ''
      });
    }
    roundIds.push(idsForRound);
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
  let changed = true;
  let safety = 0;
  while (changed && safety++ < 20) {
    changed = false;
    matches.filter((match) => match.kind === 'knockout').forEach((match) => {
      const [a, b] = resolvedTeams(match, matches);
      let winner = match.winnerId;
      if (a && !b) winner = a;
      else if (!a && b) winner = b;
      else if (a && b && match.status === 'final' && Number.isFinite(Number(match.scoreA)) && Number.isFinite(Number(match.scoreB)) && Number(match.scoreA) !== Number(match.scoreB)) {
        winner = Number(match.scoreA) > Number(match.scoreB) ? a : b;
      } else if (!(a && b && match.status === 'final')) winner = null;
      if (winner !== match.winnerId) {
        match.winnerId = winner;
        changed = true;
      }
    });
  }
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
