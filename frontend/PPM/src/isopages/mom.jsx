import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserCentreDept } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const getLoggedUserGroup = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
        if (!rawUser) return '';
        const parsedUser = JSON.parse(rawUser);
        return (parsedUser.group || '').trim().toUpperCase();
    } catch (e) {
        return '';
    }
};

const getDefaultRevisionCode = (docCode) => {
    const group = getLoggedUserGroup();
    const groupStr = group ? group : '      ';
    return `CMTI-QMS-${groupStr}-${docCode}/Rev00`;
};

const DEFAULT_SUMMARY_POINTS = [
    { sl_no: 1, points_discussed: '', responsibility: '' }
];

export default function Mom({ proposalId: propProposalId, submissionId: propSubmissionId, onBack, docInfo }) {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');

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

    const [filename, setFilename] = useState('CMTI_Minutes_of_Meeting.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('037'));
    const [docNo, setDocNo] = useState('037');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');

    // Meeting Details State
    const [meetingDateTime, setMeetingDateTime] = useState('');
    const [meetingLocation, setMeetingLocation] = useState('');
    const [prevMomNoDate, setPrevMomNoDate] = useState('-');
    const [prevActionPoints, setPrevActionPoints] = useState('-');
    const [prevStatus, setPrevStatus] = useState('-');
    const [agenda, setAgenda] = useState('Project kick off meeting');
    const [summaryPoints, setSummaryPoints] = useState(() => [
        { sl_no: 1, points_discussed: '', responsibility: getLoggedUserName() }
    ]);
    const [conclusion, setConclusion] = useState('');

    // Fetch dynamic doc number / code from docInfo or /iso-document-list/
    useEffect(() => {
        async function fetchDocDetails() {
            try {
                if (docInfo && (docInfo.document_no || docInfo.code)) {
                    const rawDocNo = (docInfo.document_no || '037').trim();
                    const cleanDocNo = rawDocNo.padStart(3, '0');
                    setDocNo(cleanDocNo);
                    const group = getLoggedUserGroup() || '      ';
                    setRevisionCode(`CMTI-QMS-${group}-${cleanDocNo}/Rev00`);
                    return;
                }
                const res = await axios.get(`${API_BASE_URL}/iso-document-list/`);
                if (Array.isArray(res.data)) {
                    const matched = res.data.find(d => 
                        (d.document_no && (d.document_no.trim() === '037' || d.document_no.trim() === '37')) ||
                        (d.name && (d.name.toLowerCase().includes('minutes') || d.name.toLowerCase().includes('mom')))
                    );
                    if (matched) {
                        const rawDocNo = (matched.document_no || '037').trim();
                        const cleanDocNo = rawDocNo.padStart(3, '0');
                        setDocNo(cleanDocNo);
                        const group = getLoggedUserGroup() || '      ';
                        setRevisionCode(`CMTI-QMS-${group}-${cleanDocNo}/Rev00`);
                    }
                }
            } catch (err) {
                console.error('Failed to load ISO doc details for MOM:', err);
            }
        }
        fetchDocDetails();
    }, [docInfo]);

    // Fetch existing submission if submissionId or proposalId is present
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('id') || searchParams.get('submission_id');
        const urlPropId = propProposalId || searchParams.get('proposal_id');

        if (urlPropId) setSelectedProposalId(String(urlPropId));

        async function loadSubmission() {
            try {
                let rec = null;
                if (urlId) {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) rec = res.data;
                } else if (urlPropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: urlPropId, doc_type: 'MOM' });
                    if (Array.isArray(subs) && subs.length > 0) rec = subs[0];
                }

                if (rec) {
                    setSubmissionId(rec.id);
                    submissionIdRef.current = rec.id;
                    setStatus(rec.status || 'DRAFT');
                    statusRef.current = rec.status || 'DRAFT';

                    const hData = rec.header_data || {};
                    const fData = rec.form_data || {};

                    if (rec.proposal_id) setSelectedProposalId(String(rec.proposal_id));
                    if (rec.document_no) setDocNo(rec.document_no);

                    if (hData.docNo) setDocNo(hData.docNo);
                    if (hData.dateStr) setDocDate(hData.dateStr);
                    const loadedPreparedBy = fData.prepared_by || hData.preparedName || getLoggedUserName();
                    if (hData.preparedName) setPreparedBy(hData.preparedName);
                    if (hData.approvedName) setApprovedBy(hData.approvedName);
                    if (hData.groupName) setRevisionCode(hData.groupName);

                    if (fData.meeting_date_time) setMeetingDateTime(fData.meeting_date_time);
                    if (fData.meeting_location) setMeetingLocation(fData.meeting_location);
                    if (fData.prev_mom_no_date) setPrevMomNoDate(fData.prev_mom_no_date);
                    if (fData.prev_action_points) setPrevActionPoints(fData.prev_action_points);
                    if (fData.prev_status) setPrevStatus(fData.prev_status);
                    if (fData.agenda) setAgenda(fData.agenda);
                    if (fData.conclusion) setConclusion(fData.conclusion);
                    if (fData.prepared_by) setPreparedBy(fData.prepared_by);
                    if (fData.approved_by) setApprovedBy(fData.approved_by);

                    if (Array.isArray(fData.summary_points) && fData.summary_points.length > 0) {
                        const mappedPoints = fData.summary_points.map(pt => ({
                            ...pt,
                            responsibility: (pt.responsibility !== undefined && pt.responsibility !== null && String(pt.responsibility).trim() !== '')
                                ? pt.responsibility
                                : loadedPreparedBy
                        }));
                        setSummaryPoints(mappedPoints);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch existing ISO submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        }
        loadSubmission();
    }, [propSubmissionId, propProposalId]);

    const currentUserRole = (() => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            return rawUser ? (JSON.parse(rawUser)?.role || '').toLowerCase().trim() : '';
        } catch (e) { return ''; }
    })();
    const isAdmin = ['admin', 'director'].includes(currentUserRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin', 'dh'].includes(currentUserRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

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

            const headerData = {
                documentTitle: 'MINUTES OF MEETING',
                docNo: docNo || '037',
                code: revisionCode,
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || '',
                groupName: revisionCode,
                preparedName: preparedBy || getLoggedUserName(),
                approvedName: approvedBy || '',
            };

            const formData = {
                meeting_date_time: meetingDateTime,
                meeting_location: meetingLocation,
                prev_mom_no_date: prevMomNoDate,
                prev_action_points: prevActionPoints,
                prev_status: prevStatus,
                agenda: agenda,
                summary_points: summaryPoints,
                conclusion: conclusion,
                prepared_by: preparedBy || getLoggedUserName(),
                approved_by: approvedBy || '',
            };

            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

            const payload = {
                doc_type: 'MOM',
                document_no: docNo || '037',
                proposal_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                header_data: headerData,
                form_data: formData,
                status: currentDocStatus,
                created_by: userId,
            };

            let response;
            if (submissionIdRef.current) {
                response = await isoSubmissionService.updateSubmission(submissionIdRef.current, payload);
            } else {
                response = await isoSubmissionService.createSubmission(payload);
                if (response && response.id) {
                    setSubmissionId(response.id);
                    submissionIdRef.current = response.id;
                }
            }

            setAutoSaveState('saved');
            setLastSavedAt(new Date());
        } catch (err) {
            console.error('Auto-save error in MOM:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, docNo, revisionCode, docDate, loggedCentreDept, preparedBy, approvedBy, meetingDateTime, meetingLocation, prevMomNoDate, prevActionPoints, prevStatus, agenda, summaryPoints, conclusion, selectedProposalId]);

    // Debounced Auto-Save
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const timer = setTimeout(() => { performAutoSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [meetingDateTime, meetingLocation, prevMomNoDate, prevActionPoints, prevStatus, agenda, summaryPoints, conclusion, preparedBy, approvedBy, docNo, docDate, selectedProposalId, performAutoSave, isReadOnly]);

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

    // Add / remove summary points
    const addPointRow = () => {
        setSummaryPoints(prev => [
            ...prev,
            { sl_no: prev.length + 1, points_discussed: '', responsibility: preparedBy || getLoggedUserName() }
        ]);
    };

    const removePointRow = (index) => {
        setSummaryPoints(prev => prev.filter((_, idx) => idx !== index).map((pt, i) => ({ ...pt, sl_no: i + 1 })));
    };

    const updatePointRow = (index, field, value) => {
        setSummaryPoints(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Save draft or submit form
    const handleSaveSubmission = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const headerData = {
                documentTitle: 'MINUTES OF MEETING',
                docNo: docNo || '037',
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || '',
                preparedName: preparedBy || getLoggedUserName(),
                approvedName: approvedBy,
                groupName: revisionCode,
            };

            const formData = {
                meeting_date_time: meetingDateTime,
                meeting_location: meetingLocation,
                prev_mom_no_date: prevMomNoDate,
                prev_action_points: prevActionPoints,
                prev_status: prevStatus,
                agenda: agenda,
                summary_points: summaryPoints,
                conclusion: conclusion,
                prepared_by: preparedBy || getLoggedUserName(),
                approved_by: approvedBy
            };

            const payload = {
                doc_type: 'MOM',
                document_no: docNo || '037',
                proposal_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                header_data: headerData,
                form_data: formData,
                status: targetStatus,
                created_by: userId,
            };

            let response;
            if (submissionId) {
                response = await isoSubmissionService.updateSubmission(submissionId, payload);
            } else {
                response = await isoSubmissionService.createSubmission(payload);
                if (response && response.id) {
                    setSubmissionId(response.id);
                }
            }

            setStatus(targetStatus);
            alert(`Minutes of Meeting ${targetStatus === 'SUBMITTED' ? 'submitted' : 'saved as draft'} successfully!`);
        } catch (err) {
            console.error('Failed to save submission:', err);
            alert(`Error: ${err.response?.data?.detail || 'Failed to save form.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Approval / Rejection handlers for CH / GH / Admin
    const handleFormStatusUpdate = async (newStatus) => {
        if (!submissionId) return;
        let rejectComment = null;
        if (newStatus === 'REJECTED') {
            rejectComment = prompt('Please enter the reason for rejection:');
            if (!rejectComment) return;
        }

        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const userId = rawUser ? JSON.parse(rawUser)?.id : null;
            const currentApproverName = getLoggedUserName();

            if (newStatus === 'APPROVED' && currentApproverName) {
                setApprovedBy(currentApproverName);
                await isoSubmissionService.updateSubmission(submissionId, {
                    form_data: {
                        meeting_date_time: meetingDateTime,
                        meeting_location: meetingLocation,
                        prev_mom_no_date: prevMomNoDate,
                        prev_action_points: prevActionPoints,
                        prev_status: prevStatus,
                        agenda: agenda,
                        summary_points: summaryPoints,
                        conclusion: conclusion,
                        prepared_by: preparedBy || getLoggedUserName(),
                        approved_by: currentApproverName
                    },
                    header_data: {
                        docNo: docNo,
                        dateStr: docDate,
                        centreDept: loggedCentreDept,
                        preparedName: preparedBy || getLoggedUserName(),
                        approvedName: currentApproverName
                    }
                });
            }

            await isoSubmissionService.updateStatus(submissionId, newStatus, rejectComment, userId);
            setStatus(newStatus);
            alert(`ISO Document marked as ${newStatus} successfully!`);
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status.');
        } finally {
            setSubmitting(false);
        }
    };

    // Word Export
    const handleGenerate = async () => {
        setGenerating(true);
        try {
            if (submissionId) {
                await isoSubmissionService.exportWord(submissionId, filename);
            } else {
                const reqData = {
                    project_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                    meeting_date_time: meetingDateTime,
                    meeting_location: meetingLocation,
                    prev_mom_no_date: prevMomNoDate,
                    prev_action_points: prevActionPoints,
                    prev_status: prevStatus,
                    agenda: agenda,
                    summary_points: summaryPoints,
                    conclusion: conclusion,
                    centre_dept: loggedCentreDept,
                    group_name: revisionCode,
                    doc_no: docNo || '037/001',
                    doc_date: docDate,
                    prepared_by: preparedBy || getLoggedUserName(),
                    approved_by: approvedBy,
                    filename: filename
                };

                const res = await axios.post(`${API_BASE_URL}/iso/mom/generate-word`, reqData, {
                    responseType: 'blob',
                });
                const blob = new Blob([res.data], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename.endsWith('.docx') ? filename : `${filename}.docx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Error generating document:', err);
            alert('Failed to generate document.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Status Alert Banners */}
            {isApproved && (
                <div className="w-full max-w-4xl bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>🔒 ISO Document APPROVED. Document is officially locked against edits.</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono uppercase">APPROVED</span>
                </div>
            )}
            {isSubmitted && !isApproved && (
                <div className="w-full max-w-4xl bg-indigo-50 border border-indigo-300 text-indigo-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>📋 Review Mode: ISO Document Submitted by Scientist. Read-Only View for CH/GH.</span>
                    <span className="text-[10px] bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded font-mono uppercase">SUBMITTED</span>
                </div>
            )}

            {/* Navigation & Action Bar */}
            <div className="w-full max-w-4xl flex items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={async () => {
                            if (isHydratedRef.current && !isReadOnly) {
                                await performAutoSave();
                            }
                            if (onBack) onBack();
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                        title="Back to ISO Documents (Auto-saves draft)"
                    >
                        <ArrowLeftOutlined /> Back to ISO Documents
                    </button>
                    <span className="text-sm font-bold text-slate-800 border-l border-slate-200 pl-3">
                        Minutes of Meeting (Doc No: 037)
                    </span>

                    {/* Auto-Save Draft Status Badge */}
                    <div className="ml-1">
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

                <div className="flex items-center gap-2.5">
                    {!isReadOnly && !isApprover && (
                        <button
                            onClick={() => handleSaveSubmission('SUBMITTED')}
                            disabled={submitting}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/10"
                        >
                            {submitting ? 'Submitting...' : <><CheckOutlined /> Submit Form</>}
                        </button>
                    )}

                    {isApprover && isSubmitted && (
                        <>
                            <button
                                onClick={() => handleFormStatusUpdate('APPROVED')}
                                disabled={submitting}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all"
                            >
                                <CheckOutlined /> Approve Document
                            </button>
                            <button
                                onClick={() => handleFormStatusUpdate('REJECTED')}
                                disabled={submitting}
                                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all"
                            >
                                <CloseOutlined /> Reject Document
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all"
                    >
                        {generating ? 'Generating...' : <><DownloadOutlined /> Download Word</>}
                    </button>
                </div>
            </div>

            {/* Simulated Word A4 Document Canvas */}
            <div className="w-full max-w-[21cm] bg-white shadow-2xl border border-slate-200 p-[1.5cm] flex flex-col font-sans text-slate-800 text-xs leading-relaxed min-h-[29.7cm]">

                {/* 1. Header Table */}
                <table className="w-full border-collapse border border-slate-800 text-center mb-6">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2 w-[18%] align-middle" rowSpan={3}>
                                <img src={cmtiLogo} alt="CMTI Logo" className="h-12 mx-auto object-contain" />
                            </td>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-xs uppercase" rowSpan={2}>
                                Central Manufacturing Technology Institute<br />
                                <span className="text-[10px] font-medium tracking-normal text-slate-600">Tumkur Road, Bengaluru - 560022</span>
                            </td>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] w-[28%] font-semibold">
                                CENTRE / DEPT: <span className="font-normal text-indigo-600">{loggedCentreDept || '--'}</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] font-semibold">
                                Doc. No: {isReadOnly ? (
                                    <span className="font-bold text-slate-900 px-1">{docNo || '037/001'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={docNo}
                                        onChange={(e) => setDocNo(e.target.value)}
                                        placeholder="037/001"
                                        className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-28 px-1 py-0 text-[9px] font-normal text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-sm bg-slate-50 uppercase tracking-wider text-slate-900 border-t border-slate-800">
                                MINUTES OF MEETING
                            </td>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] font-semibold">
                                Date: {isReadOnly ? (
                                    <span className="font-bold text-slate-900 px-1">{docDate || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={docDate}
                                        onChange={(e) => setDocDate(e.target.value)}
                                        className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-20 px-1 py-0 text-[9px] font-normal text-slate-800"
                                    />
                                )}<br />
                                Page: <span className="font-normal text-slate-600">1 of 1</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. Meeting Date/Time & Location Table */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-4">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2.5 w-[25%] font-bold bg-slate-50/50">Meeting Date and time</td>
                            <td className="border border-slate-800 p-2 w-[25%]">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{meetingDateTime || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={meetingDateTime}
                                        onChange={(e) => setMeetingDateTime(e.target.value)}
                                        placeholder="Click to enter Date & time..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded font-medium text-slate-800"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2.5 w-[25%] font-bold bg-slate-50/50">Meeting Location</td>
                            <td className="border border-slate-800 p-2 w-[25%]">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{meetingLocation || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={meetingLocation}
                                        onChange={(e) => setMeetingLocation(e.target.value)}
                                        placeholder="Click to enter Location..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded font-medium text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 3. Previous Meeting MOM Table */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-4 text-center">
                    <thead>
                        <tr className="bg-slate-50 font-bold">
                            <th className="border border-slate-800 p-2 w-[35%]">Previous Meeting MOM<br />Number with Date</th>
                            <th className="border border-slate-800 p-2 w-[35%]">Action Points</th>
                            <th className="border border-slate-800 p-2 w-[30%]">Status<br /><span className="text-[10px] font-normal text-slate-500">(Closed/Open with Justification)</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{prevMomNoDate || '-'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={prevMomNoDate}
                                        onChange={(e) => setPrevMomNoDate(e.target.value)}
                                        placeholder="-"
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center text-slate-800"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{prevActionPoints || '-'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={prevActionPoints}
                                        onChange={(e) => setPrevActionPoints(e.target.value)}
                                        placeholder="-"
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center text-slate-800"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{prevStatus || '-'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={prevStatus}
                                        onChange={(e) => setPrevStatus(e.target.value)}
                                        placeholder="-"
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 4. Agenda Block */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-4">
                    <thead>
                        <tr className="bg-slate-50 font-bold text-center">
                            <th className="border border-slate-800 p-2">Agenda</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-3 text-center">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{agenda || 'Project kick off meeting'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={agenda}
                                        onChange={(e) => setAgenda(e.target.value)}
                                        placeholder="Enter agenda..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center font-semibold text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 5. Summary Of the Meeting Table */}
                <div className="mb-4">
                    <table className="w-full border-collapse border border-slate-800 text-xs">
                        <thead>
                            <tr className="bg-slate-50 font-bold text-center">
                                <th className="border border-slate-800 p-2" colSpan={3}>Summary Of the Meeting</th>
                            </tr>
                            <tr className="bg-slate-900 text-white font-bold text-center">
                                <th className="border border-slate-800 p-2 w-[8%]">Sl No</th>
                                <th className="border border-slate-800 p-2 w-[60%]">Points Discussed</th>
                                <th className="border border-slate-800 p-2 w-[22%]">Responsibility</th>
                                {!isReadOnly && <th className="border border-slate-800 p-2 w-[10%]">Action</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {summaryPoints.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="border border-slate-800 p-2 text-center font-semibold text-slate-600">{idx + 1}</td>
                                    <td className="border border-slate-800 p-2">
                                        {isReadOnly ? (
                                            <span className="font-medium text-slate-900">{row.points_discussed ? `• ${row.points_discussed}` : ''}</span>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 font-bold">•</span>
                                                <input
                                                    type="text"
                                                    value={row.points_discussed}
                                                    onChange={(e) => updatePointRow(idx, 'points_discussed', e.target.value)}
                                                    placeholder="Point discussed..."
                                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded font-medium text-slate-800"
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className="border border-slate-800 p-2">
                                        {isReadOnly ? (
                                            <span className="font-semibold text-slate-900">{row.responsibility || '--'}</span>
                                        ) : (
                                            <input
                                                type="text"
                                                value={row.responsibility ?? ''}
                                                onChange={(e) => updatePointRow(idx, 'responsibility', e.target.value)}
                                                placeholder="Responsibility..."
                                                className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded font-medium text-slate-800 text-center"
                                            />
                                        )}
                                    </td>
                                    {!isReadOnly && (
                                        <td className="border border-slate-800 p-1 text-center">
                                            <button
                                                onClick={() => removePointRow(idx)}
                                                className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors"
                                                title="Remove Point"
                                            >
                                                <DeleteOutlined />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>

                    </table>
                    {!isReadOnly && (
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={addPointRow}
                                className="flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 font-semibold px-2.5 py-1 rounded-lg transition-all border border-slate-200"
                            >
                                <PlusOutlined /> Add Point
                            </button>
                        </div>
                    )}
                </div>

                {/* 6. Conclusion Block */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <thead>
                        <tr className="bg-slate-50 font-bold italic text-left">
                            <th className="border border-slate-800 p-2 uppercase">CONCLUSION</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-3 text-center">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{conclusion || '--'}</span>
                                ) : (
                                    <textarea
                                        value={conclusion}
                                        onChange={(e) => setConclusion(e.target.value)}
                                        placeholder="Enter conclusion..."
                                        rows={2}
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded font-medium text-slate-800 resize-none text-center"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 7. Signatory Footer Table */}
                <table className="w-full border-collapse border border-slate-800 text-xs mt-auto">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-3 w-[50%] align-top">
                                <div className="font-bold mb-6">Prepared by:</div>
                                {isReadOnly ? (
                                    <div className="font-semibold text-slate-900">{preparedBy || '--'}</div>
                                ) : (
                                    <input
                                        type="text"
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                        placeholder="Type prepared by name..."
                                        className="w-full bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none p-1 font-medium text-slate-800"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-3 w-[50%] align-top">
                                <div className="font-bold mb-6">Approved By:</div>
                                {isReadOnly ? (
                                    <div className="font-semibold text-slate-900">{approvedBy || '--'}</div>
                                ) : (
                                    <input
                                        type="text"
                                        value={approvedBy}
                                        onChange={(e) => setApprovedBy(e.target.value)}
                                        placeholder="Type approved by name..."
                                        className="w-full bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none p-1 font-medium text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="text-[10px] text-slate-600 font-bold italic flex items-center gap-1.5 mt-3 self-start w-full">
                    <span className="whitespace-nowrap">Document Code:</span>
                    {isReadOnly ? (
                        <span className="font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded">{revisionCode || '--'}</span>
                    ) : (
                        <input
                            type="text"
                            value={revisionCode}
                            onChange={(e) => setRevisionCode(e.target.value)}
                            className="w-64 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[10px] font-bold text-slate-800 focus:bg-white outline-none"
                        />
                    )}
                </div>

            </div>
        </div>
    );
}
