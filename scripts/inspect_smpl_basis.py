"""Inspect SMPL pickle metadata without executing arbitrary pickle globals."""

from __future__ import annotations

import argparse
import builtins
import copyreg
import hashlib
import json
import pickle
import warnings
from pathlib import Path

import numpy as np
from numpy._core.multiarray import _reconstruct
from scipy.sparse import csc_matrix


class ChStub:
    """Minimal data holder for the chumpy.Ch state stored in SMPL releases."""


class RestrictedSMPLUnpickler(pickle.Unpickler):
    ALLOWED = {
        ("copy_reg", "_reconstructor"): copyreg._reconstructor,
        ("copyreg", "_reconstructor"): copyreg._reconstructor,
        ("__builtin__", "object"): object,
        ("builtins", "object"): object,
        ("__builtin__", "set"): builtins.set,
        ("builtins", "set"): builtins.set,
        ("numpy.core.multiarray", "_reconstruct"): _reconstruct,
        ("numpy", "ndarray"): np.ndarray,
        ("numpy", "dtype"): np.dtype,
        ("scipy.sparse.csc", "csc_matrix"): csc_matrix,
        ("scipy.sparse._csc", "csc_matrix"): csc_matrix,
        ("chumpy.ch", "Ch"): ChStub,
    }

    def find_class(self, module: str, name: str):
        try:
            return self.ALLOWED[(module, name)]
        except KeyError as error:
            raise pickle.UnpicklingError(f"Blocked pickle global: {module}.{name}") from error


def unwrap_array(value):
    if isinstance(value, np.ndarray):
        return value
    if isinstance(value, ChStub):
        return value.__dict__.get("x")
    return None


def sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_smpl_model(path: Path):
    with path.open("rb") as stream:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=np.exceptions.VisibleDeprecationWarning)
            return RestrictedSMPLUnpickler(stream, encoding="latin1").load()


def inspect_model(path: Path):
    model = load_smpl_model(path)

    shapedirs = unwrap_array(model.get("shapedirs"))
    posedirs = unwrap_array(model.get("posedirs"))
    vertices = unwrap_array(model.get("v_template"))
    faces = unwrap_array(model.get("f"))
    if shapedirs is None:
        raise ValueError(f"No readable shapedirs array in {path}")

    return {
        "file": str(path.resolve()),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "shapedirs": list(shapedirs.shape),
        "shape_components": int(shapedirs.shape[-1]),
        "posedirs": list(posedirs.shape) if posedirs is not None else None,
        "template_vertices": list(vertices.shape) if vertices is not None else None,
        "faces": list(faces.shape) if faces is not None else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = {"models": [inspect_model(path) for path in args.paths]}
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
