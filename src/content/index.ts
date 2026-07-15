// Content script: watches the FACEIT SPA match room and injects badges next to
// player nicknames.
//
// FACEIT's new CS2 room does NOT render roster nicknames as <a> links — they
// are <div> nodes with a styled-components class like "Nickname__Name-sc-xxxx"
// inside a "ListContentPlayer__Body-sc-xxxx" row. We match on the STABLE
// component-name prefix (class*="…") so hash changes between deploys don't
// break us.
import browser from 'webextension-polyfill';
import { loadSettings } from '../lib/config';
import { makeBadge, makePanel, BADGE_CLASS, PANEL_CLASS, MARK_ATTR } from './render';
import { flagEmoji } from '../lib/formatters';
import type { GetPlayersResponse, PlayerCard, Settings } from '../lib/types';

// Roster nickname nodes. Scoped to the player list so we never pick up the
// current user's profile-menu links or other nicknames on the page.
const ROSTER_NAME_SELECTOR =
  '[class*="ListContentPlayer__Body"] [class*="Nickname__Name"], ' +
  '[class*="ListContentPlayer"] [class*="Nickname__Name"]';

let settings: Settings | null = null;
let scanScheduled = false;
let selfNick: string | undefined; // current user, discovered once from the header
let currentMap: string | undefined; // current match map, discovered from the room

const CS2_MAPS = [
  'Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Dust2',
  'Overpass', 'Train', 'Vertigo', 'Cache', 'Cobblestone', 'Italy', 'Office',
];

/** Detect the current map from the room (a leaf node whose text is a map name). */
function detectCurrentMap(): string | undefined {
  const set = new Set(CS2_MAPS.map(m => m.toLowerCase()));
  const els = document.querySelectorAll<HTMLElement>('span, div, p');
  for (const el of els) {
    if (el.childElementCount > 0) continue;
    const t = (el.textContent || '').trim();
    if (t.length <= 12 && set.has(t.toLowerCase())) return t;
  }
  return undefined;
}

/** After an extension reload, the old content script in an open tab is
 *  orphaned and its APIs throw. Detect that and go dormant. */
function extAlive(): boolean {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
}

function isMatchRoom(): boolean {
  return /\/(room|matchmaking)\//.test(location.pathname) || /\/cs2\/room\//.test(location.href);
}

/**
 * The current (logged-in) user. Roster nicknames are NOT links, so every
 * <a href="/players/..."> on the page belongs to the user's own profile menu.
 * The nickname appearing most often across those anchors is the current user.
 */
