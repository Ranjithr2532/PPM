from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image


# ============================================================
# FILES
# ============================================================

SOURCE_IMAGE = "/mnt/data/3ca8853f-e3c0-4e9a-b2ff-c28f2b735ff4.png"
LOGO_IMAGE = "/mnt/data/cmti_logo.png"
OUTPUT_FILE = "CMTI_Project_Team_Header.docx"


# ============================================================
# CROP CMTI LOGO FROM PROVIDED IMAGE
# ============================================================

img = Image.open(SOURCE_IMAGE)

# Approximate logo area from the supplied image
logo_crop = img.crop((15, 90, 105, 170))
logo_crop.save(LOGO_IMAGE)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def set_cell_margins(cell, top=50, start=50, bottom=50, end=50):
    """
    Set cell margins in twips.
    """
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()

    tcMar = tcPr.first_child_found_in("w:tcMar")

    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)

    for margin, value in [
        ("top", top),
        ("start", start),
        ("bottom", bottom),
        ("end", end),
    ]:
        node = tcMar.find(qn(f"w:{margin}"))

        if node is None:
            node = OxmlElement(f"w:{margin}")
            tcMar.append(node)

        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_border(cell, **kwargs):
    """
    Set borders for a table cell.

    Example:
        set_cell_border(
            cell,
            top={"val": "single", "sz": 8, "color": "808080"},
            bottom={"val": "single", "sz": 8, "color": "808080"},
        )
    """

    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()

    tcBorders = tcPr.first_child_found_in("w:tcBorders")

    if tcBorders is None:
        tcBorders = OxmlElement("w:tcBorders")
        tcPr.append(tcBorders)

    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):

        if edge in kwargs:
            edge_data = kwargs.get(edge)

            tag = "w:{}".format(edge)
            element = tcBorders.find(qn(tag))

            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)

            for key in ["val", "sz", "space", "color"]:
                if key in edge_data:
                    element.set(qn("w:{}".format(key)), str(edge_data[key]))


def set_cell_shading(cell, fill):
    """
    Set background color of a cell.
    """

    tcPr = cell._tc.get_or_add_tcPr()

    shd = tcPr.find(qn("w:shd"))

    if shd is None:
        shd = OxmlElement("w:shd")
        tcPr.append(shd)

    shd.set(qn("w:fill"), fill)


def set_cell_width(cell, width_inches):
    """
    Set fixed cell width.
    """

    tcPr = cell._tc.get_or_add_tcPr()

    tcW = tcPr.find(qn("w:tcW"))

    if tcW is None:
        tcW = OxmlElement("w:tcW")
        tcPr.append(tcW)

    tcW.set(qn("w:w"), str(int(width_inches * 1440)))
    tcW.set(qn("w:type"), "dxa")


def set_row_height(row, height_inches):
    """
    Set fixed row height.
    """

    trPr = row._tr.get_or_add_trPr()

    trHeight = OxmlElement("w:trHeight")
    trHeight.set(qn("w:val"), str(int(height_inches * 1440)))
    trHeight.set(qn("w:hRule"), "exact")

    trPr.append(trHeight)


def remove_table_borders(table):
    """
    Remove all table borders.
    """

    tbl = table._tbl
    tblPr = tbl.tblPr

    borders = tblPr.first_child_found_in("w:tblBorders")

    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tblPr.append(borders)

    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))

        if element is None:
            element = OxmlElement(tag)
            borders.append(element)

        element.set(qn("w:val"), "nil")


def add_text(
    cell,
    text,
    font_size=10,
    bold=False,
    alignment=WD_ALIGN_PARAGRAPH.LEFT,
    font_name="Arial",
    color="808080"
):

    paragraph = cell.paragraphs[0]

    paragraph.alignment = alignment

    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1

    run = paragraph.add_run(text)

    run.bold = bold
    run.font.name = font_name
    run.font.size = Pt(font_size)
    run.font.color.rgb = __import__("docx").shared.RGBColor.from_string(color)

    # Ensure Arial is used
    run._element.rPr.rFonts.set(qn("w:ascii"), font_name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), font_name)

    return run


# ============================================================
# CREATE DOCUMENT
# ============================================================

doc = Document()

section = doc.sections[0]

# A4 page
section.page_width = Inches(8.27)
section.page_height = Inches(11.69)

# Margins
section.top_margin = Inches(0.4)
section.bottom_margin = Inches(0.5)
section.left_margin = Inches(0.45)
section.right_margin = Inches(0.45)


# ============================================================
# CREATE HEADER
# ============================================================

header = section.header

# Remove default header paragraph spacing
header.paragraphs[0].paragraph_format.space_after = Pt(0)


# Main table
#
# ------------------------------------------------------------
# |             | CENTRAL MANUFACTURING TECHNOLOGY            |
# |    LOGO     |                 INSTITUTE        | Info      |
# |             | ISO 9001-2015                    | table     |
# |             |----------------------------------|           |
# |             | PROJECT TEAM LETTER-SMC          |           |
# ------------------------------------------------------------
#

table = header.add_table(
    rows=2,
    cols=3,
    width=Inches(7.37)
)

table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False


# ============================================================
# COLUMN WIDTHS
# ============================================================

for row in table.rows:

    set_cell_width(row.cells[0], 1.05)
    set_cell_width(row.cells[1], 4.95)
    set_cell_width(row.cells[2], 1.37)


