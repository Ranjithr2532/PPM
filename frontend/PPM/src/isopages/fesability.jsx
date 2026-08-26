import React, { useState, useEffect, useCallback } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined

} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';



const normalizeCentreDept = (centre) => {
    if (!centre) return '';
    const raw = String(centre).trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    return upper.startsWith('C-') ? upper : `C-${raw}`.toUpperCase();
};

const getLoggedUserCentreDept = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
        if (!rawUser) return '';
        const parsedUser = JSON.parse(rawUser);
        const center = (parsedUser.center || parsedUser.centre || '').trim();
        const group = (parsedUser.group || '').trim();
        let combined = '';
        if (group && center) {
            combined = `${center}/${group}`;
        } else {
            combined = group || center || '';
        }
        return normalizeCentreDept(combined);
    } catch (e) {
        return '';
    }
};

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

const REVIEW_POINTS_TEMPLATES = [
    {
        sl_no: 1,
        point: "Compliance of all technical requirements?",
        key_resp: "r1_response",
        key_det: "r1_details",
    },
    {
        sl_no: 2,
        point: "Delivery and Post Delivery activity compliance",
        key_resp: "r2_response",
        key_det: "r2_details",
    },
    {
        sl_no: 3,
        point: "Any other requirements not stated in the enquiry, but necessary in the intended use. Eg : Item has be flame proof, Item has to be used in different sites etc. Please mention in details",
        key_resp: "r3_response",
        key_det: "r3_details",
    },
    {
        sl_no: 4,
        point: "Any Critical / Special Characteristic identified in drawing /specifications?",
        key_resp: "r4_response",
        key_det: "r4_details",
    },
    {
        sl_no: 5,
        point: "All Statutory & Regulatory requirement applicable? eg : Fire safety certification, etc",
        key_resp: "r5_response",
        key_det: "r5_details",
    },
    {
        sl_no: 6,
        point: "Any Operation Risk related to following is identified (if yes give details) 1. New Technology 2. Ability and capacity to provide product or service 3. Short delivery time frame",
        key_resp: "r6_response",
        key_det: "r6_details",
    },
];

