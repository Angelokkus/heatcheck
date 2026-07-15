// Default settings + typed storage helpers.
import browser from 'webextension-polyfill';
import { DEFAULT_FORM_CONFIG } from './form-level';
import type { Settings } from './types';

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  cacheTtlMinutes: 60,
  selfNick: '',
  enabled: true,
  lang: 'en',
  form: DEFAULT_FORM_CONFIG,
  show: {
    formLevel: true,
    winrate: true,
    kd: true,
    kr: true,
    hltv: true,
    adr: true,
    matches: true,
    encounters: true,
    party: true,
    teamOdds: true,
    smurf: true,
    flag: true,
    recent: true,
    mapStats: true,
  },
  auto: {
    copyConnect: true,
    connect: false,
    connectDelay: 10,
    accept: false,
    acceptDelay: 10,
  },
};

/** Merge stored settings over defaults so new fields always have a value.
 *  Resilient to an invalidated extension context (returns defaults). */
export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await browser.storage.local.get(SETTINGS_KEY);
    const stored = (raw?.[SETTINGS_KEY] ?? {}) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      form: { ...DEFAULT_SETTINGS.form, ...(stored.form ?? {}) },
      show: { ...DEFAULT_SETTINGS.show, ...(stored.show ?? {}) },
      auto: { ...DEFAULT_SETTINGS.auto, ...(stored.auto ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
