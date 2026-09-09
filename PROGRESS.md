# Progress log

Short handoff so another coding agent can resume without the original conversation. Spec lives in `docs/spec/`.

## Status by milestone

| Milestone | Status | Notes |
| --- | --- | --- |
| 1. Mobile shell, seed data, Friday scheduling, availability, Organize page, shared motion, demo persistence | **Done** | All 100 members load; 16 responsibilities round-trip; localStorage demo clearly labeled; no fabricated attendance |
| 2. Deterministic rotation engine + tests, explanations, locks/swaps | **Done** | `src/engine/suggest.ts`, 28 Vitest cases pass (`npm test`) |
| 3. Publish/revisions, attendance, finalization, history, next-week rotation | **Done** | End-to-end verified in tests and a Playwright phone walkthrough |
| 4. Authenticated shared DB, server authorization, concurrency, deployment, backup/export, phone QA | **Not started** | See "Next steps" |

## Commits

1. `Scaffold STRY alliance app with domain model, rotation engine and tests`
2. `Add mobile app shell, Canyon Clash flows, Organize page and motion system`
3. Docs + progress file (this commit)

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

## Next steps (milestone 4)

1. Choose the backend (spec: relational). Suggested: a small Node/TypeScript API over Postgres/SQLite; keep `src/engine` shared. Tables mirror `src/domain/types.ts`.
2. Auth + `Account membership` mapping (`account_id`, `member_id`, `app_role`). Bootstrap the owner separately; never infer leader from a self-entered name.
3. Server-enforce capacity, uniqueness, one attendance outcome per member per event, role permissions and revision checks. Publish, swap and finalize as transactions.
4. Replace `src/store/store.tsx` persistence with API calls; keep optimistic updates with rollback and the Saving / Saved / Failed states.
5. Export/backup endpoints (the demo already has "Export everything as JSON" in Settings).
6. Physical-phone QA for drag auto-scroll, keyboard-aware sheets and reduced-motion. Verification so far was emulator-only.

## Known gaps / small follow-ups

- Bulk "Mark remaining as Played" uses a native `confirm()` dialog; could become a ConfirmSheet with a preview list.
- Availability for team-time changes is cleared (as spec requires) but members are not notified; there is no reminder automation by design.
- The Members list origin filter is cohort provenance only, per spec; it never excludes anyone from selection.
- Haptics are optional and only vibrate where `navigator.vibrate` exists.
