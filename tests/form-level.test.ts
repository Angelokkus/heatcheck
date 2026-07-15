import { describe, it, expect } from 'vitest';
import {
  matchRating,
  computeFormLevel,
  formDelta,
  DEFAULT_FORM_CONFIG,
  type MatchStats,
} from '../src/lib/form-level';

const base: MatchStats = { rounds: 20, kills: 18, deaths: 15, win: true };

describe('matchRating', () => {
  it('returns 0 for zero or missing rounds', () => {
    expect(matchRating({ rounds: 0, kills: 10, deaths: 5, win: true })).toBe(0);
    expect(matchRating({ rounds: -3, kills: 10, deaths: 5, win: true })).toBe(0);
  });

  it('handles zero deaths without dividing badly', () => {
    const r = matchRating({ rounds: 20, kills: 25, deaths: 0, win: true });
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(1); // strong game
  });

  it('is higher for a better game', () => {
    const weak = matchRating({ rounds: 24, kills: 8, deaths: 20, win: false });
    const strong = matchRating({ rounds: 24, kills: 28, deaths: 10, win: true });
    expect(strong).toBeGreaterThan(weak);
  });

  it('counts frags as singles when multikills are absent (approximation)', () => {
    const noMulti = matchRating({ rounds: 20, kills: 20, deaths: 10, win: true });
    const withMulti = matchRating({
      rounds: 20,
      kills: 20,
      deaths: 10,
      win: true,
      double: 4,
      triple: 2,
      quadro: 1,
      penta: 0,
    });
    // With multikill weighting the rating should be at least as high.
    expect(withMulti).toBeGreaterThan(noMulti);
  });

  it('never lets k1 go negative when multikills exceed kills', () => {
    const r = matchRating({ rounds: 20, kills: 3, deaths: 10, win: false, penta: 1 });
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(0);
  });
});

describe('computeFormLevel', () => {
  it('returns null on empty input', () => {
    expect(computeFormLevel([])).toBeNull();
  });

  it('returns null when every match has 0 rounds', () => {
    expect(computeFormLevel([{ rounds: 0, kills: 5, deaths: 5, win: true }])).toBeNull();
  });

  it('produces a level within 1..10', () => {
    const matches = Array.from({ length: 20 }, () => ({ ...base }));
    const r = computeFormLevel(matches)!;
    expect(r).not.toBeNull();
    expect(r.level).toBeGreaterThanOrEqual(1);
    expect(r.level).toBeLessThanOrEqual(10);
  });

  it('marks confident=false below 10 matches', () => {
    const matches = Array.from({ length: 5 }, () => ({ ...base }));
    const r = computeFormLevel(matches)!;
    expect(r.sampleSize).toBe(5);
    expect(r.confident).toBe(false);
  });

  it('computes winrate correctly', () => {
    const matches: MatchStats[] = [
      { ...base, win: true },
      { ...base, win: true },
      { ...base, win: false },
      { ...base, win: false },
    ];
    const r = computeFormLevel(matches)!;
    expect(r.winrate).toBeCloseTo(0.5, 5);
  });

  it('rewards a strong sample with a higher level than a weak one', () => {
    const strong = Array.from({ length: 20 }, () => ({
      rounds: 22,
      kills: 26,
      deaths: 12,
      win: true,
    }));
    const weak = Array.from({ length: 20 }, () => ({
      rounds: 22,
      kills: 10,
      deaths: 20,
      win: false,
    }));
    const rs = computeFormLevel(strong)!;
    const rw = computeFormLevel(weak)!;
    expect(rs.level).toBeGreaterThan(rw.level);
  });

  it('respects matchWindow', () => {
    const matches = Array.from({ length: 50 }, () => ({ ...base }));
    const r = computeFormLevel(matches, { ...DEFAULT_FORM_CONFIG, matchWindow: 10 })!;
    expect(r.sampleSize).toBe(10);
  });
});

describe('formDelta', () => {
  it('flags a hot player when form outpaces elo level', () => {
    const r = computeFormLevel(Array.from({ length: 20 }, () => ({ ...base })))!;
    const d = formDelta(1, { ...r, level: 8 });
    expect(d.delta).toBe(7);
    expect(d.icon).toBe('▲▲');
  });

  it('flags a cold player', () => {
    const r = computeFormLevel(Array.from({ length: 20 }, () => ({ ...base })))!;
    const d = formDelta(10, { ...r, level: 4 });
    expect(d.delta).toBeLessThan(0);
    expect(d.icon).toBe('▼▼');
  });

  it('is neutral when equal', () => {
    const r = computeFormLevel(Array.from({ length: 20 }, () => ({ ...base })))!;
    const d = formDelta(5, { ...r, level: 5 });
    expect(d.icon).toBe('=');
  });
});