function detectSelf(): string | undefined {
  // 1) Profile-menu links in the header (present in the full-page view).
  const counts = new Map<string, number>();
  document.querySelectorAll<HTMLAnchorElement>('a[href*="/players/"]').forEach(a => {
    const m = (a.getAttribute('href') || '').match(/\/players(?:-modal)?\/([^/?#]+)/i);
    if (!m) return;
    const n = decodeURIComponent(m[1]).trim();
    if (n) counts.set(n, (counts.get(n) || 0) + 1);
  });
  let best: string | undefined;
  let bestN = 0;
  counts.forEach((n, k) => {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  });
  if (best) return best;

  // 2) Fallback for the focused room view (no header): the current user's own
  //    roster nickname is drawn in the accent (orange) color.
  const names = document.querySelectorAll<HTMLElement>(ROSTER_NAME_SELECTOR);
  for (const el of names) {
    if (el.childElementCount > 0) continue;
    const m = getComputedStyle(el).color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) continue;
    const r = +m[1];
    const g = +m[2];
    const b = +m[3];
    if (r > 190 && g >= 40 && g <= 150 && b < 100) {
      const n = (el.textContent || '').trim();
      if (n) return n;
    }
  }
  return undefined;
}

/** Find un-processed roster nickname nodes → nickname text. */
function collectTargets(): Map<HTMLElement, string> {
  const map = new Map<HTMLElement, string>();
  const nodes = document.querySelectorAll<HTMLElement>(ROSTER_NAME_SELECTOR);
  nodes.forEach(el => {
    if (el.hasAttribute(MARK_ATTR)) return;
    // Only leaf text nodes carry the nickname; skip wrappers.
    if (el.childElementCount > 0) return;
    const nick = (el.textContent || '').trim();
    if (!nick || nick.length > 64) return;
    map.set(el, nick);
  });
  return map;
}

/** Climb to the top of the contiguous ListContentPlayer ancestor chain
 *  (the whole player card), so the panel sits below the entire row. */
function playerCard(el: HTMLElement): HTMLElement | null {
  let card = el.closest<HTMLElement>('[class*="ListContentPlayer"]');
  while (
    card?.parentElement &&
    /ListContentPlayer/.test(card.parentElement.className || '')
  ) {
    card = card.parentElement;
  }
  return card;
}

function attach(nameEl: HTMLElement, card: PlayerCard, s: Settings) {
  nameEl.setAttribute(MARK_ATTR, '1');

  // 0) country flag left of the nickname.
  if (s.show.flag && card.country) {
    const flag = flagEmoji(card.country);
    if (flag) {
      const el = document.createElement('span');
      el.className = 'ffl-flag';
      el.textContent = flag;
      el.title = card.country.toUpperCase();
      nameEl.insertAdjacentElement('beforebegin', el);
    }
  }

  // 1) colored LVL·Form badge right after the nickname.
  const badge = makeBadge(card, s);
  nameEl.insertAdjacentElement('afterend', badge);

  // 2) detailed stats panel below the whole player card.
  const cardEl = playerCard(nameEl);
  if (cardEl && !cardEl.nextElementSibling?.classList.contains(PANEL_CLASS)) {
    cardEl.insertAdjacentElement('afterend', makePanel(card, s));
  }
}

async function scan() {
  scanScheduled = false;
  if (!extAlive()) return observer.disconnect();
  if (!isMatchRoom()) return;
  if (!settings) settings = await loadSettings();

  // Global master switch.
  if (!settings.enabled) {
    resetBadges();
    return;
  }

  // The header (which tells us who "self" is) can load AFTER the roster. Once
  // we finally learn self, clear any panels already drawn without encounters
  // so they get re-rendered with them.
  if (!selfNick) {
    const detected = detectSelf();
    if (detected) {
      selfNick = detected;
      if (document.querySelector(`.${PANEL_CLASS}`)) resetBadges();
    }
  }

  if (!currentMap) currentMap = detectCurrentMap();

  const targets = collectTargets();
  if (targets.size === 0) return;

  // Mark immediately so rapid mutations don't trigger duplicate requests.
  const byNick = new Map<string, HTMLElement[]>();
  targets.forEach((nick, el) => {
    el.setAttribute(MARK_ATTR, 'pending');
    const arr = byNick.get(nick) ?? [];
    arr.push(el);
    byNick.set(nick, arr);
  });

  const nicknames = Array.from(byNick.keys());

  let res: GetPlayersResponse;
  try {
    res = (await browser.runtime.sendMessage({
      type: 'GET_PLAYERS',
      nicknames,
      self: selfNick,
      map: currentMap,
    })) as GetPlayersResponse;
  } catch (e) {
    byNick.forEach(arr => arr.forEach(el => el.removeAttribute(MARK_ATTR)));
    console.debug('[FFL] background error, will retry', e);
    return;
  }

  if (!res?.ok) {
    byNick.forEach(arr => arr.forEach(el => el.removeAttribute(MARK_ATTR)));
    return;
  }

  const cardByNick = new Map(res.cards.map(c => [c.nickname.toLowerCase(), c]));
  nicknames.forEach((nick, i) => {
    const els = byNick.get(nick) ?? [];
    const card = cardByNick.get(nick.toLowerCase()) ?? res.cards[i] ?? null;
    els.forEach(el => {
      if (card) attach(el, card, settings!);
      else el.removeAttribute(MARK_ATTR);
    });
  });

  renderTeamOdds(cardByNick, byNick, settings);
}

// ---- Team Odds (signature feature): predicted favorite by avg Form score ----

const ODDS_ID = 'ffl-odds';

function commonAncestor(a: HTMLElement, b: HTMLElement): HTMLElement | null {
  const set = new Set<HTMLElement>();
  let x: HTMLElement | null = a;
  while (x) {
    set.add(x);
    x = x.parentElement;
  }
  let y: HTMLElement | null = b;
  while (y) {
    if (set.has(y)) return y;
    y = y.parentElement;
  }
  return null;
}

function renderTeamOdds(
  cardByNick: Map<string, PlayerCard>,
  byNick: Map<string, HTMLElement[]>,
  s: Settings
): void {
  document.getElementById(ODDS_ID)?.remove();
  if (!s.show.teamOdds) return;

  const pts: Array<{ x: number; score: number; el: HTMLElement }> = [];
  byNick.forEach((els, nick) => {
    const card = cardByNick.get(nick.toLowerCase());
    if (!card || !card.form) return;
    const el = els[0];
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    pts.push({ x: r.left, score: card.form.score, el });
  });
  if (pts.length < 4) return;

  // Split the roster into two teams by the largest horizontal gap (two columns).
  pts.sort((a, b) => a.x - b.x);
  let gapIdx = 1;
  let gapMax = -1;
  for (let i = 1; i < pts.length; i++) {
    const g = pts[i].x - pts[i - 1].x;
    if (g > gapMax) {
      gapMax = g;
      gapIdx = i;
    }
  }
  const left = pts.slice(0, gapIdx);
  const right = pts.slice(gapIdx);
  if (left.length < 2 || right.length < 2) return;

  const avg = (arr: typeof pts) => arr.reduce((sum, p) => sum + p.score, 0) / arr.length;
  const a = avg(left);
  const b = avg(right);
  const pa = Math.round((1 / (1 + Math.exp(-6 * (a - b)))) * 100);
  const pb = 100 - pa;
  const favLeft = pa >= pb;

  const common = commonAncestor(left[0].el, right[right.length - 1].el);
  if (!common) return;
  // Climb until the parent stacks vertically, so the bar lands on its own
  // full-width row above the roster (not squished inside a flex-row).
  const anchor = blockAnchor(common);
  if (!anchor.parentElement) return;

  const bar = document.createElement('div');
  bar.id = ODDS_ID;
  bar.className = 'ffl-odds';
  bar.innerHTML =
    `<span class="ffl-odds-cap">ODDS</span>` +
    `<span class="ffl-odds-side ${favLeft ? 'ffl-odds-fav' : ''}">${pa}%</span>` +
    `<span class="ffl-odds-bar"><span class="ffl-odds-fill" style="width:${pa}%"></span></span>` +
    `<span class="ffl-odds-side ${!favLeft ? 'ffl-odds-fav' : ''}">${pb}%</span>`;

  anchor.parentElement.insertBefore(bar, anchor);
}

/** Walk up while the parent is a horizontal flex row, so an inserted sibling
 *  gets its own line rather than becoming a squished flex column. */
function blockAnchor(node: HTMLElement): HTMLElement {
  let cur = node;
  while (cur.parentElement) {
    const cs = getComputedStyle(cur.parentElement);
    const isRow = cs.display.includes('flex') && !cs.flexDirection.startsWith('column');
    if (!isRow) return cur;
    cur = cur.parentElement;
  }
  return cur;
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  // debounce bursty SPA mutations; swallow rejections (e.g. dead context)
  setTimeout(() => void scan().catch(() => {}), 400);
}

function resetBadges() {
  document.querySelectorAll(`.${BADGE_CLASS}, .${PANEL_CLASS}, .ffl-flag`).forEach(el => el.remove());
  document.getElementById(ODDS_ID)?.remove();
  document.querySelectorAll(`[${MARK_ATTR}]`).forEach(el => el.removeAttribute(MARK_ATTR));
}

// --- SPA navigation detection (history API + popstate) ---
let lastPath = location.pathname;
function onNavigate() {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    currentMap = undefined; // new room → re-detect the map
    resetBadges();
    scheduleScan();
  }
}

type HistoryFn = 'pushState' | 'replaceState';
(['pushState', 'replaceState'] as HistoryFn[]).forEach(fn => {
  const orig = history[fn] as (...a: any[]) => any;
  (history as unknown as Record<HistoryFn, (...a: any[]) => any>)[fn] = function (
    this: History,
    ...args: any[]
  ) {
    const r = orig.apply(this, args);
    queueMicrotask(onNavigate);
    return r;
  };
});
window.addEventListener('popstate', onNavigate);

// React to settings changes so toggles apply without a page reload.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    settings = null;
    resetBadges();
    scheduleScan();
  }
});

