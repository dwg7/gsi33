// Optional, informational-only check (not part of the required Phase 1/2
// gate): runs data/gsi33.geojson through tippecanoe and decodes the
// resulting MVT tiles to see whether the character corruption found in
// test/phase1-retention.test.mjs (see expected-failures.json, tool
// "pbf") is specific to the JS `pbf` encoder or a broader MVT-ecosystem
// problem. tippecanoe is a separate, non-JS (C++) MVT encoder that does
// not depend on `pbf`.
//
// Requires the `tippecanoe` CLI to be installed. Exits 0 even when
// mismatches are found; this script only reports, it never fails CI.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const execFileAsync = promisify(execFile);
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);
const byNo = new Map(records.map((r) => [r.no, r]));

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), 'gsi33-tippecanoe-'));
  const mbtilesPath = join(workDir, 'gsi33.mbtiles');
  const geojsonPath = new URL('../data/gsi33.geojson', import.meta.url).pathname;

  try {
    await execFileAsync('tippecanoe', ['-o', mbtilesPath, '-zg', '-f', geojsonPath]);

    const db = new DatabaseSync(mbtilesPath);
    const tiles = db.prepare('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles').all();
    db.close();

    const seen = new Map(); // no -> { record, decodedChar, ok }

    for (const row of tiles) {
      let data = Buffer.from(row.tile_data);
      if (data.subarray(0, 2).equals(GZIP_MAGIC)) {
        data = gunzipSync(data);
      }

      const tile = new VectorTile(new Pbf(data));
      for (const layerName of Object.keys(tile.layers)) {
        const layer = tile.layers[layerName];
        for (let i = 0; i < layer.length; i++) {
          const feature = layer.feature(i);
          const props = feature.properties;
          const record = byNo.get(props.no);
          if (!record) continue;
          const ok = props.name === record.char;
          seen.set(record.no, { record, decodedChar: props.name, ok });
        }
      }
    }

    const results = [...seen.values()];
    const mismatches = results.filter((r) => !r.ok);

    console.log(`tippecanoe: decoded ${results.length}/${records.length} records across ${tiles.length} tiles`);
    if (mismatches.length === 0) {
      console.log('tippecanoe: no corruption found (informational — not a required check)');
    } else {
      console.log(`tippecanoe: ${mismatches.length} record(s) corrupted:`);
      for (const { record, decodedChar } of mismatches) {
        console.log(`  no=${record.no} ${record.codepoint}: expected ${JSON.stringify(record.char)}, got ${JSON.stringify(decodedChar)}`);
      }
    }
  } catch (err) {
    console.log(`tippecanoe: check skipped or failed (informational — not a required check): ${err.message}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

await main();
