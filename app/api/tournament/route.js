import { timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';

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

function stripTeam(team) {
  if (!team || typeof team !== 'object') return team;
  const { contact, ...safe } = team;
  return safe;
}

function stripTournament(tournament) {
  return {
    ...tournament,
    teams: Array.isArray(tournament.teams) ? tournament.teams.map(stripTeam) : [],
    activity: []
  };
}

function publicState(state) {
  if (Number(state?.schemaVersion) >= 2 && Array.isArray(state.tournaments)) {
    const tournaments = state.tournaments
      .filter((tournament) => tournament && tournament.public !== false && tournament.status !== 'archived')
      .map(stripTournament);
    const activeTournamentId = tournaments.some((item) => item.id === state.activeTournamentId)
      ? state.activeTournamentId
      : tournaments[0]?.id || null;
    return {
      ...state,
      activeTournamentId,
      tournaments
    };
  }

  return {
    ...state,
    teams: Array.isArray(state?.teams) ? state.teams.map(stripTeam) : [],
    activity: []
  };
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

function validState(state) {
  if (!state || typeof state !== 'object') return false;
  if (Number(state.schemaVersion) >= 2) {
    return Array.isArray(state.tournaments)
      && state.tournaments.every((tournament) =>
        tournament
        && typeof tournament === 'object'
        && tournament.settings
        && Array.isArray(tournament.teams)
        && Array.isArray(tournament.matches)
        && Array.isArray(tournament.rules)
      );
  }

  return Boolean(
    state.settings
    && Array.isArray(state.teams)
    && Array.isArray(state.matches)
    && Array.isArray(state.rules)
  );
}

export async function GET(request) {
  try {
    const state = await readState();
    if (!state) {
      return Response.json({ error: 'Tournament state not found.' }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const admin = isAdmin(request);
    return Response.json({
      access: admin ? 'admin' : 'public',
      state: admin ? state : publicState(state)
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Tournament state read failed:', error);
    return Response.json({ error: 'Unable to load tournament data.' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}

export async function PUT(request) {
  if (!isAdmin(request)) {
    return Response.json({ error: 'Admin access required.' }, { status: 401 });
  }

  try {
    const state = await request.json();

    if (!validState(state)) {
      return Response.json({ error: 'Invalid tournament database.' }, { status: 400 });
    }

    if (Number(state.schemaVersion) >= 2) {
      const ids = state.tournaments.map((item) => item.id);
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        return Response.json({ error: 'Tournament IDs must be unique.' }, { status: 400 });
      }
    }

    const body = JSON.stringify(state, null, 2);
    if (Buffer.byteLength(body, 'utf8') > 5_000_000) {
      return Response.json({ error: 'Tournament database is too large.' }, { status: 413 });
    }

    const blob = await put(STATE_PATH, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });

    return Response.json({
      ok: true,
      pathname: blob.pathname,
      etag: blob.etag,
      revision: Number(state.revision) || 0
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('Tournament state write failed:', error);
    return Response.json({ error: 'Unable to save tournament data.' }, { status: 500 });
  }
}
