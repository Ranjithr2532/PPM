import os
import tempfile
import uuid
from typing import List, Dict, Any, Optional
from docx import Document as DocxDocument

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from docx.shared import RGBColor, Pt
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import get_db
from models.model import DynamicTable
from services.dynamic_table_headers import compute_rows_for_header, set_cell_background

router = APIRouter(prefix="/dynamic-tables", tags=["Dynamic Tables"])


def format_indian_currency(amount: float) -> str:
    s = f"{amount:.2f}"
    parts = s.split(".")
    integer_part = parts[0]
    decimal_part = parts[1] if len(parts) > 1 else "00"
    
    reversed_int = integer_part[::-1]
    first_three = reversed_int[:3]
    remaining = reversed_int[3:]
    
    groups = [first_three]
    for i in range(0, len(remaining), 2):
        groups.append(remaining[i:i+2])
        
    formatted_int = ",".join(groups)[::-1]
    if formatted_int.startswith("-,") or formatted_int.startswith("-"):
        formatted_int = "-" + formatted_int.replace("-", "").lstrip(",")
        
    return f"{formatted_int}.{decimal_part}"


class DynamicTableItem(BaseModel):
    header_name: str
    columns: List[str]
    rows: List[Dict[str, Any]]


class GenerateWordPayload(BaseModel):
    title: Optional[str] = "Cost Breakdown"
    created_by: Optional[str] = None
    tables: List[DynamicTableItem]


# ------------------------------------------------------------------
# GET /dynamic-tables/{project_id}
# Returns the LATEST version's tables for a project (for auto-load
# when the modal opens).
# ------------------------------------------------------------------
@router.get("/{project_id}")
def get_saved_tables(project_id: int, db: Session = Depends(get_db)):
    """
    Returns the latest version's (raw, editable) tables for a project.
    Frontend uses this to pre-populate the Cost Estimation modal.
    """
    # Find the highest version number saved for this project
    max_version = (
        db.query(func.max(DynamicTable.version))
        .filter(DynamicTable.project_id == project_id)
        .scalar()
    )
    if max_version is None:
        return []

    rows = (
        db.query(DynamicTable)
        .filter(
            DynamicTable.project_id == project_id,
            DynamicTable.version == max_version,
        )
        .order_by(DynamicTable.id)
        .all()
    )
    return [
        {
            "header_name": r.header_name,
            "columns": r.columns,
            "rows": r.rows,
        }
        for r in rows
    ]


# ------------------------------------------------------------------
# GET /dynamic-tables/{project_id}/versions
# Returns a summary list of all versions for this project.
# Used by the History drawer to list versions with dates.
# ------------------------------------------------------------------
@router.get("/{project_id}/versions")
def list_versions(project_id: int, db: Session = Depends(get_db)):
    """
    Returns all distinct versions for a project along with metadata
    (who created it, when). One entry per version number.
    """
    # Get the first row per version (for metadata) ordered by version asc
    subq = (
        db.query(
            DynamicTable.version,
            func.min(DynamicTable.created_at).label("created_at"),
            func.min(DynamicTable.created_by).label("created_by"),
        )
        .filter(DynamicTable.project_id == project_id)
        .group_by(DynamicTable.version)
        .order_by(DynamicTable.version)
        .all()
    )

    return [
        {
            "version": row.version,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "created_by": row.created_by,
        }
        for row in subq
    ]


# ------------------------------------------------------------------
# GET /dynamic-tables/{project_id}/version/{version}
# Loads table data for one specific version.
# ------------------------------------------------------------------
@router.get("/{project_id}/version/{version}")
def get_version_tables(project_id: int, version: int, db: Session = Depends(get_db)):
    """
    Returns the (raw, editable) tables for a specific version of a project.
    Used when the user picks a version from the History drawer.
    """
    rows = (
        db.query(DynamicTable)
        .filter(
            DynamicTable.project_id == project_id,
            DynamicTable.version == version,
        )
        .order_by(DynamicTable.id)
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for project {project_id} version {version}",
        )
    return [
        {
            "header_name": r.header_name,
            "columns": r.columns,
            "rows": r.rows,
        }
        for r in rows
    ]


# ------------------------------------------------------------------
# DELETE /dynamic-tables/{project_id}/version/{version}
# Permanently deletes all rows belonging to one specific version.
# ------------------------------------------------------------------
@router.delete("/{project_id}/version/{version}")
def delete_version(project_id: int, version: int, db: Session = Depends(get_db)):
    """
    Permanently deletes all rows for a specific version of a project.
    Other versions are left untouched.
    """
    deleted = (
        db.query(DynamicTable)
        .filter(
            DynamicTable.project_id == project_id,
            DynamicTable.version == version,
        )
        .delete()
    )
    if deleted == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for project {project_id} version {version}",
        )
    db.commit()
    return {"detail": f"Version {version} deleted successfully"}


