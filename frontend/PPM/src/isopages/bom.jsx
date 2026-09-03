import React, { useState, useEffect } from 'react';
import {
    DownloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    TableOutlined,
    AlignLeftOutlined,
    UpOutlined,
    DownOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getCurrentUserRole } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

export default function Bom({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack, docInfo }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Metadata
    const [projectTitle, setProjectTitle] = useState('');
    const [projectNo, setProjectNo] = useState('');
    const [customerName, setCustomerName] = useState('');

    // Dynamic Main BOM Table
    const [bomHeaders, setBomHeaders] = useState([
        "Part name/Part Number",
        "Specification",
        "Make",
        "Quantity",
        "Function Criticality"
    ]);

    const [bomRows, setBomRows] = useState([]);

    // Custom Flexible Sections & Attached Tables
    const [sections, setSections] = useState([]);

    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState(() => docInfo?.document_no || '063');
    const [docCode, setDocCode] = useState(() => docInfo?.code || 'CMTI-SMC-QMS-063/Rev00');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    useEffect(() => {
        if (docInfo?.code) setDocCode(docInfo.code);
        if (docInfo?.document_no) setDocNo(docInfo.document_no);
    }, [docInfo]);

    // Load Proposals
    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/`);
                if (Array.isArray(res.data)) setProposals(res.data);
            } catch (err) {
                console.error('Failed to load proposals:', err);
            }
        };
        fetchProposals();
    }, []);

    // Load Proposal Details when selected
    useEffect(() => {
        if (!selectedProposalId) return;
        const p = proposals.find(item => String(item.id) === String(selectedProposalId));
        if (p) {
            setProjectTitle(p.title_of_project || p.quote_description || p.project_name || '');
            setCustomerName(p.customer_name || '');
            setProjectNo(p.project_number || '');
        }
    }, [selectedProposalId, proposals]);

    // Load Existing Submission if editing
    useEffect(() => {
        const loadSubmission = async (subId) => {
            try {
                const sub = await isoSubmissionService.getSubmissionById(subId);
                if (sub) {
                    setSubmissionId(sub.id);
                    setStatus(sub.status || 'DRAFT');
                    if (sub.proposal_id) setSelectedProposalId(String(sub.proposal_id));

                    const fd = sub.form_data || {};
                    if (fd.project_title) setProjectTitle(fd.project_title);
                    if (fd.project_no) setProjectNo(fd.project_no);
                    if (fd.customer_name) setCustomerName(fd.customer_name);
                    if (fd.assembly_name) setAssemblyName(fd.assembly_name);
                    if (fd.bom_rev) setBomRev(fd.bom_rev);

                    const it = fd.items;
                    if (it && typeof it === 'object' && Array.isArray(it.headers)) {
                        setBomHeaders(it.headers);
                        setBomRows(Array.isArray(it.rows) ? it.rows : []);
                    } else if (Array.isArray(it)) {
                        const legacyRows = it.map((item, idx) => [
                            item.sl_no || String(idx + 1),
                            item.item_description || '',
                            item.part_no_spec || '',
                            item.quantity || '',
                            item.unit || '',
                            item.make_supplier || '',
                            item.remarks || ''
                        ]);
                        setBomRows(legacyRows);
                    }

                    if (Array.isArray(fd.sections)) {
                        // Normalize loaded sections to ensure table structure is standard
                        const normalizedSecs = fd.sections.map(sec => {
                            if (sec.headers && Array.isArray(sec.headers) && sec.headers.length > 0) {
                                return {
                                    ...sec,
                                    table: {
                                        headers: sec.headers,
                                        rows: Array.isArray(sec.rows) ? sec.rows : []
                                    }
                                };
                            }
                            return sec;
                        });
                        setSections(normalizedSecs);
                    }
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_code) setDocCode(fd.doc_code);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load BOM submission:', err);
            }
        };

        if (propSubmissionId) {
            loadSubmission(propSubmissionId);
        }
    }, [propSubmissionId]);

    // Dynamic Main BOM Column & Row Handlers
    const handleAddBomColumn = () => {
        if (isReadOnly) return;
        setBomHeaders(prev => [...prev, `Column ${prev.length + 1}`]);
        setBomRows(prev => prev.map(row => [...row, ""]));
    };

    const handleRemoveBomColumn = (colIdx) => {
        if (isReadOnly || bomHeaders.length <= 1) return;
        setBomHeaders(prev => prev.filter((_, i) => i !== colIdx));
        setBomRows(prev => prev.map(row => row.filter((_, i) => i !== colIdx)));
    };

    const handleHeaderChange = (colIdx, val) => {
        if (isReadOnly) return;
        setBomHeaders(prev => {
            const next = [...prev];
            next[colIdx] = val;
            return next;
        });
    };

    const handleAddBomRow = () => {
        if (isReadOnly) return;
        const newRow = Array(bomHeaders.length).fill("");
        setBomRows(prev => [...prev, newRow]);
    };

    const handleRemoveBomRow = (rowIdx) => {
        if (isReadOnly) return;
        setBomRows(prev => prev.filter((_, i) => i !== rowIdx));
    };

    const handleCellChange = (rowIdx, colIdx, val) => {
        if (isReadOnly) return;
        setBomRows(prev => prev.map((row, rI) => {
            if (rI !== rowIdx) return row;
            const nextRow = [...row];
            nextRow[colIdx] = val;
            return nextRow;
        }));
    };

    // Custom Flexible Sections & Tables Management
    const handleAddSection = () => {
        if (isReadOnly) return;
        setSections(prev => [
            ...prev,
            {
                title: `Section ${prev.length + 1}: Notes & Remarks`,
                content: "",
                table: null
            }
        ]);
    };

    const handleAddCustomTable = () => {
        if (isReadOnly) return;
        setSections(prev => [
            ...prev,
            {
                title: `Custom Table ${prev.length + 1}`,
                content: "",
                table: {
                    headers: ["Sl. No.", "Description", "Specifications", "Qty", "Remarks"],
                    rows: [
                        ["1", "", "", "", ""]
                    ]
                }
            }
        ]);
    };

    const handleRemoveSection = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => prev.filter((_, idx) => idx !== secIdx));
    };

    const handleMoveSection = (secIdx, direction) => {
        if (isReadOnly) return;
        setSections(prev => {
            const targetIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
            if (targetIdx < 0 || targetIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(secIdx, 1);
            copy.splice(targetIdx, 0, moved);
            return copy;
        });
    };

    const handleSectionChange = (secIdx, field, value) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIdx] = { ...next[secIdx], [field]: value };
            return next;
        });
    };

    const handleAddTableToSection = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIdx] = {
                ...next[secIdx],
                table: {
                    headers: ["Sl. No.", "Item Description", "Specification / Make", "Qty", "Remarks"],
                    rows: [
                        ["1", "", "", "", ""]
                    ]
                }
            };
            return next;
        });
    };

    const handleRemoveTableFromSection = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIdx] = { ...next[secIdx], table: null };
            return next;
        });
    };

    const handleAddColumnToTable = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl) return prev;
            const newHeaders = [...tbl.headers, `Column ${tbl.headers.length + 1}`];
            const newRows = tbl.rows.map(r => [...r, ""]);
            next[secIdx] = {
                ...next[secIdx],
                table: { headers: newHeaders, rows: newRows }
            };
            return next;
        });
    };

    const handleRemoveColumnFromTable = (secIdx, colIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl || tbl.headers.length <= 1) return prev;
            const newHeaders = tbl.headers.filter((_, i) => i !== colIdx);
            const newRows = tbl.rows.map(r => r.filter((_, i) => i !== colIdx));
            next[secIdx] = {
                ...next[secIdx],
                table: { headers: newHeaders, rows: newRows }
            };
            return next;
        });
    };

    const handleHeaderCellChange = (secIdx, colIdx, val) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl) return prev;
            const newHeaders = [...tbl.headers];
            newHeaders[colIdx] = val;
            next[secIdx] = {
                ...next[secIdx],
                table: { ...tbl, headers: newHeaders }
            };
            return next;
        });
    };

    const handleAddRowToTable = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl) return prev;
            const newRow = Array(tbl.headers.length).fill("");
            newRow[0] = String(tbl.rows.length + 1);
            next[secIdx] = {
                ...next[secIdx],
                table: { ...tbl, rows: [...tbl.rows, newRow] }
            };
            return next;
        });
    };

    const handleRemoveRowFromTable = (secIdx, rowIdx) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl) return prev;
            const newRows = tbl.rows.filter((_, i) => i !== rowIdx);
            next[secIdx] = {
                ...next[secIdx],
                table: { ...tbl, rows: newRows }
            };
            return next;
        });
    };

    const handleTableCellChange = (secIdx, rowIdx, colIdx, val) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIdx].table;
            if (!tbl) return prev;
            const newRows = tbl.rows.map((row, rI) => {
                if (rI !== rowIdx) return row;
                const nextRow = [...row];
                nextRow[colIdx] = val;
                return nextRow;
            });
            next[secIdx] = {
                ...next[secIdx],
                table: { ...tbl, rows: newRows }
            };
            return next;
        });
    };

    const buildPayload = () => {
        const mappedSections = sections.map(sec => ({
            title: sec.title || '',
            content: sec.content || '',
            headers: sec.table ? sec.table.headers : (sec.headers || []),
            rows: sec.table ? sec.table.rows : (sec.rows || [])
        }));

        return {
            project_title: projectTitle,
            project_no: projectNo,
            customer_name: customerName,
            items: {
                headers: bomHeaders,
                rows: bomRows
            },
            sections: mappedSections,
            prepared_by: preparedBy,
            approved_by: approvedBy,
            group_name: getLoggedUserGroup() || 'SMPM',
            doc_no: docNo || '063',
            doc_code: docCode,
            doc_date: docDate,
            filename: `ISO_BOM_${projectNo || '063'}.docx`
        };
    };

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/bom/generate`, payload, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', payload.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Word doc generation error:', err);
            alert('Failed to generate Word document.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'BOM',
                document_no: docNo || '063',
                form_data: formDataPayload,
                status: targetStatus,
                created_by: userId
            };

            let res;
            if (submissionId) {
                res = await isoSubmissionService.updateSubmission(submissionId, payload);
            } else {
                res = await isoSubmissionService.createSubmission(payload);
                if (res && res.id) setSubmissionId(res.id);
            }

            setStatus(res?.status || targetStatus);
            alert(`ISO Bill of Materials ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save submission.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        if (!submissionId) return;
        let comment = null;
        if (newStatus === 'REJECTED') {
            comment = prompt('Please enter rejection reason:');
            if (!comment) return;
        }

        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            await isoSubmissionService.updateStatus(submissionId, newStatus, comment, userId);
            setStatus(newStatus);
            alert(`ISO BOM status updated to ${newStatus}`);
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status.');
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Header Controls */}
            <div className="w-full max-w-6xl flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose || onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Bill of Materials (BOM)</h1>
                        <p className="text-xs text-slate-500 font-mono">Code: {docCode || 'CMTI-SMC-QMS-063/Rev00'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                        status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                        status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                    }`}>
                        {status}
                    </span>

                    <button
                        onClick={handleGenerateDoc}
                        disabled={generating}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                    >
                        <FileWordOutlined /> {generating ? 'Generating...' : 'Word (.docx)'}
                    </button>

                    {!isReadOnly && (
                        <>
                            <button
                                onClick={() => handleSaveOrSubmit('DRAFT')}
                                disabled={submitting}
                                className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                            >
                                Save Draft
                            </button>
                            <button
                                onClick={() => handleSaveOrSubmit('SUBMITTED')}
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                            >
                                Submit
                            </button>
                        </>
                    )}

                    {isApprover && isSubmitted && (
                        <div className="flex items-center gap-2 border-l pl-3 ml-2 border-slate-200">
                            <button
                                onClick={() => handleStatusUpdate('APPROVED')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1"
                            >
                                <CheckOutlined /> Approve
                            </button>
                            <button
                                onClick={() => handleStatusUpdate('REJECTED')}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1"
                            >
                                <CloseOutlined /> Reject
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Workspace */}
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
                {/* ISO Header Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-300 p-4 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-10 object-contain" />
                            <span className="font-bold text-slate-800 text-sm">CMTI</span>
                        </div>
                        <div className="col-span-6 text-center border-x border-slate-300 px-2">
                            <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">BILL OF MATERIALS (BOM)</h2>
                            <p className="text-xs text-slate-500 font-mono">{docCode || 'CMTI-SMC-QMS-063/Rev00'}</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Doc No:</strong> {docNo || '063'}</div>
                            <div><strong>Date:</strong> {docDate}</div>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Link Proposal</label>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            >
                                <option value="">-- Select Proposal --</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.project_number ? `${p.project_number} - ` : ''}{p.quote_description || p.customer_name || `Proposal #${p.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Title</label>
                            <input
                                type="text"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Project Title"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Number</label>
                            <input
                                type="text"
                                value={projectNo}
                                onChange={(e) => setProjectNo(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. GST2502201"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Customer Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Primary BOM Items Table */}
                <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <TableOutlined className="text-indigo-600" /> Primary Bill of Materials Items List
                        </h3>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAddBomColumn}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition"
                                >
                                    + Add Column
                                </button>
                                <button
                                    onClick={handleAddBomRow}
                                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                                >
                                    <PlusOutlined /> Add BOM Row
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    {bomHeaders.map((hText, colIdx) => (
                                        <th key={colIdx} className="p-2 border-r border-slate-300 text-center bg-slate-200/70 font-bold min-w-[110px]">
                                            <div className="flex items-center justify-between gap-1">
                                                <input
                                                    type="text"
                                                    value={hText}
                                                    onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs font-bold bg-transparent border-none text-center outline-none"
                                                />
                                                {!isReadOnly && bomHeaders.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveBomColumn(colIdx)}
                                                        className="text-rose-500 hover:text-rose-700 p-0.5 text-[10px]"
                                                        title="Remove Column"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    {!isReadOnly && <th className="p-2 w-10 text-center">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {bomRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={bomHeaders.length + (isReadOnly ? 0 : 1)} className="p-4 text-center text-slate-400 italic">
                                            No BOM items added yet. Click "+ Add BOM Row" to populate components.
                                        </td>
                                    </tr>
                                ) : (
                                    bomRows.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                            {row.map((cellVal, colIdx) => (
                                                <td key={colIdx} className="p-1 border-r border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={cellVal || ''}
                                                        onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                    />
                                                </td>
                                            ))}
                                            {!isReadOnly && (
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => handleRemoveBomRow(rowIdx)}
                                                        className="text-rose-500 hover:text-rose-700 p-1"
                                                    >
                                                        <DeleteOutlined />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Additional Dynamic Tables & Custom Sections */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <TableOutlined className="text-emerald-600" /> Additional Custom Tables & Sections
                            </h3>
                            <p className="text-xs text-slate-500">Add sub-assembly tables, electrical BOM, purchased items, or technical notes.</p>
                        </div>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAddCustomTable}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                                >
                                    <TableOutlined /> + Add Custom Table
                                </button>
                                <button
                                    onClick={handleAddSection}
                                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 transition"
                                >
                                    <AlignLeftOutlined /> + Add Note / Section
                                </button>
                            </div>
                        )}
                    </div>

                    {sections.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <p className="text-xs text-slate-400">No additional custom tables or notes added.</p>
                            {!isReadOnly && (
                                <button
                                    onClick={handleAddCustomTable}
                                    className="mt-2 text-xs text-indigo-600 font-semibold hover:underline"
                                >
                                    Click here to + Add Custom Table
                                </button>
                            )}
                        </div>
                    ) : (
                        sections.map((sec, secIdx) => (
                            <div key={secIdx} className="bg-slate-50/70 border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-2">
                                    <input
                                        type="text"
                                        value={sec.title || ''}
                                        onChange={(e) => handleSectionChange(secIdx, 'title', e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="Table / Section Title (e.g. Electrical Components BOM)"
                                        className="font-bold text-slate-800 text-sm bg-transparent border-b border-slate-300 focus:border-indigo-600 outline-none w-full max-w-md p-1"
                                    />

                                    {!isReadOnly && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleMoveSection(secIdx, 'up')}
                                                disabled={secIdx === 0}
                                                title="Move Up"
                                                className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"
                                            >
                                                <UpOutlined />
                                            </button>
                                            <button
                                                onClick={() => handleMoveSection(secIdx, 'down')}
                                                disabled={secIdx === sections.length - 1}
                                                title="Move Down"
                                                className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"
                                            >
                                                <DownOutlined />
                                            </button>

                                            {!sec.table ? (
                                                <button
                                                    onClick={() => handleAddTableToSection(secIdx)}
                                                    className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded border border-emerald-200 transition"
                                                >
                                                    <TableOutlined /> Add Table
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRemoveTableFromSection(secIdx)}
                                                    className="text-amber-600 hover:text-amber-800 text-xs font-semibold px-2 py-1"
                                                >
                                                    Remove Table
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleRemoveSection(secIdx)}
                                                className="text-rose-500 hover:text-rose-700 p-1"
                                                title="Delete Section"
                                            >
                                                <DeleteOutlined />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Section Paragraph / Description (Optional) */}
                                <div>
                                    <textarea
                                        rows={2}
                                        value={sec.content || ''}
                                        onChange={(e) => handleSectionChange(secIdx, 'content', e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="Enter optional description or notes for this table..."
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none leading-relaxed"
                                    />
                                </div>

                                {/* Attached Custom Table Editor */}
                                {sec.table && (
                                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white p-3 space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                <TableOutlined className="text-emerald-600" /> Custom Table Columns & Data
                                            </span>

                                            {!isReadOnly && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleAddColumnToTable(secIdx)}
                                                        className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-medium border border-slate-300"
                                                    >
                                                        + Add Column
                                                    </button>
                                                    <button
                                                        onClick={() => handleAddRowToTable(secIdx)}
                                                        className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded font-semibold border border-indigo-200"
                                                    >
                                                        + Add Row
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Editable Custom Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border-collapse border border-slate-300">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-700">
                                                        {sec.table.headers.map((hText, colIdx) => (
                                                            <th key={colIdx} className="border border-slate-300 p-1.5 text-center bg-slate-200/70 font-bold min-w-[120px]">
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <input
                                                                        type="text"
                                                                        value={hText}
                                                                        onChange={(e) => handleHeaderCellChange(secIdx, colIdx, e.target.value)}
                                                                        disabled={isReadOnly}
                                                                        className="w-full text-xs font-bold bg-transparent border-none text-center outline-none"
                                                                    />
                                                                    {!isReadOnly && sec.table.headers.length > 1 && (
                                                                        <button
                                                                            onClick={() => handleRemoveColumnFromTable(secIdx, colIdx)}
                                                                            className="text-rose-500 hover:text-rose-700 p-0.5 text-[10px]"
                                                                            title="Remove Column"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </th>
                                                        ))}
                                                        {!isReadOnly && <th className="border border-slate-300 p-1 w-10 text-center">Delete</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sec.table.rows.map((row, rowIdx) => (
                                                        <tr key={rowIdx} className="hover:bg-slate-50">
                                                            {row.map((cellVal, colIdx) => (
                                                                <td key={colIdx} className="border border-slate-300 p-1">
                                                                    <input
                                                                        type="text"
                                                                        value={cellVal || ''}
                                                                        onChange={(e) => handleTableCellChange(secIdx, rowIdx, colIdx, e.target.value)}
                                                                        disabled={isReadOnly}
                                                                        className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                                    />
                                                                </td>
                                                            ))}
                                                            {!isReadOnly && (
                                                                <td className="border border-slate-300 p-1 text-center">
                                                                    <button
                                                                        onClick={() => handleRemoveRowFromTable(secIdx, rowIdx)}
                                                                        className="text-rose-500 hover:text-rose-700 p-1 text-xs"
                                                                    >
                                                                        <DeleteOutlined />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Signatories Footer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 bg-slate-50/50 p-4 rounded-xl">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label>
                        <input
                            type="text"
                            value={preparedBy}
                            onChange={(e) => setPreparedBy(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Prepared By Name"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Approved By</label>
                        <input
                            type="text"
                            value={approvedBy}
                            onChange={(e) => setApprovedBy(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Approved By Name"
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                        />
                    </div>
                </div>

                {/* Footer Criticality Note & Revision Code */}
                <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                    <span className="italic">SC- Safety Critical, FC- Function Critical, NC- Not Critical</span>
                    <span className="font-bold">CMTI-{getLoggedUserGroup() ? `${getLoggedUserGroup()}-` : ''}QMS-{docNo || '063'}/Rev00</span>
                </div>
            </div>
        </div>
    );
}
