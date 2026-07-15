// Non-destructive badge rendering. The badge is a single .ffl-badge element
// placed after the nickname; it never modifies FACEIT's own markup.
//
// Color scheme (per user request):
//   Form level > ELO level  -> GREEN  (.ffl-up)
//   Form level < ELO level  -> RED    (.ffl-down)
//   equal                   -> neutral (.ffl-eq)
import type { Encounters, PlayerCard, Settings } from '../lib/types';
import { formDelta } from '../lib/form-level';
import { badgeText, statusLabel, pct, fixed, shortDate } from '../lib/formatters';

export const BADGE_CLASS = 'ffl-badge';
export const PANEL_CLASS = 'ffl-panel';
export const MARK_ATTR = 'data-ffl';

/**
 * Smurf heuristic: strong current form/rating on a low total-match account.
 * A distinguishing feature vs Repeek.
 */
export function isSmurf(card: PlayerCard): boolean {
  const total = card.totalMatches ?? 0;
  if (total <= 0 || total >= 250) return false;
  const level = card.form?.level ?? 0;
  return level >= 8 || card.hltvRating >= 1.15;
}

/** Create a badge element for a card. */
export function makeBadge(card: PlayerCard, s: Settings): HTMLElement {
  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;

  const ok = card.status === 'ok' || card.status === 'low-sample';

  if (!ok) badge.classList.add('ffl-err');
  if (card.status === 'low-sample') badge.classList.add('ffl-dim');
  if (!card.hasMultikillData) badge.classList.add('ffl-approx');

  if (ok && card.form && s.show.formLevel) {
    const d = formDelta(card.skillLevel, card.form);
    if (d.delta >= 1) badge.classList.add('ffl-up');
    else if (d.delta <= -1) badge.classList.add('ffl-down');
    else badge.classList.add('ffl-eq');
  }

  const label = document.createElement('span');
  label.className = 'ffl-label';
  label.textContent = ok
    ? badgeText(card, s.show.formLevel)
    : `LVL ? · ${statusLabel(card) ?? 'нет данных'}`;
  badge.appendChild(label);

  if (ok && s.show.smurf && isSmurf(card)) {
    const smurf = document.createElement('span');
    smurf.className = 'ffl-smurf';
    smurf.textContent = '⚠ SMURF?';
    smurf.title = 'Suspicious: strong form on a low-match account';
    badge.appendChild(smurf);
  }

  return badge;
}

/** Detailed stats panel rendered BELOW the player card (Repeek-style row). */
export function makePanel(card: PlayerCard, s: Settings): HTMLElement {
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;

  const ok = card.status === 'ok' || card.status === 'low-sample';
  if (!ok) {
    panel.classList.add('ffl-panel-msg');
    panel.textContent = statusEn(card.status);
    return panel;
  }
  if (card.status === 'low-sample') panel.classList.add('ffl-dim');

  const kda = `${Math.round(card.avgKills)}/${Math.round(card.avgDeaths)}/${Math.round(
    card.avgAssists
  )}`;

  // [value, caption]; toggles from options control optional metrics.
  const cells: Array<[string, string]> = [];
  // Total lifetime matches (fall back to the sample size if unavailable).
  cells.push([String(card.totalMatches || card.matches), 'Matches']);
  if (s.show.winrate) cells.push([pct(card.winrate), 'Win Rate']);
  if (s.show.hltv) cells.push([fixed(card.hltvRating), 'Rating']);
  if (s.show.kd) cells.push([fixed(card.avgKD), 'K/D']);
  cells.push([kda, 'K/D/A']);
  if (s.show.adr) cells.push([fixed(card.avgADR, 0), 'ADR']);
  if (s.show.mapStats && card.mapStat) {
    cells.push([`${pct(card.mapStat.winrate)} · ${fixed(card.mapStat.kd)}`, card.mapStat.map]);
  }

  for (const [val, cap] of cells) {
    const cell = document.createElement('div');
    cell.className = 'ffl-cell';
    const v = document.createElement('span');
    v.className = 'ffl-val';
    v.textContent = val;
    const c = document.createElement('span');
    c.className = 'ffl-cap';
    c.textContent = cap;
    cell.appendChild(v);
    cell.appendChild(c);
    panel.appendChild(cell);
  }

  // Last-5 W/L strip.
  if (s.show.recent && card.recentForm && card.recentForm.length) {
    panel.appendChild(recentCell(card.recentForm));
  }

  // Encounters cell (🤝 with / ⚔ vs) — only when computed (not for self).
  if (s.show.encounters && card.encounters) {
    panel.appendChild(encounterCell(card.encounters));
  }

  if (!card.hasMultikillData) {
    const note = document.createElement('div');
    note.className = 'ffl-cell ffl-note';
    note.textContent = '~ approx. form';
    panel.appendChild(note);
  }

  return panel;
}

