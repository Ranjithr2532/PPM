

import io
import re
import sys
from datetime import datetime

try:
    from docx import Document
    from docx.shared import Pt, Mm, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
except ImportError:
    sys.exit(
        "This script needs the 'python-docx' package.\n"
        "Install it first with:\n\n    pip install python-docx\n"
    )

BOLD_PATTERN = re.compile(r"\*\*(.+?)\*\*")


# ============================================================================
# 1. INPUT HELPERS  (everything that talks to the user)
# ============================================================================

def ask(label, default="", required=False):
    """Single-line text prompt. Returns default if the user just hits Enter."""
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{label}{suffix}: ").strip()
        if not value:
            value = default
        if value or not required:
            return value
        print("   -> This field is required, please enter a value.")


def ask_yes_no(label, default=False):
    """y/n prompt. Returns a bool."""
    suffix = " [Y/n]" if default else " [y/N]"
    value = input(f"{label}{suffix}: ").strip().lower()
    if not value:
        return default
    return value.startswith("y")


def ask_list(label, hint="one point per line, blank line to finish"):
    """Collects multiple lines until the user enters a blank line."""
    print(f"{label}  ({hint})")
    items = []
    while True:
        line = input("   > ").strip()
        if not line:
            break
        items.append(line)
    return items


def ask_int(label, default=None, min_value=1):
    suffix = f" [{default}]" if default is not None else ""
    while True:
        value = input(f"{label}{suffix}: ").strip()
        if not value and default is not None:
            return default
        try:
            n = int(value)
            if n >= min_value:
                return n
        except ValueError:
            pass
        print(f"   -> Please enter a whole number >= {min_value}.")


def section(title):
    print("\n" + "-" * 60)
    print(title)
    print("-" * 60)


# ============================================================================
# 2. DOCX BUILDING HELPERS  (everything that talks to python-docx)
# ============================================================================

def set_a4_page(document):
    sec = document.sections[0]
    sec.page_width = Mm(210)
    sec.page_height = Mm(297)
    sec.left_margin = Inches(1)
    sec.right_margin = Inches(1)
    sec.top_margin = Inches(1)
    sec.bottom_margin = Inches(1)


def add_hyperlink(paragraph, url, text):
    """Insert a real, clickable hyperlink run into a paragraph."""
    part = paragraph.part
    r_id = part.relate_to(url, RT.HYPERLINK, is_external=True)

    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), r_id)

    new_run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")

    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    rpr.append(color)

    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    rpr.append(underline)

    new_run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_rich_text(paragraph, text, bold_all=False):
    """
    Add text to a paragraph, honouring **bold** markers so users can
    emphasise figures (e.g. **Rs. 9,20,000**) the same way the source
    template does.
    """
    pos = 0
    for m in BOLD_PATTERN.finditer(text):
        if m.start() > pos:
            paragraph.add_run(text[pos:m.start()]).bold = bold_all
        paragraph.add_run(m.group(1)).bold = True
        pos = m.end()
    if pos < len(text):
        paragraph.add_run(text[pos:]).bold = bold_all


def add_right_aligned(document, text):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run(text)
    return p


def add_section_heading(document, text, center=False, space_before=12):
    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(6)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run(text).bold = True
    return p


def add_field(document, label, value):
    """One 'Label: value' paragraph, e.g. Kind Attention: Mr Arun."""
    value = (value or "").strip()
    if not value:
        return
    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run(f"{label}: ").bold = True
    add_rich_text(p, value)


def add_multiline_field(document, label, lines):
    """
    'Label:' followed by one or more lines of text (e.g. a name +
    address block for Customer). Continuation lines are indented so
    they sit under the first line of text.
    """
    lines = [l.strip() for l in lines if l.strip()]
    if not lines:
        return
    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run(f"{label}: ").bold = True
    add_rich_text(p, lines[0])
    for extra in lines[1:]:
        p2 = document.add_paragraph()
        p2.paragraph_format.space_after = Pt(6)
        p2.paragraph_format.left_indent = Inches(0.95)
        p2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_rich_text(p2, extra)


