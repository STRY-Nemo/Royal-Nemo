import { describe, expect, it } from 'vitest';
import { DAILY_FEED_CAP, FEED_COOLDOWN_MS, feedMascot, initialMascot, MascotError, nextStage, STAGES, stageFor, stageProgress, topFeeders } from './mascot';

const t0 = Date.parse('2026-09-09T12:00:00Z');
const at = (ms: number) => new Date(t0 + ms).toISOString();

describe('STRY bear', () => {
  it('has 15 stages with rising thresholds from a newborn cub to the STRY Bear', () => {
    expect(STAGES).toHaveLength(15);
    expect(STAGES[0].feeds).toBe(0);
    expect(STAGES[14].name).toBe('STRY Bear');
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].feeds).toBeGreaterThan(STAGES[i - 1].feeds);
    expect(stageFor(0).n).toBe(1);
    expect(stageFor(10).n).toBe(2);
    expect(stageFor(24).n).toBe(2);
    expect(stageFor(2500).n).toBe(15);
    expect(nextStage(2500)).toBeNull();
    expect(stageProgress(5)).toBeCloseTo(0.5);
    expect(stageProgress(9999)).toBe(1);
  });

  it('counts feeds, enforces the per-person cooldown and reports evolutions', () => {
    let m = initialMascot(at(0));
    const r1 = feedMascot(m, 'a', 'Nemo', at(0));
    m = r1.state;
    expect(m.feeds).toBe(1);
    expect(m.revision).toBe(2);
    expect(r1.evolved).toBe(false);
    expect(() => feedMascot(m, 'a', 'Nemo', at(500))).toThrow(MascotError);
    // Someone else can feed during my cooldown.
    m = feedMascot(m, 'b', 'Appins', at(600)).state;
    expect(m.feeds).toBe(2);
    m = feedMascot(m, 'a', 'Nemo', at(FEED_COOLDOWN_MS)).state;
    let t = FEED_COOLDOWN_MS;
    let evolved = false;
    while (m.feeds < 10) {
      t += FEED_COOLDOWN_MS;
      const r = feedMascot(m, 'a', 'Nemo', at(t));
      m = r.state;
      evolved = r.evolved;
    }
    expect(evolved).toBe(true);
    expect(stageFor(m.feeds).name).toBe('Curious Cub');
    expect(m.last_feeder_name).toBe('Nemo');
    expect(topFeeders(m)[0]).toEqual({ key: 'a', name: 'Nemo', count: 9 });
  });

  it('caps feeds per person per day and resets the next day', () => {
    let m = initialMascot(at(0));
    let t = 0;
    for (let i = 0; i < DAILY_FEED_CAP; i++) {
      m = feedMascot(m, 'a', 'Nemo', at(t)).state;
      t += FEED_COOLDOWN_MS;
    }
    expect(() => feedMascot(m, 'a', 'Nemo', at(t))).toThrow(/today/);
    const tomorrow = new Date('2026-09-10T00:00:01Z').toISOString();
    m = feedMascot(m, 'a', 'Nemo', tomorrow).state;
    expect(m.feeders.a.day_count).toBe(1);
    expect(m.feeds).toBe(DAILY_FEED_CAP + 1);
  });
});
