// Thin client over the official FACEIT Data API (open.faceit.com/data/v4).
// Never hardcodes a key — the caller passes it in. Returns RAW JSON; mapping
// lives in api-schema.ts.

export const API_BASE = 'https://open.faceit.com/data/v4';

export type ApiErrorKind = 'no-key' | 'unauthorized' | 'rate-limited' | 'not-found' | 'http' | 'network';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

async function request<T>(path: string, apiKey: string): Promise<T> {
  if (!apiKey) throw new ApiError('no-key', 'API key is not set');

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    throw new ApiError('network', `Network error: ${(e as Error).message}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError('unauthorized', 'Invalid or unauthorized API key', res.status);
  }
  if (res.status === 429) {
    throw new ApiError('rate-limited', 'Rate limit exceeded', 429);
  }
  if (res.status === 404) {
    throw new ApiError('not-found', 'Resource not found', 404);
  }
  if (!res.ok) {
    throw new ApiError('http', `HTTP ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}

/** GET /players?nickname={nickname}&game=cs2 */
export function getPlayerByNickname(nickname: string, apiKey: string): Promise<Record<string, unknown>> {
  const q = encodeURIComponent(nickname);
  return request(`/players?nickname=${q}&game=cs2`, apiKey);
}

/** GET /players/{player_id} */
export function getPlayerById(playerId: string, apiKey: string): Promise<Record<string, unknown>> {
  return request(`/players/${encodeURIComponent(playerId)}`, apiKey);
}

/** GET /players/{player_id}/stats/cs2 (lifetime + segments) */
export function getPlayerStats(playerId: string, apiKey: string): Promise<Record<string, unknown>> {
  return request(`/players/${encodeURIComponent(playerId)}/stats/cs2`, apiKey);
}

/**
 * GET /players/{player_id}/history?game=cs2&limit=N — recent matches WITH the
 * full roster of both factions and the result. Used to compute encounters
 * (who you played with vs against).
 */
export function getPlayerHistory(
  playerId: string,
  apiKey: string,
  limit = 50
): Promise<{ items?: Array<Record<string, unknown>> }> {
  return request(
    `/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=${limit}`,
    apiKey
  );
}

/** GET /players/{player_id}/games/cs2/stats?limit=N — recent match history. */
export function getMatchHistory(
  playerId: string,
  apiKey: string,
  limit = 20
): Promise<{ items?: Array<Record<string, unknown>> }> {
  return request(
    `/players/${encodeURIComponent(playerId)}/games/cs2/stats?limit=${limit}`,
    apiKey
  );
}
