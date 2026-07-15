// src/lib/form-level.ts

export interface MatchStats {
  rounds: number;
  kills: number;
  deaths: number;
  win: boolean;
  double?: number;
  triple?: number;
  quadro?: number;
  penta?: number;
}

export interface FormConfig {
  matchWindow: number;      // сколько матчей брать
  recencyDecay: number;     // 1.0 = все равны; <1 = свежие важнее
  winrateWeight: number;    // насколько винрейт двигает score
  thresholds: number[];     // 9 границ между 10 уровнями
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  matchWindow: 20,
  recencyDecay: 0.96,
  winrateWeight: 0.20,
  thresholds: [0.70, 0.80, 0.88, 0.95, 1.02, 1.09, 1.16, 1.25, 1.35],
};

/** HLTV 1.0-подобный рейтинг за один матч */
export function matchRating(m: MatchStats): number {
  if (!m.rounds || m.rounds <= 0) return 0;

  const k2 = m.double ?? 0;
  const k3 = m.triple ?? 0;
  const k4 = m.quadro ?? 0;
  const k5 = m.penta ?? 0;
  const k1 = Math.max(0, m.kills - (2 * k2 + 3 * k3 + 4 * k4 + 5 * k5));

  const kpr = m.kills / m.rounds;
  const spr = (m.rounds - m.deaths) / m.rounds;
  const multi = (k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5) / m.rounds;

  const killRating = kpr / 0.679;
  const survRating = spr / 0.317;
  const multiRating = multi / 1.277;

  return (killRating + 0.7 * survRating + multiRating) / 2.7;
}

export interface FormResult {
  level: number;        // 1–10
  score: number;
  rating: number;       // средний рейтинг до поправки на винрейт
  winrate: number;      // 0..1
  sampleSize: number;
  stability: number;    // 0..1, чем выше — тем ровнее играет
  confident: boolean;   // хватает ли выборки
}

/** matches — от самого свежего к старому */
export function computeFormLevel(
  matches: MatchStats[],
  cfg: FormConfig = DEFAULT_FORM_CONFIG
): FormResult | null {
  const slice = matches.slice(0, cfg.matchWindow).filter(m => m.rounds > 0);
  if (slice.length === 0) return null;

  const ratings = slice.map(matchRating);

  let wSum = 0;
  let rSum = 0;
  slice.forEach((m, i) => {
    const w = m.rounds * Math.pow(cfg.recencyDecay, i);
    wSum += w;
    rSum += ratings[i] * w;
  });
  const rating = rSum / wSum;

  const wins = slice.filter(m => m.win).length;
  const winrate = wins / slice.length;

  const score = rating * (1 + cfg.winrateWeight * (winrate - 0.5));

  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((a, r) => a + (r - mean) ** 2, 0) / ratings.length;
  const stability = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 0.35));

  let level = 1;
  for (let i = 0; i < cfg.thresholds.length; i++) {
    if (score >= cfg.thresholds[i]) level = i + 2;
  }

  return {
    level,
    score: +score.toFixed(3),
    rating: +rating.toFixed(3),
    winrate,
    sampleSize: slice.length,
    stability: +stability.toFixed(2),
    confident: slice.length >= 10,
  };
}

/** Расхождение между ELO-уровнем и уровнем формы */
export function formDelta(eloLevel: number, form: FormResult) {
  const d = form.level - eloLevel;
  return {
    delta: d,
    icon: d >= 2 ? '▲▲' : d === 1 ? '▲' : d === 0 ? '=' : d === -1 ? '▼' : '▼▼',
    label:
      d >= 2 ? 'в огне' :
      d === 1 ? 'в форме' :
      d === 0 ? 'по уровню' :
      d === -1 ? 'просел' : 'холодный',
  };
}
