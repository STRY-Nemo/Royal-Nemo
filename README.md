# STRY Alliance App

Mobile-only organizer for the STRY alliance in Last Z. The first working feature is the weekly **Canyon Clash** rotation (two teams of 20, every Friday), plus an editable **Organize** page for leadership responsibilities and a **Members** directory.

The build follows the handoff package in `docs/spec/` (PRODUCT_SPEC, DESIGN, ORGANIZATION, MOTION_AND_QOL). See `PROGRESS.md` for milestone status and what another agent should pick up next.

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

- **Vite + React 19 + TypeScript** with plain CSS custom properties for the celestial design tokens. No UI framework, no AI API. Weekly selection runs entirely on-device.
- **Pure engine** in `src/engine/` with no React or storage imports, so a future server can run the same functions inside transactions.
- **Vitest** for the engine and lifecycle acceptance scenarios.

The repository was empty apart from a README, so a small maintained stack was chosen as the spec allows. A relational backend (milestone 4) is not yet implemented; the store already routes every mutation through the engine and carries revision numbers for optimistic concurrency.

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
| `src/store/` | Demo store (localStorage), hash router with per-tab memory and scroll restore, in-memory UI state |
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

- 28 Vitest cases covering the spec's acceptance scenarios, including the five-week "everyone gets two plays" simulation.
- A Playwright walkthrough at 360×740 (touch, mobile emulation, America/New_York device vs Europe/Berlin event): schedule → availability → generate → move/lock/swap/undo → publish → confirm → attendance → finalize → next-week draft; Organize dropdown, long-press drag with swap preview, undo; member and leader roles; motion Off. No console errors and no horizontal overflow on any screen. **Emulator only** so far: please check on a physical phone.

## Remaining product assumptions

- **Timezone** is unconfirmed. The app blocks publishing until a leader sets it on the Schedule screen.
- **Date**: 2026-09-11 is derived as the next Friday after the package date and must be confirmed by a leader.
- Attendance source is leader confirmation; there is no game integration.
- Rotation defaults are the spec's proposed defaults, not agreed alliance policy.
- Source names (Rouge, Nemo, …) stay as labels until mapped on the Organize → Map names screen. Nothing is merged automatically.
- Roles are a demo switch. Real access control, shared persistence, transactional checks and backups arrive with milestone 4.
