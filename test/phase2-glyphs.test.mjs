// Phase 2: headless glyph-path tests (the CI-automatable slice of
// Scenario C: font -> glyph PBF generation -> PBF decode).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import fontnik from 'fontnik';
import composite from '@mapbox/glyph-pbf-composite';
import { FONT_PATH, FONT_TTF_SHA256 } from '../scripts/font-config.mjs';

const execFileAsync = promisify(execFile);
const rangeAsync = promisify(fontnik.range);

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);
const expectedFailures = JSON.parse(
  await readFile(new URL('../expected-failures.json', import.meta.url), 'utf8'),
);

function findXfail(tool, codepoint) {
  return expectedFailures.find(
    (entry) => entry.tool === tool && entry.codePoint === codepoint,
  );
}

async function fontExists() {
  try {
    await stat(FONT_PATH);
    return true;
  } catch {
    return false;
  }
}

const hasFont = await fontExists();

test('font file is present', () => {
  assert.ok(
    hasFont,
    `IPAmj Mincho not found at ${FONT_PATH.pathname}. Run \`npm run download:font\` first.`,
  );
});

test('font file matches the recorded SHA-256', { skip: !hasFont }, async () => {
  const data = await readFile(FONT_PATH);
  const hash = createHash('sha256').update(data).digest('hex');
  assert.equal(hash, FONT_TTF_SHA256);
});

test(
  'font cmap covers all 33 target code points (via fontTools)',
  { skip: !hasFont },
  async () => {
    let result;
    try {
      result = await execFileAsync('python3', [
        new URL('../scripts/check-font-cmap.py', import.meta.url).pathname,
        FONT_PATH.pathname,
      ]);
    } catch (err) {
      // Non-zero exit means missing code points; stdout still has the report.
      const report = JSON.parse(err.stdout);
      assert.deepEqual(report.missing, [], 'font is missing cmap coverage');
      throw err;
    }
    const report = JSON.parse(result.stdout);
    assert.equal(report.covered.length, 33);
    assert.equal(report.missing.length, 0);
  },
);

function rangeFor(codepoint) {
  const start = Math.floor(codepoint / 256) * 256;
  return [start, start + 255];
}

const bmpRecords = records.filter((r) => r.plane === 'BMP');
const sipRecords = records.filter((r) => r.plane === 'SIP');

test(
  'glyph PBF generation and decode produce a glyph id and non-empty SDF bitmap for every BMP character',
  { skip: !hasFont },
  async () => {
    const font = await readFile(FONT_PATH);
    const generatedRanges = new Set();

    for (const record of bmpRecords) {
      const codepoint = parseInt(record.codepoint.replace('U+', ''), 16);
      const [start, end] = rangeFor(codepoint);

      const tile = await rangeAsync({ font, start, end });
      generatedRanges.add(`${start}-${end}`);

      const decoded = composite.decode(tile);
      const stack = decoded.stacks[0];
      const glyph = stack.glyphs.find((g) => g.id === codepoint);

      assert.ok(
        glyph,
        `no glyph decoded for record ${record.no} (${record.codepoint}) in range ${start}-${end}`,
      );
      assert.ok(
        glyph.bitmap && glyph.bitmap.length > 0,
        `empty SDF bitmap for record ${record.no} (${record.codepoint})`,
      );
    }

    assert.equal(generatedRanges.size > 0, true);
  },
);

test(
  'glyph PBF generation is a documented, still-reproducing limitation for every SIP character',
  { skip: !hasFont },
  async () => {
    const font = await readFile(FONT_PATH);
    const unexpectedSuccesses = [];
    const unexpectedErrors = [];
    const missingXfails = [];

    for (const record of sipRecords) {
      const codepoint = parseInt(record.codepoint.replace('U+', ''), 16);
      const [start, end] = rangeFor(codepoint);
      const xfail = findXfail('fontnik', record.codepoint);

      if (!xfail) {
        missingXfails.push(record);
        continue;
      }

      try {
        await rangeAsync({ font, start, end });
        unexpectedSuccesses.push(record);
      } catch (err) {
        if (!(err instanceof TypeError) || !/0-65535/.test(err.message)) {
          unexpectedErrors.push({ record, message: err.message });
        }
      }
    }

    assert.deepEqual(
      missingXfails,
      [],
      'SIP records with no expected-failures.json entry for tool "fontnik"',
    );
    assert.deepEqual(
      unexpectedSuccesses,
      [],
      'fontnik.range() now succeeds for SIP records with a stale "fontnik" xfail entry; remove the entry and add real glyph-decode assertions',
    );
    assert.deepEqual(
      unexpectedErrors,
      [],
      'fontnik.range() failed for a different reason than the documented 0-65535 range limitation',
    );
  },
);
