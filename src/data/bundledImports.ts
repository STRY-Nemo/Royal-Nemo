/**
 * Team screen exports shipped with the app (public/imports). The import screen
 * offers the one whose date and team match the open event, so a leader can
 * load it with one tap instead of finding the file on their phone.
 */
export interface BundledImport {
  file: string;
  label: string;
  event_date: string;
  team: 1 | 2;
  captured: string;
}

export const BUNDLED_IMPORTS: BundledImport[] = [
  {
    file: 'STRY_Canyon_Clash_Team1_20260911.xlsx',
    label: 'Team 1 screen for Friday 2026-09-11',
    event_date: '2026-09-11',
    team: 1,
    captured: 'screen recording from 2026-09-09',
  },
  {
    file: 'STRY_Canyon_Clash_Team2_20260911.xlsx',
    label: 'Team 2 screen for Friday 2026-09-11',
    event_date: '2026-09-11',
    team: 2,
    captured: 'screen recording from 2026-09-09',
  },
];
