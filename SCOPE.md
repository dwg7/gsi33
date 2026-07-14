# SCOPE.md — gsi33 first implementation PR

This document defines the scope of the first implementation PR for `gsi33`, based on `UNopenGIS/7#956: GSI Plane 2 Kanji Test Set`.

The first PR is intentionally limited to work that can be verified automatically in CI. It combines:

- Phase 1: data-retention tests;
- Phase 2: headless glyph-path tests;
- this `SCOPE.md` declaration.

The merge condition for the first PR is:

```text
required CI checks are green
```

No manual browser, visual, copy-and-paste, PDF, or database verification is required for this PR.

## Purpose

The purpose of this PR is to establish a compact, deterministic regression test baseline for the 33 GSI-published characters used in the GSI Plane 2 Kanji Test Set.

The first PR verifies that the target characters can be preserved as Unicode data and, to the extent possible in headless CI, that the font-to-glyph-PBF path can produce and decode glyphs for the target code points.

The first PR does **not** attempt to validate every downstream usage scenario. It creates the data, tests, CI, and reports needed for reliable follow-up work.

## Included in this PR

### 1. Master data

This PR includes `data/gsi33.json` as the single source of truth for the 33-character test set.

Each record should include at least:

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

Required properties:

- `no`: numeric order in the test set;
- `char`: the literal target character;
- `codepoint`: Unicode code point notation, such as `U+5749`;
- `block`: Unicode block name;
- `plane`: `BMP` or `SIP`;
- `surrogate_pair`: boolean;
- `jis_x_0213`: value from the GSI source material, or `null` if absent;
- `mj`: MJ number;
- `ivs`: `null` unless explicitly specified by the source material;
- `utf16_code_units`: expected JavaScript UTF-16 code-unit length;
- `code_points`: expected Unicode code-point count.

### 2. Test GeoJSON

This PR includes `data/gsi33.geojson`, generated from the master data.

Requirements:

- one GeoJSON feature per character;
- one point geometry per feature;
- `name` or equivalent label property containing the literal character;
- properties sufficient to trace each feature back to `data/gsi33.json`;
- dummy grid coordinates are acceptable.

Real-world place-name coordinates are out of scope for this PR and should be handled in a later issue if needed.

### 3. Phase 1: data-retention tests

This PR includes `test/phase1-retention.test.mjs`.

Phase 1 covers Scenario A: data retention.

The test must verify the following automatically:

1. **UTF-8 round trip**
   - Read and write the master data as UTF-8.
   - Compare all 33 characters by Unicode code-point sequence.
   - Fail if `U+FFFD REPLACEMENT CHARACTER` appears anywhere in the tested data path.

2. **JSON round trip**
   - Confirm that `JSON.parse(JSON.stringify(...))` preserves every character exactly.
   - Confirm that metadata such as code point and MJ number remains associated with the correct character.

3. **GeoJSON round trip**
   - Validate `data/gsi33.geojson` as GeoJSON.
   - Confirm that all label properties survive serialization and parsing.
   - Confirm that each feature maps back to the expected master-data record.

4. **MVT encode/decode**
   - Encode the test GeoJSON to MVT using a deterministic Node.js path, such as `@mapbox/vt-pbf`.
   - Decode using a deterministic decoder, such as `@mapbox/vector-tile`.
   - Confirm that decoded label attributes retain the exact original code-point sequence.

5. **Normalization stability**
   - Apply NFC, NFKC, and NFD to each character.
   - Confirm that no code-point sequence changes.
   - Treat any change as a test failure with diagnostic output.

6. **Surrogate-pair handling**
   - Verify JavaScript `str.length` against `utf16_code_units`.
   - Verify `[...str].length` against `code_points`.
   - Detect unintended splitting, truncation, or miscounting of SIP characters.

### 4. Phase 2: headless glyph-path tests

This PR includes `test/phase2-glyphs.test.mjs` or an equivalent clearly named test entrypoint.

Phase 2 covers only the CI-automatable part of Scenario C:

```text
font -> glyph PBF generation -> PBF decode
```

The test must verify the following automatically:

1. **Font coverage**
   - Obtain IPAmj Mincho in CI.
   - Verify the font file by SHA-256 or another explicit integrity check.
   - Use Python/fontTools or equivalent tooling to confirm that the cmap contains every target code point.

2. **Glyph PBF generation**
   - Generate glyph PBF ranges for the target code points using a path that is intended to handle SIP characters.
   - Treat known BMP-only limitations as explicit findings rather than hidden failures.

3. **Glyph PBF decode**
   - Decode the generated `{range}.pbf` files.
   - Confirm that each target character has a glyph id.
   - Confirm that each target character has non-empty SDF bitmap data or equivalent generated glyph payload.

4. **Expected failures**
   - Use `expected-failures.json` for known tool limitations.
   - Keep CI green only when all failures are either genuine passes or explicitly recorded expected failures.
   - Do not use expected failures to hide unexpected data loss.

### 5. Expected-failures table

This PR includes `expected-failures.json`.

Each expected failure entry should include:

```json
{
  "tool": "tool-name",
  "codePoint": "U+20000",
  "reason": "why this failure is expected",
  "trackingIssue": "https://github.com/..."
}
```

The file exists to make limitations explicit while keeping the first PR mergeable.

### 6. CI workflow

This PR includes `.github/workflows/ci.yml`.

