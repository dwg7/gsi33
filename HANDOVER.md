# HANDOVER.md — gsi33

This file is for future maintainers and AI assistants continuing the `gsi33` implementation.

## Non-negotiable point

**Do not implement PDF checking in the first PR.**

The original issue discussion mentions PDF-related risks, but the implementation plan intentionally excludes PDF checking from the first mergeable PR.

For the first PR:

- do not generate PDFs;
- do not inspect PDFs;
- do not test PDF text extraction;
- do not include PDF checks in CI;
- do not make PDF behavior part of the merge gate.

PDF work can be tracked only as a later follow-up issue.

## Source context

The repository comes from Issue `UNopenGIS/7#956`, `GSI Plane 2 Kanji Test Set`.

The broader issue proposed using 33 GSI-published characters as a practical regression test for Unicode supplementary-plane Japanese place-name characters in web mapping toolchains.

The latest implementation direction is:

> Implement Phase 1, Phase 2, and SCOPE.md as one PR, with all required CI checks passing automatically and no manual reviewer confirmation required.

## Rationale

GSI has announced a change in place-name character handling: some characters formerly represented by substitute characters will be represented by their original Unicode characters.

The 33-character set is useful because it is:

- official and place-name related;
- small enough for regression tests;
- mixed BMP/SIP;
- rich in CJK Extension B and Extension D characters;
- capable of exposing failures in UTF-8, UTF-16 surrogate-pair handling, JSON, GeoJSON, MVT/PBF, glyph generation, and client-side decoding.

The first PR should focus on machine-verifiable data preservation and glyph-path checks, not visual/manual testing.

## First PR target layout

Create this structure:

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

## Data to encode

`data/gsi33.json` is the master.

Each record should include:

- `no`
- `char`
- `codepoint`
- `block`
- `plane`
- `surrogate_pair`
- `jis_x_0213`
- `mj`
- `ivs`
- `utf16_code_units`
- `code_points`

Use the 33 characters pasted in the issue context. The first four are BMP; the remaining 29 are SIP. All 33 have MJ numbers. IVS is unspecified.

`data/gsi33.geojson` should be generated from the same data. Use one point per character. Dummy grid coordinates are acceptable for the first PR.

## Phase 1 scope: data retention

Implement `test/phase1-retention.test.mjs` with Node.js `node --test`.

Test the following:

1. UTF-8 round trip.
2. No `U+FFFD` replacement anywhere.
3. JSON round trip.
4. GeoJSON validation and property preservation.
5. MVT encode/decode using `@mapbox/vt-pbf` and `@mapbox/vector-tile`.
6. NFC/NFKC/NFD normalization stability.
7. UTF-16 code-unit length versus code-point count.

Do not include database tests in Phase 1, except for normalization checks already described above.

## Phase 2 scope: glyph path

Implement `test/phase2-glyphs.test.mjs` or a clearly named equivalent test entrypoint.

The automated path is:

```text
font -> glyph PBF generation -> PBF decode
```

Expected checks:

1. Download IPAmj Mincho in CI.
2. Verify SHA-256.
3. Use Python/fontTools to check cmap coverage of all 33 code points.
4. Generate glyph PBF ranges for the target code points.
5. Decode generated PBFs.
6. Assert non-empty glyph id and SDF bitmap for each target character.
7. Convert known tool limitations into explicit xfail records.

Do not test real browser rendering in this PR.

## expected-failures.json policy

Use `expected-failures.json` to keep known limitations visible while allowing CI to remain green.

Each xfail record should include:

```json
{
  "tool": "tool-name",
  "codePoint": "U+20000",
  "reason": "why this is expected to fail",
  "trackingIssue": "https://github.com/..."
}
```

Typical use:

- BMP-only glyph-generation limitation;
- tool-specific SIP handling limitation;
- known decoder limitation under a specific path.

Do not use xfail to hide unexpected data loss.

## SCOPE.md must say

`SCOPE.md` should be short and strict.

It must state that the first PR includes:

- Scenario A: data-retention tests;
- Scenario C: headless, machine-verifiable glyph path only;
- Scenario F: normalization stability only;
- CI report generation.

It must state that the first PR excludes:

- Scenario B: OS/browser local-font display matrix;
- Scenario C: actual browser display;
- Scenario D: copy and paste;
- Scenario E: PDF;
- Scenario F: database search, except normalization stability.

Recommended PDF exclusion wording:

```markdown
Scenario E, including PDF generation, PDF rendering, PDF text extraction, and PDF copy/paste behavior, is out of scope for this PR. PDF-related work must be handled in a separate follow-up issue and must not be part of the required CI gate for this merge.
```

## CI design

Use one GitHub Actions workflow on `ubuntu-latest`.

Required jobs:

- Phase 1 deterministic tests;
- Phase 2 deterministic tests;
- report generation.

Optional jobs:

- tippecanoe path;
- other environment-dependent checks.

Artifacts:

```text
results/report.json
results/report.md
```

Report contents:

- OS;
- Node.js version;
- Python version;
- dependency versions;
- font name, version, URL, SHA-256;
- pass/fail/xfail summary;
- generated glyph PBF ranges.

## What not to do in the first PR

Do not add:

- MapLibre visual display page as a required verification target;
- browser screenshot testing;
- manual OS/browser matrix;
- copy-and-paste tests;
- PDF tests;
- database search tests;
- required tippecanoe checks.

These belong to later issues.

## Suggested follow-up issues

After the initial repository is created, create issues such as:

1. `Implement Phase 1 data-retention tests`
2. `Implement Phase 2 glyph PBF path tests`
3. `Create SCOPE.md with explicit first-PR exclusions`
4. `Add CI report artifacts`
5. `Track optional tippecanoe MVT path`
6. `Follow-up: MapLibre browser display matrix`
7. `Follow-up: copy-and-paste tests`
8. `Follow-up: PDF tests outside first PR`
9. `Follow-up: database search and normalization behavior`
10. `Document failure classification: data loss vs glyph absence vs font fallback failure`

## Bootstrap definition of done

The first PR is ready when:

- `SCOPE.md` exists and explicitly excludes PDF checks;
- `data/gsi33.json` exists and contains all 33 records;
- `data/gsi33.geojson` exists with one point per character;
- Phase 1 tests pass;
- Phase 2 tests pass or xfail only where explicitly recorded;
- `expected-failures.json` exists;
- CI emits `results/report.json` and `results/report.md`;
- required checks are green;
- no manual PDF, browser, copy-paste, or visual confirmation is required.

## Maintainer reminder

Keep the first PR small, deterministic, and mergeable. The value is not to solve every display and document-output problem at once. The value is to establish a reliable test set and CI baseline for Unicode supplementary-plane place-name characters.
