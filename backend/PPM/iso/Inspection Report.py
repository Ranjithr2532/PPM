"""
FastAPI Router & Document Generator for ISO Document 085: Inspection Report.
Re-exports from iso.Inspection_report for compatibility.
"""

from iso.Inspection_report import (
    router,
    InspectionRowRequest,
    InspectionReportRequest,
    create_inspection_report_document,
    generate_inspection_report_bytes,
)

__all__ = [
    "router",
    "InspectionRowRequest",
    "InspectionReportRequest",
    "create_inspection_report_document",
    "generate_inspection_report_bytes",
]
