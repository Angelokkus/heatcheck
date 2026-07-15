// Pure aggregation: turn a player identity + match lines into a PlayerCard.
// No I/O here so it can be unit-tested and reused.
import type { MatchLine, PlayerCard, PlayerStatus } from './types';
import { computeFormLevel, type FormConfig, type MatchStats } from './form-level';
import type { PlayerIdentity } from './api-schema';

function toMatchStats(m: MatchLine): MatchStats {
  return {
    rounds: m.rounds,
    kills: m.kills,
    deaths: m.deaths,
    win: m.win,
    double: m.double,
    triple: m.triple,
    quadro: m.quadro,
    penta: m.penta,
  };
}

export interface BuildCardInput {
  identity: PlayerIdentity;
  matches: MatchLine[]; // newest first
  hasMultikillData: boolean;
  form: FormConfig;
}

export function buildCard(input: BuildCardInput): PlayerCard {
  const { identity, matches, hasMultikillData, form } = input;
  const window = matches.slice(0, form.matchWindow).filter(m => m.rounds > 0);

  const formResult = computeFormLevel(matches.map(toMatchStats), form);

  const n = window.length;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let rounds = 0;
  let wins = 0;
  let adrSum = 0;
  let ratingSum = 0;

  for (const m of window) {
    kills += m.kills;
    deaths += m.deaths;
    assists += m.assists;
    rounds += m.rounds;
    if (m.win) wins += 1;
    adrSum += m.adr;
  }
  // average per-match HLTV rating comes straight from the form module for
  // consistency (formResult.rating is round-weighted; here we expose the
  // simpler per-match mean via formResult when available).
  ratingSum = formResult ? formResult.rating : 0;

  const avgKD = deaths > 0 ? kills / deaths : kills;
  const avgKR = rounds > 0 ? kills / rounds : 0;
  const avgADR = n > 0 ? adrSum / n : 0;
  const winrate = n > 0 ? wins / n : 0;

  const status: PlayerStatus = n === 0 ? 'not-found' : n < 10 ? 'low-sample' : 'ok';

  return {
    nickname: identity.nickname,
    playerId: identity.playerId,
    skillLevel: identity.skillLevel,
    elo: identity.elo,
    country: identity.country,
    form: formResult,
    winrate,
    avgKD: +avgKD.toFixed(2),
    avgKR: +avgKR.toFixed(2),
    avgKills: n > 0 ? kills / n : 0,
    avgDeaths: n > 0 ? deaths / n : 0,
    avgAssists: n > 0 ? assists / n : 0,
    hltvRating: +ratingSum.toFixed(2),
    avgADR: +avgADR.toFixed(1),
    matches: n,
    recentForm: matches.slice(0, 5).map(m => m.win),
    hasMultikillData,
    status,
  };
}
