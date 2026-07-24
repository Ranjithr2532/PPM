import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    FileWordOutlined,
    HistoryOutlined,
    EditOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL } from '../config/api.js';



const MANPOWER_HEADER = "Manpower";
const MANPOWER_COLUMNS = ["Role", "Cost Breakup", "Total Amount"];
const DEFAULT_CUSTOM_COLUMNS = ["Description", "Total Amount"];

/* ============================================================
   API HELPERS
   ============================================================ */

const api = axios.create({ baseURL: `${API_BASE_URL}/dynamic-tables` });

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

function ManpowerCostInput({ value, onChange }) {
    const type = value?.type ?? "hourly";
    const rate = value?.rate ?? 0;
    const hours = value?.hours ?? 0;
    const days = value?.days ?? 0;
    const months = value?.months ?? 0;
    const quantity = value?.quantity ?? 0;

    const update = (updates) => {
        onChange({ type, rate, hours, days, months, quantity, ...updates });
    };

    const field = (label, key, val, width) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{label}</span>
            <InputNumber
                min={0}
                controls={false}
                value={val === 0 ? undefined : val}
                onChange={(v) => update({ [key]: v ?? 0 })}
                placeholder="0"
                style={{ width }}
            />
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Radio.Group
                size="small"
                value={type}
                onChange={(e) => update({ type: e.target.value })}
                style={{ marginBottom: 4 }}
            >
                <Radio value="hourly">Per Hour</Radio>
                <Radio value="monthly">Month</Radio>
            </Radio.Group>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, flexWrap: "nowrap" }}>
                {type === "monthly" ? (
                    <>
                        {field("Rate (₹/month)", "rate", rate, 85)}
                        <span style={{ marginBottom: 6, color: "#bbb" }}>×</span>
                        {field("Months", "months", months, 55)}
                        <span style={{ marginBottom: 6, color: "#bbb" }}>×</span>
                        {field("Manpower", "quantity", quantity, 75)}
                    </>
                ) : (
                    <>
                        {field("Rate (₹/hour)", "rate", rate, 85)}
                        <span style={{ marginBottom: 6, color: "#bbb" }}>×</span>
                        {field("Hours", "hours", hours, 55)}
                        <span style={{ marginBottom: 6, color: "#bbb" }}>×</span>
                        {field("Days", "days", days, 55)}
                        <span style={{ marginBottom: 6, color: "#bbb" }}>×</span>
                        {field("Manpower", "quantity", quantity, 75)}
                    </>
                )}
            </div>
        </div>
    );
}

/* ============================================================
   SUB-COMPONENT: editable rows for one header (in-memory only)
   ============================================================ */

