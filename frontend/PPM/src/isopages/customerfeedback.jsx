import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    StarFilled,
    StarOutlined,
    InfoCircleOutlined,
    CalculatorOutlined
} from '@ant-design/icons';
import { message } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getLoggedUserCentreDept, getCurrentUserRole } from '../services/isoSubmissionService';

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

const DEFAULT_FEEDBACK_QUESTIONS = [
    { sl_no: '1', parameter: 'Overall, how satisfied were you with the training program?', rating: '' },
    { sl_no: '2', parameter: 'Whether the rate quoted for the project is justified?', rating: '' },
    { sl_no: '3', parameter: 'Whether required documents / Information submitted on time to adhere to your organizations quality system?', rating: '' },
    { sl_no: '4', parameter: 'How do you rate the quality of the product/deliverables? (Product/test reports etc)', rating: '' },
    { sl_no: '5', parameter: 'How do you rate the technical Competence of CMTI Team? (Design, Manufacturing, assembly and testing)', rating: '' },
    { sl_no: '6', parameter: 'How do you rate the effectiveness of any communication? (Project updates, MOM action points etc.)', rating: '' },
    { sl_no: '7', parameter: 'How effectively were the reviews conducted (Design review, Project stage review etc.)', rating: '' },
    { sl_no: '8', parameter: 'How was the timeline for delivery maintained? (if project is not completed please rate for stage wise execution)', rating: '' },
    { sl_no: '9', parameter: 'Whether all the Technical requirements met?', rating: '' }
];

