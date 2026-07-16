// Generates expected-failures.json from data/gsi33.json.
//
// Background: `pbf`'s writeUtf8() reconstructs a supplementary-plane code
// point from a surrogate pair using `... | 0x10000` instead of
// `... + 0x10000` (pbf@3.3.0, index.js:604). For any code point whose
// (codepoint - 0x10000) already has bit 16 (0x10000) set — i.e. every
// character in Plane 2 (U+20000-U+2FFFF) — the OR is a no-op and the
// written UTF-8 bytes encode (codepoint - 0x10000) instead of codepoint.
// This silently corrupts all Extension B / Extension D characters when
// they pass through `vt-pbf` / `@mapbox/vector-tile` (both depend on
// `pbf` for string field encoding), confirmed by
// test/phase1-retention.test.mjs.
import { readFile, writeFile } from 'node:fs/promises';

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);

const PBF_REASON =
  "pbf's writeUtf8() combines a surrogate pair with `| 0x10000` instead " +
  'of `+ 0x10000` (pbf@3.3.0, index.js:604). For Plane 2 code points ' +
  '(U+20000-U+2FFFF), (codepoint - 0x10000) already has bit 0x10000 set, ' +
  'so the OR has no effect and the encoded UTF-8 bytes represent ' +
  '(codepoint - 0x10000) instead of the original codepoint. Affects any ' +
  'library that writes UTF-8 string fields through pbf, including ' +
  'vt-pbf and @mapbox/vector-tile used in the MVT round-trip test.';

const FONTNIK_REASON =
  'fontnik.range() validates `start`/`end` as 0-65535 at the native ' +
  'binding layer (fontnik@0.7.7, src/glyphs.cpp:350-355) and throws ' +
  'synchronously for any range touching a non-BMP code point, so glyph ' +
  'PBF ranges cannot be requested for SIP characters at all. This is a ' +
  'BMP-only limitation of the SDF glyph-generation pipeline used by ' +
  'MapLibre/Mapbox GL styles; see mapbox/mapbox-gl-js#4001 (supplementary' +
  '-plane glyph rendering support).';

const sipRecords = records.filter((r) => r.plane === 'SIP');

const entries = [
  ...sipRecords.map((r) => ({
    tool: 'pbf',
    codePoint: r.codepoint,
    reason: PBF_REASON,
    trackingIssue:
      'https://github.com/mapbox/pbf/issues (not yet filed upstream; discovered during gsi33 Phase 1 implementation)',
  })),
  ...sipRecords.map((r) => ({
    tool: 'fontnik',
    codePoint: r.codepoint,
    reason: FONTNIK_REASON,
    trackingIssue: 'https://github.com/mapbox/mapbox-gl-js/issues/4001',
  })),
];

await writeFile(
  new URL('../expected-failures.json', import.meta.url),
  JSON.stringify(entries, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${entries.length} expected-failure entries to expected-failures.json`);
