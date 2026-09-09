# Product specification

## Goal and scope
Give active, available STRY members roughly equal opportunities to play Canyon Clash over time. Arena power informs lineup visibility and optional team balancing; it is not the default admission ranking. Mechanical ability is a separate human judgment. Build Canyon Clash, the editable alliance responsibilities page, and the member directory as MVP features. Defer other alliance events, game integrations, push notifications, and advanced analytics.

## Proposed weekly workflow
1. Leader creates a weekly event with two team times, date, and explicit timezone. Persist actual timestamps only once those fields are known. Show both event timezone and device-local time clearly.
2. Members submit availability for Team 1 only, Team 2 only, either, or unavailable. No response means unknown, not available. A leader can record availability on a member's behalf with attribution.
3. Leader requests suggestions. The app produces up to 20 unique players per team, eligible reserves, and a short selection explanation for every candidate.
4. Leader reviews, locks required mechanical players, swaps, or moves members to reserves. Regeneration preserves locks. Show how overrides change who waits and each team's total arena power.
5. Leader publishes a versioned lineup. Members can view their assignment and confirm it. Changes after publishing create a new revision; avoid silently changing an already published roster.
6. After play, leader marks actual attendance: played, no-show, withdrew, unused reserve, or unknown. Default unknown. Bulk marking requires explicit review. Replacements are recorded, including who actually played.
7. Leader finalizes attendance. History and next-event rotation priorities update automatically from finalized records. Corrections remain possible with an audit trail and recalculation.

## Fair rotation: proposed MVP defaults
These rules are recommendations for implementation, not previously agreed alliance policy.

Eligibility: active member, explicit availability for that team's time, not already assigned to the other team that week. No minimum arena power requirement. Proposed default is one Canyon team per member per week. Lack of availability does not accumulate waiting credit.

Use a rolling eight-finalized-event window, excluding events before the member's tracking start. Keep lifetime totals for reference. Unknown attendance is excluded from scoring and displayed as incomplete data. No historical Canyon participation is imported from the GW sheet.

For each currently eligible candidate derive:
- played_count: finalized Canyon events actually played in the window, counted once per event.
- eligible_benches: events where the member was explicitly available, was not offered a final starting slot, and did not play. Do not award this credit for a no-show or withdrawal.
- last_played_at: most recent finalized played record, null for never recorded.

Rank candidates lexicographically: lowest played_count, then highest eligible_benches, then longest time since last played (never recorded first), then a persisted seeded lottery for exact ties. Store the seed and algorithm version; repeated generation with unchanged inputs must not reroll ties. New members begin with zero recorded plays and zero bench credits from their tracking start. Show that history is incomplete when applicable. Do not silently penalize no-shows in MVP; show a separate reliability note for leader judgment.

Assignment must consider both time slots jointly. Use a capacity-constrained bipartite matching/min-cost flow or an equivalent well-tested algorithm, including pinned slots first. Maximize feasible filled slots, then select the fairest feasible candidate set by rank; power balancing is only a final preference among otherwise equivalent feasible assignments. Do not greedily consume flexible players and strand time-specific players. Preserve team availability and unique membership throughout.

Power totals are sums of arena_power_m. Suggested optional balancing only changes which team a selected flexible player joins, not who receives an opportunity. Never turn Team 1 into a permanent strongest-player tier. Display per-team power and selection rationale without promising game outcomes.

Locks override fairness priority, with a required short reason such as “shot caller” or “strong objective play.” Record actor, timestamp, affected member, previous assignment, and resulting assignment. Mechanical notes are leader-only. Locks do not bypass capacity, uniqueness, or explicit availability. If a locked member becomes unavailable, block generation/publishing until the leader resolves it. No automatic permanent reserved core is proposed.

If fewer than 40 eligible candidates exist, show open slots rather than unavailable placeholders. If one time is oversubscribed and the other has openings, explain the time constraint. Exact equality cannot be guaranteed with differing availability, new joins, no-shows, or leader overrides.

## Attendance and automatic tracking boundary
The app automatically saves selection history, computes actual-play totals from confirmed attendance, and carries those totals into future suggestions. It cannot observe in-game participation without a separately verified data source. Member check-in is not proof of play. MVP uses leader-confirmed attendance. A later screenshot/import flow must require review before finalization.

Finalization is idempotent: derive counts from unique records, never blindly increment counters. Selected-but-no-show is not played. Unused reserves are not played. A reserve who substitutes and plays is played. Canceled events do not affect fairness. Do not impose a limit of 20 historical attendance records per team if substitutions mean more individuals actually played; the 20-player limit applies to the active lineup.

