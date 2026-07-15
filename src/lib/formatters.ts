// Small display helpers. No side effects.
import type { PlayerCard } from './types';
import { formDelta, type FormResult } from './form-level';

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** ISO-3166 alpha-2 → flag emoji (regional indicator letters). */
export function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return '';
  const base = 0x1f1e6;
  const cp = [...cc.toUpperCase()].map(c => base + (c.charCodeAt(0) - 65));
  if (cp.some(n => n < 0x1f1e6 || n > 0x1f1ff)) return '';
  return String.fromCodePoint(...cp);
}

/** epoch seconds → "dd.mm" */
export function shortDate(epochSec: number): string {
  if (!epochSec) return '';
  const d = new Date(epochSec * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function fixed(x: number, digits = 2): string {
  return Number.isFinite(x) ? x.toFixed(digits) : '—';
}

/** Short badge text, e.g. "LVL 7 · Form 9 ▲▲" (with "~" if approximate). */
export function badgeText(card: PlayerCard, showForm = true): string {
  const lvl = card.skillLevel > 0 ? `LVL ${card.skillLevel}` : 'LVL ?';
  if (!showForm || !card.form) return lvl;
  const approx = card.hasMultikillData ? '' : '~';
  const d = formDelta(card.skillLevel, card.form);
  return `${lvl} · Form ${approx}${card.form.level} ${d.icon}`;
}

export function statusLabel(card: PlayerCard): string | null {
  switch (card.status) {
    case 'no-key':
      return 'нет API-ключа';
    case 'not-found':
      return 'игрок не найден';
    case 'rate-limited':
      return 'rate limit';
    case 'error':
      return 'ошибка';
    case 'low-sample':
      return 'мало данных';
    default:
      return null;
  }
}

export function formLine(form: FormResult, hasMultikill: boolean): string {
  const approx = hasMultikill ? '' : ' (~ приблизительно)';
  return `Rating ${fixed(form.rating)} · WR ${pct(form.winrate)} · стабильность ${pct(
    form.stability
  )} · n=${form.sampleSize}${approx}`;
}
