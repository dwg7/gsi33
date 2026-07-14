// Generates data/gsi33.json from the 33-character source list in README.md.
// Characters are derived from their code points via String.fromCodePoint,
// not typed as literals, to avoid transcription/copy-paste corruption of
// supplementary-plane glyphs.
import { writeFile } from 'node:fs/promises';

const BMP_MAX = 0xffff;

// [no, codepointHex, block, mj]
const SOURCE = [
  [1, 0x5749, 'CJK Unified Ideographs', 'MJ008938'],
  [2, 0x5f30, 'CJK Unified Ideographs', 'MJ011189'],
  [3, 0x6927, 'CJK Unified Ideographs', 'MJ014145'],
  [4, 0x853b, 'CJK Unified Ideographs', 'MJ058504'],
  [5, 0x26b72, 'CJK Unified Ideographs Extension B', 'MJ046358'],
  [6, 0x2b788, 'CJK Unified Ideographs Extension D', 'MJ057710'],
  [7, 0x2b7f0, 'CJK Unified Ideographs Extension D', 'MJ058910'],
  [8, 0x2b78b, 'CJK Unified Ideographs Extension D', 'MJ014410'],
  [9, 0x235be, 'CJK Unified Ideographs Extension B', 'MJ038168'],
  [10, 0x203f9, 'CJK Unified Ideographs Extension B', 'MJ030848'],
  [11, 0x2123d, 'CJK Unified Ideographs Extension B', 'MJ032932'],
  [12, 0x212fd, 'CJK Unified Ideographs Extension B', 'MJ033033'],
  [13, 0x21d92, 'CJK Unified Ideographs Extension B', 'MJ034538'],
  [14, 0x21e34, 'CJK Unified Ideographs Extension B', 'MJ034640'],
  [15, 0x231c3, 'CJK Unified Ideographs Extension B', 'MJ037700'],
  [16, 0x2355a, 'CJK Unified Ideographs Extension B', 'MJ038132'],
  [17, 0x23639, 'CJK Unified Ideographs Extension B', 'MJ038224'],
  [18, 0x2373f, 'CJK Unified Ideographs Extension B', 'MJ038332'],
  [19, 0x23dd3, 'CJK Unified Ideographs Extension B', 'MJ039381'],
  [20, 0x2550e, 'CJK Unified Ideographs Extension B', 'MJ042849'],
  [21, 0x259c4, 'CJK Unified Ideographs Extension B', 'MJ043488'],
  [22, 0x25e56, 'CJK Unified Ideographs Extension B', 'MJ044210'],
  [23, 0x2667e, 'CJK Unified Ideographs Extension B', 'MJ045521'],
  [24, 0x26aff, 'CJK Unified Ideographs Extension B', 'MJ046282'],
  [25, 0x270f4, 'CJK Unified Ideographs Extension B', 'MJ047259'],
  [26, 0x27985, 'CJK Unified Ideographs Extension B', 'MJ048837'],
  [27, 0x295cf, 'CJK Unified Ideographs Extension B', 'MJ053729'],
  [28, 0x29e15, 'CJK Unified Ideographs Extension B', 'MJ055201'],
  [29, 0x2a02f, 'CJK Unified Ideographs Extension B', 'MJ055513'],
  [30, 0x29e49, 'CJK Unified Ideographs Extension B', 'MJ055230'],
  [31, 0x28e89, 'CJK Unified Ideographs Extension B', 'MJ052363'],
  [32, 0x28e36, 'CJK Unified Ideographs Extension B', 'MJ052313'],
  [33, 0x21d45, 'CJK Unified Ideographs Extension B', 'MJ034487'],
];

function toRecord([no, cp, block, mj]) {
  const char = String.fromCodePoint(cp);
  const surrogatePair = cp > BMP_MAX;
  return {
    no,
    char,
    codepoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
    block,
    plane: surrogatePair ? 'SIP' : 'BMP',
    surrogate_pair: surrogatePair,
    jis_x_0213: null,
    mj,
    ivs: null,
    utf16_code_units: char.length,
    code_points: [...char].length,
  };
}

const records = SOURCE.map(toRecord);

await writeFile(
  new URL('../data/gsi33.json', import.meta.url),
  JSON.stringify(records, null, 2) + '\n',
  'utf8',
);

console.log(`Wrote ${records.length} records to data/gsi33.json`);
