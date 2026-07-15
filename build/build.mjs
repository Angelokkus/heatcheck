// Build script: produces dist/chromium and dist/firefox from a single command.
// Usage: node build/build.mjs [--watch]
import { build, context } from 'esbuild';
import { cp, mkdir, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const TARGETS = ['chromium', 'firefox'];
const WATCH = process.argv.includes('--watch');

const entryPoints = {
  'background/index': 'src/background/index.ts',
  'content/index': 'src/content/index.ts',
  'popup/popup': 'src/popup/popup.ts',
};

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Copy the static assets that esbuild does not bundle. */
async function copyStatic(target, outdir) {
  await cp(`manifest.${target}.json`, `${outdir}/manifest.json`);

  await mkdir(`${outdir}/popup`, { recursive: true });
  await cp('src/popup/popup.html', `${outdir}/popup/popup.html`);

  await cp('src/assets', `${outdir}/assets`, { recursive: true });

  await mkdir(`${outdir}/styles`, { recursive: true });
  await cp('src/styles/badge.css', `${outdir}/styles/badge.css`);

  // Icons are optional; copy the folder if the author added one.
  if (await exists('icons')) {
    await cp('icons', `${outdir}/icons`, { recursive: true });
  }
}

async function buildTarget(target) {
  const outdir = `dist/${target}`;
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const options = {
    entryPoints,
    bundle: true,
    outdir,
    // IIFE keeps the Chromium service worker as a classic worker and avoids
    // ESM-in-content-script issues in Firefox. Everything is self-contained.
    format: 'iife',
    target: ['chrome111', 'firefox115'],
    platform: 'browser',
    define: {
      __TARGET__: JSON.stringify(target),
      'process.env.NODE_ENV': '"production"',
    },
    sourcemap: WATCH ? 'inline' : false,
    minify: !WATCH,
    logLevel: 'info',
  };

  if (WATCH) {
    const ctx = await context(options);
    await ctx.watch();
    await copyStatic(target, outdir);
    console.log(`[watch] ${target} → ${outdir}`);
    return ctx;
  }

  await build(options);
  await copyStatic(target, outdir);
  console.log(`[build] ${target} → ${outdir}`);
}

const contexts = [];
for (const t of TARGETS) {
  const ctx = await buildTarget(t);
  if (ctx) contexts.push(ctx);
}

if (WATCH) {
  console.log('Watching for changes. Ctrl+C to stop.');
  // Keep the process alive.
  await new Promise(() => {});
}