export default function Fesability({ proposalId: propProposalId, submissionId: propSubmissionId, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');

    // Document state (replaces Ant Design form state)
    const [partyDetails, setPartyDetails] = useState('');
    const [enquiryRef, setEnquiryRef] = useState('');
    const [description, setDescription] = useState('');
    const [conclusion, setConclusion] = useState('Feasible'); // 'Feasible' | 'Not Feasible'
    const [filename, setFilename] = useState('CMTI_Feasibility_Report.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('049'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');


    // Review points responses and details
    const [responses, setResponses] = useState({
        r1_response: '', r2_response: '', r3_response: '', r4_response: '', r5_response: '', r6_response: '',
        r1_details: '', r2_details: '', r3_details: '', r4_details: '', r5_details: '', r6_details: '',
    });

    // Check props or URL parameters to load existing submission
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('id') || searchParams.get('submission_id');
        const urlPropId = propProposalId || searchParams.get('proposal_id');

        if (urlPropId) {
            setSelectedProposalId(String(urlPropId));
        }

        if (urlId) {
            async function loadSubmission() {
                try {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) {

                        const sub = res.data;
                        setSubmissionId(sub.id);
                        setStatus(sub.status || 'DRAFT');
                        setDocNo(sub.document_no || '');
                        if (sub.proposal_id) setSelectedProposalId(String(sub.proposal_id));

                        const hData = sub.header_data || {};
                        if (hData.dateStr) setDocDate(hData.dateStr);
                        if (hData.preparedName) setPreparedBy(hData.preparedName);
                        if (hData.approvedName) setApprovedBy(hData.approvedName);

                        const fData = sub.form_data || {};
                        if (fData.party_details) setPartyDetails(fData.party_details);
                        if (fData.enquiry_ref_no) setEnquiryRef(fData.enquiry_ref_no);
                        if (fData.description_of_the_enquiry) setDescription(fData.description_of_the_enquiry);
                        if (fData.conclusion) setConclusion(fData.conclusion);

                        const rList = fData.review_points || [];
                        const updatedResp = { ...responses };
                        rList.forEach((pt, idx) => {
                            const template = REVIEW_POINTS_TEMPLATES[idx];
                            if (template) {
                                updatedResp[template.key_resp] = pt.yes_no_na || pt.response || '';
                                updatedResp[template.key_det] = pt.details || '';
                            }
                        });
                        setResponses(updatedResp);
                    }
                } catch (err) {
                    console.error('Failed to load ISO submission:', err);
                }
            }
            loadSubmission();
        }
    }, []);


    // Fetch user details and load proposals
    const fetchProposals = useCallback(async () => {
        setProposalsLoading(true);
        try {
            let name = '';
            let group = '';
            let center = '';
            let role = 'scientist';

            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                name = (parsedUser.name || '').trim();
                group = (parsedUser.group || '').trim();
                center = (parsedUser.center || '').trim();
                const path = window.location.pathname.toLowerCase();
                if (path.includes('/gh')) role = 'gh';
                else if (path.includes('/ch')) role = 'ch';
            }

            if (!name) return;

            let url = '';
            if (role === 'gh') {
                url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(group)}`;
            } else if (role === 'ch') {
                url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(center)}`;
            } else {
                url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(name)}?user_role=scientist`;
            }

            const res = await axios.get(url);
            if (res.data && Array.isArray(res.data)) {
                setProposals(res.data);
            }
        } catch (err) {
            console.error('Error fetching proposals:', err);
        } finally {
            setProposalsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    // Handle proposal selection
    const handleProposalChange = (e) => {
        const value = e.target.value;
        setSelectedProposalId(value);
        const prop = proposals.find(p => String(p.id) === String(value));
        if (prop) {
            setPartyDetails(prop.customer_name || prop.customerName || '');
            setEnquiryRef(prop.email_reference || prop.emailReference || '');
            setDescription(prop.quote_description || prop.quoteDescription || '');
        } else {
            setPartyDetails('');
            setEnquiryRef('');
            setDescription('');
        }
    };

    const handleReset = () => {
        setSelectedProposalId('');
        setPartyDetails('');
        setEnquiryRef('');
        setDescription('');
        setConclusion('Feasible');
        setFilename('CMTI_Feasibility_Report.docx');
        setRevisionCode(getDefaultRevisionCode('049'));
        setDocNo('');
        setDocDate(getTodayDateString());
        setPreparedBy('');
        setApprovedBy('');
        setResponses({
            r1_response: '', r2_response: '', r3_response: '', r4_response: '', r5_response: '', r6_response: '',
            r1_details: '', r2_details: '', r3_details: '', r4_details: '', r5_details: '', r6_details: '',
        });
    };

    // Handle generating & downloading Document
    const handleGenerate = async () => {
        if (!partyDetails || !enquiryRef || !description) {
            alert('Please fill Party Details, Enquiry Ref, and Description.');
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams();
            if (selectedProposalId) {
                params.append('project_id', selectedProposalId);
            }
            // Read user centre fresh from localStorage at generate time
            let freshCentreDept = getLoggedUserCentreDept();

            params.append('party_details', partyDetails);
            params.append('enquiry_ref', enquiryRef);
            params.append('description', description);
            params.append('conclusion', conclusion);
            params.append('centre_dept', freshCentreDept);
            params.append('group_name', revisionCode);
            params.append('doc_no', docNo);
            params.append('doc_date', docDate);
            params.append('prepared_by', preparedBy);
            params.append('approved_by', approvedBy);
            params.append('filename', filename);

            // Map all review points responses and details
            REVIEW_POINTS_TEMPLATES.forEach(pt => {
                params.append(pt.key_resp, responses[pt.key_resp] || '');
                params.append(pt.key_det, responses[pt.key_det] || '');
            });

            const downloadUrl = `${API_BASE_URL}/iso/feasibility/generate?${params.toString()}`;

            const response = await axios.get(downloadUrl, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename || 'CMTI_Feasibility_Report.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating document:', err);
            alert('Failed to generate document. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    // Handle saving draft or submitting form to PostgreSQL database
    const handleSaveSubmission = async (targetStatus = 'DRAFT') => {
        if (!partyDetails || !enquiryRef || !description) {
            alert('Please fill Party Details, Enquiry Ref, and Description.');
            return;
        }

        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const headerData = {
                documentTitle: 'FEASIBILITY STUDY REPORT',
                docNo: docNo || '049/001',
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || 'SMPM',
                isoSpec: 'ISO 9001-2015',
                preparedName: preparedBy,
                approvedName: approvedBy,
                groupName: revisionCode,
            };

            const reviewPointsList = REVIEW_POINTS_TEMPLATES.map(pt => ({
                sl_no: pt.sl_no,
                review_point: pt.point,
                yes_no_na: responses[pt.key_resp] || '',
                details: responses[pt.key_det] || ''
            }));

            const formDataPayload = {
                party_details: partyDetails,
                enquiry_ref_no: enquiryRef,
                description_of_the_enquiry: description,
                conclusion: conclusion,
                review_points: reviewPointsList,
            };

            const payload = {
                doc_type: 'FEASIBILITY',
                document_no: docNo || '049/001',
                proposal_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                header_data: headerData,
                form_data: formDataPayload,
                status: targetStatus,
                created_by: userId,
            };

            let response;
            if (submissionId) {
                response = await axios.put(`${API_BASE_URL}/iso-submissions/${submissionId}`, payload);
            } else {
                response = await axios.post(`${API_BASE_URL}/iso-submissions/`, payload);
                if (response.data && response.data.id) {
                    setSubmissionId(response.data.id);
                }
            }

            setStatus(response.data.status || targetStatus);
            alert(`ISO Feasibility Form ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved as Draft'} successfully!`);
        } catch (err) {
            console.error('Error saving submission:', err);
            alert(err.response?.data?.detail || 'Failed to save submission.');
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
                // Also update form_data with approved_by name
                await isoSubmissionService.updateSubmission(submissionId, {
                    form_data: {
                        party_details: partyDetails,
                        enquiry_ref: enquiryRef,
                        description: description,
                        conclusion: conclusion,
                        prepared_by: preparedBy || getLoggedUserName(),
                        approved_by: currentApproverName,
                        review_points: Object.keys(responses).map(k => ({ key: k, val: responses[k] }))
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

    // Check user role
    const currentUserRole = (() => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            return rawUser ? (JSON.parse(rawUser)?.role || '').toLowerCase().trim() : '';
        } catch (e) {
            return '';
        }
    })();
    const isAdmin = ['admin', 'director'].includes(currentUserRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin', 'dh'].includes(currentUserRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    // Admin CAN edit any document; Scientists/Approvers viewing SUBMITTED or APPROVED docs are READ-ONLY
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Status Alert Banner */}
            {isApproved && (
                <div className="w-full max-w-4xl bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>🔒 ISO Document APPROVED. This document is officially approved and locked against editing.</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono uppercase">APPROVED</span>
                </div>
            )}
            {!isApproved && isSubmitted && (
                <div className="w-full max-w-4xl bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>{isApprover ? '📋 Review Mode: ISO Document Submitted by Scientist. Read-Only View for CH/GH.' : '⏳ ISO Document Submitted. Pending approval review by CH / GH.'}</span>
                    <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-mono uppercase">SUBMITTED</span>
                </div>
            )}

            {/* Top Toolbar Control Bar */}
            <div className="w-full max-w-4xl bg-white border border-slate-200 p-4 rounded-2xl mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Load Proposal:</span>
                    <select
                        value={selectedProposalId}
                        onChange={handleProposalChange}
                        disabled={proposalsLoading || isReadOnly}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-64 p-2.5 font-medium disabled:opacity-60"
                    >
                        <option value="">-- Choose proposal to auto-fill --</option>
                        {proposals.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.project_number || `SL No ${p.id}`} - {p.customer_name || 'No Client'}
                            </option>
                        ))}
                    </select>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                        status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                    }`}>
                        {status}
                    </span>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
                    {/* Scientist Create / Edit Controls */}
                    {!isReadOnly && !isApprover && (
                        <>
                            <button
                                onClick={() => handleSaveSubmission('DRAFT')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
                            >
                                {submitting ? 'Saving...' : 'Save Draft'}
                            </button>

                            <button
                                onClick={() => handleSaveSubmission('SUBMITTED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/10"
                            >
                                {submitting ? 'Submitting...' : <><CheckOutlined /> Submit Form</>}
                            </button>
                        </>
                    )}

                    {/* CH / GH Approver Review Controls */}
                    {isApprover && isSubmitted && (
                        <>
                            <button
                                onClick={() => handleFormStatusUpdate('APPROVED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/10"
                            >
                                <CheckOutlined /> Approve Document
                            </button>

                            <button
                                onClick={() => handleFormStatusUpdate('REJECTED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-rose-600/10"
                            >
                                <CloseOutlined /> Reject Document
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                    >
                        {generating ? 'Generating...' : <><DownloadOutlined /> Download Word</>}
                    </button>
                </div>
            </div>




            {/* Simulated Word A4 Document Canvas */}
            <div className="w-full max-w-[21cm] bg-white shadow-2xl border border-slate-200 p-[1.5cm] flex flex-col font-sans text-slate-800 text-xs leading-relaxed min-h-[29.7cm]">

                {/* 1. DOCUMENT HEADER TABLE (3x3 matching header.docx) */}
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
                                CENTRE / DEPT:: <span className="font-normal text-indigo-600">{loggedCentreDept || '--'}</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] font-semibold">
                                Doc. No: {isReadOnly ? (
                                    <span className="font-bold text-slate-900 px-1">{docNo || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={docNo}
                                        onChange={(e) => setDocNo(e.target.value)}
                                        placeholder="--"
                                        className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-28 px-1 py-0 text-[9px] font-normal text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-sm bg-slate-50 uppercase tracking-wider text-slate-900 border-t border-slate-800">
                                FEASIBILITY REVIEW FORM
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

                {/* 2. DETAILS TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2.5 w-[20%] font-bold bg-slate-50/50">Party details:</td>
                            <td className="border border-slate-800 p-2.5 w-[30%]">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{partyDetails || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={partyDetails}
                                        onChange={(e) => setPartyDetails(e.target.value)}
                                        placeholder="Click to enter Party name..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium placeholder-slate-300"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2.5 w-[20%] font-bold bg-slate-50/50">Enquiry ref. No.:<br /><span className="text-[10px] font-normal text-slate-500">(Mail dated)</span></td>
                            <td className="border border-slate-800 p-2.5 w-[30%]">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{enquiryRef || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={enquiryRef}
                                        onChange={(e) => setEnquiryRef(e.target.value)}
                                        placeholder="Click to enter Enquiry ref..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium placeholder-slate-300"
                                    />
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 p-2.5 font-bold bg-slate-50/50">Description of the enquiry:</td>
                            <td className="border border-slate-800 p-2.5" colSpan={3}>
                                {isReadOnly ? (
                                    <div className="whitespace-pre-wrap font-semibold text-slate-900">{description || '--'}</div>
                                ) : (
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Click to enter Description of the enquiry..."
                                        rows={3}
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 resize-none text-slate-800 font-medium placeholder-slate-300"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 3. FEASIBILITY CHECKLIST ITEMS TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold text-center">
                            <th className="border border-slate-800 p-2.5 w-[8%]">Sl. No.</th>
                            <th className="border border-slate-800 p-2.5 w-[50%]">Review Point</th>
                            <th className="border border-slate-800 p-2.5 w-[14%]">Response<br /><span className="text-[9px] font-light">(Yes / No / Na)</span></th>
                            <th className="border border-slate-800 p-2.5 w-[28%]">Details / Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REVIEW_POINTS_TEMPLATES.map((pt) => (
                            <tr key={pt.sl_no} className="hover:bg-slate-50/30 transition-colors">
                                <td className="border border-slate-800 p-2 text-center font-semibold text-slate-600">{pt.sl_no}.</td>
                                <td className="border border-slate-800 p-2 text-left text-[11px] leading-relaxed text-slate-700">{pt.point}</td>
                                <td className="border border-slate-800 p-1 text-center align-middle">
                                    {isReadOnly ? (
                                        <span className={`font-bold px-2 py-0.5 rounded ${
                                            responses[pt.key_resp] === 'Yes' ? 'text-emerald-700 bg-emerald-50' :
                                            responses[pt.key_resp] === 'No' ? 'text-rose-700 bg-rose-50' :
                                            'text-slate-600'
                                        }`}>
                                            {responses[pt.key_resp] || '--'}
                                        </span>
                                    ) : (
                                        <select
                                            value={responses[pt.key_resp]}
                                            onChange={(e) => setResponses({ ...responses, [pt.key_resp]: e.target.value })}
                                            className="bg-transparent border-0 outline-none w-full text-center font-semibold text-indigo-600 cursor-pointer"
                                        >
                                            <option value="">-</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                            <option value="Na">Na</option>
                                        </select>
                                    )}
                                </td>
                                <td className="border border-slate-800 p-2">
                                    {isReadOnly ? (
                                        <span className="font-medium text-slate-800">{responses[pt.key_det] || '--'}</span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={responses[pt.key_det]}
                                            onChange={(e) => setResponses({ ...responses, [pt.key_det]: e.target.value })}
                                            placeholder="Enter details..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium placeholder-slate-300"
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 4. CONCLUSION SECTION */}

                <div className="border border-slate-800 p-4 rounded-lg bg-slate-50/20 mb-8">
                    <div className="font-bold text-xs underline mb-3 text-slate-900 uppercase tracking-wide">Conclusion</div>
                    <div className="flex gap-8 mb-3">
                        {isReadOnly ? (
                            <span className={`font-extrabold text-sm px-3 py-1 rounded border ${
                                conclusion === 'Feasible' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}>
                                {conclusion}
                            </span>
                        ) : (
                            <>
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name="conclusion"
                                        checked={conclusion === 'Feasible'}
                                        onChange={() => setConclusion('Feasible')}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Feasible</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="radio"
                                        name="conclusion"
                                        checked={conclusion === 'Not Feasible'}
                                        onChange={() => setConclusion('Not Feasible')}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Not Feasible</span>
                                </label>
                            </>
                        )}
                    </div>
                    <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200/50 p-3 rounded-lg leading-relaxed">
                        <span className="font-bold">Note: </span>
                        If not feasible, a negotiation for the terms to be made and feasibility form to be refilled for the same.
                    </div>
                </div>

                {/* 5. APPROVED SIGNATORY FOOTER TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs text-center mt-auto">
                    <thead>
                        <tr className="bg-slate-50 font-bold">
                            <th className="border border-slate-800 p-2 w-[50%]">Prepared By</th>
                            <th className="border border-slate-800 p-2 w-[50%]">Approved By</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="h-16">
                            <td className="border border-slate-800 p-2 align-bottom">
                                {isReadOnly ? (
                                    <div className="font-semibold text-slate-900">{preparedBy || '--'}</div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Name & Designation"
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                        className="w-full bg-transparent outline-none text-center font-medium border-0 border-b border-transparent focus:border-slate-300 text-slate-700"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2 align-bottom">
                                {isReadOnly ? (
                                    <div className="font-semibold text-slate-900">{approvedBy || '--'}</div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Name & Designation"
                                        value={approvedBy}
                                        onChange={(e) => setApprovedBy(e.target.value)}
                                        className="w-full bg-transparent outline-none text-center font-medium border-0 border-b border-transparent focus:border-slate-300 text-slate-700"
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

