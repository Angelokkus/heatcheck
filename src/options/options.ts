// Options page logic. Loads/saves Settings, validates the API key via the
// background worker, and clears the cache.
import browser from 'webextension-polyfill';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/config';
import type { Settings, ValidateKeyResponse } from '../lib/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const SHOW_KEYS: Array<{ key: keyof Settings['show']; label: string }> = [
  { key: 'formLevel', label: 'Form Level' },
  { key: 'winrate', label: 'Win rate' },
  { key: 'kd', label: 'K/D' },
  { key: 'kr', label: 'K/R' },
  { key: 'hltv', label: 'HLTV rating' },
  { key: 'adr', label: 'ADR' },
  { key: 'matches', label: 'Кол-во матчей' },
  { key: 'party', label: 'Маркер пати' },
];

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

function renderToggles(show: Settings['show']) {
  const box = $('toggles');
  box.innerHTML = '';
  for (const { key, label } of SHOW_KEYS) {
    const wrap = document.createElement('label');
    wrap.className = 'toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = show[key];
    cb.dataset.key = key;
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(label));
    box.appendChild(wrap);
  }
}

function fillForm(s: Settings) {
  $<HTMLInputElement>('apiKey').value = s.apiKey;
  $<HTMLInputElement>('selfNick').value = s.selfNick;
  $<HTMLInputElement>('ttl').value = String(s.cacheTtlMinutes);
  $<HTMLInputElement>('matchWindow').value = String(s.form.matchWindow);
  $<HTMLInputElement>('recencyDecay').value = String(s.form.recencyDecay);
  $<HTMLInputElement>('winrateWeight').value = String(s.form.winrateWeight);
  renderThresholds(s.form.thresholds);
  renderToggles(s.show);
}

function readForm(base: Settings): Settings {
  const thresholds = Array.from(
    document.querySelectorAll<HTMLInputElement>('#thresholds .threshold')
  )
    .sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx))
    .map(i => Number(i.value));

  const show = { ...base.show };
  document.querySelectorAll<HTMLInputElement>('#toggles input[type="checkbox"]').forEach(cb => {
    const key = cb.dataset.key as keyof Settings['show'];
    show[key] = cb.checked;
  });

  return {
    apiKey: $<HTMLInputElement>('apiKey').value.trim(),
    selfNick: $<HTMLInputElement>('selfNick').value.trim(),
    cacheTtlMinutes: clampNum($<HTMLInputElement>('ttl').value, 0, 100000, 60),
    form: {
      matchWindow: clampNum($<HTMLInputElement>('matchWindow').value, 1, 100, 20),
      recencyDecay: clampNum($<HTMLInputElement>('recencyDecay').value, 0, 1, 0.96),
      winrateWeight: clampNum($<HTMLInputElement>('winrateWeight').value, 0, 2, 0.2),
      thresholds: thresholds.length === 9 ? thresholds : base.form.thresholds,
    },
    show,
  };
}

function clampNum(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function setStatus(id: string, msg: string, ok: boolean) {
  const el = $(id);
  el.textContent = msg;
  el.className = `status ${ok ? 'ok' : 'err'}`;
}

async function init() {
  const settings = await loadSettings();
  fillForm(settings);

  $('toggleKey').addEventListener('click', () => {
    const inp = $<HTMLInputElement>('apiKey');
    const btn = $('toggleKey');
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.textContent = 'Скрыть';
    } else {
      inp.type = 'password';
      btn.textContent = 'Показать';
    }
  });

  $('checkKey').addEventListener('click', async () => {
    const key = $<HTMLInputElement>('apiKey').value.trim();
    setStatus('keyStatus', 'Проверка…', true);
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'VALIDATE_KEY',
        apiKey: key,
      })) as ValidateKeyResponse;
      if (res.ok) {
        setStatus('keyStatus', `Ключ рабочий${res.nickname ? ` (проверка: ${res.nickname})` : ''}.`, true);
      } else {
        setStatus('keyStatus', res.error ?? 'Ключ не прошёл проверку', false);
      }
    } catch (e) {
      setStatus('keyStatus', `Ошибка: ${(e as Error).message}`, false);
    }
  });

  $('clearCache').addEventListener('click', async () => {
    await browser.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    setStatus('cacheStatus', 'Кэш очищен.', true);
  });

  $('save').addEventListener('click', async () => {
    const current = await loadSettings();
    const next = readForm(current);
    await saveSettings(next);
    setStatus('saveStatus', 'Сохранено.', true);
  });

  $('reset').addEventListener('click', async () => {
    const keep = $<HTMLInputElement>('apiKey').value.trim();
    const next: Settings = { ...DEFAULT_SETTINGS, apiKey: keep };
    await saveSettings(next);
    fillForm(next);
    setStatus('saveStatus', 'Сброшено к дефолтам (ключ сохранён).', true);
  });
}

init();
