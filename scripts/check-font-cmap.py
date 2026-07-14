#!/usr/bin/env python3
"""Phase 2 font-coverage check: confirm a font's cmap contains every
target code point from data/gsi33.json. Prints a JSON report to stdout
and exits non-zero if any code point is missing."""
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

REPO_ROOT = Path(__file__).resolve().parent.parent


def main():
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <font-path>", file=sys.stderr)
        return 2

    font_path = Path(sys.argv[1])
    records = json.loads((REPO_ROOT / "data" / "gsi33.json").read_text(encoding="utf-8"))

    font = TTFont(str(font_path), lazy=True)
    cmap = font.getBestCmap()

    covered = []
    missing = []
    for record in records:
        codepoint = int(record["codepoint"].removeprefix("U+"), 16)
        if codepoint in cmap:
            covered.append(record["codepoint"])
        else:
            missing.append(record["codepoint"])

    report = {
        "font": str(font_path),
        "total": len(records),
        "covered": covered,
        "missing": missing,
    }
    print(json.dumps(report, indent=2))

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
