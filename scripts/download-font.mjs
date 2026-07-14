// Downloads IPAmj Mincho, verifies its integrity, and extracts the TTF
// used by Phase 2 glyph-path tests. Requires the `unzip` CLI (present on
// ubuntu-latest GitHub Actions runners and typical macOS/Linux dev setups).
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import {
  FONT_DIR,
  FONT_PATH,
  FONT_TTF_ENTRY_NAME,
  FONT_TTF_SHA256,
  FONT_ZIP_SHA256,
  FONT_ZIP_URL,
} from './font-config.mjs';

const execFileAsync = promisify(execFile);

async function sha256(path) {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), 'gsi33-font-'));
  try {
    const zipPath = join(workDir, 'ipamjm.zip');

    console.log(`Downloading ${FONT_ZIP_URL}`);
    const res = await fetch(FONT_ZIP_URL);
    if (!res.ok) {
      throw new Error(`Font download failed: HTTP ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(zipPath, buffer);

    const zipHash = await sha256(zipPath);
    if (zipHash !== FONT_ZIP_SHA256) {
      throw new Error(
        `Font zip SHA-256 mismatch.\n  expected: ${FONT_ZIP_SHA256}\n  actual:   ${zipHash}`,
      );
    }
    console.log(`Verified zip SHA-256: ${zipHash}`);

    await execFileAsync('unzip', ['-o', zipPath, FONT_TTF_ENTRY_NAME, '-d', workDir]);

    const extractedPath = join(workDir, FONT_TTF_ENTRY_NAME);
    const ttfHash = await sha256(extractedPath);
    if (ttfHash !== FONT_TTF_SHA256) {
      throw new Error(
        `Font TTF SHA-256 mismatch.\n  expected: ${FONT_TTF_SHA256}\n  actual:   ${ttfHash}`,
      );
    }
    console.log(`Verified font SHA-256: ${ttfHash}`);

    await mkdir(FONT_DIR, { recursive: true });
    const ttfData = await readFile(extractedPath);
    await writeFile(FONT_PATH, ttfData);
    console.log(`Wrote font to ${FONT_PATH.pathname}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

await main();
