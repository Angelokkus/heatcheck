// Heatcheck mini-app (browser action popup + options page).
import browser from 'webextension-polyfill';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/config';
import { applyI18n, t, type Lang } from '../lib/i18n';
import type { Settings, ValidateKeyResponse } from '../lib/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let state: Settings;

// ---- navigation ----
function initNav() {
  const items = document.querySelectorAll<HTMLButtonElement>('.nav-item');
  items.forEach(btn => {
    btn.addEventListener('click', () => {
      items.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.dataset.section!;
      document.querySelectorAll<HTMLElement>('[data-panel]').forEach(p => {
        p.hidden = p.dataset.panel !== section;
      });
    });
  });
}

// ---- language ----
function setLang(lang: Lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  applyI18n(document, lang);
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  // Labels that depend on state / input values:
  syncKeyToggleLabel();
  updateDelayLabels();
  $('supportSite').textContent = `${t(lang, 'supportSite')} · ${t(lang, 'supportSiteSoon')}`;
  void saveSettings(state); // language persists immediately
}

function initLang() {
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach(b => {
    b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
  });
}

// ---- form population ----
function renderThresholds(values: number[]) {
  const box = $('thresholds');
  box.innerHTML = '';
  values.forEach((v, i) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.value = String(v);
    input.dataset.idx = String(i);
    input.className = 'threshold';
    box.appendChild(input);
  });
}

function setToggle(key: keyof Settings['show'], val: boolean) {
  const el = document.querySelector<HTMLInputElement>(`input[data-key="${key}"]`);
  if (el) el.checked = val;
}

function fillForm(s: Settings) {
  $<HTMLInputElement>('enabled').checked = s.enabled;
  $<HTMLInputElement>('apiKey').value = s.apiKey;
  $<HTMLInputElement>('selfNick').value = s.selfNick;
  $<HTMLInputElement>('ttl').value = String(s.cacheTtlMinutes);
  $<HTMLInputElement>('matchWindow').value = String(s.form.matchWindow);
  $<HTMLInputElement>('recencyDecay').value = String(s.form.recencyDecay);
  $<HTMLInputElement>('winrateWeight').value = String(s.form.winrateWeight);
  renderThresholds(s.form.thresholds);
  (Object.keys(s.show) as Array<keyof Settings['show']>).forEach(k => setToggle(k, s.show[k]));

  // automation
  document.querySelectorAll<HTMLInputElement>('input[data-auto]').forEach(cb => {
    cb.checked = Boolean(s.auto[cb.dataset.auto as keyof Settings['auto']]);
  });
  $<HTMLInputElement>('connectDelay').value = String(s.auto.connectDelay);
  $<HTMLInputElement>('acceptDelay').value = String(s.auto.acceptDelay);
  updateDelayLabels();
}

function updateDelayLabels() {
  const c = $<HTMLInputElement>('connectDelay').value;
  const a = $<HTMLInputElement>('acceptDelay').value;
  $('connectDelayVal').textContent = `${c} ${t(state.lang, 'seconds')}`;
  $('acceptDelayVal').textContent = `${a} ${t(state.lang, 'seconds')}`;
}

function clampNum(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readForm(base: Settings): Settings {
  const thresholds = Array.from(document.querySelectorAll<HTMLInputElement>('#thresholds .threshold'))
    .sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx))
    .map(i => Number(i.value));

  const show = { ...base.show };
  document.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(cb => {
    show[cb.dataset.key as keyof Settings['show']] = cb.checked;
  });

  const getAuto = (key: string) =>
    document.querySelector<HTMLInputElement>(`input[data-auto="${key}"]`)?.checked ?? false;

  return {
    apiKey: $<HTMLInputElement>('apiKey').value.trim(),
    selfNick: $<HTMLInputElement>('selfNick').value.trim(),
    cacheTtlMinutes: clampNum($<HTMLInputElement>('ttl').value, 0, 100000, 60),
    enabled: $<HTMLInputElement>('enabled').checked,
    lang: state.lang,
    form: {
      matchWindow: clampNum($<HTMLInputElement>('matchWindow').value, 1, 100, 20),
      recencyDecay: clampNum($<HTMLInputElement>('recencyDecay').value, 0, 1, 0.96),
      winrateWeight: clampNum($<HTMLInputElement>('winrateWeight').value, 0, 2, 0.2),
      thresholds: thresholds.length === 9 ? thresholds : base.form.thresholds,
    },
    show,
    auto: {
      copyConnect: getAuto('copyConnect'),
      connect: getAuto('connect'),
      connectDelay: clampNum($<HTMLInputElement>('connectDelay').value, 1, 120, 10),
      accept: getAuto('accept'),
      acceptDelay: clampNum($<HTMLInputElement>('acceptDelay').value, 1, 120, 10),
    },
  };
}

function setStatus(id: string, msg: string, ok: boolean) {
  const el = $(id);
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'err'}`;
}

function syncKeyToggleLabel() {
  const inp = $<HTMLInputElement>('apiKey');
  $('toggleKey').textContent = t(state.lang, inp.type === 'password' ? 'showKey' : 'hideKey');
}

async function init() {
  state = await loadSettings();

  initNav();
  initLang();
  fillForm(state);
  setLang(state.lang);

  // version from manifest
  const manifest = browser.runtime.getManifest();
  $('version').textContent = `v${manifest.version}`;

  // enabled master switch — persist immediately
  $<HTMLInputElement>('enabled').addEventListener('change', () => {
    state.enabled = $<HTMLInputElement>('enabled').checked;
    void saveSettings(state);
  });

  $('connectDelay').addEventListener('input', updateDelayLabels);
  $('acceptDelay').addEventListener('input', updateDelayLabels);

  $('toggleKey').addEventListener('click', () => {
    const inp = $<HTMLInputElement>('apiKey');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    syncKeyToggleLabel();
  });

  $('checkKey').addEventListener('click', async () => {
    const key = $<HTMLInputElement>('apiKey').value.trim();
    setStatus('keyStatus', '…', true);
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'VALIDATE_KEY',
        apiKey: key,
      })) as ValidateKeyResponse;
      if (res.ok) setStatus('keyStatus', `OK${res.nickname ? ` (${res.nickname})` : ''}`, true);
      else setStatus('keyStatus', res.error ?? 'invalid', false);
    } catch (e) {
      setStatus('keyStatus', (e as Error).message, false);
    }
  });

  $('clearCache').addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    setStatus('cacheStatus', t(state.lang, 'cacheCleared'), true);
  });

  $('save').addEventListener('click', async () => {
    state = readForm(state);
    await saveSettings(state);
    setStatus('saveStatus', t(state.lang, 'saved'), true);
  });

  $('reset').addEventListener('click', async () => {
    const keepKey = $<HTMLInputElement>('apiKey').value.trim();
    const keepNick = $<HTMLInputElement>('selfNick').value.trim();
    state = { ...DEFAULT_SETTINGS, apiKey: keepKey, selfNick: keepNick, lang: state.lang };
    fillForm(state);
    await saveSettings(state);
    setStatus('saveStatus', t(state.lang, 'resetDone'), true);
  });
}

init();
