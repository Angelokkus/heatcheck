// TTL cache backed by storage.local. Keys are namespaced to avoid clobbering
// settings. Entries store {v: value, e: expiryEpochMs}.
import browser from 'webextension-polyfill';

const PREFIX = 'cache:';

interface Entry<T> {
  v: T;
  e: number;
}

function k(key: string): string {
  return PREFIX + key;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const raw = await browser.storage.local.get(k(key));
  const entry = raw?.[k(key)] as Entry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.e) {
    // expired — clean up opportunistically
    await browser.storage.local.remove(k(key));
    return undefined;
  }
  return entry.v;
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const entry: Entry<T> = { v: value, e: Date.now() + ttlMs };
  await browser.storage.local.set({ [k(key)]: entry });
}

/** Remove every cache entry (keeps settings). */
export async function cacheClear(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter(key => key.startsWith(PREFIX));
  if (keys.length) await browser.storage.local.remove(keys);
}
