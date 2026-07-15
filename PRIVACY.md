# Privacy Policy — Heatcheck

_Last updated: 2026-07-16_

Heatcheck ("the extension") is a browser extension that shows extended CS2
statistics inside the FACEIT match room. This policy explains what the
extension does and does not do with your data.

## Short version

**Heatcheck does not collect, store, sell, or transmit any personal data to
the developer or to any third party. There are no trackers and no analytics.**

## What data the extension handles

- **Your FACEIT Data API key.** You enter it yourself on the options page. It
  is stored only in your browser's local storage (`storage.local`) on your own
  device. It is never sent to the developer. It is sent **only** to FACEIT's
  official API endpoint (`https://open.faceit.com`) as an `Authorization`
  header, to fetch public statistics.
- **Cached API responses.** Public player/match statistics returned by FACEIT
  are cached locally in your browser to respect rate limits. This cache lives
  only on your device and can be cleared any time from the extension popup
  (API & Cache → Clear cache).
- **Your settings** (language, toggles, thresholds, optional nickname) are
  stored locally in `storage.local`.

## What the extension does NOT do

- It does not send your data anywhere except directly from your browser to
  `https://open.faceit.com` (FACEIT's official API).
- It does not use analytics, telemetry, advertising, fingerprinting, or any
  third-party trackers.
- It does not read your browsing history, credentials, or data on sites other
  than `www.faceit.com` (where it displays badges) and it only calls
  `open.faceit.com` for data.

## Permissions and why they are needed

- `storage` — to save your settings, API key, and local cache on your device.
- host access to `https://open.faceit.com/*` — to fetch public CS2 statistics
  from FACEIT's official Data API.
- content script on `https://www.faceit.com/*` — to display stats next to
  players in the match room.

## Data retention

All data stays on your device. Uninstalling the extension, or using
"Clear cache" / your browser's "Clear data", removes it.

## Third parties

The only external service contacted is **FACEIT** (`open.faceit.com`), and only
with your own API key, to retrieve public statistics. FACEIT's handling of that
request is governed by FACEIT's own privacy policy.

## Contact

Questions about this policy: **angelokkus@gmail.com**