## Data model and invariants
| Entity | Essential fields |
| --- | --- |
| Member | id, username, aliases, rank, origin_alliance, level, arena_power_m, power_as_of, active, tracking_start, private mechanical_notes |
| Account membership | account_id, member_id, app_role (leader/member), verified mapping |
| CanyonEvent | id, date, timezone, status, algorithm_version, selection_seed, revision |
| Team | id, event_id, name, starts_at, capacity=20 |
| Availability | event_id, member_id, allowed_team_ids, status, recorded_by, updated_at |
| Assignment | event_id, team_id, member_id, starter/reserve, locked, reason, revision |
| Attendance | event_id, member_id, team_id, outcome, confirmed_by, confirmed_at |
| Audit entry | event_id, actor_id, action, before, after, reason, timestamp |

Seed IDs stry-001 through stry-100 are initialization identifiers based on source order, not real game IDs. Persist them permanently; never regenerate IDs from a future power rank. Preserve exact Unicode names. On reimport, map existing IDs/aliases and request review of ambiguous matches. Update power with its source date, not attendance. Retain inactive members in historical records. Origin CAPO/ROYL/STRY is cohort provenance, not a filter excluding members from this alliance.

Server-enforce capacity, one current starter assignment per member per event, one attendance outcome per member per event, role permissions, and revision checks. Publish, swapping, and attendance finalization are atomic. Reject stale leader edits with a reload/compare action. A team change that invalidates availability must request new confirmation.

Members view published rosters and their own participation history, and edit only their own availability/confirmation. Leaders manage drafts, assignments, imports, attendance and private notes. Do not infer app admin privileges solely from a self-entered name or rank. Bootstrap owner separately. Shared production data needs authenticated server persistence; local browser storage is suitable only for an explicitly marked demo.

## Acceptance scenarios
- Import exactly 100 members, preserve names and numeric power; Mario AK47=836.8, Appins=301.3, Nemo Hoes=278.0 million.
- Never exceed 20 current starters per team; never assign a member twice in a weekly event.
- Available-both players can be reassigned to fill 20/20 when a naive first-team greedy pass would underfill the second team.
- With 100 equally available members, no overrides and complete attendance for five weeks, everyone receives two plays under the proposed ranking.
- With identical histories, lower-power players remain eligible; deterministic ties do not change when Generate is tapped twice.
- Unavailable and unknown-response members are excluded; availability constrains every swap and lock.
- Regeneration preserves valid locks; conflicting locks produce actionable errors.
- Publish does not increment actual-play history. Finalizing twice does not double count. Correcting played to no-show recalculates the history.
- GW participation never becomes Canyon attendance. Canceled events do not change fairness.
- A replacement who plays gains one play; an unused reserve gains none.
- New members have unknown pre-import history and start tracking now; renamed/inactive members keep history.
- A missing date or timezone prevents real publication. Times remain 18:00 and 23:00 in the chosen timezone, with correct device-local display.
- A member cannot change another member's availability or leader-only fields by bypassing the UI.
- Two leaders editing the same revision cannot silently overwrite each other.
- At 360px width and large text, no horizontal scrolling, clipped names, inaccessible actions or keyboard-covered forms.

## Build milestones
1. Mobile shell, real member seed data, Friday scheduling, team times, availability UI, editable Responsibilities page, and shared motion components; persistent demo state clearly marked; no fabricated attendance.
2. Pure deterministic rotation engine with fairness/time-capacity tests; suggestion explanations and manual locks/swaps.
3. Publish/revisions, attendance confirmation/finalization, and history; verify next-week rotation end to end.
4. Authenticated shared database, server authorization, concurrency checks, deployment configuration, backup/export, and phone QA before real use.

Choose a familiar maintained TypeScript frontend and relational backend when implementation starts; preserve an existing repository's stack if provided. Keep the selection engine independent of UI and storage. The app does not require an AI API for weekly selection.

## Friday recurrence
Create a weekly Friday series in an explicit event timezone. Friday means Friday in that timezone even if a member's local display falls on another day. The next Friday after the package preparation date September 9, 2026 is September 11, 2026. Store this as a proposed first event date for leader review, not an invented UTC timestamp. Team 1 at 18:00 and Team 2 at 23:00 are confirmed for this week. Offer these as editable future defaults; do not treat those hours as permanent game rules.

Generate next-week drafts idempotently using series_id + event date. Do not copy attendance, availability, or actual-play outcomes from the prior week. Recompute suggestions using history. Weekly locks expire by default; leaders can explicitly add new locks. Allow a single event cancellation/time override without rewriting previous events. Do not carry unpublished drafts forward as confirmed assignments. Preserve local wall-clock hours across daylight-saving changes in the selected named timezone.

Additional acceptance: recurring creation always yields Friday in event timezone, duplicate job runs do not duplicate events, changing one week's time leaves others unchanged, and future events begin with unknown availability and attendance. No external reminder automation is being activated by this handoff.

## Organization and experience requirements
ORGANIZATION.md and MOTION_AND_QOL.md are part of the acceptance contract. Include responsibility/task/slot records and edit audit entries in the shared database. Every screen uses the same accessible motion and save-feedback components. Add Organize to bottom navigation. Source spreadsheet assignment roles do not grant app permissions.
