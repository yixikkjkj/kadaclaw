#!/usr/bin/env python3

import argparse
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
ICNS_VARIANTS = [
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
]


def run_command(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def ensure_tool(name: str) -> None:
    if shutil.which(name):
        return
    raise SystemExit(f"missing required tool: {name}")


def read_dimensions(path: Path) -> tuple[int, int]:
    output = run_command(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)])
    width_match = re.search(r"pixelWidth:\s+(\d+)", output)
    height_match = re.search(r"pixelHeight:\s+(\d+)", output)
    if not width_match or not height_match:
        raise SystemExit(f"failed to read image dimensions: {path}")
    return int(width_match.group(1)), int(height_match.group(1))


def create_normalized_source(source: Path, target: Path) -> None:
    width, height = read_dimensions(source)
    if width == height:
        shutil.copyfile(source, target)
        return

    side = max(width, height)
    print(
        f"warning: source image is not square ({width}x{height}); "
        f"normalizing to {side}x{side}"
    )
    run_command(
        [
            "sips",
            "--resampleHeightWidth",
            str(side),
            str(side),
            str(source),
            "--out",
            str(target),
        ]
    )


def create_png(source: Path, size: int, target: Path) -> None:
    run_command(
        [
            "sips",
            "--resampleHeightWidth",
            str(size),
            str(size),
            str(source),
            "--out",
            str(target),
        ]
    )


def build_ico(source: Path, target: Path) -> None:
    payloads: list[tuple[int, bytes]] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        for size in ICO_SIZES:
            png_path = temp_path / f"{size}.png"
            create_png(source, size, png_path)
            payloads.append((size, png_path.read_bytes()))

    header = struct.pack("<HHH", 0, 1, len(payloads))
    directory = bytearray()
    offset = 6 + 16 * len(payloads)
    binary = bytearray()

    for size, data in payloads:
        directory.extend(
            struct.pack(
                "<BBBBHHII",
                0 if size >= 256 else size,
                0 if size >= 256 else size,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        binary.extend(data)
        offset += len(data)

    target.write_bytes(header + directory + binary)


def build_icns(source: Path, target: Path) -> None:
    chunks = bytearray()

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        for icon_type, size in ICNS_VARIANTS:
            png_path = temp_path / f"{icon_type}.png"
            create_png(source, size, png_path)
            data = png_path.read_bytes()
            chunks.extend(icon_type.encode("ascii"))
            chunks.extend(struct.pack(">I", len(data) + 8))
            chunks.extend(data)

    target.write_bytes(b"icns" + struct.pack(">I", len(chunks) + 8) + chunks)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Tauri/macOS/Windows icon assets from a single PNG source."
    )
    parser.add_argument(
        "--source",
        default="src-tauri/icons/icon.png",
        help="source PNG path",
    )
    parser.add_argument(
        "--output-dir",
        default="src-tauri/icons",
        help="directory where icon.ico/icon.icns will be written",
    )
    args = parser.parse_args()

    ensure_tool("sips")
    source = Path(args.source).resolve()
    output_dir = Path(args.output_dir).resolve()
    if not source.exists():
        raise SystemExit(f"source image not found: {source}")

    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as temp_dir:
        square_source = Path(temp_dir) / "square.png"
        create_normalized_source(source, square_source)
        build_ico(square_source, output_dir / "icon.ico")
        build_icns(square_source, output_dir / "icon.icns")

    width, height = read_dimensions(source)
    print(f"generated icon.ico and icon.icns from {source.name} ({width}x{height})")
    if min(width, height) < 512:
        print("warning: source image is smaller than 512px; generated icons will be soft")

    return 0


if __name__ == "__main__":
    sys.exit(main())
