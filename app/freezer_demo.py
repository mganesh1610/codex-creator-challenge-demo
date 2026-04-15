from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

FREEZER_BLUEPRINTS: list[dict[str, Any]] = [
    {
        "freezer_id": "FZR-A-101",
        "building_name": "North Campus",
        "zone": "Respiratory Core",
        "name": "Serum Archive Bay 01",
        "specimen_focus": "Serum / plasma",
        "study_codes": ["RESP", "LONG"],
        "capacity_vials": 4800,
        "fill_ratio": 0.78,
        "rack": "A1-R02",
        "backup_freezer": "FZR-B-202",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "warning_high",
        "trend_bias": 0.18,
        "age_minutes": 12,
        "baseline_offset": 0.2,
    },
    {
        "freezer_id": "FZR-A-104",
        "building_name": "North Campus",
        "zone": "Immune Cell Bank",
        "name": "PBMC Cryobank Rack 4",
        "specimen_focus": "PBMC",
        "study_codes": ["IMM"],
        "capacity_vials": 5600,
        "fill_ratio": 0.64,
        "rack": "A2-R04",
        "backup_freezer": "FZR-C-303",
        "low_limit": -185.0,
        "high_limit": -150.0,
        "scenario": "critical_low",
        "trend_bias": -0.45,
        "age_minutes": 9,
        "baseline_offset": 0.0,
    },
    {
        "freezer_id": "FZR-A-107",
        "building_name": "North Campus",
        "zone": "Clinical Intake",
        "name": "Short-Hold Intake Freezer",
        "specimen_focus": "Daily intake",
        "study_codes": ["RESP", "IMM"],
        "capacity_vials": 2100,
        "fill_ratio": 0.46,
        "rack": "A3-R01",
        "backup_freezer": "FZR-A-111",
        "low_limit": -32.0,
        "high_limit": -18.0,
        "scenario": "normal",
        "trend_bias": 0.04,
        "age_minutes": 6,
        "baseline_offset": -0.3,
    },
    {
        "freezer_id": "FZR-A-111",
        "building_name": "North Campus",
        "zone": "Clinical Intake",
        "name": "Overflow Intake Cabinet",
        "specimen_focus": "Short-term aliquots",
        "study_codes": ["RESP"],
        "capacity_vials": 1950,
        "fill_ratio": 0.29,
        "rack": "A3-R05",
        "backup_freezer": "FZR-B-205",
        "low_limit": -32.0,
        "high_limit": -18.0,
        "scenario": "normal",
        "trend_bias": -0.02,
        "age_minutes": 11,
        "baseline_offset": 0.6,
    },
    {
        "freezer_id": "FZR-B-202",
        "building_name": "Riverfront Center",
        "zone": "Longitudinal Vault",
        "name": "Recovery Cohort Vault",
        "specimen_focus": "Longitudinal serum",
        "study_codes": ["LONG"],
        "capacity_vials": 6200,
        "fill_ratio": 0.83,
        "rack": "B1-R07",
        "backup_freezer": "FZR-C-301",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "stale",
        "trend_bias": 0.05,
        "age_minutes": 146,
        "baseline_offset": 0.0,
    },
    {
        "freezer_id": "FZR-B-205",
        "building_name": "Riverfront Center",
        "zone": "Longitudinal Vault",
        "name": "Follow-up Aliquot Reserve",
        "specimen_focus": "Plasma / serum",
        "study_codes": ["LONG", "RESP"],
        "capacity_vials": 5400,
        "fill_ratio": 0.57,
        "rack": "B1-R10",
        "backup_freezer": "FZR-B-202",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "warning_low",
        "trend_bias": -0.12,
        "age_minutes": 7,
        "baseline_offset": 0.0,
    },
    {
        "freezer_id": "FZR-B-208",
        "building_name": "Riverfront Center",
        "zone": "Genomics Annex",
        "name": "DNA Recovery Block",
        "specimen_focus": "DNA / buffy coat",
        "study_codes": ["IMM", "LONG"],
        "capacity_vials": 3900,
        "fill_ratio": 0.52,
        "rack": "B2-R03",
        "backup_freezer": "FZR-C-305",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "critical_high",
        "trend_bias": 0.31,
        "age_minutes": 5,
        "baseline_offset": 0.1,
    },
    {
        "freezer_id": "FZR-B-212",
        "building_name": "Riverfront Center",
        "zone": "Genomics Annex",
        "name": "RNA Stabilization Hold",
        "specimen_focus": "RNA backup plates",
        "study_codes": ["IMM"],
        "capacity_vials": 1600,
        "fill_ratio": 0.38,
        "rack": "B2-R09",
        "backup_freezer": "FZR-C-305",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "normal",
        "trend_bias": -0.03,
        "age_minutes": 8,
        "baseline_offset": -0.5,
    },
    {
        "freezer_id": "FZR-C-301",
        "building_name": "West Annex",
        "zone": "Pathology Support",
        "name": "Manual Review Hold",
        "specimen_focus": "Pathology reserve",
        "study_codes": ["RESP", "IMM"],
        "capacity_vials": 2800,
        "fill_ratio": 0.41,
        "rack": "C1-R01",
        "backup_freezer": "FZR-C-303",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "no_feed",
        "trend_bias": 0.0,
        "age_minutes": 0,
        "baseline_offset": 0.0,
    },
    {
        "freezer_id": "FZR-C-303",
        "building_name": "West Annex",
        "zone": "Pathology Support",
        "name": "Tissue Reference Freezer",
        "specimen_focus": "Tissue blocks",
        "study_codes": ["IMM", "LONG"],
        "capacity_vials": 3500,
        "fill_ratio": 0.72,
        "rack": "C1-R04",
        "backup_freezer": "FZR-A-104",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "normal",
        "trend_bias": 0.03,
        "age_minutes": 10,
        "baseline_offset": 0.4,
    },
    {
        "freezer_id": "FZR-C-305",
        "building_name": "West Annex",
        "zone": "Pathology Support",
        "name": "Whole Blood Reference Bank",
        "specimen_focus": "Whole blood",
        "study_codes": ["RESP", "LONG"],
        "capacity_vials": 4100,
        "fill_ratio": 0.61,
        "rack": "C1-R08",
        "backup_freezer": "FZR-B-208",
        "low_limit": -84.0,
        "high_limit": -76.0,
        "scenario": "normal",
        "trend_bias": -0.05,
        "age_minutes": 6,
        "baseline_offset": -0.1,
    },
    {
        "freezer_id": "FZR-C-309",
        "building_name": "West Annex",
        "zone": "Distribution Prep",
        "name": "Shipment Staging Freezer",
        "specimen_focus": "Outgoing transfers",
        "study_codes": ["RESP", "IMM", "LONG"],
        "capacity_vials": 2400,
        "fill_ratio": 0.34,
        "rack": "C2-R02",
        "backup_freezer": "FZR-B-205",
        "low_limit": -32.0,
        "high_limit": -18.0,
        "scenario": "normal",
        "trend_bias": 0.07,
        "age_minutes": 14,
        "baseline_offset": -0.2,
    },
]

