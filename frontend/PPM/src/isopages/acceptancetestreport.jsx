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
    ExperimentOutlined
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

export default function AcceptanceTestReport({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
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

    // Header & Meta fields
    const [centreDept, setCentreDept] = useState(() => {
        const d = getLoggedUserCentreDept();
        return d ? `C-SMPM/${d}` : 'C-SMPM/SMC';
    });
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [pageStr, setPageStr] = useState('Page 1 of 1');
    const [productIdNo, setProductIdNo] = useState('');
    const [docNo, setDocNo] = useState('087');
    const [docCode, setDocCode] = useState('CMTI-QMS-SMC-087/Rev00');

    // Dynamic Acceptance Test Rows (8 Columns) - Defaults to 1 single row
    const [rows, setRows] = useState([
        {
            sl_no: '1',
            atp_no: '',
            description: '',
            design_value: '',
            recorded_value: '',
            performed_by: 'CMTI',
            inspected_by: '',
            equipment_details: ''
        }
    ]);

    // Footer & Signatures
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [inspectedBy, setInspectedBy] = useState('');
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
                    setProductIdNo(prev => prev || p.project_number || '');
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
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'ACCEPTANCE_TEST_REPORT' });
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
                    if (fd.product_id_no) setProductIdNo(fd.product_id_no);
                    if (fd.centre_dept) setCentreDept(fd.centre_dept);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_code) setDocCode(fd.doc_code);
                    if (fd.page_str) setPageStr(fd.page_str);
                    if (Array.isArray(fd.rows) && fd.rows.length > 0) setRows(fd.rows);
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.inspected_by) setInspectedBy(fd.inspected_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                } else {
                    // Fresh form default to 1 row
                    setRows([
                        {
                            sl_no: '1',
                            atp_no: '',
                            description: '',
                            design_value: '',
                            recorded_value: '',
                            performed_by: 'CMTI',
                            inspected_by: '',
                            equipment_details: ''
                        }
                    ]);
                }
            } catch (err) {
                console.error('Failed to load Acceptance Test Report submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId, selectedProposalId]);

    // Row Operations
    const handleAddRow = () => {
        if (isReadOnly) return;
        const newSl = String(rows.length + 1);
        setRows(prev => [
            ...prev,
            {
                sl_no: newSl,
                atp_no: '',
                description: '',
                design_value: '',
                recorded_value: '',
                performed_by: 'CMTI',
                inspected_by: '',
                equipment_details: ''
            }
        ]);
    };

    const handleDeleteRow = (index) => {
        if (isReadOnly) return;
        if (rows.length <= 1) {
            setRows([{
                sl_no: '1',
                atp_no: '',
                description: '',
                design_value: '',
                recorded_value: '',
                performed_by: 'CMTI',
                inspected_by: '',
                equipment_details: ''
            }]);
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

    // Build Payload
    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        product_id_no: productIdNo,
        centre_dept: centreDept,
        doc_no: docNo,
        doc_date: docDate,
        doc_code: docCode,
        page_str: pageStr,
        group_name: getLoggedUserGroup() || 'SMC',
        rows: rows,
        prepared_by: preparedBy,
        inspected_by: inspectedBy,
        approved_by: approvedBy,
        filename: `ISO_Acceptance_Test_Report_${docNo || '087'}.docx`
    });

    // Generate Word (.docx)
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/acceptance-test-report/generate`, payload, {
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
            message.success('Acceptance Test Report (.docx) downloaded successfully!');
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
                product_id_no: productIdNo,
                centre_dept: centreDept,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                page_str: pageStr,
                rows: rows,
                prepared_by: preparedBy,
                inspected_by: inspectedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'ACCEPTANCE_TEST_REPORT',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Acceptance Test Report',
                document_no: docNo || '087',
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
                    inspected_by: inspectedBy,
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
            console.error('Acceptance Test Report Auto-save failed:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [
        isReadOnly,
        projectTitle,
        projectNo,
        customerName,
        productIdNo,
        centreDept,
        docNo,
        docDate,
        docCode,
        pageStr,
        rows,
        preparedBy,
        inspectedBy,
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
        productIdNo,
        centreDept,
        docNo,
        docDate,
        docCode,
        pageStr,
        rows,
        preparedBy,
        inspectedBy,
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
                product_id_no: productIdNo,
                centre_dept: centreDept,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                page_str: pageStr,
                rows: rows,
                prepared_by: preparedBy,
                inspected_by: inspectedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'ACCEPTANCE_TEST_REPORT',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Acceptance Test Report',
                document_no: docNo || '087',
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
                    inspected_by: inspectedBy,
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
            message.success('Acceptance Test Report submitted for review!');
        } catch (err) {
            console.error('Submit error:', err);
            message.error('Failed to submit document.');
        } finally {
            setSubmitting(false);
        }
    };

    // Approvals
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
            message.success('Acceptance Test Report marked as APPROVED.');
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
            message.success('Acceptance Test Report marked as REJECTED.');
        } catch (err) {
            console.error(err);
            message.error('Failed to reject document.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 lg:px-8 font-sans text-slate-800">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Top Action & Status Bar */}
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
                                    Acceptance Test Report (ATR)
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
                                    Submit
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

                {/* Main Visual Document Canvas (Exact Replica of CMTI ATR Format) */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden">

                    {/* Standard Header Table */}
                    <div className="border-b-2 border-slate-800">
                        <div className="grid grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                            {/* Left: CMTI Logo */}
                            <div className="col-span-12 md:col-span-3 p-4 flex items-center justify-center bg-slate-50/50">
                                <img src={cmtiLogo} alt="CMTI Logo" className="h-16 w-auto object-contain" />
                            </div>

                            {/* Middle: Title & ISO Standard */}
                            <div className="col-span-12 md:col-span-6 p-4 flex flex-col items-center justify-center text-center space-y-1">
                                <h1 className="text-sm sm:text-base font-black text-slate-800 tracking-wider uppercase font-sans">
                                    CENTRAL MANUFACTURING TECHNOLOGY INSTITUTE
                                </h1>
                                <h3 className="text-xs sm:text-sm font-bold text-slate-700 tracking-widest uppercase">
                                    ISO 9001-2015
                                </h3>
                                <div className="mt-2 py-1 px-4 bg-slate-100 rounded-md border border-slate-300">
                                    <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-wide uppercase">
                                        ACCEPTANCE TEST REPORT
                                    </h2>
                                </div>
                            </div>

                            {/* Right: Centre/Dept, Dated, Page */}
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
                                    <span className="font-bold text-slate-700">Dated</span>
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
                                        placeholder="Page 1 of 1"
                                        className="w-full px-2 py-1 bg-transparent border-0 font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500 rounded"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Sub-header: Date, Product ID No, Linked Project */}
                    <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">Date:</span>
                                <input
                                    type="text"
                                    value={docDate}
                                    onChange={(e) => setDocDate(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="DD.MM.YYYY"
                                    className="w-32 px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">Product ID No:</span>
                                <input
                                    type="text"
                                    value={productIdNo}
                                    onChange={(e) => setProductIdNo(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Enter Product / Part ID Number"
                                    className="w-56 px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-600">Linked Project:</span>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- No Link (Standalone ATR) --</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.project_number ? `[${p.project_number}] ` : ''}{p.title_of_project || p.quote_description || `Proposal #${p.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 8 Columns Acceptance Test Table (Matching Exact ATR Document) */}
                    <div className="overflow-x-auto p-4 sm:p-6">
                        <table className="w-full border-collapse border border-slate-800 text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center divide-x divide-slate-800">
                                    <th className="p-2.5 w-14 uppercase">Sl No</th>
                                    <th className="p-2.5 w-28 uppercase">
                                        <div className="flex flex-col items-center justify-center">
                                            <span>ATP No</span>
                                            <span className="text-[10px] text-slate-500 font-normal">(From ATR Doc)</span>
                                        </div>
                                    </th>
                                    <th className="p-2.5 min-w-[180px] uppercase text-left">Description</th>
                                    <th className="p-2.5 w-28 uppercase">Design Value</th>
                                    <th className="p-2.5 w-28 uppercase">Recorded Value</th>
                                    <th className="p-2.5 w-28 uppercase">
                                        <div className="flex flex-col items-center justify-center">
                                            <span>Performed By</span>
                                            <span className="text-[10px] text-slate-500 font-normal">(CMTI)</span>
                                        </div>
                                    </th>
                                    <th className="p-2.5 w-28 uppercase">Inspected By</th>
                                    <th className="p-2.5 min-w-[200px] uppercase text-left">
                                        Description & ID Number of Equipment/Instrument/Sensor used for Inspection
                                    </th>
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
                                                value={row.sl_no || `${idx + 1}.`}
                                                onChange={(e) => handleRowChange(idx, 'sl_no', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full text-center bg-transparent border-0 font-bold focus:ring-0"
                                            />
                                        </td>

                                        {/* ATP No */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.atp_no}
                                                onChange={(e) => handleRowChange(idx, 'atp_no', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="e.g. ATP-01"
                                                className="w-full px-1.5 py-1 bg-transparent border-0 font-mono text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Description */}
                                        <td className="p-1">
                                            <textarea
                                                rows={2}
                                                value={row.description}
                                                onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Test parameter / Inspection feature description..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
                                            />
                                        </td>

                                        {/* Design Value */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.design_value}
                                                onChange={(e) => handleRowChange(idx, 'design_value', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="e.g. 50 ± 0.05 mm"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Recorded Value */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.recorded_value}
                                                onChange={(e) => handleRowChange(idx, 'recorded_value', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="e.g. 50.02 mm"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-center font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Performed By (CMTI) */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.performed_by}
                                                onChange={(e) => handleRowChange(idx, 'performed_by', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="CMTI Staff"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Inspected By */}
                                        <td className="p-1">
                                            <input
                                                type="text"
                                                value={row.inspected_by}
                                                onChange={(e) => handleRowChange(idx, 'inspected_by', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Inspector Name"
                                                className="w-full px-2 py-1 bg-transparent border-0 text-center text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded"
                                            />
                                        </td>

                                        {/* Equipment & Sensor details */}
                                        <td className="p-1">
                                            <textarea
                                                rows={2}
                                                value={row.equipment_details}
                                                onChange={(e) => handleRowChange(idx, 'equipment_details', e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Vernier / CMM / Sensor Model & Calibration ID..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
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
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                                >
                                    <PlusOutlined /> Add Test Row
                                </button>
                                <span className="text-[11px] text-slate-400">
                                    Starts with 1 row by default. Add as many test parameters as required.
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Footer & Signatures Block */}
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
                                            [Signed Digitally / On Physical Copy]
                                        </div>
                                    </div>
                                </div>

                                {/* Inspected / Approved By */}
                                <div className="p-3 space-y-2 text-xs">
                                    <span className="font-bold text-slate-900 block">Inspected / Approved By</span>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Name:</span>
                                        <input
                                            type="text"
                                            value={approvedBy || inspectedBy}
                                            onChange={(e) => {
                                                setApprovedBy(e.target.value);
                                                setInspectedBy(e.target.value);
                                            }}
                                            disabled={isReadOnly}
                                            placeholder="Approver / Inspector name"
                                            className="col-span-3 px-2 py-1 bg-white border border-slate-200 rounded font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="text-slate-600 font-medium">Signature:</span>
                                        <div className="col-span-3 text-slate-400 italic text-[11px]">
                                            [Signed Digitally / On Physical Copy]
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

                        {/* Format Code Bottom Left */}
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
