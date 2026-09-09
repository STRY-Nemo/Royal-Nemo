# Progress log

Short handoff so another coding agent can resume without the original conversation. Spec lives in `docs/spec/`.

## Status by milestone

| Milestone | Status | Notes |
| --- | --- | --- |
| 1. Mobile shell, seed data, Friday scheduling, availability, Organize page, shared motion, demo persistence | **Done** | All 100 members load; 16 responsibilities round-trip; localStorage demo clearly labeled; no fabricated attendance |
| 2. Deterministic rotation engine + tests, explanations, locks/swaps | **Done** | `src/engine/suggest.ts`, 28 Vitest cases pass (`npm test`) |
| 3. Publish/revisions, attendance, finalization, history, next-week rotation | **Done** | End-to-end verified in tests and a Playwright phone walkthrough |
| 4. Authenticated shared DB, server authorization, concurrency, deployment, backup/export, phone QA | **Deployed** | API live at https://stry-alliance-api.ryan-r-hernandez.workers.dev; site builds in connected mode via `.env.production`. Physical-phone QA still pending |

## Latest additions (2026-09-09)

- **Apocalypse Time** (`APOCALYPSE_TIME_ZONE = 'Etc/GMT+2'`) is the default event and settings timezone, labelled in pickers and shown as "AT" next to team times.
- **In-game team screen import** (`src/engine/lineupImport.ts`, `src/import/tables.ts`, `src/screens/ImportScreen.tsx`, `POST /events/:id/import-lineup`). The Team 1 and Team 2 files for 2026-09-11 ship in `public/imports/` and is offered with one tap when the event date matches. Starters and substitutes are imported as locked assignments; `applySuggestions` now keeps locked reserves.
- Tests: 43 unit (+ real-file parsing and import scenarios), 11 API integration.

## Hosting

GitHub Pages, deployed by Actions from `main` and `claude/alliance-app-last-z-f572n4`: https://ryanrhernandez-design.github.io/Royal-Nemo/. The workflow also runs typecheck, tests and build on pull requests. `BASE_PATH` sets the Vite base for the repository sub-path. Note: this repository's Pages site previously served a game from the `claude/game-copy-vibe-65sbfz` branch; that deployment is replaced by the alliance app. Re-running that branch's workflow would swap it back.

## Milestone 4 summary

- `server/src/index.ts`: every mutation endpoint loads the event/board, runs the pure engine function, and writes with `UPDATE … WHERE revision = ?` inside a D1 batch with the audit rows (409 on conflict). Members may only touch their own availability/confirmation; leaders everything else. Mechanical notes and audit are stripped for members.
- Auth: PBKDF2 passwords, hashed bearer tokens (90 days), `OWNER_SETUP_CODE` bootstraps the first leader only while no leader exists, invites (`role`, `uses`, `days`) for everyone else, accounts screen for leaders.
- Client: `src/store/store.tsx` picks demo or API mode from `VITE_API_URL`; API mode applies changes optimistically, then replaces with the server copy or rolls back with a toast; refreshes on navigation, focus and every 30 s; caches the last state for offline reading.
- Deploy: `deploy-worker.yml` creates the D1 database, applies migrations, deploys, sets the `OWNER_SETUP_CODE` secret and verifies `.env.production` points at the Worker URL. Until the Cloudflare secrets exist it exits with a notice.
- Tests: `npm run test:server` (10 cases, local wrangler). Two-browser Playwright flow verified locally (owner + member).

## Commits

1. `Scaffold STRY alliance app with domain model, rotation engine and tests`
2. `Add mobile app shell, Canyon Clash flows, Organize page and motion system`
3. Docs + progress file
4. `Deploy to GitHub Pages and add a web-app manifest`

## How to resume

```bash
npm install && npm test && npm run dev
```

Open Settings (gear icon) → choose a member and the Leader role. Canyon → Event time → set timezone and confirm date → Set availability (or record for members) → Generate suggestions → Review & publish → Attendance → Finalize. A draft for the following Friday is created automatically after finalizing.

## Design decisions worth knowing

- **Engine is pure.** `src/engine/*` never imports React or the store. Lifecycle functions take an event, return a new event plus audit entries, and throw `LifecycleError` with a stable `code`. The store (`src/store/store.tsx`) is a thin wrapper that adds role checks, undo stacks and toasts. Milestone 4 should call the same functions server-side.
- **History is derived, not incremented.** `computeHistory` reads finalized events and unique attendance records; finalizing twice or correcting an outcome cannot double count.
- **Revision numbers** exist on events and on the organization board. Every mutating action passes the expected revision and fails with `stale_revision` ("Reload to compare") if it differs. On the server this becomes a compare-and-set.
- **Team ids** are `${eventId}:team1` / `:team2`; availability `team1|team2|either|unavailable` maps to teams by index in `allowedTeamIds`.
- **Undo** uses inverse edits (organization) or assignment snapshots (lineup) with revision validation, so it never silently overwrites another leader.
- **Motion**: `data-motion` on `<html>` (`system|full|reduced|off`) drives CSS tokens in `src/styles/tokens.css`. All screens use `src/motion` components (BottomSheet, ConfirmSheet, toasts with Undo, live region, StarBurst, OrbitSpinner, SaveIndicator, useSingleFlight).
- **Drag and drop** (`src/ui/useLongPressDrag.ts`): 250 ms long-press on the grip, pointer capture, edge auto-scroll that accounts for the header and tab bar, Escape cancels. Every drag has a tap equivalent ("Move to another slot…", "Swap with another slot…").

## Next steps

1. Owner creates the first leader account in the live app with the `OWNER_SETUP_CODE`, then invites the alliance (Settings → Alliance accounts).
2. Physical-phone QA for drag auto-scroll, keyboard-aware sheets and reduced-motion. Verification so far was emulator-only.
3. Optional hardening: rate-limit `/auth/login` (Cloudflare WAF rule or a KV counter), password reset via a leader-issued reset code, scheduled D1 export to R2 for off-platform backups.
4. Deferred features from the spec: other alliance events, game data import for attendance (with review before finalization), reminders, analytics.

## Known gaps / small follow-ups

- Bulk "Mark remaining as Played" uses a native `confirm()` dialog; could become a ConfirmSheet with a preview list.
- Availability for team-time changes is cleared (as spec requires) but members are not notified; there is no reminder automation by design.
- The Members list origin filter is cohort provenance only, per spec; it never excludes anyone from selection.
- Haptics are optional and only vibrate where `navigator.vibrate` exists.