function HeaderRowsEditor({ headerItem, onChange, onNewTable }) {
    const { header_name: headerName, columns, rows } = headerItem;
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");

    const updateRow = (index, key, value) => {
        const next = [...rows];
        next[index] = { ...next[index], [key]: value };
        onChange({ ...headerItem, rows: next });
    };

    const addRow = () => onChange({ ...headerItem, rows: [...rows, emptyRow(columns, headerName)] });
    const removeRow = (index) => onChange({ ...headerItem, rows: rows.filter((_, i) => i !== index) });

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

    const confirmAddColumn = () => {
        const trimmed = newColumnName.trim();
        if (!trimmed) {
            setAddingColumn(false);
            return;
        }
        if (columns.includes(trimmed)) {
            message.warning("Column already exists");
            return;
        }

        // Insert right before "Total Amount" if it exists, otherwise append at the end.
        const amountIndex = columns.indexOf("Total Amount");
        const nextColumns =
            amountIndex === -1
                ? [...columns, trimmed]
                : [...columns.slice(0, amountIndex), trimmed, ...columns.slice(amountIndex)];

        const nextRows = rows.map((r) => ({ ...r, [trimmed]: "" }));
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
        setNewColumnName("");
        setAddingColumn(false);
    };

    const previewTotal = useMemo(() => {
        if (headerName === MANPOWER_HEADER) {
            return rows.reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                if (cb.type === "monthly") {
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

    const tableColumns = [
        ...columns.map((col) => {
            const isEditable = headerName !== MANPOWER_HEADER;
            const isEditing = editingCol === col;
            return {
                title: (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        {isEditing ? (
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
                            <span>{col}</span>
                        )}
                        {isEditable && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                {!isEditing && (
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<EditOutlined style={{ fontSize: 10 }} />}
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
                                        icon={<DeleteOutlined style={{ fontSize: 10 }} />}
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
                    if (headerName === MANPOWER_HEADER && col === "Cost Breakup") {
                        return <ManpowerCostInput value={record[col]} onChange={(v) => updateRow(index, col, v)} />;
                    }
                    if (headerName === MANPOWER_HEADER && col === "Total Amount") {
                        const cb = record["Cost Breakup"] || {};
                        let amt = 0;
                        if (cb.type === "monthly") {
                            amt = (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 0);
                        } else {
                            amt = (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 0);
                        }
                        return <span>{amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
                    }
                    if (col === "Total Amount") {
                        return (
                            <InputNumber min={0} controls={false} value={record[col]} onChange={(v) => updateRow(index, col, v ?? 0)} style={{ width: 120 }} />
                        );
                    }
                    return <Input value={record[col]} onChange={(e) => updateRow(index, col, e.target.value)} />;
                },
            };
        }),

        ...(headerName === MANPOWER_HEADER
            ? []
            : [
                {
                    title: addingColumn ? (
                        <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <Input
                                size="small"
                                autoFocus
                                placeholder="Column name"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                onPressEnter={confirmAddColumn}
                                style={{ width: 110 }}
                            />
                            <Button size="small" type="primary" onClick={confirmAddColumn}>
                                Add
                            </Button>
                            <Button size="small" danger onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <Button
                            size="small"
                            type="text"
                            icon={<PlusOutlined />}
                            onClick={() => setAddingColumn(true)}
                            title="Add column"
                        />
                    ),
                    key: "__add_column__",
                    width: addingColumn ? 250 : 50,
                },
            ]),
        {
            title: "",
            key: "actions",
            width: 50,
            render: (_, __, index) => (
                <Popconfirm title="Remove row?" onConfirm={() => removeRow(index)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            ),
        },
    ];

    return (
        <Table
            rowKey={(_, index) => String(index)}
            columns={tableColumns}
            dataSource={rows}
            pagination={false}
            bordered
            size="small"
            footer={() => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <Button icon={<PlusOutlined />} onClick={addRow}>
                            Add Row
                        </Button>
                        <Button icon={<PlusOutlined />} onClick={onNewTable}>
                            New Table
                        </Button>
                    </div>
                    {previewTotal !== null && <span style={{ fontWeight: 600 }}>Total: {previewTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                </div>
            )}
        />
    );
}

function AddHeaderForm({ existingHeaderNames, onAdd, isEnteringHeader, activeHeaderName }) {
    const [customName, setCustomName] = useState("");

    const handleAddCustom = () => {
        const name = customName.trim();
        if (!name) {
            message.warning("Enter a header name");
            return;
        }
        if (existingHeaderNames.includes(name)) {
            message.warning("A header with this name already exists");
            return;
        }
        onAdd({
            header_name: name,
            columns: DEFAULT_CUSTOM_COLUMNS,
            rows: [emptyRow(DEFAULT_CUSTOM_COLUMNS, name)],
        });
        setCustomName("");
    };

    if (isEnteringHeader) {
        return (
            <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <Input
                        autoFocus
                        placeholder="Enter Table Name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onPressEnter={handleAddCustom}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustom}>
                        Create
                    </Button>
                </div>
            </div>
        );
    }

    // Only show the Manpower explanation while the Manpower tab is active -
    // stay silent for any other (custom) table's tab.
    if (activeHeaderName !== MANPOWER_HEADER) {
        return null;
    }

    return (
        <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
            Role, Cost Breakup (rate × hours × days × quantity), Amount - calculated automatically.
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
            rows: [emptyRow(MANPOWER_COLUMNS, MANPOWER_HEADER)],
        };
        setHeaders([initial]);
        setActiveKey(MANPOWER_HEADER);
        setCurrentVersion(null);
        setIsEnteringHeader(false);
        setLoadingSaved(false);
    }, [open]);

    const closeModal = () => onClose();

    const handleAddHeader = (item) => {
        setHeaders((prev) => [...prev, item]);
        setActiveKey(item.header_name);
        setIsEnteringHeader(false);
    };

    const handleHeaderChange = (index, updated) => {
        setHeaders((prev) => prev.map((h, i) => (i === index ? updated : h)));
    };

    const handleRemoveHeader = (headerName) => {
        setHeaders((prev) => prev.filter((h) => h.header_name !== headerName));
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

    const existingHeaderNames = headers.map((h) => h.header_name);

    return (
        <>
            <Modal
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span>{title ? `Cost Estimation - ${title}` : "Cost Estimation"}</span>
                        {currentVersion && (
                            <Tag color="blue" style={{ fontWeight: 500 }}>
                                Editing: Version {currentVersion}
                            </Tag>
                        )}
                    </div>
                }
                open={open}
                onCancel={closeModal}
                width={800}
                destroyOnHidden
                confirmLoading={loadingSaved}
                footer={[
                    <Button key="cancel" onClick={closeModal}>
                        Cancel
                    </Button>,
                    <Button
                        key="history"
                        icon={<HistoryOutlined />}
                        onClick={() => setHistoryOpen(true)}
                        disabled={!projectId}
                    >
                        History
                    </Button>,
                    <Button
                        key="generate"
                        type="primary"
                        icon={<FileWordOutlined />}
                        loading={generating}
                        onClick={handleGenerate}
                    >
                        Generate Word Document
                    </Button>,
                ]}
            >
                <AddHeaderForm
                    existingHeaderNames={existingHeaderNames}
                    onAdd={handleAddHeader}
                    isEnteringHeader={isEnteringHeader}
                    activeHeaderName={activeKey}
                />

                {isEnteringHeader ? null : headers.length === 0 ? (
                    <Empty description="No headers added yet" />
                ) : (
                    <Tabs
                        activeKey={activeKey}
                        onChange={setActiveKey}
                        type="editable-card"
                        hideAdd
                        onEdit={(targetKey, action) => {
                            if (action === "remove") handleRemoveHeader(targetKey);
                        }}
                        items={headers.map((h, index) => ({
                            key: h.header_name,
                            label: h.header_name,
                            children: (
                                <HeaderRowsEditor
                                    headerItem={h}
                                    onChange={(updated) => handleHeaderChange(index, updated)}
                                    onNewTable={() => setIsEnteringHeader(true)}
                                />
                            ),
                        }))}
                    />
                )}
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