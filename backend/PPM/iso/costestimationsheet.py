"""
FastAPI Router & Document Generator for Project Cost Estimation Sheet.
Supports dynamic multi-year Financial Years (FY), formulas, sub-tables, and exact screenshot layout without headers and footers.
"""

from typing import List, Dict, Any, Optional
import io
import xlsxwriter
from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import docx
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

router = APIRouter(prefix="/iso", tags=["Project Cost Estimation Sheet"])


def set_cell_shading(cell, color_hex: str = "E6E6E6"):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)


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


def set_cell_margins(cell, top=20, bottom=20, start=30, end=30):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar')
        tcPr.append(tcMar)

    for m_name, m_val in [('top', top), ('bottom', bottom), ('left', start), ('right', end)]:
        m_elem = tcMar.find(qn(f'w:{m_name}'))
        if m_elem is None:
            m_elem = OxmlElement(f'w:{m_name}')
            tcMar.append(m_elem)
        m_elem.set(qn('w:w'), str(m_val))
        m_elem.set(qn('w:type'), 'dxa')


def set_cell_width(cell, width_in_inches):
    cell.width = Inches(width_in_inches)
    tcPr = cell._tc.get_or_add_tcPr()
    tcW = tcPr.first_child_found_in("w:tcW")
    if tcW is None:
        tcW = OxmlElement("w:tcW")
        tcPr.append(tcW)
    tcW.set(qn("w:w"), str(int(width_in_inches * 1440)))
    tcW.set(qn("w:type"), "dxa")


def set_table_fixed_grid(table, col_widths_in_inches):
    """Enforces fixed layout and explicit w:tblGrid on Word table to prevent clipping."""
    tblPr = table._tbl.tblPr
    tblW = tblPr.first_child_found_in("w:tblW")
    if tblW is None:
        tblW = OxmlElement("w:tblW")
        tblPr.append(tblW)
    total_dxa = int(sum(col_widths_in_inches) * 1440)
    tblW.set(qn("w:w"), str(total_dxa))
    tblW.set(qn("w:type"), "dxa")

    tblLayout = tblPr.first_child_found_in("w:tblLayout")
    if tblLayout is None:
        tblLayout = OxmlElement("w:tblLayout")
        tblPr.append(tblLayout)
    tblLayout.set(qn("w:type"), "fixed")

    tblGrid = table._tbl.find(qn("w:tblGrid"))
    if tblGrid is not None:
        table._tbl.remove(tblGrid)
    tblGrid = OxmlElement("w:tblGrid")
    for w in col_widths_in_inches:
        gridCol = OxmlElement("w:gridCol")
        gridCol.set(qn("w:w"), str(int(w * 1440)))
        tblGrid.append(gridCol)
    table._tbl.insert(0, tblGrid)


def clean_container_cell(cell, tables, gap_pt: float = 0):
    """Attaches tables to cell._tc. When gap_pt > 0, inserts a tiny separator paragraph between tables."""
    cell._tc.get_or_add_tcPr()
    for child in list(cell._tc):
        if child.tag.endswith('tcPr'):
            continue
        cell._tc.remove(child)

    for idx, tbl in enumerate(tables):
        if idx > 0 and gap_pt > 0:
            p_sep = OxmlElement('w:p')
            pPr = OxmlElement('w:pPr')
            spacing = OxmlElement('w:spacing')
            spacing.set(qn('w:before'), '0')
            spacing.set(qn('w:after'), str(int(gap_pt * 20)))
            spacing.set(qn('w:line'), str(int(gap_pt * 20)))
            spacing.set(qn('w:lineRule'), 'exact')
            pPr.append(spacing)
            rPr_elem = OxmlElement('w:rPr')
            sz_elem = OxmlElement('w:sz')
            sz_elem.set(qn('w:val'), '4')  # 2pt font — invisible
            rPr_elem.append(sz_elem)
            p_sep.append(pPr)
            cell._tc.append(p_sep)
        cell._tc.append(tbl._tbl)

    p_end = OxmlElement('w:p')
    pPr = OxmlElement('w:pPr')
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), '0')
    spacing.set(qn('w:after'), '0')
    spacing.set(qn('w:line'), '20')
    spacing.set(qn('w:lineRule'), 'exact')
    pPr.append(spacing)
    p_end.append(pPr)
    cell._tc.append(p_end)


def add_text(parent, text: str, font_size: float = 7.5, bold: bool = False, color_rgb=(0, 0, 0), alignment=WD_ALIGN_PARAGRAPH.LEFT):
    if hasattr(parent, "paragraphs"):
        p = parent.paragraphs[0]
    else:
        p = parent
    p.alignment = alignment
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(str(text))
    run.font.name = "Arial"
    run.font.size = Pt(font_size)
    run.bold = bold
    run.font.color.rgb = RGBColor(*color_rgb)
    return run


# Request Model
class CostEstimationSheetRequest(BaseModel):
    start_year: Optional[Any] = 2026
    end_year: Optional[Any] = 2028
    fy_labels: Optional[List[str]] = None
    format_no: Optional[str] = ""
    prepared_on: Optional[str] = ""
    project_no: Optional[str] = ""
    project_title: Optional[str] = ""
    account_heads: Optional[Dict[str, Any]] = None
    revenue_projection: Optional[Dict[str, Any]] = None
    infra_details: Optional[Dict[str, Any]] = None
    tech_hr_details: Optional[Dict[str, Any]] = None
    staff_charges: Optional[Dict[str, Any]] = None
    equipment_details: Optional[List[Dict[str, Any]]] = None
    comments_notes: Optional[str] = ""
    signatures: Optional[Dict[str, Any]] = None
    filename: Optional[str] = "Project_Cost_Estimation_Sheet.docx"


def format_val(v):
    """Format a number value in Indian comma style with ₹ prefix (e.g. ₹ 1,00,000).
    - NA / NIL / N/A are passed through as-is.
    - Empty / None values return '-' (dash) so Word cells are never blank.
    """
    if v is None or str(v).strip() == "":
        return "-"
    cleaned = str(v).strip()
    # Passthrough text markers (normalized to uppercase)
    if cleaned.upper() in ("NA", "NIL", "N/A", "N.A", "N.A.", "NONE", "NOT APPLICABLE", "NULL", "-"):
        return cleaned.upper()
    try:
        f = float(cleaned.replace("\u20b9", "").replace(",", "").strip())
        if f == 0:
            return "\u20b9 0"
        # Handle negative
        negative = f < 0
        f = abs(f)
        if f != int(f):
            # Decimal case: format integer part in Indian style, keep 2 decimal places
            int_part = int(f)
            dec_part = round(f - int_part, 2)
            dec_str = f"{dec_part:.2f}"[1:]  # ".XX"
        else:
            int_part = int(f)
            dec_str = ""
        # Indian grouping: last 3 digits, then groups of 2
        s = str(int_part)
        if len(s) <= 3:
            result = s
        else:
            last3 = s[-3:]
            rest = s[:-3]
            groups = []
            while len(rest) > 2:
                groups.append(rest[-2:])
                rest = rest[:-2]
            if rest:
                groups.append(rest)
            groups.reverse()
            result = ",".join(groups) + "," + last3
        result = result + dec_str
        prefix = "\u20b9 "
        return (f"-{prefix}{result}") if negative else f"{prefix}{result}"
    except (ValueError, TypeError):
        return str(v)