export default function CustomerFeedback({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
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
    const [companyNameAddress, setCompanyNameAddress] = useState('');

    // Header & Format
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [docNo, setDocNo] = useState('088');
    const [docCode, setDocCode] = useState('CMTI-SMC-QMS-088/Rev00');
    const [centreDept, setCentreDept] = useState(() => getLoggedUserCentreDept() || 'C-SMPM/SMC');

    // Ratings State (9 parameters)
    const [ratings, setRatings] = useState(DEFAULT_FEEDBACK_QUESTIONS);

    // Question 10: Comments
    const [comments, setComments] = useState('');

    // Customer Representative
    const [customerRepName, setCustomerRepName] = useState('');

    // Office Use Block
    const [conclusionRemarks, setConclusionRemarks] = useState('');
    const [actionPlan, setActionPlan] = useState('');

    // Signatures
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');

    // Calculations: Score obtained & percentage
    const totalMaxScore = 90;
    const scoreObtained = ratings.reduce((acc, curr) => {
        const val = parseInt(curr.rating, 10);
        return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const ratedCount = ratings.filter(r => r.rating && !isNaN(parseInt(r.rating, 10))).length;
    const percentage = ratedCount > 0 ? ((scoreObtained / totalMaxScore) * 100).toFixed(2) + '%' : '0%';

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

                    const addr = [p.customer_name, p.customer_address, p.city, p.state, p.pincode].filter(Boolean).join(', ');
                    setCompanyNameAddress(prev => prev || addr);
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
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'CUSTOMER_FEEDBACK' });
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
                    if (fd.company_name_address) setCompanyNameAddress(fd.company_name_address);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_code) setDocCode(fd.doc_code);
                    if (fd.comments) setComments(fd.comments);
                    if (fd.customer_rep_name) setCustomerRepName(fd.customer_rep_name);

                    if (Array.isArray(fd.ratings) && fd.ratings.length > 0) {
                        // Merge saved ratings with default question structure
                        setRatings(DEFAULT_FEEDBACK_QUESTIONS.map(q => {
                            const found = fd.ratings.find(r => String(r.sl_no) === String(q.sl_no));
                            return found ? { ...q, rating: found.rating || '' } : q;
                        }));
                    }

                    const ou = fd.office_use || {};
                    if (ou.conclusion_remarks) setConclusionRemarks(ou.conclusion_remarks);
                    if (ou.action_plan) setActionPlan(ou.action_plan);

                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                }
            } catch (err) {
                console.error('Failed to load Customer Feedback submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId, selectedProposalId]);

    // Handle Rating Selection
    const handleRatingChange = (index, value) => {
        if (isReadOnly) return;
        setRatings(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], rating: String(value) };
            return updated;
        });
    };

    // Build Payload
    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        company_name_address: companyNameAddress,
        doc_no: docNo,
        doc_date: docDate,
        doc_code: docCode,
        group_name: getLoggedUserGroup() || 'SMC',
        centre_dept: centreDept,
        ratings: ratings,
        comments: comments,
        customer_rep_name: customerRepName,
        office_use: {
            total: String(totalMaxScore),
            score_obtained: String(scoreObtained),
            percentage: percentage,
            conclusion_remarks: conclusionRemarks,
            action_plan: actionPlan
        },
        prepared_by: preparedBy,
        approved_by: approvedBy,
        filename: `ISO_Customer_Feedback_${docNo || '088'}.docx`
    });

    // Generate Word (.docx)
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/customer-feedback/generate`, payload, {
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
            message.success('Customer Feedback Form (.docx) downloaded successfully!');
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
                company_name_address: companyNameAddress,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                ratings: ratings,
                comments: comments,
                customer_rep_name: customerRepName,
                office_use: {
                    total: String(totalMaxScore),
                    score_obtained: String(scoreObtained),
                    percentage: percentage,
                    conclusion_remarks: conclusionRemarks,
                    action_plan: actionPlan
                },
                prepared_by: preparedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'CUSTOMER_FEEDBACK',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Customer Feedback Form',
                document_no: docNo || '088',
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
            console.error('Feedback Auto-save failed:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [
        isReadOnly,
        projectTitle,
        projectNo,
        customerName,
        companyNameAddress,
        docNo,
        docDate,
        docCode,
        centreDept,
        ratings,
        comments,
        customerRepName,
        scoreObtained,
        percentage,
        conclusionRemarks,
        actionPlan,
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
        companyNameAddress,
        docNo,
        docDate,
        docCode,
        centreDept,
        ratings,
        comments,
        customerRepName,
        scoreObtained,
        percentage,
        conclusionRemarks,
        actionPlan,
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
                company_name_address: companyNameAddress,
                doc_no: docNo,
                doc_date: docDate,
                doc_code: docCode,
                ratings: ratings,
                comments: comments,
                customer_rep_name: customerRepName,
                office_use: {
                    total: String(totalMaxScore),
                    score_obtained: String(scoreObtained),
                    percentage: percentage,
                    conclusion_remarks: conclusionRemarks,
                    action_plan: actionPlan
                },
                prepared_by: preparedBy,
                approved_by: approvedBy
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'CUSTOMER_FEEDBACK',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Customer Feedback Form',
                document_no: docNo || '088',
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
            message.success('Customer Feedback Form submitted successfully!');
        } catch (err) {
            console.error('Submit error:', err);
            message.error('Failed to submit form.');
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
            message.success('Customer Feedback marked as APPROVED.');
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
            message.success('Customer Feedback marked as REJECTED.');
        } catch (err) {
            console.error(err);
            message.error('Failed to reject document.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 lg:px-8 font-sans text-slate-800">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Top Sticky Header & Controls Bar */}
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
                                    Customer Feedback Form
                                </h2>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
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

                {/* Main Visual Document Sheet (Exact Visual Replica of CMTI Doc 088) */}
                <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 p-6 sm:p-8 space-y-6">

                    {/* Date at Top Right */}
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Linked Project:</span>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- Standalone Feedback Form --</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.project_number ? `[${p.project_number}] ` : ''}{p.title_of_project || p.quote_description || `Proposal #${p.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <span>Date:</span>
                            <input
                                type="text"
                                value={docDate}
                                onChange={(e) => setDocDate(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="DD.MM.YYYY"
                                className="w-28 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Company Name & Address Box */}
                    <div className="border border-slate-800 rounded-lg p-4 space-y-3 bg-slate-50/40 text-xs">
                        <div className="grid grid-cols-12 gap-2 items-start">
                            <span className="col-span-12 sm:col-span-3 font-bold text-slate-800">Company Name & Address:</span>
                            <textarea
                                rows={2}
                                value={companyNameAddress}
                                onChange={(e) => setCompanyNameAddress(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Enter customer / client company name, branch & complete address..."
                                className="col-span-12 sm:col-span-9 px-3 py-1.5 bg-white border border-slate-300 rounded font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-12 sm:col-span-3 font-bold text-slate-800">Project Name:</span>
                            <input
                                type="text"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Project Title / Training Program / Deliverable Name"
                                className="col-span-12 sm:col-span-9 px-3 py-1.5 bg-white border border-slate-300 rounded font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="pt-2 text-slate-600 italic text-[11px] border-t border-slate-200">
                            Please indicate your opinion towards the following parameters on a scale of <strong>1 to 10</strong> (10 being the highest).
                        </div>
                    </div>

                    {/* 9 Parameters Rating Table + Question 10 Comments */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-800 text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center divide-x divide-slate-800">
                                    <th className="p-2.5 w-16 uppercase">Sl. No.</th>
                                    <th className="p-2.5 uppercase text-left">Parameter</th>
                                    <th className="p-2.5 w-32 uppercase">Rating (1-10)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {ratings.map((item, idx) => (
                                    <tr key={idx} className="divide-x divide-slate-800 hover:bg-slate-50/60 transition">
                                        {/* Sl No */}
                                        <td className="p-2 text-center font-bold text-slate-700 bg-slate-50/40">
                                            {item.sl_no}.
                                        </td>

                                        {/* Parameter Description */}
                                        <td className="p-2.5 text-slate-800 font-medium">
                                            {item.parameter}
                                        </td>

                                        {/* Rating Input / Score Selector */}
                                        <td className="p-2 text-center bg-slate-50/20">
                                            <div className="flex items-center justify-center gap-1">
                                                <select
                                                    value={item.rating}
                                                    onChange={(e) => handleRatingChange(idx, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className={`w-20 px-2 py-1 bg-white border rounded font-bold text-center text-xs focus:ring-1 focus:ring-indigo-500 ${
                                                        item.rating ? 'border-indigo-400 text-indigo-700 bg-indigo-50/30' : 'border-slate-300 text-slate-400'
                                                    }`}
                                                >
                                                    <option value="">--</option>
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                        <option key={num} value={String(num)}>{num}</option>
                                                    ))}
                                                </select>
                                                {item.rating >= 8 && <StarFilled className="text-amber-400 text-xs" />}
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {/* Question 10: Comments / Suggestion / Complaints */}
                                <tr className="divide-x divide-slate-800 bg-slate-50/30">
                                    <td className="p-2 text-center font-bold text-slate-700 bg-slate-50/40 align-top pt-3">
                                        10.
                                    </td>
                                    <td colSpan={2} className="p-3 space-y-1.5">
                                        <span className="font-bold text-slate-900 block">
                                            Your Complaints / Suggestion / Comments:
                                        </span>
                                        <textarea
                                            rows={3}
                                            value={comments}
                                            onChange={(e) => setComments(e.target.value)}
                                            disabled={isReadOnly}
                                            placeholder="Please provide any specific feedback, appreciation, areas for improvement, or complaints..."
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Customer Seal & Representative Block */}
                    <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-800 divide-y md:divide-y-0 md:divide-x divide-slate-800 text-xs">
                        <div className="p-4 space-y-6">
                            <span className="font-bold text-slate-800 block">Company Seal</span>
                            <div className="h-12 flex items-center justify-center border border-dashed border-slate-300 rounded text-slate-400 italic text-[11px]">
                                [Affix Customer Official Seal Here]
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            <span className="font-bold text-slate-800 block">Customer representative Name & Sign:</span>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={customerRepName}
                                    onChange={(e) => setCustomerRepName(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Enter Customer Representative Name & Designation"
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="text-slate-400 italic text-[11px] pt-1">
                                    Signature: [Signed Digitally / On Physical Copy]
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FOR CMTI OFFICE USE ONLY BLOCK */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                FOR CMTI OFFICE USE ONLY.
                            </h4>
                            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                                <CalculatorOutlined /> Real-time Evaluation
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-800 text-xs">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800 text-center divide-x divide-slate-800">
                                        <th className="p-2 w-20 uppercase">Total</th>
                                        <th className="p-2 w-28 uppercase">Score Obtained</th>
                                        <th className="p-2 w-28 uppercase">% Of Rating</th>
                                        <th className="p-2 uppercase text-left min-w-[180px]">Conclusion/ Remarks</th>
                                        <th className="p-2 uppercase text-left min-w-[180px]">Action plan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="divide-x divide-slate-800">
                                        {/* Total max score */}
                                        <td className="p-2.5 text-center font-bold text-slate-700 bg-slate-50/50">
                                            {totalMaxScore}
                                        </td>

                                        {/* Score Obtained */}
                                        <td className="p-2.5 text-center font-bold text-indigo-700 bg-indigo-50/30 text-sm">
                                            {scoreObtained}
                                        </td>

                                        {/* % of Rating */}
                                        <td className="p-2.5 text-center font-bold text-emerald-700 bg-emerald-50/30 text-sm">
                                            {percentage}
                                        </td>

                                        {/* Conclusion / Remarks */}
                                        <td className="p-2">
                                            <textarea
                                                rows={2}
                                                value={conclusionRemarks}
                                                onChange={(e) => setConclusionRemarks(e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Conclusion & overall rating remark..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
                                            />
                                        </td>

                                        {/* Action Plan */}
                                        <td className="p-2">
                                            <textarea
                                                rows={2}
                                                value={actionPlan}
                                                onChange={(e) => setActionPlan(e.target.value)}
                                                disabled={isReadOnly}
                                                placeholder="Corrective actions / improvement plan..."
                                                className="w-full px-2 py-1 bg-transparent border-0 text-slate-800 focus:ring-1 focus:ring-indigo-500 rounded resize-y"
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Institute Address & Format Footer */}
                    <div className="border border-slate-800 rounded-lg p-2.5 text-center bg-slate-50/60 text-xs font-bold text-slate-800 uppercase tracking-wider space-y-0.5">
                        <div>CENTRAL MANUFACTURING TECHNOLOGY INSTITUTE</div>
                        <div className="text-[11px] font-semibold text-slate-600 tracking-normal">TUMKUR ROAD, BANGALORE 560 022</div>
                    </div>

                    {/* Format No Bottom Left */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                        <span>Format No : {docCode}</span>
                        <span>Document ID: #{docNo}</span>
                    </div>

                </div>
            </div>
        </div>
    );
}
