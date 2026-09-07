import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    TableOutlined,
    AlignLeftOutlined,
    CheckCircleOutlined,
    LoadingOutlined
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

export default function DrawingRegister({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Auto-save draft tracking states & refs
    const isHydratedRef = useRef(false);
    const submissionIdRef = useRef(submissionId);
    const statusRef = useRef(status);
    const isSavingRef = useRef(false);
    const [autoSaveState, setAutoSaveState] = useState('idle'); // 'saving', 'saved', 'error', 'idle'
    const [lastSavedAt, setLastSavedAt] = useState(null);

    useEffect(() => {
        submissionIdRef.current = submissionId;
    }, [submissionId]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Metadata
    const [projectTitle, setProjectTitle] = useState('');
    const [projectNo, setProjectNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [subSystem, setSubSystem] = useState('');
    const [registerRev, setRegisterRev] = useState('Rev00');

    // Dynamic Drawing Register Table Headers & Rows
    const [dwgHeaders, setDwgHeaders] = useState([
        "Sl. No.",
        "Drawing No.",
        "Title / Description of Drawing",
        "Rev No.",
        "Date of Issue",
        "Issued To / Department",
        "No. of Copies",
        "Remarks"
    ]);

    const [dwgRows, setDwgRows] = useState([]);

    // Custom Flexible Sections
    const [sections, setSections] = useState([]);

    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('064');
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

    // Load Existing Submission if editing or proposal linked
    useEffect(() => {
        const loadSubmission = async () => {
            try {
                let sub = null;
                if (propSubmissionId) {
                    sub = await isoSubmissionService.getSubmissionById(propSubmissionId);
                } else if (propProposalId || selectedProposalId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: propProposalId || selectedProposalId, doc_type: 'DRAWING_REGISTER' });
                    if (Array.isArray(subs) && subs.length > 0) sub = subs[0];
                }

                if (sub) {
                    setSubmissionId(sub.id);
                    submissionIdRef.current = sub.id;
                    setStatus(sub.status || 'DRAFT');
                    statusRef.current = sub.status || 'DRAFT';
                    if (sub.proposal_id) setSelectedProposalId(String(sub.proposal_id));

                    const fd = sub.form_data || {};
                    if (fd.project_title) setProjectTitle(fd.project_title);
                    if (fd.project_no) setProjectNo(fd.project_no);
                    if (fd.customer_name) setCustomerName(fd.customer_name);
                    if (fd.sub_system) setSubSystem(fd.sub_system);
                    if (fd.register_rev) setRegisterRev(fd.register_rev);

                    const it = fd.items;
                    if (it && typeof it === 'object' && Array.isArray(it.headers)) {
                        setDwgHeaders(it.headers);
                        setDwgRows(Array.isArray(it.rows) ? it.rows : []);
                    }

                    if (Array.isArray(fd.sections)) setSections(fd.sections);
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load Drawing Register submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId]);

    // Column & Row Handlers
    const handleAddColumn = () => {
        if (isReadOnly) return;
        setDwgHeaders(prev => [...prev, `Column ${prev.length + 1}`]);
        setDwgRows(prev => prev.map(row => [...row, ""]));
    };

    const handleRemoveColumn = (colIdx) => {
        if (isReadOnly || dwgHeaders.length <= 1) return;
        setDwgHeaders(prev => prev.filter((_, i) => i !== colIdx));
        setDwgRows(prev => prev.map(row => row.filter((_, i) => i !== colIdx)));
    };

    const handleHeaderChange = (colIdx, val) => {
        if (isReadOnly) return;
        setDwgHeaders(prev => {
            const next = [...prev];
            next[colIdx] = val;
            return next;
        });
    };

    const handleAddRow = () => {
        if (isReadOnly) return;
        const newRow = Array(dwgHeaders.length).fill("");
        newRow[0] = String(dwgRows.length + 1);
        setDwgRows(prev => [...prev, newRow]);
    };

    const handleRemoveRow = (rowIdx) => {
        if (isReadOnly) return;
        setDwgRows(prev => prev.filter((_, i) => i !== rowIdx));
    };

    const handleCellChange = (rowIdx, colIdx, val) => {
        if (isReadOnly) return;
        setDwgRows(prev => prev.map((row, rI) => {
            if (rI !== rowIdx) return row;
            const nextRow = [...row];
            nextRow[colIdx] = val;
            return nextRow;
        }));
    };

    // Custom Section Handlers
    const handleAddSection = () => {
        if (isReadOnly) return;
        setSections(prev => [
            ...prev,
            {
                title: `Section ${prev.length + 1}`,
                content: "Enter notes or specifications...",
                headers: ["Column 1", "Column 2"],
                rows: [["Data 1", "Data 2"]]
            }
        ]);
    };

    const handleRemoveSection = (secIdx) => {
        if (isReadOnly) return;
        setSections(prev => prev.filter((_, idx) => idx !== secIdx));
    };

    const handleSectionChange = (secIdx, field, value) => {
        if (isReadOnly) return;
        setSections(prev => {
            const next = [...prev];
            next[secIdx] = { ...next[secIdx], [field]: value };
            return next;
        });
    };

    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        sub_system: subSystem,
        register_rev: registerRev,
        items: {
            headers: dwgHeaders,
            rows: dwgRows
        },
        sections: sections,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_Drawing_Issue_Register_${projectNo || '064'}.docx`
    });

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/drawing-register/generate`, payload, {
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

    // Auto-Save Draft to Database
    const performAutoSave = useCallback(async () => {
        if (isReadOnly) return;
        if (!isHydratedRef.current) return;
        if (isSavingRef.current) return;

        isSavingRef.current = true;
        setAutoSaveState('saving');
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();
            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'DRAWING_REGISTER',
                document_no: docNo || '064',
                form_data: formDataPayload,
                status: currentDocStatus,
                created_by: userId
            };

            let res;
            if (submissionIdRef.current) {
                res = await isoSubmissionService.updateSubmission(submissionIdRef.current, payload);
            } else {
                res = await isoSubmissionService.createSubmission(payload);
                if (res && res.id) {
                    setSubmissionId(res.id);
                    submissionIdRef.current = res.id;
                }
            }

            setAutoSaveState('saved');
            setLastSavedAt(new Date());
        } catch (err) {
            console.error('Auto-save error in DrawingRegister:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, projectTitle, projectNo, customerName, subSystem, registerRev, dwgHeaders, dwgRows, sections, preparedBy, approvedBy, docNo, docDate, selectedProposalId]);

    // Debounced Auto-Save
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const timer = setTimeout(() => { performAutoSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [projectTitle, projectNo, customerName, subSystem, registerRev, dwgHeaders, dwgRows, sections, preparedBy, approvedBy, docNo, docDate, selectedProposalId, performAutoSave, isReadOnly]);

    // Flush on page unload / refresh
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isHydratedRef.current && !isReadOnly) performAutoSave();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (isHydratedRef.current && !isReadOnly) performAutoSave();
        };
    }, [performAutoSave, isReadOnly]);

    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'DRAWING_REGISTER',
                document_no: docNo || '064',
                form_data: formDataPayload,
                status: targetStatus,
                created_by: userId
            };

            let res;
            if (submissionIdRef.current || submissionId) {
                res = await isoSubmissionService.updateSubmission(submissionIdRef.current || submissionId, payload);
            } else {
                res = await isoSubmissionService.createSubmission(payload);
                if (res && res.id) {
                    setSubmissionId(res.id);
                    submissionIdRef.current = res.id;
                }
            }

            const updatedStatus = res?.status || targetStatus;
            setStatus(updatedStatus);
            statusRef.current = updatedStatus;
            alert(`ISO Drawing Issue Register ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save submission.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        const activeSubId = submissionIdRef.current || submissionId;
        if (!activeSubId) return;
        let comment = null;
        if (newStatus === 'REJECTED') {
            comment = prompt('Please enter rejection reason:');
            if (!comment) return;
        }

        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            await isoSubmissionService.updateStatus(activeSubId, newStatus, comment, userId);
            setStatus(newStatus);
            statusRef.current = newStatus;
            alert(`ISO Drawing Register status updated to ${newStatus}`);
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
                        onClick={async () => {
                            if (isHydratedRef.current && !isReadOnly) {
                                await performAutoSave();
                            }
                            if (onClose) onClose();
                            else if (onBack) onBack();
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                        title="Back (Auto-saves draft)"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-800">Drawing Issue Register</h1>
                            {/* Auto-Save Draft Status Badge */}
                            <div>
                                {autoSaveState === 'saving' && (
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1 animate-pulse">
                                        <LoadingOutlined className="text-[10px]" /> Saving draft...
                                    </span>
                                )}
                                {autoSaveState === 'saved' && (
                                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                        <CheckCircleOutlined className="text-[10px]" /> Draft saved
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">Document No: CMTI-SMC-QMS-064/Rev00</p>
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
                        <button
                            onClick={() => handleSaveOrSubmit('SUBMITTED')}
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                        >
                            {submitting ? 'Submitting...' : 'Submit'}
                        </button>
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
                            <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">DRAWING ISSUE REGISTER</h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: CMTI-SMC-QMS-064/Rev00</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/064</div>
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

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Sub-system / Module</label>
                            <input
                                type="text"
                                value={subSystem}
                                onChange={(e) => setSubSystem(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Sub-system Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Register Revision</label>
                            <input
                                type="text"
                                value={registerRev}
                                onChange={(e) => setRegisterRev(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. Rev00"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                            />
                        </div>
                    </div>
                </div>

                {/* Customizable Drawing Register Table */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <TableOutlined className="text-indigo-600" /> Drawing Issue Register Entries
                        </h3>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAddColumn}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 transition"
                                >
                                    + Add Column
                                </button>
                                <button
                                    onClick={handleAddRow}
                                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                                >
                                    <PlusOutlined /> Add Drawing Row
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    {dwgHeaders.map((hText, colIdx) => (
                                        <th key={colIdx} className="p-2 border-r border-slate-300 text-center bg-slate-200/70 font-bold min-w-[110px]">
                                            <div className="flex items-center justify-between gap-1">
                                                <input
                                                    type="text"
                                                    value={hText}
                                                    onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs font-bold bg-transparent border-none text-center outline-none"
                                                />
                                                {!isReadOnly && dwgHeaders.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveColumn(colIdx)}
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
                                {dwgRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={dwgHeaders.length + (isReadOnly ? 0 : 1)} className="p-4 text-center text-slate-400 italic">
                                            No drawing entries added yet. Click "+ Add Drawing Row" to populate register.
                                        </td>
                                    </tr>
                                ) : (
                                    dwgRows.map((row, rowIdx) => (
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
                                                        onClick={() => handleRemoveRow(rowIdx)}
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

                {/* Additional Custom Sections Builder */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <AlignLeftOutlined className="text-indigo-600" /> Additional Notes & Custom Tables
                        </h3>
                        {!isReadOnly && (
                            <button
                                onClick={handleAddSection}
                                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                                <PlusOutlined /> Add Notes / Section
                            </button>
                        )}
                    </div>

                    {sections.map((sec, secIdx) => (
                        <div key={secIdx} className="bg-slate-50/70 border border-slate-300 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <input
                                    type="text"
                                    value={sec.title || ''}
                                    onChange={(e) => handleSectionChange(secIdx, 'title', e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Section Title"
                                    className="font-bold text-slate-800 text-xs bg-transparent border-b border-slate-300 outline-none w-full max-w-sm p-1"
                                />
                                {!isReadOnly && (
                                    <button
                                        onClick={() => handleRemoveSection(secIdx)}
                                        className="text-rose-500 hover:text-rose-700 p-1 text-xs"
                                    >
                                        <DeleteOutlined />
                                    </button>
                                )}
                            </div>
                            <textarea
                                rows={2}
                                value={sec.content || ''}
                                onChange={(e) => handleSectionChange(secIdx, 'content', e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Add notes or technical details..."
                                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
