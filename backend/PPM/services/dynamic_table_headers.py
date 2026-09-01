from typing import List, Dict, Any, Tuple, Optional
# from docx.oxml import OxmlElement
# from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# Predefined header -> default column list.
# If the user types a header name not in this dict, they define their own columns manually.
PREDEFINED_HEADERS = {
    "Manpower": ["Role", "Rate (₹)", "Basis", "Duration", "People", "Total (₹)"],
}


def format_indian_currency(value: Any, include_decimals: bool = True) -> str:
    if value is None or value == "":
        return ""
    try:
        if isinstance(value, str):
            clean_str = value.replace(",", "").replace(" ", "").strip()
            if not clean_str:
                return value
            num = float(clean_str)
        else:
            num = float(value)
    except (ValueError, TypeError):
        return str(value)

    if include_decimals:
        s = f"{num:.2f}"
        parts = s.split(".")
        integer_part = parts[0]
        decimal_part = parts[1]
    else:
        integer_part = str(int(round(num)))
        decimal_part = ""

    is_negative = integer_part.startswith("-")
    if is_negative:
        integer_part = integer_part[1:]

    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        groups = []
        for i in range(len(remaining), 0, -2):
            start = max(0, i - 2)
            groups.insert(0, remaining[start:i])
        formatted_int = ",".join(groups) + "," + last_three

    if is_negative:
        formatted_int = "-" + formatted_int

    return f"{formatted_int}.{decimal_part}" if include_decimals else formatted_int


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
            basis_str = "Monthly"
            m_val = int(months) if months.is_integer() else months
            duration_str = f"{m_val} month{'s' if m_val != 1 else ''}"
        else:
            hours = float(cb.get("hours", 0) or 0)
            days = float(cb.get("days", 0) or 0)
            amount = rate * hours * days * quantity
            basis_str = "Hourly"
            h_val = int(hours) if hours.is_integer() else hours
            d_val = int(days) if days.is_integer() else days
            hr_unit = "hr" if h_val == 1 else "hrs"
            duration_str = f"{h_val} {hr_unit} × {d_val} days"

        total += amount

        rate_fmt = format_indian_currency(rate, include_decimals=False)
        total_fmt = format_indian_currency(amount, include_decimals=True)
        people_fmt = str(int(quantity) if quantity.is_integer() else quantity)

        computed_rows.append({
            "Role": row.get("Role", ""),
            "Rate (₹)": rate_fmt,
            "Basis": basis_str,
            "Duration": duration_str,
            "People": people_fmt,
            "Total (₹)": total_fmt,
        })

    total = round(total, 2)
    total_fmt = format_indian_currency(total, include_decimals=True)

    computed_rows.append({
        "Role": "Total",
        "Rate (₹)": "",
        "Basis": "",
        "Duration": "",
        "People": "",
        "Total (₹)": total_fmt,
    })

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