The workflow should run on `ubuntu-latest` and include:

- Node.js setup;
- Python setup where needed for font inspection;
- dependency installation;
- Phase 1 tests;
- Phase 2 tests;
- report generation;
- artifact upload.

Required checks should be deterministic.

### 7. CI reports

This PR produces:

```text
results/report.json
results/report.md
```

The report should include at least:

- OS information;
- Node.js version;
- Python version;
- dependency versions;
- font name;
- font version if available;
- font source URL;
- font SHA-256 or equivalent integrity value;
- pass/fail/xfail summary;
- generated glyph ranges;
- any expected-failure entries used during the run.

## Explicitly excluded from this PR

The following are outside the scope of the first PR.

### Scenario B: OS/browser local-font display matrix

This PR does not test display behavior across operating systems, browsers, installed fonts, or font fallback implementations.

Out of scope examples:

- Windows / Edge local-font behavior;
- macOS / Safari local-font behavior;
- Ubuntu / Firefox local-font behavior;
- Android or iOS browser behavior;
- comparison of standard fonts, IPAmj Mincho, Noto CJK, Yu Gothic, Hiragino, or other font stacks in real browsers.

### Scenario C: actual browser rendering

This PR does not verify actual MapLibre visual output.

Out of scope examples:

- MapLibre GL JS browser display pages as a required verification target;
- screenshot tests;
- visual inspection;
- checking whether a rendered glyph appears as a correct character, tofu, blank, or replacement character in a browser.

The only Scenario C work included in this PR is the headless glyph PBF path defined above.

### Scenario D: copy and paste

This PR does not test copy-and-paste behavior.

Out of scope examples:

- copying labels from a browser;
- clipboard inspection;
- copying text into an editor;
- comparing copied output code points.

### Scenario E: PDF

Scenario E is entirely out of scope for this PR.

This PR does not include:

- PDF generation;
- PDF rendering checks;
- PDF visual inspection;
- PDF text extraction;
- PDF copy-and-paste behavior;
- PDF-related CI jobs;
- PDF-related required checks;
- manual PDF review.

PDF-related work must be handled in a separate follow-up issue and must not be part of the required CI gate for this merge.

### Scenario F: database search and normalization

This PR does not test database behavior.

Out of scope examples:

- database registration;
- exact-match search;
- prefix search;
- full-text search;
- sort order;
- export from database;
- substitute-character search;
- MJ-number-assisted search;
- variant or substitute-character migration tables.

The only Scenario F-related item included in this PR is the Phase 1 normalization-stability check using NFC, NFKC, and NFD.

### Optional tippecanoe path

A tippecanoe-based MVT path may be useful, but it must not be a required check for the first PR.

If included, it must be informational only, because it may depend on external package availability or environment-specific installation behavior.

## Acceptance criteria covered by this PR

This PR is expected to cover the following acceptance criteria:

- all 33 characters can be stored as UTF-8;
- all 33 characters can be serialized as JSON;
- all 33 characters can be represented in GeoJSON;
- all 33 characters can survive the deterministic MVT encode/decode path used in CI;
- data paths do not replace target characters with `U+FFFD`;
- UTF-16 surrogate-pair handling is explicitly tested;
- NFC, NFKC, and NFD do not alter the target code-point sequences;
- the selected font contains cmap entries for all 33 code points;
- the selected glyph-generation path can produce decodable glyph PBFs for the required ranges, except for explicitly recorded expected failures;
- CI emits machine-readable and human-readable reports.

## Acceptance criteria deferred to later issues

The following acceptance criteria are not covered by this PR:

- at least one real browser environment displays all 33 characters correctly;
- OS/browser local-font behavior is recorded;
- glyph fallback behavior is visually classified;
- copy-and-paste preserves code points;
- PDF rendering or text extraction behaves correctly;
- database search, sort, and export behavior is verified;
- substitute-character-to-original-character migration behavior is generalized.

## Required CI gate

The required CI gate for this PR is:

```text
Phase 1 deterministic tests pass
Phase 2 deterministic tests pass or xfail only where explicitly recorded
reports are generated
```

The following must not be required gates:

- manual review;
- browser visual confirmation;
- screenshot approval;
- copy-and-paste checks;
- PDF checks;
- database checks;
- optional tippecanoe checks.

## Definition of done

This PR is done when:

- `SCOPE.md` exists and matches this scope;
- `data/gsi33.json` contains all 33 records;
- `data/gsi33.geojson` contains one feature per record;
- Phase 1 data-retention tests are implemented;
- Phase 2 headless glyph-path tests are implemented;
- `expected-failures.json` exists and is used only for explicit known limitations;
- `.github/workflows/ci.yml` runs the required checks;
- `results/report.json` and `results/report.md` are produced as artifacts;
- required CI checks are green;
- no manual PDF, browser, copy-and-paste, or database verification is required for merge.

## Follow-up issue candidates

After this PR is merged, create or refine follow-up issues for:

1. MapLibre actual browser display page.
2. OS/browser local-font result matrix.
3. Browser copy-and-paste tests.
4. PDF tests outside the first PR.
5. Database search and normalization behavior.
6. Optional tippecanoe path hardening, if useful.
7. Failure classification documentation: data loss, glyph absence, font fallback failure, text extraction failure, and search/normalization failure.
8. Generalization of substitute-character-to-original-Unicode migration patterns.