STALE_AFTER_MINUTES = 90
WARNING_BUFFER_RATIO = 0.14
STATUS_PRIORITY = {
    "critical_high": 0,
    "critical_low": 0,
    "warning_high": 1,
    "warning_low": 1,
    "stale": 2,
    "normal": 3,
    "no_feed": 4,
    "no_data": 5,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(second=0, microsecond=0)


def _isoformat(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def _warning_buffer(low_limit: float, high_limit: float) -> float:
    span = max(high_limit - low_limit, 0.0)
    return max(round(span * WARNING_BUFFER_RATIO, 2), 0.75)


def _scenario_current_reading(profile: dict[str, Any]) -> float | None:
    if profile["scenario"] == "no_feed":
        return None

    low_limit = float(profile["low_limit"])
    high_limit = float(profile["high_limit"])
    midpoint = (low_limit + high_limit) / 2
    warning_buffer = _warning_buffer(low_limit, high_limit)
    warning_offset = max(round(warning_buffer * 0.45, 2), 0.4)
    baseline_offset = float(profile.get("baseline_offset", 0.0))

    if profile["scenario"] == "critical_high":
        return round(high_limit + 3.2 + baseline_offset, 2)
    if profile["scenario"] == "critical_low":
        return round(low_limit - 3.6 + baseline_offset, 2)
    if profile["scenario"] == "warning_high":
        return round(high_limit - warning_offset + baseline_offset, 2)
    if profile["scenario"] == "warning_low":
        return round(low_limit + warning_offset + baseline_offset, 2)
    if profile["scenario"] == "stale":
        return round(midpoint + 0.5 + baseline_offset, 2)
    return round(midpoint + baseline_offset, 2)


def _build_status(
    reading: float | None,
    low_limit: float,
    high_limit: float,
    timestamp: datetime | None,
    telemetry_available: bool = True,
) -> dict[str, Any]:
    if not telemetry_available:
        return {
            "status": "no_feed",
            "label": "Manual review",
            "severity": 1,
            "age_minutes": None,
            "status_reason": "Sensor feed is offline and the unit is currently under manual review.",
            "anomaly_score": 0,
        }

    now = _utc_now()
    age_minutes = round((now - timestamp).total_seconds() / 60, 1) if timestamp else None
    warning_buffer = _warning_buffer(low_limit, high_limit)

    if reading is None or timestamp is None:
        return {
            "status": "no_data",
            "label": "No data",
            "severity": 2,
            "age_minutes": age_minutes,
            "status_reason": "No current reading is available for this unit.",
            "anomaly_score": 0,
        }
    if age_minutes is not None and age_minutes > STALE_AFTER_MINUTES:
        return {
            "status": "stale",
            "label": "Stale",
            "severity": 2,
            "age_minutes": age_minutes,
            "status_reason": f"Latest sensor update is {age_minutes:.0f} minutes old.",
            "anomaly_score": min(round(age_minutes), 1000),
        }
    if reading < low_limit:
        distance = abs(reading - low_limit)
        return {
            "status": "critical_low",
            "label": "Low alarm",
            "severity": 4,
            "age_minutes": age_minutes,
            "status_reason": f"{distance:.1f} C below the lower threshold.",
            "anomaly_score": round(distance * 10, 1),
        }
    if reading > high_limit:
        distance = abs(reading - high_limit)
        return {
            "status": "critical_high",
            "label": "High alarm",
            "severity": 4,
            "age_minutes": age_minutes,
            "status_reason": f"{distance:.1f} C above the upper threshold.",
            "anomaly_score": round(distance * 10, 1),
        }
    if reading <= low_limit + warning_buffer:
        return {
            "status": "warning_low",
            "label": "Near low",
            "severity": 3,
            "age_minutes": age_minutes,
            "status_reason": "Temperature is approaching the lower threshold band.",
            "anomaly_score": round(max((low_limit + warning_buffer) - reading, 0) * 4, 1),
        }
    if reading >= high_limit - warning_buffer:
        return {
            "status": "warning_high",
            "label": "Near high",
            "severity": 3,
            "age_minutes": age_minutes,
            "status_reason": "Temperature is approaching the upper threshold band.",
            "anomaly_score": round(max(reading - (high_limit - warning_buffer), 0) * 4, 1),
        }
    return {
        "status": "normal",
        "label": "Normal",
        "severity": 0,
        "age_minutes": age_minutes,
        "status_reason": "Temperature is holding inside the configured operating band.",
        "anomaly_score": 0,
    }


def _build_history(profile: dict[str, Any], points: int = 36) -> list[dict[str, Any]]:
    if profile["scenario"] == "no_feed":
        return []

    total_points = max(12, min(points, 168))
    low_limit = float(profile["low_limit"])
    high_limit = float(profile["high_limit"])
    current_reading = _scenario_current_reading(profile)
    if current_reading is None:
        return []

    trend_bias = float(profile.get("trend_bias", 0.0))
    wobble = float(profile.get("wobble", 0.18))
    latest_timestamp = _utc_now() - timedelta(minutes=float(profile.get("age_minutes", 8)))
    history: list[dict[str, Any]] = []

    for index in range(total_points):
        points_from_latest = total_points - index - 1
        oscillation = ((index % 6) - 2.5) * wobble
        reading = round(current_reading - (trend_bias * points_from_latest) + oscillation, 2)
        timestamp = latest_timestamp - timedelta(minutes=45 * points_from_latest)
        point_status = _build_status(reading, low_limit, high_limit, timestamp, telemetry_available=True)
        history.append(
            {
                "timestamp": _isoformat(timestamp),
                "reading": reading,
                "status": point_status["status"],
                "status_label": point_status["label"],
            }
        )

    return history


def _classify_trend(history: list[dict[str, Any]]) -> str:
    readings = [item["reading"] for item in history if item.get("reading") is not None]
    if len(readings) < 2:
        return "steady"
    delta = readings[-1] - readings[0]
    if delta >= 1.2:
        return "rising"
    if delta <= -1.2:
        return "falling"
    return "steady"


def _build_record(profile: dict[str, Any], history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    freezer_history = history if history is not None else _build_history(profile)
    latest_point = freezer_history[-1] if freezer_history else None
    telemetry_available = profile["scenario"] != "no_feed"
    low_limit = float(profile["low_limit"])
    high_limit = float(profile["high_limit"])
    timestamp = None
    if latest_point and latest_point.get("timestamp"):
        timestamp = datetime.fromisoformat(str(latest_point["timestamp"]).replace("Z", "+00:00"))

    status = _build_status(
        latest_point.get("reading") if latest_point else None,
        low_limit,
        high_limit,
        timestamp,
        telemetry_available=telemetry_available,
    )
    capacity_vials = int(profile["capacity_vials"])
    fill_ratio = float(profile["fill_ratio"])

    return {
        "freezer_id": profile["freezer_id"],
        "display_id": profile["freezer_id"],
        "building_name": profile["building_name"],
        "zone": profile["zone"],
        "name": profile["name"],
        "specimen_focus": profile["specimen_focus"],
        "study_codes": list(profile["study_codes"]),
        "capacity_vials": capacity_vials,
        "occupied_vials": int(round(capacity_vials * fill_ratio)),
        "fill_ratio": round(fill_ratio, 2),
        "rack": profile["rack"],
        "backup_freezer": profile["backup_freezer"],
        "units": "Deg. C",
        "reading": latest_point.get("reading") if latest_point else None,
        "low_limit": low_limit,
        "high_limit": high_limit,
        "range_span": round(high_limit - low_limit, 2),
        "timestamp": latest_point.get("timestamp") if latest_point else None,
        "status": status["status"],
        "status_label": status["label"],
        "status_reason": status["status_reason"],
        "risk_rank": STATUS_PRIORITY.get(status["status"], 6),
        "severity": status["severity"],
        "age_minutes": status["age_minutes"],
        "anomaly_score": status["anomaly_score"],
        "trend": _classify_trend(freezer_history),
        "telemetry_available": telemetry_available,
        "monitoring_mode": "Automated monitoring" if telemetry_available else "Manual review",
    }


def _sort_key(record: dict[str, Any]) -> Any:
    return (
        record.get("risk_rank", 6),
        -(record.get("anomaly_score") or 0),
        -(record.get("age_minutes") or -1),
        record["building_name"],
        record["display_id"],
    )


def build_freezer_dashboard_payload() -> dict[str, Any]:
    freezers = [_build_record(profile) for profile in FREEZER_BLUEPRINTS]
    freezers.sort(key=_sort_key)

    status_counts = Counter(item["status"] for item in freezers)
    alerts = [
        {
            "freezer_id": item["freezer_id"],
            "display_id": item["display_id"],
            "building_name": item["building_name"],
            "zone": item["zone"],
            "name": item["name"],
            "specimen_focus": item["specimen_focus"],
            "reading": item["reading"],
            "units": item["units"],
            "low_limit": item["low_limit"],
            "high_limit": item["high_limit"],
            "status": item["status"],
            "status_label": item["status_label"],
            "status_reason": item["status_reason"],
            "age_minutes": item["age_minutes"],
            "severity": item["severity"],
        }
        for item in freezers
        if item["severity"] > 0
    ][:12]

    building_counts = Counter(item["building_name"] for item in freezers)
    zone_counts = Counter(item["zone"] for item in freezers)

    return {
        "generated_at": _isoformat(_utc_now()),
        "summary": {
            "total": len(freezers),
            "critical": status_counts["critical_low"] + status_counts["critical_high"],
            "warning": status_counts["warning_low"] + status_counts["warning_high"],
            "stale": status_counts["stale"],
            "normal": status_counts["normal"],
            "no_feed": status_counts["no_feed"],
            "no_data": status_counts["no_data"],
        },
        "freezers": freezers,
        "alerts": alerts,
        "buildings": [{"building": building, "count": count} for building, count in building_counts.most_common()],
        "zones": [{"zone": zone, "count": count} for zone, count in zone_counts.most_common()],
        "study_codes": sorted({code for item in freezers for code in item["study_codes"]}),
    }


def build_freezer_detail_payload(freezer_id: str, limit: int = 48) -> dict[str, Any]:
    profile = next((item for item in FREEZER_BLUEPRINTS if item["freezer_id"] == freezer_id), None)
    if profile is None:
        raise KeyError(freezer_id)

    history = _build_history(profile, points=limit)
    record = _build_record(profile, history)
    return {
        "generated_at": _isoformat(_utc_now()),
        "freezer": {
            **record,
            "details": {
                "specimen_focus": profile["specimen_focus"],
                "study_codes": list(profile["study_codes"]),
                "capacity_vials": profile["capacity_vials"],
                "fill_ratio": record["fill_ratio"],
                "occupied_vials": record["occupied_vials"],
                "rack": profile["rack"],
                "backup_freezer": profile["backup_freezer"],
                "monitoring_mode": record["monitoring_mode"],
            },
            "history_count": len(history),
        },
        "history": history,
    }


def build_freezer_overview() -> dict[str, Any]:
    payload = build_freezer_dashboard_payload()
    summary = payload["summary"]
    inventory_total = sum(item["occupied_vials"] for item in payload["freezers"])
    capacity_total = sum(item["capacity_vials"] for item in payload["freezers"])
    at_risk_inventory = sum(item["occupied_vials"] for item in payload["freezers"] if item["severity"] > 0)
    daily_sensor_checks = len(payload["freezers"]) * 96
    fill_percentage = round((inventory_total / max(capacity_total, 1)) * 100)
    overview_rows = [
        {
            **item,
            "fill_percentage": round(item["fill_ratio"] * 100),
        }
        for item in payload["freezers"][:8]
    ]

    return {
        "metrics": [
            {
                "label": "Protected Vials",
                "value": f"{inventory_total:,}",
                "detail": "Current inventory represented across the monitored freezer network.",
            },
            {
                "label": "Capacity Footprint",
                "value": f"{capacity_total:,}",
                "detail": "Total vial capacity currently modeled across monitored storage units.",
            },
            {
                "label": "At-Risk Inventory",
                "value": f"{at_risk_inventory:,}",
                "detail": "Protected vials currently sitting inside alarm, warning, or stale-response units.",
            },
            {
                "label": "Daily Sensor Checks",
                "value": f"{daily_sensor_checks:,}",
                "detail": "15-minute temperature checks expected across the storage wall each day.",
            },
        ],
        "alerts": payload["alerts"][:6],
        "preview_units": payload["freezers"][:5],
        "overview_rows": overview_rows,
        "study_codes": payload["study_codes"],
        "generated_at": payload["generated_at"],
        "summary": summary,
        "inventory_total": inventory_total,
        "inventory_total_display": f"{inventory_total:,}",
        "capacity_total": capacity_total,
        "capacity_total_display": f"{capacity_total:,}",
        "fill_percentage": fill_percentage,
        "summary_line": f"{summary['critical'] + summary['warning'] + summary['stale']} units currently need response across {len(payload['buildings'])} storage locations while protecting {inventory_total:,} active vials.",
    }
