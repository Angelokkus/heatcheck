// Background service worker (Chromium) / background script (Firefox).
// Owns all network + cache access. The content script never touches the API.
import browser from 'webextension-polyfill';
import { loadSettings } from '../lib/config';
import {
  getPlayerByNickname,
  getMatchHistory,
  getPlayerHistory,
  getPlayerStats,
  ApiError,
} from '../lib/api-client';
import {
  mapPlayer,
  mapMatchItem,
  mapSegments,
  lifetimeMatches,
  type PlayerIdentity,
  type MapSegment,
} from '../lib/api-schema';
import { cacheGet, cacheSet, cacheClear } from '../lib/cache';
import { buildCard } from '../lib/aggregate';
import type {
  BgRequest,
  Encounters,
  GetPlayersResponse,
  MatchLine,
  PlayerCard,
  PlayerStatus,
  Settings,
  ValidateKeyResponse,
} from '../lib/types';

const CONCURRENCY = 4; // batch size to stay friendly with rate limits
const ENCOUNTER_LIMIT = 50; // how many of the current user's matches to scan

interface CachedMatches {
  lines: MatchLine[];
  hasMultikill: boolean;
}

function errStatus(e: unknown): PlayerStatus {
  if (e instanceof ApiError) {
    if (e.kind === 'no-key') return 'no-key';
    if (e.kind === 'unauthorized') return 'no-key';
    if (e.kind === 'rate-limited') return 'rate-limited';
    if (e.kind === 'not-found') return 'not-found';
  }
  return 'error';
}

function stubCard(nickname: string, status: PlayerStatus): PlayerCard {
  return {
    nickname,
    playerId: '',
    skillLevel: 0,
    elo: 0,
    form: null,
    winrate: 0,
    avgKD: 0,
    avgKR: 0,
    avgKills: 0,
    avgDeaths: 0,
    avgAssists: 0,
    hltvRating: 0,
    avgADR: 0,
    matches: 0,
    hasMultikillData: false,
    status,
  };
}

async function resolveIdentity(
  nickname: string,
  settings: Settings,
  ttlMs: number
): Promise<PlayerIdentity> {
  const key = `id:${nickname.toLowerCase()}`;
  const cached = await cacheGet<PlayerIdentity>(key);
  if (cached) return cached;

  const raw = await getPlayerByNickname(nickname, settings.apiKey);
  const identity = mapPlayer(raw);
  if (!identity.playerId) throw new ApiError('not-found', 'no player_id in response');
  await cacheSet(key, identity, ttlMs);
  return identity;
}

async function resolveMatches(
  identity: PlayerIdentity,
  settings: Settings,
  ttlMs: number
): Promise<CachedMatches> {
  const key = `matches:${identity.playerId}`;
  const cached = await cacheGet<CachedMatches>(key);
  if (cached) return cached;

  const limit = Math.max(1, settings.form.matchWindow);
  const data = await getMatchHistory(identity.playerId, settings.apiKey, limit);
  const items = Array.isArray(data.items) ? data.items : [];

  const lines: MatchLine[] = [];
  let hasMultikill = false;
  for (const item of items) {
    const { line, hasMultikill: hm } = mapMatchItem(item);
    if (hm) hasMultikill = true;
    lines.push(line);
  }
  const result: CachedMatches = { lines, hasMultikill };
  await cacheSet(key, result, ttlMs);
  return result;
}

interface PlayerStats {
  total: number; // lifetime matches
  segments: Record<string, MapSegment>; // per-map, keyed by lowercase label
}

/** Lifetime totals + per-map segments from /players/{id}/stats/cs2. */
async function resolvePlayerStats(
  identity: PlayerIdentity,
  settings: Settings,
  ttlMs: number
): Promise<PlayerStats> {
  const key = `mstats:${identity.playerId}`;
  const cached = await cacheGet<PlayerStats>(key);
  if (cached) return cached;
  try {
    const raw = await getPlayerStats(identity.playerId, settings.apiKey);
    const result: PlayerStats = { total: lifetimeMatches(raw), segments: mapSegments(raw) };
    await cacheSet(key, result, ttlMs);
    return result;
  } catch {
    return { total: 0, segments: {} };
  }
}

async function resolveCard(
  nickname: string,
  settings: Settings,
  currentMap?: string
): Promise<PlayerCard> {
  const ttlMs = Math.max(0, settings.cacheTtlMinutes) * 60_000;
  try {
    if (!settings.apiKey) return stubCard(nickname, 'no-key');
    const identity = await resolveIdentity(nickname, settings, ttlMs);
    const { lines, hasMultikill } = await resolveMatches(identity, settings, ttlMs);
    const card = buildCard({
      identity,
      matches: lines,
      hasMultikillData: hasMultikill,
      form: settings.form,
    });
    const stats = await resolvePlayerStats(identity, settings, ttlMs);
    card.totalMatches = stats.total;
    if (currentMap) card.mapStat = stats.segments[currentMap.toLowerCase()] ?? null;
    return card;
  } catch (e) {
    return stubCard(nickname, errStatus(e));
  }
}