# ============================================================
# MERGE LOGO CELL VERTICALLY
# ============================================================

logo_cell = table.cell(0, 0).merge(table.cell(1, 0))

logo_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

set_cell_margins(
    logo_cell,
    top=60,
    start=60,
    bottom=60,
    end=60
)


# ============================================================
# ADD LOGO
# ============================================================

logo_paragraph = logo_cell.paragraphs[0]
logo_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
logo_paragraph.paragraph_format.space_before = Pt(0)
logo_paragraph.paragraph_format.space_after = Pt(0)

run = logo_paragraph.add_run()

run.add_picture(
    LOGO_IMAGE,
    width=Inches(0.58)
)


# ============================================================
# TOP CENTER CELL
# ============================================================

top_center = table.cell(0, 1)

top_center.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

set_cell_margins(
    top_center,
    top=50,
    start=50,
    bottom=30,
    end=50
)


p = top_center.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(0)
p.paragraph_format.space_after = Pt(0)

r = p.add_run("CENTRAL MANUFACTURING TECHNOLOGY")
r.bold = True
r.font.name = "Arial"
r.font.size = Pt(15)
r.font.color.rgb = __import__("docx").shared.RGBColor(128, 128, 128)

p2 = top_center.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
p2.paragraph_format.space_before = Pt(0)
p2.paragraph_format.space_after = Pt(0)

r2 = p2.add_run("INSTITUTE")
r2.bold = True
r2.font.name = "Arial"
r2.font.size = Pt(15)
r2.font.color.rgb = __import__("docx").shared.RGBColor(128, 128, 128)

p3 = top_center.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
p3.paragraph_format.space_before = Pt(5)
p3.paragraph_format.space_after = Pt(0)

r3 = p3.add_run("ISO 9001-2015")
r3.bold = True
r3.font.name = "Arial"
r3.font.size = Pt(13)
r3.font.color.rgb = __import__("docx").shared.RGBColor(128, 128, 128)


# ============================================================
# BOTTOM CENTER CELL
# ============================================================

bottom_center = table.cell(1, 1)

bottom_center.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

set_cell_margins(
    bottom_center,
    top=30,
    start=50,
    bottom=30,
    end=50
)

add_text(
    bottom_center,
    "PROJECT TEAM LETTER-SMC",
    font_size=13,
    bold=True,
    alignment=WD_ALIGN_PARAGRAPH.CENTER,
    color="808080"
)


# ============================================================
# RIGHT INFORMATION TABLE
# ============================================================

right_cell = table.cell(0, 2)

right_cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

set_cell_margins(
    right_cell,
    top=0,
    start=0,
    bottom=0,
    end=0
)

# Remove original paragraph
right_cell.text = ""

info_table = right_cell.add_table(
    rows=4,
    cols=2
)

info_table.autofit = False
info_table.alignment = WD_TABLE_ALIGNMENT.CENTER

# Remove nested table borders first
for row in info_table.rows:
    for cell in row.cells:
        set_cell_margins(
            cell,
            top=25,
            start=45,
            bottom=25,
            end=45
        )

        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

        set_cell_border(
            cell,
            top={"val": "single", "sz": 7, "color": "808080"},
            bottom={"val": "single", "sz": 7, "color": "808080"},
            left={"val": "single", "sz": 7, "color": "808080"},
            right={"val": "single", "sz": 7, "color": "808080"},
        )


# Widths
for row in info_table.rows:

    set_cell_width(row.cells[0], 1.00)
    set_cell_width(row.cells[1], 1.00)


# Information
info = [
    ("Centre / Dept", "C-SMPM"),
    ("Doc No.", ""),
    ("Date", "13-01-2026"),
    ("Page", "1 of 2"),
]


for i, (label, value) in enumerate(info):

    add_text(
        info_table.cell(i, 0),
        label,
        font_size=7.5,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        color="666666"
    )

    add_text(
        info_table.cell(i, 1),
        value,
        font_size=7.5,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        color="666666"
    )


# ============================================================
# MERGE RIGHT CELL FOR SECOND ROW
# ============================================================

right_bottom = table.cell(1, 2)

right_bottom.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

set_cell_margins(
    right_bottom,
    top=0,
    start=0,
    bottom=0,
    end=0
)


# ============================================================
# OUTER TABLE BORDERS
# ============================================================

for row in table.rows:

    for cell in row.cells:

        set_cell_border(
            cell,
            top={"val": "single", "sz": 8, "color": "808080"},
            bottom={"val": "single", "sz": 8, "color": "808080"},
            left={"val": "single", "sz": 8, "color": "808080"},
            right={"val": "single", "sz": 8, "color": "808080"},
        )


# ============================================================
# ROW HEIGHTS
# ============================================================

set_row_height(table.rows[0], 1.05)
set_row_height(table.rows[1], 0.68)


# ============================================================
# ADD CONTENT AFTER HEADER
# ============================================================

paragraph = doc.add_paragraph()
paragraph.paragraph_format.space_before = Pt(20)
paragraph.paragraph_format.space_after = Pt(0)

paragraph.add_run(
    "Project Team Details"
).bold = True


# ============================================================
# SAVE
# ============================================================

doc.save(OUTPUT_FILE)

print(f"Document created successfully: {OUTPUT_FILE}")