# ------------------------------------------------------------------
# POST /dynamic-tables/{project_id}/generate-word
# Saves tables as a NEW version (never overwrites old versions),
# then returns the formatted .docx file.
# ------------------------------------------------------------------
@router.post("/{project_id}/generate-word")
def save_and_generate_word_document(
    project_id: int, payload: GenerateWordPayload, db: Session = Depends(get_db)
):
    """
    Determines the current max version for this project, saves all
    tables as (max + 1), then generates and returns a formatted .docx.
    Old versions are never deleted.
    """
    

    if not payload.tables:
        raise HTTPException(status_code=400, detail="At least one table is required")

    # 1. Check if this exact table configuration matches any existing version to prevent duplicates
    matched_version = None
    # Get all unique versions for this project
    versions = [v[0] for v in db.query(DynamicTable.version).filter(DynamicTable.project_id == project_id).distinct().all()]
    
    for ver in versions:
        db_tables = db.query(DynamicTable).filter(
            DynamicTable.project_id == project_id,
            DynamicTable.version == ver
        ).order_by(DynamicTable.header_name).all()
        
        p_tables = sorted(payload.tables, key=lambda x: x.header_name)
        if len(db_tables) != len(p_tables):
            continue
            
        match = True
        for db_tab, p_tab in zip(db_tables, p_tables):
            if db_tab.header_name != p_tab.header_name or db_tab.columns != p_tab.columns or db_tab.rows != p_tab.rows:
                match = False
                break
        if match:
            matched_version = ver
            break

    if matched_version is not None:
        new_version = matched_version
    else:
        # Find the next version number for this project
        max_version = (
            db.query(func.max(DynamicTable.version))
            .filter(DynamicTable.project_id == project_id)
            .scalar()
        ) or 0
        new_version = max_version + 1

        # Save all tables under the new version (old rows untouched)
        for item in payload.tables:
            db.add(
                DynamicTable(
                    project_id=project_id,
                    version=new_version,
                    header_name=item.header_name,
                    columns=item.columns,
                    rows=item.rows,
                    created_by=payload.created_by,
                )
            )
        db.commit()

    # 3. Build the Word document from freshly computed rows (display-only, never persisted)
    doc = DocxDocument()

    title_heading = doc.add_heading(payload.title or "Cost Breakdown", level=1)
    title_heading.runs[0].font.color.rgb = RGBColor(0x2B, 0x57, 0x9A)

    if payload.created_by:
        meta = doc.add_paragraph()
        meta_run = meta.add_run(f"Prepared by: {payload.created_by}")
        meta_run.font.size = Pt(10)
        meta_run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)



    doc.add_paragraph()

    grand_total = 0.0
    table_letters = []

    for idx, item in enumerate(payload.tables):
        if not item.columns:
            raise HTTPException(
                status_code=400,
                detail=f"'{item.header_name}' requires at least one column",
            )

        rows, total_amount = compute_rows_for_header(
            item.header_name, item.rows, item.columns
        )
        
        letter = chr(65 + idx)  # A, B, C, D...
        if total_amount is not None:
            grand_total += total_amount
            table_letters.append(letter)

        section_heading = doc.add_heading(f"{letter}. {item.header_name}", level=2)
        section_heading.runs[0].font.color.rgb = RGBColor(0x33, 0x33, 0x33)

        word_table = doc.add_table(rows=1, cols=len(item.columns))
        word_table.style = "Table Grid"

        header_cells = word_table.rows[0].cells
        for col_idx, col_name in enumerate(item.columns):
            header_cells[col_idx].text = str(col_name)
            set_cell_background(header_cells[col_idx], "EDF2F7")
            for p in header_cells[col_idx].paragraphs:
                for run in p.runs:
                    run.font.bold = True

        for row_data in rows:
            row_cells = word_table.add_row().cells
            first_val = str(row_data.get(item.columns[0], "") or "").lower()
            is_total_row = "total" in first_val

            for col_idx, col_name in enumerate(item.columns):
                raw_val = row_data.get(col_name, "")
                if isinstance(raw_val, (int, float)):
                    cell_value = format_indian_currency(raw_val)
                else:
                    cell_value = str(raw_val or "")
                row_cells[col_idx].text = cell_value
                if is_total_row:
                    set_cell_background(row_cells[col_idx], "F7FAFC")
                    for p in row_cells[col_idx].paragraphs:
                        for run in p.runs:
                            run.font.bold = True

        doc.add_paragraph()

    doc.add_paragraph()
    summary_para = doc.add_paragraph()
    summary_run = summary_para.add_run(
        f"The Amount for this project {payload.title or ''} is."
    )
    summary_run.font.size = Pt(11)

    total_para = doc.add_paragraph()
    formula_suffix = f" ({' + '.join(table_letters)})" if table_letters else ""
    total_label_run = total_para.add_run(f"Total Amount{formula_suffix}: ")
    total_label_run.font.bold = True
    total_label_run.font.size = Pt(12)
    total_value_run = total_para.add_run(format_indian_currency(grand_total))
    total_value_run.font.bold = True
    total_value_run.font.size = Pt(12)

    tmp_dir = tempfile.gettempdir()
    filename = f"cost_breakdown_{uuid.uuid4().hex[:8]}.docx"
    filepath = os.path.join(tmp_dir, filename)
    doc.save(filepath)

    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=filename,
        headers={"X-Version": str(new_version)},
    )