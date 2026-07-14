// Generates data/gsi33.geojson from data/gsi33.json.
// Coordinates are a deterministic dummy grid (not real place-name locations);
// real coordinates are deferred to a later issue per SCOPE.md.
import { readFile, writeFile } from 'node:fs/promises';

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);

const COLUMNS = 6;
const STEP = 0.01;
const ORIGIN = [139.0, 36.0]; // arbitrary point within Japan, not a real place

function gridCoordinate(index) {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return [ORIGIN[0] + col * STEP, ORIGIN[1] - row * STEP];
}

const features = records.map((record, index) => ({
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: gridCoordinate(index),
  },
  properties: {
    no: record.no,
    name: record.char,
    codepoint: record.codepoint,
    mj: record.mj,
  },
}));

const geojson = {
  type: 'FeatureCollection',
  features,
};

await writeFile(
  new URL('../data/gsi33.geojson', import.meta.url),
  JSON.stringify(geojson, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${features.length} features to data/gsi33.geojson`);