def add_email_field(document, label, addresses):
    addresses = [a.strip() for a in addresses if a.strip()]
    if not addresses:
        return
    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.add_run(f"{label}: ").bold = True
    for i, addr in enumerate(addresses):
        if i > 0:
            p.add_run(", ")
        add_hyperlink(p, f"mailto:{addr}", addr)


def add_bullets(document, items):
    for item in items:
        item = item.strip()
        if not item:
            continue
        p = document.add_paragraph(style="List Bullet")
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_rich_text(p, item)


def shade_cell(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def add_table_block(document, table_spec):
    title, headers, rows = table_spec["title"], table_spec["headers"], table_spec["rows"]
    if title:
        p = document.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(6)
        p.add_run(title).bold = True

    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        run = hdr_cells[i].paragraphs[0].add_run(h)
        run.bold = True
        shade_cell(hdr_cells[i], "D9E2F3")

    for row_vals in rows:
        cells = table.add_row().cells
        for i in range(len(headers)):
            cells[i].text = row_vals[i] if i < len(row_vals) else ""

    document.add_paragraph()  # small spacer after the table


def clear_table_borders(table):
    """Remove all table and cell borders completely to prevent dotted lines in Word."""
    tblPr = table._tbl.tblPr
    tblBorders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'none')
        border.set(qn('w:sz'), '0')
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), 'auto')
        tblBorders.append(border)
    tblPr.append(tblBorders)

    for row in table.rows:
        for cell in row.cells:
            tcPr = cell._tc.get_or_add_tcPr()
            tcBorders = OxmlElement('w:tcBorders')
            for border_name in ['top', 'left', 'bottom', 'right']:
                border = OxmlElement(f'w:{border_name}')
                border.set(qn('w:val'), 'none')
                border.set(qn('w:sz'), '0')
                border.set(qn('w:space'), '0')
                border.set(qn('w:color'), 'auto')
                tcBorders.append(border)
            tcPr.append(tcBorders)


