from typing import List, Dict, Any, Tuple, Optional
# from docx.oxml import OxmlElement
# from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Predefined header -> default column list.
# If the user types a header name not in this dict, they define their own columns manually.
PREDEFINED_HEADERS = {
    "Manpower": ["Role", "Cost Breakup", "Total"],
    
}



def compute_manpower(rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], float]:
    total = 0.0
    computed_rows = []

    for row in rows:
        cb = row.get("Cost Breakup") or {}
        rate = float(cb.get("rate", 0) or 0)
        quantity = float(cb.get("quantity", 1) or 1)
        calc_type = cb.get("type", "hourly")

        if calc_type == "monthly":
            months = float(cb.get("months", 0) or 0)
            amount = rate * months * quantity
            breakup_str = f"{rate:g}*{months:g}(months)*{quantity:g}"
        else:
            hours = float(cb.get("hours", 0) or 0)
            days = float(cb.get("days", 0) or 0)
            amount = rate * hours * days * quantity
            breakup_str = f"{rate:g}*{hours:g}(hours)*{days:g}(days)*{quantity:g}"

        total += amount

        computed_rows.append({
            "Role": row.get("Role", ""),
            "Cost Breakup": breakup_str,
            "Total Amount": round(amount, 2)
        })

    total = round(total, 2)
    computed_rows.append({"Role": "Total", "Cost Breakup": "", "Total Amount": total})

    return computed_rows, total


def compute_generic_amount_total(rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], float]:
    """
    For ANY header (custom or predefined) that has a 'Total Amount' column.
    User enters Total Amount manually per row; this just sums it and appends a Total row.
    """
    total = 0.0
    computed_rows = []

    for row in rows:
        amount = float(row.get("Total Amount", 0) or 0)
        total += amount
        computed_rows.append({**row, "Total Amount": round(amount, 2)})

    total = round(total, 2)
   
    if computed_rows:
        first_col = list(computed_rows[0].keys())[0]
        total_row = {key: "" for key in computed_rows[0].keys()}
        total_row[first_col] = "Total"
        total_row["Total Amount"] = total
    else:
        total_row = {}
    computed_rows.append(total_row)

    return computed_rows, total


def compute_rows_for_header(header_name: str, rows: List[Dict[str, Any]], columns: List[str]) -> Tuple[List[Dict[str, Any]], Optional[float]]:
    """
    - 'Manpower' always uses its special rate*hours*days*quantity formula.
    - Any other header (custom or predefined) that includes an 'Amount' column
      gets auto-summed with a Total row appended.
    - Headers without an 'Amount' column pass through untouched, total_amount stays None.
    """
    if header_name == "Manpower":
        return compute_manpower(rows)

    if "Total Amount" in columns and rows:
        return compute_generic_amount_total(rows)

    return rows, None

# Helper function to set cell background color (Hex)
def set_cell_background(cell, fill_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tc_pr.append(shd)