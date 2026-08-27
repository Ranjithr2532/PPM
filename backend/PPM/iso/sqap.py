"""
FastAPI Router & Document Generator for ISO Document 055: Software Quality Assurance Plan (SQAP).
Generates Word (.docx) document matching CMTI-QMS-055/Rev00 specification with flexible sections & dynamic tables.
"""

from typing import List, Dict, Any, Optional
import io
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import docx
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

from iso.header import add_header_table
from iso.finalfooter import add_footer_table

router = APIRouter(prefix="/iso", tags=["ISO Software Quality Assurance Plan (Doc 055)"])

# Helper function to set cell background color
def set_cell_shading(cell, color_hex: str):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

# Helper function to set cell borders
def set_cell_border(cell, **kwargs):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.first_child_found_in("w:tcBorders")
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)

    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = f'w:{edge}'
            element = tcBorders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)
            for key in ["val", "color", "sz", "space"]:
                if key in edge_data:
                    element.set(qn(f'w:{key}'), str(edge_data[key]))

def set_cell_margins(cell, top=40, start=40, bottom=40, end=40):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m_name, m_val in [('top', top), ('left', start), ('bottom', bottom), ('right', end)]:
        node = OxmlElement(f'w:{m_name}')
        node.set(qn('w:w'), str(m_val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_text(cell_or_paragraph, text: str, font_name: str = "Arial", font_size: int = 10, bold: bool = False, italic: bool = False, color: RGBColor = RGBColor(0, 0, 0), alignment: WD_ALIGN_PARAGRAPH = WD_ALIGN_PARAGRAPH.LEFT, space_after: int = 0):
    if hasattr(cell_or_paragraph, 'paragraphs'):
        p = cell_or_paragraph.paragraphs[0]
    else:
        p = cell_or_paragraph

    p.alignment = alignment
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15

    run = p.add_run(str(text))
    run.font.name = font_name
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return run


class SQAPTableRequest(BaseModel):
    headers: List[str] = []
    rows: List[List[str]] = []

class SQAPSectionRequest(BaseModel):
    title: str = ""
    content: str = ""
    table: Optional[SQAPTableRequest] = None

class SQAPRequest(BaseModel):
    project_title: str = ""
    project_no: str = ""
    customer_name: str = ""
    software_version: str = "v1.0"
    sections: Optional[List[SQAPSectionRequest]] = None
    prepared_by: str = ""
    approved_by: str = ""
    group_name: str = ""
    centre_dept: str = ""
    doc_no: str = "055"
    doc_date: str = ""
    filename: str = "ISO_Software_Quality_Assurance_Plan.docx"


DEFAULT_SQAP_SECTIONS = []


def create_sqap_document(
    project_title: str = "",
    project_no: str = "",
    customer_name: str = "",
    software_version: str = "v1.0",
    sections: Optional[List[Dict[str, Any]]] = None,
    prepared_by: str = "",
    approved_by: str = "",
    group_name: str = "",
    centre_dept: str = "",
    doc_no: str = "055",
    doc_date: str = ""
) -> Document:
    doc = Document()

    # Setup margins (A4 Portrait)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)

    header_group = (group_name or centre_dept or "SMPM").strip().upper()
    if header_group.startswith("G-"):
        header_group = header_group[2:]
    elif header_group.startswith("C-"):
        header_group = header_group[2:]

    # Add Standard ISO Header Table
    add_header_table(
        doc.sections[0],
        title=f"SOFTWARE QUALITY ASSURANCE PLAN-{header_group}",
        page_str="1 of 1",
        centre_dept=centre_dept,
        doc_no=doc_no or "055",
        date_str=doc_date
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Document Main Title Header
    main_p = doc.add_paragraph()
    add_text(main_p, "SOFTWARE QUALITY ASSURANCE PLAN (SQAP)", font_size=12, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)

    # Metadata Card Table (Project, Customer, Version)
    meta_table = doc.add_table(rows=3, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False

    border_fmt = {"val": "single", "sz": "4", "color": "CCCCCC"}
    meta_labels = [
        ("Project Title:", project_title or "--"),
        ("Project No / Customer:", f"{project_no or '--'} | {customer_name or '--'}"),
        ("Software Version / Ref:", software_version or "v1.0")
    ]

    for r_idx, (lbl, val) in enumerate(meta_labels):
        row = meta_table.rows[r_idx]
        set_cell_border(row.cells[0], top=border_fmt, bottom=border_fmt, left=border_fmt, right=border_fmt)
        set_cell_border(row.cells[1], top=border_fmt, bottom=border_fmt, left=border_fmt, right=border_fmt)
        set_cell_margins(row.cells[0], top=30, start=30, bottom=30, end=30)
        set_cell_margins(row.cells[1], top=30, start=30, bottom=30, end=30)
        set_cell_shading(row.cells[0], "F4F6F9")

        add_text(row.cells[0], lbl, font_size=9, bold=True)
        add_text(row.cells[1], val, font_size=9, bold=False)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Render Flexible Sections
    sec_list = sections or DEFAULT_SQAP_SECTIONS

    for s_idx, sec in enumerate(sec_list):
        if isinstance(sec, dict):
            s_title = sec.get("title") or ""
            s_content = sec.get("content") or ""
            s_table = sec.get("table")
        else:
            s_title = getattr(sec, "title", "") or ""
            s_content = getattr(sec, "content", "") or ""
            s_table = getattr(sec, "table", None)

        if s_title:
            sec_p = doc.add_paragraph()
            add_text(sec_p, s_title, font_size=11, bold=True, color=RGBColor(15, 23, 42), space_after=3)

        if s_content:
            cnt_p = doc.add_paragraph()
            add_text(cnt_p, s_content, font_size=10, space_after=6)

        # Render Optional Section Table if attached
        if s_table:
            if isinstance(s_table, dict):
                tbl_headers = s_table.get("headers") or []
                tbl_rows = s_table.get("rows") or []
            else:
                tbl_headers = getattr(s_table, "headers", []) or []
                tbl_rows = getattr(s_table, "rows", []) or []

            if tbl_headers:
                tbl = doc.add_table(rows=1 + len(tbl_rows), cols=len(tbl_headers))
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                tbl.autofit = False

                # Table Header Row
                hdr_row = tbl.rows[0]
                for c_idx, h_text in enumerate(tbl_headers):
                    cell = hdr_row.cells[c_idx]
                    set_cell_border(cell, top=border_fmt, bottom=border_fmt, left=border_fmt, right=border_fmt)
                    set_cell_shading(cell, "E2E8F0")
                    set_cell_margins(cell, top=30, start=30, bottom=30, end=30)
                    add_text(cell, h_text, font_size=9, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

                # Table Data Rows
                for r_idx, r_data in enumerate(tbl_rows):
                    data_row = tbl.rows[r_idx + 1]
                    for c_idx, val_text in enumerate(r_data):
                        if c_idx < len(data_row.cells):
                            cell = data_row.cells[c_idx]
                            set_cell_border(cell, top=border_fmt, bottom=border_fmt, left=border_fmt, right=border_fmt)
                            set_cell_margins(cell, top=30, start=30, bottom=30, end=30)
                            add_text(cell, str(val_text or ""), font_size=9)

                doc.add_paragraph().paragraph_format.space_after = Pt(8)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Add ISO Footer Signature Block Table
    doc_code_footer = f"CMTI-{header_group}-QMS-{doc_no}/Rev00"
    add_footer_table(
        doc,
        prepared_name=prepared_by,
        approved_name=approved_by,
        group_name=header_group,
        doc_code=doc_code_footer,
        in_body=True
    )

    return doc


def generate_sqap_bytes(
    project_title: str = "",
    project_no: str = "",
    customer_name: str = "",
    software_version: str = "v1.0",
    sections: Optional[List[Dict[str, Any]]] = None,
    prepared_by: str = "",
    approved_by: str = "",
    group_name: str = "",
    centre_dept: str = "",
    doc_no: str = "055",
    doc_date: str = ""
) -> io.BytesIO:
    doc = create_sqap_document(
        project_title=project_title,
        project_no=project_no,
        customer_name=customer_name,
        software_version=software_version,
        sections=sections,
        prepared_by=prepared_by,
        approved_by=approved_by,
        group_name=group_name,
        centre_dept=centre_dept,
        doc_no=doc_no,
        doc_date=doc_date
    )

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer


# ============================================================
# API ROUTE HANDLERS
# ============================================================

@router.get(
    "/sqap/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate ISO SQAP Document (.docx) via GET"
)
async def generate_sqap_doc_get(
    project_title: str = Query(""),
    project_no: str = Query(""),
    customer_name: str = Query(""),
    software_version: str = Query("v1.0"),
    prepared_by: str = Query(""),
    approved_by: str = Query(""),
    group_name: str = Query(""),
    centre_dept: str = Query(""),
    doc_no: str = Query("055"),
    doc_date: str = Query(""),
    filename: str = Query("ISO_Software_Quality_Assurance_Plan.docx")
):
    buffer = generate_sqap_bytes(
        project_title=project_title,
        project_no=project_no,
        customer_name=customer_name,
        software_version=software_version,
        prepared_by=prepared_by,
        approved_by=approved_by,
        group_name=group_name,
        centre_dept=centre_dept,
        doc_no=doc_no,
        doc_date=doc_date
    )

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers
    )


@router.post(
    "/sqap/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate ISO SQAP Document (.docx) via POST"
)
async def generate_sqap_doc_post(
    payload: SQAPRequest
):
    filename = payload.filename or "ISO_Software_Quality_Assurance_Plan.docx"
    if not filename.lower().endswith(".docx"):
        filename += ".docx"

    sec_dicts = [s.dict() if hasattr(s, 'dict') else s for s in payload.sections] if payload.sections else None

    buffer = generate_sqap_bytes(
        project_title=payload.project_title,
        project_no=payload.project_no,
        customer_name=payload.customer_name,
        software_version=payload.software_version,
        sections=sec_dicts,
        prepared_by=payload.prepared_by,
        approved_by=payload.approved_by,
        group_name=payload.group_name,
        centre_dept=payload.centre_dept,
        doc_no=payload.doc_no,
        doc_date=payload.doc_date
    )

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers
    )
