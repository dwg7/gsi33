# gsi33

Implementation workspace for **GSI Plane 2 Kanji Test Set**, based on `UNopenGIS/7#956`.

This repository provides a compact regression test set for checking whether web mapping and vector-tile toolchains can preserve Japanese place-name characters in the Unicode supplementary ideographic planes, especially characters outside the BMP.

The first implementation target is deliberately narrow: **Phase 1 + Phase 2 + SCOPE.md in one PR**, with deterministic CI as the only merge gate.

## Background

The Geospatial Information Authority of Japan (GSI) has announced a change in the Japanese character repertoire used for place-name information. Some characters that had previously been represented with substitute characters will be represented using their original Unicode characters.

The target set contains 33 characters:

- 4 BMP characters;
- 29 SIP characters;
- 26 CJK Unified Ideographs Extension B characters;
- 3 CJK Unified Ideographs Extension D characters;
- 29 characters that require UTF-16 surrogate pairs;
- 33 characters with MJ numbers;
- no IVS specified in the GSI source material.

This makes the set a small but practical regression test for modern map systems that need to preserve authoritative place-name text across JSON, GeoJSON, MVT/PBF, glyph generation, and client-side decoding.

## Why this matters

This is not just a rare-kanji display problem. It tests whether a geospatial information pipeline can preserve Unicode supplementary-plane characters as data.

Important failure modes include:

- replacement with `U+FFFD REPLACEMENT CHARACTER`;
- dropping or splitting UTF-16 surrogate pairs;
- converting to substitute characters;
- preserving the data but failing glyph lookup or font fallback;
- confusing data loss with missing glyph display.

The distinction between data loss and glyph absence is central:

- `U+FFFD` means the original character has already been lost during decoding, conversion, extraction, or copy operations.
- `□` tofu display usually means the Unicode character is still present, but the active font or glyph path lacks a usable glyph.

## First PR policy

The first PR should include **Phase 1**, **Phase 2**, and **SCOPE.md** as a single mergeable unit.

Merge condition:

```text
required CI checks are green
```

The first PR must be fully automated and must not require manual visual confirmation.

## Repository layout

Initial target layout:

```text
gsi33/
├── SCOPE.md
├── data/
│   ├── gsi33.json
│   └── gsi33.geojson
├── test/
│   ├── phase1-retention.test.mjs
│   └── phase2-glyphs.test.mjs
├── expected-failures.json
└── .github/workflows/ci.yml
```

## Data model

`data/gsi33.json` is the single source of truth.

Each character entry should include at least:

```json
{
  "no": 1,
  "char": "坉",
  "codepoint": "U+5749",
  "block": "CJK Unified Ideographs",
  "plane": "BMP",
  "surrogate_pair": false,
  "jis_x_0213": null,
  "mj": "MJ008938",
  "ivs": null,
  "utf16_code_units": 1,
  "code_points": 1
}
```

`data/gsi33.geojson` should contain one point per character. For the first PR, dummy grid coordinates are acceptable. Real place-name coordinates should be deferred to a later issue.

## Target 33 characters

The master data should represent the following 33 records.

```text
1  坉    U+5749   CJK Unified Ideographs              BMP  MJ008938
2  弰    U+5F30   CJK Unified Ideographs              BMP  MJ011189
3  椧    U+6927   CJK Unified Ideographs              BMP  MJ014145
4  蔻    U+853B   CJK Unified Ideographs              BMP  MJ058504
5  𦭲   U+26B72  CJK Unified Ideographs Extension B  SIP  MJ046358
6  𫞈   U+2B788  CJK Unified Ideographs Extension D  SIP  MJ057710
7  𫟰   U+2B7F0  CJK Unified Ideographs Extension D  SIP  MJ058910
8  𫞋   U+2B78B  CJK Unified Ideographs Extension D  SIP  MJ014410
9  𣖾   U+235BE  CJK Unified Ideographs Extension B  SIP  MJ038168
10 𠏹   U+203F9  CJK Unified Ideographs Extension B  SIP  MJ030848
11 𡈽   U+2123D  CJK Unified Ideographs Extension B  SIP  MJ032932
12 𡋽   U+212FD  CJK Unified Ideographs Extension B  SIP  MJ033033
13 𡶒   U+21D92  CJK Unified Ideographs Extension B  SIP  MJ034538
14 𡸴   U+21E34  CJK Unified Ideographs Extension B  SIP  MJ034640
15 𣇃   U+231C3  CJK Unified Ideographs Extension B  SIP  MJ037700
16 𣕚   U+2355A  CJK Unified Ideographs Extension B  SIP  MJ038132
17 𣘹   U+23639  CJK Unified Ideographs Extension B  SIP  MJ038224
18 𣜿   U+2373F  CJK Unified Ideographs Extension B  SIP  MJ038332
19 𣷓   U+23DD3  CJK Unified Ideographs Extension B  SIP  MJ039381
20 𥔎   U+2550E  CJK Unified Ideographs Extension B  SIP  MJ042849
21 𥧄   U+259C4  CJK Unified Ideographs Extension B  SIP  MJ043488
22 𥹖   U+25E56  CJK Unified Ideographs Extension B  SIP  MJ044210
23 𦙾   U+2667E  CJK Unified Ideographs Extension B  SIP  MJ045521
24 𦫿   U+26AFF  CJK Unified Ideographs Extension B  SIP  MJ046282
25 𧃄   U+270F4  CJK Unified Ideographs Extension B  SIP  MJ047259
26 𧦅   U+27985  CJK Unified Ideographs Extension B  SIP  MJ048837
27 𩗏   U+295CF  CJK Unified Ideographs Extension B  SIP  MJ053729
28 𩸕   U+29E15  CJK Unified Ideographs Extension B  SIP  MJ055201
29 𪀕   U+2A02F  CJK Unified Ideographs Extension B  SIP  MJ055513
30 𩹉   U+29E49  CJK Unified Ideographs Extension B  SIP  MJ055230
31 𨺉   U+28E89  CJK Unified Ideographs Extension B  SIP  MJ052363
32 𨸶   U+28E36  CJK Unified Ideographs Extension B  SIP  MJ052313
33 𡵅   U+21D45  CJK Unified Ideographs Extension B  SIP  MJ034487
```

