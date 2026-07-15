# Публикация Heatcheck во всех браузерах — пошагово

## 0. Какой магазин какой браузер покрывает

| Браузер | Как публикуется |
|---------|-----------------|
| **Google Chrome** | Chrome Web Store |
| **Yandex Browser** | отдельного магазина нет — Яндекс.Браузер ставит расширения **из Chrome Web Store**, так что публикация в CWS его покрывает |
| **Opera** | Opera Add-ons (можно и из CWS, но правильнее свой магазин) |
| **Mozilla Firefox** | Firefox Add-ons (AMO) |

Итого нужно подать в **три** магазина: **Chrome Web Store**, **Opera Add-ons**,
**Firefox AMO**. Chrome-сборка (`dist/chromium`) идёт в CWS и Opera, Firefox-сборка
(`dist/firefox`) — в AMO.

---

## 1. Готовые пакеты (это я уже собрал)

В папке `store/` лежат готовые к загрузке архивы:

- `store/heatcheck-chrome-v0.1.0.zip` → Chrome Web Store и Opera
- `store/heatcheck-firefox-v0.1.0.zip` → Firefox AMO

Если что-то поменяешь и захочешь пересобрать архивы заново — выполни в PowerShell:

```powershell
cd "C:\Users\angel\Downloads\Claude"
powershell -ExecutionPolicy Bypass -File ".\build.ps1"
node.exe scripts\pack.mjs
```

> Используй именно `scripts\pack.mjs`, а **не** `Compress-Archive`: встроенный
> упаковщик Windows PowerShell 5.1 пишет пути с обратными слэшами, из-за чего
> Chrome Web Store отклоняет архив. `pack.mjs` делает спец-совместимый zip.

---

## 2. Захостить политику конфиденциальности (нужна ссылка для CWS)

Chrome требует **URL** политики конфиденциальности. Файл уже готов:
`store/privacy.html`. Самый простой бесплатный хостинг — GitHub Pages.

1. Заведи аккаунт на https://github.com (бесплатно), если нет.
2. Нажми **New repository** → имя `heatcheck` → **Public** → **Create**.
3. На странице репозитория **Add file → Upload files** → перетащи
   `store/privacy.html` → **Commit changes**.
4. **Settings → Pages** → в «Source» выбери ветку `main`, папку `/ (root)` →
   **Save**.
5. Через 1–2 минуты страница будет доступна по адресу:
   `https://<твой-логин>.github.io/heatcheck/privacy.html`
   — это и есть **Privacy policy URL**. Сохрани его.

> Альтернатива без GitHub: открой Google Docs, вставь текст из `PRIVACY.md`,
> **Файл → Опубликовать в интернете** → скопируй ссылку.

---

## 3. Chrome Web Store (Chrome + Yandex)

**Что нужно:** аккаунт Google, разовый взнос **$5** (карта), 5–15 минут + ревью
(обычно от нескольких часов до пары дней).

1. Открой **https://chrome.google.com/webstore/devconsole** и войди в Google.
2. Первый раз — оплати регистрацию разработчика **$5** (разово, навсегда).
3. **Add new item** → загрузи `store/heatcheck-chrome-v0.1.0.zip`.
4. Заполни карточку (тексты бери из `store/STORE-LISTING.md`):
   - **Description** — «Detailed description (EN)».
   - **Category** — *Sports* (или *Tools*).
   - **Language** — English (можешь добавить Russian отдельной локалью).
   - **Screenshots** — 1280×800 (минимум 1, до 5). Возьми свои скрины комнаты
     матча с бейджами/панелью и попапа, обрежь до 1280×800.
   - **Store icon** — подтянется 128×128 из манифеста.
5. Вкладка **Privacy practices**:
   - **Single purpose**: «Show extended CS2 player statistics inside the FACEIT
     match room.»
   - **Permission justification**:
     - `storage` — «Store user settings, API key and local cache on the user's
       device.»
     - host `open.faceit.com` — «Fetch public CS2 statistics from FACEIT's
       official Data API.»
   - **Data usage**: отметь, что расширение **не собирает и не передаёт**
     пользовательские данные (мы ничего не шлём себе; ключ хранится локально).
   - **Privacy policy URL** — вставь ссылку из шага 2.
6. **Save draft → Submit for review**. После одобрения появится публичная
   ссылка вида `chrome.google.com/webstore/detail/<id>` — её и раздавай.

> **Yandex Browser**: отдельно подавать не нужно. Пользователи Яндекс.Браузера
> открывают твою ссылку из Chrome Web Store и ставят её напрямую.

---

## 4. Opera Add-ons (Opera)

**Что нужно:** аккаунт (бесплатно), ревью модератора.

1. Открой **https://addons.opera.com/developer/** → войди/зарегистрируйся.
2. **Upload extension** → загрузи тот же `store/heatcheck-chrome-v0.1.0.zip`
   (Opera на Chromium, формат тот же).
3. Заполни карточку (тексты из `STORE-LISTING.md`), добавь скриншоты
   **612×408**, укажи ссылку на политику конфиденциальности.
4. Отправь на модерацию. После одобрения — публичная ссылка на addons.opera.com.

---

## 5. Firefox Add-ons — AMO (Firefox)

**Что нужно:** аккаунт Mozilla (бесплатно).

1. Открой **https://addons.mozilla.org/developers/** → войди/зарегистрируйся.
2. **Submit a New Add-on** → **On this site** (публичный листинг).
3. Загрузи `store/heatcheck-firefox-v0.1.0.zip`. AMO проверит манифест
   (у нас уже прописан `browser_specific_settings.gecko.id` — всё ок).
4. Заполни листинг (описание из `STORE-LISTING.md`, категория *Sports & Games*),
   добавь скриншоты.
5. Отправь. AMO подпишет расширение и опубликует (иногда авто-ревью, иногда
   ручное). После этого пользователи ставят его **навсегда** по ссылке с AMO
   (в отличие от временной установки через `about:debugging`).

---

## 6. Что уже сделано мной / что можешь только ты

**Сделал я:**
- Собрал production-архивы `store/heatcheck-chrome-v0.1.0.zip` и `…-firefox-…zip`.
- Привёл манифесты к требованиям (имя, описание ≤132, author, иконки 16/48/128).
- Написал политику конфиденциальности (`PRIVACY.md`, `store/privacy.html`).
- Подготовил тексты карточек EN/RU (`store/STORE-LISTING.md`).

**Только ты (нужен твой вход/данные/оплата):**
- Регистрация аккаунтов в магазинах и оплата $5 в Chrome.
- Загрузка zip через личные кабинеты, заполнение форм.
- Хостинг политики (2–3 клика на GitHub) и скриншоты 1280×800.
- Прохождение модерации и подтверждения по email.

---

## 7. Обновления в будущем

1. Подними версию в **обоих** манифестах (`"version": "0.1.1"`), пересобери и
   переупакуй архивы (команды из раздела 1).
2. В каждом магазине — загрузи новый zip как новую версию, снова короткое ревью.
