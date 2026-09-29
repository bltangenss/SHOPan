"""Inventory a supplied dataset without loading pickle files or assuming its schema."""

import argparse
import json
import os
from collections import Counter
from pathlib import Path
from zipfile import ZipFile, is_zipfile


def inspect(path):
    if path.is_dir():
        files = [item for item in path.rglob("*") if item.is_file()]
        records = [(str(item.relative_to(path)).replace("\\", "/"), item.stat().st_size) for item in files]
        source_type = "directory"
    elif is_zipfile(path):
        with ZipFile(path) as archive:
            records = [(item.filename, item.file_size) for item in archive.infolist() if not item.is_dir()]
        source_type = "zip"
    else:
        raise ValueError(f"Expected a directory or ZIP archive: {path}")

    extensions = Counter(Path(name).suffix.lower() or "[none]" for name, _ in records)
    model_files = [name for name, _ in records if name.lower().endswith(".pkl")]
    potential_geometry = [name for name, _ in records if Path(name).suffix.lower() in
                          {".obj", ".ply", ".stl", ".glb", ".gltf", ".fbx", ".off"}]
    tabular = [name for name, _ in records if Path(name).suffix.lower() in
               {".csv", ".tsv", ".parquet", ".json", ".npz", ".npy"}]
    return {
        "source": str(path.resolve()),
        "source_type": source_type,
        "file_count": len(records),
        "total_uncompressed_bytes": sum(size for _, size in records),
        "extensions": dict(sorted(extensions.items())),
        "model_parameter_files": model_files,
        "geometry_files": potential_geometry,
        "potential_tabular_files": tabular,
        "sample_paths": [name for name, _ in records[:50]],
        "independent_subject_count": None,
        "measurements_available": None,
        "garment_fit_labels_available": None,
        "notes": [
            "File count is not a count of independent people or shapes.",
            "Pickle files were inventoried but never deserialized because pickle can execute code.",
            "Subject identity, measurement units, topology, licensing, and training suitability require dataset-specific inspection.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", required=True, type=Path, help="Dataset directory or ZIP archive")
    parser.add_argument("--output", type=Path, help="Write JSON report here")
    args = parser.parse_args()
    if not args.path.exists():
        parser.error(f"Dataset path does not exist: {args.path}")
    report = inspect(args.path)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + os.linesep, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