def add_signature_block(document, name=None, designation_lines=None, signatories=None):
    valid_signatories = []
    if signatories and len(signatories) > 0:
        for sig in signatories:
            if isinstance(sig, dict):
                s_name = (sig.get("name") or "").strip()
                raw_lines = sig.get("lines") or []
                s_lines = [l.strip() for l in raw_lines if l.strip()]
            elif hasattr(sig, "dict"):
                s_dict = sig.dict()
                s_name = (s_dict.get("name") or "").strip()
                s_lines = [l.strip() for l in (s_dict.get("lines") or []) if l.strip()]
            elif hasattr(sig, "model_dump"):
                s_dict = sig.model_dump()
                s_name = (s_dict.get("name") or "").strip()
                s_lines = [l.strip() for l in (s_dict.get("lines") or []) if l.strip()]
            else:
                continue
            if s_name or s_lines:
                valid_signatories.append({"name": s_name, "lines": s_lines})

    if not valid_signatories:
        s_name = (name or "").strip()
        s_lines = [l.strip() for l in (designation_lines or []) if l.strip()]
        if s_name or s_lines:
            valid_signatories.append({"name": s_name, "lines": s_lines})

    if not valid_signatories:
        return

    document.add_paragraph()  # spacer

    if len(valid_signatories) == 1:
        sig = valid_signatories[0]
        if sig["name"]:
            add_right_aligned(document, sig["name"] + ",")
        for line in sig["lines"]:
            add_right_aligned(document, line)
    else:
        # Layout signatories in a grid with MAX 2 columns per row
        num_cols = 2
        num_rows = (len(valid_signatories) + 1) // 2
        table = document.add_table(rows=num_rows, cols=num_cols)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        clear_table_borders(table)

        for idx, sig in enumerate(valid_signatories):
            r_idx = idx // num_cols
            c_idx = idx % num_cols
            cell = table.rows[r_idx].cells[c_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if sig["name"]:
                run = p.add_run(sig["name"] + ",\n")
                run.bold = True
            for l_idx, line in enumerate(sig["lines"]):
                is_last = (l_idx == len(sig["lines"]) - 1)
                p.add_run(line + ("\n" if not is_last else ""))


# ============================================================================
# 3. MISC HELPERS
# ============================================================================

def slugify(text, max_len=40):
    text = re.sub(r"[^\w\s-]", "", text or "").strip().lower()
    text = re.sub(r"[\s_-]+", "_", text)
    return text[:max_len] or "quotation"


def default_filename(customer_lines, date_str):
    cust = customer_lines[0] if customer_lines else "quotation"
    digits = re.sub(r"[^\d]", "", date_str) or datetime.now().strftime("%d%m%Y")
    return f"Quotation_{slugify(cust)}_{digits}.docx"


def collect_table():
    print("\n   -- New table --")
    title = ask("   Table title/heading (optional, e.g. 'Cost Break-up')")
    ncols = ask_int("   Number of columns", default=2, min_value=1)
    headers = []
    for i in range(ncols):
        headers.append(ask(f"   Column {i + 1} header", default=f"Column {i + 1}"))
    print(f"   Now enter row data — {ncols} value(s) per row, separated by '|'.")
    rows = ask_list("   Rows", hint="blank line to finish")
    parsed_rows = []
    for row in rows:
        parts = [p.strip() for p in row.split("|")]
        if len(parts) < ncols:
            parts += [""] * (ncols - len(parts))
        parsed_rows.append(parts[:ncols])
    return {"title": title, "headers": headers, "rows": parsed_rows}


# ============================================================================
# 4. MAIN INTERACTIVE FLOW
# ============================================================================

def main():
    print("=" * 60)
    print(" QUOTATION / PROPOSAL GENERATOR")
    print("=" * 60)
    print("Press Enter to skip any optional field.")
    print("For lists (Scope of work, Terms & conditions, etc.) type one")
    print("point per line, then press Enter on a blank line to move on.")
    print("Wrap text in **double asterisks** to make it bold, e.g.")
    print("  Total cost is **Rs. 9,20,000**.")
    print("=" * 60)

    # ---- 1. Date -----------------------------------------------------
    date = ask("\nDate (DD/MM/YYYY)", default=datetime.now().strftime("%d/%m/%Y"))
    dept = ask("Department / Dept (optional, e.g. C-SMPM)")

    # ---- 2. Email / Cc -------------------------------------------------
    section("EMAIL")
    email_to_raw = ask("Email - To (comma-separated if more than one)")
    email_cc_raw = ask("Email - Cc (comma-separated, optional)")
    email_to = [e.strip() for e in email_to_raw.split(",") if e.strip()]
    email_cc = [e.strip() for e in email_cc_raw.split(",") if e.strip()]

    # ---- 3. Quotation Information --------------------------------------
    section("QUOTATION INFORMATION")
    customer_lines = ask_list(
        "Customer (name & address)",
        hint="one line at a time — name, street, city/pin — blank line to finish",
    )
    kind_attention = ask("Kind Attention")
    reference = ask("Reference")
    subject = ask("Subject")
    sac_code = ask("SAC Code")

    print("\n  Scope of work")
    scope_intro = ask("   Intro paragraph (optional)")
    scope_items = ask_list("   Bullet points")

    print("\n  Terms and conditions")
    terms_items = ask_list("   Bullet points")

    # ---- 4. Other headings: signature / approval block -----------------
    section("OTHER SECTIONS")
    tables = []
    if ask_yes_no("Add any table(s)? (e.g. cost break-up, pricing, item list)"):
        while True:
            tables.append(collect_table())
            if not ask_yes_no("   Add another table?"):
                break

    signatories = []
    if ask_yes_no("Add signatory / approval block(s) at the end?"):
        while True:
            s_name = ask("   Signatory name")
            s_lines = ask_list(
                "   Designation line(s)",
                hint="one per line, e.g. 'GH-SMC, Scientist-D' — blank line to finish",
            )
            signatories.append({"name": s_name, "lines": s_lines})
            if not ask_yes_no("   Add another signatory?"):
                break

    data = {
        "date": date,
        "dept": dept,
        "email_to": email_to,
        "email_cc": email_cc,
        "customer_lines": customer_lines,
        "kind_attention": kind_attention,
        "reference": reference,
        "subject": subject,
        "sac_code": sac_code,
        "scope_intro": scope_intro,
        "scope_items": scope_items,
        "terms_items": terms_items,
        "tables": tables,
        "signatories": signatories,
    }

    # ====================================================================
    # BUILD THE DOCUMENT
    # ====================================================================
    document = build_quotation_document(data)

    # ---- Save -----------------------------------------------------------
    default_name = default_filename(customer_lines, date)
    filename = ask("\nSave as (filename)", default=default_name)
    if not filename.lower().endswith(".docx"):
        filename += ".docx"
    document.save(filename)
    print(f"\nSaved: {filename}")


# ============================================================================
# 5. CORE API / PROGRAMMATIC SERVICE FUNCTIONS
# ============================================================================

def build_quotation_document(data: dict) -> Document:
    if not isinstance(data, dict) and hasattr(data, "dict"):
        data = data.dict()
    elif not isinstance(data, dict) and hasattr(data, "model_dump"):
        data = data.model_dump()

    date = data.get("date") or datetime.now().strftime("%d/%m/%Y")
    dept = data.get("dept") or ""
    email_to = data.get("email_to") or []
    email_cc = data.get("email_cc") or []
    customer_lines = data.get("customer_lines") or []
    kind_attention = data.get("kind_attention") or ""
    reference = data.get("reference") or ""
    subject = data.get("subject") or ""
    sac_code = data.get("sac_code") or ""
    scope_intro = data.get("scope_intro") or ""
    scope_items = data.get("scope_items") or []
    terms_items = data.get("terms_items") or []
    raw_tables = data.get("tables") or []
    signatory_name = data.get("signatory_name") or ""
    signatory_lines = data.get("signatory_lines") or []
    signatories = data.get("signatories") or []

    tables = []
    for t in raw_tables:
        if isinstance(t, dict):
            tables.append(t)
        elif hasattr(t, "dict"):
            tables.append(t.dict())
        elif hasattr(t, "model_dump"):
            tables.append(t.model_dump())

    document = Document()
    set_a4_page(document)

    add_right_aligned(document, f"Date: {date}")
    if dept:
        add_right_aligned(document, f"Dept: {dept}")
    document.add_paragraph()

    add_email_field(document, "Email", email_to)
    add_email_field(document, "Cc", email_cc)

    add_section_heading(document, "Quotation Information:", center=True)

    add_multiline_field(document, "Customer", customer_lines)
    add_field(document, "Kind Attention", kind_attention)
    add_field(document, "Reference", reference)
    add_field(document, "Subject", subject)
    add_field(document, "SAC Code", sac_code)

    add_section_heading(document, "Scope of work:")
    if scope_intro:
        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_rich_text(p, scope_intro)
    add_bullets(document, scope_items)

    add_section_heading(document, "Terms and conditions:")
    add_bullets(document, terms_items)

    for spec in tables:
        add_table_block(document, spec)

    add_signature_block(document, name=signatory_name, designation_lines=signatory_lines, signatories=signatories)

    return document


def generate_quotation_docx(data: dict) -> io.BytesIO:
    doc = build_quotation_document(data)
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled — no file was saved.")