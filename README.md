# SPIKE CUP 26 Tournament Manager — Next.js

Next.js App Router rebuild of the SPIKE CUP 26 tournament management application.

## Architecture

- Next.js App Router
- React client state with browser localStorage persistence
- Separate application routes:
  - `/` dashboard
  - `/teams`
  - `/draw`
  - `/matches`
  - `/rules`
  - `/settings`
- Shared tournament state in `lib/tournament-context.js`
- Tournament/draw/fixture calculations in `lib/tournament.js`
- Responsive shared application shell in `components/AppShell.js`

## Current capabilities

- Team registration and team limit control
- Random draw-letter assignment
- Knockout, group-stage, and groups + knockout tournament formats
- Round-robin group fixture generation
- Group standings
- Knockout bracket generation with BYEs
- Automatic winner propagation
- Result entry and match status
- Rules administration
- Tournament settings
- Local JSON backup import/export

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel

Import the GitHub repository into Vercel. Vercel should detect Next.js automatically. No custom build command or output directory is required.

## Production roadmap

The current version intentionally preserves localStorage so the migration does not introduce a backend dependency immediately. Recommended next phase:

1. Firebase Authentication for organizer/admin access.
2. Firestore or Realtime Database for multi-device synchronization.
3. Audit log for teams, draw, settings and results.
4. Public read-only fixtures and standings view.
5. PDF/Excel exports.
