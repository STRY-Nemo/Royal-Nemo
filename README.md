# STRY Alliance App

Mobile-only organizer for the STRY alliance in Last Z. The first working feature is the weekly **Canyon Clash** rotation (two teams of 20, every Friday), plus an editable **Organize** page for leadership responsibilities and a **Members** directory.

The build follows the handoff package in `docs/spec/` (PRODUCT_SPEC, DESIGN, ORGANIZATION, MOTION_AND_QOL). See `PROGRESS.md` for milestone status and what another agent should pick up next.

## Hosted demo

The app is published to GitHub Pages by `.github/workflows/deploy-pages.yml` on every push to `main` or the app branch:

**https://ryanrhernandez-design.github.io/Royal-Nemo/**

Open it on a phone and use "Add to Home Screen" for an app-like icon. Until the alliance server is deployed the site runs in **demo mode** (data stays in each phone). Follow `docs/DEPLOY.md` (about 10 minutes, phone-friendly) to deploy the shared server; after that everyone signs in and sees the same data.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (use your phone or a 360px-wide devtools viewport)
npm test           # Vitest: rotation engine, lifecycle, recurrence, organization
npm run typecheck
npm run build      # production bundle in dist/
```

Open the app, tap the gear icon, and choose which member you are and whether to preview the **Leader** or **Member** role. This is a **demo**: data is stored only in the browser's localStorage and is clearly labeled as such in the UI. Nothing is shared between devices until milestone 4 adds a server.

## Stack

- **Vite + React 19 + TypeScript** with plain CSS custom properties for the celestial design tokens. No UI framework, no AI API. Weekly selection runs with no external service.
- **Pure engine** in `src/engine/` with no React or storage imports. The client and the server run the same functions.
- **Cloudflare Worker + D1 (SQLite)** in `server/`: username/password accounts, leader invite codes, server-enforced rules and revision compare-and-set, audit trail, export. Deployed by GitHub Actions; see `docs/DEPLOY.md`.
- **Vitest** for the engine and lifecycle acceptance scenarios, plus integration tests that boot the Worker locally with wrangler.

The repository was empty apart from a README, so a small maintained stack was chosen as the spec allows.

## Modes

| Mode | When | Data |
| --- | --- | --- |
| Demo | `VITE_API_URL` is empty (default GitHub Pages build until the server is deployed) | localStorage on each device, labelled in the UI, role switch in Settings |
| Connected | `VITE_API_URL` points at the deployed Worker | Shared D1 database, real accounts and roles, optimistic updates rolled back when the server rejects them, refresh on navigation / focus / every 30 s |

## Layout

| Path | What it is |
| --- | --- |
| `src/domain/types.ts` | Shared data model: Member, CanyonEvent, Team, Availability, Assignment, Attendance, Responsibility, audit entries |
| `src/engine/suggest.ts` | Deterministic rotation: lexicographic fairness ranking, persisted seeded lottery, min-cost max-flow over both team times, flexible-player power balancing, per-candidate explanations |
| `src/engine/history.ts` | Rolling 8-finalized-event window derived from unique attendance records (never counters) |
| `src/engine/lifecycle.ts` | Drafts, availability, locks, swaps, moves, publish revisions, confirmations, attendance, idempotent finalization, cancellation, schedule edits, next-week drafts |
| `src/engine/organization.ts` | Responsibility slot edits, moves, atomic swaps, undo inverses, task management, source-name mapping suggestions |
| `src/engine/recurrence.ts` | Friday derivation, IANA timezone wall-clock conversion (DST-safe), device-local display helpers |
| `src/engine/*.test.ts` | Acceptance tests from PRODUCT_SPEC and ORGANIZATION |
| `src/store/` | Store (demo persistence or API sync with optimistic updates), hash router with per-tab memory and scroll restore, in-memory UI state |
| `src/api/client.ts` | Typed fetch client for the API |
| `server/` | Cloudflare Worker (`src/index.ts` routes, `auth.ts`, `db.ts`), D1 migrations, integration tests |
| `.github/workflows/` | `deploy-pages.yml` (test, build, publish site) and `deploy-worker.yml` (migrate + deploy API once Cloudflare secrets exist) |
| `src/motion/` | Motion tokens, Full / Reduced / Off, bottom sheet, toasts with Undo, live announcements, star burst, orbital progress, single-flight guard |
| `src/screens/` | Home, Canyon overview, Availability, Schedule, Roster + player action sheet, Suggestion review + publish, Attendance, History, Organize, Name mapping, Members, Member detail, Settings |
| `src/data/` | Verified seed data: 100 members, 16 responsibilities, event draft |
| `docs/spec/` | The original specification package, unchanged |
| `docs/source/` | Original spreadsheets, unchanged |
| `public/brand/` | Celestial logo (resized for web) |

## Rotation rules implemented

- Eligible = active member with an explicit availability for that team's time. No response means unknown, not available. One team per member per week.
- Rank: fewest plays in the last 8 finalized events, then most weeks benched while available, then longest since last played (never recorded first), then a persisted seeded lottery. The seed is stored on the event so tapping Generate twice never re-rolls ties.
- Assignment fills both times jointly with min-cost max-flow (max filled slots first, then the fairest set). Flexible "either" players are never greedily stranded.
- Arena power only balances which team a selected flexible player joins. It is never admission ranking.
- Locks require a reason, are audited, and never bypass capacity, uniqueness or availability. Conflicting locks block generation with actionable errors.
- Publishing records selection only. Leader-confirmed attendance (played / no-show / withdrew / unused reserve / unknown, incl. substitutes) drives history. Finalization is idempotent; corrections recalculate.
- Canceled events and Glory Wars data never affect fairness. Tracking starts on import (2026-09-09).

## Verification done

- 31 Vitest cases covering the spec's acceptance scenarios, including the five-week "everyone gets two plays" simulation, plus 10 API integration tests (owner bootstrap, invites, permissions, private notes, stale revisions, capacity/availability on locks, publish blockers, idempotent finalize, atomic slot edits, account management, CORS).
- A two-browser Playwright test against the app built for a local Worker: owner registers with the setup code, schedules, fills availability, generates, publishes and creates an invite; a member registers with it in a second browser, sees the same published lineup, has no leader controls, confirms their slot, and is refused when calling a leader endpoint directly.
- A Playwright walkthrough at 360×740 (touch, mobile emulation, America/New_York device vs Europe/Berlin event): schedule → availability → generate → move/lock/swap/undo → publish → confirm → attendance → finalize → next-week draft; Organize dropdown, long-press drag with swap preview, undo; member and leader roles; motion Off. No console errors and no horizontal overflow on any screen. **Emulator only** so far: please check on a physical phone.

## Remaining product assumptions

- **Timezone** is unconfirmed. The app blocks publishing until a leader sets it on the Schedule screen.
- **Date**: 2026-09-11 is derived as the next Friday after the package date and must be confirmed by a leader.
- Attendance source is leader confirmation; there is no game integration.
- Rotation defaults are the spec's proposed defaults, not agreed alliance policy.
- Source names (Rouge, Nemo, …) stay as labels until mapped on the Organize → Map names screen. Nothing is merged automatically.
- In demo mode roles are a switch. In connected mode roles come from accounts: the first leader is created with the owner setup code, later leaders via single-use leader invites.
- Member-to-roster links chosen at sign-up are unverified until a leader verifies them in Alliance accounts.