function recentCell(results: boolean[]): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'ffl-cell';
  const v = document.createElement('span');
  v.className = 'ffl-val ffl-recent';
  results.forEach(w => {
    const s = document.createElement('span');
    s.className = w ? 'ffl-w' : 'ffl-l';
    s.textContent = w ? 'W' : 'L';
    v.appendChild(s);
  });
  const c = document.createElement('span');
  c.className = 'ffl-cap';
  c.textContent = 'Last 5';
  cell.appendChild(v);
  cell.appendChild(c);
  return cell;
}

function encounterCell(enc: Encounters): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'ffl-cell ffl-enc';

  const v = document.createElement('span');
  v.className = 'ffl-val';
  // Handshake emoji desaturated (see .ffl-enc-emoji) so it doesn't stand out.
  v.innerHTML = `<span class="ffl-enc-emoji">🤝</span>${enc.withCount} ⚔${enc.vsCount}`;

  const c = document.createElement('span');
  c.className = 'ffl-cap';
  c.textContent = 'MET';

  cell.appendChild(v);
  cell.appendChild(c);

  if (enc.entries.length) {
    cell.classList.add('ffl-enc-has');
    cell.addEventListener('mouseenter', () => showEncTip(cell, enc));
    cell.addEventListener('mouseleave', hideEncTip);
  } else {
    cell.classList.add('ffl-enc-zero'); // never met → dimmed
  }
  return cell;
}

// ---- floating encounters tooltip (appended to <body> so nothing clips it) ----

let encTip: HTMLDivElement | null = null;

function ensureEncTip(): HTMLDivElement {
  if (!encTip) {
    encTip = document.createElement('div');
    encTip.className = 'ffl-enc-tip';
    encTip.addEventListener('mouseenter', () => (encTip!.style.display = 'block'));
    encTip.addEventListener('mouseleave', hideEncTip);
    document.body.appendChild(encTip);
  }
  return encTip;
}

function showEncTip(anchor: HTMLElement, enc: Encounters): void {
  const tip = ensureEncTip();
  const rows = enc.entries
    .slice(0, 15)
    .map(e => {
      const sideCls = e.side === 'with' ? 'ffl-enc-with' : 'ffl-enc-vs';
      const sideTxt = e.side === 'with' ? '🤝 with' : '⚔ vs';
      const res = e.win ? '<span class="ffl-enc-w">W</span>' : '<span class="ffl-enc-l">L</span>';
      return `<div class="ffl-enc-row"><span>${shortDate(e.date)}</span><span class="${sideCls}">${sideTxt}</span>${res}</div>`;
    })
    .join('');
  tip.innerHTML =
    `<div class="ffl-enc-head">Encounters — 🤝 ${enc.withCount} · ⚔ ${enc.vsCount}</div>` + rows;

  tip.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  // Position below the cell; nudge left if it would overflow the viewport.
  const width = 190;
  let left = r.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${r.bottom + 6}px`;
}

function hideEncTip(): void {
  // Small delay lets the pointer move onto the tooltip without it vanishing.
  window.setTimeout(() => {
    if (encTip && !encTip.matches(':hover')) encTip.style.display = 'none';
  }, 80);
}

/** English status text for the panel message row. */
function statusEn(status: PlayerCard['status']): string {
  switch (status) {
    case 'no-key':
      return 'no API key';
    case 'not-found':
      return 'player not found';
    case 'rate-limited':
      return 'rate limited';
    case 'error':
      return 'error';
    default:
      return 'no data';
  }
}