// ---- Automation (auto-copy connect / auto-accept / auto-connect) ----
//
// ⚠️ Accept/Connect click FACEIT's own action buttons. Matching is EXACT on
// button text to avoid clicking the wrong control (e.g. a cookie "Accept all").
// These need verification on a live ready-check; selectors may be refined.

let lastCopiedConnect = '';
const pendingClicks = new WeakSet<HTMLElement>();
let autoScheduled = false;

function findActionButton(texts: string[]): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>('button, [role="button"]');
  for (const el of els) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (!t || t.length > 24) continue;
    if (texts.includes(t)) return el; // exact match only
  }
  return null;
}

function scheduleClick(el: HTMLElement | null, delaySec: number) {
  if (!el || pendingClicks.has(el)) return;
  pendingClicks.add(el);
  window.setTimeout(() => {
    if (document.body.contains(el)) el.click();
  }, Math.max(0, delaySec) * 1000);
}

async function runAutomation() {
  autoScheduled = false;
  if (!extAlive()) return;
  if (!settings) settings = await loadSettings();
  if (!settings.enabled) return;
  const a = settings.auto;

  if (a.copyConnect) {
    const text = document.body.textContent || '';
    const m = text.match(/connect\s+\d{1,3}(?:\.\d{1,3}){3}:\d+(?:\s*;\s*password\s+\S+)?/i);
    if (m && m[0] !== lastCopiedConnect) {
      lastCopiedConnect = m[0];
      try {
        await navigator.clipboard.writeText(m[0]);
      } catch {
        /* clipboard may be blocked without focus — best-effort */
      }
    }
  }

  if (a.accept) {
    scheduleClick(findActionButton(['accept', 'принять', 'ready', 'готов']), a.acceptDelay);
  }
  if (a.connect) {
    scheduleClick(
      findActionButton([
        'подключиться к серверу',
        'connect to server',
        'connect',
        'подключиться',
      ]),
      a.connectDelay
    );
  }
}

function scheduleAutomation() {
  if (autoScheduled) return;
  autoScheduled = true;
  setTimeout(() => void runAutomation().catch(() => {}), 600);
}

const observer = new MutationObserver(() => {
  scheduleScan();
  scheduleAutomation();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

scheduleScan();
scheduleAutomation();
