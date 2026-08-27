import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    Modal,
    Button,
    Drawer,
    Input,
    InputNumber,
    Tag,
    Table,
    Popconfirm,
    message,
    Empty,
    List,
    Spin,
    AutoComplete,
    Select,
    Tooltip,
    Popover,
} from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    FileWordOutlined,
    HistoryOutlined,
    EditOutlined,
    RightOutlined,
    DownOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
    CloseOutlined,
    CheckOutlined,
    RiseOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL } from '../config/api.js';

const MANPOWER_HEADER = "Manpower";
const MANPOWER_COLUMNS = ["Role", "Cost Breakup", "Total Amount"];
const DEFAULT_CUSTOM_COLUMNS = ["Description", "Total Amount"];
const STANDARD_ROLES = [
    { value: "Scientist B" },
    { value: "Scientist C" },
    { value: "Scientist D" },
    { value: "Scientist E" },
    { value: "Scientist F" },
    { value: "Scientist G" },
];

/* ============================================================
   API HELPERS
   ============================================================ */

const api = axios.create({ baseURL: `${API_BASE_URL}/dynamic-tables` });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/** POST /{projectId}/generate-word — saves as new version, downloads .docx */
async function generateWordDocument(projectId, payload) {
    const res = await api.post(`/${projectId}/generate-word`, payload, { responseType: "blob" });

    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const disposition = res.headers["content-disposition"];
    let filename = "cost_breakdown.docx";
    if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
    }

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);

    return parseInt(res.headers["x-version"] || "0", 10);
}

/** GET /{projectId} — loads the latest version's tables */
async function fetchLatestTables(projectId) {
    const res = await api.get(`/${projectId}`);
    return Array.isArray(res.data) ? res.data : [];
}

/** GET /{projectId}/versions — list of all versions with date/author */
async function fetchVersionList(projectId) {
    const res = await api.get(`/${projectId}/versions`);
    return Array.isArray(res.data) ? res.data : [];
}

/** GET /{projectId}/version/{version} — load a specific version's tables */
async function fetchVersionTables(projectId, version) {
    const res = await api.get(`/${projectId}/version/${version}`);
    return Array.isArray(res.data) ? res.data : [];
}

/** DELETE /{projectId}/version/{version} — delete a specific version */
async function deleteVersion(projectId, version) {
    await api.delete(`/${projectId}/version/${version}`);
}

/* ============================================================
   HELPERS
   ============================================================ */

