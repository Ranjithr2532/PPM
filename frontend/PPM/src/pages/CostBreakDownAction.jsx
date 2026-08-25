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

function HeaderRowsEditor({ headerItem, onChange, onDeleteHeader, officialRates = [], onCellFocused }) {
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

    const updateRow = useCallback((index, key, value) => {
        const next = [...rows];
        next[index] = { ...next[index], [key]: value };
        onChange({ ...headerItem, rows: next });
    }, [rows, headerItem, onChange]);

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
    }, [rows, headerItem, onChange, computeRowAmount]);

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
    }, [rows, headerItem, onChange]);

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
                e.preventDefault();
                if (colIdx < cols.length - 1) {
                    focusCell(rowIdx, cols[colIdx + 1]);
                } else if (rowIdx < rows.length - 1) {
                    focusCell(rowIdx + 1, cols[0]);
                } else {
                    addRow();
                }
            } else { // Enter
                e.preventDefault();
                if (rowIdx < rows.length - 1) {
                    focusCell(rowIdx + 1, colKey);
                } else {
                    addRow();
                }
            }
        } else {
            const colIdx = columns.indexOf(colKey);
            if (e.key === "Tab") {
                e.preventDefault();
                if (colIdx < columns.length - 1) {
                    focusCell(rowIdx, columns[colIdx + 1]);
                } else if (rowIdx < rows.length - 1) {
                    focusCell(rowIdx + 1, columns[0]);
                } else {
                    addRow();
                }
            } else { // Enter
                e.preventDefault();
                if (rowIdx < rows.length - 1) {
                    focusCell(rowIdx + 1, colKey);
                } else {
                    addRow();
                }
            }
        }
    }, [headerName, rows, columns, addRow, focusCell]);

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
    }, [rows, headerItem, onChange, computeRowAmount]);

    const handleRoleChange = useCallback((rowIdx, value) => {
        const matched = roleOptions.find(r => r.value.toLowerCase() === value.trim().toLowerCase());
        if (!matched) setRateToggleRow(prev => { const n = { ...prev }; delete n[rowIdx]; return n; });
        const next = [...rows];
        next[rowIdx] = { ...next[rowIdx], "Role": value };
        onChange({ ...headerItem, rows: next });
    }, [rows, roleOptions, headerItem, onChange]);

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
                    return (
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
                                id={`cell-${headerName}-${index}-role`}
                                placeholder="Role / Designation..."
                                className="text-[13px] font-medium"
                                style={{ color: "#1e293b" }}
                                onKeyDown={(e) => handleKeyDown(index, "role", e)}
                                onFocus={() => onCellFocused && onCellFocused(index)}
                            />
                        </AutoComplete>
                    );
                },
            },
            {
                title: <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Rate (₹)</span>,
                key: "rate",
                width: 165,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const showToggle = rateToggleRow[index] !== undefined;
                    const activeToggle = rateToggleRow[index] || "other";
                    return (
                        <div className="flex items-center gap-1.5">
                            <div id={`cell-${headerName}-${index}-rate`} style={{ flex: 1 }}>
                                <InputNumber
                                    min={0}
                                    controls={false}
                                    value={cb.rate === 0 ? undefined : cb.rate}
                                    onChange={(v) => updateManpowerField(index, "rate", v)}
                                    placeholder="₹ Rate"
                                    style={{ width: "100%" }}
                                    className="text-[13px] font-medium"
                                    onKeyDown={(e) => handleKeyDown(index, "rate", e)}
                                    onFocus={() => onCellFocused && onCellFocused(index)}
                                />
                            </div>
                            {showToggle && (
                                <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-xs">
                                    <Tooltip title="Other Activities rate">
                                        <button
                                            type="button"
                                            onClick={() => applyRateToggle(index, "other")}
                                            className={`px-2 py-1 text-[10px] font-bold cursor-pointer transition-colors ${activeToggle === "other" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                                        >
                                            Oth
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="Design & Developmental Activities rate">
                                        <button
                                            type="button"
                                            onClick={() => applyRateToggle(index, "dev")}
                                            className={`px-2 py-1 text-[10px] font-bold cursor-pointer transition-colors border-l border-slate-200 ${activeToggle === "dev" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                                        >
                                            D&D
                                        </button>
                                    </Tooltip>
                                </div>
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
                    return (
                        <div id={`cell-${headerName}-${index}-type`}>
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
                                onFocus={() => onCellFocused && onCellFocused(index)}
                            />
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
                    return (
                        <div id={`cell-${headerName}-${index}-hrs`}>
                            <InputNumber
                                min={0}
                                controls={false}
                                value={val === 0 ? undefined : val}
                                onChange={(v) => updateManpowerField(index, isMonthly ? "months" : "hours", v)}
                                placeholder={isMonthly ? "Months" : "Hours"}
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "hrs", e)}
                                onFocus={() => onCellFocused && onCellFocused(index)}
                            />
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
                    return (
                        <div id={`cell-${headerName}-${index}-days`}>
                            <InputNumber
                                min={0}
                                controls={false}
                                value={cb.days === 0 ? undefined : cb.days}
                                onChange={(v) => updateManpowerField(index, "days", v)}
                                placeholder="Days"
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "days", e)}
                                onFocus={() => onCellFocused && onCellFocused(index)}
                            />
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
                    return (
                        <div id={`cell-${headerName}-${index}-people`}>
                            <InputNumber
                                min={1}
                                controls={false}
                                value={cb.quantity || 1}
                                onChange={(v) => updateManpowerField(index, "quantity", v)}
                                placeholder="1"
                                style={{ width: "100%" }}
                                className="text-[13px] font-medium"
                                onKeyDown={(e) => handleKeyDown(index, "people", e)}
                                onFocus={() => onCellFocused && onCellFocused(index)}
                            />
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
                        if (isTotalAmount) {
                            return (
                                <div id={`cell-${headerName}-${index}-${col}`}>
                                    <InputNumber
                                        min={0}
                                        controls={false}
                                        value={record[col] === 0 ? undefined : record[col]}
                                        onChange={(v) => updateRow(index, col, v ?? 0)}
                                        className="text-[13px] font-semibold"
                                        style={{ width: "100%" }}
                                        onKeyDown={(e) => handleKeyDown(index, col, e)}
                                        onFocus={() => onCellFocused && onCellFocused(index)}
                                    />
                                </div>
                            );
                        }
                        return (
                            <div id={`cell-${headerName}-${index}-${col}`}>
                                <Input
                                    value={record[col] || ""}
                                    onChange={(e) => updateRow(index, col, e.target.value)}
                                    placeholder={`${col}...`}
                                    className="text-[13px] font-medium"
                                    style={{ color: "#1e293b" }}
                                    onKeyDown={(e) => handleKeyDown(index, col, e)}
                                    onFocus={() => onCellFocused && onCellFocused(index)}
                                />
                            </div>
                        );
                    },
                };
            })
        );
    }

    tableColumns.push({
        title: "",
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
            {/* Add column toolbar — custom sections only */}
            {headerName !== MANPOWER_HEADER && (
                <div className="flex items-center justify-end gap-2">
                    {addingColumn ? (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1">
                            <span className="text-xs text-slate-500 font-medium shrink-0">New column:</span>
                            <Input
                                autoFocus
                                size="small"
                                placeholder="Name (comma-separate for multiple)"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                onPressEnter={confirmAddColumn}
                                className="flex-1"
                                style={{ border: "none", boxShadow: "none", background: "transparent" }}
                            />
                            <Button size="small" type="primary" onClick={confirmAddColumn} className="bg-blue-600 shrink-0">Add</Button>
                            <Button size="small" onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>Cancel</Button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setAddingColumn(true)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <PlusOutlined style={{ fontSize: 9 }} /> Add Column
                        </button>
                    )}
                </div>
            )}

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
                <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={addRow}
                    className="text-blue-600 border-blue-300 hover:border-blue-400 hover:text-blue-700 font-semibold"
                >
                    Add Row
                </Button>
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
            const rows = (h.rows || []).map((r) => {
                return cols.map((col) => String(r[col] ?? ""));
            });
            return {
                title: h.header_name,
                headers: cols,
                rows: rows,
            };
        }
    });
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
    const [generating, setGenerating] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(null);
    const [collapsedSections, setCollapsedSections] = useState(new Set());
    const [ratesPanelOpen, setRatesPanelOpen] = useState(false);
    const [addSectionExpanded, setAddSectionExpanded] = useState(false);
    const [addSectionName, setAddSectionName] = useState("");
    const [officialRates, setOfficialRates] = useState([]);
    const [loadingRates, setLoadingRates] = useState(false);
    const [focusedRow, setFocusedRow] = useState(null);

    const loadNonceRef = useRef(0);

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
            return;
        }

        if (initialHeaders && Array.isArray(initialHeaders) && initialHeaders.length > 0) {
            setHeaders(initialHeaders);
        } else {
            setHeaders([{ header_name: MANPOWER_HEADER, columns: MANPOWER_COLUMNS, rows: [] }]);
        }
        setCurrentVersion(null);
        setCollapsedSections(new Set());
    }, [open, initialHeaders]);

    const closeModal = () => onClose();

    const handleResetWorkspace = () => {
        setHeaders([{ header_name: MANPOWER_HEADER, columns: MANPOWER_COLUMNS, rows: [] }]);
        setCurrentVersion(null);
        setCollapsedSections(new Set());
        setAddSectionExpanded(false);
        setFocusedRow(null);
        message.success("Workspace reset to initial state");
    };

    const handleHeaderChange = (index, updated) => {
        setHeaders(prev => prev.map((h, i) => i === index ? updated : h));
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
        const newSection = { header_name: name, columns: DEFAULT_CUSTOM_COLUMNS, rows: [] };
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
    // • If a Manpower row is focused → update its rate (+ optionally its role name).
    // • If no row is focused OR the table is empty → add a new row pre-filled with designation + rate.
    const applyRateFromPanel = (rate, designation = "") => {
        const numRate = Number(rate);
        setHeaders(prev => prev.map(h => {
            if (h.header_name !== MANPOWER_HEADER) return h;
            const nextRows = [...(h.rows || [])];

            if (focusedRow !== null && nextRows[focusedRow]) {
                const cb = nextRows[focusedRow]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
                const updatedCb = { ...cb, rate: numRate };
                const newAmount = (() => {
                    const r2 = updatedCb.rate ?? 0;
                    const q = updatedCb.quantity ?? 1;
                    if ((updatedCb.type ?? "hourly") === "monthly") return r2 * (updatedCb.months ?? 0) * q;
                    return r2 * (updatedCb.hours ?? 0) * (updatedCb.days ?? 0) * q;
                })();
                const updatedRow = { ...nextRows[focusedRow], "Cost Breakup": updatedCb, "Total Amount": newAmount };
                if (designation && !updatedRow["Role"]) updatedRow["Role"] = designation;
                nextRows[focusedRow] = updatedRow;
                message.success(`₹${numRate.toLocaleString("en-IN")} applied to row ${focusedRow + 1}`);
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
                width={1380}
                style={{ top: 15 }}
                destroyOnClose
                footer={null}
                styles={{
                    content: {
                        borderRadius: "20px",
                        padding: 0,
                        backgroundColor: "#f8fafc",
                        overflow: "hidden",
                    }
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", height: "88vh" }}>

                    {/* ── Top Header Bar ── */}
                    <div
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-8 pt-7 pb-4 border-b border-slate-200/80 bg-[#f8fafc] shrink-0"
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
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <ReloadOutlined /> Reset
                            </button>
                            <button
                                onClick={() => setHistoryOpen(true)}
                                disabled={!projectId}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <HistoryOutlined /> History
                            </button>
                            {/* Rates reference panel toggle */}
                            <button
                                onClick={() => setRatesPanelOpen(p => !p)}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${ratesPanelOpen ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20" : "border-slate-200 text-slate-700 hover:bg-slate-100"}`}
                            >
                                <InfoCircleOutlined /> Rates {ratesPanelOpen ? "✕" : "▸"}
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

                    {/* ── Body: sidebar + scroll area + rates panel ── */}
                    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                        {/* Jump-to-section sidebar (only when 2+ sections) */}
                        {headers.length >= 2 && (
                            <div
                                style={{
                                    width: 158,
                                    borderRight: "1px solid #e2e8f0",
                                    overflowY: "auto",
                                    flexShrink: 0,
                                    background: "#f8fafc",
                                    padding: "16px 8px",
                                }}
                            >
                                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-3">
                                    Sections
                                </div>
                                {headers.map(h => {
                                    const subtotal = getSectionSubtotal(h);
                                    return (
                                        <button
                                            key={h.header_name}
                                            type="button"
                                            onClick={() => scrollToSection(h.header_name)}
                                            className="w-full text-left px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all cursor-pointer mb-0.5"
                                            title={h.header_name}
                                        >
                                            <div className="truncate font-bold">{h.header_name}</div>
                                            <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">
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
                                {headers.map((h, idx) => {
                                    const isCollapsed = collapsedSections.has(h.header_name);
                                    const isManpower = h.header_name === MANPOWER_HEADER;
                                    const subtotal = getSectionSubtotal(h);
                                    const rowCount = (h.rows || []).length;

                                    return (
                                        <div
                                            key={h.header_name}
                                            id={`section-${h.header_name}`}
                                            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                                        >
                                            {/* Section heading bar */}
                                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100/80 bg-white">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapse(h.header_name)}
                                                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-all cursor-pointer shrink-0"
                                                    >
                                                        {isCollapsed
                                                            ? <RightOutlined style={{ fontSize: 11 }} />
                                                            : <DownOutlined style={{ fontSize: 11 }} />
                                                        }
                                                    </button>
                                                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                                                        {h.header_name}
                                                    </h3>
                                                    <span className="px-2.5 py-0.5 text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full tabular-nums">
                                                        ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-medium">
                                                        {rowCount} {rowCount === 1 ? "row" : "rows"}
                                                    </span>
                                                </div>
                                                {!isManpower && (
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
                                                            className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200/80 hover:border-rose-600 rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
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
                                                        onChange={(updated) => handleHeaderChange(idx, updated)}
                                                        onDeleteHeader={handleRemoveHeader}
                                                        officialRates={officialRates}
                                                        onCellFocused={(rowIndex) => setFocusedRow(rowIndex)}
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
                                    borderLeft: "1px solid #e2e8f0",
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
                            <span className="text-xl font-black text-slate-900 bg-blue-50 px-5 py-1.5 rounded-2xl border border-blue-200/80 tabular-nums">
                                ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <RiseOutlined style={{ fontSize: 16 }} />
                            </div>
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