# SPIKE CUP 26 Tournament Manager

A mobile-first, dependency-free tournament management web app for volleyball and other team sports.

## Included

- Dashboard with registration progress, event information, format and match status
- Team registration with capacity control
- Random team draw with unique draw letters (A, B, C...)
- Tournament formats:
  - Knockout only
  - Group stage only
  - Groups + knockout
- Group allocation and round-robin fixture generation
- Group standings with configurable win points
- Knockout bracket fixture generation, including BYEs when required
- Automatic winner propagation to later knockout rounds
- Match score/status entry
- Rules management
- Settings for team count, format, groups, qualifiers, sets, venue and dates
- Local JSON backup export/import
- Browser localStorage persistence

## Run

Open `index.html` directly in a modern browser, or serve the folder with any static server.

Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Data model / important behavior

- Team list changes clear the existing draw and fixtures because the tournament structure is no longer valid.
- Structural settings changes (format, number of groups, qualifiers, team limit) also require a new draw and fixtures.
- The app stores data in the current browser only. Use **Export backup** regularly if this is the operational tournament record.
- For multi-user use across phones/computers, replace localStorage with a shared backend such as Firebase/Supabase.

## Recommended next production upgrade

1. Firebase Authentication for organizer/admin access.
2. Firestore or Realtime Database for multi-device synchronization.
3. Audit log for team, draw, result and settings changes.
4. Public read-only fixture/standings page.
5. PDF/Excel export for submitted teams and match schedules.
6. Optional Google Sheets sync for registration and results reporting.