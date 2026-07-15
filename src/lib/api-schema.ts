// src/lib/api-schema.ts
//
// Defensive mapping between the RAW FACEIT Data API shapes and our internal
// types. FACEIT returns almost every stat as a STRING, field names drift
// between endpoints (case, spaces, presence), and some fields (multikills,
// rounds) may be missing entirely.
//
// ⚠️ The alias lists below are compiled from the documented/observed CS2
//    shapes. They MUST be verified against a live response with
//    `npm run probe` (scripts/probe-api.ts) using a real API key, because
//    FACEIT can and does rename fields. See README → "Схема API".

import type { MatchLine } from './types';

// ---------------------------------------------------------------------------
// Safe primitive getters
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

/** Coerce anything FACEIT throws at us into a finite number, else fallback. */
export function toNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return fallback;
    // FACEIT uses "." as decimal separator; strip thousands separators just in case.
    const n = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * num(obj, ...aliases): return the first alias that resolves to a finite
 * number. Never throws; returns 0 when nothing matches.
 */
export function num(obj: Obj | null | undefined, ...aliases: string[]): number {
  if (!obj) return 0;
  for (const key of aliases) {
    if (key in obj && obj[key] != null && obj[key] !== '') {
      const n = toNum(obj[key], NaN);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/**
 * bool(obj, ...aliases): FACEIT encodes booleans as "1"/"0" strings, or as
 * result fields. Treats "1", 1, "true", true as true; everything else false.
 */
export function bool(obj: Obj | null | undefined, ...aliases: string[]): boolean {
  if (!obj) return false;
  for (const key of aliases) {
    if (key in obj && obj[key] != null && obj[key] !== '') {
      const v = obj[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === '1' || s === 'true' || s === 'win') return true;
        if (s === '0' || s === 'false' || s === 'loss') return false;
      }
    }
  }
  return false;
}

/** First alias present (used for string fields like ids). */
export function str(obj: Obj | null | undefined, ...aliases: string[]): string {
  if (!obj) return '';
  for (const key of aliases) {
    const v = obj?.[key];
    if (typeof v === 'string' && v !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Alias tables ("real API field" → our field). Order = priority.
// ---------------------------------------------------------------------------

export const ALIASES = {
  kills: ['Kills', 'kills'],
  deaths: ['Deaths', 'deaths'],
  assists: ['Assists', 'assists'],
  rounds: ['Rounds', 'rounds'],
  adr: ['ADR', 'Average Damage per Round', 'K/R Ratio ADR'],
  kr: ['K/R Ratio', 'K/R', 'kr'],
  kd: ['K/D Ratio', 'K/D', 'kd'],
  result: ['Result', 'result', 'Win'],
  // "Score" is the full "16 / 14" round score; "Final Score" is a single team
  // number, so it must NOT be preferred for round derivation.
  finalScore: ['Score', 'Final Score', 'final_score'],
  map: ['Map', 'map', 'i1'],
  matchId: ['Match Id', 'MatchId', 'match_id'],
  createdAt: ['Match Finished At', 'Created At', 'created_at', 'updated_at'],
  // Multikills — the fragile ones. May be absent in /games/cs2/stats.
  double: ['Double Kills', 'double_kills', 'DoubleKills'],
  triple: ['Triple Kills', 'triple_kills', 'TripleKills'],
  quadro: ['Quadro Kills', 'quadro_kills', 'QuadroKills'],
  penta: ['Penta Kills', 'penta_kills', 'PentaKills'],
} as const;

// ---------------------------------------------------------------------------
// Rounds fallback: derive from "Final Score" / "Score" like "13 / 7".
// ---------------------------------------------------------------------------

export function roundsFromScore(score: string): number {
  if (!score) return 0;
  const parts = score.split(/[\/:\-]/).map(p => toNum(p, NaN)).filter(Number.isFinite);
  if (parts.length < 2) return 0;
  const total = parts[0] + parts[1];
  return total > 0 ? total : 0;
}

// ---------------------------------------------------------------------------
// Match line mapping
// ---------------------------------------------------------------------------

export interface MatchMapResult {
  line: MatchLine;
  /** true if any multikill alias was actually present in this raw object. */
  hasMultikill: boolean;
}

/**
 * Map one item from GET /players/{id}/games/cs2/stats. The API wraps each
 * match in `{ stats: {...} }`; we accept either the wrapper or the inner
 * stats object.
 */
export function mapMatchItem(item: Obj): MatchMapResult {
  const stats = (item?.stats && typeof item.stats === 'object'
    ? (item.stats as Obj)
    : item) as Obj;

  let rounds = num(stats, ...ALIASES.rounds);
  if (rounds <= 0) {
    rounds = roundsFromScore(str(stats, ...ALIASES.finalScore));
  }

  const hasMultikill =
    ALIASES.double.some(k => k in stats) ||
    ALIASES.triple.some(k => k in stats) ||
    ALIASES.quadro.some(k => k in stats) ||
    ALIASES.penta.some(k => k in stats);

  const line: MatchLine = {
    matchId: str(stats, ...ALIASES.matchId),
    rounds,
    kills: num(stats, ...ALIASES.kills),
    deaths: num(stats, ...ALIASES.deaths),
    assists: num(stats, ...ALIASES.assists),
    adr: num(stats, ...ALIASES.adr),
    win: bool(stats, ...ALIASES.result),
    createdAt: num(stats, ...ALIASES.createdAt),
  };

  if (hasMultikill) {
    line.double = num(stats, ...ALIASES.double);
    line.triple = num(stats, ...ALIASES.triple);
    line.quadro = num(stats, ...ALIASES.quadro);
    line.penta = num(stats, ...ALIASES.penta);
  }

  return { line, hasMultikill };
}

// ---------------------------------------------------------------------------
// Player object mapping (GET /players?nickname= or /players/{id})
// ---------------------------------------------------------------------------

export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  skillLevel: number;
  elo: number;
  country: string; // ISO-3166 alpha-2
}

export interface MapSegment {
  map: string; // display label, e.g. "Mirage"
  winrate: number; // 0..1
  kd: number;
  matches: number;
}

/**
 * Parse GET /players/{id}/stats/cs2 → per-map stats keyed by lowercase label.
 * Only type==="Map" segments are used.
 */
export function mapSegments(raw: Obj): Record<string, MapSegment> {
  const out: Record<string, MapSegment> = {};
  const segments = Array.isArray(raw?.segments) ? (raw.segments as Obj[]) : [];
  for (const seg of segments) {
    if (seg?.type !== 'Map') continue;
    const label = str(seg, 'label');
    if (!label) continue;
    const st = (seg?.stats ?? {}) as Obj;
    out[label.toLowerCase()] = {
      map: label,
      winrate: num(st, 'Win Rate %') / 100,
      kd: num(st, 'Average K/D Ratio', 'K/D Ratio'),
      matches: num(st, 'Matches', 'Total Matches'),
    };
  }
  return out;
}

/** Lifetime total matches from GET /players/{id}/stats/cs2. */
export function lifetimeMatches(raw: Obj): number {
  const lifetime = (raw?.lifetime ?? {}) as Obj;
  return num(lifetime, 'Matches', 'Total Matches');
}

export function mapPlayer(raw: Obj): PlayerIdentity {
  const games = (raw?.games ?? {}) as Obj;
  const cs2 = (games?.cs2 ?? {}) as Obj;
  return {
    playerId: str(raw, 'player_id', 'id'),
    nickname: str(raw, 'nickname'),
    skillLevel: num(cs2, 'skill_level'),
    elo: num(cs2, 'faceit_elo'),
    country: str(raw, 'country').toLowerCase(),
  };
}
