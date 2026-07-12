#!/usr/bin/env python3
"""Merge multiple JMeter JTL files into one (same header, concatenated rows)."""
import argparse
import csv
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", help="Input .jtl files")
    parser.add_argument("-o", "--output", required=True, help="Merged output .jtl")
    args = parser.parse_args()

    paths = sorted(Path(p) for p in args.inputs)
    if not paths:
        sys.exit("No input files")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    header = None
    rows = 0
    with out.open("w", newline="") as fout:
        writer = None
        for path in paths:
            if not path.exists():
                print(f"skip missing: {path}", file=sys.stderr)
                continue
            with path.open(newline="") as fin:
                reader = csv.reader(fin)
                file_header = next(reader, None)
                if file_header is None:
                    continue
                if header is None:
                    header = file_header
                    writer = csv.writer(fout)
                    writer.writerow(header)
                for row in reader:
                    writer.writerow(row)
                    rows += 1

    print(f"Merged {len(paths)} files → {out} ({rows} samples)")


if __name__ == "__main__":
    main()
