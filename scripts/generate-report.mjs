// Generates results/report.json and results/report.md summarizing a
// gsi33 CI run: environment, dependency and font versions, Phase 1/2
// pass-fail-xfail counts, and generated glyph PBF ranges.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { platform, release, arch } from 'node:os';
import { FONT_NAME, FONT_PATH, FONT_TTF_SHA256, FONT_VERSION, FONT_ZIP_URL } from './font-config.mjs';

const execFileAsync = promisify(execFile);

const records = JSON.parse(
  await readFile(new URL('../data/gsi33.json', import.meta.url), 'utf8'),
);
const expectedFailures = JSON.parse(
  await readFile(new URL('../expected-failures.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

async function fontHash() {
  try {
    const data = await readFile(FONT_PATH);
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

async function pythonVersion() {
  try {
    const { stdout, stderr } = await execFileAsync('python3', ['--version']);
    return (stdout || stderr).trim();
  } catch {
    return 'unavailable';
  }
}

async function installedVersion(pkgName) {
  try {
    const pkgJson = JSON.parse(
      await readFile(
        new URL(`../node_modules/${pkgName}/package.json`, import.meta.url),
        'utf8',
      ),
    );
    return pkgJson.version;
  } catch {
    return 'not installed';
  }
}

function parseTap(tap) {
  const summary = { pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0, tests: 0 };
  for (const key of Object.keys(summary)) {
    const match = tap.match(new RegExp(`^# ${key} (\\d+)$`, 'm'));
    if (match) summary[key] = Number(match[1]);
  }
  return summary;
}

async function runTests(pattern) {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['--test', '--test-reporter=tap', '--test-reporter-destination=stdout', pattern],
      { cwd: new URL('..', import.meta.url).pathname, maxBuffer: 10 * 1024 * 1024 },
    );
    return parseTap(stdout);
  } catch (err) {
    // node --test exits non-zero when any subtest fails; stdout still has TAP output.
    return parseTap(err.stdout || '');
  }
}

function rangeFor(codepoint) {
  const start = Math.floor(codepoint / 256) * 256;
  return [start, start + 255];
}

const bmpRanges = records
  .filter((r) => r.plane === 'BMP')
  .map((r) => rangeFor(parseInt(r.codepoint.replace('U+', ''), 16)))
  .map(([start, end]) => `${start}-${end}`);
const uniqueBmpRanges = [...new Set(bmpRanges)];

const [phase1, phase2, pyVersion, hash] = await Promise.all([
  runTests('test/phase1-retention.test.mjs'),
  runTests('test/phase2-glyphs.test.mjs'),
  pythonVersion(),
  fontHash(),
]);

const xfailByTool = {};
for (const entry of expectedFailures) {
  xfailByTool[entry.tool] = (xfailByTool[entry.tool] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  environment: {
    os: `${platform()} ${release()} (${arch()})`,
    node: process.version,
    python: pyVersion,
  },
  dependencies: {
    'vt-pbf': await installedVersion('vt-pbf'),
    '@mapbox/vector-tile': await installedVersion('@mapbox/vector-tile'),
    pbf: await installedVersion('pbf'),
    fontnik: await installedVersion('fontnik'),
    '@mapbox/glyph-pbf-composite': await installedVersion('@mapbox/glyph-pbf-composite'),
  },
  font: {
    name: FONT_NAME,
    version: FONT_VERSION,
    sourceUrl: FONT_ZIP_URL,
    expectedSha256: FONT_TTF_SHA256,
    actualSha256: hash,
    verified: hash === FONT_TTF_SHA256,
  },
  phase1,
  phase2,
  expectedFailures: {
    total: expectedFailures.length,
    byTool: xfailByTool,
  },
  glyphRanges: {
    bmp: uniqueBmpRanges,
  },
};

await mkdir(new URL('../results/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../results/report.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
  'utf8',
);

const md = `# gsi33 CI Report

Generated: ${report.generatedAt}

## Environment

- OS: ${report.environment.os}
- Node.js: ${report.environment.node}
- Python: ${report.environment.python}

## Dependencies

${Object.entries(report.dependencies)
  .map(([name, version]) => `- \`${name}\`: ${version}`)
  .join('\n')}

## Font

- Name: ${report.font.name}
- Version: ${report.font.version}
- Source: ${report.font.sourceUrl}
- Expected SHA-256: \`${report.font.expectedSha256}\`
- Actual SHA-256: \`${report.font.actualSha256 ?? 'font not found'}\`
- Verified: ${report.font.verified ? 'yes' : 'no'}

## Phase 1 (data retention)

- pass: ${phase1.pass}
- fail: ${phase1.fail}
- skipped: ${phase1.skipped}

## Phase 2 (glyph path)

- pass: ${phase2.pass}
- fail: ${phase2.fail}
- skipped: ${phase2.skipped}

## Expected failures (${report.expectedFailures.total} total)

${Object.entries(report.expectedFailures.byTool)
  .map(([tool, count]) => `- \`${tool}\`: ${count}`)
  .join('\n')}

## Generated glyph PBF ranges (BMP)

${report.glyphRanges.bmp.map((r) => `- ${r}`).join('\n')}
`;

await writeFile(new URL('../results/report.md', import.meta.url), md, 'utf8');

console.log('Wrote results/report.json and results/report.md');
console.log(`Phase 1: ${phase1.pass} pass / ${phase1.fail} fail`);
console.log(`Phase 2: ${phase2.pass} pass / ${phase2.fail} fail`);

if (phase1.fail > 0 || phase2.fail > 0) {
  process.exitCode = 1;
}
