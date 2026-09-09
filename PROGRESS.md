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
- **STRY Bear** (`src/engine/mascot.ts`, `src/ui/Bear.tsx`, `src/screens/BearScreen.tsx`, `documents.mascot` on the server created lazily): feeds, per-person cooldown and daily cap enforced in the engine on both sides, 15 stages. Art goes in `public/bear/`; see `docs/BEAR_ART_PROMPT.md`.
- **Starfield** (`src/ui/Starfield.tsx`) respects the motion preference.
- **Organize access**: `canOrganize` / `setDesignatedEditor` in `organization.ts`, `designated_editors` on the organization document, `requireOrganizer` on the server, `POST /organization/editors`. Bottom sheets focus once per open (typing in Add task / Rename used to lose focus after one character).
- **Slot priorities**: `Availability.slots` (`{team1, team2}` each 1 | 2 | 0) with `choice` derived; `SlotPicker` UI; `CollectScreen` (leader grid, `/canyon/collect/:id`); suggestion flow costs rank×1000 + 1 for a second-choice slot; power balancing skips players with a first choice.
- **Weeks ahead**: `ensureUpcomingDrafts` (max 4 Fridays), `POST /events/upcoming`, Canyon "Upcoming weeks" card, Home list with per-week availability status, "Back to this week" when viewing a future draft.
- **Separate benches**: substitutes belong to one team (`teamReserves`, `waitingList`, move target `reserve:<teamId>`).
- **Ideas** (`src/engine/suggestions.ts`, `src/screens/IdeasScreen.tsx`, `server/migrations/0002_suggestions.sql`, routes under `/suggestions`): members post (5 open max, 80/1000 char limits) and vote; leaders set status + reply; `GET /suggestions/export` for the sync workflow (header `x-sync-token`, 404 without the `SUGGESTIONS_SYNC_TOKEN` secret). `.github/workflows/suggestions-sync.yml` runs every 6 h and mirrors ideas into GitHub issues (`idea` label, one per suggestion, plus a rolling digest issue) for agent analysis.
- **Join hardening**: one account per roster member (`memberClaimedBy` in `server/src/index.ts`, checked on register, self-link and leader relink; `GET /roster` returns `taken` so the join picker greys claimed names). Leader **Reset PIN** (`POST /accounts/:id/password`, clears that account's sessions; sheet in `AccountsScreen`). The ideas sync workflow stores `SUGGESTIONS_SYNC_TOKEN` on the Worker itself when the API rejects it, so no manual redeploy.
- **Themes and glass cards** (`src/ui/theme.ts`, `src/ui/ThemeSheet.tsx`, `[data-theme]` palettes in `tokens.css`): per-device choice in localStorage `stry-theme`, applied before first paint in `main.tsx`; `Backdrop` loads `art/themes/<id>.jpg` and falls back to `art/app-background.jpg`. Cards are 52% card colour + blur so the background shows. The ten delivered STRY wallpapers are in `public/art/themes/` (JPG, 200–340 KB each) with a palette each in `tokens.css`. Tab bar grid is 5 columns (the Ideas tab was wrapping off-screen at 4).
- Tests: 61 unit (+ real-file parsing and import scenarios, suggestions), 17 API integration.

## Hosting

GitHub Pages, deployed by Actions from `main` and `claude/alliance-app-last-z-f572n4`: https://stry-nemo.github.io/Royal-Nemo/. The workflow also runs typecheck, tests and build on pull requests. `BASE_PATH` sets the Vite base for the repository sub-path. Note: this repository's Pages site previously served a game from the `claude/game-copy-vibe-65sbfz` branch; that deployment is replaced by the alliance app. Re-running that branch's workflow would swap it back.

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
