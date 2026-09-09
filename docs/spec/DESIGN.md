# Mobile design direction

Use design/STRY_Celestial_Logo.png as the selected brand reference. design/Mobile_Concept.png is a layout reference only. Implement controls as real accessible components, never as a full-screen screenshot.

## Tokens (proposed)
Background #07111F; card #101F33; raised surface #162B45; primary #168CFF; primary text #F4F7FC; secondary text #A9BED9; border #304C70; confirmed #41D58C; pending #FFD166. Validate contrast in implementation, especially blue button text. System sans serif; 16px body and form fields; 24–28px headings; 8px spacing grid; 16px page padding; 12–16px corner radius. Use silver/cyan star branding sparingly. No gold crown theme.

## Screens
1. Canyon overview: date/timezone, draft/published badge, stacked Team 1 18:00 and Team 2 23:00 cards, assigned/20 and total arena power, availability summary, reserves and Generate suggestions.
2. My availability: large choices for 18:00, 23:00, either, unavailable; show full date/timezone and translated local time once configured. Clear save confirmation.
3. Team roster: tabs labeled with team and time. Each scrollable member row has exact username, arena power (e.g. 301.3M), last played or Never recorded, selection reason, and tap action menu. Keep details expandable to avoid cramped rows.
4. Player action sheet: pin with reason, swap, move to reserves, view history. When both teams are full offer an explicit swap flow choosing an eligible counterpart. Preview effect before commit.
5. Suggestion review: selected vs waiting, reasons such as Fewer recent plays or Leader override, incomplete-history flags, team power totals, and publish action.
6. Attendance: team tabs and a checklist of actual outcomes, including substitutes. Default unknown, finalization summary and correction path.
7. Member directory/history: search/sort arena power; per-player recent plays, available-but-benched weeks, last played. Private mechanical notes only for leaders.

Bottom tabs: Home, Canyon, Organize, Members. Put settings in the header/account menu. Organize opens the responsibilities page. Keep first build focused; Home can summarize Canyon. Use at least 44px touch targets, safe-area padding, visible focus, labels alongside status colors, and screen-reader announcements after swaps. No essential hover/drag interaction. Use single-column phone layouts and one roster at a time. Put sticky primary actions above bottom navigation without hiding list rows or keyboard fields. Preserve state when changing tabs.

Empty states: no availability, insufficient eligible players, no historical attendance, unconfigured schedule. Include loading, retry, save conflict, and offline states. Never imply an offline draft was published.