def create_cost_estimation_sheet_document(
    start_year: Optional[int] = 2026,
    end_year: Optional[int] = 2028,
    fy_labels: Optional[List[str]] = None,
    format_no: str = "",
    prepared_on: str = "",
    project_no: str = "",
    project_title: str = "",
    account_heads: Optional[Dict[str, Any]] = None,
    revenue_projection: Optional[Dict[str, Any]] = None,
    infra_details: Optional[Dict[str, Any]] = None,
    tech_hr_details: Optional[Dict[str, Any]] = None,
    staff_charges: Optional[Dict[str, Any]] = None,
    equipment_details: Optional[List[Dict[str, Any]]] = None,
    comments_notes: str = "",
    signatures: Optional[Dict[str, Any]] = None,
    **kwargs
) -> Document:
    doc = Document()

    # Exact A4 Landscape Setup (360 dxa = 0.25 in margins)
    for section in doc.sections:
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = Inches(11.69)
        section.page_height = Inches(8.27)
        section.top_margin = Inches(0.25)
        section.bottom_margin = Inches(0.25)
        section.left_margin = Inches(0.25)
        section.right_margin = Inches(0.25)

    border_black = {"val": "single", "sz": "4", "color": "000000"}
    border_none = {"val": "none"}
    grey_shd = "E6E6E6"
    light_grey_shd = "F0F0F0"
    dark_grey_shd = "D0D0D0"

    # Compute FY labels if not provided
    if not fy_labels:
        s = int(start_year or 2026)
        e = int(end_year or 2028)
        fy_labels = [f"FY ({str(y)[-2:]}-{str(y+1)[-2:]})" for y in range(s, e + 1)]

    # =========================================================================
    # MASTER 3-COLUMN CONTAINER TABLE (Balanced Layout)
    # Left (COD): 4.55 in, Middle (Sub-tables): 2.35 in, Right (Equipment): 3.90 in
    # Total Width = 10.80 in — leaves 0.39 in buffer so Column 3 never clips
    # =========================================================================
    master_tbl = doc.add_table(rows=1, cols=3)
    master_tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    master_tbl.autofit = False

    set_table_fixed_grid(master_tbl, [4.55, 2.35, 3.90])
    set_cell_width(master_tbl.rows[0].cells[0], 4.55)
    set_cell_width(master_tbl.rows[0].cells[1], 2.35)
    set_cell_width(master_tbl.rows[0].cells[2], 3.90)

    for cell in master_tbl.rows[0].cells:
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
        set_cell_border(cell, top=border_none, bottom=border_none, left=border_none, right=border_none)
        set_cell_margins(cell, top=0, bottom=0, start=0, end=0)

    c_left = master_tbl.rows[0].cells[0]
    c_mid = master_tbl.rows[0].cells[1]
    c_right = master_tbl.rows[0].cells[2]

    # Add a left margin gap to Column 3 so it is visually separated from Column 2
    set_cell_margins(c_right, top=0, bottom=0, start=108, end=0)  # 108 dxa ≈ 0.075 in gap

    # -------------------------------------------------------------------------
    # COLUMN 1 (LEFT, 4.70 in): INFO BOX + MAIN ACCOUNT HEADS TABLE
    # -------------------------------------------------------------------------
    # Table 1: Institute Info Box (4.45 in)
    t_info = doc.add_table(rows=5, cols=2)
    t_info.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_info.autofit = False
    set_table_fixed_grid(t_info, [1.05, 3.40])

    # Row 0: Central Manufacturing Technology Institute (Merged)
    t_info.rows[0].cells[0].merge(t_info.rows[0].cells[1])
    set_cell_width(t_info.rows[0].cells[0], 4.45)
    set_cell_shading(t_info.rows[0].cells[0], grey_shd)
    add_text(t_info.rows[0].cells[0], "Central Manufacturing Technology Institute\nISO 9001:2015", font_size=7.5, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Row 1: Prepared on: ______________ (Merged)
    t_info.rows[1].cells[0].merge(t_info.rows[1].cells[1])
    set_cell_width(t_info.rows[1].cells[0], 4.45)
    add_text(t_info.rows[1].cells[0], f"Prepared on: {prepared_on or '______________'}", font_size=7.0)

    # Row 2: PROJECT COST ESTIMATION SHEET (Merged)
    t_info.rows[2].cells[0].merge(t_info.rows[2].cells[1])
    set_cell_width(t_info.rows[2].cells[0], 4.45)
    set_cell_shading(t_info.rows[2].cells[0], grey_shd)
    add_text(t_info.rows[2].cells[0], "PROJECT COST ESTIMATION SHEET", font_size=7.5, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Row 3: Project No.: | [val]
    set_cell_width(t_info.rows[3].cells[0], 1.05)
    set_cell_width(t_info.rows[3].cells[1], 3.40)
    add_text(t_info.rows[3].cells[0], "Project No.:", font_size=7.0, bold=True)
    add_text(t_info.rows[3].cells[1], str(project_no or ""), font_size=7.0)

    # Row 4: Project Title: | [val]
    set_cell_width(t_info.rows[4].cells[0], 1.05)
    set_cell_width(t_info.rows[4].cells[1], 3.40)
    add_text(t_info.rows[4].cells[0], "Project Title:", font_size=7.0, bold=True)
    add_text(t_info.rows[4].cells[1], str(project_title or ""), font_size=7.0)

    for r in t_info.rows:
        r.height = Pt(14.0)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for c in r.cells:
            set_cell_border(c, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(c, top=6, bottom=6, start=8, end=8)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Table 2: Account Heads Table (4.60 in, dynamically scaled for all FY columns)
    ah_rows_def = [
        ("C1", "Infrastructure Dev. Cost (Works & Services)", "C1"),
        ("C2", "Site preparation at customer site (W&S)", "C2"),
        ("C3", "Equipment / Apparatus / Instruments @ CMTI", "C3"),
        ("C4", "Subsystems / Apparatus required for product", "C4"),
        ("C", "Capital Cost (C1+C2+C3)", "C"),
        ("R1", "TA/DA - India", "R1"),
        ("R2", "TA/DA - Abroad", "R2"),
        ("R3", "Project consumables", "R3"),
        ("R4", "Equipment Maintenance", "R4"),
        ("R5", "Prototype Dev. Cost", "R5"),
        ("R6", "Tech. HR (temporary staff)", "R6"),
        ("R7", "Contingency", "R7"),
        ("R", "Recurring Cost (R1+R2+R3+R4+R5+R6+R7)", "R"),
        ("PEC", "C+R", "PEC"),
        ("E1", "Scientific Input - Staff Salary", "E1"),
        ("E2", "R&D support charges incl. equipment utilization", "E2"),
        ("E3", "Institute Overheads", "E3"),
        ("E", "Total Establishment Cost (E1+E2+E3)", "E"),
        ("TPC", "Total Project Cost (C+R+E)", "TPC"),
    ]

    ah_data = account_heads or {}

    def get_ah_tot(key):
        if not account_heads:
            return 0.0
        v = account_heads.get(key)
        if isinstance(v, dict):
            try:
                cleaned = str(v.get("total", 0)).replace("₹", "").replace(",", "").strip()
                return float(cleaned or 0)
            except (ValueError, TypeError):
                return 0.0
        elif isinstance(v, (int, float)):
            return float(v)
        return 0.0

    num_fy = len(fy_labels)
    total_cols = 2 + num_fy + 1 # COD, Account Heads, FYs..., Total

    t_ah = doc.add_table(rows=len(ah_rows_def) + 1, cols=total_cols)
    t_ah.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_ah.autofit = False

    cod_w = 0.38
    total_w = 0.72
    avail_w = 4.45 - cod_w - total_w # 3.35 in for label + FY cols

    if num_fy <= 1:
        fy_w = 0.85
    elif num_fy == 2:
        fy_w = 0.65
    elif num_fy == 3:
        fy_w = 0.52
    elif num_fy == 4:
        fy_w = 0.44
    elif num_fy == 5:
        fy_w = 0.38
    else:
        fy_w = max(0.28, 1.80 / num_fy)
    label_w = round(avail_w - (fy_w * num_fy), 2)

    # Dynamic font sizing based on columns
    if num_fy <= 3:
        data_f_sz = 6.4
        hdr_f_sz = 6.8
    elif num_fy <= 5:
        data_f_sz = 5.8
        hdr_f_sz = 6.2
    else:
        data_f_sz = 5.2
        hdr_f_sz = 5.5

    ah_col_widths = [cod_w, label_w] + [fy_w] * num_fy + [total_w]
    set_table_fixed_grid(t_ah, ah_col_widths)

    for r in t_ah.rows:
        r.height = Pt(14.5)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        set_cell_width(r.cells[0], cod_w)
        set_cell_width(r.cells[1], label_w)
        for c_i in range(num_fy):
            set_cell_width(r.cells[2 + c_i], fy_w)
        set_cell_width(r.cells[total_cols - 1], total_w)

        for c in r.cells:
            set_cell_border(c, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(c, top=14, bottom=14, start=6, end=6)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Header Row
    p_h0 = t_ah.rows[0].cells[0].paragraphs[0]
    p_h0.paragraph_format.space_before = Pt(1)
    p_h0.paragraph_format.space_after = Pt(1)
    add_text(p_h0, "COD", font_size=hdr_f_sz, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    p_h1 = t_ah.rows[0].cells[1].paragraphs[0]
    p_h1.paragraph_format.space_before = Pt(1)
    p_h1.paragraph_format.space_after = Pt(1)
    add_text(p_h1, "Account Heads", font_size=hdr_f_sz, bold=True)

    for c_i, fy_label in enumerate(fy_labels):
        p_hfy = t_ah.rows[0].cells[2 + c_i].paragraphs[0]
        p_hfy.paragraph_format.space_before = Pt(1)
        p_hfy.paragraph_format.space_after = Pt(1)
        add_text(p_hfy, fy_label, font_size=hdr_f_sz - 0.4, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    p_htot = t_ah.rows[0].cells[total_cols - 1].paragraphs[0]
    p_htot.paragraph_format.space_before = Pt(1)
    p_htot.paragraph_format.space_after = Pt(1)
    add_text(p_htot, "Total", font_size=hdr_f_sz, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    for c in t_ah.rows[0].cells:
        set_cell_shading(c, grey_shd)

    # Data Rows
    for i, (cod, desc, key) in enumerate(ah_rows_def):
        row = t_ah.rows[i + 1]
        is_subtotal = cod in ("C", "R", "PEC", "E")
        is_grand_total = cod == "TPC"

        row_vals = ah_data.get(key) or {}
        val_list = []
        if isinstance(row_vals, dict):
            if "values" in row_vals and isinstance(row_vals["values"], list):
                val_list = row_vals["values"]
            elif "val" in row_vals and isinstance(row_vals["val"], list):
                val_list = row_vals["val"]
        elif isinstance(row_vals, list):
            val_list = row_vals

        p0 = row.cells[0].paragraphs[0]
        p0.paragraph_format.space_before = Pt(1)
        p0.paragraph_format.space_after = Pt(1)
        add_text(p0, cod, font_size=data_f_sz, bold=(is_subtotal or is_grand_total), alignment=WD_ALIGN_PARAGRAPH.CENTER)

        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.space_before = Pt(1)
        p1.paragraph_format.space_after = Pt(1)
        add_text(p1, desc, font_size=data_f_sz, bold=(is_subtotal or is_grand_total))

        # Fill each FY column
        for c_i in range(num_fy):
            val_fy = ""
            if c_i < len(val_list):
                val_fy = format_val(val_list[c_i])
            elif isinstance(row_vals, dict):
                val_fy = format_val(row_vals.get(str(c_i)) or row_vals.get(f"fy_{c_i}"))
            elif isinstance(ah_data.get(f"{key}_fy_{c_i}"), (int, float, str)):
                val_fy = format_val(ah_data.get(f"{key}_fy_{c_i}"))

            pfy = row.cells[2 + c_i].paragraphs[0]
            pfy.paragraph_format.space_before = Pt(1)
            pfy.paragraph_format.space_after = Pt(1)
            add_text(pfy, val_fy, font_size=data_f_sz, bold=(is_subtotal or is_grand_total), alignment=WD_ALIGN_PARAGRAPH.RIGHT)

        # Fill Total column
        tot_val = ""
        if isinstance(row_vals, dict) and "total" in row_vals:
            tot_val = format_val(row_vals["total"])
        elif isinstance(ah_data.get(f"{key}_total"), (int, float, str)):
            tot_val = format_val(ah_data.get(f"{key}_total"))
        elif isinstance(ah_data.get(key), (int, float, str)):
            tot_val = format_val(ah_data.get(key))

        ptot = row.cells[total_cols - 1].paragraphs[0]
        ptot.paragraph_format.space_before = Pt(1)
        ptot.paragraph_format.space_after = Pt(1)
        add_text(ptot, tot_val, font_size=data_f_sz, bold=(is_subtotal or is_grand_total), alignment=WD_ALIGN_PARAGRAPH.RIGHT)

        if is_grand_total:
            for c in row.cells:
                set_cell_shading(c, dark_grey_shd)
        elif is_subtotal:
            for c in row.cells:
                set_cell_shading(c, light_grey_shd)

    clean_container_cell(c_left, [t_info, t_ah])

    # -------------------------------------------------------------------------
    # COLUMN 2 (MIDDLE, 2.35 in container): REVENUE + INFRASTRUCTURE + TECHNICAL HR + STAFF CHARGES
    # (Tables set to 2.22 in width to leave breathing room from outer container boundary)
    # -------------------------------------------------------------------------
    # Table 3: Estimated Revenue Projection (2.22 in)
    rev_data = revenue_projection or {}
    t_rev = doc.add_table(rows=5, cols=2)
    t_rev.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_rev.autofit = False
    set_table_fixed_grid(t_rev, [1.44, 0.78])

    for r in t_rev.rows:
        r.height = Pt(13.0)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        set_cell_width(r.cells[0], 1.44)
        set_cell_width(r.cells[1], 0.78)
        for c in r.cells:
            set_cell_border(c, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(c, top=10, bottom=10, start=5, end=5)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Row 0: Header (Merged)
    t_rev.rows[0].cells[0].merge(t_rev.rows[0].cells[1])
    set_cell_width(t_rev.rows[0].cells[0], 2.22)
    set_cell_shading(t_rev.rows[0].cells[0], grey_shd)
    add_text(t_rev.rows[0].cells[0], "Estimated Revenue Projection", font_size=7.3, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Row 1: (Empty) | Estimated Cost
    add_text(t_rev.rows[1].cells[0], "", font_size=6.7)
    set_cell_shading(t_rev.rows[1].cells[1], grey_shd)
    add_text(t_rev.rows[1].cells[1], "Estimated Cost", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Row 2: External Work
    ext_val = rev_data.get("external_work", "")
    add_text(t_rev.rows[2].cells[0], "External Work", font_size=6.7)
    add_text(t_rev.rows[2].cells[1], format_val(ext_val), font_size=6.7, alignment=WD_ALIGN_PARAGRAPH.RIGHT)

    # Row 3: Internal Work
    int_val = rev_data.get("internal_work", "")
    add_text(t_rev.rows[3].cells[0], "Internal Work", font_size=6.7)
    add_text(t_rev.rows[3].cells[1], format_val(int_val), font_size=6.7, alignment=WD_ALIGN_PARAGRAPH.RIGHT)

    # Row 4: Total
    tot_rev = rev_data.get("total", "")
    add_text(t_rev.rows[4].cells[0], "Total", font_size=6.7, bold=True)
    add_text(t_rev.rows[4].cells[1], format_val(tot_rev), font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.RIGHT)

    # Table 4: Details of Infrastructure Development (2.22 in)
    sub_col_widths_mid = [0.26, 1.18, 0.78]
    infra = infra_details or {}
    
    infra_total_val = infra.get("total_c1_c2") or infra.get("total_c1") or ""
    if (infra_total_val == "" or infra_total_val is None or str(infra_total_val) == "0") and account_heads:
        c12 = get_ah_tot("C1") + get_ah_tot("C2")
        if c12 > 0:
            infra_total_val = c12

    infra_rows = [
        ("1", "Civil", infra.get("civil", "")),
        ("2", "Electrical", infra.get("electrical", "")),
        ("3", "AC / Clean Room", infra.get("ac_clean_room", "")),
        ("4", "Furniture / Utilities", infra.get("furniture_utilities", "")),
        ("", "Total (C1+C2)", infra_total_val),
    ]

    t_inf = doc.add_table(rows=len(infra_rows) + 2, cols=3)
    t_inf.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_inf.autofit = False
    set_table_fixed_grid(t_inf, sub_col_widths_mid)

    for r in t_inf.rows:
        r.height = Pt(13.0)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for idx, cell in enumerate(r.cells):
            set_cell_width(cell, sub_col_widths_mid[idx])
            set_cell_border(cell, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(cell, top=8, bottom=8, start=5, end=5)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Header Row 0 (Merged)
    t_inf.rows[0].cells[0].merge(t_inf.rows[0].cells[1]).merge(t_inf.rows[0].cells[2])
    set_cell_width(t_inf.rows[0].cells[0], 2.22)
    set_cell_shading(t_inf.rows[0].cells[0], grey_shd)
    add_text(t_inf.rows[0].cells[0], "Details of Infrastructure Development", font_size=7.3, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Sub-header Row 1
    add_text(t_inf.rows[1].cells[0], "SN", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(t_inf.rows[1].cells[1], "Description", font_size=6.7, bold=True)
    add_text(t_inf.rows[1].cells[2], "Estimated Cost", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    for c in t_inf.rows[1].cells:
        set_cell_shading(c, grey_shd)

    for i, (sn, desc, val) in enumerate(infra_rows):
        row = t_inf.rows[i + 2]
        is_tot = sn == ""
        add_text(row.cells[0], sn, font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        add_text(row.cells[1], desc, font_size=6.3, bold=is_tot)
        add_text(row.cells[2], format_val(val), font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.RIGHT)
        if is_tot:
            for c in row.cells:
                set_cell_shading(c, light_grey_shd)

    # Table 5: Details of Technical HR (2.22 in)
    tech = tech_hr_details or {}
    tech_total_val = tech.get("total_r6", "")
    if (tech_total_val == "" or tech_total_val is None or str(tech_total_val) == "0") and account_heads:
        r6_val = get_ah_tot("R6")
        if r6_val > 0:
            tech_total_val = r6_val

    tech_rows = [
        ("1", "Consultant / Experts", tech.get("consultant_experts", "")),
        ("2", "RA / SRF / JRF", tech.get("ra_srf_jrf", "")),
        ("3", "Proj . Engineers / Fellow", tech.get("proj_engineers_fellow", "")),
        ("4", "Support Staff Hiring", tech.get("support_staff", "")),
        ("", "Total Tech. HR (R6)", tech_total_val),
    ]

    t_thr = doc.add_table(rows=len(tech_rows) + 2, cols=3)
    t_thr.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_thr.autofit = False
    set_table_fixed_grid(t_thr, sub_col_widths_mid)

    for r in t_thr.rows:
        r.height = Pt(13.0)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for idx, cell in enumerate(r.cells):
            set_cell_width(cell, sub_col_widths_mid[idx])
            set_cell_border(cell, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(cell, top=8, bottom=8, start=5, end=5)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Header Row 0 (Merged)
    t_thr.rows[0].cells[0].merge(t_thr.rows[0].cells[1]).merge(t_thr.rows[0].cells[2])
    set_cell_width(t_thr.rows[0].cells[0], 2.22)
    set_cell_shading(t_thr.rows[0].cells[0], grey_shd)
    add_text(t_thr.rows[0].cells[0], "Details of Technical HR", font_size=7.3, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Sub-header Row 1
    add_text(t_thr.rows[1].cells[0], "SN", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(t_thr.rows[1].cells[1], "Technical HR", font_size=6.7, bold=True)
    add_text(t_thr.rows[1].cells[2], "Estimated Cost", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    for c in t_thr.rows[1].cells:
        set_cell_shading(c, grey_shd)

    for i, (sn, desc, val) in enumerate(tech_rows):
        row = t_thr.rows[i + 2]
        is_tot = sn == ""
        add_text(row.cells[0], sn, font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        add_text(row.cells[1], desc, font_size=6.3, bold=is_tot)
        add_text(row.cells[2], format_val(val), font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.RIGHT)
        if is_tot:
            for c in row.cells:
                set_cell_shading(c, light_grey_shd)

    # Table 6: Regular Staff Charges (2.22 in)
    staff = staff_charges or {}
    staff_total_val = staff.get("total_e1", "")
    if (staff_total_val == "" or staff_total_val is None or str(staff_total_val) == "0") and account_heads:
        e1_val = get_ah_tot("E1")
        if e1_val > 0:
            staff_total_val = e1_val

    staff_rows = [
        ("1", "Sct . E &  Above", staff.get("sct_e_above", "")),
        ("2", "Sct . B to D & STO", staff.get("sct_b_d_sto", "")),
        ("3", "Technical Staff", staff.get("technical_staff", "")),
        ("", "Total (E1)", staff_total_val),
    ]

    t_stf = doc.add_table(rows=len(staff_rows) + 2, cols=3)
    t_stf.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_stf.autofit = False
    set_table_fixed_grid(t_stf, sub_col_widths_mid)

    for r in t_stf.rows:
        r.height = Pt(13.0)
        r.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for idx, cell in enumerate(r.cells):
            set_cell_width(cell, sub_col_widths_mid[idx])
            set_cell_border(cell, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(cell, top=8, bottom=8, start=5, end=5)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Header Row 0 (Merged)
    t_stf.rows[0].cells[0].merge(t_stf.rows[0].cells[1]).merge(t_stf.rows[0].cells[2])
    set_cell_width(t_stf.rows[0].cells[0], 2.22)
    set_cell_shading(t_stf.rows[0].cells[0], grey_shd)
    add_text(t_stf.rows[0].cells[0], "Regular Staff Charges", font_size=7.3, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Sub-header Row 1
    add_text(t_stf.rows[1].cells[0], "SN", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(t_stf.rows[1].cells[1], "Levels", font_size=6.7, bold=True)
    add_text(t_stf.rows[1].cells[2], "Estimated Cost", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    for c in t_stf.rows[1].cells:
        set_cell_shading(c, grey_shd)

    for i, (sn, desc, val) in enumerate(staff_rows):
        row = t_stf.rows[i + 2]
        is_tot = sn == ""
        add_text(row.cells[0], sn, font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        add_text(row.cells[1], desc, font_size=6.3, bold=is_tot)
        add_text(row.cells[2], format_val(val), font_size=6.3, bold=is_tot, alignment=WD_ALIGN_PARAGRAPH.RIGHT)
        if is_tot:
            for c in row.cells:
                set_cell_shading(c, light_grey_shd)

    clean_container_cell(c_mid, [t_rev, t_inf, t_thr, t_stf], gap_pt=4)

    # -------------------------------------------------------------------------
    # COLUMN 3 (RIGHT, 4.09 in): DETAILS OF EQUIPMENTS / APPARATUS / INSTRUMENTS
    # -------------------------------------------------------------------------
    eq_list = equipment_details or []
    if not eq_list:
        eq_list = [{"equipment": "", "cost": ""}]

    t_eq = doc.add_table(rows=len(eq_list) + 3, cols=3)
    t_eq.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_eq.autofit = False

    eq_col_widths = [0.27, 2.68, 0.85]
    set_table_fixed_grid(t_eq, eq_col_widths)

    for r in t_eq.rows:
        set_cell_width(r.cells[0], 0.27)
        set_cell_width(r.cells[1], 2.68)
        set_cell_width(r.cells[2], 0.85)
        for c in r.cells:
            set_cell_border(c, top=border_black, bottom=border_black, left=border_black, right=border_black)
            set_cell_margins(c, top=4, bottom=4, start=6, end=6)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    # Row 0: Header (Merged across 3 cols)
    t_eq.rows[0].cells[0].merge(t_eq.rows[0].cells[1]).merge(t_eq.rows[0].cells[2])
    set_cell_width(t_eq.rows[0].cells[0], 3.80)
    set_cell_shading(t_eq.rows[0].cells[0], grey_shd)
    add_text(t_eq.rows[0].cells[0], "Details of Equipments / Apparatus / Instruments", font_size=7.3, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Row 1: SN | Equipment | Estimated Cost
    add_text(t_eq.rows[1].cells[0], "SN", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(t_eq.rows[1].cells[1], "Equipment", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    add_text(t_eq.rows[1].cells[2], "Estimated Cost", font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    for c in t_eq.rows[1].cells:
        set_cell_shading(c, grey_shd)

    # Dynamic Items
    eq_tot = 0.0
    for idx, item in enumerate(eq_list):
        row = t_eq.rows[idx + 2]
        add_text(row.cells[0], str(idx + 1), font_size=6.3, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        add_text(row.cells[1], str(item.get("equipment", "") or ""), font_size=6.3)
        c_val = str(item.get("cost", "") or "")
        try:
            eq_tot += float(c_val.replace(",", "").strip())
        except (ValueError, TypeError):
            pass
        add_text(row.cells[2], format_val(c_val), font_size=6.3, alignment=WD_ALIGN_PARAGRAPH.RIGHT)

    # Total row (Merged SN & Equipment)
    tot_eq_row = t_eq.rows[len(eq_list) + 2]
    tot_eq_row.cells[0].merge(tot_eq_row.cells[1])
    set_cell_width(tot_eq_row.cells[0], 2.95)
    add_text(tot_eq_row.cells[0], "Total (C3+C4)", font_size=6.7, bold=True)
    
    final_eq_tot = eq_tot
    if (final_eq_tot == 0 or str(final_eq_tot) == "0") and account_heads:
        c34 = get_ah_tot("C3") + get_ah_tot("C4")
        if c34 > 0:
            final_eq_tot = c34
    add_text(tot_eq_row.cells[2], format_val(final_eq_tot), font_size=6.7, bold=True, alignment=WD_ALIGN_PARAGRAPH.RIGHT)

    clean_container_cell(c_right, [t_eq])

    # =========================================================================
    # COMMENTS / NOTES & 6 SIGNATURES (Properly aligned below master table)
    # =========================================================================
    # Table 8: Comments / Notes Table (10.80 in = master table width)
    t_notes = doc.add_table(rows=1, cols=1)
    t_notes.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_notes.autofit = False
    set_table_fixed_grid(t_notes, [10.80])
    set_cell_width(t_notes.rows[0].cells[0], 10.80)
    set_cell_border(t_notes.rows[0].cells[0], top=border_none, bottom=border_none, left=border_none, right=border_none)
    set_cell_margins(t_notes.rows[0].cells[0], top=40, bottom=40, start=6, end=6)
    add_text(
        t_notes.rows[0].cells[0],
        f"Comments/Notes: {comments_notes or '____________________________________________________________________________________'}",
        font_size=7.5,
        bold=False
    )

    # Table 9: 6 Signatures Table (6 columns x 1.80 in = 10.80 in)
    t_sig = doc.add_table(rows=2, cols=6)
    t_sig.alignment = WD_TABLE_ALIGNMENT.LEFT
    t_sig.autofit = False
    set_table_fixed_grid(t_sig, [1.80] * 6)

    # Determine GH, CH, and CAO titles from payload (user-editable)
    gh_text = "Group Head"
    ch_text = "Centre Head"
    cao_text = "Chief Accounts Officer"
    if isinstance(signatures, dict):
        gh_text = signatures.get("group_head_title") or signatures.get("gh_title") or signatures.get("group_head") or "Group Head"
        ch_text = signatures.get("centre_head_title") or signatures.get("ch_title") or signatures.get("centre_head") or "Centre Head"
        cao_text = signatures.get("cao_title") or signatures.get("cao") or "Chief Accounts Officer"
    else:
        if kwargs.get("group_head_title"):
            gh_text = str(kwargs.get("group_head_title"))
        if kwargs.get("centre_head_title"):
            ch_text = str(kwargs.get("centre_head_title"))
        if kwargs.get("cao_title"):
            cao_text = str(kwargs.get("cao_title"))

    sig_titles = [
        "Project Leader / Project Co-Ordinator",
        str(gh_text),
        str(ch_text),
        str(cao_text),
        "Head (PPM)",
        "Director"
    ]
    sig_width = 1.80

    # Row 0: Blank space for signing (taller for more space below content)
    t_sig.rows[0].height = Pt(40)
    t_sig.rows[0].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    for idx, cell in enumerate(t_sig.rows[0].cells):
        set_cell_width(cell, sig_width)
        set_cell_border(cell, top=border_none, bottom=border_none, left=border_none, right=border_none)
        set_cell_margins(cell, top=10, bottom=0, start=6, end=6)

    # Row 1: Signature title — NO top border line, with bottom spacing
    t_sig.rows[1].height = Pt(16)
    t_sig.rows[1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    for idx, cell in enumerate(t_sig.rows[1].cells):
        set_cell_width(cell, sig_width)
        set_cell_border(cell, top=border_none, bottom=border_none, left=border_none, right=border_none)
        set_cell_margins(cell, top=10, bottom=0, start=6, end=6)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        add_text(p, sig_titles[idx], font_size=6.5, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    return doc



def format_val_excel(v):
    """Format a number value in Indian comma style without currency symbol for Excel table cells."""
    if v is None or str(v).strip() == "":
        return "-"
    cleaned = str(v).strip()
    if cleaned.upper() in ("NA", "NIL", "N/A", "N.A", "N.A.", "NONE", "NOT APPLICABLE", "NULL", "-"):
        return cleaned.upper()
    try:
        f = float(cleaned.replace("₹", "").replace(",", "").strip())
        if f == 0:
            return "-"
        negative = f < 0
        f = abs(f)
        if f != int(f):
            int_part = int(f)
            dec_part = round(f - int_part, 2)
            dec_str = f"{dec_part:.2f}"[1:]
        else:
            int_part = int(f)
            dec_str = ""
        s = str(int_part)
        if len(s) <= 3:
            result = s
        else:
            last3 = s[-3:]
            rest = s[:-3]
            groups = []
            while len(rest) > 2:
                groups.append(rest[-2:])
                rest = rest[:-2]
            if rest:
                groups.append(rest)
            groups.reverse()
            result = ",".join(groups) + "," + last3
        result = result + dec_str
        return f"-{result}" if negative else result
    except Exception:
        return cleaned


def create_cost_estimation_sheet_excel(
    start_year: Optional[int] = 2026,
    end_year: Optional[int] = 2028,
    fy_labels: Optional[List[str]] = None,
    format_no: str = "",
    prepared_on: str = "",
    project_no: str = "",
    project_title: str = "",
    account_heads: Optional[Dict[str, Any]] = None,
    revenue_projection: Optional[Dict[str, Any]] = None,
    infra_details: Optional[Dict[str, Any]] = None,
    tech_hr_details: Optional[Dict[str, Any]] = None,
    staff_charges: Optional[Dict[str, Any]] = None,
    equipment_details: Optional[List[Dict[str, Any]]] = None,
    comments_notes: str = "",
    **kwargs
) -> io.BytesIO:
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    ws = workbook.add_worksheet("Cost Estimation")

    # Gridlines visible
    ws.hide_gridlines(0)

    # Base font
    font_name = "Arial"

    # Formats
    fmt_border = workbook.add_format({'border': 1, 'font_name': font_name, 'font_size': 9, 'valign': 'vcenter'})
    fmt_border_center = workbook.add_format({'border': 1, 'font_name': font_name, 'font_size': 9, 'align': 'center', 'valign': 'vcenter'})
    fmt_border_right = workbook.add_format({'border': 1, 'font_name': font_name, 'font_size': 9, 'align': 'right', 'valign': 'vcenter'})

    fmt_hdr_title = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 11, 'bold': True, 'align': 'center', 'valign': 'vcenter',
        'bg_color': '#EFEFEF', 'text_wrap': True
    })
    fmt_hdr_section = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9.5, 'bold': True, 'align': 'center', 'valign': 'vcenter',
        'bg_color': '#D9D9D9'
    })
    fmt_col_hdr = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9, 'bold': True, 'align': 'center', 'valign': 'vcenter',
        'bg_color': '#EFEFEF', 'text_wrap': True
    })
    fmt_subtot = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9, 'bold': True, 'valign': 'vcenter',
        'bg_color': '#F4F4F4', 'text_wrap': True
    })
    fmt_subtot_center = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9, 'bold': True, 'align': 'center', 'valign': 'vcenter',
        'bg_color': '#F4F4F4'
    })
    fmt_subtot_right = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9, 'bold': True, 'align': 'right', 'valign': 'vcenter',
        'bg_color': '#F4F4F4'
    })
    fmt_grand_tot = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9.5, 'bold': True, 'valign': 'vcenter',
        'bg_color': '#D9D9D9', 'text_wrap': True
    })
    fmt_grand_tot_center = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9.5, 'bold': True, 'align': 'center', 'valign': 'vcenter',
        'bg_color': '#D9D9D9'
    })
    fmt_grand_tot_right = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 9.5, 'bold': True, 'align': 'right', 'valign': 'vcenter',
        'bg_color': '#D9D9D9'
    })

    fmt_equip_desc = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 8.5, 'valign': 'top', 'text_wrap': True
    })
    fmt_equip_sn = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 8.5, 'align': 'center', 'valign': 'top'
    })
    fmt_equip_cost = workbook.add_format({
        'border': 1, 'font_name': font_name, 'font_size': 8.5, 'align': 'right', 'valign': 'top'
    })

    # FY Labels
    if not fy_labels:
        s = int(start_year or 2026)
        e = int(end_year or 2028)
        fy_labels = [f"({str(y)[-2:]}-{str(y+1)[-2:]})" for y in range(s, e + 1)]

    num_fy = len(fy_labels)
    ordinals = ["First Year", "Second Year", "Third Year", "Fourth Year", "Fifth Year", "Sixth Year", "Seventh Year"]

    total_col_idx = 2 + num_fy

    # Column widths
    ws.set_column(0, 0, 8)      # COD
    ws.set_column(1, 1, 36)     # Account Heads
    for i in range(num_fy):
        ws.set_column(2 + i, 2 + i, 14)
    ws.set_column(total_col_idx, total_col_idx, 15) # Total

    # Middle columns
    sep1_col = total_col_idx + 1
    ws.set_column(sep1_col, sep1_col, 2) # Separator 1

    mid_start = sep1_col + 1
    ws.set_column(mid_start, mid_start, 6)         # SN / Sl. No
    ws.set_column(mid_start + 1, mid_start + 1, 26)  # Description / Technical HR / Levels
    ws.set_column(mid_start + 2, mid_start + 2, 16)  # Estimated Cost

    # Right columns
    sep2_col = mid_start + 3
    ws.set_column(sep2_col, sep2_col, 2) # Separator 2

    right_start = sep2_col + 1
    ws.set_column(right_start, right_start, 6)         # Sl.
    ws.set_column(right_start + 1, right_start + 1, 36)  # Description of Equipment
    ws.set_column(right_start + 2, right_start + 2, 16)  # Estimated Cost

    # -------------------------------------------------------------
    # 1. LEFT BLOCK (MAIN TABLE)
    # -------------------------------------------------------------
    # Row 0: Central Manufacturing Technology Institute
    ws.merge_range(0, 0, 0, total_col_idx, "Central Manufacturing Technology Institute\nISO 9001:2015", fmt_hdr_title)
    ws.set_row(0, 32)

    # Row 1: Updated on: date
    updated_str = f"Updated on: {prepared_on}" if prepared_on else "Updated on: ______________"
    ws.merge_range(1, 0, 1, total_col_idx, updated_str, workbook.add_format({'font_name': font_name, 'font_size': 9, 'valign': 'vcenter', 'border': 1}))
    ws.set_row(1, 18)

    # Row 2: PROJECT COST ESTIMATION SHEET
    ws.merge_range(2, 0, 2, total_col_idx, "PROJECT COST ESTIMATION SHEET", fmt_hdr_section)
    ws.set_row(2, 20)

    # Row 3: Project No & Title
    proj_no_str = f"Project No.: {project_no}" if project_no else "Project No.:"
    proj_title_str = f'PROJECT TITLE: "{project_title}"' if project_title else 'PROJECT TITLE:'
    ws.merge_range(3, 0, 3, 1, proj_no_str, workbook.add_format({'font_name': font_name, 'font_size': 9, 'bold': True, 'valign': 'vcenter', 'border': 1, 'text_wrap': True}))
    ws.merge_range(3, 2, 3, total_col_idx, proj_title_str, workbook.add_format({'font_name': font_name, 'font_size': 9, 'bold': True, 'valign': 'vcenter', 'border': 1, 'text_wrap': True}))
    ws.set_row(3, 26)

    # Row 4: Table Headers
    ws.write(4, 0, "COD", fmt_col_hdr)
    ws.write(4, 1, "Account Heads", fmt_col_hdr)
    for i, fy_lbl in enumerate(fy_labels):
        ord_name = ordinals[i] if i < len(ordinals) else f"Year {i+1}"
        clean_lbl = str(fy_lbl).replace("FY ", "").strip()
        hdr_txt = f"{ord_name}\n{clean_lbl}"
        ws.write(4, 2 + i, hdr_txt, fmt_col_hdr)
    ws.write(4, total_col_idx, "Total", fmt_col_hdr)
    ws.set_row(4, 28)

    # Row 5: Column index numbers
    ws.write(5, 0, "", fmt_border_center)
    ws.write(5, 1, "", fmt_border_center)
    for i in range(num_fy):
        ws.write(5, 2 + i, str(i + 1), fmt_col_hdr)
    ws.write(5, total_col_idx, "", fmt_border_center)
    ws.set_row(5, 18)

    # Rows Definition
    ah_rows_def = [
        ("C1", "Infrastructure Dev. Cost\n(Works & Services)", "C1"),
        ("C2", "Site preparation at\ncustomer site (W&S)", "C2"),
        ("C3", "Equipment / Apparatus /\nInstruments @CMTI", "C3"),
        ("C4", "Subsystems/ Apparatus\nrequired for product", "C4"),
        ("C", "Capital Cost (C1+C2+C3)", "C"),
        ("R1", "TA/DA - India", "R1"),
        ("R2", "TA/DA - Abroad", "R2"),
        ("R3", "Project consumables", "R3"),
        ("R4", "Equipment Maintenance", "R4"),
        ("R5", "Prototype Dev.Cost", "R5"),
        ("R6", "Tech. HR (temporary staff)", "R6"),
        ("R7", "Contingency", "R7"),
        ("R", "Recurring Cost\n(R1+R2+R3+R4+R5+R6+R7)", "R"),
        ("PEC", "Project Execution Cost\n(P = C+R)", "PEC"),
        ("E1", "Scientific Input-Staff", "E1"),
        ("E2", "R&D support charges incl.\nequipment utilization", "E2"),
        ("E3", "Institute Overheads", "E3"),
        ("E", "Total Establishment Cost\n(E1+E2+E3)", "E"),
        ("TPC", "Total Project Cost (C+R+E)", "TPC"),
    ]

    ah_data = account_heads or {}
    start_row = 6

    for r_idx, (cod, desc, key) in enumerate(ah_rows_def):
        cur_row = start_row + r_idx
        is_subtotal = cod in ("C", "R", "PEC", "E")
        is_grand_total = cod == "TPC"

        f_desc = fmt_grand_tot if is_grand_total else (fmt_subtot if is_subtotal else fmt_border)
        f_center = fmt_grand_tot_center if is_grand_total else (fmt_subtot_center if is_subtotal else fmt_border_center)
        f_right = fmt_grand_tot_right if is_grand_total else (fmt_subtot_right if is_subtotal else fmt_border_right)

        ws.write(cur_row, 0, cod, f_center)
        ws.write(cur_row, 1, desc, f_desc)

        row_vals = ah_data.get(key) or {}
        val_list = []
        if isinstance(row_vals, dict):
            if "values" in row_vals and isinstance(row_vals["values"], list):
                val_list = row_vals["values"]
            elif "val" in row_vals and isinstance(row_vals["val"], list):
                val_list = row_vals["val"]
        elif isinstance(row_vals, list):
            val_list = row_vals

        for c_i in range(num_fy):
            val_fy = ""
            if c_i < len(val_list):
                val_fy = format_val_excel(val_list[c_i])
            elif isinstance(row_vals, dict):
                val_fy = format_val_excel(row_vals.get(str(c_i)) or row_vals.get(f"fy_{c_i}"))
            elif isinstance(ah_data.get(f"{key}_fy_{c_i}"), (int, float, str)):
                val_fy = format_val_excel(ah_data.get(f"{key}_fy_{c_i}"))

            ws.write(cur_row, 2 + c_i, val_fy, f_right)

        tot_val = ""
        if isinstance(row_vals, dict) and "total" in row_vals:
            tot_val = format_val_excel(row_vals["total"])
        elif isinstance(ah_data.get(f"{key}_total"), (int, float, str)):
            tot_val = format_val_excel(ah_data.get(f"{key}_total"))
        elif isinstance(ah_data.get(key), (int, float, str)):
            tot_val = format_val_excel(ah_data.get(key))

        ws.write(cur_row, total_col_idx, tot_val, f_right)

        if "\n" in desc or is_subtotal or is_grand_total:
            ws.set_row(cur_row, 28)
        else:
            ws.set_row(cur_row, 20)

    # Comments / Notes row below table
    notes_row = start_row + len(ah_rows_def)
    notes_str = f"Comments/Notes: {comments_notes}" if comments_notes else "Comments/Notes: Approved Copy may pls be forwarded to Purchase & Accounts"
    ws.merge_range(notes_row, 0, notes_row, total_col_idx, notes_str, workbook.add_format({
        'font_name': font_name, 'font_size': 9, 'italic': True, 'valign': 'vcenter', 'border': 1
    }))
    ws.set_row(notes_row, 20)

    # -------------------------------------------------------------
    # 2. MIDDLE BLOCK (SUB-TABLES)
    # -------------------------------------------------------------
    def get_ah_tot(k):
        v = ah_data.get(k)
        if isinstance(v, dict):
            try:
                return float(str(v.get("total", 0)).replace("₹", "").replace(",", "").strip() or 0)
            except Exception:
                return 0.0
        elif isinstance(v, (int, float)):
            return float(v)
        return 0.0

    r_cur = 0

    # Sub-table 1: Estimated Revenue Projection (TOP OF COLUMN 2, Row 0)
    rev = revenue_projection or {}
    rev_tot = rev.get("total", "")
    rev_rows = [
        ("External Work", rev.get("external_work", "")),
        ("Internal Work", rev.get("internal_work", "")),
    ]

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 2, "Estimated Revenue Projection", fmt_col_hdr)
    ws.set_row(r_cur, 28)
    r_cur += 1

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, "Description", fmt_col_hdr)
    ws.write(r_cur, mid_start + 2, "Estimated Cost", fmt_col_hdr)
    ws.set_row(r_cur, 18)
    r_cur += 1

    for desc, val in rev_rows:
        ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, desc, fmt_border)
        ws.write(r_cur, mid_start + 2, format_val_excel(val), fmt_border_right)
        ws.set_row(r_cur, 20)
        r_cur += 1

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, "Total Revenue", fmt_subtot)
    ws.write(r_cur, mid_start + 2, format_val_excel(rev_tot), fmt_subtot_right)
    ws.set_row(r_cur, 20)
    r_cur += 2  # Blank gap

    # Sub-table 2: Details of Infrastructure Development
    infra = infra_details or {}
    infra_total_val = infra.get("total_c1_c2") or infra.get("total_c1") or ""
    if (infra_total_val == "" or infra_total_val is None or str(infra_total_val) == "0") and account_heads:
        c12 = get_ah_tot("C1") + get_ah_tot("C2")
        if c12 > 0:
            infra_total_val = c12

    infra_rows = [
        ("1", "Civil", infra.get("civil", "")),
        ("2", "Electrical\n/NETWORK", infra.get("electrical", "")),
        ("3", "AC/Clean Room", infra.get("ac_clean_room", "")),
        ("4", "Furniture/utility\netc.", infra.get("furniture_utilities", "")),
    ]

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 2, "Details of Infrastructure Development", fmt_col_hdr)
    ws.set_row(r_cur, 20)
    r_cur += 1

    ws.write(r_cur, mid_start, "Sl.No", fmt_col_hdr)
    ws.write(r_cur, mid_start + 1, "Description", fmt_col_hdr)
    ws.write(r_cur, mid_start + 2, "Estimated Cost", fmt_col_hdr)
    ws.set_row(r_cur, 18)
    r_cur += 1

    for sn, desc, val in infra_rows:
        ws.write(r_cur, mid_start, sn, fmt_border_center)
        ws.write(r_cur, mid_start + 1, desc, workbook.add_format({'border': 1, 'font_name': font_name, 'font_size': 9, 'valign': 'vcenter', 'text_wrap': True}))
        ws.write(r_cur, mid_start + 2, format_val_excel(val), fmt_border_right)
        ws.set_row(r_cur, 24 if "\n" in desc else 20)
        r_cur += 1

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, "Total (C1+C2)", fmt_subtot)
    ws.write(r_cur, mid_start + 2, format_val_excel(infra_total_val), fmt_subtot_right)
    ws.set_row(r_cur, 20)
    r_cur += 2  # Blank gap

    # Sub-table 3: Details of Technical HR
    tech = tech_hr_details or {}
    tech_total_val = tech.get("total_r6", "")
    if (tech_total_val == "" or tech_total_val is None or str(tech_total_val) == "0") and account_heads:
        r6_val = get_ah_tot("R6")
        if r6_val > 0:
            tech_total_val = r6_val

    tech_rows = [
        ("1", "Consultant/experts", tech.get("consultant_experts", "")),
        ("2", "RA/SRF/JRF", tech.get("ra_srf_jrf", "")),
        ("3", "Proj. engineers/fellow", tech.get("proj_engineers_fellow", "")),
        ("4", "Support staff hiring", tech.get("support_staff", "")),
    ]

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 2, "Details of Technical HR", fmt_col_hdr)
    ws.set_row(r_cur, 20)
    r_cur += 1

    ws.write(r_cur, mid_start, "Sl No", fmt_col_hdr)
    ws.write(r_cur, mid_start + 1, "Technical HR", fmt_col_hdr)
    ws.write(r_cur, mid_start + 2, "Estimated Cost", fmt_col_hdr)
    ws.set_row(r_cur, 18)
    r_cur += 1

    for sn, desc, val in tech_rows:
        ws.write(r_cur, mid_start, sn, fmt_border_center)
        ws.write(r_cur, mid_start + 1, desc, fmt_border)
        ws.write(r_cur, mid_start + 2, format_val_excel(val), fmt_border_right)
        ws.set_row(r_cur, 20)
        r_cur += 1

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, "Total Tech. HR (R6)", fmt_subtot)
    ws.write(r_cur, mid_start + 2, format_val_excel(tech_total_val), fmt_subtot_right)
    ws.set_row(r_cur, 20)
    r_cur += 2  # Blank gap

    # Sub-table 4: Regular Staff Charges
    staff = staff_charges or {}
    staff_total_val = staff.get("total_e1", "")
    if (staff_total_val == "" or staff_total_val is None or str(staff_total_val) == "0") and account_heads:
        e1_val = get_ah_tot("E1")
        if e1_val > 0:
            staff_total_val = e1_val

    staff_rows = [
        ("1", "Sct. E & Above", staff.get("sct_e_above", "")),
        ("2", "Sct.C to D & STO", staff.get("sct_b_d_sto", "")),
        ("3", "Technical Staff", staff.get("technical_staff", "")),
    ]

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 2, "Regular Staff Charges", fmt_col_hdr)
    ws.set_row(r_cur, 20)
    r_cur += 1

    ws.write(r_cur, mid_start, "Sl. No", fmt_col_hdr)
    ws.write(r_cur, mid_start + 1, "Levels", fmt_col_hdr)
    ws.write(r_cur, mid_start + 2, "Estimated Cost", fmt_col_hdr)
    ws.set_row(r_cur, 18)
    r_cur += 1

    for sn, desc, val in staff_rows:
        ws.write(r_cur, mid_start, sn, fmt_border_center)
        ws.write(r_cur, mid_start + 1, desc, fmt_border)
        ws.write(r_cur, mid_start + 2, format_val_excel(val), fmt_border_right)
        ws.set_row(r_cur, 20)
        r_cur += 1

    ws.merge_range(r_cur, mid_start, r_cur, mid_start + 1, "Scientific Input(Total E1)", fmt_subtot)
    ws.write(r_cur, mid_start + 2, format_val_excel(staff_total_val), fmt_subtot_right)
    ws.set_row(r_cur, 20)

    # -------------------------------------------------------------
    # 3. RIGHT BLOCK (EQUIPMENTS)
    # -------------------------------------------------------------
    eq_list = equipment_details or []
    if not eq_list:
        eq_list = [{"equipment": "", "cost": ""}]

    eq_r = 4
    ws.merge_range(eq_r, right_start, eq_r, right_start + 2, "Details of Equipments/Apparatus/Instruments/ Sub-systems", fmt_col_hdr)
    ws.set_row(eq_r, 28)
    eq_r += 1

    ws.write(eq_r, right_start, "Sl.", fmt_col_hdr)
    ws.write(eq_r, right_start + 1, "Description of Equipment", fmt_col_hdr)
    ws.write(eq_r, right_start + 2, "Estimated Cost", fmt_col_hdr)
    ws.set_row(eq_r, 18)
    eq_r += 1

    eq_tot = 0.0
    for idx, item in enumerate(eq_list):
        eq_desc = str(item.get("equipment", "") or "")
        c_val = str(item.get("cost", "") or "")
        try:
            eq_tot += float(c_val.replace("₹", "").replace(",", "").strip())
        except Exception:
            pass

        ws.write(eq_r, right_start, str(idx + 1) if eq_desc or c_val else "", fmt_equip_sn)
        ws.write(eq_r, right_start + 1, eq_desc, fmt_equip_desc)
        ws.write(eq_r, right_start + 2, format_val_excel(c_val), fmt_equip_cost)

        lines = max(1, len(eq_desc) // 30 + eq_desc.count("\n") + 1)
        ws.set_row(eq_r, max(22, lines * 18))
        eq_r += 1

    final_eq_tot = eq_tot
    if (final_eq_tot == 0 or str(final_eq_tot) == "0") and account_heads:
        c34 = get_ah_tot("C3") + get_ah_tot("C4")
        if c34 > 0:
            final_eq_tot = c34

    ws.merge_range(eq_r, right_start, eq_r, right_start + 1, "Total Equipment Cost (C3+C4)", fmt_subtot)
    ws.write(eq_r, right_start + 2, format_val_excel(final_eq_tot), fmt_subtot_right)
    ws.set_row(eq_r, 22)

    # -------------------------------------------------------------
    # 4. SIGNATURES SECTION
    # -------------------------------------------------------------
    bottom_r = max(notes_row, r_cur, eq_r) + 2

    # Signatures
    sig_r = bottom_r + 2
    ws.set_row(sig_r - 1, 35) # Blank signing space
    ws.set_row(sig_r, 28)

    gh_text = "Group Head"
    ch_text = "Centre Head"
    cao_text = "Chief Accounts Officer"
    signatures = kwargs.get("signatures")
    if isinstance(signatures, dict):
        gh_text = signatures.get("group_head_title") or signatures.get("gh_title") or signatures.get("group_head") or "Group Head"
        ch_text = signatures.get("centre_head_title") or signatures.get("ch_title") or signatures.get("centre_head") or "Centre Head"
        cao_text = signatures.get("cao_title") or signatures.get("cao") or "Chief Accounts Officer"
    else:
        if kwargs.get("group_head_title"): gh_text = str(kwargs.get("group_head_title"))
        if kwargs.get("centre_head_title"): ch_text = str(kwargs.get("centre_head_title"))
        if kwargs.get("cao_title"): cao_text = str(kwargs.get("cao_title"))

    sig_slots = [
        (0, 1, "Project Leader / Project Co-Ordinator"),
        (2, total_col_idx, str(gh_text)),
        (mid_start, mid_start + 1, str(ch_text)),
        (mid_start + 2, sep2_col, str(cao_text)),
        (right_start, right_start + 1, "Head (PPM)"),
        (right_start + 2, right_start + 2, "Director")
    ]

    fmt_sig = workbook.add_format({
        'font_name': font_name, 'font_size': 9, 'bold': True, 'align': 'center', 'valign': 'top',
        'top': 1, 'text_wrap': True
    })

    for c_start, c_end, title in sig_slots:
        if c_start == c_end:
            ws.write(sig_r, c_start, title, fmt_sig)
        else:
            ws.merge_range(sig_r, c_start, sig_r, c_end, title, fmt_sig)

    workbook.close()
    output.seek(0)
    return output


def generate_cost_estimation_sheet_bytes(**kwargs) -> io.BytesIO:
    doc = create_cost_estimation_sheet_document(**kwargs)
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer


def generate_cost_estimation_sheet_excel_bytes(**kwargs) -> io.BytesIO:
    return create_cost_estimation_sheet_excel(**kwargs)


@router.post("/cost-estimation-sheet/generate", summary="Generate Project Cost Estimation Sheet (.docx)")
async def generate_cost_estimation_sheet_post(payload: CostEstimationSheetRequest):
    try:
        filename = payload.filename or "Project_Cost_Estimation_Sheet.docx"
        if not filename.lower().endswith(".docx"):
            filename += ".docx"

        buffer = generate_cost_estimation_sheet_bytes(
            start_year=payload.start_year,
            end_year=payload.end_year,
            fy_labels=payload.fy_labels,
            format_no=payload.format_no or "",
            prepared_on=payload.prepared_on or "",
            project_no=payload.project_no or "",
            project_title=payload.project_title or "",
            account_heads=payload.account_heads,
            revenue_projection=payload.revenue_projection,
            infra_details=payload.infra_details,
            tech_hr_details=payload.tech_hr_details,
            staff_charges=payload.staff_charges,
            equipment_details=payload.equipment_details,
            comments_notes=payload.comments_notes or "",
            signatures=payload.signatures
        )

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }

        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating document: {str(e)}"
        )


@router.post("/cost-estimation-sheet/generate-excel", summary="Generate Project Cost Estimation Sheet (.xlsx)")
async def generate_cost_estimation_sheet_excel_post(payload: CostEstimationSheetRequest):
    try:
        filename = payload.filename or "Project_Cost_Estimation_Sheet.xlsx"
        if filename.lower().endswith(".docx"):
            filename = filename[:-5] + ".xlsx"
        elif not filename.lower().endswith(".xlsx"):
            filename += ".xlsx"

        buffer = generate_cost_estimation_sheet_excel_bytes(
            start_year=payload.start_year,
            end_year=payload.end_year,
            fy_labels=payload.fy_labels,
            format_no=payload.format_no or "",
            prepared_on=payload.prepared_on or "",
            project_no=payload.project_no or "",
            project_title=payload.project_title or "",
            account_heads=payload.account_heads,
            revenue_projection=payload.revenue_projection,
            infra_details=payload.infra_details,
            tech_hr_details=payload.tech_hr_details,
            staff_charges=payload.staff_charges,
            equipment_details=payload.equipment_details,
            comments_notes=payload.comments_notes or "",
            signatures=payload.signatures
        )

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }

        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating Excel: {str(e)}"
        )