const emptyRow = (columns, headerName) => {
    const row = {};
    columns.forEach((col) => {
        if (headerName === MANPOWER_HEADER && col === "Cost Breakup") {
            row[col] = { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
        } else if (col === "Total Amount") {
            row[col] = 0;
        } else {
            row[col] = "";
        }
    });
    return row;
};

const formatDate = (isoString) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* ============================================================
   SUB-COMPONENT: HeaderRowsEditor
   Spreadsheet-style, always-editable inline table for one section.
   No row locking. Every cell is directly clickable and typeable.
   ============================================================ */

function HeaderRowsEditor({ headerItem, onChange, onDeleteHeader, officialRates = [], onCellFocused, activeCell, setActiveCell }) {
    const { header_name: headerName, columns = [], rows = [] } = headerItem;
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [rateToggleRow, setRateToggleRow] = useState({});
    const [editingCol, setEditingCol] = useState(null);
    const [tempColName, setTempColName] = useState("");

    const roleOptions = useMemo(() => {
        if (officialRates.length > 0) {
            return officialRates.map(r => ({
                value: r.designation,
                rate_other: r.rate_other_activities,
                rate_dev: r.rate_design_developmental_activities,
            }));
        }
        return STANDARD_ROLES;
    }, [officialRates]);

    const computeRowAmount = useCallback((cb) => {
        if (!cb) return 0;
        const rate = cb.rate ?? 0;
        const quantity = cb.quantity ?? 1;
        if ((cb.type ?? "hourly") === "monthly") {
            return rate * (cb.months ?? 0) * quantity;
        }
        return rate * (cb.hours ?? 0) * (cb.days ?? 0) * quantity;
    }, []);

    useEffect(() => {
        if (rows.length === 0) {
            const timeoutId = setTimeout(() => {
                onChange({ ...headerItem, rows: [emptyRow(columns, headerName)] });
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [rows.length, headerItem, onChange, columns, headerName]);

    const updateRow = useCallback((index, key, value) => {
        const next = [...rows];
        next[index] = { ...next[index], [key]: value };
        onChange({ ...headerItem, rows: next });

        setActiveCell(prev => {
            if (prev.section === headerName && prev.rowIdx === index && prev.colKey === key) {
                return { ...prev, value: String(value) };
            }
            return prev;
        });
    }, [rows, headerItem, onChange, columns, headerName, setActiveCell]);

    const updateManpowerField = useCallback((index, key, val) => {
        const next = [...rows];
        const currentCb = next[index]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
        let updatedCb = { ...currentCb, [key]: val ?? 0 };
        if (key === "type") {
            updatedCb = {
                type: val,
                rate: currentCb.rate ?? 0,
                quantity: currentCb.quantity ?? 1,
                hours: val === "hourly" ? (currentCb.hours || 0) : 0,
                days: val === "hourly" ? (currentCb.days || 0) : 0,
                months: val === "monthly" ? (currentCb.months || 0) : 0,
            };
        }
        const newAmount = computeRowAmount(updatedCb);
        next[index] = { ...next[index], "Cost Breakup": updatedCb, "Total Amount": newAmount };
        onChange({ ...headerItem, rows: next });

        setActiveCell(prev => {
            if (prev.section === headerName && prev.rowIdx === index && prev.colKey === key) {
                return { ...prev, value: String(val ?? 0) };
            }
            return prev;
        });
    }, [rows, headerItem, onChange, computeRowAmount, columns, headerName, setActiveCell]);

    const manpowerSubtotal = useMemo(() => {
        if (headerName === MANPOWER_HEADER) {
            return rows.reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                if ((cb.type ?? "hourly") === "monthly") {
                    return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                }
                return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
            }, 0);
        }
        return rows.reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
    }, [headerName, rows]);

    // ── Keyboard navigation helpers ──
    const focusCell = useCallback((rowIdx, colKey) => {
        setTimeout(() => {
            const el = document.getElementById(`cell-${headerName}-${rowIdx}-${colKey}`);
            if (!el) return;
            const input = el.querySelector("input, .ant-select-selector input") || el;
            if (input) input.focus();
        }, 50);
    }, [headerName]);

    const addRow = useCallback(() => {
        const nextRows = [...rows, emptyRow(columns, headerName)];
        const newIdx = nextRows.length - 1;
        onChange({ ...headerItem, rows: nextRows });
        const firstKey = headerName === MANPOWER_HEADER ? "role" : (columns[0] || "");
        if (firstKey) focusCell(newIdx, firstKey);
    }, [rows, columns, headerName, headerItem, onChange, focusCell]);

    const removeRow = useCallback((index) => {
        onChange({ ...headerItem, rows: rows.filter((_, i) => i !== index) });
        setActiveCell({ section: null, rowIdx: null, colKey: null, value: "" });
    }, [rows, headerItem, onChange, setActiveCell]);

    const handleKeyDown = useCallback((rowIdx, colKey, e) => {
        if (e.key !== "Tab" && e.key !== "Enter") return;
        if (e.key === "Tab" && e.shiftKey) return; // allow native Shift+Tab

        if (headerName === MANPOWER_HEADER) {
            const cb = rows[rowIdx]?.["Cost Breakup"] || {};
            const isMonthly = (cb.type ?? "hourly") === "monthly";
            const cols = isMonthly
                ? ["role", "rate", "type", "hrs", "people"]
                : ["role", "rate", "type", "hrs", "days", "people"];
            const colIdx = cols.indexOf(colKey);

            if (e.key === "Tab") {
                if (colIdx < cols.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx, cols[colIdx + 1]);
                } else if (rowIdx < rows.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx + 1, cols[0]);
                }
            } else { // Enter
                if (rowIdx < rows.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx + 1, colKey);
                }
            }
        } else {
            const colIdx = columns.indexOf(colKey);
            if (e.key === "Tab") {
                if (colIdx < columns.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx, columns[colIdx + 1]);
                } else if (rowIdx < rows.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx + 1, columns[0]);
                }
            } else { // Enter
                if (rowIdx < rows.length - 1) {
                    e.preventDefault();
                    focusCell(rowIdx + 1, colKey);
                }
            }
        }
    }, [headerName, rows, columns, focusCell]);

    // ── Role selection & rate autofill ──
    const handleRoleSelect = useCallback((rowIdx, value, option) => {
        const next = [...rows];
        const currentCb = next[rowIdx]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
        let newRate = currentCb.rate || 0;

        if (option && option.rate_other && option.rate_dev) {
            const other = Number(option.rate_other);
            const dev = Number(option.rate_dev);
            if (other !== dev) {
                newRate = other;
                setRateToggleRow(prev => ({ ...prev, [rowIdx]: "other" }));
            } else {
                newRate = other;
                setRateToggleRow(prev => { const n = { ...prev }; delete n[rowIdx]; return n; });
            }
        } else if (option && (option.rate_other || option.rate_dev)) {
            newRate = Number(option.rate_other || option.rate_dev);
            setRateToggleRow(prev => { const n = { ...prev }; delete n[rowIdx]; return n; });
        } else {
            setRateToggleRow(prev => { const n = { ...prev }; delete n[rowIdx]; return n; });
        }

        const updatedCb = { ...currentCb, rate: newRate };
        next[rowIdx] = { ...next[rowIdx], "Role": value, "Cost Breakup": updatedCb, "Total Amount": computeRowAmount(updatedCb) };
        onChange({ ...headerItem, rows: next });

        setActiveCell(prev => {
            if (prev.section === headerName && prev.rowIdx === rowIdx && prev.colKey === "role") {
                return { ...prev, value: String(value) };
            }
            return prev;
        });
    }, [rows, headerItem, onChange, computeRowAmount, columns, headerName, setActiveCell]);

    const handleRoleChange = useCallback((rowIdx, value) => {
        const matched = roleOptions.find(r => r.value.toLowerCase() === value.trim().toLowerCase());
        if (!matched) setRateToggleRow(prev => { const n = { ...prev }; delete n[rowIdx]; return n; });
        const next = [...rows];
        next[rowIdx] = { ...next[rowIdx], "Role": value };
        onChange({ ...headerItem, rows: next });

        setActiveCell(prev => {
            if (prev.section === headerName && prev.rowIdx === rowIdx && prev.colKey === "role") {
                return { ...prev, value: String(value) };
            }
            return prev;
        });
    }, [rows, roleOptions, headerItem, onChange, columns, headerName, setActiveCell]);

    const applyRateToggle = useCallback((rowIdx, rateType) => {
        const record = rows[rowIdx];
        const matched = officialRates.find(r => r.designation.toLowerCase() === (record["Role"] || "").toLowerCase());
        if (!matched) return;
        const rate = rateType === "other"
            ? Number(matched.rate_other_activities)
            : Number(matched.rate_design_developmental_activities);
        setRateToggleRow(prev => ({ ...prev, [rowIdx]: rateType }));
        updateManpowerField(rowIdx, "rate", rate);
    }, [rows, officialRates, updateManpowerField]);

    // ── Column management ──
    const removeColumn = (colName) => {
        const nextColumns = columns.filter(c => c !== colName);
        const nextRows = rows.map(r => { const nr = { ...r }; delete nr[colName]; return nr; });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const renameColumn = (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === oldName) return;
        if (columns.includes(trimmed)) { message.warning("Column name already exists"); return; }
        const nextColumns = columns.map(c => c === oldName ? trimmed : c);
        const nextRows = rows.map(r => {
            const nr = { ...r };
            if (oldName in nr) { nr[trimmed] = nr[oldName]; delete nr[oldName]; }
            return nr;
        });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const startEditingCol = (col) => { setEditingCol(col); setTempColName(col); };
    const confirmRenameCol = (oldName) => {
        const trimmed = tempColName.trim();
        if (!trimmed || trimmed === oldName) { setEditingCol(null); return; }
        if (columns.includes(trimmed)) { message.warning("Column name already exists"); setEditingCol(null); return; }
        renameColumn(oldName, trimmed);
        setEditingCol(null);
    };

    const confirmAddColumn = () => {
        const rawInput = newColumnName.trim();
        if (!rawInput) return;
        const namesToAdd = rawInput.split(",").map(s => s.trim()).filter(s => s.length > 0);
        let currentCols = [...columns];
        let currentRows = [...rows];
        let addedCount = 0;
        for (const name of namesToAdd) {
            if (currentCols.includes(name)) { message.warning(`Column "${name}" already exists`); continue; }
            const amountIndex = currentCols.indexOf("Total Amount");
            currentCols = amountIndex === -1
                ? [...currentCols, name]
                : [...currentCols.slice(0, amountIndex), name, ...currentCols.slice(amountIndex)];
            currentRows = currentRows.map(r => ({ ...r, [name]: "" }));
            addedCount++;
        }
        if (addedCount > 0) {
            onChange({ ...headerItem, columns: currentCols, rows: currentRows });
            message.success(addedCount === 1 ? `Added column "${namesToAdd[0]}"` : `Added ${addedCount} columns`);
        }
        setNewColumnName("");
        setAddingColumn(false);
    };

    // ── Build table columns ──
    const tableColumns = [];

    if (headerName === MANPOWER_HEADER) {
        tableColumns.push(
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Role</span>,
                dataIndex: "Role",
                key: "Role",
                width: 185,
                render: (_, record, index) => {
                    const isRoleActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "role";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-role`}
                            className={`cell-wrapper ${isRoleActive ? "active-cell z-10" : ""}`}
                        >
                            <AutoComplete
                                value={record["Role"] || ""}
                                options={roleOptions}
                                filterOption={(inputValue, option) =>
                                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                                onSelect={(val, opt) => handleRoleSelect(index, val, opt)}
                                onChange={(val) => handleRoleChange(index, val)}
                                style={{ width: "100%" }}
                            >
                                <Input
                                    placeholder="Role / Designation..."
                                    className="text-[13px] font-medium"
                                    style={{ color: "#1e293b" }}
                                    onKeyDown={(e) => handleKeyDown(index, "role", e)}
                                    onFocus={() => onCellFocused && onCellFocused(index, "role", record["Role"])}
                                />
                            </AutoComplete>
                            {isRoleActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Rate (₹)</span>,
                key: "rate",
                width: 165,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isRateActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "rate";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-rate`}
                            className={`cell-wrapper w-full ${isRateActive ? "active-cell z-10" : ""}`}
                        >
                            <InputNumber
                                min={0}
                                controls={false}
                                value={cb.rate === 0 ? undefined : cb.rate}
                                onChange={(v) => updateManpowerField(index, "rate", v)}
                                placeholder="₹ Rate"
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "rate", e)}
                                onFocus={() => onCellFocused && onCellFocused(index, "rate", cb.rate)}
                            />
                            {isRateActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Type</span>,
                key: "type",
                width: 112,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isTypeActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "type";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-type`}
                            className={`cell-wrapper ${isTypeActive ? "active-cell z-10" : ""}`}
                        >
                            <Select
                                value={type}
                                onChange={(v) => updateManpowerField(index, "type", v)}
                                options={[
                                    { label: "Hourly", value: "hourly" },
                                    { label: "Monthly", value: "monthly" },
                                ]}
                                style={{ width: "100%" }}
                                className="text-[13px]"
                                onKeyDown={(e) => handleKeyDown(index, "type", e)}
                                onFocus={() => onCellFocused && onCellFocused(index, "type", type)}
                            />
                            {isTypeActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Hrs / Mos</span>,
                key: "hrs",
                width: 100,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isMonthly = (cb.type ?? "hourly") === "monthly";
                    const val = isMonthly ? cb.months : cb.hours;
                    const isHrsActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "hrs";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-hrs`}
                            className={`cell-wrapper ${isHrsActive ? "active-cell z-10" : ""}`}
                        >
                            <InputNumber
                                min={0}
                                controls={false}
                                value={val === 0 ? undefined : val}
                                onChange={(v) => updateManpowerField(index, isMonthly ? "months" : "hours", v)}
                                placeholder={isMonthly ? "Months" : "Hours"}
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "hrs", e)}
                                onFocus={() => onCellFocused && onCellFocused(index, "hrs", val)}
                            />
                            {isHrsActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Days</span>,
                key: "days",
                width: 88,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isMonthly = (cb.type ?? "hourly") === "monthly";
                    if (isMonthly) return (
                        <span style={{ color: "#cbd5e1", display: "block", textAlign: "center", lineHeight: "32px" }}>—</span>
                    );
                    const isDaysActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "days";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-days`}
                            className={`cell-wrapper ${isDaysActive ? "active-cell z-10" : ""}`}
                        >
                            <InputNumber
                                min={0}
                                controls={false}
                                value={cb.days === 0 ? undefined : cb.days}
                                onChange={(v) => updateManpowerField(index, "days", v)}
                                placeholder="Days"
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "days", e)}
                                onFocus={() => onCellFocused && onCellFocused(index, "days", cb.days)}
                            />
                            {isDaysActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">People</span>,
                key: "people",
                width: 88,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isPeopleActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === "people";
                    return (
                        <div
                            id={`cell-${headerName}-${index}-people`}
                            className={`cell-wrapper ${isPeopleActive ? "active-cell z-10" : ""}`}
                        >
                            <InputNumber
                                min={1}
                                controls={false}
                                value={cb.quantity || 1}
                                onChange={(v) => updateManpowerField(index, "quantity", v)}
                                placeholder="1"
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "people", e)}
                                onFocus={() => onCellFocused && onCellFocused(index, "people", cb.quantity)}
                            />
                            {isPeopleActive && (
                                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                            )}
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Amount (₹)</span>,
                key: "amount",
                width: 145,
                align: "right",
                render: (_, record) => {
                    const cb = record["Cost Breakup"] || {};
                    const amount = computeRowAmount(cb);
                    return (
                        <span className="font-extrabold text-slate-900 text-[13.5px] tabular-nums">
                            ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    );
                },
            }
        );
    } else {
        tableColumns.push(
            ...columns.map((col) => {
                const isColEditing = editingCol === col;
                const isTotalAmount = col === "Total Amount";
                return {
                    title: (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                            {isColEditing ? (
                                <Input
                                    size="small"
                                    value={tempColName}
                                    onChange={(e) => setTempColName(e.target.value)}
                                    onBlur={() => confirmRenameCol(col)}
                                    onPressEnter={() => confirmRenameCol(col)}
                                    autoFocus
                                    style={{ width: 90 }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">{col}</span>
                            )}
                            {!isTotalAmount && !isColEditing && (
                                <div style={{ display: "flex", gap: 3 }} onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => startEditingCol(col)} className="text-slate-300 hover:text-slate-500 cursor-pointer p-0.5 rounded transition-colors">
                                        <EditOutlined style={{ fontSize: 10 }} />
                                    </button>
                                    <Popconfirm title={`Delete column "${col}"?`} onConfirm={() => removeColumn(col)} okButtonProps={{ danger: true, size: "small" }} okText="Delete" cancelText="No">
                                        <button type="button" className="text-slate-300 hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors">
                                            <CloseOutlined style={{ fontSize: 10 }} />
                                        </button>
                                    </Popconfirm>
                                </div>
                            )}
                        </div>
                    ),
                    dataIndex: col,
                    key: col,
                    align: isTotalAmount ? "right" : "left",
                    render: (_, record, index) => {
                        const isCellActive = activeCell && activeCell.section === headerName && activeCell.rowIdx === index && activeCell.colKey === col;
                        if (isTotalAmount) {
                            return (
                                <div
                                    id={`cell-${headerName}-${index}-${col}`}
                                    className={`cell-wrapper ${isCellActive ? "active-cell z-10" : ""}`}
                                >
                                    <InputNumber
                                        min={0}
                                        controls={false}
                                        value={record[col] === 0 ? undefined : record[col]}
                                        onChange={(v) => updateRow(index, col, v ?? 0)}
                                        className="text-[13px] font-semibold"
                                        style={{ width: "100%" }}
                                        onKeyDown={(e) => handleKeyDown(index, col, e)}
                                        onFocus={() => onCellFocused && onCellFocused(index, col, record[col])}
                                    />
                                    {isCellActive && (
                                        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                                    )}
                                </div>
                            );
                        }
                        return (
                            <div
                                id={`cell-${headerName}-${index}-${col}`}
                                className={`cell-wrapper ${isCellActive ? "active-cell z-10" : ""}`}
                            >
                                <Input
                                    value={record[col] || ""}
                                    onChange={(e) => updateRow(index, col, e.target.value)}
                                    placeholder={`${col}...`}
                                    className="text-[13px] font-medium"
                                    style={{ color: "#1e293b" }}
                                    onKeyDown={(e) => handleKeyDown(index, col, e)}
                                    onFocus={() => onCellFocused && onCellFocused(index, col, record[col])}
                                />
                                {isCellActive && (
                                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-black border border-white translate-x-[3px] translate-y-[3px] cursor-crosshair z-20" />
                                )}
                            </div>
                        );
                    },
                };
            })
        );
    }

    tableColumns.push({
        title: headerName !== MANPOWER_HEADER ? (
            <Popover
                content={
                    <div className="flex items-center gap-2">
                        <Input
                            autoFocus
                            size="small"
                            placeholder="Column name"
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            onPressEnter={confirmAddColumn}
                            style={{ width: 140 }}
                        />
                        <Button size="small" type="primary" onClick={confirmAddColumn}>Add</Button>
                    </div>
                }
                title="Add New Column"
                trigger="click"
                open={addingColumn}
                onOpenChange={setAddingColumn}
                placement="bottomRight"
            >
                <Tooltip title="Add Column">
                    <button
                        type="button"
                        className="w-full h-full flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                        <PlusOutlined style={{ fontSize: 13, fontWeight: 'bold' }} />
                    </button>
                </Tooltip>
            </Popover>
        ) : "",
        key: "_delete",
        width: 36,
        render: (_, record, index) => (
            <Tooltip title="Delete row">
                <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                >
                    <CloseOutlined style={{ fontSize: 11 }} />
                </button>
            </Tooltip>
        ),
    });

    return (
        <div className="space-y-3">
            {/* Spreadsheet Table with aligned summary row */}
            <Table
                rowKey={(_, index) => `${headerName}-row-${index}`}
                columns={tableColumns}
                dataSource={rows}
                pagination={false}
                bordered
                size="small"
                locale={{
                    emptyText: (
                        <div className="py-8 text-center">
                            <div className="text-slate-400 text-sm mb-1">No rows yet</div>
                            <div className="text-slate-300 text-xs">Click "+ Add Row" below or press Enter in any cell</div>
                        </div>
                    )
                }}
                style={{ borderRadius: 8, overflow: "hidden" }}
                summary={() => rows.length === 0 ? null : (
                    <Table.Summary fixed>
                        <Table.Summary.Row style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
                            {headerName === MANPOWER_HEADER ? (
                                <>
                                    <Table.Summary.Cell index={0} colSpan={6}>
                                        <span className="text-[12px] font-black text-slate-700 uppercase tracking-wider pl-2">
                                            Manpower Total
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={6} align="right">
                                        <span className="text-[14px] font-black text-blue-950 tabular-nums">
                                            ₹{manpowerSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={7} />
                                </>
                            ) : (() => {
                                return columns.map((col, ci) => {
                                    if (ci === 0) return (
                                        <Table.Summary.Cell key={col} index={ci}>
                                            <span className="text-[12px] font-black text-slate-700 uppercase tracking-wider pl-2">
                                                {headerName} Total
                                            </span>
                                        </Table.Summary.Cell>
                                    );
                                    if (col === "Total Amount") return (
                                        <Table.Summary.Cell key={col} index={ci} align="right">
                                            <span className="text-[14px] font-black text-blue-950 tabular-nums">
                                                ₹{manpowerSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </Table.Summary.Cell>
                                    );
                                    return <Table.Summary.Cell key={col} index={ci} />;
                                }).concat(<Table.Summary.Cell key="_del" index={columns.length} />);
                            })()}
                        </Table.Summary.Row>
                    </Table.Summary>
                )}
            />

            {/* Add-row button */}
            <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] text-slate-400 font-medium select-none">
                    ↵ Press{" "}
                    <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Enter</kbd>
                    {" "}or{" "}
                    <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Tab</kbd>
                    {" "}in any cell to add a new row
                </span>
                <button
                    type="button"
                    onClick={addRow}
                    className="text-blue-600 hover:text-blue-700 font-semibold text-xs flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                    <PlusOutlined style={{ fontSize: 10 }} /> Add Row
                </button>
            </div>
        </div>
    );
}

/* ============================================================
   SUB-COMPONENT: History Drawer
   Shows all saved versions for this project. User can Load or Delete any version.
   ============================================================ */

function HistoryDrawer({ open, onClose, projectId, onLoadVersion }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletingVersion, setDeletingVersion] = useState(null);

    useEffect(() => {
        if (!open || !projectId) return;
        setLoading(true);
        fetchVersionList(projectId)
            .then(setVersions)
            .catch(() => message.error("Failed to load version history"))
            .finally(() => setLoading(false));
    }, [open, projectId]);

    const handleLoad = async (version) => {
        try {
            const tables = await fetchVersionTables(projectId, version);
            onLoadVersion(tables, version);
            onClose();
        } catch {
            message.error(`Failed to load Version ${version}`);
        }
    };

    const handleDelete = async (version) => {
        setDeletingVersion(version);
        try {
            await deleteVersion(projectId, version);
            message.success(`Version ${version} deleted`);
            const updated = await fetchVersionList(projectId);
            setVersions(updated);
        } catch {
            message.error(`Failed to delete Version ${version}`);
        } finally {
            setDeletingVersion(null);
        }
    };

    return (
        <Drawer
            title="📋 Version History"
            placement="right"
            width={380}
            open={open}
            onClose={onClose}
        >
            {loading ? (
                <div style={{ textAlign: "center", paddingTop: 40 }}>
                    <Spin />
                </div>
            ) : versions.length === 0 ? (
                <Empty description="No versions saved yet" />
            ) : (
                <List
                    dataSource={versions}
                    renderItem={(item) => (
                        <List.Item
                            style={{
                                border: "1px solid #f0f0f0",
                                borderRadius: 8,
                                padding: "10px 14px",
                                marginBottom: 10,
                                background: "#fafafa",
                            }}
                            actions={[
                                <Button
                                    key="load"
                                    size="small"
                                    type="primary"
                                    onClick={() => handleLoad(item.version)}
                                >
                                    Load
                                </Button>,
                                <Popconfirm
                                    key="delete"
                                    title={`Delete Version ${item.version} permanently?`}
                                    okText="Yes, Delete"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={() => handleDelete(item.version)}
                                >
                                    <Button
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        loading={deletingVersion === item.version}
                                    />
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <span style={{ fontWeight: 600 }}>
                                        Version {item.version}
                                    </span>
                                }
                                description={
                                    <span style={{ fontSize: 12, color: "#888" }}>
                                        {formatDate(item.created_at)}
                                        {item.created_by ? ` · ${item.created_by}` : ""}
                                    </span>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </Drawer>
    );
}

function formatIndianCurrency(num, includeDecimals = true) {
    if (num === null || num === undefined || isNaN(Number(num))) return "0";
    const val = Number(num);
    const parts = (includeDecimals ? val.toFixed(2) : Math.round(val).toString()).split(".");
    let integerPart = parts[0];
    const decimalPart = parts[1];

    const isNegative = integerPart.startsWith("-");
    if (isNegative) integerPart = integerPart.slice(1);

    let formattedInt = integerPart;
    if (integerPart.length > 3) {
        const lastThree = integerPart.slice(-3);
        const remaining = integerPart.slice(0, -3);
        const groups = [];
        for (let i = remaining.length; i > 0; i -= 2) {
            const start = Math.max(0, i - 2);
            groups.unshift(remaining.slice(start, i));
        }
        formattedInt = groups.join(",") + "," + lastThree;
    }
    if (isNegative) formattedInt = "-" + formattedInt;
    return includeDecimals ? `${formattedInt}.${decimalPart}` : formattedInt;
}

export function convertHeadersToDocumentTables(headers) {
    if (!headers || !Array.isArray(headers)) return [];
    return headers.map((h) => {
        if (h.header_name === MANPOWER_HEADER) {
            const cols = ["Role", "Rate (₹)", "Basis", "Duration", "People", "Total (₹)"];
            let sectionTotal = 0;
            const rows = (h.rows || []).map((r) => {
                const cb = r["Cost Breakup"] || {};
                const type = cb.type ?? "hourly";
                const basis = type === "monthly" ? "Monthly" : "Hourly";
                let dur = "";
                let amt = 0;
                if (type === "monthly") {
                    const months = cb.months || 0;
                    dur = `${months} month${months !== 1 ? 's' : ''}`;
                    amt = (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                } else {
                    const hrs = cb.hours || 0;
                    const days = cb.days || 0;
                    const hrUnit = hrs === 1 ? 'hr' : 'hrs';
                    dur = `${hrs} ${hrUnit} × ${days} days`;
                    amt = (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }
                sectionTotal += amt;
                const rateFormatted = formatIndianCurrency(cb.rate || 0, false);
                const totalFormatted = formatIndianCurrency(amt, true);
                return [
                    r.Role || "",
                    rateFormatted,
                    basis,
                    dur,
                    String(cb.quantity || 1),
                    totalFormatted,
                ];
            });

            rows.push([
                "",
                "",
                "",
                "",
                "Total",
                formatIndianCurrency(sectionTotal, true),
            ]);

            return {
                title: "Manpower",
                headers: cols,
                rows: rows,
            };
        } else {
            const cols = h.columns || ["Description", "Total Amount"];
            let totalAmt = 0;
            const hasTotalAmount = cols.includes("Total Amount");

            const rows = (h.rows || []).map((r) => {
                if (hasTotalAmount) {
                    totalAmt += Number(r["Total Amount"] || 0);
                }
                return cols.map((col) => {
                    const val = r[col];
                    if (col === "Total Amount") {
                        return formatIndianCurrency(Number(val) || 0, true);
                    }
                    return String(val ?? "");
                });
            });

            if (hasTotalAmount && rows.length > 0) {
                const totalRow = cols.map((col, idx) => {
                    if (idx === 0) return "Total";
                    if (col === "Total Amount") return formatIndianCurrency(totalAmt, true);
                    return "";
                });
                rows.push(totalRow);
            }

            return {
                title: h.header_name,
                headers: cols,
                rows: rows,
            };
        }
    });
}

function DocxPreview({ headers, title, createdBy }) {
    const docTables = useMemo(() => convertHeadersToDocumentTables(headers), [headers]);

    const sectionTotals = useMemo(() => {
        return headers.map((h, idx) => {
            const letter = String.fromCharCode(65 + idx);
            let subtotal = 0;
            if (h.header_name === MANPOWER_HEADER) {
                subtotal = (h.rows || []).reduce((sum, r) => {
                    const cb = r["Cost Breakup"] || {};
                    if ((cb.type ?? "hourly") === "monthly") return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }, 0);
            } else if ((h.columns || []).includes("Total Amount")) {
                subtotal = (h.rows || []).reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
            }
            return {
                letter,
                name: h.header_name,
                subtotal,
                category: h.category || "recurring"
            };
        });
    }, [headers]);

    const recurringTotals = useMemo(() => sectionTotals.filter(s => s.category === "recurring"), [sectionTotals]);
    const nonRecurringTotals = useMemo(() => sectionTotals.filter(s => s.category !== "recurring"), [sectionTotals]);

    const recurringSubtotal = useMemo(() => recurringTotals.reduce((sum, s) => sum + s.subtotal, 0), [recurringTotals]);
    const nonRecurringSubtotal = useMemo(() => nonRecurringTotals.reduce((sum, s) => sum + s.subtotal, 0), [nonRecurringTotals]);

    const grandTotal = useMemo(() => {
        return sectionTotals.reduce((acc, s) => acc + s.subtotal, 0);
    }, [sectionTotals]);

    const recurringTables = useMemo(() => {
        return docTables.filter((t, idx) => {
            const origHeader = headers[idx] || {};
            return (origHeader.category || "recurring") === "recurring";
        });
    }, [docTables, headers]);

    const nonRecurringTables = useMemo(() => {
        return docTables.filter((t, idx) => {
            const origHeader = headers[idx] || {};
            return (origHeader.category || "recurring") !== "recurring";
        });
    }, [docTables, headers]);

    const formattedDate = useMemo(() => {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }, []);

    const formulaSuffix = useMemo(() => {
        return recurringTotals.length > 0 && nonRecurringTotals.length > 0 ? " (Section A + Section B)" : "";
    }, [recurringTotals, nonRecurringTotals]);

    return (
        <div
            style={{
                width: 680,
                borderLeft: "1px solid #cbd5e1",
                overflowY: "auto",
                flexShrink: 0,
                background: "#f1f5f9",
                padding: "16px",
            }}
        >
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2.5 select-none">
                Word Document Preview (.docx)
            </div>

            {/* Simulated Word Page */}
            <div className="bg-white shadow-lg border border-slate-300 p-6 min-h-[842px] text-[9.5px] text-[#222222] leading-relaxed font-serif" style={{ fontFamily: "Calibri, sans-serif" }}>

                {/* Title */}
                <h1 className="font-bold text-[12.5px] text-[#222222] mb-2 uppercase" style={{ margin: 0 }}>
                    {title || "Industry 4.0 Pilot Project"}
                </h1>

                {/* Metadata Table */}
                <table className="w-full mb-4 border-collapse text-[8.5px]" style={{ margin: "8px 0" }}>
                    <tbody>
                        <tr style={{ borderBottom: "1px solid #CFCFCF" }}>
                            <td className="py-1 px-0 font-bold text-[#666666] w-20">Project Name</td>
                            <td className="py-1 px-2 text-[#222222] font-semibold">{title || "Industry 4.0 Pilot Project"}</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #CFCFCF" }}>
                            <td className="py-1 px-0 font-bold text-[#666666]">Prepared By</td>
                            <td className="py-1 px-2 text-[#222222]">{createdBy || "Project Management Team"}</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #CFCFCF" }}>
                            <td className="py-1 px-0 font-bold text-[#666666]">Date Created</td>
                            <td className="py-1 px-2 text-[#222222]">{formattedDate}</td>
                        </tr>
                    </tbody>
                </table>

                {/* 1. Cost Summary */}
                <h2 className="font-bold text-[9.5px] text-[#222222] mt-4 mb-1.5" style={{ borderBottom: "1.5px solid #7A2E2E", paddingBottom: 2 }}>
                    1. Cost Summary
                </h2>
                <table className="w-full border-collapse text-[8.5px] mb-4">
                    <thead>
                        <tr className="bg-[#F7F7F7]">
                            <th className="border-b-2 border-[#222222] px-2 py-1 text-left font-bold text-[#222222] w-16">Ref</th>
                            <th className="border-b-2 border-[#222222] px-2 py-1 text-left font-bold text-[#222222]">Cost Section / Table Name</th>
                            <th className="border-b-2 border-[#222222] px-2 py-1 text-right font-bold text-[#222222] w-28">Subtotal (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recurringTotals.length > 0 && (
                            <>
                                <tr className="bg-[#F7F7F7] font-bold">
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">Section A</td>
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">Recurring Expenses (Total)</td>
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-right">
                                        {formatIndianCurrency(recurringSubtotal, true)}
                                    </td>
                                </tr>
                                {recurringTotals.map((s, idx) => (
                                    <tr key={`rec-${idx}`}>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">A{idx + 1}</td>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-left" style={{ paddingLeft: 12 }}>• {s.name}</td>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-right">
                                            {formatIndianCurrency(s.subtotal, true)}
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                        {nonRecurringTotals.length > 0 && (
                            <>
                                <tr className="bg-[#F7F7F7] font-bold">
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">Section B</td>
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">Non-Recurring Expenses (Total)</td>
                                    <td className="border-b border-[#CFCFCF] px-2 py-1 text-right">
                                        {formatIndianCurrency(nonRecurringSubtotal, true)}
                                    </td>
                                </tr>
                                {nonRecurringTotals.map((s, idx) => (
                                    <tr key={`non-rec-${idx}`}>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-left">B{idx + 1}</td>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-left" style={{ paddingLeft: 12 }}>• {s.name}</td>
                                        <td className="border-b border-[#CFCFCF] px-2 py-1 text-right">
                                            {formatIndianCurrency(s.subtotal, true)}
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                        <tr className="bg-[#F7F7F7] font-bold">
                            <td className="border-t border-b-2 border-[#222222] px-2 py-1 text-left"></td>
                            <td className="border-t border-b-2 border-[#222222] px-2 py-1 text-left font-bold">Grand Total</td>
                            <td className="border-t border-b-2 border-[#222222] px-2 py-1 text-right font-bold">
                                {formatIndianCurrency(grandTotal, true)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. Detailed Cost Breakdown */}
                <h2 className="font-bold text-[9.5px] text-[#222222] mt-4 mb-1.5" style={{ borderBottom: "1.5px solid #7A2E2E", paddingBottom: 2 }}>
                    2. Detailed Cost Breakdown
                </h2>

                {docTables.length === 0 ? (
                    <div className="text-slate-400 text-center py-4 italic">No sections configured</div>
                ) : (
                    <>
                        {recurringTables.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-bold text-[9.5px] text-[#7A2E2E] mt-3 mb-2" style={{ textDecoration: "underline" }}>
                                    Section A — Recurring Expenses
                                </h3>
                                {recurringTables.map((t, idx) => (
                                    <div key={`rec-table-${idx}`} className="mb-3">
                                        <h4 className="font-bold text-[8.5px] text-[#222222] mt-2 mb-1.5">
                                            A{idx + 1}. {t.title}
                                        </h4>
                                        <table className="w-full border-collapse text-[8px] mb-1">
                                            <thead>
                                                <tr className="bg-[#F7F7F7]">
                                                    {t.headers.map((h, hi) => {
                                                        const h_str = h.trim();
                                                        let align = "text-left";
                                                        if (h_str === "Basis" || h_str === "People") align = "text-center";
                                                        else if (h_str.includes("Total") || h_str.includes("Amount") || hi === t.headers.length - 1) align = "text-right";

                                                        return (
                                                            <th key={hi} className={`border-b-2 border-[#222222] px-2 py-1 font-bold text-[#222222] uppercase ${align}`}>
                                                                {h}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {t.rows.map((row, ri) => {
                                                    const isTotalRow = ri === t.rows.length - 1 && (t.title === "Manpower" || t.headers.includes("Total Amount"));
                                                    return (
                                                        <tr key={ri} className={isTotalRow ? "font-bold bg-[#F7F7F7]" : ""}>
                                                            {row.map((cell, ci) => {
                                                                const h_str = t.headers[ci].trim();
                                                                let align = "text-left";
                                                                if (h_str === "Basis" || h_str === "People") align = "text-center";
                                                                else if (h_str.includes("Total") || h_str.includes("Amount") || ci === t.headers.length - 1) align = "text-right";

                                                                return (
                                                                    <td key={ci} className={`border-b border-[#CFCFCF] px-2 py-1 text-[#222222] ${isTotalRow ? "border-t border-b-2 border-[#222222]" : ""} ${align}`}>
                                                                        {cell}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        )}

                        {nonRecurringTables.length > 0 && (
                            <div className="mb-4">
                                <h3 className="font-bold text-[9.5px] text-[#7A2E2E] mt-3 mb-2" style={{ textDecoration: "underline" }}>
                                    Section B — Non-Recurring Expenses
                                </h3>
                                {nonRecurringTables.map((t, idx) => (
                                    <div key={`nonrec-table-${idx}`} className="mb-3">
                                        <h4 className="font-bold text-[8.5px] text-[#222222] mt-2 mb-1.5">
                                            B{idx + 1}. {t.title}
                                        </h4>
                                        <table className="w-full border-collapse text-[8px] mb-1">
                                            <thead>
                                                <tr className="bg-[#F7F7F7]">
                                                    {t.headers.map((h, hi) => {
                                                        const h_str = h.trim();
                                                        let align = "text-left";
                                                        if (h_str === "Basis" || h_str === "People") align = "text-center";
                                                        else if (h_str.includes("Total") || h_str.includes("Amount") || hi === t.headers.length - 1) align = "text-right";

                                                        return (
                                                            <th key={hi} className={`border-b-2 border-[#222222] px-2 py-1 font-bold text-[#222222] uppercase ${align}`}>
                                                                {h}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {t.rows.map((row, ri) => {
                                                    const isTotalRow = ri === t.rows.length - 1 && (t.title === "Manpower" || t.headers.includes("Total Amount"));
                                                    return (
                                                        <tr key={ri} className={isTotalRow ? "font-bold bg-[#F7F7F7]" : ""}>
                                                            {row.map((cell, ci) => {
                                                                const h_str = t.headers[ci].trim();
                                                                let align = "text-left";
                                                                if (h_str === "Basis" || h_str === "People") align = "text-center";
                                                                else if (h_str.includes("Total") || h_str.includes("Amount") || ci === t.headers.length - 1) align = "text-right";

                                                                return (
                                                                    <td key={ci} className={`border-b border-[#CFCFCF] px-2 py-1 text-[#222222] ${isTotalRow ? "border-t border-b-2 border-[#222222]" : ""} ${align}`}>
                                                                        {cell}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Grand Total banner */}
                <div className="mt-5 mb-5 p-2 bg-[#F7F7F7]" style={{ borderTop: "1px solid #222222", borderBottom: "1px solid #222222" }}>
                    <span className="font-bold text-[8px] text-[#222222]">
                        Grand Total Estimated Cost{formulaSuffix}:
                    </span>
                    <span className="font-bold text-[9px] text-[#7A2E2E] ml-2 font-mono">
                        ₹ {formatIndianCurrency(grandTotal, true)}
                    </span>
                </div>

                {/* Sign-off matrix */}
                <div className="mt-5 flex justify-between text-[8px]">
                    <div style={{ borderTop: "1px solid #CFCFCF", width: "120px", paddingTop: "6px" }}>
                        <div className="font-bold text-[#222222]">Prepared By</div>
                        <div className="text-[#666666]">{createdBy || "Project Engineer"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ============================================================
   MAIN COMPONENT: CostEstimationModal
   Single-page, scrollable, spreadsheet-style cost entry studio.
   ============================================================ */

export function CostEstimationModal({
    open,
    onClose,
    title,
    createdBy,
    projectId,
    onApply,
    hideGenerateWord = false,
    initialHeaders = null,
}) {
    const [headers, setHeaders] = useState([]);
    const [activeTab, setActiveTab] = useState("recurring");
    const [generating, setGenerating] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(null);
    const [collapsedSections, setCollapsedSections] = useState(new Set());
    const [ratesPanelOpen, setRatesPanelOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [addSectionExpanded, setAddSectionExpanded] = useState(false);
    const [addSectionName, setAddSectionName] = useState("");
    const [officialRates, setOfficialRates] = useState([]);
    const [loadingRates, setLoadingRates] = useState(false);
    const [focusedRow, setFocusedRow] = useState(null);
    const [activeCell, setActiveCell] = useState({ section: null, rowIdx: null, colKey: null, value: "" });

    const loadNonceRef = useRef(0);

    const calculateManpowerRowAmount = (cb) => {
        if (!cb) return 0;
        const rate = cb.rate ?? 0;
        const quantity = cb.quantity ?? 1;
        if ((cb.type ?? "hourly") === "monthly") {
            return rate * (cb.months ?? 0) * quantity;
        }
        return rate * (cb.hours ?? 0) * (cb.days ?? 0) * quantity;
    };

    const handleFormulaBarChange = (newValue) => {
        if (!activeCell.section || activeCell.rowIdx === null || !activeCell.colKey) return;

        let cleanValue = newValue;
        if (cleanValue.startsWith("=")) {
            cleanValue = cleanValue.substring(1);
        }

        setActiveCell(prev => ({ ...prev, value: newValue }));

        setHeaders(prev => prev.map(h => {
            if (h.header_name !== activeCell.section) return h;
            const nextRows = [...(h.rows || [])];
            const rowIdx = activeCell.rowIdx;
            const colKey = activeCell.colKey;

            if (activeCell.section === MANPOWER_HEADER) {
                if (colKey === "role") {
                    nextRows[rowIdx] = { ...nextRows[rowIdx], "Role": cleanValue };
                } else {
                    const currentCb = nextRows[rowIdx]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
                    let fieldKey = colKey;
                    if (colKey === "rate") fieldKey = "rate";
                    else if (colKey === "hrs") fieldKey = currentCb.type === "monthly" ? "months" : "hours";
                    else if (colKey === "days") fieldKey = "days";
                    else if (colKey === "people") fieldKey = "quantity";

                    const valNum = Number(cleanValue) || 0;
                    let updatedCb = { ...currentCb, [fieldKey]: valNum };
                    const newAmount = calculateManpowerRowAmount(updatedCb);
                    nextRows[rowIdx] = { ...nextRows[rowIdx], "Cost Breakup": updatedCb, "Total Amount": newAmount };
                }
            } else {
                const isTotalAmount = colKey === "Total Amount";
                nextRows[rowIdx] = { ...nextRows[rowIdx], [colKey]: isTotalAmount ? (Number(cleanValue) || 0) : cleanValue };
            }
            return { ...h, rows: nextRows };
        }));
    };

    useEffect(() => {
        if (!open) return;
        setLoadingRates(true);
        axios.get(`${API_BASE_URL}/manpower-rates/`)
            .then(res => { if (Array.isArray(res.data)) setOfficialRates(res.data); })
            .catch(err => console.error("Failed to load manpower rates", err))
            .finally(() => setLoadingRates(false));
    }, [open]);

    useEffect(() => {
        if (!open) {
            setHeaders([]);
            setCollapsedSections(new Set());
            setCurrentVersion(null);
            setHistoryOpen(false);
            setAddSectionExpanded(false);
            setAddSectionName("");
            setRatesPanelOpen(false);
            setFocusedRow(null);
            setActiveTab("recurring");
            return;
        }

        if (initialHeaders && Array.isArray(initialHeaders) && initialHeaders.length > 0) {
            const mapped = initialHeaders.map(h => ({
                ...h,
                category: h.category || (h.header_name === MANPOWER_HEADER ? "recurring" : "recurring")
            }));
            setHeaders(mapped);
        } else {
            setHeaders([
                { header_name: MANPOWER_HEADER, columns: MANPOWER_COLUMNS, rows: [], category: "recurring" }
            ]);
        }
        setCurrentVersion(null);
        setCollapsedSections(new Set());
    }, [open, initialHeaders]);

    const closeModal = () => onClose();

    const handleResetWorkspace = () => {
        setHeaders([
            { header_name: MANPOWER_HEADER, columns: MANPOWER_COLUMNS, rows: [], category: "recurring" }
        ]);
        setCurrentVersion(null);
        setCollapsedSections(new Set());
        setAddSectionExpanded(false);
        setFocusedRow(null);
        setActiveTab("recurring");
        message.success("Workspace reset to initial state");
    };

    const handleHeaderChange = (headerName, updated) => {
        setHeaders(prev => prev.map(h => h.header_name === headerName ? updated : h));
    };

    const handleRemoveHeader = (headerName) => {
        if (headerName === MANPOWER_HEADER) { message.warning("Manpower section cannot be deleted"); return; }
        setHeaders(prev => prev.filter(h => h.header_name !== headerName));
        message.success(`Deleted section "${headerName}"`);
    };

    const handleLoadVersion = (tables, version) => {
        loadNonceRef.current++;
        setHeaders(tables);
        setCurrentVersion(version);
        message.info(`Version ${version} loaded. Edit and click Generate to save as a new version.`);
    };

    const handleAddSection = () => {
        const name = addSectionName.trim();
        if (!name) { message.warning("Enter a section name"); return; }
        if (headers.some(h => h.header_name === name)) { message.warning("A section with this name already exists"); return; }
        const newSection = { header_name: name, columns: DEFAULT_CUSTOM_COLUMNS, rows: [], category: activeTab };
        setHeaders(prev => [...prev, newSection]);
        setAddSectionExpanded(false);
        setAddSectionName("");
        setTimeout(() => {
            const el = document.getElementById(`section-${name}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
    };

    const toggleCollapse = (sectionName) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionName)) next.delete(sectionName);
            else next.add(sectionName);
            return next;
        });
    };

    const scrollToSection = (sectionName) => {
        const el = document.getElementById(`section-${sectionName}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleGenerate = async () => {
        if (!projectId) { message.error("Missing project reference - cannot save or generate"); return; }
        setGenerating(true);
        try {
            const newVersion = await generateWordDocument(projectId, {
                title: title || "Cost Breakdown",
                created_by: createdBy,
                tables: headers,
            });
            message.success(`Saved as Version ${newVersion || ""} and Word document generated`);
            closeModal();
        } catch {
            message.error("Failed to save/generate document");
        } finally {
            setGenerating(false);
        }
    };

    // Apply a rate from the rates panel.
    // • If a Manpower row is focused OR a blank row exists → update its rate and designation.
    // • Otherwise → add a new row pre-filled with designation + rate.
    const applyRateFromPanel = (rate, designation = "") => {
        const numRate = Number(rate);
        setHeaders(prev => prev.map(h => {
            if (h.header_name !== MANPOWER_HEADER) return h;
            const nextRows = [...(h.rows || [])];

            let targetIdx = focusedRow;
            if (targetIdx === null) {
                // If no row is focused, look for the first blank row (where Role is empty/blank)
                const firstEmptyIdx = nextRows.findIndex(r => !String(r["Role"] || "").trim());
                if (firstEmptyIdx !== -1) {
                    targetIdx = firstEmptyIdx;
                }
            }

            if (targetIdx !== null && nextRows[targetIdx]) {
                const cb = nextRows[targetIdx]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
                const updatedCb = { ...cb, rate: numRate };
                const newAmount = (() => {
                    const r2 = updatedCb.rate ?? 0;
                    const q = updatedCb.quantity ?? 1;
                    if ((updatedCb.type ?? "hourly") === "monthly") return r2 * (updatedCb.months ?? 0) * q;
                    return r2 * (updatedCb.hours ?? 0) * (updatedCb.days ?? 0) * q;
                })();
                const updatedRow = { ...nextRows[targetIdx], "Cost Breakup": updatedCb, "Total Amount": newAmount };
                if (designation) updatedRow["Role"] = designation;
                nextRows[targetIdx] = updatedRow;
                setFocusedRow(null);
                message.success(`₹${numRate.toLocaleString("en-IN")} applied to row ${targetIdx + 1}`);
            } else {
                const newCb = { type: "hourly", rate: numRate, hours: 0, days: 0, months: 0, quantity: 1 };
                nextRows.push({
                    "Role": designation || "",
                    "Cost Breakup": newCb,
                    "Total Amount": 0,
                });
                setFocusedRow(null);
                message.success(`Added "${designation || 'row'}" with rate ₹${numRate.toLocaleString("en-IN")}`);
            }

            return { ...h, rows: nextRows };
        }));
    };

    const grandTotal = useMemo(() => {
        return headers.reduce((acc, h) => {
            if (h.header_name === MANPOWER_HEADER) {
                return acc + (h.rows || []).reduce((sum, r) => {
                    const cb = r["Cost Breakup"] || {};
                    if ((cb.type ?? "hourly") === "monthly") return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }, 0);
            }
            if ((h.columns || []).includes("Total Amount")) {
                return acc + (h.rows || []).reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
            }
            return acc;
        }, 0);
    }, [headers]);

    const getSectionSubtotal = useCallback((h) => {
        if (h.header_name === MANPOWER_HEADER) {
            return (h.rows || []).reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                if ((cb.type ?? "hourly") === "monthly") return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
            }, 0);
        }
        return (h.rows || []).reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
    }, []);

    const totalRows = headers.reduce((acc, h) => acc + (h.rows || []).length, 0);

    return (
        <>
            <Modal
                open={open}
                onCancel={closeModal}
                width={previewOpen ? 1680 : 1380}
                style={{ top: 15 }}
                destroyOnClose
                footer={null}
                wrapClassName="cost-estimation-modal-wrap"
                styles={{
                    content: {
                        borderRadius: "20px",
                        padding: 0,
                        backgroundColor: "#f8fafc",
                        overflow: "hidden",
                    }
                }}
            >
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .cost-estimation-modal-wrap .ant-table {
                        border-radius: 8px !important;
                        border: 1px solid #cbd5e1 !important;
                        overflow: hidden !important;
                    }
                    .cost-estimation-modal-wrap .ant-table-thead > tr > th {
                        background-color: #f1f5f9 !important;
                        color: #1e293b !important;
                        font-weight: 850 !important;
                        font-size: 11px !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.05em !important;
                        padding: 10px 14px !important;
                        border-bottom: 2px solid #cbd5e1 !important;
                        border-right: 1px solid #cbd5e1 !important;
                    }
                    .cost-estimation-modal-wrap .ant-table-thead > tr > th:last-child {
                        border-right: none !important;
                    }
                    .cost-estimation-modal-wrap .ant-table-tbody > tr > td {
                        padding: 0 !important;
                        height: 38px !important;
                        border-bottom: 1px solid #e2e8f0 !important;
                        border-right: 1px solid #cbd5e1 !important;
                        background: #ffffff !important;
                    }
                    .cost-estimation-modal-wrap .ant-table-tbody > tr > td:last-child {
                        border-right: none !important;
                    }
                    .cost-estimation-modal-wrap .cell-wrapper {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        border: 2px solid transparent;
                        box-sizing: border-box;
                    }
                    .cost-estimation-modal-wrap .cell-wrapper.active-cell {
                        border: 2px solid #000000 !important;
                        background: #ffffff !important;
                    }
                    .cost-estimation-modal-wrap .ant-input,
                    .cost-estimation-modal-wrap .ant-input-number,
                    .cost-estimation-modal-wrap .ant-select-selector {
                        border: none !important;
                        box-shadow: none !important;
                        background: transparent !important;
                        font-size: 13px !important;
                        width: 100% !important;
                        height: 100% !important;
                        padding: 4px 10px !important;
                        border-radius: 0 !important;
                        color: #1e293b !important;
                    }
                    .cost-estimation-modal-wrap .ant-select-selector {
                        display: flex !important;
                        align-items: center !important;
                        border-radius: 0 !important;
                    }
                    .cost-estimation-modal-wrap .ant-input-number-input-wrap,
                    .cost-estimation-modal-wrap .ant-input-number-input {
                        height: 100% !important;
                    }
                `}} />
                <div style={{ display: "flex", flexDirection: "column", height: "88vh" }}>

                    {/* ── Top Header Bar ── */}
                    <div
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-8 pt-7 pb-4 border-b border-slate-200 bg-[#f8fafc] shrink-0"
                    >
                        <div>
                            <span className="inline-block px-3 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200/80 rounded-full tracking-wider uppercase">
                                COST ESTIMATION
                            </span>
                            <div className="flex items-center gap-3 mt-1.5">
                                <h1 className="text-2xl font-normal text-slate-900 font-['Times_New_Roman',serif]">
                                    {title || "Industry 4.0 Pilot Project"}
                                </h1>
                                {currentVersion && (
                                    <Tag color="blue" className="font-semibold rounded-md">
                                        Editing: Version {currentVersion}
                                    </Tag>
                                )}
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <button
                                onClick={handleResetWorkspace}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <ReloadOutlined /> Reset
                            </button>
                            <button
                                onClick={() => setHistoryOpen(true)}
                                disabled={!projectId}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <HistoryOutlined /> History
                            </button>

                            {/* Preview Panel toggle */}
                            <button
                                onClick={() => setPreviewOpen(p => !p)}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${previewOpen ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20" : "border-slate-200 text-slate-700 bg-white hover:bg-slate-50"}`}
                            >
                                <FileWordOutlined /> Preview {previewOpen ? "✕" : "▸"}
                            </button>
                            {onApply || hideGenerateWord ? (
                                <button
                                    onClick={() => { if (onApply) onApply(headers); message.success("Cost breakdown applied to proposal document"); onClose(); }}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    <CheckOutlined /> Apply Cost Breakdown
                                </button>
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
                                >
                                    <FileWordOutlined /> {generating ? "Generating..." : "Generate Word Document"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Category Segmented Tabs ── */}
                    <div className="px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 select-none">
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setActiveTab("recurring")}
                                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                                    activeTab === "recurring"
                                        ? "bg-white text-blue-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900 bg-transparent"
                                }`}
                            >
                                Recurring Costs
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("non-recurring")}
                                className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                                    activeTab === "non-recurring"
                                        ? "bg-white text-blue-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900 bg-transparent"
                                }`}
                            >
                                Non-Recurring Costs
                            </button>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                            Switch tabs to configure recurring vs one-time costs
                        </div>
                    </div>

                    {/* ── Body: sidebar + scroll area + rates panel ── */}
                    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                        {/* Jump-to-section sidebar (only when 2+ sections in current category) */}
                        {headers.filter(h => (h.category || "recurring") === activeTab).length >= 2 && (
                            <div
                                style={{
                                    width: 158,
                                    borderRight: "1px solid #cbd5e1",
                                    overflowY: "auto",
                                    flexShrink: 0,
                                    background: "#f8fafc",
                                    padding: "16px 8px",
                                }}
                            >
                                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-3">
                                    Sections
                                </div>
                                {headers.filter(h => (h.category || "recurring") === activeTab).map(h => {
                                    const subtotal = getSectionSubtotal(h);
                                    return (
                                        <button
                                            key={h.header_name}
                                            type="button"
                                            onClick={() => scrollToSection(h.header_name)}
                                            className="w-full text-left px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all cursor-pointer mb-0.5 border-none bg-transparent"
                                            title={h.header_name}
                                        >
                                            <div className="truncate font-bold">{h.header_name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                                                ₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Main scrollable content */}
                        <div
                            style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}
                            id="cost-studio-scroll"
                        >
                            <div className="space-y-5">
                                {headers.filter(h => (h.category || "recurring") === activeTab).map((h) => {
                                    const isCollapsed = collapsedSections.has(h.header_name);
                                    const isManpower = h.header_name === MANPOWER_HEADER;
                                    const subtotal = getSectionSubtotal(h);
                                    const rowCount = (h.rows || []).length;

                                    return (
                                        <div
                                            key={h.header_name}
                                            id={`section-${h.header_name}`}
                                            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                                        >
                                            {/* Section heading bar */}
                                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-100">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapse(h.header_name)}
                                                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-200 transition-all cursor-pointer shrink-0"
                                                    >
                                                        {isCollapsed
                                                            ? <RightOutlined style={{ fontSize: 11 }} />
                                                            : <DownOutlined style={{ fontSize: 11 }} />
                                                        }
                                                    </button>
                                                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                                                        {h.header_name}: ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h3>
                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        {rowCount} {rowCount === 1 ? "row" : "rows"}
                                                    </span>
                                                </div>
                                                {isManpower ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRatesPanelOpen((p) => !p)}
                                                        className={`px-2.5 py-1 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border rounded-lg shrink-0 ${
                                                            ratesPanelOpen
                                                                ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                                                                : "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                                                        }`}
                                                    >
                                                        <InfoCircleOutlined style={{ fontSize: 10 }} /> Rates Reference
                                                    </button>
                                                ) : (
                                                    <Popconfirm
                                                        title={`Delete section "${h.header_name}"?`}
                                                        description="This will permanently delete this section and all its rows."
                                                        onConfirm={() => handleRemoveHeader(h.header_name)}
                                                        okText="Delete"
                                                        cancelText="Cancel"
                                                        okButtonProps={{ danger: true, size: "small" }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                                                        >
                                                            <DeleteOutlined style={{ fontSize: 10 }} /> Delete
                                                        </button>
                                                    </Popconfirm>
                                                )}
                                            </div>

                                            {/* Section body (collapsible) */}
                                            {!isCollapsed && (
                                                <div className="p-5">
                                                    <HeaderRowsEditor
                                                        headerItem={h}
                                                        onChange={(updated) => handleHeaderChange(h.header_name, updated)}
                                                        onDeleteHeader={handleRemoveHeader}
                                                        officialRates={officialRates}
                                                        onCellFocused={(rowIndex, colKey, val) => {
                                                            setFocusedRow(rowIndex);
                                                            setActiveCell({ section: h.header_name, rowIdx: rowIndex, colKey, value: val !== undefined && val !== null ? String(val) : "" });
                                                        }}
                                                        activeCell={activeCell}
                                                        setActiveCell={setActiveCell}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* ── Inline Add Section at bottom ── */}
                                <div className="bg-white rounded-2xl border border-dashed border-slate-300 overflow-hidden">
                                    {!addSectionExpanded ? (
                                        <button
                                            type="button"
                                            onClick={() => setAddSectionExpanded(true)}
                                            className="w-full py-4 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <PlusOutlined /> Add Cost Section
                                        </button>
                                    ) : (
                                        <div className="px-6 py-4 flex items-center gap-3">
                                            <Input
                                                autoFocus
                                                placeholder="Section name (e.g. Travel, Equipment, Consumables, Vendors...)"
                                                value={addSectionName}
                                                onChange={(e) => setAddSectionName(e.target.value)}
                                                onPressEnter={handleAddSection}
                                                className="flex-1 rounded-xl"
                                            />
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={handleAddSection}
                                                className="bg-blue-600 hover:bg-blue-700 font-bold shrink-0"
                                            >
                                                Create
                                            </Button>
                                            <Button onClick={() => { setAddSectionExpanded(false); setAddSectionName(""); }}>
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Rates Slide-out Panel ── */}
                        {ratesPanelOpen && (
                            <div
                                style={{
                                    width: 300,
                                    borderLeft: "1px solid #cbd5e1",
                                    overflowY: "auto",
                                    flexShrink: 0,
                                    background: "#ffffff",
                                    padding: "16px",
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-extrabold text-slate-800">Rate Reference</span>
                                    <button
                                        type="button"
                                        onClick={() => setRatesPanelOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 cursor-pointer w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
                                    >
                                        <CloseOutlined style={{ fontSize: 12 }} />
                                    </button>
                                </div>

                                <div className="text-[11px] text-slate-600 mb-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100 leading-relaxed">
                                    {focusedRow !== null
                                        ? <><strong>Row {focusedRow + 1}</strong> is active — click a rate to fill it.<br /><span className="text-slate-400">Or click any rate to add a new row.</span></>
                                        : <>Click a rate to <strong>add a new Manpower row</strong> with it pre-filled, or click into an existing row first to update it.</>
                                    }
                                </div>

                                {loadingRates ? (
                                    <div className="text-center pt-8"><Spin /></div>
                                ) : officialRates.length === 0 ? (
                                    <Empty description="No rates configured by Admin" />
                                ) : (
                                    <div className="space-y-2">
                                        {officialRates.map((r) => (
                                            <div
                                                key={r.id || r.designation}
                                                className="border border-slate-100 rounded-xl p-2.5 space-y-1.5 hover:border-slate-200 transition-colors"
                                            >
                                                <div className="text-xs font-extrabold text-slate-800 truncate" title={r.designation}>
                                                    {r.designation}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyRateFromPanel(r.rate_other_activities, r.designation)}
                                                        className="flex-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200/80 transition-all cursor-pointer active:scale-95 text-right"
                                                        title="Other Activities rate"
                                                    >
                                                        <div className="text-[9px] text-blue-500 text-left font-medium">Other</div>
                                                        ₹{Number(r.rate_other_activities).toLocaleString("en-IN")}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyRateFromPanel(r.rate_design_developmental_activities, r.designation)}
                                                        className="flex-1 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-all cursor-pointer active:scale-95 text-right"
                                                        title="Design & Dev rate"
                                                    >
                                                        <div className="text-[9px] text-slate-500 text-left font-medium">D&D</div>
                                                        ₹{Number(r.rate_design_developmental_activities).toLocaleString("en-IN")}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* ── Word Preview Panel ── */}
                        {previewOpen && (
                            <DocxPreview headers={headers} title={title} createdBy={createdBy} />
                        )}
                    </div>

                    {/* ── Sticky Grand Total bar (pinned to bottom) ── */}
                    <div
                        className="flex items-center justify-between px-8 py-3.5 border-t border-slate-200 bg-white shrink-0"
                        style={{ boxShadow: "0 -2px 8px rgba(0,0,0,0.04)" }}
                    >
                        <div className="text-xs text-slate-500 font-medium">
                            {totalRows} {totalRows === 1 ? "row" : "rows"} across {headers.length} {headers.length === 1 ? "section" : "sections"}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-600">Grand Total Estimated Cost:</span>
                            <span className="text-xl font-black text-slate-900 bg-slate-100 px-5 py-1.5 rounded-xl border border-slate-300 tabular-nums">
                                ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </Modal>

            <HistoryDrawer
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                projectId={projectId}
                onLoadVersion={handleLoadVersion}
            />
        </>
    );
}