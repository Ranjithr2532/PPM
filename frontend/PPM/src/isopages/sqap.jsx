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

const DEFAULT_SECTIONS = [];

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

export default function Sqap({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form fields
    const [projectTitle, setProjectTitle] = useState('');
    const [projectNo, setProjectNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [softwareVersion, setSoftwareVersion] = useState('v1.0');
    const [sections, setSections] = useState(DEFAULT_SECTIONS);
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('055');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    // Load Proposals
    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/`);
                if (Array.isArray(res.data)) {
                    setProposals(res.data);
                }
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
                    if (fd.software_version) setSoftwareVersion(fd.software_version);
                    if (Array.isArray(fd.sections) && fd.sections.length > 0) setSections(fd.sections);
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load SQAP submission:', err);
            }
        };

        if (propSubmissionId) {
            loadSubmission(propSubmissionId);
        }
    }, [propSubmissionId]);

    // Section handlers
    const handleAddSection = () => {
        if (isReadOnly) return;
        setSections(prev => [
            ...prev,
            {
                title: `${prev.length + 1}. New Custom Section`,
                content: "Enter custom paragraph or requirement details here...",
                table: null
            }
        ]);
    };

    const handleRemoveSection = (secIndex) => {
        if (isReadOnly) return;
        setSections(prev => prev.filter((_, idx) => idx !== secIndex));
    };

    const handleSectionChange = (secIndex, field, value) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIndex] = { ...next[secIndex], [field]: value };
            return next;
        });
    };

    const handleMoveSection = (secIndex, direction) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const targetIndex = direction === 'up' ? secIndex - 1 : secIndex + 1;
            if (targetIndex < 0 || targetIndex >= next.length) return prev;
            const temp = next[secIndex];
            next[secIndex] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        });
    };

    // Table inside Section Handlers
    const handleAddTableToSection = (secIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIndex] = {
                ...next[secIndex],
                table: {
                    headers: ["Item / Requirement", "Specification", "Compliance Status"],
                    rows: [
                        ["Sample Item 1", "Standard Specification", "Complied"],
                        ["Sample Item 2", "Detailed Requirement", "Verified"]
                    ]
                }
            };
            return next;
        });
    };

    const handleRemoveTableFromSection = (secIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIndex] = { ...next[secIndex], table: null };
            return next;
        });
    };

    const handleAddColumnToTable = (secIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl) return prev;

            const newHeaders = [...tbl.headers, `Column ${tbl.headers.length + 1}`];
            const newRows = tbl.rows.map(row => [...row, ""]);

            next[secIndex] = {
                ...next[secIndex],
                table: { headers: newHeaders, rows: newRows }
            };
            return next;
        });
    };

    const handleRemoveColumnFromTable = (secIndex, colIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl || tbl.headers.length <= 1) return prev;

            const newHeaders = tbl.headers.filter((_, idx) => idx !== colIndex);
            const newRows = tbl.rows.map(row => row.filter((_, idx) => idx !== colIndex));

            next[secIndex] = {
                ...next[secIndex],
                table: { headers: newHeaders, rows: newRows }
            };
            return next;
        });
    };

    const handleAddRowToTable = (secIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl) return prev;

            const emptyRow = Array(tbl.headers.length).fill("");
            next[secIndex] = {
                ...next[secIndex],
                table: { headers: tbl.headers, rows: [...tbl.rows, emptyRow] }
            };
            return next;
        });
    };

    const handleRemoveRowFromTable = (secIndex, rowIndex) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl) return prev;

            next[secIndex] = {
                ...next[secIndex],
                table: { headers: tbl.headers, rows: tbl.rows.filter((_, idx) => idx !== rowIndex) }
            };
            return next;
        });
    };

    const handleHeaderCellChange = (secIndex, colIndex, value) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl) return prev;

            const newHeaders = [...tbl.headers];
            newHeaders[colIndex] = value;

            next[secIndex] = {
                ...next[secIndex],
                table: { ...tbl, headers: newHeaders }
            };
            return next;
        });
    };

    const handleTableCellChange = (secIndex, rowIndex, colIndex, value) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            const tbl = next[secIndex].table;
            if (!tbl) return prev;

            const newRows = tbl.rows.map((row, rIdx) => {
                if (rIdx !== rowIndex) return row;
                const nextRow = [...row];
                nextRow[colIndex] = value;
                return nextRow;
            });

            next[secIndex] = {
                ...next[secIndex],
                table: { ...tbl, rows: newRows }
            };
            return next;
        });
    };

    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        software_version: softwareVersion,
        sections: sections,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_SQAP_${projectNo || '055'}.docx`
    });

    // Word Document Download
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/sqap/generate`, payload, {
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

    // Save or Submit
    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'SQAP',
                document_no: docNo || '055',
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
            alert(`ISO Software Quality Assurance Plan ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save submission.');
        } finally {
            setSubmitting(false);
        }
    };

    // Approval / Rejection
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
            alert(`ISO SQAP status updated to ${newStatus}`);
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status.');
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Header Controls */}
            <div className="w-full max-w-5xl flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose || onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Software Quality Assurance Plan (SQAP)</h1>
                        <p className="text-xs text-slate-500">Document No: CMTI-SMC-QMS-055/Rev00</p>
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
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
                {/* ISO Header Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-300 p-4 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-10 object-contain" />
                            <span className="font-bold text-slate-800 text-sm">CMTI</span>
                        </div>
                        <div className="col-span-6 text-center border-x border-slate-300 px-2">
                            <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">SOFTWARE QUALITY ASSURANCE PLAN (SQAP)</h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: CMTI-SMC-QMS-055/Rev00</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/055</div>
                            <div><strong>Page:</strong> 1 of 1</div>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50">
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
                                placeholder="Enter Project Title"
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
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Customer / Agency</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Customer Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Software Version</label>
                            <input
                                type="text"
                                value={softwareVersion}
                                onChange={(e) => setSoftwareVersion(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. v1.0"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label>
                            <input
                                type="text"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Flexible Document Builder (Custom Paragraphs & Tables) */}
                <div className="space-y-6 pt-2">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <AlignLeftOutlined className="text-indigo-600" /> Flexible Document Content Builder
                            </h3>
                            <p className="text-xs text-slate-500">Add, edit, move, or format paragraphs, custom tables, and quality verification points freely.</p>
                        </div>

                        {!isReadOnly && (
                            <button
                                onClick={handleAddSection}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm"
                            >
                                <PlusOutlined /> Add Section
                            </button>
                        )}
                    </div>

                    {/* Section Cards */}
                    {sections.map((sec, secIdx) => (
                        <div key={secIdx} className="bg-slate-50/70 border border-slate-300 rounded-xl p-5 shadow-sm space-y-4 relative group">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-2">
                                <input
                                    type="text"
                                    value={sec.title || ''}
                                    onChange={(e) => handleSectionChange(secIdx, 'title', e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Section Heading Title (e.g. 1. Purpose & Scope)"
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

                            {/* Section Paragraph Textarea */}
                            <div>
                                <textarea
                                    rows={3}
                                    value={sec.content || ''}
                                    onChange={(e) => handleSectionChange(secIdx, 'content', e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Enter section description, requirements, or quality assurance guidelines..."
                                    className="w-full text-xs p-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                                />
                            </div>

                            {/* Section Attached Table Editor */}
                            {sec.table && (
                                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white p-3 space-y-3">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                            <TableOutlined className="text-emerald-600" /> Attached Custom Table
                                        </span>

                                        {!isReadOnly && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAddColumnToTable(secIdx)}
                                                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium"
                                                >
                                                    + Column
                                                </button>
                                                <button
                                                    onClick={() => handleAddRowToTable(secIdx)}
                                                    className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-semibold"
                                                >
                                                    + Row
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Editable Table */}
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
                    ))}
                </div>
            </div>
        </div>
    );
}
