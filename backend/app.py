from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .data_profile import list_sample_datasets, profile_csv_file, profile_csv_text


BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = BASE_DIR / "artifect"


app = FastAPI(title="AB Test Lab API")


def get_allowed_origins() -> list[str]:
    cors_origins = os.getenv("CORS_ORIGINS", "*").strip()
    if cors_origins == "*":
        return ["*"]
    return [origin.strip() for origin in cors_origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/data-sources")
def get_data_sources() -> dict[str, object]:
    return {"samples": list_sample_datasets(ARTIFACT_DIR)}


@app.get("/api/data-sources/{sample_id}")
def get_sample_dataset(sample_id: str) -> dict[str, object]:
    csv_path = ARTIFACT_DIR / f"{sample_id}.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Sample dataset not found.")

    try:
        return profile_csv_file(csv_path, source_type="sample", source_label=csv_path.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)) -> dict[str, object]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    try:
        csv_text = (await file.read()).decode("utf-8-sig")
        return profile_csv_text(csv_text, source_type="upload", source_label=file.filename)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV file must be UTF-8 encoded.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
