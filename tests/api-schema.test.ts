import { describe, it, expect } from 'vitest';
import {
  toNum,
  num,
  bool,
  str,
  roundsFromScore,
  mapMatchItem,
  mapPlayer,
} from '../src/lib/api-schema';

describe('toNum', () => {
  it('parses numeric strings', () => {
    expect(toNum('18')).toBe(18);
    expect(toNum('1.25')).toBe(1.25);
  });
  it('falls back on empty / garbage / undefined', () => {
    expect(toNum('')).toBe(0);
    expect(toNum('  ')).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum('abc')).toBe(0);
    expect(toNum(null)).toBe(0);
  });
  it('honors custom fallback', () => {
    expect(toNum('', -1)).toBe(-1);
    expect(toNum(NaN, 7)).toBe(7);
  });
});

describe('num with aliases', () => {
  const obj = { Kills: '20', kills: '99' };
  it('takes the first matching alias', () => {
    expect(num(obj, 'Kills', 'kills')).toBe(20);
  });
  it('falls through to the next alias when first is missing/empty', () => {
    expect(num({ Kills: '' , kills: '5' }, 'Kills', 'kills')).toBe(5);
  });
  it('returns 0 when no alias matches', () => {
    expect(num(obj, 'Deaths', 'deaths')).toBe(0);
  });
  it('never throws on null/undefined object', () => {
    expect(num(undefined, 'Kills')).toBe(0);
    expect(num(null, 'Kills')).toBe(0);
  });
});

describe('bool', () => {
  it('reads FACEIT "1"/"0" result strings', () => {
    expect(bool({ Result: '1' }, 'Result')).toBe(true);
    expect(bool({ Result: '0' }, 'Result')).toBe(false);
  });
  it('handles real booleans and numbers', () => {
    expect(bool({ Win: true }, 'Win')).toBe(true);
    expect(bool({ Win: 1 }, 'Win')).toBe(true);
    expect(bool({ Win: 0 }, 'Win')).toBe(false);
  });
  it('defaults to false when missing', () => {
    expect(bool({}, 'Result')).toBe(false);
    expect(bool(undefined, 'Result')).toBe(false);
  });
});

describe('str', () => {
  it('returns the first present string alias', () => {
    expect(str({ 'Match Id': 'abc' }, 'Match Id', 'MatchId')).toBe('abc');
    expect(str({}, 'Match Id')).toBe('');
  });
});

describe('roundsFromScore', () => {
  it('sums a "13 / 7" style score', () => {
    expect(roundsFromScore('13 / 7')).toBe(20);
    expect(roundsFromScore('16:14')).toBe(30);
    expect(roundsFromScore('9-13')).toBe(22);
  });
  it('returns 0 for unparseable', () => {
    expect(roundsFromScore('')).toBe(0);
    expect(roundsFromScore('n/a')).toBe(0);
  });
});

describe('mapMatchItem', () => {
  it('maps a full stats object and detects multikills', () => {
    const item = {
      stats: {
        Kills: '20',
        Deaths: '14',
        Assists: '5',
        Rounds: '24',
        ADR: '85.3',
        Result: '1',
        'Match Id': 'm1',
        'Double Kills': '3',
        'Triple Kills': '1',
        'Quadro Kills': '0',
        'Penta Kills': '0',
      },
    };
    const { line, hasMultikill } = mapMatchItem(item);
    expect(hasMultikill).toBe(true);
    expect(line.kills).toBe(20);
    expect(line.rounds).toBe(24);
    expect(line.win).toBe(true);
    expect(line.double).toBe(3);
    expect(line.adr).toBeCloseTo(85.3);
  });

  it('derives rounds from Final Score when Rounds is absent', () => {
    const item = { stats: { Kills: '10', Deaths: '12', 'Final Score': '13 / 11', Result: '0' } };
    const { line, hasMultikill } = mapMatchItem(item);
    expect(line.rounds).toBe(24);
    expect(hasMultikill).toBe(false);
    expect(line.double).toBeUndefined();
  });

  it('accepts an unwrapped stats object', () => {
    const { line } = mapMatchItem({ Kills: '7', Rounds: '16', Result: '0' });
    expect(line.kills).toBe(7);
    expect(line.rounds).toBe(16);
  });
});

describe('mapPlayer', () => {
  it('reads elo and skill level from games.cs2', () => {
    const raw = {
      player_id: 'p1',
      nickname: 'foo',
      games: { cs2: { skill_level: 8, faceit_elo: 2100 } },
    };
    const id = mapPlayer(raw);
    expect(id.playerId).toBe('p1');
    expect(id.nickname).toBe('foo');
    expect(id.skillLevel).toBe(8);
    expect(id.elo).toBe(2100);
  });

  it('survives missing games.cs2', () => {
    const id = mapPlayer({ player_id: 'p2', nickname: 'bar' });
    expect(id.skillLevel).toBe(0);
    expect(id.elo).toBe(0);
  });
});
