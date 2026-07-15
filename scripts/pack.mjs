// Package dist/chromium and dist/firefox into spec-compliant store zips
// (forward-slash paths — required by Chrome Web Store).
// Run: node scripts/pack.mjs   (build first)
import AdmZip from 'adm-zip';
import { readFile, mkdir } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('manifest.chromium.json', 'utf8'));
await mkdir('store', { recursive: true });

for (const [target, name] of [
  ['chromium', 'chrome'],
  ['firefox', 'firefox'],
]) {
  const zip = new AdmZip();
  zip.addLocalFolder(`dist/${target}`); // entries are relative, forward-slash
  const out = `store/heatcheck-${name}-v${version}.zip`;
  zip.writeZip(out);
  console.log(`wrote ${out}`);
}
