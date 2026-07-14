// Phase 1: data-retention tests (Scenario A).
// Verifies the 33 GSI characters survive UTF-8, JSON, GeoJSON, MVT
// encode/decode, and Unicode normalization without loss or corruption.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vtpbf from 'vt-pbf';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';

const REPLACEMENT_CHAR = '�';

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);
const geojson = JSON.parse(
  await readFile(new URL('../data/gsi33.geojson', import.meta.url), 'utf8'),
);
const expectedFailures = JSON.parse(
  await readFile(new URL('../expected-failures.json', import.meta.url), 'utf8'),
);

function findXfail(tool, codepoint) {
  return expectedFailures.find(
    (entry) => entry.tool === tool && entry.codePoint === codepoint,
  );
}

test('master data contains exactly 33 records', () => {
  assert.equal(records.length, 33);
});

test('no record contains U+FFFD in char or codepoint fields', () => {
  for (const record of records) {
    assert.ok(
      !record.char.includes(REPLACEMENT_CHAR),
      `record ${record.no} char contains U+FFFD`,
    );
    assert.ok(
      !record.codepoint.includes(REPLACEMENT_CHAR),
      `record ${record.no} codepoint contains U+FFFD`,
    );
  }
});

test('UTF-8 round trip preserves code-point sequence', async () => {
  const raw = await readFile(new URL('../data/gsi33.json', import.meta.url));
  const decoded = raw.toString('utf8');
  assert.ok(!decoded.includes(REPLACEMENT_CHAR));
  const reencoded = Buffer.from(decoded, 'utf8');
  assert.ok(reencoded.equals(raw));

  const roundTripped = JSON.parse(decoded);
  for (const [i, record] of records.entries()) {
    assert.equal(
      roundTripped[i].char,
      record.char,
      `record ${record.no} char mismatch after UTF-8 round trip`,
    );
  }
});

test('JSON round trip preserves every character exactly', () => {
  const roundTripped = JSON.parse(JSON.stringify(records));
  assert.deepEqual(roundTripped, records);
});

test('JSON round trip keeps codepoint and MJ number bound to the correct character', () => {
  const roundTripped = JSON.parse(JSON.stringify(records));
  for (const [i, record] of records.entries()) {
    assert.equal(roundTripped[i].no, record.no);
    assert.equal(roundTripped[i].char, record.char);
    assert.equal(roundTripped[i].codepoint, record.codepoint);
    assert.equal(roundTripped[i].mj, record.mj);
  }
});

test('geojson has one Point feature per record', () => {
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, records.length);
  for (const feature of geojson.features) {
    assert.equal(feature.type, 'Feature');
    assert.equal(feature.geometry.type, 'Point');
    assert.equal(feature.geometry.coordinates.length, 2);
  }
});

test('geojson round trip preserves label properties and traces back to master data', () => {
  const roundTripped = JSON.parse(JSON.stringify(geojson));
  const byNo = new Map(records.map((r) => [r.no, r]));

  for (const feature of roundTripped.features) {
    const record = byNo.get(feature.properties.no);
    assert.ok(record, `no master-data record for feature no=${feature.properties.no}`);
    assert.equal(feature.properties.name, record.char);
    assert.equal(feature.properties.codepoint, record.codepoint);
    assert.equal(feature.properties.mj, record.mj);
    assert.ok(!feature.properties.name.includes(REPLACEMENT_CHAR));
  }
});

