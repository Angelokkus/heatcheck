// scripts/probe-api.ts
//
// DEV-ONLY schema reconnaissance (Section 2.1). Run this with a REAL key
// BEFORE trusting src/lib/api-schema.ts, because FACEIT renames fields.
//
//   FACEIT_API_KEY=xxxx npm run probe -- <nickname>
//   (or: FACEIT_API_KEY=xxxx npx tsx scripts/probe-api.ts s1mple)
//
// It prints the raw JSON of: player, player stats (cs2), and the last 20
// match rows — plus a flattened list of every key seen inside the match
// `stats` objects and inside lifetime stats. Copy those key names into
// ALIASES in src/lib/api-schema.ts if they differ from what is assumed.

const API_BASE = 'https://open.faceit.com/data/v4';

const apiKey = process.env.FACEIT_API_KEY ?? '';
const nickname = process.argv[2] ?? 's1mple';

if (!apiKey) {
  console.error('Set FACEIT_API_KEY in the environment first. Aborting.');
  process.exit(1);
}

async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} → HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function section(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function keysOf(obj: unknown): string[] {
  return obj && typeof obj === 'object' ? Object.keys(obj as object) : [];
}

async function main() {
  section(`1) PLAYER by nickname: ${nickname}`);
  const player = await get(`/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);
  console.log(JSON.stringify(player, null, 2));

  const playerId: string | undefined = (player as any)?.player_id;
  if (!playerId) {
    console.error('No player_id found — cannot continue.');
    return;
  }
  console.log('\nplayer.games.cs2 keys:', keysOf((player as any)?.games?.cs2));

  section('2) PLAYER STATS (cs2) — lifetime + segments');
  try {
    const stats = await get(`/players/${playerId}/stats/cs2`);
    console.log(JSON.stringify(stats, null, 2));
    console.log('\nlifetime keys:', keysOf((stats as any)?.lifetime));
  } catch (e) {
    console.error('stats/cs2 failed:', (e as Error).message);
  }

  section('3) MATCH HISTORY /games/cs2/stats?limit=20');
  const history = await get<{ items?: any[] }>(`/players/${playerId}/games/cs2/stats?limit=20`);
  const items = history.items ?? [];
  console.log(`items: ${items.length}`);
  if (items.length) {
    console.log('\nRAW first item:');
    console.log(JSON.stringify(items[0], null, 2));

    // Union of every key seen inside the `stats` objects.
    const allKeys = new Set<string>();
    for (const it of items) {
      for (const k of keysOf(it?.stats)) allKeys.add(k);
    }
    section('4) UNION of keys inside match `stats` objects');
    console.log([...allKeys].sort().map(k => `  • ${k}`).join('\n'));

    section('5) Multikill fields present?');
    for (const name of ['Double Kills', 'Triple Kills', 'Quadro Kills', 'Penta Kills']) {
      console.log(`  ${allKeys.has(name) ? '✓' : '✗'}  "${name}"`);
    }
    console.log(`  ${allKeys.has('Rounds') ? '✓' : '✗'}  "Rounds"`);
    console.log(`  Score-like: ${[...allKeys].filter(k => /score/i.test(k)).join(', ') || 'none'}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
