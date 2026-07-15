// Shared types across background, content and options.
import type { FormConfig, FormResult } from './form-level';
import type { Lang } from './i18n';

/** Persisted settings (storage.local). */
export interface Settings {
  apiKey: string;
  cacheTtlMinutes: number;
  /** Current user's nickname for the "encounters" feature. Empty = auto-detect. */
  selfNick: string;
  /** Global on/off switch for the whole extension. */
  enabled: boolean;
  /** UI language of the popup. */
  lang: Lang;
  form: FormConfig;
  /** Which metrics/features to render in the lobby. */
  show: {
    formLevel: boolean;
    winrate: boolean;
    kd: boolean;
    kr: boolean;
    hltv: boolean;
    adr: boolean;
    matches: boolean;
    encounters: boolean;
    party: boolean;
    teamOdds: boolean;
    smurf: boolean;
    flag: boolean;
    recent: boolean;
    mapStats: boolean;
  };
  /** Automation helpers (match room). */
  auto: {
    copyConnect: boolean; // auto-copy the connect command
    connect: boolean; // auto-connect with FACEIT Anti-Cheat
    connectDelay: number; // seconds (1..120)
    accept: boolean; // auto-accept match
    acceptDelay: number; // seconds (1..120)
  };
}

/** Normalized per-match line, extended from the MatchStats the form module needs. */
export interface MatchLine {
  matchId: string;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  win: boolean;
  double?: number;
  triple?: number;
  quadro?: number;
  penta?: number;
  createdAt: number;
}

/** One shared match between the current user and a roster player. */
export interface EncounterEntry {
  matchId: string;
  date: number; // epoch seconds
  side: 'with' | 'vs';
  win: boolean; // current user's result in that match
}

export interface Encounters {
  withCount: number;
  vsCount: number;
  entries: EncounterEntry[]; // newest first
}

/** Per-map aggregate for a player (from the /stats/cs2 segments). */
export interface MapStat {
  map: string;
  winrate: number; // 0..1
  kd: number;
  matches: number;
}

/** Everything the content script needs to render one player. */
export interface PlayerCard {
  nickname: string;
  playerId: string;
  skillLevel: number; // official FACEIT level (from ELO), 1..10, 0 if unknown
  elo: number;
  form: FormResult | null;
  winrate: number; // 0..1 over the sample window
  country?: string; // ISO-3166 alpha-2, e.g. "ru"
  avgKD: number;
  avgKR: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  hltvRating: number; // average matchRating over the sample
  avgADR: number;
  matches: number; // sample size actually used (form/stats window)
  totalMatches?: number; // lifetime CS2 matches played
  recentForm?: boolean[]; // last 5 results (newest first), true = win
  mapStat?: MapStat | null; // stats on the current match map
  hasMultikillData: boolean;
  status: PlayerStatus;
  /** null = this is the current user (self); undefined = not computed. */
  encounters?: Encounters | null;
}

export type PlayerStatus =
  | 'ok'
  | 'low-sample' // < 10 matches
  | 'not-found'
  | 'no-key'
  | 'rate-limited'
  | 'error';

// ---- messaging between content <-> background ----

export interface GetPlayersRequest {
  type: 'GET_PLAYERS';
  nicknames: string[];
  /** Current user's nickname — perspective for the "encounters" feature. */
  self?: string;
  /** Current match map label (e.g. "Mirage") for per-map stats. */
  map?: string;
}

export interface ValidateKeyRequest {
  type: 'VALIDATE_KEY';
  apiKey: string;
}

export interface ClearCacheRequest {
  type: 'CLEAR_CACHE';
}

export type BgRequest = GetPlayersRequest | ValidateKeyRequest | ClearCacheRequest;

export interface GetPlayersResponse {
  ok: boolean;
  cards: PlayerCard[];
  error?: string;
}

export interface ValidateKeyResponse {
  ok: boolean;
  nickname?: string; // a sample identity confirming the key works
  error?: string;
}
