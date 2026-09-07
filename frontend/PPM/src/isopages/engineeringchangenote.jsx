import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    InfoCircleOutlined,
    CheckSquareOutlined,
    BorderOutlined
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

export default function EngineeringChangeNote({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
    const searchParams = new URLSearchParams(window.location.search);
    const urlProposalId = searchParams.get('proposal_id') || searchParams.get('proposalId') || searchParams.get('id') || '';
    const effectiveProposalId = propProposalId || docInfo?.proposalId || docInfo?.proposal_id || urlProposalId || '';
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
    const [ecnNo, setEcnNo] = useState('ECN-01');
    const [ecnDate, setEcnDate] = useState(getTodayDateString());

    // Section 1: Part Description
    const [partDescription, setPartDescription] = useState('');

    // Section 2: Part / Drawing Information
    const [originalPartNoName, setOriginalPartNoName] = useState('');
    const [originalRevNo, setOriginalRevNo] = useState('Rev00');
    const [changedPartNoName, setChangedPartNoName] = useState('');
    const [changedRevNo, setChangedRevNo] = useState('Rev01');

    // Section 3: Reason & Description of Change
    const [reasonForChange, setReasonForChange] = useState('');
    const [descriptionOfChange, setDescriptionOfChange] = useState('');

    // Section 4: Affected Documents & Parts
    const [affectedPo, setAffectedPo] = useState(false);
    const [affectedPoDetails, setAffectedPoDetails] = useState('');
    const [affectedDrawing, setAffectedDrawing] = useState(false);
    const [affectedDrawingDetails, setAffectedDrawingDetails] = useState('');
    const [affectedBom, setAffectedBom] = useState(false);
    const [affectedBomDetails, setAffectedBomDetails] = useState('');
    const [affectedOther, setAffectedOther] = useState(false);
    const [affectedOtherDetails, setAffectedOtherDetails] = useState('');

    // Section 5: Team Member Info
    const [teamMemberName, setTeamMemberName] = useState(() => getLoggedUserName());
    const [teamMemberDate, setTeamMemberDate] = useState(getTodayDateString());

    // Section 6: Approval Requirements Checklist
    const [ecnFilledCompletely, setEcnFilledCompletely] = useState(true);
    const [originalDrawingAttached, setOriginalDrawingAttached] = useState(true);
    const [updatedDrawingAttached, setUpdatedDrawingAttached] = useState(true);
    const [dueDateUnderstood, setDueDateUnderstood] = useState(true);

    // Section 7: Execution Strategy
    const [executionOption, setExecutionOption] = useState('A'); // 'A', 'B', 'C', 'D'
    const [executionDetails, setExecutionDetails] = useState('');

    // Footer Signatures
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [reviewedBy, setReviewedBy] = useState('');
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('068');
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
                const targetPropId = propProposalId || selectedProposalId || urlProposalId;

                if (targetSubId) {
                    sub = await isoSubmissionService.getSubmissionById(targetSubId);
                } else if (targetPropId) {
                    // New ECN: compute next ECN number
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'ENGINEERING_CHANGE_NOTE' });
                    const count = Array.isArray(subs) ? subs.length : 0;
                    setEcnNo(`ECN-${String(count + 1).padStart(2, '0')}`);
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
                    if (fd.ecn_no) setEcnNo(fd.ecn_no);
                    if (fd.ecn_date) setEcnDate(fd.ecn_date);

                    if (fd.part_description) setPartDescription(fd.part_description);
                    if (fd.original_part_no_name) setOriginalPartNoName(fd.original_part_no_name);
                    if (fd.original_rev_no) setOriginalRevNo(fd.original_rev_no);
                    if (fd.changed_part_no_name) setChangedPartNoName(fd.changed_part_no_name);
                    if (fd.changed_rev_no) setChangedRevNo(fd.changed_rev_no);

                    if (fd.reason_for_change) setReasonForChange(fd.reason_for_change);
                    if (fd.description_of_change) setDescriptionOfChange(fd.description_of_change);

                    if (fd.affected_po !== undefined) setAffectedPo(Boolean(fd.affected_po));
                    if (fd.affected_po_details) setAffectedPoDetails(fd.affected_po_details);
                    if (fd.affected_drawing !== undefined) setAffectedDrawing(Boolean(fd.affected_drawing));
                    if (fd.affected_drawing_details) setAffectedDrawingDetails(fd.affected_drawing_details);
                    if (fd.affected_bom !== undefined) setAffectedBom(Boolean(fd.affected_bom));
                    if (fd.affected_bom_details) setAffectedBomDetails(fd.affected_bom_details);
                    if (fd.affected_other !== undefined) setAffectedOther(Boolean(fd.affected_other));
                    if (fd.affected_other_details) setAffectedOtherDetails(fd.affected_other_details);

                    if (fd.team_member_name) setTeamMemberName(fd.team_member_name);
                    if (fd.team_member_date) setTeamMemberDate(fd.team_member_date);

                    if (fd.ecn_filled_completely !== undefined) setEcnFilledCompletely(Boolean(fd.ecn_filled_completely));
                    if (fd.original_drawing_attached !== undefined) setOriginalDrawingAttached(Boolean(fd.original_drawing_attached));
                    if (fd.updated_drawing_attached !== undefined) setUpdatedDrawingAttached(Boolean(fd.updated_drawing_attached));
                    if (fd.due_date_understood !== undefined) setDueDateUnderstood(Boolean(fd.due_date_understood));

                    if (fd.execution_option) setExecutionOption(fd.execution_option);
                    if (fd.execution_details) setExecutionDetails(fd.execution_details);

                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.reviewed_by) setReviewedBy(fd.reviewed_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                } else {
                    // Fresh new ECN form
                    setSubmissionId(null);
                    submissionIdRef.current = null;
                    setStatus('DRAFT');
                    statusRef.current = 'DRAFT';
                    setPartDescription('');
                    setOriginalPartNoName('');
                    setOriginalRevNo('Rev00');
                    setChangedPartNoName('');
                    setChangedRevNo('Rev01');
                    setReasonForChange('');
                    setDescriptionOfChange('');
                    setAffectedPo(false);
                    setAffectedPoDetails('');
                    setAffectedDrawing(false);
                    setAffectedDrawingDetails('');
                    setAffectedBom(false);
                    setAffectedBomDetails('');
                    setAffectedOther(false);
                    setAffectedOtherDetails('');
                    setExecutionOption('A');
                    setExecutionDetails('');
                }
            } catch (err) {
                console.error('Failed to load Engineering Change Note submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId]);

    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        sub_system: subSystem,
        ecn_no: ecnNo,
        ecn_date: ecnDate,
        part_description: partDescription,
        original_part_no_name: originalPartNoName,
        original_rev_no: originalRevNo,
        changed_part_no_name: changedPartNoName,
        changed_rev_no: changedRevNo,
        reason_for_change: reasonForChange,
        description_of_change: descriptionOfChange,
        affected_po: affectedPo,
        affected_po_details: affectedPoDetails,
        affected_drawing: affectedDrawing,
        affected_drawing_details: affectedDrawingDetails,
        affected_bom: affectedBom,
        affected_bom_details: affectedBomDetails,
        affected_other: affectedOther,
        affected_other_details: affectedOtherDetails,
        team_member_name: teamMemberName,
        team_member_date: teamMemberDate,
        ecn_filled_completely: ecnFilledCompletely,
        original_drawing_attached: originalDrawingAttached,
        updated_drawing_attached: updatedDrawingAttached,
        due_date_understood: dueDateUnderstood,
        execution_option: executionOption,
        execution_details: executionDetails,
        prepared_by: preparedBy,
        reviewed_by: reviewedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        centre_dept: getLoggedUserCentreDept(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_Engineering_Change_Note_${ecnNo || projectNo || '068'}.docx`
    });

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/engineering-change-note/generate`, payload, {
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
                ecn_no: ecnNo,
                ecn_date: ecnDate,
                part_description: partDescription,
                original_part_no_name: originalPartNoName,
                original_rev_no: originalRevNo,
                changed_part_no_name: changedPartNoName,
                changed_rev_no: changedRevNo,
                reason_for_change: reasonForChange,
                description_of_change: descriptionOfChange,
                affected_po: affectedPo,
                affected_po_details: affectedPoDetails,
                affected_drawing: affectedDrawing,
                affected_drawing_details: affectedDrawingDetails,
                affected_bom: affectedBom,
                affected_bom_details: affectedBomDetails,
                affected_other: affectedOther,
                affected_other_details: affectedOtherDetails,
                team_member_name: teamMemberName,
                team_member_date: teamMemberDate,
                ecn_filled_completely: ecnFilledCompletely,
                original_drawing_attached: originalDrawingAttached,
                updated_drawing_attached: updatedDrawingAttached,
                due_date_understood: dueDateUnderstood,
                execution_option: executionOption,
                execution_details: executionDetails,
                prepared_by: preparedBy,
                reviewed_by: reviewedBy,
                approved_by: approvedBy,
                doc_no: docNo,
                doc_date: docDate
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'ENGINEERING_CHANGE_NOTE',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Engineering Change Note',
                document_no: docNo || '068',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: getLoggedUserCentreDept(),
                    doc_no: docNo,
                    doc_date: docDate
                },
                footer_data: {
                    prepared_by: preparedBy,
                    reviewed_by: reviewedBy,
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
            console.error('ECN Auto-save failed:', err);
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
        ecnNo,
        ecnDate,
        partDescription,
        originalPartNoName,
        originalRevNo,
        changedPartNoName,
        changedRevNo,
        reasonForChange,
        descriptionOfChange,
        affectedPo,
        affectedPoDetails,
        affectedDrawing,
        affectedDrawingDetails,
        affectedBom,
        affectedBomDetails,
        affectedOther,
        affectedOtherDetails,
        teamMemberName,
        teamMemberDate,
        ecnFilledCompletely,
        originalDrawingAttached,
        updatedDrawingAttached,
        dueDateUnderstood,
        executionOption,
        executionDetails,
        preparedBy,
        reviewedBy,
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
        ecnNo,
        ecnDate,
        partDescription,
        originalPartNoName,
        originalRevNo,
        changedPartNoName,
        changedRevNo,
        reasonForChange,
        descriptionOfChange,
        affectedPo,
        affectedPoDetails,
        affectedDrawing,
        affectedDrawingDetails,
        affectedBom,
        affectedBomDetails,
        affectedOther,
        affectedOtherDetails,
        teamMemberName,
        teamMemberDate,
        ecnFilledCompletely,
        originalDrawingAttached,
        updatedDrawingAttached,
        dueDateUnderstood,
        executionOption,
        executionDetails,
        preparedBy,
        reviewedBy,
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
                ecn_no: ecnNo,
                ecn_date: ecnDate,
                part_description: partDescription,
                original_part_no_name: originalPartNoName,
                original_rev_no: originalRevNo,
                changed_part_no_name: changedPartNoName,
                changed_rev_no: changedRevNo,
                reason_for_change: reasonForChange,
                description_of_change: descriptionOfChange,
                affected_po: affectedPo,
                affected_po_details: affectedPoDetails,
                affected_drawing: affectedDrawing,
                affected_drawing_details: affectedDrawingDetails,
                affected_bom: affectedBom,
                affected_bom_details: affectedBomDetails,
                affected_other: affectedOther,
                affected_other_details: affectedOtherDetails,
                team_member_name: teamMemberName,
                team_member_date: teamMemberDate,
                ecn_filled_completely: ecnFilledCompletely,
                original_drawing_attached: originalDrawingAttached,
                updated_drawing_attached: updatedDrawingAttached,
                due_date_understood: dueDateUnderstood,
                execution_option: executionOption,
                execution_details: executionDetails,
                prepared_by: preparedBy,
                reviewed_by: reviewedBy,
                approved_by: approvedBy,
                doc_no: docNo,
                doc_date: docDate
            };

            const subPayload = {
                proposal_id: selectedProposalId ? parseInt(selectedProposalId, 10) : (docInfo?.proposal_id || null),
                doc_type: 'ENGINEERING_CHANGE_NOTE',
                document_id: docInfo?.document_id || docInfo?.doc_id || null,
                document_name: docInfo?.document_name || 'Engineering Change Note',
                document_no: docNo || '068',
                form_data: payloadData,
                header_data: {
                    group: getLoggedUserGroup(),
                    centre_dept: getLoggedUserCentreDept(),
                    doc_no: docNo,
                    doc_date: docDate
                },
                footer_data: {
                    prepared_by: preparedBy,
                    reviewed_by: reviewedBy,
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
            alert('Engineering Change Note submitted for approval successfully!');
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
            <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
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
                            <h1 className="text-lg font-bold text-slate-800">Engineering Change Note (ECN)</h1>
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
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 space-y-6">

                {/* ISO Official Header */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                    <div className="grid grid-cols-12 divide-x divide-slate-300">
                        <div className="col-span-3 p-4 flex items-center justify-center bg-slate-50">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-16 object-contain" />
                        </div>

                        <div className="col-span-6 p-4 flex flex-col items-center justify-center text-center">
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Central Manufacturing Technology Institute
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium">ISO 9001-2015</p>
                            <div className="w-full border-t border-slate-200 my-2"></div>
                            <h3 className="text-base font-extrabold text-slate-900 tracking-wide">
                                ENGINEERING CHANGE NOTE
                            </h3>
                        </div>

                        <div className="col-span-3 p-3 flex flex-col justify-center text-xs space-y-1.5 bg-slate-50">
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
                                <span className="text-slate-500 font-medium">ECN No: </span>
                                <input
                                    type="text"
                                    value={ecnNo}
                                    onChange={(e) => setEcnNo(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="e.g. ECN-01"
                                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                                />
                            </div>
                            <div className="border-t border-slate-200 pt-1">
                                <span className="text-slate-500 font-medium">Dated: </span>
                                <input
                                    type="text"
                                    value={ecnDate}
                                    onChange={(e) => setEcnDate(e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0"
                                />
                            </div>
                            <div className="border-t border-slate-200 pt-1 flex justify-between">
                                <span className="text-slate-500 font-medium">Page:</span>
                                <span className="font-bold text-slate-800">1 of 1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project Metadata Card */}
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
                            placeholder="e.g. Spindle Unit"
                            className="w-full font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {/* Section 1: Part Description */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Part Description
                    </label>
                    <textarea
                        rows={2}
                        value={partDescription}
                        onChange={(e) => setPartDescription(e.target.value)}
                        disabled={isReadOnly}
                        placeholder="Enter the component or part description being changed..."
                        className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
                    />
                </div>

                {/* Section 2: Original & Changed Part Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Original Part */}
                    <div className="space-y-3 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                        <h4 className="text-xs font-bold text-slate-700 border-b pb-1">Original Part / Drawing</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Original Part/Drawing Name/No</label>
                            <input
                                type="text"
                                value={originalPartNoName}
                                onChange={(e) => setOriginalPartNoName(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. DWG-001 / Housing Base"
                                className="w-full text-xs text-slate-800 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Revision No.</label>
                            <input
                                type="text"
                                value={originalRevNo}
                                onChange={(e) => setOriginalRevNo(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Rev00"
                                className="w-full text-xs text-slate-800 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                        </div>
                    </div>

                    {/* Changed Part */}
                    <div className="space-y-3 p-3 bg-white rounded-lg border border-indigo-200 shadow-2xs">
                        <h4 className="text-xs font-bold text-indigo-700 border-b pb-1">Changed Part / Drawing</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Changed Part/Drawing Name/No</label>
                            <input
                                type="text"
                                value={changedPartNoName}
                                onChange={(e) => setChangedPartNoName(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. DWG-001-A / Modified Housing Base"
                                className="w-full text-xs text-slate-800 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Revision No.</label>
                            <input
                                type="text"
                                value={changedRevNo}
                                onChange={(e) => setChangedRevNo(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Rev01"
                                className="w-full text-xs text-slate-800 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Reason & Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Reason for Change
                        </label>
                        <textarea
                            rows={4}
                            value={reasonForChange}
                            onChange={(e) => setReasonForChange(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Specify why the engineering change is required (e.g. design improvement, material availability, interference)..."
                            className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Description of Change
                        </label>
                        <textarea
                            rows={4}
                            value={descriptionOfChange}
                            onChange={(e) => setDescriptionOfChange(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Describe in detail what dimensions, tolerances, materials, or features were modified..."
                            className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-xl p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
                        />
                    </div>
                </div>

                {/* Section 4: Affected Documents & Parts */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Affected Documents & Parts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Purchase Orders */}
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                            <input
                                type="checkbox"
                                checked={affectedPo}
                                onChange={(e) => setAffectedPo(e.target.checked)}
                                disabled={isReadOnly}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                                <span className="text-xs font-bold text-slate-700">Purchase Order(s)</span>
                                <input
                                    type="text"
                                    value={affectedPoDetails}
                                    onChange={(e) => setAffectedPoDetails(e.target.value)}
                                    disabled={isReadOnly || !affectedPo}
                                    placeholder="PO numbers / Vendors..."
                                    className="w-full text-xs text-slate-800 border border-slate-200 rounded px-2 py-1 outline-none disabled:bg-slate-50"
                                />
                            </div>
                        </div>

                        {/* Assembly Drawings */}
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                            <input
                                type="checkbox"
                                checked={affectedDrawing}
                                onChange={(e) => setAffectedDrawing(e.target.checked)}
                                disabled={isReadOnly}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                                <span className="text-xs font-bold text-slate-700">Assembly Drawing(s)</span>
                                <input
                                    type="text"
                                    value={affectedDrawingDetails}
                                    onChange={(e) => setAffectedDrawingDetails(e.target.value)}
                                    disabled={isReadOnly || !affectedDrawing}
                                    placeholder="Drawing numbers / Assemblies..."
                                    className="w-full text-xs text-slate-800 border border-slate-200 rounded px-2 py-1 outline-none disabled:bg-slate-50"
                                />
                            </div>
                        </div>

                        {/* BOM */}
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                            <input
                                type="checkbox"
                                checked={affectedBom}
                                onChange={(e) => setAffectedBom(e.target.checked)}
                                disabled={isReadOnly}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                                <span className="text-xs font-bold text-slate-700">Bill of Materials (BOM)</span>
                                <input
                                    type="text"
                                    value={affectedBomDetails}
                                    onChange={(e) => setAffectedBomDetails(e.target.value)}
                                    disabled={isReadOnly || !affectedBom}
                                    placeholder="BOM modules / Line items..."
                                    className="w-full text-xs text-slate-800 border border-slate-200 rounded px-2 py-1 outline-none disabled:bg-slate-50"
                                />
                            </div>
                        </div>

                        {/* Other Parts */}
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                            <input
                                type="checkbox"
                                checked={affectedOther}
                                onChange={(e) => setAffectedOther(e.target.checked)}
                                disabled={isReadOnly}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1">
                                <span className="text-xs font-bold text-slate-700">Other Parts (List names)</span>
                                <input
                                    type="text"
                                    value={affectedOtherDetails}
                                    onChange={(e) => setAffectedOtherDetails(e.target.value)}
                                    disabled={isReadOnly || !affectedOther}
                                    placeholder="Interfacing parts / Mate components..."
                                    className="w-full text-xs text-slate-800 border border-slate-200 rounded px-2 py-1 outline-none disabled:bg-slate-50"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 5 & 6: Approval Requirements & Execution Strategy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Requirements Review */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Approval Requirements
                        </h3>
                        <div className="space-y-2 text-xs">
                            {[
                                { label: 'Is the ECN filled out completely?', val: ecnFilledCompletely, setter: setEcnFilledCompletely },
                                { label: 'Is the original drawing attached?', val: originalDrawingAttached, setter: setOriginalDrawingAttached },
                                { label: 'Is the updated drawing attached?', val: updatedDrawingAttached, setter: setUpdatedDrawingAttached },
                                { label: 'Is the due date understood by the team?', val: dueDateUnderstood, setter: setDueDateUnderstood },
                            ].map((q, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                    <span className="font-medium text-slate-700">{q.label}</span>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1 cursor-pointer font-bold text-emerald-700">
                                            <input
                                                type="radio"
                                                name={`req_${idx}`}
                                                checked={q.val === true}
                                                onChange={() => !isReadOnly && q.setter(true)}
                                                disabled={isReadOnly}
                                                className="text-emerald-600"
                                            />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-400">
                                            <input
                                                type="radio"
                                                name={`req_${idx}`}
                                                checked={q.val === false}
                                                onChange={() => !isReadOnly && q.setter(false)}
                                                disabled={isReadOnly}
                                                className="text-rose-600"
                                            />
                                            No
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Execution Strategy */}
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Execution Strategy
                        </h3>
                        <div className="space-y-2 text-xs">
                            {[
                                { key: 'A', label: 'A – Modify existing part' },
                                { key: 'B', label: 'B – Create new part' },
                                { key: 'C', label: 'C – Scrap existing part (if manufacturing already commenced)' },
                                { key: 'D', label: 'D – Delete existing part (if manufacturing hasn’t commenced)' },
                            ].map((opt) => (
                                <label
                                    key={opt.key}
                                    className={`flex items-start gap-2 p-2.5 rounded-lg border transition cursor-pointer ${
                                        executionOption === opt.key
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                                            : 'bg-white border-slate-200 text-slate-700 font-medium hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="execution_strategy"
                                        value={opt.key}
                                        checked={executionOption === opt.key}
                                        onChange={() => !isReadOnly && setExecutionOption(opt.key)}
                                        disabled={isReadOnly}
                                        className="mt-0.5 text-indigo-600"
                                    />
                                    <span>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                        <div>
                            <input
                                type="text"
                                value={executionDetails}
                                onChange={(e) => setExecutionDetails(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Additional execution instructions / notes..."
                                className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Signatures */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Prepared By</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Team Member Name</label>
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
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reviewed By</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Project Coordinator</label>
                            <input
                                type="text"
                                value={reviewedBy}
                                onChange={(e) => setReviewedBy(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Project Coordinator Name"
                                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Approved By</h4>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Group Head / Centre Head</label>
                            <input
                                type="text"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="GH / CH Name"
                                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
