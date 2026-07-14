// Shared font metadata for Phase 2 glyph-path tests, the download script,
// and CI report generation.
export const FONT_NAME = 'IPAmj Mincho';
export const FONT_VERSION = '006.01';
export const FONT_ZIP_URL =
  'https://dforest.watch.impress.co.jp/library/i/ipamjfont/10750/ipamjm00601.zip';
export const FONT_ZIP_SHA256 =
  '35494e0f2896f38b3f7369a8421a895cea6440a42c0a66ac95eab47d6ed25b68';
export const FONT_TTF_SHA256 =
  'a3e84f495f3c388db7a1473bf1985c1c076d0c814100f10a027ca6853eb1e8cb';
export const FONT_TTF_ENTRY_NAME = 'ipamjm.ttf';
export const FONT_DIR = new URL('../fonts/', import.meta.url);
export const FONT_PATH = new URL('ipamjm.ttf', FONT_DIR);
