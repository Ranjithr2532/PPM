import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    TableOutlined,
    CheckCircleOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getLoggedUserCentreDept, getCurrentUserRole } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

export default function MasterDrawingIndex({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
    const effectiveProposalId = propProposalId || docInfo?.proposalId || docInfo?.proposal_id || '';
    const effectiveSubmissionId = propSubmissionId || null;

    const [selectedProposalId, setSelectedProposalId] = useState(effectiveProposalId ? String(effectiveProposalId) : '');
    const [submissionId, setSubmissionId] = useState(effectiveSubmissionId);
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

    // Master Drawing Index Table Rows (7 columns matching CMTI format)
    const [items, setItems] = useState([
        { sl_no: '1', assembly_no: '', size: '', material: '', qty: '', name_of_part: '', revision: 'Rev00' },
        { sl_no: '2', assembly_no: '', size: '', material: '', qty: '', name_of_part: '', revision: 'Rev00' },
        { sl_no: '3', assembly_no: '', size: '', material: '', qty: '', name_of_part: '', revision: 'Rev00' },
    ]);

    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('066');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isReadOnly = isAdmin ? false : isApproved;

    // Auto-fill project info directly from proposal
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlProposalId = searchParams.get('proposal_id') || searchParams.get('proposalId') || searchParams.get('id') || '';
        const targetPid = effectiveProposalId || selectedProposalId || urlProposalId;
        if (!targetPid) return;

        const fetchProposal = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/${targetPid}`);
                const p = res.data;
                if (p) {
                    setProjectTitle(prev => prev || p.title_of_project || p.quote_description || p.project_name || '');
                    setCustomerName(prev => prev || p.customer_name || '');
                    setProjectNo(prev => prev || p.project_number || '');
                }
            } catch (err) {
                console.error('Failed to load proposal details:', err);
            }
        };
        fetchProposal();
    }, [effectiveProposalId, selectedProposalId]);

    // Load Existing Submission if editing or proposal linked
    useEffect(() => {
        const loadSubmission = async () => {
            try {
                let sub = null;
                const targetSubId = propSubmissionId || null;
                const targetPropId = propProposalId || selectedProposalId;

                if (targetSubId) {
                    sub = await isoSubmissionService.getSubmissionById(targetSubId);
                } else if (targetPropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'MASTER_DRAWING_INDEX' });
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
                    if (Array.isArray(fd.items) && fd.items.length > 0) setItems(fd.items);
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load Master Drawing Index submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId]);

    // Dynamic Row Operations
    const handleAddRow = () => {
        if (isReadOnly) return;
        setItems(prev => [
            ...prev,
            { sl_no: String(prev.length + 1), assembly_no: '', size: '', material: '', qty: '', name_of_part: '', revision: 'Rev00' }
        ]);
    };

    const handleRemoveRow = (idx) => {
        if (isReadOnly) return;
        setItems(prev => {
            const next = prev.filter((_, i) => i !== idx);
            return next.map((r, i) => ({ ...r, sl_no: String(i + 1) }));
        });
    };

    const handleCellChange = (idx, field, val) => {
        if (isReadOnly) return;
        setItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        sub_system: subSystem,
        items: items,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        centre_dept: getLoggedUserCentreDept(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_Master_Drawing_Index_${projectNo || '066'}.docx`
    });

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/master-drawing-index/generate`, payload, {
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

            const payloadData = {
                project_title: projectTitle,
                project_no: projectNo,
                customer_name: customerName,
                sub_system: subSystem,
                items: items,
                prepared_by: preparedBy,
                approved_by: approvedBy,
                doc_no: docNo,
                doc_date: docDate
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'MASTER_DRAWING_INDEX',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Master Drawing Index',
                document_no: docNo || '066',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: getLoggedUserCentreDept(),
                    doc_no: docNo,
                    doc_date: docDate
                },
                footer_data: {
                    prepared_by: preparedBy,
                    approved_by: approvedBy
                },
                status: statusRef.current || 'DRAFT',
                created_by_user_id: userId || null,
                is_active: true
            };

            if (submissionIdRef.current) {
                await isoSubmissionService.updateSubmission(submissionIdRef.current, subPayload);
            } else {
                const created = await isoSubmissionService.createSubmission(subPayload);
                if (created?.id) {
                    setSubmissionId(created.id);
                    submissionIdRef.current = created.id;
                }
            }
            setAutoSaveState('saved');
            setLastSavedAt(new Date());
        } catch (err) {
            console.error('Master Drawing Index Auto-save failed:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [
        isReadOnly,
        projectTitle,
        projectNo,
        customerName,
        subSystem,
        items,
        preparedBy,
        approvedBy,
        docNo,
        docDate,
        selectedProposalId,
        docInfo
    ]);

    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const debounceTimer = setTimeout(() => {
            performAutoSave();
        }, 1200);
        return () => clearTimeout(debounceTimer);
    }, [
        projectTitle,
        projectNo,
        customerName,
        subSystem,
        items,
        preparedBy,
        approvedBy,
        docNo,
        docDate,
        performAutoSave,
        isReadOnly
    ]);

    const handleSubmitForReview = async () => {
        if (isReadOnly) return;
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const payloadData = {
                project_title: projectTitle,
                project_no: projectNo,
                customer_name: customerName,
                sub_system: subSystem,
                items: items,
                prepared_by: preparedBy,
                approved_by: approvedBy,
                doc_no: docNo,
                doc_date: docDate
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'MASTER_DRAWING_INDEX',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Master Drawing Index',
                document_no: docNo || '066',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: getLoggedUserCentreDept(),
                    doc_no: docNo,
                    doc_date: docDate
                },
                footer_data: {
                    prepared_by: preparedBy,
                    approved_by: approvedBy
                },
                status: 'SUBMITTED',
                created_by_user_id: userId || null,
                is_active: true
            };

            let currentSubId = submissionIdRef.current;
            if (currentSubId) {
                await isoSubmissionService.updateSubmission(currentSubId, subPayload);
            } else {
                const created = await isoSubmissionService.createSubmission(subPayload);
                currentSubId = created?.id;
                setSubmissionId(currentSubId);
                submissionIdRef.current = currentSubId;
            }

            setStatus('SUBMITTED');
            statusRef.current = 'SUBMITTED';
            alert('Master Drawing Index submitted for approval successfully!');
        } catch (err) {
            console.error('Submission failed:', err);
            alert('Failed to submit for approval.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async () => {
        if (!submissionIdRef.current) return;
        try {
            await isoSubmissionService.reviewSubmission(submissionIdRef.current, {
                status: 'APPROVED',
                reviewer_comments: 'Approved by Group Head'
            });
            setStatus('APPROVED');
            statusRef.current = 'APPROVED';
            alert('Document marked as APPROVED!');
        } catch (err) {
            console.error('Approval failed:', err);
            alert('Failed to approve document.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center">
            {/* Action Bar */}
            <div className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose || onBack}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        title="Back"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-800">Master Drawing Index</h1>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                'bg-amber-100 text-amber-800'
                            }`}>
                                {status}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            {autoSaveState === 'saving' && (
                                <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                    <LoadingOutlined /> Saving draft...
                                </span>
                            )}
                            {autoSaveState === 'saved' && (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    <CheckCircleOutlined /> Saved {lastSavedAt ? `at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                </span>
                            )}
                            {autoSaveState === 'error' && (
                                <span className="text-rose-600 font-medium">Failed to save draft</span>
                            )}
                            {projectNo && <span>Project: <strong className="text-slate-700">{projectNo}</strong></span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerateDoc}
                        disabled={generating}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm"
                    >
                        <FileWordOutlined />
                        {generating ? 'Generating Word...' : 'Download Word'}
                    </button>

                    {!isReadOnly && (
                        <button
                            onClick={handleSubmitForReview}
                            disabled={submitting}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                        >
                            <CheckOutlined />
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    )}

                    {isApprover && status === 'SUBMITTED' && (
                        <button
                            onClick={handleApprove}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                        >
                            <CheckOutlined /> Approve
                        </button>
                    )}
                </div>
            </div>

            {/* Document Paper Container */}
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 space-y-6">
                
                {/* Official ISO Header */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-12 divide-x divide-slate-300">
                        {/* Logo Column */}
                        <div className="col-span-3 p-4 flex items-center justify-center bg-slate-50">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-16 object-contain" />
                        </div>

                        {/* Title Column */}
                        <div className="col-span-6 p-4 flex flex-col items-center justify-center text-center">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Central Manufacturing Technology Institute
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">ISO 9001-2015</p>
                            <div className="w-full border-t border-slate-200 my-2"></div>
                            <h3 className="text-base font-extrabold text-slate-900 tracking-wide">
                                MASTER DRAWING INDEX
                            </h3>
                        </div>

                        {/* Metadata Box */}
                        <div className="col-span-3 p-3 flex flex-col justify-center text-xs space-y-2 bg-slate-50">
                            <div>
                                <span className="text-slate-500 font-medium">Centre / Dept: </span>
                                <input
                                    type="text"
                                    value={getLoggedUserCentreDept() || 'SMC'}
                                    disabled
                                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                                />
                            </div>
                            <div className="border-t border-slate-200 pt-1">
                                <span className="text-slate-500 font-medium">Dated: </span>
                                <input
                                    type="text"
                                    value={docDate}
                                    onChange={(e) => setDocDate(e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                                />
                            </div>
                            <div className="border-t border-slate-200 pt-1 flex justify-between">
                                <span className="text-slate-500 font-medium">Page:</span>
                                <span className="font-bold text-slate-800">Page 1 of 1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Metadata Information Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Title</label>
                        <input
                            type="text"
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Enter project title"
                            className="w-full font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project No.</label>
                        <input
                            type="text"
                            value={projectNo}
                            onChange={(e) => setProjectNo(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="e.g. CMF-2026-01"
                            className="w-full font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Name</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Enter customer name"
                            className="w-full font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sub-system / Module</label>
                        <input
                            type="text"
                            value={subSystem}
                            onChange={(e) => setSubSystem(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="e.g. Drive Assembly"
                            className="w-full font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {/* Master Drawing Index Table */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <TableOutlined className="text-indigo-600 font-bold" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                                Master Drawing Index Table
                            </h3>
                            <span className="text-xs text-slate-400 font-normal">({items.length} items)</span>
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={handleAddRow}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                            >
                                <PlusOutlined /> Add Drawing / Part
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    <th className="p-2.5 border-r border-slate-300 text-left font-bold min-w-[180px]">
                                        Assembly No. / Part No.
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-center font-bold w-20">
                                        Size
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-left font-bold min-w-[140px]">
                                        Material
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-center font-bold w-16">
                                        Qty
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-left font-bold min-w-[260px]">
                                        Name of Part/Assembly
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-center font-bold w-24">
                                        Revision
                                    </th>
                                    <th className="p-2.5 border-r border-slate-300 text-center font-bold w-14">
                                        Sl.
                                    </th>
                                    {!isReadOnly && <th className="p-2.5 w-12 text-center font-bold">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={isReadOnly ? 7 : 8} className="p-6 text-center text-slate-400 italic">
                                            No drawing items added yet. Click "+ Add Drawing / Part" to start.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-slate-200 hover:bg-slate-50 transition">
                                            {/* Assembly No. / Part No. */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.assembly_no || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'assembly_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="e.g. CMTI-ASM-001"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5"
                                                />
                                            </td>

                                            {/* Size */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.size || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'size', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="A0-A4"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-center"
                                                />
                                            </td>

                                            {/* Material */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.material || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'material', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="e.g. SS 304 / AL 6061"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5"
                                                />
                                            </td>

                                            {/* Qty */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.qty || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'qty', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="1"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-center"
                                                />
                                            </td>

                                            {/* Name of Part/Assembly */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.name_of_part || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'name_of_part', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Part / Sub-assembly description"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5"
                                                />
                                            </td>

                                            {/* Revision */}
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.revision || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'revision', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Rev00"
                                                    className="w-full text-xs font-medium text-slate-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1.5 text-center"
                                                />
                                            </td>

                                            {/* Sl. */}
                                            <td className="p-1 border-r border-slate-200 text-center font-medium text-slate-500">
                                                <input
                                                    type="text"
                                                    value={row.sl_no || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'sl_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none text-center outline-none"
                                                />
                                            </td>

                                            {/* Delete Action */}
                                            {!isReadOnly && (
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => handleRemoveRow(rowIdx)}
                                                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded transition"
                                                        title="Delete Row"
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

                {/* Footer Signatures */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl">
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Prepared By</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label>
                            <input
                                type="text"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Approved By</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label>
                            <input
                                type="text"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Group Head / Section Head Name"
                                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
