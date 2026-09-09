/**
 * The alliance mascot: a bear cub the whole alliance feeds by tapping. Feeds
 * accumulate across everyone; the bear evolves through 15 stages. Pure logic
 * shared by the client (optimistic) and the server (authoritative).
 */
import type { MascotState } from '../domain/types';

export interface Stage {
  /** 1-based stage number. */
  n: number;
  name: string;
  /** Cumulative feeds needed to reach this stage. */
  feeds: number;
  blurb: string;
}

export const STAGES: Stage[] = [
  { n: 1, name: 'Newborn Cub', feeds: 0, blurb: 'Tiny, fluffy and hungry. Tap to feed.' },
  { n: 2, name: 'Curious Cub', feeds: 10, blurb: 'Eyes open, sniffing at everything.' },
  { n: 3, name: 'Playful Cub', feeds: 25, blurb: 'Tumbling around the den.' },
  { n: 4, name: 'Young Bear', feeds: 50, blurb: 'Standing on two legs for the first time.' },
  { n: 5, name: 'Scrappy Bear', feeds: 100, blurb: 'Picks fights with logs. Wins some.' },
  { n: 6, name: 'Forager', feeds: 175, blurb: 'Knows every berry bush in the canyon.' },
  { n: 7, name: 'Bruiser', feeds: 275, blurb: 'Broad shoulders, first STRY scarf.' },
  { n: 8, name: 'Guardian', feeds: 400, blurb: 'Watches over the den at night.' },
  { n: 9, name: 'Warden', feeds: 550, blurb: 'Leather straps and a canyon-worn paw.' },
  { n: 10, name: 'Sentinel', feeds: 750, blurb: 'First armor plate, silver on blue.' },
  { n: 11, name: 'Ironhide', feeds: 1000, blurb: 'Plated flanks. Nothing gets past.' },
  { n: 12, name: 'Warbear', feeds: 1300, blurb: 'Pauldrons and a war-paint stripe.' },
  { n: 13, name: 'Champion', feeds: 1650, blurb: 'Crested helmet, celestial blue.' },
  { n: 14, name: 'Alpha', feeds: 2050, blurb: 'Full plate, glowing star sigil.' },
  { n: 15, name: 'STRY Bear', feeds: 2500, blurb: 'The armored legend of the alliance.' },
];

/** Minimum time between two feeds by the same person. */
export const FEED_COOLDOWN_MS = 2000;
/** Feeds one person may give per day (UTC); keeps the bear a shared, weeks-long project. */
export const DAILY_FEED_CAP = 60;

export class MascotError extends Error {
  code: 'cooldown' | 'daily_cap';
  retry_after_ms: number;
  constructor(code: 'cooldown' | 'daily_cap', message: string, retryAfterMs = 0) {
    super(message);
    this.code = code;
    this.retry_after_ms = retryAfterMs;
  }
}

export function initialMascot(nowIso: string): MascotState {
  return { feeds: 0, feeders: {}, last_feed_at: null, last_feeder_name: null, created_at: nowIso, revision: 1 };
}

export function stageFor(feeds: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) if (feeds >= s.feeds) current = s;
  return current;
}

export function nextStage(feeds: number): Stage | null {
  return STAGES.find((s) => s.feeds > feeds) ?? null;
}

/** 0..1 progress from the current stage threshold to the next; 1 at the final stage. */
export function stageProgress(feeds: number): number {
  const cur = stageFor(feeds);
  const next = nextStage(feeds);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (feeds - cur.feeds) / (next.feeds - cur.feeds)));
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function feedsToday(m: MascotState, feederKey: string, nowIso: string): number {
  const f = m.feeders[feederKey];
  if (!f || f.day !== dayOf(nowIso)) return 0;
  return f.day_count;
}

/** Milliseconds until this feeder may feed again (0 = now). */
export function cooldownRemaining(m: MascotState, feederKey: string, nowIso: string): number {
  const f = m.feeders[feederKey];
  if (!f) return 0;
  const elapsed = Date.parse(nowIso) - Date.parse(f.last_at);
  return Math.max(0, FEED_COOLDOWN_MS - elapsed);
}

export interface FeedResult {
  state: MascotState;
  stage: Stage;
  evolved: boolean;
}

/** One feed by one person. Enforces the per-person cooldown and daily cap. */
export function feedMascot(m: MascotState, feederKey: string, feederName: string, nowIso: string): FeedResult {
  const remaining = cooldownRemaining(m, feederKey, nowIso);
  if (remaining > 0) throw new MascotError('cooldown', `Bear is still chewing. Try again in ${Math.ceil(remaining / 1000)}s.`, remaining);
  const today = dayOf(nowIso);
  const prev = m.feeders[feederKey];
  const dayCount = prev && prev.day === today ? prev.day_count : 0;
  if (dayCount >= DAILY_FEED_CAP) throw new MascotError('daily_cap', `You have fed the bear ${DAILY_FEED_CAP} times today. Come back tomorrow!`);
  const before = stageFor(m.feeds);
  const feeds = m.feeds + 1;
  const stage = stageFor(feeds);
  const feeders = {
    ...m.feeders,
    [feederKey]: { name: feederName, count: (prev?.count ?? 0) + 1, last_at: nowIso, day: today, day_count: dayCount + 1 },
  };
  return {
    state: { ...m, feeds, feeders, last_feed_at: nowIso, last_feeder_name: feederName, revision: m.revision + 1 },
    stage,
    evolved: stage.n !== before.n,
  };
}

/** Top feeders of all time. */
export function topFeeders(m: MascotState, limit = 10): { key: string; name: string; count: number }[] {
  return Object.entries(m.feeders)
    .map(([key, f]) => ({ key, name: f.name, count: f.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
