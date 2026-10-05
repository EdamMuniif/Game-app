import { timingSafeEqual } from 'node:crypto';
import { get } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_PATH = 'tournament-state.json';

function isAdmin(request) {
  const expected = process.env.TOURNAMENT_ADMIN_PIN || '';
  const supplied = request.headers.get('x-admin-pin') || '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readState() {
  const result = await get(STATE_PATH, {
    access: 'private',
    useCache: false
  });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

function tournamentFromDatabase(database, tournamentId) {
  if (Number(database?.schemaVersion) >= 2 && Array.isArray(database.tournaments)) {
    return database.tournaments.find((item) => item.id === tournamentId)
      || database.tournaments.find((item) => item.id === database.activeTournamentId)
      || database.tournaments[0]
      || null;
  }
  return database?.settings ? database : null;
}

function assistantSnapshot(tournament) {
  return {
    id: tournament.id || 'legacy',
    status: tournament.status || 'upcoming',
    settings: tournament.settings || {},
    draw: tournament.draw || null,
    teams: Array.isArray(tournament.teams)
      ? tournament.teams.map((team) => ({
          id: team.id,
          name: team.name,
          department: team.department || '',
          captain: team.captain || '',
          manager: team.manager || '',
          drawNumber: team.drawNumber ?? null,
          letter: team.letter || null,
          group: team.group || null,
          players: Array.isArray(team.players)
            ? team.players.map((player) => ({
                name: player.name,
                jersey: player.jersey || '',
                position: player.position || '',
                isCaptain: Boolean(player.isCaptain)
              }))
            : []
        }))
      : [],
    matches: Array.isArray(tournament.matches)
      ? tournament.matches.map((match) => ({
          id: match.id,
          matchNo: match.matchNo,
          kind: match.kind,
          stage: match.stage,
          round: match.round,
          teamAId: match.teamAId || null,
          teamBId: match.teamBId || null,
          sourceA: match.sourceA || null,
          sourceB: match.sourceB || null,
          scoreA: match.scoreA ?? null,
          scoreB: match.scoreB ?? null,
          winnerId: match.winnerId || null,
          status: match.status,
          resultType: match.resultType || 'normal',
          date: match.date || '',
          time: match.time || '',
          court: match.court || ''
        }))
      : []
  };
}

function responseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

export async function POST(request) {
  if (!isAdmin(request)) {
    return Response.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return Response.json({
      error: 'OPENAI_API_KEY is not configured in Vercel environment variables.'
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const question = String(body?.question || '').trim().slice(0, 1500);
    if (!question) return Response.json({ error: 'Question is required.' }, { status: 400 });

    const database = await readState();
    if (!database) return Response.json({ error: 'Tournament data is unavailable.' }, { status: 503 });

    const tournament = tournamentFromDatabase(database, body?.tournamentId);
    if (!tournament) return Response.json({ error: 'Tournament not found.' }, { status: 404 });

    const snapshot = assistantSnapshot(tournament);
    const model = process.env.OPENAI_MODEL || 'gpt-6-luna';

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 700,
        instructions: [
          'You are the read-only AI assistant for Shipyard Recreation Club Tournament Management System.',
          'Answer only from the supplied tournament snapshot and clearly say when information is not available.',
          'Do not claim to edit, save, delete, schedule, or change tournament records.',
          'Keep answers concise and operationally useful for tournament organizers.'
        ].join(' '),
        input: [
          {
            role: 'user',
            content: 'Tournament snapshot:\n' + JSON.stringify(snapshot) + '\n\nQuestion:\n' + question
          }
        ]
      })
    });

    const payload = await aiResponse.json().catch(() => ({}));
    if (!aiResponse.ok) {
      console.error('OpenAI API error:', payload);
      return Response.json({ error: payload?.error?.message || 'AI assistant request failed.' }, { status: 502 });
    }

    const answer = responseText(payload);
    if (!answer) return Response.json({ error: 'AI assistant returned an empty response.' }, { status: 502 });

    return Response.json({ answer, model }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('AI assistant failed:', error);
    return Response.json({ error: 'Unable to use the AI tournament assistant.' }, { status: 500 });
  }
}