test('MVT encode/decode retains exact code-point sequence for every character', () => {
  const extent = 4096;

  // geojson-vt-style features: type 1 = Point, geometry = [x, y] in tile
  // pixel coordinates, tags = feature properties. Coordinates are a
  // deterministic projection sufficient for a round-trip test.
  const features = geojson.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const x = Math.round(((lng + 180) / 360) * extent);
    const y = Math.round(((90 - lat) / 180) * extent);
    return {
      id: feature.properties.no,
      type: 1,
      geometry: [x, y],
      tags: feature.properties,
    };
  });

  const buffer = vtpbf.fromGeojsonVt(
    { gsi33: { features } },
    { version: 2, extent },
  );
  assert.ok(buffer.length > 0);

  const tile = new VectorTile(new Pbf(buffer));
  const layer = tile.layers.gsi33;
  assert.equal(layer.length, records.length);

  const byNo = new Map(records.map((r) => [r.no, r]));
  const unexpectedMismatches = [];
  const staleXfails = [];

  for (let i = 0; i < layer.length; i++) {
    const decodedFeature = layer.feature(i);
    const props = decodedFeature.properties;
    const record = byNo.get(props.no);
    assert.ok(record, `no master-data record for decoded feature no=${props.no}`);

    // U+FFFD must never appear, even for characters with a recorded xfail:
    // an xfail covers silent corruption to a different code point, not
    // outright replacement-character loss.
    assert.ok(
      !props.name.includes(REPLACEMENT_CHAR),
      `decoded MVT name for record ${record.no} contains U+FFFD`,
    );

    const matches = props.name === record.char;
    const xfail = findXfail('pbf', record.codepoint);

    if (!matches && !xfail) {
      unexpectedMismatches.push(record);
    } else if (matches && xfail) {
      staleXfails.push(record);
    }
  }

  assert.deepEqual(
    unexpectedMismatches,
    [],
    'MVT round trip lost data for records with no recorded expected-failures.json entry',
  );
  assert.deepEqual(
    staleXfails,
    [],
    'MVT round trip now succeeds for records with a stale expected-failures.json entry; remove the entry',
  );
});

test('NFC normalization does not change code-point sequence', () => {
  for (const record of records) {
    const normalized = record.char.normalize('NFC');
    assert.equal(
      normalized,
      record.char,
      `record ${record.no} (${record.codepoint}) changed under NFC normalization`,
    );
  }
});

test('NFKC normalization does not change code-point sequence', () => {
  for (const record of records) {
    const normalized = record.char.normalize('NFKC');
    assert.equal(
      normalized,
      record.char,
      `record ${record.no} (${record.codepoint}) changed under NFKC normalization`,
    );
  }
});

test('NFD normalization does not change code-point sequence', () => {
  for (const record of records) {
    const normalized = record.char.normalize('NFD');
    assert.equal(
      normalized,
      record.char,
      `record ${record.no} (${record.codepoint}) changed under NFD normalization`,
    );
  }
});

test('UTF-16 code-unit length matches expected value for every character', () => {
  for (const record of records) {
    assert.equal(
      record.char.length,
      record.utf16_code_units,
      `record ${record.no} (${record.codepoint}) has unexpected UTF-16 code-unit length`,
    );
  }
});

test('code-point count matches expected value for every character', () => {
  for (const record of records) {
    assert.equal(
      [...record.char].length,
      record.code_points,
      `record ${record.no} (${record.codepoint}) has unexpected code-point count`,
    );
  }
});

test('surrogate_pair flag matches actual UTF-16 encoding', () => {
  for (const record of records) {
    const codeUnit0 = record.char.charCodeAt(0);
    const isHighSurrogate = codeUnit0 >= 0xd800 && codeUnit0 <= 0xdbff;
    assert.equal(
      isHighSurrogate,
      record.surrogate_pair,
      `record ${record.no} (${record.codepoint}) surrogate_pair flag mismatch`,
    );
  }
});

test('BMP records have a single UTF-16 code unit and no surrogate pair', () => {
  const bmpRecords = records.filter((r) => r.plane === 'BMP');
  assert.equal(bmpRecords.length, 4);
  for (const record of bmpRecords) {
    assert.equal(record.utf16_code_units, 1);
    assert.equal(record.surrogate_pair, false);
  }
});

test('SIP records require a surrogate pair', () => {
  const sipRecords = records.filter((r) => r.plane === 'SIP');
  assert.equal(sipRecords.length, 29);
  for (const record of sipRecords) {
    assert.equal(record.utf16_code_units, 2);
    assert.equal(record.surrogate_pair, true);
  }
});
