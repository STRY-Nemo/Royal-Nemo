# App-wide motion and quality of life

## Experience direction
Make STRY feel like a polished celestial command app: responsive, rewarding and easy to understand. Motion should explain changes and celebrate completed actions. Apply it to Home, Canyon, Organize, Members, history, settings, dialogs and navigation using shared components. Do not change selection randomness, fairness, attendance or permissions for visual effect.

## Motion system
| Interaction | Required behavior | Target duration |
| --- | --- | --- |
| Button/chip press | Small scale-down and blue highlight, immediate feedback | 80–120ms |
| Screen/tab change | Short fade/slide, preserve scroll and focus | 160–220ms |
| Bottom sheet | Smooth spring-like rise, dim backdrop, swipe dismissal where safe | 220–300ms |
| Assignment/move | Card glides to its new position; affected counters update together | 180–280ms |
| Drag | Lift/shadow, glowing valid drop zones, clear invalid state and snap-back | Direct tracking; settle 180ms |
| Swap | Preview both names and roles, animate exchange after confirmation | 200–300ms |
| Generate suggestions | Brief orbital/star progress mark while computing, stagger result entry | 25ms row stagger, max 400ms total |
| Lock a player | Small lock snap and one blue outline pulse | 160–220ms |
| Successful save | Subtle checkmark and Saved text announced accessibly | 150–200ms |
| Publish lineup | Brief blue/silver star burst, then stable Published status | 500–700ms, once per successful revision |
| Attendance finalized | Checkmark and history totals transition to confirmed values | 200–300ms |
| Loading lists | Static skeleton or restrained shimmer, replaced without layout jump | Only while actually loading |

Do not block interaction to finish an animation or add artificial calculation delays. Show actual failures, not a success celebration before the server commits. Keep star bursts sparse and away from reading areas; no continuous particle backgrounds, flashing, sound by default or roulette-style player selection. Animate opacity/transform where possible; avoid expensive full-screen effects. Pause decorative work off-screen/backgrounded. Reuse a single motion-token layer and components, rather than inconsistent effects on individual pages.

## Accessibility and settings
Respect prefers-reduced-motion and expose Full / Reduced / Off animation settings, with system preference as default. Reduced mode replaces movement with short fades; Off changes state immediately. All variants retain status text, focus behavior, live announcements and operation feedback. Haptics can be optional when supported, with graceful no-op elsewhere; never require vibration or device APIs. Target smooth interactions on ordinary iOS and Android phones, not only a desktop emulator.

## Quality of life across the app
- Searchable member pickers that tolerate case/diacritics while displaying exact names. Recently used picks and leadership choices appear first without hiding other members.
- Preserve search, filters, tabs, scroll and drafts when navigating back. Make dirty forms clear and prevent accidental loss.
- Immediate local interaction feedback with visible Saving / Saved / Failed states. Roll back rejected optimistic changes. Do not equate local/offline storage with server save.
- Undo assignment edits with revision-safe inverse operations. Confirm consequential publish/finalize actions with a concise preview; avoid confirmation for every dropdown tap.
- Sticky primary actions and safe-area spacing; keyboard-aware sheets and search fields. At least 44px interactive targets.
- Expandable details for long names and selection rationale. Text status alongside color. No horizontal spreadsheet scrolling on phones.
- Clear empty states with a useful next action: Set availability, Assign lead, Review attendance, Configure timezone.
- Retry recoverable failures without losing edits. Protect against double taps/double submits with idempotent writes.
- Countdown/event time displays use configured event timezone plus device-local conversion; never silently assume UTC.
- Member detail shows arena power, data freshness, recent participation and current responsibilities together. Private leader notes stay private.
- Share/copy published lineup as text through a user-triggered action; never send messages automatically. Export roster/history/responsibilities for portability.

## Canyon-specific delight
Availability chips visibly select with a short blue pulse. During suggestion review, smoothly transition between teams while retaining each team's scroll. Selecting a player highlights their destination; capacity and power totals update together. A full team shows a calm 20/20 completion indicator. Leader overrides show a lock badge and readable reason. Waitlisted players receive a neutral explanation, not a loss animation. Weekly continuity is communicated through Last played and Waiting since, not streak rewards that encourage the same people to occupy slots every week.

## Verification required during implementation
Use real phone-width interaction tests for dropdown selection, drag across cards with auto-scroll, swapping, undo and keyboard behavior. Verify reduced/off motion states are functionally identical, rapid taps cannot double-submit, and failed saves never display successful publication. Check navigation and all four tabs use shared feedback patterns. Inspect motion on a physical phone when available and report if verification was emulator-only. These are implementation requirements; no animation has been implemented by this specification package alone.