## Phase 1: data-retention tests

Phase 1 covers Scenario A and should be fully automated with Node.js, preferably using `node --test` and minimal dependencies.

Required checks:

1. **UTF-8 round trip**
   - Read/write data and confirm all 33 characters match at code-point level.
   - Fail if `U+FFFD` appears anywhere in the pipeline.
2. **JSON / GeoJSON round trip**
   - Confirm `JSON.parse(JSON.stringify(...))` preserves the exact character values.
   - Validate GeoJSON and confirm properties are preserved.
3. **MVT encode/decode**
   - Encode GeoJSON to MVT using `@mapbox/vt-pbf`.
   - Decode using `@mapbox/vector-tile`.
   - Confirm the decoded `name` attribute has the exact original code-point sequence.
   - tippecanoe may be added only as an optional informational job.
4. **Normalization stability**
   - Confirm NFC, NFKC, and NFD do not change any code-point sequence.
5. **Surrogate-pair handling**
   - Verify expected UTF-16 code-unit length and expected code-point count.

## Phase 2: automated glyph-path tests

Phase 2 covers only the CI-automatable part of Scenario C:

```text
font -> glyph PBF generation -> PBF decode
```

Required checks:

1. **Font coverage**
   - Obtain IPAmj Mincho in CI.
   - Verify all 33 code points exist in the font cmap using Python/fontTools.
2. **Glyph PBF generation**
   - Use a generation path that can handle SIP code points.
   - Treat BMP-only tool limitations as explicit findings.
3. **PBF decode verification**
   - Decode generated `{range}.pbf` files.
   - Confirm each target code point has a glyph id and non-empty SDF bitmap data.
4. **Expected failures**
   - Record known limitations in `expected-failures.json` as xfail entries.

## Expected failures

Known tool limitations should be explicit rather than hidden.

Example:

```json
{
  "tool": "node-fontnik",
  "codePoint": "U+20000",
  "reason": "Known BMP-only or non-SIP limitation under this test path",
  "trackingIssue": "https://github.com/..."
}
```

The aim is to keep CI green while preserving evidence of known limitations.

## Explicitly out of scope for the first PR

The following are not part of the first PR and must not be required merge checks:

- Scenario B: OS/browser local-font display matrix.
- Scenario C: actual browser rendering and visual confirmation.
- Scenario D: copy and paste.
- Scenario E: PDF generation, PDF rendering, PDF text extraction, and PDF copying.
- Scenario F: database search and normalization tests, except Phase 1 normalization-stability checks.

PDF-related material may appear only as a later follow-up topic. It must not be implemented, tested, or manually checked in the first PR.

## CI policy

Use a single GitHub Actions workflow on `ubuntu-latest`.

Required checks:

- Phase 1 deterministic data-retention tests;
- Phase 2 deterministic glyph-path tests;
- report generation.

Informational checks only:

- tippecanoe path, if added;
- any environment-dependent experiment.

Artifacts:

```text
results/report.json
results/report.md
```

The report should include:

- OS information;
- Node.js version;
- Python version;
- package versions;
- font name, version, source URL, and SHA-256;
- pass/fail/xfail summary;
- generated glyph ranges.

## Follow-up phases

These are intentionally outside the first PR:

- Phase 3: MapLibre actual display page and OS/browser result matrix.
- Phase 4: copy-and-paste tests and PDF-related tests.
- Phase 5: database search/normalization tests and generalization of substitute-character-to-original-Unicode migration patterns.

## Related source material

- GSI announcement: `https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41222.html`
- GSI 33-character PDF: `https://www.gsi.go.jp/common/000279182.pdf`
- MapLibre Style Specification: Glyphs: `https://maplibre.org/maplibre-style-spec/glyphs/`
- Tracking issue: `UNopenGIS/7#956`
