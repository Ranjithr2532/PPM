import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    Modal,
    Button,
    Drawer,
    Input,
    InputNumber,
    Tag,
    Table,
    Tabs,
    Popconfirm,
    message,
    Empty,
    List,
    Spin,
    Typography,
    Radio,
    AutoComplete,
    Select,
    Popover,
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
    AppstoreOutlined,
    UnorderedListOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
    UpOutlined,
    UserOutlined,
    CloseOutlined,
    CheckOutlined,
    LockOutlined,
    FormOutlined,
    ExpandOutlined,
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

    // Return the new version number from the response header
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
   SUB-COMPONENT: Manpower's 4-field inline cost input
   ============================================================ */

function HeaderRowsEditor({ headerItem, onChange, onNewTable, onDeleteHeader }) {
    const { header_name: headerName, columns = [], rows = [] } = headerItem;
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [focusRowIndex, setFocusRowIndex] = useState(null);
    const [ratesModalOpen, setRatesModalOpen] = useState(false);
    const [officialRates, setOfficialRates] = useState([]);
    const [loadingRates, setLoadingRates] = useState(false);
    const [pendingCustomRate, setPendingCustomRate] = useState(null);
    const [customRoleInput, setCustomRoleInput] = useState("");
    const [customRoleModalOpen, setCustomRoleModalOpen] = useState(false);
    const [editingRows, setEditingRows] = useState({});

    // Vertical Form Window Modal State
    const [rowFormModalOpen, setRowFormModalOpen] = useState(false);
    const [editingRowIndex, setEditingRowIndex] = useState(null); // null = new item, number = edit existing
    const [modalFormData, setModalFormData] = useState({
        Role: "",
        CostBreakup: { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 },
        TotalAmount: 0,
        customValues: {},
    });

    // Auto-open vertical window modal by default when opening section if it has 0 rows (Manpower only)
    const autoOpenedRef = useRef(false);
    useEffect(() => {
        if (headerName === MANPOWER_HEADER && !autoOpenedRef.current && rows.length === 0) {
            autoOpenedRef.current = true;
            handleOpenAddDetails();
        }
    }, [headerName, rows.length]);

    const isRowComplete = useCallback((record) => {
        if (!record) return false;
        if (headerName === MANPOWER_HEADER) {
            return !!(record["Role"] && String(record["Role"]).trim());
        }
        const firstCol = columns[0];
        return !!(firstCol && record[firstCol] && String(record[firstCol]).trim());
    }, [headerName, columns]);

    const checkIsRowEditing = useCallback((index, record) => {
        if (editingRows[index] !== undefined) {
            return editingRows[index];
        }
        return false; // Default to LOCKED once saved!
    }, [editingRows]);

    const handleOpenAddDetails = () => {
        setEditingRowIndex(null);
        setModalFormData({
            Role: "",
            CostBreakup: { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 },
            TotalAmount: 0,
            customValues: {},
        });
        setRowFormModalOpen(true);
    };

    const handleOpenEditDetails = (index) => {
        const r = rows[index];
        setEditingRowIndex(index);
        if (headerName === MANPOWER_HEADER) {
            setModalFormData({
                Role: r["Role"] || "",
                CostBreakup: r["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 },
                TotalAmount: r["Total Amount"] || 0,
                customValues: {},
            });
        } else {
            setModalFormData({
                Role: "",
                CostBreakup: {},
                TotalAmount: r["Total Amount"] || 0,
                customValues: { ...r },
            });
        }
        setRowFormModalOpen(true);
    };

    const toggleEditRow = (index, record) => {
        setEditingRows((prev) => {
            const currentlyEditing = checkIsRowEditing(index, record);
            return {
                ...prev,
                [index]: !currentlyEditing,
            };
        });
    };

    useEffect(() => {
        if (headerName === MANPOWER_HEADER) {
            axios.get(`${API_BASE_URL}/manpower-rates/`)
                .then(res => {
                    if (Array.isArray(res.data)) {
                        setOfficialRates(res.data);
                    }
                })
                .catch(err => console.error("Failed to load manpower rates", err));
        }
    }, [headerName]);

    const fetchOfficialRates = async () => {
        setLoadingRates(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/manpower-rates/`);
            if (Array.isArray(res.data)) {
                setOfficialRates(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch manpower rates", e);
        } finally {
            setLoadingRates(false);
        }
    };

    const roleOptions = useMemo(() => {
        if (officialRates.length > 0) {
            return officialRates.map(r => ({
                value: r.designation,
                rate_other: r.rate_other_activities,
                rate_dev: r.rate_design_developmental_activities
            }));
        }
        return STANDARD_ROLES;
    }, [officialRates]);

    // Auto-complete descriptions storage
    const [savedDescriptions, setSavedDescriptions] = useState(() => {
        try {
            const stored = localStorage.getItem("costEstimation_savedDescriptions");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const saveDescriptionToMemory = (text, rateValue = 0) => {
        const trimmed = text?.trim();
        if (!trimmed) return;
        setSavedDescriptions((prev) => {
            const existingIdx = prev.findIndex(
                (item) => item.value.toLowerCase() === trimmed.toLowerCase()
            );
            let updated;
            if (existingIdx > -1) {
                updated = [...prev];
                updated[existingIdx] = { value: prev[existingIdx].value, rate: rateValue > 0 ? rateValue : prev[existingIdx].rate };
            } else {
                updated = [...prev, { value: trimmed, rate: rateValue }];
            }
            localStorage.setItem("costEstimation_savedDescriptions", JSON.stringify(updated));
            return updated;
        });
    };

    const computeRowAmount = (cb) => {
        if (!cb) return 0;
        const rate = cb.rate ?? 0;
        const quantity = cb.quantity ?? 1;
        const type = cb.type ?? "hourly";
        if (type === "monthly") {
            const months = cb.months ?? 0;
            return rate * months * quantity;
        } else {
            const hours = cb.hours ?? 0;
            const days = cb.days ?? 0;
            return rate * hours * days * quantity;
        }
    };

    const updateRow = (index, key, value) => {
        const next = [...rows];
        next[index] = { ...next[index], [key]: value };
        onChange({ ...headerItem, rows: next });
    };

    const updateManpowerField = (index, key, val) => {
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

        next[index] = {
            ...next[index],
            "Cost Breakup": updatedCb,
            "Total Amount": newAmount
        };
        onChange({ ...headerItem, rows: next });

        if (key === "rate" && val > 0) {
            const roleName = next[index]["Role"];
            if (roleName) {
                saveDescriptionToMemory(roleName, val);
            }
        }
    };

    const addRow = () => {
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            if (!isRowComplete(lastRow)) {
                message.warning("Please enter data in the current row before adding a new row.");
                return;
            }
        }
        const newIdx = rows.length;
        const nextRows = [...rows, emptyRow(columns, headerName)];
        onChange({ ...headerItem, rows: nextRows });
        setFocusRowIndex(newIdx);
        setEditingRows((prev) => ({
            ...prev,
            [newIdx]: true,
        }));
    };

    useEffect(() => {
        if (focusRowIndex !== null) {
            const inputEl = document.getElementById(`row-desc-${focusRowIndex}`);
            if (inputEl) {
                inputEl.focus();
            }
            setFocusRowIndex(null);
        }
    }, [focusRowIndex]);

    const removeRow = (index) => {
        onChange({ ...headerItem, rows: rows.filter((_, i) => i !== index) });
    };

    const removeColumn = (colName) => {
        const nextColumns = columns.filter((c) => c !== colName);
        const nextRows = rows.map((r) => {
            const nextRow = { ...r };
            delete nextRow[colName];
            return nextRow;
        });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const renameColumn = (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        if (trimmed === oldName) return;
        if (columns.includes(trimmed)) {
            message.warning("Column name already exists");
            return;
        }
        const nextColumns = columns.map((c) => (c === oldName ? trimmed : c));
        const nextRows = rows.map((r) => {
            const nextRow = { ...r };
            if (oldName in nextRow) {
                nextRow[trimmed] = nextRow[oldName];
                delete nextRow[oldName];
            }
            return nextRow;
        });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const [editingCol, setEditingCol] = useState(null);
    const [tempColName, setTempColName] = useState("");

    const startEditingCol = (col) => {
        setEditingCol(col);
        setTempColName(col);
    };

    const confirmRenameCol = (oldName) => {
        const trimmed = tempColName.trim();
        if (!trimmed) {
            setEditingCol(null);
            return;
        }
        if (trimmed === oldName) {
            setEditingCol(null);
            return;
        }
        if (columns.includes(trimmed)) {
            message.warning("Column name already exists");
            setEditingCol(null);
            return;
        }
        renameColumn(oldName, trimmed);
        setEditingCol(null);
    };

    const confirmAddColumn = (keepOpen = true) => {
        const rawInput = newColumnName.trim();
        if (!rawInput) {
            if (!keepOpen) setAddingColumn(false);
            return;
        }

        // Split by comma if user typed multiple names at once (e.g. "Quantity, Unit Cost, Remarks")
        const namesToAdd = rawInput
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        if (namesToAdd.length === 0) return;

        let currentCols = [...columns];
        let currentRows = [...rows];
        let addedCount = 0;

        for (const name of namesToAdd) {
            if (currentCols.includes(name)) {
                message.warning(`Column "${name}" already exists`);
                continue;
            }
            const amountIndex = currentCols.indexOf("Total Amount");
            currentCols =
                amountIndex === -1
                    ? [...currentCols, name]
                    : [...currentCols.slice(0, amountIndex), name, ...currentCols.slice(amountIndex)];
            currentRows = currentRows.map((r) => ({ ...r, [name]: "" }));
            addedCount++;
        }

        if (addedCount > 0) {
            onChange({ ...headerItem, columns: currentCols, rows: currentRows });
            message.success(addedCount === 1 ? `Added column "${namesToAdd[0]}"` : `Added ${addedCount} columns`);
        }

        setNewColumnName("");
        if (!keepOpen) {
            setAddingColumn(false);
        }
    };

    const previewTotal = useMemo(() => {
        if (headerName === MANPOWER_HEADER) {
            return rows.reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                const type = cb.type ?? "hourly";
                if (type === "monthly") {
                    return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                } else {
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }
            }, 0);
        }
        if (columns.includes("Total Amount")) {
            return rows.reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
        }
        return null;
    }, [rows, columns, headerName]);

    const tableColumns = [];

    const handleRoleSelectOrChange = (index, value, option = null) => {
        const next = [...rows];
        const currentCb = next[index]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };

        let newRate = currentCb.rate || 0;
        if (option && (option.rate_other || option.rate_dev)) {
            if (!currentCb.rate || currentCb.rate === 0) {
                newRate = option.rate_other || option.rate_dev || 0;
            }
        }

        const updatedCb = { ...currentCb, rate: newRate };
        const newAmount = computeRowAmount(updatedCb);

        next[index] = {
            ...next[index],
            "Role": value,
            "Cost Breakup": updatedCb,
            "Total Amount": newAmount,
        };
        onChange({ ...headerItem, rows: next });
    };

    if (headerName === MANPOWER_HEADER) {
        tableColumns.push(
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Role</span>,
                dataIndex: "Role",
                key: "Role",
                width: 175,
                render: (_, record, index) => {
                    const isEditing = checkIsRowEditing(index, record);
                    const formMark = (
                        <button
                            type="button"
                            onClick={() => setRowFormModalIndex(index)}
                            className="p-1 hover:bg-purple-100 text-purple-700 bg-purple-50 border border-purple-200/80 rounded-md transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
                            title="Touch to open vertical form window"
                        >
                            <FormOutlined style={{ fontSize: 12 }} />
                        </button>
                    );

                    if (!isEditing) {
                        return (
                            <div className="flex items-center gap-2">
                                {formMark}
                                <span className="font-semibold text-slate-900 text-[13.5px]">{record["Role"] || "—"}</span>
                            </div>
                        );
                    }
                    return (
                        <div className="flex items-center gap-2">
                            {formMark}
                            <AutoComplete
                                id={`row-desc-${index}`}
                                value={record["Role"] || ""}
                                options={roleOptions}
                                filterOption={(inputValue, option) =>
                                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                                onSelect={(value, option) => handleRoleSelectOrChange(index, value, option)}
                                onChange={(value) => handleRoleSelectOrChange(index, value)}
                                style={{ width: "100%" }}
                            >
                                <Input
                                    placeholder="Enter role..."
                                    className="text-[13.5px] font-medium"
                                    style={{ color: "#1e293b", backgroundColor: "#ffffff" }}
                                />
                            </AutoComplete>
                        </div>
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Rate</span>,
                key: "rate",
                width: 115,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isEditing = checkIsRowEditing(index, record);
                    if (!isEditing) {
                        return <span className="font-semibold text-slate-900 text-[13.5px] tabular-nums">{cb.rate ? `₹${Number(cb.rate).toLocaleString("en-IN")}` : "—"}</span>;
                    }

                    const roleName = record["Role"] || "";
                    const matchedRate = officialRates.find(
                        (r) => r.designation.toLowerCase() === roleName.trim().toLowerCase()
                    );

                    const inputEl = (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.rate === 0 ? undefined : cb.rate}
                            onChange={(v) => updateManpowerField(index, "rate", v)}
                            placeholder="Rate"
                            className="text-[13.5px] font-medium"
                            style={{ width: "100%" }}
                        />
                    );

                    if (!matchedRate) return inputEl;

                    const popoverContent = (
                        <div className="p-2 space-y-1.5 min-w-[210px]">
                            <div className="text-xs font-bold text-slate-800 border-b pb-1">
                                Official Admin Rates for {matchedRate.designation}
                            </div>
                            <button
                                type="button"
                                onClick={() => updateManpowerField(index, "rate", Number(matchedRate.rate_other_activities))}
                                className="w-full text-left px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold text-blue-700 flex items-center justify-between transition-colors cursor-pointer"
                            >
                                <span>Other Activities</span>
                                <span className="font-black">₹{Number(matchedRate.rate_other_activities).toLocaleString("en-IN")}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => updateManpowerField(index, "rate", Number(matchedRate.rate_design_developmental_activities))}
                                className="w-full text-left px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-bold text-emerald-700 flex items-center justify-between transition-colors cursor-pointer"
                            >
                                <span>Design & Dev</span>
                                <span className="font-black">₹{Number(matchedRate.rate_design_developmental_activities).toLocaleString("en-IN")}</span>
                            </button>
                        </div>
                    );

                    return (
                        <Popover content={popoverContent} trigger="click" placement="top">
                            {inputEl}
                        </Popover>
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Type</span>,
                key: "type",
                width: 105,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isEditing = checkIsRowEditing(index, record);
                    if (!isEditing) {
                        return (
                            <Tag color={type === "monthly" ? "purple" : "blue"} className="font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-200/60 m-0">
                                {type === "monthly" ? "Monthly" : "Hourly"}
                            </Tag>
                        );
                    }
                    return (
                        <Select
                            value={type}
                            onChange={(v) => updateManpowerField(index, "type", v)}
                            options={[
                                { label: "Hourly", value: "hourly" },
                                { label: "Monthly", value: "monthly" },
                            ]}
                            className="text-[13.5px] font-medium"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Hrs / Month</span>,
                key: "hours_months",
                width: 110,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isMonthly = type === "monthly";
                    const val = isMonthly ? cb.months : cb.hours;
                    const isEditing = checkIsRowEditing(index, record);
                    if (!isEditing) {
                        return <span className="text-slate-800 font-medium text-[13.5px] tabular-nums">{val ? `${val} ${isMonthly ? "Mos" : "Hrs"}` : "—"}</span>;
                    }
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={val === 0 ? undefined : val}
                            onChange={(v) => updateManpowerField(index, isMonthly ? "months" : "hours", v)}
                            placeholder={isMonthly ? "Mos" : "Hrs"}
                            className="text-[13.5px] font-medium"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Days</span>,
                key: "days",
                width: 85,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isMonthly = type === "monthly";
                    const isEditing = checkIsRowEditing(index, record);
                    if (!isEditing) {
                        return <span className="text-slate-800 font-medium text-[13.5px] tabular-nums">{isMonthly ? "—" : (cb.days ? `${cb.days} Days` : "—")}</span>;
                    }
                    if (isMonthly) {
                        return <span style={{ color: "#ccc", display: "block", textAlign: "center" }}>—</span>;
                    }
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.days === 0 ? undefined : cb.days}
                            onChange={(v) => updateManpowerField(index, "days", v)}
                            placeholder="Days"
                            className="text-[13.5px] font-medium"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">No. of People</span>,
                key: "quantity",
                width: 100,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isEditing = checkIsRowEditing(index, record);
                    if (!isEditing) {
                        return <span className="text-slate-800 font-semibold text-[13.5px] tabular-nums">{cb.quantity || 1}</span>;
                    }
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.quantity === 0 ? undefined : cb.quantity}
                            onChange={(v) => updateManpowerField(index, "quantity", v)}
                            placeholder="0"
                            className="text-[13.5px] font-medium"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Amount</span>,
                dataIndex: "Total Amount",
                key: "Total Amount",
                width: 120,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const isEditing = checkIsRowEditing(index, record);
                    const amount = computeRowAmount(cb);
                    if (!isEditing) {
                        return <span className="font-bold text-slate-900 text-[13.5px] tabular-nums">₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
                    }
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={record["Total Amount"]}
                            onChange={(v) => updateRow(index, "Total Amount", v ?? 0)}
                            className="text-[13.5px] font-semibold"
                            style={{ width: "100%" }}
                        />
                    );
                },
            }
        );
    } else {
        tableColumns.push(
            ...columns.map((col) => {
                const isColEditing = editingCol === col;
                const isFirstCol = col === columns[0]; // usually Description
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
                                <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">{col}</span>
                            )}
                            {!isFirstCol && col !== "Total Amount" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                    {!isColEditing && (
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<EditOutlined style={{ fontSize: 11 }} />}
                                            style={{ padding: 0, width: 16, height: 16, minWidth: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={() => startEditingCol(col)}
                                            title="Rename column"
                                        />
                                    )}
                                    <Popconfirm
                                        title={`Delete column "${col}"?`}
                                        onConfirm={() => removeColumn(col)}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                                            style={{ padding: 0, width: 16, height: 16, minWidth: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Delete column"
                                        />
                                    </Popconfirm>
                                </div>
                            )}
                        </div>
                    ),
                    dataIndex: col,
                    key: col,
                    render: (_, record, index) => {
                        const isRowEditing = checkIsRowEditing(index, record);

                        if (col === "Total Amount") {
                            if (!isRowEditing) {
                                return <span className="font-bold text-slate-900 text-[13.5px] tabular-nums">₹{(Number(record[col]) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
                            }
                            return (
                                <InputNumber
                                    min={0}
                                    controls={false}
                                    value={record[col]}
                                    onChange={(v) => updateRow(index, col, v ?? 0)}
                                    className="text-[13.5px] font-semibold"
                                    style={{ width: 120 }}
                                />
                            );
                        }

                        const formMark = (
                            <button
                                type="button"
                                onClick={() => setRowFormModalIndex(index)}
                                className="p-1 hover:bg-purple-100 text-purple-700 bg-purple-50 border border-purple-200/80 rounded-md transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
                                title="Touch to open vertical form window"
                            >
                                <FormOutlined style={{ fontSize: 12 }} />
                            </button>
                        );

                        if (!isRowEditing) {
                            return (
                                <div className="flex items-center gap-2">
                                    {isFirstCol && formMark}
                                    <span className="font-semibold text-slate-900 text-[13.5px]">{record[col] || "—"}</span>
                                </div>
                            );
                        }

                        if (isFirstCol) {
                            return (
                                <div className="flex items-center gap-2">
                                    {formMark}
                                    <Input
                                        id={`row-desc-${index}`}
                                        value={record[col] || ""}
                                        onChange={(e) => updateRow(index, col, e.target.value)}
                                        placeholder={`Enter ${col.toLowerCase()}...`}
                                        className="text-[13.5px] font-medium"
                                        style={{ color: "#1e293b", backgroundColor: "#ffffff" }}
                                    />
                                </div>
                            );
                        }
                        return <Input value={record[col]} className="text-[13.5px] font-medium" onChange={(e) => updateRow(index, col, e.target.value)} />;
                    },
                };
            })
        );
    }

    tableColumns.push({
        title: "",
        key: "actions",
        width: 110,
        render: (_, record, index) => {
            const isEditing = checkIsRowEditing(index, record);
            return (
                <div className="flex items-center justify-end gap-1">
                    <Button
                        size="small"
                        type="default"
                        icon={<EditOutlined style={{ fontSize: 11 }} />}
                        onClick={() => handleOpenEditDetails(index)}
                        title="Edit row details in Vertical Window"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 font-bold"
                    />
                    <Popconfirm title="Remove row?" onConfirm={() => removeRow(index)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined style={{ fontSize: 11 }} />} />
                    </Popconfirm>
                </div>
            );
        },
    });

    const applyOfficialRateToTable = (designation, rate, activityTypeLabel, customRoleOverride = null) => {
        const isOthers = designation.toLowerCase().includes("other");

        // If user selected "Others" and custom role name is not provided yet, open custom role input modal!
        if (isOthers && !customRoleOverride) {
            setPendingCustomRate({ designation, rate, activityTypeLabel });
            setCustomRoleInput("");
            setCustomRoleModalOpen(true);
            return;
        }

        const finalRoleName = (customRoleOverride || designation).trim();
        const numRate = Number(rate) || 0;

        // Open the Vertical Window Modal with this Role & Rate pre-filled so the user can enter hours, days, quantity before saving/locking!
        setEditingRowIndex(null);
        setModalFormData({
            Role: finalRoleName,
            CostBreakup: { type: "hourly", rate: numRate, hours: 0, days: 0, months: 0, quantity: 1 },
            TotalAmount: 0,
            customValues: {},
        });
        setRatesModalOpen(false);
        setRowFormModalOpen(true);
        message.info(`Pre-filled "${finalRoleName}" (₹${numRate}) in Vertical Form. Enter details and click Save.`);
    };

    const handleConfirmCustomRole = () => {
        const roleName = customRoleInput.trim();
        if (!roleName) {
            message.warning("Please enter a role name");
            return;
        }
        if (pendingCustomRate) {
            applyOfficialRateToTable(
                pendingCustomRate.designation,
                pendingCustomRate.rate,
                pendingCustomRate.activityTypeLabel,
                roleName
            );
        }
        setCustomRoleModalOpen(false);
        setPendingCustomRate(null);
        setCustomRoleInput("");
    };

    const sectionSubtotal = useMemo(() => {
        if (headerName === MANPOWER_HEADER) {
            return rows.reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                const type = cb.type ?? "hourly";
                if (type === "monthly") {
                    return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                } else {
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }
            }, 0);
        }
        return rows.reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
    }, [headerName, rows]);

    const handleSaveModalForm = () => {
        if (headerName === MANPOWER_HEADER) {
            if (!modalFormData.Role || !modalFormData.Role.trim()) {
                message.warning("Please select or enter a Role / Item name");
                return;
            }
            const cb = modalFormData.CostBreakup || {};
            if (!cb.rate || Number(cb.rate) <= 0) {
                message.warning("Please enter Price / Rate (₹)");
                return;
            }
            const isMonthly = cb.type === "monthly";
            if (isMonthly) {
                if (!cb.months || Number(cb.months) <= 0) {
                    message.warning("Please enter Months Required");
                    return;
                }
            } else {
                if (!cb.hours || Number(cb.hours) <= 0) {
                    message.warning("Please enter Hours Required");
                    return;
                }
                if (!cb.days || Number(cb.days) <= 0) {
                    message.warning("Please enter Days Required");
                    return;
                }
            }
            if (!cb.quantity || Number(cb.quantity) <= 0) {
                message.warning("Please enter Number of People");
                return;
            }

            const newAmount = computeRowAmount(modalFormData.CostBreakup);
            const newRowData = {
                "Role": modalFormData.Role.trim(),
                "Cost Breakup": modalFormData.CostBreakup,
                "Total Amount": newAmount,
            };

            if (editingRowIndex === null) {
                const nextRows = [...rows, newRowData];
                const newIdx = nextRows.length - 1;
                setEditingRows((prev) => ({ ...prev, [newIdx]: false }));
                onChange({ ...headerItem, rows: nextRows });
                message.success(`Added "${newRowData["Role"]}" to table`);
            } else {
                const nextRows = [...rows];
                nextRows[editingRowIndex] = newRowData;
                setEditingRows((prev) => ({ ...prev, [editingRowIndex]: false }));
                onChange({ ...headerItem, rows: nextRows });
                message.success(`Updated "${newRowData["Role"]}"`);
            }
        } else {
            const firstCol = columns[0];
            const firstVal = modalFormData.customValues[firstCol];
            if (!firstVal || !String(firstVal).trim()) {
                message.warning(`Please enter ${firstCol}`);
                return;
            }
            const newRowData = { ...modalFormData.customValues };

            if (editingRowIndex === null) {
                const nextRows = [...rows, newRowData];
                const newIdx = nextRows.length - 1;
                setEditingRows((prev) => ({ ...prev, [newIdx]: false }));
                onChange({ ...headerItem, rows: nextRows });
                message.success("Added row to section");
            } else {
                const nextRows = [...rows];
                nextRows[editingRowIndex] = newRowData;
                setEditingRows((prev) => ({ ...prev, [editingRowIndex]: false }));
                onChange({ ...headerItem, rows: nextRows });
                message.success("Updated row");
            }
        }

        setRowFormModalOpen(false);
    };

    const isLastRowIncomplete = rows.length > 0 && !isRowComplete(rows[rows.length - 1]);

    return (
        <div className="space-y-3">
            {headerName === MANPOWER_HEADER ? (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/70 rounded-xl px-3.5 py-2 text-xs">
                    <span className="text-slate-700 font-medium flex items-center gap-1.5">
                        <InfoCircleOutlined className="text-blue-600 font-bold text-sm" />
                        Check standard rates configured by Admin for each role.
                    </span>
                    <Button
                        size="small"
                        type="primary"
                        icon={<InfoCircleOutlined />}
                        onClick={() => {
                            fetchOfficialRates();
                            setRatesModalOpen(true);
                        }}
                        className="text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    >
                        {ratesModalOpen ? "Close Reference" : "View Rates Reference"}
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200/80 rounded-xl px-3.5 py-2">
                    <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-slate-800 text-xs tracking-tight">{headerName} Section</span>
                        <span className="px-2.5 py-0.5 text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
                            Subtotal: ₹{sectionSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setAddingColumn(true)}
                            className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        >
                            <PlusOutlined style={{ fontSize: 10 }} /> Add Column
                        </button>
                        {onDeleteHeader && (
                            <Popconfirm
                                title={`Delete table "${headerName}"?`}
                                description="This will permanently delete this section and all its rows."
                                onConfirm={() => onDeleteHeader(headerName)}
                                okText="Delete Table"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true, size: "small" }}
                            >
                                <button
                                    type="button"
                                    className="px-3 py-1 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200/80 hover:border-rose-600 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                                >
                                    <DeleteOutlined style={{ fontSize: 11 }} /> Delete Table
                                </button>
                            </Popconfirm>
                        )}
                    </div>
                </div>
            )}

            <Table
                rowKey={(record) => record.id || record.Role || record.Description || JSON.stringify(record)}
                columns={tableColumns}
                dataSource={rows}
                pagination={false}
                bordered
                size="small"
                footer={() => (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", width: "100%" }}>
                        <div />
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenAddDetails}
                            style={{ justifySelf: "center" }}
                            className="font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                        >
                            Add Details
                        </Button>
                    </div>
                )}
            />

            {/* Vertical Window Data Entry Form Modal */}
            <Modal
                title={
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 font-sans pr-6">
                        <span className="text-slate-800 font-bold text-lg">
                            {editingRowIndex === null
                                ? `New ${headerName === MANPOWER_HEADER ? 'Manpower Role' : 'Item'}`
                                : `Edit ${headerName === MANPOWER_HEADER ? 'Manpower Role' : 'Item'}`}
                        </span>
                        {headerName === MANPOWER_HEADER && (
                            <a
                                onClick={() => {
                                    fetchOfficialRates();
                                    setRatesModalOpen(true);
                                }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer flex items-center gap-1"
                            >
                                <InfoCircleOutlined /> View Rates Reference ↗
                            </a>
                        )}
                    </div>
                }
                open={rowFormModalOpen}
                onCancel={() => setRowFormModalOpen(false)}
                footer={null}
                width={560}
                destroyOnClose
                styles={{
                    content: { borderRadius: "12px", padding: "28px 32px 32px 32px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }
                }}
            >
                <div className="py-2 space-y-6 font-sans text-sm">
                    {headerName === MANPOWER_HEADER ? (
                        <>
                            {/* Row 1: Role */}
                            <div className="flex items-start gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0 pt-2">
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <div className="flex-1">
                                    <AutoComplete
                                        value={modalFormData.Role || ""}
                                        options={roleOptions}
                                        filterOption={(inputValue, option) =>
                                            option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                        }
                                        onSelect={(val, option) => {
                                            let newRate = modalFormData.CostBreakup.rate || 0;
                                            if (option && (option.rate_other || option.rate_dev)) {
                                                newRate = option.rate_other || option.rate_dev || 0;
                                            }
                                            setModalFormData((prev) => ({
                                                ...prev,
                                                Role: val,
                                                CostBreakup: { ...prev.CostBreakup, rate: newRate },
                                            }));
                                        }}
                                        onChange={(val) => setModalFormData((prev) => ({ ...prev, Role: val }))}
                                        style={{ width: "100%" }}
                                    >
                                        <Input placeholder="Enter or select role..." className="rounded-lg py-2 font-normal text-slate-800 border-slate-300" />
                                    </AutoComplete>
                                </div>
                            </div>

                            {/* Row 2: Price / Rate */}
                            <div className="flex items-center gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                    Price <span className="text-red-500">*</span>
                                </label>
                                <div className="flex-1">
                                    <InputNumber
                                        min={0}
                                        controls={false}
                                        value={modalFormData.CostBreakup.rate || undefined}
                                        onChange={(v) =>
                                            setModalFormData((prev) => ({
                                                ...prev,
                                                CostBreakup: { ...prev.CostBreakup, rate: v ?? 0 },
                                            }))
                                        }
                                        placeholder="Enter rate (₹)"
                                        className="w-full rounded-lg py-1 font-normal text-slate-800 border-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Basis Type */}
                            <div className="flex items-center gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                    Basis Type
                                </label>
                                <div className="flex-1">
                                    <Select
                                        value={modalFormData.CostBreakup.type || "hourly"}
                                        onChange={(v) =>
                                            setModalFormData((prev) => ({
                                                ...prev,
                                                CostBreakup: { ...prev.CostBreakup, type: v },
                                            }))
                                        }
                                        options={[
                                            { label: "Hourly Basis", value: "hourly" },
                                            { label: "Monthly Basis", value: "monthly" },
                                        ]}
                                        className="w-full font-normal text-slate-800"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Hours / Months */}
                            <div className="flex items-center gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                    {modalFormData.CostBreakup.type === "monthly" ? "Months Required" : "Hours Required"}
                                </label>
                                <div className="flex-1">
                                    <InputNumber
                                        min={0}
                                        controls={false}
                                        value={
                                            modalFormData.CostBreakup.type === "monthly"
                                                ? modalFormData.CostBreakup.months
                                                : modalFormData.CostBreakup.hours
                                        }
                                        onChange={(v) =>
                                            setModalFormData((prev) => ({
                                                ...prev,
                                                CostBreakup: {
                                                    ...prev.CostBreakup,
                                                    [prev.CostBreakup.type === "monthly" ? "months" : "hours"]: v ?? 0,
                                                },
                                            }))
                                        }
                                        placeholder="0"
                                        className="w-full rounded-lg py-1 font-normal text-slate-800 border-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Row 5: Days Required (if Hourly) */}
                            {modalFormData.CostBreakup.type !== "monthly" && (
                                <div className="flex items-center gap-4">
                                    <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                        Days Required
                                    </label>
                                    <div className="flex-1">
                                        <InputNumber
                                            min={0}
                                            controls={false}
                                            value={modalFormData.CostBreakup.days || undefined}
                                            onChange={(v) =>
                                                setModalFormData((prev) => ({
                                                    ...prev,
                                                    CostBreakup: { ...prev.CostBreakup, days: v ?? 0 },
                                                }))
                                            }
                                            placeholder="Days"
                                            className="w-full rounded-lg py-1 font-normal text-slate-800 border-slate-300"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Row 6: Number of People */}
                            <div className="flex items-center gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                    Number of People
                                </label>
                                <div className="flex-1">
                                    <InputNumber
                                        min={1}
                                        controls={false}
                                        value={modalFormData.CostBreakup.quantity || 1}
                                        onChange={(v) =>
                                            setModalFormData((prev) => ({
                                                ...prev,
                                                CostBreakup: { ...prev.CostBreakup, quantity: v ?? 1 },
                                            }))
                                        }
                                        placeholder="1"
                                        className="w-full rounded-lg py-1 font-normal text-slate-800 border-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Row 7: Calculated Total */}
                            <div className="flex items-center gap-4">
                                <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                    Calculated Total
                                </label>
                                <div className="flex-1">
                                    <div className="py-2.5 px-3.5 bg-slate-50 rounded-lg text-slate-900 font-bold text-sm border border-slate-200">
                                        ₹{computeRowAmount(modalFormData.CostBreakup).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {columns.map((col, cIdx) => (
                                <div key={col} className="flex items-center gap-4">
                                    <label className="w-36 text-right font-medium text-slate-600 text-sm shrink-0">
                                        {col} {cIdx === 0 && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="flex-1">
                                        {cIdx === 0 ? (
                                            <Input
                                                value={modalFormData.customValues[col] || ""}
                                                onChange={(e) =>
                                                    setModalFormData((prev) => ({
                                                        ...prev,
                                                        customValues: { ...prev.customValues, [col]: e.target.value },
                                                    }))
                                                }
                                                placeholder={`Enter ${col.toLowerCase()}...`}
                                                className="rounded-lg py-2 font-normal text-slate-800 border-slate-300"
                                            />
                                        ) : col === "Total Amount" ? (
                                            <InputNumber
                                                min={0}
                                                controls={false}
                                                value={modalFormData.customValues[col]}
                                                onChange={(v) =>
                                                    setModalFormData((prev) => ({
                                                        ...prev,
                                                        customValues: { ...prev.customValues, [col]: v ?? 0 },
                                                    }))
                                                }
                                                className="w-full rounded-lg py-1 font-normal text-slate-800 border-slate-300"
                                            />
                                        ) : (
                                            <Input
                                                value={modalFormData.customValues[col] || ""}
                                                onChange={(e) =>
                                                    setModalFormData((prev) => ({
                                                        ...prev,
                                                        customValues: { ...prev.customValues, [col]: e.target.value },
                                                    }))
                                                }
                                                className="rounded-lg py-2 font-normal text-slate-800 border-slate-300"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Screenshot-Matching Solid Dark Save Button */}
                    <div className="pt-4">
                        <button
                            type="button"
                            onClick={handleSaveModalForm}
                            className="w-full py-3 bg-[#2b2f38] hover:bg-[#1f2229] text-white font-medium rounded-lg text-sm transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </Modal>

            <Drawer
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <InfoCircleOutlined className="text-blue-600" />
                        <span>Official Manpower Rates Reference</span>
                    </div>
                }
                placement="right"
                open={ratesModalOpen}
                onClose={() => setRatesModalOpen(false)}
                mask={false}
                width={480}
                styles={{
                    body: { padding: "16px" },
                    header: { padding: "16px 20px" }
                }}
            >
                <div className="space-y-4">
                    <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                        <InfoCircleOutlined className="text-blue-600 font-bold text-sm shrink-0" />
                        <span>Click any rate cell in the table below to <strong>auto-fill</strong> it into your table!</span>
                    </div>

                    <Table
                        rowKey="id"
                        dataSource={officialRates}
                        loading={loadingRates}
                        pagination={false}
                        bordered
                        size="small"
                        columns={[
                            {
                                title: "Designation / Role",
                                dataIndex: "designation",
                                key: "designation",
                                render: (text) => (
                                    <span className="font-extrabold text-slate-800 text-xs">{text}</span>
                                ),
                            },
                            {
                                title: "Other Activities",
                                dataIndex: "rate_other_activities",
                                key: "rate_other_activities",
                                align: "right",
                                render: (val, record) => (
                                    <button
                                        type="button"
                                        onClick={() => applyOfficialRateToTable(record.designation, val, "Other Activities")}
                                        className="w-full text-right px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200/80 transition-all cursor-pointer active:scale-95"
                                        title="Click to insert into table"
                                    >
                                        ₹{Number(val).toLocaleString("en-IN")}
                                    </button>
                                ),
                            },
                            {
                                title: "Design & Dev",
                                dataIndex: "rate_design_developmental_activities",
                                key: "rate_design_developmental_activities",
                                align: "right",
                                render: (val, record) => (
                                    <button
                                        type="button"
                                        onClick={() => applyOfficialRateToTable(record.designation, val, "Design & Dev")}
                                        className="w-full text-right px-2.5 py-1 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200/80 transition-all cursor-pointer active:scale-95"
                                        title="Click to insert into table"
                                    >
                                        ₹{Number(val).toLocaleString("en-IN")}
                                    </button>
                                ),
                            },
                        ]}
                    />
                </div>
            </Drawer>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <UserOutlined className="text-blue-600" />
                        <span>Enter Custom Role / Designation</span>
                    </div>
                }
                open={customRoleModalOpen}
                onCancel={() => {
                    setCustomRoleModalOpen(false);
                    setPendingCustomRate(null);
                }}
                onOk={handleConfirmCustomRole}
                okText="Add to Table"
                cancelText="Cancel"
                okButtonProps={{ className: "bg-blue-600 hover:bg-blue-700 font-bold" }}
                width={420}
                destroyOnClose
            >
                <div className="py-2 space-y-3">
                    <p className="text-xs text-slate-600 font-medium">
                        You selected the <strong>{pendingCustomRate?.activityTypeLabel}</strong> rate (<strong>₹{pendingCustomRate?.rate}</strong>) for Others. Please enter the specific designation/role name:
                    </p>
                    <Input
                        placeholder="e.g. Junior Research Fellow, Lab Assistant, Project Associate..."
                        value={customRoleInput}
                        onChange={(e) => setCustomRoleInput(e.target.value)}
                        onPressEnter={handleConfirmCustomRole}
                        autoFocus
                    />
                </div>
            </Modal>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <PlusOutlined className="text-blue-600" />
                        <span>Add Columns to "{headerName}"</span>
                    </div>
                }
                open={addingColumn}
                onCancel={() => {
                    setAddingColumn(false);
                    setNewColumnName("");
                }}
                footer={[
                    <Button key="close" onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>
                        Done / Close
                    </Button>,
                    <Button
                        key="add"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => confirmAddColumn(true)}
                        className="bg-blue-600 font-bold"
                    >
                        Add Column
                    </Button>,
                ]}
                width={420}
                destroyOnClose
            >
                <div className="py-2 space-y-3">
                    <Input
                        placeholder="Enter column name..."
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        onPressEnter={() => confirmAddColumn(true)}
                        className="rounded-xl py-2 font-normal text-slate-800 border-slate-300"
                        autoFocus
                    />
                    {columns.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400">Columns:</span>
                            {columns.map((col) => (
                                <Tag key={col} color="blue" className="text-[11px] font-semibold rounded-md m-0">
                                    {col}
                                </Tag>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}

function AddHeaderForm({ existingHeaderNames, onAdd, isEnteringHeader, onCancelHeader }) {
    const [customName, setCustomName] = useState("");

    const handleAddCustom = () => {
        const name = customName.trim();
        if (!name) {
            message.warning("Enter a section name");
            return;
        }
        if (existingHeaderNames.includes(name)) {
            message.warning("A section with this name already exists");
            return;
        }
        onAdd({
            header_name: name,
            columns: DEFAULT_CUSTOM_COLUMNS,
            rows: [],
        });
        setCustomName("");
    };

    if (!isEnteringHeader) return null;

    return (
        <div className="bg-blue-50/60 border border-blue-200/70 p-3.5 rounded-2xl mb-4 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Add New Cost Section Table
                </span>
                <button
                    type="button"
                    onClick={onCancelHeader}
                    className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                >
                    Cancel
                </button>
            </div>

            <div className="flex gap-2">
                <Input
                    autoFocus
                    placeholder="Enter section name..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onPressEnter={handleAddCustom}
                    className="rounded-xl py-2 font-normal text-slate-800 border-slate-300"
                />
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddCustom}
                    className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl h-auto py-2"
                >
                    Create Section
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

    // Load version list whenever the drawer opens
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
            // Refresh the list
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

/* ============================================================
   MAIN COMPONENT: CostEstimationModal
   ============================================================ */

export function CostEstimationModal({ open, onClose, title, createdBy, projectId }) {
    const [headers, setHeaders] = useState([]); // [{header_name, columns, rows}]
    const [activeKey, setActiveKey] = useState("");
    const [generating, setGenerating] = useState(false);
    const [loadingSaved, setLoadingSaved] = useState(false);
    const [isEnteringHeader, setIsEnteringHeader] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(null); // which version is loaded in form

    // loadNonceRef: each new load cycle gets a unique ID.
    // If the ID captured when the async call started no longer matches the current one,
    // the response is stale and must be ignored.
    // Incremented every time: (a) a new load cycle starts, OR (b) the user manually picks a version.
    const loadNonceRef = useRef(0);

    // Reset form state each time the modal is freshly opened.
    // Start with a blank Manpower table; no auto-fetching from database.
    useEffect(() => {
        if (!open) {
            setHeaders([]);
            setActiveKey("");
            setIsEnteringHeader(false);
            setCurrentVersion(null);
            setHistoryOpen(false);
            return;
        }

        const initial = {
            header_name: MANPOWER_HEADER,
            columns: MANPOWER_COLUMNS,
            rows: [],
        };
        setHeaders([initial]);
        setActiveKey(MANPOWER_HEADER);
        setCurrentVersion(null);
        setIsEnteringHeader(false);
        setLoadingSaved(false);
    }, [open]);

    const closeModal = () => onClose();

    const handleResetWorkspace = () => {
        const initial = {
            header_name: MANPOWER_HEADER,
            columns: MANPOWER_COLUMNS,
            rows: [],
        };
        setHeaders([initial]);
        setActiveKey(MANPOWER_HEADER);
        setCurrentVersion(null);
        setIsEnteringHeader(false);
        setLoadingSaved(false);
        message.success("Workspace reset to initial state");
    };

    const handleOpenAddSection = () => {
        const manpowerHeader = headers.find((h) => h.header_name === MANPOWER_HEADER);
        if (!manpowerHeader || !manpowerHeader.rows || manpowerHeader.rows.length === 0) {
            message.warning("Please enter at least one Manpower role before adding another section.");
            return;
        }
        setIsEnteringHeader(true);
    };

    const handleAddHeader = (item) => {
        setHeaders((prev) => [...prev, item]);
        setActiveKey(item.header_name);
        setIsEnteringHeader(false);
    };

    const handleHeaderChange = (index, updated) => {
        setHeaders((prev) => prev.map((h, i) => (i === index ? updated : h)));
    };

    const handleRemoveHeader = (headerName) => {
        if (headerName === MANPOWER_HEADER) {
            message.warning("Manpower section cannot be deleted");
            return;
        }
        setHeaders((prev) => {
            const next = prev.filter((h) => h.header_name !== headerName);
            if (activeKey === headerName) {
                setActiveKey(next[0]?.header_name || MANPOWER_HEADER);
            }
            return next;
        });
        message.success(`Deleted table "${headerName}"`);
    };

    // Called when user clicks Load in the History drawer.
    // Incrementing the nonce invalidates any still-running loadInitialState so it
    // cannot overwrite the data the user just selected.
    const handleLoadVersion = (tables, version) => {
        loadNonceRef.current++;        // invalidate any in-flight loadInitialState
        setHeaders(tables);
        setActiveKey(tables[0]?.header_name || "");
        setCurrentVersion(version);
        setLoadingSaved(false);
        message.info(`Version ${version} loaded. Edit and click Generate to save as a new version.`);
    };

    const handleGenerate = async () => {
        if (headers.length === 0) {
            message.warning("Add at least one header before generating");
            return;
        }
        if (!projectId) {
            message.error("Missing project reference - cannot save or generate");
            return;
        }
        setGenerating(true);
        try {
            const newVersion = await generateWordDocument(projectId, {
                title: title || "Cost Breakdown",
                created_by: createdBy,
                tables: headers,
            });
            message.success(`Saved as Version ${newVersion || ""} and Word document generated`);
            closeModal();
        } catch (err) {
            message.error("Failed to save/generate document");
        } finally {
            setGenerating(false);
        }
    };

    const grandTotal = useMemo(() => {
        return headers.reduce((acc, h) => {
            if (h.header_name === MANPOWER_HEADER) {
                const manpowerSum = (h.rows || []).reduce((sum, r) => {
                    const cb = r["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    if (type === "monthly") {
                        return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                    } else {
                        return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                    }
                }, 0);
                return acc + manpowerSum;
            }
            if ((h.columns || []).includes("Total Amount")) {
                const customSum = (h.rows || []).reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
                return acc + customSum;
            }
            return acc;
        }, 0);
    }, [headers]);

    const activeHeader = headers.find((h) => h.header_name === activeKey) || headers[0];
    const existingHeaderNames = headers.map((h) => h.header_name);

    const activeHeaderSubtotal = useMemo(() => {
        if (!activeHeader) return 0;
        if (activeHeader.header_name === MANPOWER_HEADER) {
            return (activeHeader.rows || []).reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                const type = cb.type ?? "hourly";
                if (type === "monthly") {
                    return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                } else {
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }
            }, 0);
        }
        return (activeHeader.rows || []).reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
    }, [activeHeader]);

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
                        padding: "32px",
                        backgroundColor: "#f8fafc",
                        minHeight: "82vh"
                    }
                }}
            >
                {/* Header section with Top Action Buttons */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80">
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

                    {/* Top Action Buttons Group */}
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
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                            <FileWordOutlined /> {generating ? "Generating..." : "Generate Word Document"}
                        </button>
                    </div>
                </div>

                {/* Full-Width Tables Studio Workspace */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                    {/* Tab Bar Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 overflow-x-auto">
                            {headers.map((h) => {
                                const isActive = h.header_name === activeKey;
                                const isManpower = h.header_name === MANPOWER_HEADER;
                                const rowCount = (h.rows || []).length;
                                return (
                                    <div
                                        key={h.header_name}
                                        onClick={() => setActiveKey(h.header_name)}
                                        className={`group flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer select-none ${isActive
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 border border-blue-600'
                                            : 'text-slate-600 hover:bg-slate-100 border border-slate-200/80 bg-slate-50/50'
                                            }`}
                                    >
                                        <span className="font-semibold tracking-tight">{h.header_name}</span>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${isActive ? 'bg-blue-700/80 text-blue-50' : 'bg-slate-200/70 text-slate-500'
                                            }`}>
                                            {rowCount}
                                        </span>
                                        {!isManpower && (
                                            <Popconfirm
                                                title={`Delete table "${h.header_name}"?`}
                                                description="This will permanently delete this section and all its rows."
                                                onConfirm={(e) => {
                                                    e?.stopPropagation();
                                                    handleRemoveHeader(h.header_name);
                                                }}
                                                onCancel={(e) => e?.stopPropagation()}
                                                okText="Delete"
                                                cancelText="Cancel"
                                                okButtonProps={{ danger: true, size: "small" }}
                                                cancelButtonProps={{ size: "small" }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => e?.stopPropagation()}
                                                    className={`p-0.5 rounded-full transition-all cursor-pointer ${isActive
                                                        ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                                                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                        }`}
                                                    title="Delete section table"
                                                >
                                                    <CloseOutlined style={{ fontSize: 10 }} />
                                                </button>
                                            </Popconfirm>
                                        )}
                                    </div>
                                );
                            })}
                            <button
                                onClick={handleOpenAddSection}
                                className="px-3.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <PlusOutlined style={{ fontSize: 10 }} /> Add Section
                            </button>
                        </div>

                        {/* Grand Total Summary Display */}
                        <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-200/80 text-blue-900 px-4 py-2 rounded-xl">
                            <span className="text-xs font-semibold text-blue-700 tracking-wider">Grand Total:</span>
                            <span className="text-base font-extrabold text-blue-700">
                                ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <AddHeaderForm
                        existingHeaderNames={existingHeaderNames}
                        onAdd={handleAddHeader}
                        isEnteringHeader={isEnteringHeader}
                        onCancelHeader={() => setIsEnteringHeader(false)}
                    />

                    {isEnteringHeader ? null : headers.length === 0 ? (
                        <Empty description="No cost sections added yet" />
                    ) : activeHeader ? (
                        <HeaderRowsEditor
                            key={activeHeader.header_name}
                            headerItem={activeHeader}
                            onChange={(updated) => {
                                const idx = headers.findIndex((h) => h.header_name === activeHeader.header_name);
                                if (idx > -1) handleHeaderChange(idx, updated);
                            }}
                            onNewTable={() => setIsEnteringHeader(true)}
                            onDeleteHeader={handleRemoveHeader}
                        />
                    ) : null}

                    {/* Bottom Active Table Estimated Total Footer Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 font-medium">
                            Section: <strong className="text-slate-800 font-bold">{activeHeader?.header_name || "Section"}</strong> ({(activeHeader?.rows || []).length} {(activeHeader?.rows || []).length === 1 ? 'row' : 'rows'})
                        </span>
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                            <span>Estimated Total ({activeHeader?.header_name || "Section"}):</span>
                            <span className="text-lg font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200/80">
                                ₹{activeHeaderSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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