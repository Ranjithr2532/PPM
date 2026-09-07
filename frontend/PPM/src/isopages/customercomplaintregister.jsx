import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    PlusOutlined,
    DeleteOutlined,
    InfoCircleOutlined,
    UserOutlined
} from '@ant-design/icons';
import { message } from 'antd';
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

export default function CustomerComplaintRegister({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
    const searchParams = new URLSearchParams(window.location.search);
    const urlProposalId = searchParams.get('proposal_id') || searchParams.get('proposalId') || searchParams.get('id') || '';
    const effectiveProposalId = propProposalId || docInfo?.proposalId || docInfo?.proposal_id || urlProposalId || '';
    const effectiveSubmissionId = propSubmissionId || null;

    const [proposals, setProposals] = useState([]);
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

    // Proposal metadata
    const [projectTitle, setProjectTitle] = useState('');
    const [projectNo, setProjectNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    // Header fields
    const [centreDept, setCentreDept] = useState(() => {
        const d = getLoggedUserCentreDept();
        return d ? `C-SMPM/${d}` : 'C-SMPM/SMC';
    });
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [pageStr, setPageStr] = useState('1 of 1');
    const [docNo, setDocNo] = useState('086');
    const [docCode, setDocCode] = useState('CMTI-QMS-SMC-086/Rev00');

    // Dynamic Complaint Register Table (7 Columns) - default 1 row
    const [rows, setRows] = useState([
        { sl_no: '1', date: getTodayDateString(), complaint_ref: '', complaint_desc: '', customer_details: '', nc_no: '', remarks: '' }
    ]);

    // Signatures & Footer
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : isApproved;

    // Auto-fill project info directly from proposal
    useEffect(() => {
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
                    const addr = [p.customer_address, p.city, p.state, p.pincode].filter(Boolean).join(', ');
                    setCustomerAddress(prev => prev || addr);
                }
            } catch (err) {
                console.error('Failed to load proposal details:', err);
            }
        };
        fetchProposal();
    }, [effectiveProposalId, selectedProposalId, urlProposalId]);

    // Load proposals for selector
    useEffect(() => {
        const loadProposals = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/`);
                if (Array.isArray(res.data)) setProposals(res.data);
            } catch (err) {
                console.error('Failed to fetch proposals:', err);
            }
        };
        loadProposals();
    }, []);

    // Load existing submission if editing or linked to proposal
    useEffect(() => {
        const loadSubmission = async () => {
            try {
                let sub = null;
                const targetSubId = propSubmissionId || null;
                const targetPropId = propProposalId || selectedProposalId;

                if (targetSubId) {
                    sub = await isoSubmissionService.getSubmissionById(targetSubId);
                } else if (targetPropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'CUSTOMER_COMPLAINT_REGISTER' });
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
                    if (fd.centre_dept) setCentreDept(fd.centre_dept);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_code) setDocCode(fd.doc_code);
                    if (fd.page_str) setPageStr(fd.page_str);
                    if (Array.isArray(fd.rows) && fd.rows.length > 0) setRows(fd.rows);
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                } else {
                    setRows([
                        { sl_no: '1', date: getTodayDateString(), complaint_ref: '', complaint_desc: '', customer_details: '', nc_no: '', remarks: '' }
                    ]);
                }
            } catch (err) {
                console.error('Failed to load Customer Complaint Register submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId, selectedProposalId]);

    // Table Row Operations
    const handleAddRow = () => {
        if (isReadOnly) return;
        const newSl = String(rows.length + 1);
        setRows(prev => [
            ...prev,
            { sl_no: newSl, date: '', complaint_ref: '', complaint_desc: '', customer_details: '', nc_no: '', remarks: '' }
        ]);
    };

    const handleDeleteRow = (index) => {
        if (isReadOnly) return;
        if (rows.length <= 1) {
            setRows([{ sl_no: '1', date: '', complaint_ref: '', complaint_desc: '', customer_details: '', nc_no: '', remarks: '' }]);
            return;
        }
        setRows(prev => {
            const updated = prev.filter((_, i) => i !== index);
            return updated.map((r, i) => ({ ...r, sl_no: String(i + 1) }));
        });
    };

    const handleRowChange = (index, field, value) => {
        if (isReadOnly) return;
        setRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAutoFillCustomer = (index) => {
        if (isReadOnly) return;
        const combined = [customerName, customerAddress].filter(Boolean).join('\n');
        if (!combined) {
            message.info('No Customer info available on current proposal to auto-fill.');
            return;
        }
        handleRowChange(index, 'customer_details', combined);
        message.success('Auto-filled Customer Details');
    };

    // Build Payload
    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        centre_dept: centreDept,
        doc_no: docNo,
        doc_date: docDate,
        doc_code: docCode,
        page_str: pageStr,
        group_name: getLoggedUserGroup() || 'SMC',
        rows: rows,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        filename: `ISO_Customer_Complaint_Register_${docNo || '086'}.docx`
    });

    // Generate Word (.docx)
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/customer-complaint-register/generate`, payload, {
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
            message.success('Customer Complaint Register (.docx) downloaded successfully!');
        } catch (err) {
            console.error('Word doc generation error:', err);
            message.error('Failed to generate Word document.');
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
                centre_dept: centreDept,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                page_str: pageStr,
                rows: rows,
                prepared_by: preparedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'CUSTOMER_COMPLAINT_REGISTER',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Customer Complaint Register',
                document_no: docNo || '086',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: centreDept,
                    doc_no: docNo,
                    doc_date: docDate,
                    code: docCode
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
            console.error('Complaint Register Auto-save failed:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [
        isReadOnly,
        projectTitle,
        projectNo,
        customerName,
        centreDept,
        docNo,
        docDate,
        docCode,
        pageStr,
        rows,
        preparedBy,
        approvedBy,
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
        centreDept,
        docNo,
        docDate,
        docCode,
        pageStr,
        rows,
        preparedBy,
        approvedBy,
        performAutoSave,
        isReadOnly
    ]);

    // Submit for Review
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
                centre_dept: centreDept,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                page_str: pageStr,
                rows: rows,
                prepared_by: preparedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'CUSTOMER_COMPLAINT_REGISTER',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Customer Complaint Register',
                document_no: docNo || '086',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: centreDept,
                    doc_no: docNo,
                    doc_date: docDate,
                    code: docCode
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
            message.success('Customer Complaint Register submitted for approval!');
        } catch (err) {
            console.error('Submit error:', err);
            message.error('Failed to submit document for review.');
        } finally {
            setSubmitting(false);
        }
    };

    // Approval Handlers
    const handleApprove = async () => {
        if (!submissionId) {
            message.warning('Please save or submit the form first.');
            return;
        }
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const userId = rawUser ? JSON.parse(rawUser)?.id : null;
            await isoSubmissionService.updateStatus(submissionId, 'APPROVED', null, userId);
            setStatus('APPROVED');
            statusRef.current = 'APPROVED';
            message.success('Customer Complaint Register marked as APPROVED.');
        } catch (err) {
            console.error(err);
            message.error('Failed to approve document.');
        }
    };

    const handleReject = async () => {
        if (!submissionId) return;
        const reason = window.prompt('Please enter the reason for rejection:');
        if (reason === null) return;
        try {
            await isoSubmissionService.updateStatus(submissionId, 'REJECTED', reason || 'Changes requested');
            setStatus('REJECTED');
            statusRef.current = 'REJECTED';
            message.success('Customer Complaint Register marked as REJECTED.');
        } catch (err) {
            console.error(err);
            message.error('Failed to reject document.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 lg:px-8 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Top Sticky Action & Status Bar */}
                <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onBack || onClose}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                            <ArrowLeftOutlined /> Back to Directory
                        </button>
                        <div className="h-4 w-px bg-slate-200" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-800 tracking-tight">
                                    Customer Complaint Register
                                </h2>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    Doc #{docNo}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                    'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {status}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 font-mono">
                                <span>Code: {docCode}</span>
                                {autoSaveState === 'saving' && (
                                    <span className="text-indigo-600 flex items-center gap-1">
                                        <LoadingOutlined /> Saving draft...
                                    </span>
                                )}
                                {autoSaveState === 'saved' && (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                        <CheckCircleOutlined /> Draft auto-saved
                                    </span>
                                )}
                                {autoSaveState === 'error' && (
                                    <span className="text-rose-500">
                                        Failed to auto-save
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                        <button
                            type="button"
                            onClick={handleGenerateDoc}
                            disabled={generating}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs hover:border-slate-400 transition"
                        >
                            {generating ? <LoadingOutlined /> : <FileWordOutlined className="text-blue-600" />}
                            Download Word (.docx)
                        </button>

                        {!isReadOnly && (
                            <>
                                <button
                                    type="button"
                                    onClick={performAutoSave}
                                    disabled={autoSaveState === 'saving'}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
                                >
                                    Save Draft
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitForReview}
                                    disabled={submitting}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                                >
                                    {submitting ? <LoadingOutlined /> : <CheckOutlined />}
                                    Submit for Review
                                </button>
                            </>
                        )}

                        {isApprover && status === 'SUBMITTED' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleApprove}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                                >
                                    <CheckOutlined /> Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                                >
                                    <CloseOutlined /> Reject
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Visual Document Canvas (Exact Replica of CMTI Format) */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden">

                    {/* CMTI ISO Standard Header Box */}
                    <div className="border-b-2 border-slate-800">
                        <div className="grid grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                            {/* Left: CMTI Logo */}
                            <div className="col-span-12 md:col-span-3 p-4 flex items-center justify-center bg-slate-50/50">
                                <img src={cmtiLogo} alt="CMTI Logo" className="h-16 w-auto object-contain" />
                            </div>

                            {/* Middle: Title & ISO Details */}
                            <div className="col-span-12 md:col-span-6 p-4 flex flex-col items-center justify-center text-center space-y-1">
                                <h1 className="text-sm sm:text-base font-black text-slate-800 tracking-wider uppercase font-sans">
                                    CENTRAL MANUFACTURING TECHNOLOGY INSTITUTE
                                </h1>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-700 tracking-widest uppercase">
                                    ISO 9001-2015
                                </h3>
                                <div className="mt-2 py-1 px-4 bg-slate-100 rounded-md border border-slate-300">
                                    <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-wide uppercase">
                                        CUSTOMER COMPLAINT REGISTER
                                    </h2>
                                </div>
                            </div>

                            {/* Right: Metadata Matrix */}
                            <div className="col-span-12 md:col-span-3 divide-y divide-slate-800 text-xs font-mono bg-slate-50/30">
                                <div className="grid grid-cols-2 divide-x divide-slate-800 p-2 items-center">
                                    <span className="font-bold text-slate-700">Centre / Dept</span>
                                    <input
                                        type="text"
                                        value={centreDept}
                                        onChange={(e) => setCentreDept(e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="C-SMPM/SMC"
                                        className="w-full px-2 py-1 bg-transparent border-0 font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500 rounded"
                                    />
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-slate-800 p-2 items-center">
                                    <span className="font-bold text-slate-700">Date</span>
                                    <input
                                        type="text"
                                        value={docDate}
                                        onChange={(e) => setDocDate(e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="DD.MM.YYYY"
                                        className="w-full px-2 py-1 bg-transparent border-0 font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500 rounded"
                                    />
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-slate-800 p-2 items-center">
                                    <span className="font-bold text-slate-700">Page</span>
                                    <input
                                        type="text"
                                        value={pageStr}
                                        onChange={(e) => setPageStr(e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="1 of 1"
                                        className="w-full px-2 py-1 bg-transparent border-0 font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500 rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Linked Proposal & Project Context Bar */}
                    <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-slate-600 uppercase tracking-wide">Linked Project:</span>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- No Link (Standalone Register) --</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.project_number ? `[${p.project_number}] ` : ''}{p.title_of_project || p.quote_description || `Proposal #${p.id}`}
                                    </option>
                                ))}
                            </select>
                            {customerName && (
                                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 font-semibold">
                                    Customer: <strong className="text-slate-900">{customerName}</strong>
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500">
                                Total Complaints: <strong>{rows.filter(r => r.complaint_ref || r.complaint_desc || r.customer_details).length}</strong>
                            </span>
                        </div>
                    </div>

                    {/* 7 Columns Dynamic Register Table (Matching Exact Word Template) */}
                    <div className="overflow-x-auto p-4 sm:p-6">
                        <table className="w-full border-collapse border border-slate-800 text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center divide-x divide-slate-800">
                                    <th className="p-2.5 w-14 uppercase">Sl.No.</th>
                                    <th className="p-2.5 w-28 uppercase">Date</th>
                                    <th className="p-2.5 w-40 uppercase">Complaint reference</th>
                                    <th className="p-2.5 min-w-[220px] uppercase">Complaint description</th>
                                    <th className="p-2.5 min-w-[220px] uppercase">
                                        <div className="flex flex-col items-center justify-center">
                                            <span>Customer</span>
                                            <span>Name & Address of Customer</span>
                                        </div>
                                    </th>
                                    <th className="p-2.5 w-32 uppercase">
                                        <div className="flex flex-col items-center justify-center">
                                            <span>NC No. as per</span>
                                            <span>NC register</span>
                                        </div>
                                    </th>
                                    <th className="p-2.5 w-36 uppercase">Remarks</th>
                                    {!isReadOnly && <th className="p-2 w-12 bg-slate-200/60 uppercase">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map((row, idx) => (
                                    <tr key={idx} className="divide-x divide-slate-800 hover:bg-slate-50/50 transition">
                                        {/* Sl No */}
                                        <td className="p-1 text-center font-bold text-slate-700 bg-slate-50/40">
                                            <input
                                                type="text"
                                                value={row.sl_no || String(idx + 1)}
                                                onChange={(e) => handleRowChange(idx, 'sl_no', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full text-center bg-transparent border-0 font-bold focus:ring-0"
                                            />
                                        </td>

                                        {/* Date */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.date}
                                                onChange={(e) => handleRowChange(idx, 'date', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="DD.MM.YYYY"
                                                className="w-full px-1.5 py-1 bg-transparent border-0 font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Complaint Reference */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.complaint_ref}
                                                onChange={(e) => handleRowChange(idx, 'complaint_ref', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="e.g. Email / Letter Ref"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Complaint Description */}
                                        <td className="p-1">
                                            <textarea
                                                rows={2}
                                                value={row.complaint_desc}
                                                onChange={(e) => handleRowChange(idx, 'complaint_desc', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Details of complaint or issue reported..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
                                            />
                                        </td>

                                        {/* Customer Name & Address */}
                                        <td className="p-1 relative group">
                                            <textarea
                                                rows={2}
                                                value={row.customer_details}
                                                onChange={(e) => handleRowChange(idx, 'customer_details', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Customer Organization & Address..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
                                            />
                                            {!isReadOnly && customerName && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoFillCustomer(idx)}
                                                    title="Auto-fill with Linked Customer"
                                                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100"
                                                >
                                                    + Auto-fill
                                                </button>
                                            )}
                                        </td>

                                        {/* NC No */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.nc_no}
                                                onChange={(e) => handleRowChange(idx, 'nc_no', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="e.g. NC-01"
                                                className="w-full px-2 py-1 bg-transparent border-0 font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Remarks */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.remarks}
                                                onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Action taken / Remarks"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Action Delete */}
                                        {!isReadOnly && (
                                            <td className="p-1 text-center bg-slate-50/50">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRow(idx)}
                                                    className="text-slate-400 hover:text-rose-600 transition p-1"
                                                    title="Delete row"
                                                >
                                                    <DeleteOutlined />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add Row Button */}
                        {!isReadOnly && (
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                                >
                                    <PlusOutlined /> Add Complaint Row
                                </button>
                                <span className="text-[11px] text-slate-400">
                                    Tip: You can add multiple complaint rows or keep empty placeholder rows for printing.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer & Signatures Block (Matching Image Footer Exactly) */}
                    <div className="p-4 sm:p-6 border-t-2 border-slate-800 bg-slate-50/30">
                        <div className="border border-slate-800 divide-y divide-slate-800">

                            {/* Signatures Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                                {/* Prepared By */}
                                <div className="p-3 space-y-2 text-xs">
                                    <span className="font-bold text-slate-900 block">Prepared by</span>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Name:</span>
                                        <input
                                            type="text"
                                            value={preparedBy}
                                            onChange={(e) => setPreparedBy(e.target.value)}
                                            disabled={isReadOnly}
                                            placeholder="Prepared by name"
                                            className="col-span-3 px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Signature:</span>
                                        <div className="col-span-3 text-slate-400 italic text-[11px]">
                                            [Signed Digitally / On File]
                                        </div>
                                    </div>
                                </div>

                                {/* Approved By (MR) */}
                                <div className="p-3 space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900">Approved By</span>
                                        <span className="font-bold text-slate-600 font-mono">(MR)</span>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Name:</span>
                                        <input
                                            type="text"
                                            value={approvedBy}
                                            onChange={(e) => setApprovedBy(e.target.value)}
                                            disabled={isReadOnly}
                                            placeholder="Approver / MR name"
                                            className="col-span-3 px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Signature:</span>
                                        <div className="col-span-3 text-slate-400 italic text-[11px]">
                                            [Signed Digitally / On File]
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Institute Address Footer */}
                            <div className="p-2.5 text-center bg-slate-100/70 text-xs font-bold text-slate-800 uppercase tracking-wider space-y-0.5">
                                <div>CENTRAL MANUFACTURING TECHNOLOGY INSTITUTE</div>
                                <div className="text-[11px] font-semibold text-slate-600 tracking-normal">TUMKUR ROAD, BANGALORE 560 022</div>
                            </div>
                        </div>

                        {/* Document Code Bottom Left */}
                        <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                            <span>{docCode}</span>
                            <span>Document ID: #{docNo}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
