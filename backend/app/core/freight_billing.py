"""Règles de facturation fret partagées (aérien kg ceil, maritime CBM)."""
from __future__ import annotations

import math
from typing import Iterable, List, Optional, Tuple


def physical_cbm(pkg: dict) -> float:
    dims = pkg.get("dimensions") or {}
    l, w, h = float(dims.get("l") or 0), float(dims.get("w") or 0), float(dims.get("h") or 0)
    if l > 0 and w > 0 and h > 0:
        return (l * w * h) / 1_000_000
    return float(pkg.get("volume_cbm") or 0)


def air_chargeable_kg(pkg: dict) -> float:
    """Poids taxable aérien (max réel / volumétrique), avant arrondi."""
    real = float(pkg.get("weight_real") or 0)
    volumetric = float(pkg.get("weight_volumetric") or 0)
    if volumetric <= 0:
        dims = pkg.get("dimensions") or {}
        l, w, h = float(dims.get("l") or 0), float(dims.get("w") or 0), float(dims.get("h") or 0)
        if l > 0 and w > 0 and h > 0:
            volumetric = (l * w * h) / 6000.0
    return max(real, volumetric, 0.0)


def air_billed_kg(pkg: dict) -> float:
    """Kg facturés pour UN colis : ceil(chargeable)."""
    raw = air_chargeable_kg(pkg)
    if raw <= 0:
        return 0.0
    return float(math.ceil(raw))


def air_billed_kg_for_packages(pkgs: Iterable[dict]) -> Tuple[float, float]:
    """
    Kg facturés pour un GROUPE de colis aériens :
    ceil(somme des poids taxables) — pas ceil de chaque colis.

    Ex. 1.3 + 0.7 = 2.0 → 2 kg (et non 2+1=3).
    Retourne (raw_sum, billed_kg).
    """
    raw_sum = 0.0
    for p in pkgs:
        raw_sum += air_chargeable_kg(p)
    if raw_sum <= 0:
        return 0.0, 0.0
    return raw_sum, float(math.ceil(raw_sum))


def distribute_billed_kg(pkgs: List[dict], billed_kg: float) -> List[float]:
    """Répartit les kg facturés au prorata du poids taxable de chaque colis."""
    raws = [air_chargeable_kg(p) for p in pkgs]
    total_raw = sum(raws)
    if billed_kg <= 0 or not pkgs:
        return [0.0] * len(pkgs)
    if total_raw <= 0:
        share = billed_kg / len(pkgs)
        return [share] * len(pkgs)
    return [(r / total_raw) * billed_kg for r in raws]


def sea_billed_cbm(pkg: dict) -> float:
    return physical_cbm(pkg)


def sea_billed_cbm_for_packages(pkgs: Iterable[dict]) -> float:
    return sum(physical_cbm(p) for p in pkgs)
