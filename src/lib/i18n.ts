// Tiny i18n. English is the source language; RU is a full translation.
// Popup markup uses data-i18n="key" and is (re)rendered via applyI18n().

export type Lang = 'en' | 'ru';

type Dict = Record<string, string>;

const EN: Dict = {
  // nav
  navGeneral: 'General',
  navApi: 'API & Cache',
  navForm: 'Form Level',
  navDisplay: 'Display',
  navFeatures: 'Signature',
  navAuto: 'Automation',
  navSupport: 'Support',
  navAbout: 'About',
  groupExtension: 'Extension',
  groupFaceit: 'FACEIT',
  groupOther: 'Other',
  // general
  enabled: 'Enabled',
  enabledDesc: 'Enable or disable the extension.',
  language: 'Language',
  languageDesc: 'Interface language.',
  version: 'Version',
  versionDesc: 'Latest installed.',
  // api
  apiKey: 'FACEIT Data API key',
  apiKeyHint: 'Get it at developers.faceit.com → create app → Server-Side key.',
  checkKey: 'Check key',
  showKey: 'Show',
  hideKey: 'Hide',
  selfNick: 'Your FACEIT nickname',
  selfNickHint: 'Usually auto-detected. Set it if the encounters counter is missing.',
  ttl: 'Cache TTL (minutes)',
  ttlHint: 'API responses are cached to respect rate limits.',
  clearCache: 'Clear cache',
  cacheCleared: 'Cache cleared.',
  // form
  formIntro: 'Thresholds are a rough first calibration — tune them freely (see README).',
  matchWindow: 'matchWindow',
  recencyDecay: 'recencyDecay',
  winrateWeight: 'winrateWeight',
  thresholds: 'Level thresholds (9 values, ascending)',
  thresholdsHint: 'Boundaries between levels 1→2, 2→3, … 9→10.',
  // display
  metricsTitle: 'Metrics shown in the lobby',
  mFormLevel: 'Form Level',
  mWinrate: 'Win Rate',
  mKd: 'K/D',
  mKr: 'K/R',
  mHltv: 'HLTV Rating',
  mAdr: 'ADR',
  mMatches: 'Matches',
  mEncounters: 'Encounters (🤝/⚔)',
  mParty: 'Party marker',
  mFlag: 'Country flag',
  mRecent: 'Last 5 (W/L)',
  mMapStats: 'Current map stats',
  // automation
  autoCopyConnect: 'Auto Copy Connect Command',
  autoCopyConnectDesc: 'Copies the server connect command to the clipboard automatically.',
  autoConnect: 'Auto Connect with FACEIT Anti-Cheat',
  autoConnectDesc: 'Automatically connect with FACEIT Anti-Cheat.',
  autoAccept: 'Auto Accept Match',
  autoAcceptDesc: 'Automatically accept a found match.',
  delay: 'Delay',
  delayDesc: 'Delay in seconds before acting.',
  seconds: 'seconds',
  // support
  supportTitle: 'Support',
  supportMailLabel: 'Contact e-mail',
  supportSite: 'Website',
  supportSiteSoon: 'Coming soon',
  supportText: 'Questions, bugs or ideas? Reach out — the website is on the way.',
  // signature
  featTeamOdds: 'Match prediction (Team Odds)',
  featTeamOddsDesc: 'Predicted favorite from each team’s average Form Level & rating.',
  featSmurf: 'Smurf detector',
  featSmurfDesc: 'Flags suspicious accounts: high form/rating with few total matches.',
  // buttons / status
  save: 'Save',
  reset: 'Reset to defaults',
  saved: 'Saved.',
  resetDone: 'Reset to defaults (API key kept).',
  // about
  aboutText:
    'Heatcheck shows extended CS2 stats and an independent Form Level in the FACEIT match room. Official FACEIT Data API only — no trackers.',
  aboutForm:
    'Form Level is a second 1–10 level computed from your last matches — how a player performs right now, not their all-time ELO.',
};

