# Shipyard Recreation Club Tournament Management System

A mobile-friendly tournament operations app for Shipyard Recreation Club. The application supports multiple tournaments, sport-specific scoring, official draws, fixtures, scheduling, live match control, historical datasheets, printable/PDF reports, spreadsheet exports, JSON backup/restore, and a read-only AI tournament assistant.

## Core capabilities

- Multi-tournament registry with Draft, Upcoming, Ongoing, Completed, Cancelled, and Archived states
- Sports: Football, Futsal, Volleyball, Badminton, and Other
- Numeric draws for new tournaments, with legacy letter-draw compatibility for SPIKE CUP 26
- Round Robin, Knockout, Group Stage, and Groups + Knockout formats
- Football/Futsal goals, configurable standings points, and knockout tie-break winners
- Volleyball set scoring and Badminton game scoring
- Multi-area scheduling with rest time, blocked periods, multi-day/weekly dates, conflict checks, and manual schedule locks
- Searchable Datasheet with year/sport/status/duration filters
- CSV and Excel-compatible exports, browser Print / Save PDF, and JSON backup
- Public read-only tournament data; organizer edits require the admin PIN
- Sport-based ambient motion that respects reduced-motion accessibility
- Read-only OpenAI tournament assistant for admins

## Persistent data

Tournament data is stored in the private Vercel Blob object:

`tournament-state.json`

The application automatically migrates the existing single-tournament SPIKE CUP data into schema version 2 when an administrator signs in.

Vercel Blob remains the current persistent backend. The schema is designed so a future SQL/Supabase migration can be done without redesigning the tournament model.

## Required Vercel environment variables

Configure these in the Vercel project settings. Never commit their values to GitHub.

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token
- `TOURNAMENT_ADMIN_PIN` — organizer/admin PIN

For the AI assistant also configure:

- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — optional model override. If omitted, the server uses `gpt-6-luna`.

The OpenAI key is only used from the server route and is never sent to the browser.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Important behavior

- Public visitors receive only tournaments explicitly marked public.
- Team contact information and activity logs are stripped from public API responses.
- The AI assistant is admin-only and read-only.
- Changing structural tournament settings clears the affected draw/fixtures only after organizer confirmation in the UI.
- Schedule generation never intentionally overlaps the same playing area or known participant.
- Existing SPIKE CUP 26 data and legacy letter assignments remain readable after migration.
