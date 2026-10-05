"""Extend an existing rigged SMPL GLB from 10 to all 300 shape targets."""

from __future__ import annotations

import argparse
import itertools
import json
import struct
from pathlib import Path

import numpy as np

from inspect_smpl_basis import load_smpl_model, unwrap_array


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: Path):
    payload = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<4sII", payload, 0)
    if magic != b"glTF" or version != 2 or total_length != len(payload):
        raise ValueError(f"Invalid GLB header: {path}")

    offset = 12
    chunks = {}
    while offset < len(payload):
        length, chunk_type = struct.unpack_from("<II", payload, offset)
        offset += 8
        chunks[chunk_type] = payload[offset : offset + length]
        offset += length
    document = json.loads(chunks[JSON_CHUNK].decode("utf-8").rstrip(" \0"))
    return document, bytearray(chunks[BIN_CHUNK])


def accessor_array(document, binary, accessor_index):
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    if accessor["componentType"] != 5126 or accessor["type"] != "VEC3":
        raise ValueError("Expected a float32 VEC3 accessor")
    if "byteStride" in view:
        raise ValueError("Interleaved morph accessors are not supported")
    offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"] * 3
    return np.frombuffer(binary, dtype="<f4", count=count, offset=offset).reshape((-1, 3))


def infer_coordinate_transform(source_dirs, existing_targets):
    best = None
    for permutation in itertools.permutations(range(3)):
        permuted = source_dirs[:, permutation, : existing_targets.shape[2]]
        for signs in itertools.product((-1.0, 1.0), repeat=3):
            candidate = permuted * np.asarray(signs)[None, :, None]
            denominator = float(np.sum(candidate * candidate))
            scale = float(np.sum(candidate * existing_targets) / denominator)
            residual = existing_targets - candidate * scale
            relative_rms = float(np.sqrt(np.mean(residual * residual)) / np.sqrt(np.mean(existing_targets * existing_targets)))
            if best is None or relative_rms < best[0]:
                best = (relative_rms, permutation, signs, scale)
    if best[0] > 1e-4:
        raise ValueError(f"Source PKL does not match base GLB (relative RMS {best[0]:.6g})")
    if best[3] < 0:
        best = (best[0], best[1], tuple(-value for value in best[2]), -best[3])
    return best


def append_target(document, binary, values):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    packed = np.asarray(values, dtype="<f4", order="C")
    binary.extend(packed.tobytes())

    view_index = len(document["bufferViews"])
    document["bufferViews"].append({
        "buffer": 0,
        "byteOffset": offset,
        "byteLength": packed.nbytes,
    })
    accessor_index = len(document["accessors"])
    document["accessors"].append({
        "bufferView": view_index,
        "componentType": 5126,
        "count": packed.shape[0],
        "type": "VEC3",
        "min": packed.min(axis=0).astype(float).tolist(),
        "max": packed.max(axis=0).astype(float).tolist(),
    })
    return accessor_index


def write_glb(path: Path, document, binary):
    while len(binary) % 4:
        binary.append(0)
    document["buffers"][0]["byteLength"] = len(binary)
    encoded_json = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded_json += b" " * ((-len(encoded_json)) % 4)
    total_length = 12 + 8 + len(encoded_json) + 8 + len(binary)
    payload = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    payload.extend(struct.pack("<II", len(encoded_json), JSON_CHUNK))
    payload.extend(encoded_json)
    payload.extend(struct.pack("<II", len(binary), BIN_CHUNK))
    payload.extend(binary)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def prepare(source_path: Path, base_path: Path, output_path: Path):
    model = load_smpl_model(source_path)
    shapedirs = unwrap_array(model.get("shapedirs"))
    if shapedirs is None or shapedirs.ndim != 3 or shapedirs.shape[2] != 300:
        raise ValueError(f"Expected shapedirs (*, 3, 300), got {getattr(shapedirs, 'shape', None)}")

    document, binary = read_glb(base_path)
    mesh = document["meshes"][0]
    primitive = mesh["primitives"][0]
    old_targets = primitive.get("targets", [])
    if len(old_targets) != 10:
        raise ValueError(f"Expected 10 existing morph targets, got {len(old_targets)}")
    existing = np.stack(
        [accessor_array(document, binary, target["POSITION"]) for target in old_targets],
        axis=2,
    )
    if existing.shape[:2] != shapedirs.shape[:2]:
        raise ValueError(f"Vertex layout mismatch: PKL {shapedirs.shape[:2]}, GLB {existing.shape[:2]}")

    error, permutation, signs, scale = infer_coordinate_transform(shapedirs, existing)
    transformed = shapedirs[:, permutation, :] * np.asarray(signs)[None, :, None] * scale
    targets = list(old_targets)
    for component in range(len(old_targets), shapedirs.shape[2]):
        targets.append({"POSITION": append_target(document, binary, transformed[:, :, component])})

    primitive["targets"] = targets
    mesh["weights"] = [0.0] * shapedirs.shape[2]
    extras = mesh.setdefault("extras", {})
    extras["targetNames"] = [f"beta{index}" for index in range(shapedirs.shape[2])]
    extras["smplShapeComponents"] = int(shapedirs.shape[2])
    extras["measurementDrivenComponents"] = 10
    document.setdefault("asset", {}).setdefault("extras", {})["smplShapeComponents"] = int(shapedirs.shape[2])
    write_glb(output_path, document, binary)
    return {
        "source": str(source_path),
        "base": str(base_path),
        "output": str(output_path),
        "shape_components": int(shapedirs.shape[2]),
        "vertices": int(shapedirs.shape[0]),
        "coordinate_permutation": list(permutation),
        "coordinate_signs": list(signs),
        "coordinate_scale": scale,
        "relative_rms_first_10": error,
        "output_bytes": output_path.stat().st_size,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.base, args.output), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