const RU: Dict = {
  navGeneral: 'Основное',
  navApi: 'API и кэш',
  navForm: 'Form Level',
  navDisplay: 'Отображение',
  navFeatures: 'Фишки',
  navAuto: 'Автоматизация',
  navSupport: 'Поддержка',
  navAbout: 'О расширении',
  groupExtension: 'Расширение',
  groupFaceit: 'FACEIT',
  groupOther: 'Прочее',
  enabled: 'Включено',
  enabledDesc: 'Включить или выключить расширение.',
  language: 'Язык',
  languageDesc: 'Язык интерфейса.',
  version: 'Версия',
  versionDesc: 'Установлена последняя.',
  apiKey: 'Ключ FACEIT Data API',
  apiKeyHint: 'Получить: developers.faceit.com → создать app → Server-Side ключ.',
  checkKey: 'Проверить ключ',
  showKey: 'Показать',
  hideKey: 'Скрыть',
  selfNick: 'Твой ник FACEIT',
  selfNickHint: 'Обычно определяется сам. Впиши, если счётчик встреч не появляется.',
  ttl: 'TTL кэша (минуты)',
  ttlHint: 'Ответы API кэшируются, чтобы соблюдать rate limits.',
  clearCache: 'Очистить кэш',
  cacheCleared: 'Кэш очищен.',
  formIntro: 'Пороги — предварительная калибровка, правь свободно (см. README).',
  matchWindow: 'matchWindow',
  recencyDecay: 'recencyDecay',
  winrateWeight: 'winrateWeight',
  thresholds: 'Пороги уровней (9 значений, по возрастанию)',
  thresholdsHint: 'Границы между уровнями 1→2, 2→3, … 9→10.',
  metricsTitle: 'Метрики в лобби',
  mFormLevel: 'Form Level',
  mWinrate: 'Win Rate',
  mKd: 'K/D',
  mKr: 'K/R',
  mHltv: 'HLTV Rating',
  mAdr: 'ADR',
  mMatches: 'Матчи',
  mEncounters: 'Встречи (🤝/⚔)',
  mParty: 'Маркер пати',
  mFlag: 'Флаг страны',
  mRecent: 'Последние 5 (W/L)',
  mMapStats: 'Стата на текущей карте',
  autoCopyConnect: 'Авто-копирование Connect-команды',
  autoCopyConnectDesc: 'Автоматически копирует connect-команду сервера в буфер обмена.',
  autoConnect: 'Авто-подключение через FACEIT Anti-Cheat',
  autoConnectDesc: 'Автоматически подключаться через FACEIT Anti-Cheat.',
  autoAccept: 'Авто-принятие матча',
  autoAcceptDesc: 'Автоматически принимать найденный матч.',
  delay: 'Задержка',
  delayDesc: 'Задержка в секундах перед действием.',
  seconds: 'секунд',
  supportTitle: 'Поддержка',
  supportMailLabel: 'E-mail для связи',
  supportSite: 'Сайт',
  supportSiteSoon: 'Скоро',
  supportText: 'Вопросы, баги или идеи? Пиши — сайт уже в разработке.',
  featTeamOdds: 'Прогноз матча (Team Odds)',
  featTeamOddsDesc: 'Фаворит по среднему Form Level и рейтингу команд.',
  featSmurf: 'Детектор смурфов',
  featSmurfDesc: 'Флажок на подозрительных аккаунтах: высокая форма при малом числе игр.',
  save: 'Сохранить',
  reset: 'Сбросить к дефолтам',
  saved: 'Сохранено.',
  resetDone: 'Сброшено к дефолтам (ключ сохранён).',
  aboutText:
    'Heatcheck показывает расширенную статистику CS2 и независимый Form Level в комнате матча FACEIT. Только официальный FACEIT Data API — без трекеров.',
  aboutForm:
    'Form Level — второй уровень 1–10, посчитанный по последним матчам: как игрок играет сейчас, а не по накопленному ELO.',
};

const DICT: Record<Lang, Dict> = { en: EN, ru: RU };

export function t(lang: Lang, key: string): string {
  return DICT[lang]?.[key] ?? EN[key] ?? key;
}

/** Translate every [data-i18n] / [data-i18n-ph] node under root. */
export function applyI18n(root: ParentNode, lang: Lang): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n!;
    el.textContent = t(lang, key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh!;
    (el as HTMLInputElement).placeholder = t(lang, key);
  });
}
