from __future__ import annotations

import json
import re
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openpyxl import Workbook
from pydantic import BaseModel, Field

from .config import ROOT_DIR, get_settings

settings = get_settings()
app = FastAPI(title=settings.app_title)
app.mount("/static", StaticFiles(directory=ROOT_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(ROOT_DIR / "templates"))

DEFAULT_UPLOAD_MODE = "kept"
UPLOAD_MODES = {
    "kept": {"code": "RETAINED", "label": "Retained Uploads", "sheet": "Retained Intake", "keywords": ["retained", "kept"]},
    "sent": {"code": "SHARED", "label": "Shared Uploads", "sheet": "Shared Intake", "keywords": ["shared", "sent"]},
}
FIELD_CATALOG = [
    {"key": "patient_id", "label": "Patient ID", "category": "Registry"},
    {"key": "visit_number", "label": "Visit Number", "category": "Registry"},
    {"key": "study_code", "label": "Program", "category": "Program"},
    {"key": "phase_code", "label": "Phase", "category": "Registry"},
    {"key": "site_name", "label": "Collection Site", "category": "Site"},
    {"key": "sample_barcode", "label": "Sample Barcode", "category": "Inventory"},
    {"key": "sample_type", "label": "Sample Type", "category": "Inventory"},
    {"key": "component_code", "label": "Component", "category": "Inventory"},
    {"key": "disposition_code", "label": "Disposition", "category": "Inventory"},
    {"key": "obtained_date", "label": "Collection Date", "category": "Registry"},
    {"key": "patient_visit_label", "label": "Visit Label", "category": "Registry"},
]
HEADER_MAPPING_OPTIONS = [item["key"] for item in FIELD_CATALOG]
MAPPING_RULES = [
    {"source": "Participant ID", "target": "patient_id", "rule": "Maps the uploaded participant identifier to the demo registry field."},
    {"source": "Visit Number", "target": "visit_number", "rule": "Normalizes visit counters into a shared visit number."},
    {"source": "Program", "target": "study_code", "rule": "Maps the uploaded program label to one of the public demo programs."},
    {"source": "Collection Site", "target": "site_name", "rule": "Resolves site labels into the public demo site vocabulary."},
    {"source": "Barcode", "target": "sample_barcode", "rule": "Uses the provided barcode directly as the synthetic sample ID."},
]
SCHEMA_AREAS = [
    {"title": "Participant Registry", "tables": ["Participants", "Visits", "Visit labels"], "description": "Tracks patient identity and visit progression in the public demo dataset."},
    {"title": "Inventory Workspace", "tables": ["Samples", "Components", "Disposition states"], "description": "Represents sample records and current inventory status."},
    {"title": "Reference Catalog", "tables": ["Programs", "Sites", "Phases"], "description": "Keeps shared program and site vocabulary consistent across pages."},
    {"title": "Operations Layer", "tables": ["Preview plans", "Import runs", "Demo access profile"], "description": "Provides workflow state without any private infrastructure."},
]
REF = {
    "studies": [
        {"study_id": 1, "study_code": "RESP", "study_name": "Respiratory Monitoring"},
        {"study_id": 2, "study_code": "IMM", "study_name": "Immune Response"},
        {"study_id": 3, "study_code": "LONG", "study_name": "Longitudinal Recovery"},
    ],
    "phases": [
        {"visit_phase_id": 1, "phase_code": "BASELINE", "phase_name": "Baseline"},
        {"visit_phase_id": 2, "phase_code": "FOLLOWUP", "phase_name": "Follow-up"},
        {"visit_phase_id": 3, "phase_code": "RECOVERY", "phase_name": "Recovery"},
    ],
    "sites": [
        {"site_id": 1, "site_name": "North Campus", "site_abbreviation": "NC"},
        {"site_id": 2, "site_name": "Downtown Clinic", "site_abbreviation": "DC"},
        {"site_id": 3, "site_name": "Community Partner Lab", "site_abbreviation": "CPL"},
        {"site_id": 4, "site_name": "West Valley Hub", "site_abbreviation": "WV"},
        {"site_id": 5, "site_name": "Mobile Collection Unit", "site_abbreviation": "MCU"},
        {"site_id": 6, "site_name": "Central Processing", "site_abbreviation": "CP"},
    ],
}
VISITS = [
    {"visit_id": 501, "patient_id": "DEMO-001", "visit_number": 1, "study_id": 1, "visit_phase_id": 1, "obtained_from_id": 1, "obtained_date": "2026-03-04", "study_year": 2026, "patient_visit_label": "RESP-001-BL", "sub_study_id": "RSP-001", "csid": "CS-1001"},
    {"visit_id": 502, "patient_id": "DEMO-002", "visit_number": 2, "study_id": 1, "visit_phase_id": 2, "obtained_from_id": 2, "obtained_date": "2026-03-11", "study_year": 2026, "patient_visit_label": "RESP-002-FU", "sub_study_id": "RSP-002", "csid": "CS-1002"},
    {"visit_id": 503, "patient_id": "DEMO-014", "visit_number": 1, "study_id": 2, "visit_phase_id": 1, "obtained_from_id": 3, "obtained_date": "2026-03-08", "study_year": 2026, "patient_visit_label": "IMM-014-BL", "sub_study_id": "IMM-014", "csid": "CS-1014"},
    {"visit_id": 504, "patient_id": "DEMO-018", "visit_number": 2, "study_id": 2, "visit_phase_id": 2, "obtained_from_id": 4, "obtained_date": "2026-03-12", "study_year": 2026, "patient_visit_label": "IMM-018-FU", "sub_study_id": "IMM-018", "csid": "CS-1018"},
    {"visit_id": 505, "patient_id": "DEMO-021", "visit_number": 1, "study_id": 3, "visit_phase_id": 1, "obtained_from_id": 5, "obtained_date": "2026-03-12", "study_year": 2026, "patient_visit_label": "LONG-021-BL", "sub_study_id": "LNG-021", "csid": "CS-1021"},
    {"visit_id": 506, "patient_id": "DEMO-028", "visit_number": 3, "study_id": 3, "visit_phase_id": 3, "obtained_from_id": 6, "obtained_date": "2026-03-19", "study_year": 2026, "patient_visit_label": "LONG-028-RC", "sub_study_id": "LNG-028", "csid": "CS-1028"},
]
SAMPLES = [
    {"visit_id": 501, "sample_barcode": "D-0001", "sample_type": "Serum", "component_code": "ALIQ-A", "disposition_code": "RETAINED"},
    {"visit_id": 501, "sample_barcode": "D-0002", "sample_type": "Plasma", "component_code": "ALIQ-B", "disposition_code": "SHARED"},
    {"visit_id": 502, "sample_barcode": "D-0003", "sample_type": "Whole Blood", "component_code": "WB", "disposition_code": "RETAINED"},
    {"visit_id": 502, "sample_barcode": "D-0004", "sample_type": "PBMC", "component_code": "PBMC", "disposition_code": "SHARED"},
    {"visit_id": 503, "sample_barcode": "D-0005", "sample_type": "Serum", "component_code": "ALIQ-A", "disposition_code": "RETAINED"},
    {"visit_id": 503, "sample_barcode": "D-0006", "sample_type": "Saliva", "component_code": "SAL", "disposition_code": "RETAINED"},
    {"visit_id": 504, "sample_barcode": "D-0007", "sample_type": "Plasma", "component_code": "ALIQ-B", "disposition_code": "SHARED"},
    {"visit_id": 504, "sample_barcode": "D-0008", "sample_type": "Serum", "component_code": "ALIQ-A", "disposition_code": "RETAINED"},
    {"visit_id": 505, "sample_barcode": "D-0009", "sample_type": "Serum", "component_code": "ALIQ-A", "disposition_code": "SHARED"},
    {"visit_id": 505, "sample_barcode": "D-0010", "sample_type": "Plasma", "component_code": "ALIQ-B", "disposition_code": "RETAINED"},
    {"visit_id": 506, "sample_barcode": "D-0011", "sample_type": "Whole Blood", "component_code": "WB", "disposition_code": "RETAINED"},
    {"visit_id": 506, "sample_barcode": "D-0012", "sample_type": "PBMC", "component_code": "PBMC", "disposition_code": "SHARED"},
]
PLANS: dict[str, dict[str, Any]] = {}
IMPORT_RUNS: list[dict[str, Any]] = []


class ReviewDecision(BaseModel):
    row_id: str
    action: str | None = None
    obtained_date: str | None = None
    use_visit_zero: bool = False


class ImportRequest(BaseModel):
    plan_id: str
    confirmed_mapping: bool = False
    decisions: list[ReviewDecision] = Field(default_factory=list)


class PreviewExportRequest(BaseModel):
    plan_id: str
    decisions: list[ReviewDecision] = Field(default_factory=list)
    row_ids: list[str] = Field(default_factory=list)


class QueryRequest(BaseModel):
    question: str = ""
    selected_fields: list[str] = Field(default_factory=list)
    study_filters: list[str] = Field(default_factory=list)
    limit: int = 100


class GroundedAnswerRequest(BaseModel):
    question: str = ""
    participant_id: str | None = None
    study_filters: list[str] = Field(default_factory=list)
    max_snapshot_rows: int = 12


class ChatMessage(BaseModel):
    role: str
    content: Any


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class DiscardUploadRequest(BaseModel):
    plan_id: str


def normalize_upload_mode(upload_mode: str | None) -> str:
    mode = (upload_mode or DEFAULT_UPLOAD_MODE).strip().lower()
    if mode not in UPLOAD_MODES:
        raise HTTPException(status_code=400, detail=f"Unsupported upload mode: {upload_mode}")
    return mode


def demo_user() -> dict[str, Any]:
    return {"portal_user_id": 0, "email": settings.public_demo_user_email, "display_name": settings.public_demo_user_name, "roles": [], "two_factor_enabled": False, "is_email_verified": True}


def access_scope() -> dict[str, Any]:
    return {"is_admin": False, "view_study_codes": [study["study_code"] for study in REF["studies"]], "upload_study_codes": [study["study_code"] for study in REF["studies"]], "study_access": [{"study_id": study["study_id"], "study_code": study["study_code"], "study_name": study["study_name"], "access_level": "UPLOAD"} for study in REF["studies"]], "study_access_summary": "Public demo access", "can_view_any": True, "can_upload_any": True}


def primary_nav(active: str, mode: str = DEFAULT_UPLOAD_MODE) -> list[dict[str, Any]]:
    mode = normalize_upload_mode(mode)
    return [{"label": "Home", "href": "/", "active": active == "home"}, {"label": "Patient Onboarding", "href": "/patient-onboarding", "active": active == "patient_onboarding"}, {"label": "Dataloader", "href": f"/dataloader?mode={mode}", "active": active == "dataloader"}, {"label": "AI Report Generator", "href": f"/reports/ai?mode={mode}", "active": active == "ai_report"}, {"label": "Dashboard", "href": f"/reports/dashboard?mode={mode}", "active": active == "dashboard"}]


def upload_mode_tabs(mode: str) -> list[dict[str, Any]]:
    mode = normalize_upload_mode(mode)
    return [{"key": key, "label": value["label"], "href": f"/dataloader?mode={key}", "active": key == mode} for key, value in UPLOAD_MODES.items()]


def lookup(rows: list[dict[str, Any]], key: str, value: Any) -> dict[str, Any] | None:
    return next((row for row in rows if row[key] == value), None)


def demo_rows() -> list[dict[str, Any]]:
    rows = []
    for sample in SAMPLES:
        visit = lookup(VISITS, "visit_id", sample["visit_id"])
        if not visit:
            continue
        study = lookup(REF["studies"], "study_id", visit["study_id"]) or {}
        phase = lookup(REF["phases"], "visit_phase_id", visit["visit_phase_id"]) or {}
        site = lookup(REF["sites"], "site_id", visit["obtained_from_id"]) or {}
        rows.append({"patient_id": visit["patient_id"], "visit_number": visit["visit_number"], "study_code": study.get("study_code", ""), "phase_code": phase.get("phase_code", ""), "site_name": site.get("site_name", ""), "sample_barcode": sample["sample_barcode"], "sample_type": sample["sample_type"], "component_code": sample["component_code"], "disposition_code": sample["disposition_code"], "obtained_date": visit["obtained_date"], "patient_visit_label": visit["patient_visit_label"]})
    return rows


def recent_patient_visits(limit: int = 12) -> list[dict[str, Any]]:
    rows = []
    for visit in VISITS:
        study = lookup(REF["studies"], "study_id", visit["study_id"]) or {}
        phase = lookup(REF["phases"], "visit_phase_id", visit["visit_phase_id"]) or {}
        site = lookup(REF["sites"], "site_id", visit["obtained_from_id"]) or {}
        rows.append({"visit_id": visit["visit_id"], "patient_id": visit["patient_id"], "visit_number": visit["visit_number"], "phase_code": phase.get("phase_code"), "obtained_date": visit["obtained_date"], "study_code": study.get("study_code"), "site_name": site.get("site_name"), "patient_visit_label": visit["patient_visit_label"], "sub_study_id": visit.get("sub_study_id"), "csid": visit.get("csid")})
    rows.sort(key=lambda row: row["obtained_date"], reverse=True)
    return rows[:limit]


def database_overview() -> dict[str, Any]:
    rows = demo_rows()
    patient_counts: dict[str, set[str]] = defaultdict(set)
    visit_counts: Counter[str] = Counter()
    sample_counts: Counter[str] = Counter()
    disposition_counts: Counter[str] = Counter()
    for visit in VISITS:
        study = lookup(REF["studies"], "study_id", visit["study_id"]) or {}
        code = study.get("study_code", "UNASSIGNED")
        patient_counts[code].add(visit["patient_id"])
        visit_counts[code] += 1
    for row in rows:
        sample_counts[row["study_code"]] += 1
        disposition_counts[row["disposition_code"]] += 1
    return {"metrics": [{"label": "Programs", "value": len(REF["studies"]), "detail": "Public demo programs available across the workspace."}, {"label": "Sites", "value": len(REF["sites"]), "detail": "Normalized collection locations visible in the public build."}, {"label": "Participants", "value": len({visit["patient_id"] for visit in VISITS}), "detail": "Synthetic participant identifiers used for walkthrough data."}, {"label": "Visits", "value": len(VISITS), "detail": "Demo visit records used across onboarding, reporting, and dashboard pages."}, {"label": "Inventory Items", "value": len(rows), "detail": "Synthetic inventory rows available in the demo query and loader flows."}], "study_breakdown": [{"study_code": study["study_code"], "patient_count": len(patient_counts[study["study_code"]]), "visit_count": visit_counts[study["study_code"]], "sample_count": sample_counts[study["study_code"]]} for study in REF["studies"]], "disposition_breakdown": [{"disposition_code": key.title(), "sample_count": value} for key, value in disposition_counts.items()], "schema_areas": SCHEMA_AREAS}


def current_runtime_status() -> dict[str, Any]:
    return {"db_ready": False, "ai_ready": False, "ai_provider": None, "query_ai_enabled": False, "rag_ai_provider": None, "rag_model_name": None, "rag_snapshot_status": {"ready": False, "note": "This public clone uses a synthetic dataset only.", "source_files": {"demo_profile": False, "demo_inventory": False}}, "header_assistant_enabled": False, "ai_spend_safe_mode": True, "latest_import": IMPORT_RUNS[0] if IMPORT_RUNS else None, "import_error": None, "public_demo_mode": True, "current_user": {**demo_user(), **{"study_access_summary": access_scope()["study_access_summary"], "view_study_codes": access_scope()["view_study_codes"], "upload_study_codes": access_scope()["upload_study_codes"], "study_access": access_scope()["study_access"], "can_view_any": True, "can_upload_any": True}}}


def render_page(request: Request, template_name: str, context: dict[str, Any], status_code: int = 200) -> HTMLResponse:
    return templates.TemplateResponse(request, template_name, {"app_title": settings.app_title, "public_demo_mode": True, "current_user": demo_user(), "user_access_scope": access_scope(), "runtime_status_json": json.dumps(jsonable_encoder(current_runtime_status())), "field_catalog_json": json.dumps(FIELD_CATALOG), "header_mapping_options_json": json.dumps(HEADER_MAPPING_OPTIONS), **context}, status_code=status_code)


def review_rows(file_names: list[str], mode: str) -> list[dict[str, Any]]:
    target = UPLOAD_MODES[mode]["code"]
    rows = []
    for index, row in enumerate(demo_rows()[:8], start=1):
        file_name = file_names[(index - 1) % len(file_names)]
        obtained_date = row["obtained_date"] if index != 2 else ""
        resolved_site = row["site_name"] if index != 4 else "Central Processing"
        issues = []
        if row["disposition_code"] != target:
            issues.append({"tone": "warn", "message": f"Disposition does not match the active {UPLOAD_MODES[mode]['label'].lower()} tab."})
        if not obtained_date:
            issues.append({"tone": "warn", "message": "Collection date is missing and must be confirmed before import."})
        if resolved_site != row["site_name"]:
            issues.append({"tone": "ready", "message": f"Site label normalized to {resolved_site}."})
        raw_excel = {"Participant ID": row["patient_id"], "Visit Number": row["visit_number"], "Program": row["study_code"], "Phase": row["phase_code"], "Collection Site": row["site_name"], "Collected Date": obtained_date, "Sample Barcode": row["sample_barcode"], "Sample Type": row["sample_type"], "Component": row["component_code"], "Disposition": row["disposition_code"]}
        rows.append({"row_id": f"{mode}-{index}", "source_file": file_name, "source_sheet": UPLOAD_MODES[mode]["sheet"], "source_row": index + 1, "patient_id": row["patient_id"], "patient_visit_label": row["patient_visit_label"], "barcode": row["sample_barcode"], "sample_type": row["sample_type"], "raw_visit_code": row["patient_visit_label"], "effective_visit_number": row["visit_number"], "obtained_date": obtained_date, "obtained_from": row["site_name"], "resolved_obtained_from": resolved_site, "expected_site": resolved_site, "raw_disposition": row["disposition_code"], "suggested_action": target if row["disposition_code"] == target else "", "requires_action": row["disposition_code"] != target, "requires_date_resolution": not bool(obtained_date), "flag_issue_count": len(issues), "issues": issues, "comments": "Synthetic demo row for preview walkthrough.", "auto_change_summary": "Public demo mode does not persist uploads to a live system.", "raw_excel_headers": list(raw_excel.keys()), "raw_excel_row": raw_excel})
    return rows


def build_summary(rows: list[dict[str, Any]], file_names: list[str]) -> dict[str, Any]:
    return {"file_name": file_names[0] if len(file_names) == 1 else f"{len(file_names)} workbooks | {', '.join(file_names[:3])}", "file_names": file_names, "file_count": len(file_names), "sample_count": len(rows), "flagged_sample_count": sum(1 for row in rows if row["flag_issue_count"]), "review_required_count": sum(1 for row in rows if row["requires_action"] or row["requires_date_resolution"]), "missing_date_count": sum(1 for row in rows if row["requires_date_resolution"]), "date_order_count": 0, "year_mismatch_count": 0, "site_correction_count": sum(1 for row in rows if row["obtained_from"] != row["resolved_obtained_from"]), "visit_shift_count": 0, "warning_count": 1, "duplicate_barcodes_skipped": 0, "study_codes": sorted({row["raw_excel_row"]["Program"] for row in rows}), "components": dict(Counter(row["raw_excel_row"]["Component"] for row in rows)), "sample_types": dict(Counter(row["sample_type"] for row in rows)), "dispositions": dict(Counter(row["raw_disposition"] for row in rows)), "disposition_sources": {"demo": len(rows)}}


def get_plan(plan_id: str) -> dict[str, Any]:
    current = PLANS.get(plan_id)
    if not current:
        raise HTTPException(status_code=404, detail="Preview plan not found or expired.")
    return current


def apply_decisions(mode: str, rows: list[dict[str, Any]], decisions: list[dict[str, Any]]) -> dict[str, Any]:
    decision_map = {item["row_id"]: item for item in decisions}
    chosen_action_counts: Counter[str] = Counter()
    ignored_row_ids: list[str] = []
    selected_rows = []
    target = UPLOAD_MODES[mode]["code"]
    for row in rows:
        decision = decision_map.get(row["row_id"], {})
        action = (decision.get("action") or row.get("suggested_action") or target).upper()
        if action == "IGNORE":
            ignored_row_ids.append(row["row_id"])
            chosen_action_counts[action] += 1
            continue
        chosen_action_counts[action] += 1
        selected_rows.append({**row, "final_action": action, "obtained_date": decision.get("obtained_date") or row["obtained_date"], "use_visit_zero": bool(decision.get("use_visit_zero"))})
    return {"selected_rows": selected_rows, "selected_count": len(selected_rows), "ignored_count": len(ignored_row_ids), "ignored_row_ids": ignored_row_ids, "chosen_action_counts": dict(chosen_action_counts)}


def workbook_response(file_name: str, headers: list[str], rows: list[list[Any]]) -> StreamingResponse:
    buffer = BytesIO()
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Preview"
    worksheet.append(headers)
    for row in rows:
        worksheet.append(row)
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{file_name}"'})


def selected_codes(filters: list[str]) -> list[str]:
    allowed = set(access_scope()["view_study_codes"])
    requested = {code.strip().upper() for code in filters if code.strip()}
    return sorted(requested & allowed) if requested else sorted(allowed)


def filtered_demo_rows(question: str, filters: list[str], limit: int) -> list[dict[str, Any]]:
    rows = [row for row in demo_rows() if row["study_code"] in selected_codes(filters)]
    lower = question.lower().strip()
    if "retain" in lower or "kept" in lower:
        rows = [row for row in rows if row["disposition_code"] == "RETAINED"]
    if "share" in lower or "sent" in lower:
        rows = [row for row in rows if row["disposition_code"] == "SHARED"]
    for token in ("serum", "plasma", "saliva", "pbmc", "whole blood"):
        if token in lower:
            rows = [row for row in rows if row["sample_type"].lower() == token]
    year = re.search(r"\b(20\d{2})\b", lower)
    if year:
        rows = [row for row in rows if row["obtained_date"].startswith(year.group(1))]
    return rows[: max(1, min(limit, settings.max_query_rows))]


def project_rows(rows: list[dict[str, Any]], selected_fields: list[str]) -> list[dict[str, Any]]:
    allowed = {item["key"] for item in FIELD_CATALOG}
    fields = [field for field in selected_fields if field in allowed] or [item["key"] for item in FIELD_CATALOG[:8]]
    return [{field: row.get(field, "") for field in fields} for row in rows]


def metric_reply(metric_name: str, requested_code: str | None = None) -> str:
    participant_counts: Counter[str] = Counter()
    visit_counts: Counter[str] = Counter()
    sample_counts: Counter[str] = Counter(row["study_code"] for row in demo_rows())
    seen: set[tuple[str, str]] = set()
    for visit in VISITS:
        study = lookup(REF["studies"], "study_id", visit["study_id"]) or {}
        code = study.get("study_code", "")
        visit_counts[code] += 1
        key = (code, visit["patient_id"])
        if key not in seen:
            participant_counts[code] += 1
            seen.add(key)
    source = {"participant_count": participant_counts, "visit_count": visit_counts, "sample_count": sample_counts}[metric_name]
    label = metric_name.replace("_count", "").replace("_", " ")
    if requested_code:
        return f"{label.title()} count for {requested_code}: {source.get(requested_code, 0)}."
    return f"{label.title()} counts by program: " + ", ".join(f"{key}: {value}" for key, value in source.items())

@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    mode = normalize_upload_mode(DEFAULT_UPLOAD_MODE)
    return render_page(request, "home.html", {"upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("home", mode), "database_overview": database_overview(), "app_page": "home"})


@app.get("/home", response_class=HTMLResponse)
async def home_alias(request: Request) -> HTMLResponse:
    return await home(request)


@app.get("/login")
@app.post("/login")
@app.post("/logout")
async def login_redirect() -> RedirectResponse:
    return RedirectResponse(url="/", status_code=303)


@app.get("/dataloader", response_class=HTMLResponse)
async def dataloader_page(request: Request, mode: str = DEFAULT_UPLOAD_MODE) -> HTMLResponse:
    mode = normalize_upload_mode(mode)
    return render_page(request, "index.html", {"db_ready": False, "ai_ready": False, "field_catalog": FIELD_CATALOG, "upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("dataloader", mode), "upload_mode_tabs": upload_mode_tabs(mode), "app_page": "dataloader"})


@app.get("/uploads/{upload_mode}")
async def uploads_redirect(upload_mode: str) -> RedirectResponse:
    return RedirectResponse(url=f"/dataloader?mode={normalize_upload_mode(upload_mode)}", status_code=303)


@app.get("/patient-onboarding", response_class=HTMLResponse)
async def patient_onboarding_page(request: Request) -> HTMLResponse:
    mode = normalize_upload_mode(DEFAULT_UPLOAD_MODE)
    return render_page(request, "patient_onboarding.html", {"upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("patient_onboarding", mode), "reference_data": REF, "recent_visits": recent_patient_visits(), "message": None, "message_tone": "warn", "form_data": {}, "created_visit": None, "app_page": "patient_onboarding"})


@app.post("/patient-onboarding", response_class=HTMLResponse)
async def patient_onboarding_submit(
    request: Request,
    patient_id: str = Form(...),
    visit_number: str = Form("1"),
    study_id: str = Form(...),
    visit_phase_id: str = Form(""),
    obtained_from_id: str = Form(""),
    obtained_date: str = Form(""),
    study_year: str = Form(""),
    patient_visit_label: str = Form(""),
    sub_study_id: str = Form(""),
    csid: str = Form(""),
) -> HTMLResponse:
    form_data = {"patient_id": patient_id, "visit_number": visit_number, "study_id": study_id, "visit_phase_id": visit_phase_id, "obtained_from_id": obtained_from_id, "obtained_date": obtained_date, "study_year": study_year, "patient_visit_label": patient_visit_label, "sub_study_id": sub_study_id, "csid": csid}
    mode = normalize_upload_mode(DEFAULT_UPLOAD_MODE)
    try:
        pid = (patient_id or "").strip()
        if not pid:
            raise HTTPException(status_code=400, detail="Patient ID is required.")
        visit_no = int((visit_number or "").strip() or "0")
        study_no = int((study_id or "").strip() or "0")
        study = lookup(REF["studies"], "study_id", study_no)
        if not study:
            raise HTTPException(status_code=400, detail="Selected program is not available in the public demo.")
        if any(visit["patient_id"] == pid and visit["visit_number"] == visit_no for visit in VISITS):
            raise HTTPException(status_code=400, detail="That patient already has the selected visit number in the demo.")
        iso_date = date.fromisoformat(obtained_date).isoformat() if obtained_date else date.today().isoformat()
        new_visit = {"visit_id": max(visit["visit_id"] for visit in VISITS) + 1, "patient_id": pid, "visit_number": visit_no, "study_id": study_no, "visit_phase_id": int(visit_phase_id) if visit_phase_id else None, "obtained_from_id": int(obtained_from_id) if obtained_from_id else None, "obtained_date": iso_date, "study_year": int(study_year) if study_year else date.today().year, "patient_visit_label": (patient_visit_label or f"{study['study_code']}-{pid}").strip(), "sub_study_id": (sub_study_id or "").strip() or None, "csid": (csid or "").strip() or None}
        VISITS.append(new_visit)
        created = {"patient_id": new_visit["patient_id"], "visit_number": new_visit["visit_number"], "study_code": study["study_code"], "phase_code": (lookup(REF["phases"], "visit_phase_id", new_visit["visit_phase_id"]) or {}).get("phase_code"), "patient_visit_label": new_visit["patient_visit_label"]}
        message, tone, status = f"Patient {pid} visit {visit_no} was added to the public demo dataset.", "ready", 201
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        created, message, tone, status = None, detail, "warn", exc.status_code if isinstance(exc, HTTPException) else 400
    return render_page(request, "patient_onboarding.html", {"upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("patient_onboarding", mode), "reference_data": REF, "recent_visits": recent_patient_visits(), "message": message, "message_tone": tone, "form_data": {} if created else form_data, "created_visit": created, "app_page": "patient_onboarding"}, status_code=status)


@app.get("/reports/ai", response_class=HTMLResponse)
async def ai_report_page(request: Request, mode: str = DEFAULT_UPLOAD_MODE) -> HTMLResponse:
    mode = normalize_upload_mode(mode)
    return render_page(request, "query_report.html", {"field_catalog": FIELD_CATALOG, "upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("ai_report", mode), "app_page": "ai_report"})


@app.get("/reports/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request, mode: str = DEFAULT_UPLOAD_MODE) -> HTMLResponse:
    mode = normalize_upload_mode(mode)
    return render_page(request, "dashboard_report.html", {"upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "primary_nav": primary_nav("dashboard", mode), "database_overview": database_overview(), "recent_visits": recent_patient_visits(6), "app_page": "dashboard"})


@app.post("/api/upload/preview")
async def upload_preview(files: list[UploadFile] = File(...), upload_mode: str = Form(DEFAULT_UPLOAD_MODE)) -> dict[str, Any]:
    mode = normalize_upload_mode(upload_mode)
    file_names = []
    for file in files:
        file_names.append(Path(file.filename or "demo.xlsx").name)
        await file.read()
    if not file_names:
        raise HTTPException(status_code=400, detail="Choose at least one workbook.")
    rows = review_rows(file_names, mode)
    summary = build_summary(rows, file_names)
    plan_id = str(uuid.uuid4())
    PLANS[plan_id] = {"upload_mode": mode, "file_name": summary["file_name"], "file_names": file_names, "review_rows": rows, "import_completed": False}
    return {"plan_id": plan_id, "upload_mode": mode, "upload_mode_label": UPLOAD_MODES[mode]["label"], "selected_sheets": [UPLOAD_MODES[mode]["sheet"]], "ignored_sheets": ["Instructions"], "sheet_details": [{"file_name": name, "sheet_name": UPLOAD_MODES[mode]["sheet"], "sheet_title": UPLOAD_MODES[mode]["sheet"], "header_assistant": {"applied_mappings": [], "unresolved_headers": []}} for name in file_names], "summary": summary, "mapping_rules": MAPPING_RULES, "header_assistant": {"provider": "demo", "applied_mappings": [], "manual_mappings": [], "unresolved_headers": [], "errors": [], "disabled_reason": "This public build uses a fixed synthetic mapping and does not call external models."}, "warnings": ["This preview was generated from a synthetic public dataset. Uploaded files are not persisted and no private backend is used."], "preview_rows": rows, "review_gate": {"can_import": True, "sheet_name_valid": True, "matched_sheet_names": [UPLOAD_MODES[mode]["sheet"]], "expected_sheet_keywords": UPLOAD_MODES[mode]["keywords"], "flagged_sample_count": sum(1 for row in rows if row["flag_issue_count"]), "blocking_errors": [], "global_blocking_errors": [], "sheet_selection_requests": []}, "flagged_preview_rows": [row for row in rows if row["flag_issue_count"]], "review_rows": rows, "file_names": file_names, "sheet_selection_requests": [], "header_overrides": {}}


@app.post("/api/import/execute")
async def execute_import(payload: ImportRequest) -> dict[str, Any]:
    if not payload.confirmed_mapping:
        raise HTTPException(status_code=400, detail="Confirm the reviewed mapping before importing.")
    current = get_plan(payload.plan_id)
    if current["import_completed"]:
        raise HTTPException(status_code=409, detail="This preview was already imported. Generate a new preview to run again.")
    decisions = apply_decisions(current["upload_mode"], current["review_rows"], jsonable_encoder(payload.decisions))
    current["import_completed"] = True
    finished_at = datetime.utcnow().replace(microsecond=0).isoformat(sep=" ")
    run_uuid = str(uuid.uuid4())
    IMPORT_RUNS.insert(0, {"import_run_id": len(IMPORT_RUNS) + 1, "run_uuid": run_uuid, "file_name": current["file_name"], "status": "SIMULATED", "upload_mode": current["upload_mode"], "study_codes": access_scope()["view_study_codes"], "started_at": finished_at, "finished_at": finished_at, "selected_count": decisions["selected_count"], "ignored_count": decisions["ignored_count"]})
    selected_count = decisions["selected_count"]
    return {"plan_id": payload.plan_id, "file_name": current["file_name"], "review_decisions": decisions, "loader_summary": {"visit_stage_rows": len({row["patient_visit_label"] for row in decisions["selected_rows"]}), "sample_stage_rows": selected_count, "visits_normalized": len({row["patient_visit_label"] for row in decisions["selected_rows"]}), "samples_resolved_to_visit": selected_count, "samples_ready_for_upsert": selected_count, "samples_missing_visit": 0, "samples_missing_sample_type": 0, "tube_links_prepared": selected_count}, "validation_summary": {"demo_preview_flags": {"count": sum(1 for row in current["review_rows"] if row["flag_issue_count"])}, "demo_runtime_checks": {"count": 0}}, "audit": {"run_uuid": run_uuid}}


@app.post("/api/upload/discard")
async def discard_preview(payload: DiscardUploadRequest) -> dict[str, Any]:
    current = PLANS.pop(payload.plan_id, None)
    return {"discarded": bool(current), "already_cleared": current is None, "file_names": current.get("file_names", []) if current else [], "removed_cached_files": []}


@app.post("/api/upload/preview-export")
async def preview_export(payload: PreviewExportRequest) -> StreamingResponse:
    current = get_plan(payload.plan_id)
    ids = set(payload.row_ids or [])
    rows = [row for row in current["review_rows"] if not ids or row["row_id"] in ids]
    headers = ["Source File", "Sheet", "Row", "Patient ID", "Visit Label", "Sample Barcode", "Sample Type", "Site", "Collection Date", "Disposition"]
    values = [[row["source_file"], row["source_sheet"], row["source_row"], row["patient_id"], row["patient_visit_label"], row["barcode"], row["sample_type"], row["resolved_obtained_from"], row["obtained_date"], row["raw_disposition"]] for row in rows]
    return workbook_response(f"{Path(current['file_name']).stem or 'demo'}_preview.xlsx", headers, values)


@app.post("/api/upload/raw-preview-export")
async def raw_preview_export(payload: PreviewExportRequest) -> StreamingResponse:
    current = get_plan(payload.plan_id)
    ids = set(payload.row_ids or [])
    rows = [row for row in current["review_rows"] if not ids or row["row_id"] in ids]
    headers = ["File", "Sheet", "Row"] + list(rows[0]["raw_excel_headers"]) if rows else ["File", "Sheet", "Row"]
    values = [[row["source_file"], row["source_sheet"], row["source_row"]] + [row["raw_excel_row"].get(header, "") for header in row["raw_excel_headers"]] for row in rows]
    return workbook_response(f"{Path(current['file_name']).stem or 'demo'}_raw_preview.xlsx", headers, values)


@app.get("/api/import-runs")
async def import_runs(limit: int = 10, study_codes: str = "") -> dict[str, Any]:
    requested = {code.strip().upper() for code in study_codes.split(",") if code.strip()}
    rows = IMPORT_RUNS if not requested else [row for row in IMPORT_RUNS if requested.intersection({code.upper() for code in row.get("study_codes", [])})]
    return {"rows": rows[: max(1, min(limit, 25))]}


@app.get("/api/runtime-status")
async def runtime_status_api() -> dict[str, Any]:
    return current_runtime_status()


@app.post("/api/query")
async def query_api(payload: QueryRequest) -> dict[str, Any]:
    codes = selected_codes(payload.study_filters)
    rows = filtered_demo_rows(payload.question, codes, payload.limit)
    fields = payload.selected_fields or [item["key"] for item in FIELD_CATALOG[:8]]
    explanation = "No natural-language filter was supplied, so the demo returned a straight projection of the selected fields." if not payload.question.strip() else f'The public demo interpreted "{payload.question.strip()}" against the synthetic dataset and returned {len(rows)} row(s).'
    return {"executed": True, "sql": "DEMO QUERY PLAN\nFields: " + ", ".join(fields) + "\nPrograms: " + ", ".join(codes) + "\nExecution target: in-memory public demo dataset", "explanation": explanation, "rows": project_rows(rows, payload.selected_fields), "row_count": len(rows), "message": "Results come from the synthetic public demo dataset.", "ai_enabled": False, "ai_provider": None, "ai_attempted": False, "ai_used": False, "fallback_used": True, "query_mode": "deterministic_projection", "selected_study_codes": codes}


@app.post("/api/query/grounded")
async def grounded_api(payload: GroundedAnswerRequest) -> dict[str, Any]:
    codes = selected_codes(payload.study_filters)
    rows = filtered_demo_rows(payload.question, codes, payload.max_snapshot_rows)
    participant_id = payload.participant_id or (rows[0]["patient_id"] if rows else None)
    scoped = [row for row in rows if not participant_id or row["patient_id"] == participant_id]
    return {"answer": f"The public demo found {len(scoped)} synthetic inventory row(s) for {participant_id or 'the requested scope'} across {', '.join(codes)}.", "message": "Grounded answer generated from the public demo dataset.", "selected_study_codes": codes, "ai_provider": None, "ai_used": False, "fallback_used": True, "model_name": "Deterministic demo assistant", "context": {"snapshot_profile": {"patient_id": participant_id, "programs": codes, "note": "Profile data is generated from the public demo dataset."} if participant_id else None, "live_inventory": {"rows": scoped[: payload.max_snapshot_rows]}, "retrieval_notes": ["Grounded answers in the public build use only in-memory synthetic records.", "No private snapshot files, external models, or database connections are accessed."]}}


@app.post("/api/chat")
async def chat_api(payload: ChatRequest) -> dict[str, Any]:
    text = " ".join(str(message.content) for message in payload.messages if message.role == "user").strip()
    lower = text.lower()
    code = next((study["study_code"] for study in REF["studies"] if study["study_code"].lower() in lower or study["study_name"].lower() in lower), None)
    if "participant" in lower or "patient" in lower:
        return {"reply": metric_reply("participant_count", code)}
    if "sample" in lower or "inventory" in lower:
        return {"reply": metric_reply("sample_count", code)}
    if "visit" in lower:
        return {"reply": metric_reply("visit_count", code)}
    if "access" in lower or "permission" in lower:
        return {"reply": "This public demo has access to all three demo programs: RESP, IMM, and LONG."}
    if "upload" in lower or "dataloader" in lower:
        return {"reply": "Use Dataloader to preview retained or shared workbook flows against the synthetic dataset. The import action is simulated and does not write to a private backend."}
    if "patient" in lower or "onboard" in lower:
        return {"reply": "Use Patient Onboarding to add a synthetic visit into the public demo dataset. New entries update the recent-visit list and summary counts during the current run."}
    return {"reply": "This public repo is a safe demo clone of the original workflow. It uses synthetic program, visit, and inventory data only, with no private services or credentials."}