/**
 * Build an encounters map (playerId → {with, vs, matches}) from the current
 * user's recent history. One cached API call covers the whole roster.
 */
async function buildEncounters(
  selfId: string,
  settings: Settings,
  ttlMs: number
): Promise<Map<string, Encounters>> {
  const key = `history:${selfId}:${ENCOUNTER_LIMIT}`;
  let items = await cacheGet<Array<Record<string, any>>>(key);
  if (!items) {
    const data = await getPlayerHistory(selfId, settings.apiKey, ENCOUNTER_LIMIT);
    items = Array.isArray(data.items) ? (data.items as Array<Record<string, any>>) : [];
    await cacheSet(key, items, ttlMs);
  }

  const map = new Map<string, Encounters>();
  const add = (
    pid: string,
    side: 'with' | 'vs',
    win: boolean,
    matchId: string,
    date: number
  ) => {
    if (!pid) return;
    let e = map.get(pid);
    if (!e) {
      e = { withCount: 0, vsCount: 0, entries: [] };
      map.set(pid, e);
    }
    if (side === 'with') e.withCount++;
    else e.vsCount++;
    e.entries.push({ matchId, date, side, win });
  };

  for (const it of items) {
    const f1: Array<Record<string, any>> = it?.teams?.faction1?.players ?? [];
    const f2: Array<Record<string, any>> = it?.teams?.faction2?.players ?? [];
    const inF1 = f1.some(p => p?.player_id === selfId);
    const inF2 = f2.some(p => p?.player_id === selfId);
    if (!inF1 && !inF2) continue;

    const mine = inF1 ? f1 : f2;
    const others = inF1 ? f2 : f1;
    const myFaction = inF1 ? 'faction1' : 'faction2';
    const win = it?.results?.winner === myFaction;
    const date = Number(it?.finished_at ?? it?.started_at ?? 0) || 0;
    const matchId = String(it?.match_id ?? '');

    for (const p of mine) {
      if (p?.player_id !== selfId) add(p?.player_id, 'with', win, matchId, date);
    }
    for (const p of others) {
      add(p?.player_id, 'vs', win, matchId, date);
    }
  }
  return map;
}

/** Resolve many nicknames with bounded concurrency. */
async function resolveMany(
  nicknames: string[],
  settings: Settings,
  currentMap?: string
): Promise<PlayerCard[]> {
  const unique = Array.from(new Set(nicknames.filter(Boolean)));
  const out = new Map<string, PlayerCard>();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const idx = cursor++;
      const nick = unique[idx];
      out.set(nick, await resolveCard(nick, settings, currentMap));
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker);
  await Promise.all(workers);

  // Preserve the caller's original order (with duplicates collapsed).
  return unique.map(n => out.get(n)!);
}

async function validateKey(apiKey: string): Promise<ValidateKeyResponse> {
  if (!apiKey) return { ok: false, error: 'Пустой ключ' };
  try {
    // Auth is checked before the resource is looked up, so a 404 still
    // proves the key is valid. Only 401/403 means a bad key.
    const raw = await getPlayerByNickname('s1mple', apiKey);
    const id = mapPlayer(raw);
    return { ok: true, nickname: id.nickname || 's1mple' };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.kind === 'unauthorized') return { ok: false, error: 'Неверный ключ (401/403)' };
      if (e.kind === 'not-found') return { ok: true }; // authorized, sample nick just missing
      if (e.kind === 'rate-limited') return { ok: false, error: 'Rate limit — попробуйте позже' };
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}

browser.runtime.onMessage.addListener(async (message: unknown): Promise<unknown> => {
  const msg = message as BgRequest;
  switch (msg?.type) {
    case 'GET_PLAYERS': {
      const settings = await loadSettings();
      try {
        const cards = await resolveMany(msg.nicknames, settings, msg.map);

        // Encounters (optional — never fail the whole response over it).
        const self = (msg.self && msg.self.trim()) || settings.selfNick.trim();
        if (self && settings.apiKey) {
          const ttlMs = Math.max(0, settings.cacheTtlMinutes) * 60_000;
          try {
            const selfId = (await resolveIdentity(self, settings, ttlMs)).playerId;
            const enc = await buildEncounters(selfId, settings, ttlMs);
            for (const c of cards) {
              c.encounters =
                c.playerId && c.playerId !== selfId
                  ? enc.get(c.playerId) ?? { withCount: 0, vsCount: 0, entries: [] }
                  : null; // null = this is the current user
            }
          } catch {
            /* encounters are best-effort */
          }
        }

        return { ok: true, cards } as GetPlayersResponse;
      } catch (e) {
        return { ok: false, cards: [], error: (e as Error).message } as GetPlayersResponse;
      }
    }
    case 'VALIDATE_KEY':
      return validateKey(msg.apiKey);
    case 'CLEAR_CACHE':
      await cacheClear();
      return { ok: true };
    default:
      return { ok: false, error: 'unknown message' };
  }
});
