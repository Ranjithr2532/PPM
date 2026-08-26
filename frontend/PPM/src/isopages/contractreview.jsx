import React, { useState, useEffect, useCallback } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    UploadOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const normalizeCentreDept = (centre) => {
    if (!centre) return '';
    const raw = String(centre).trim();
    if (!raw) return '';
    return raw.toUpperCase().startsWith('C-') ? raw.toUpperCase() : `C-${raw}`.toUpperCase();
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

const REVIEW_ITEMS_TEMPLATES = [
    { sl_no: 1, checklist: "Correct Company Name", key_q: "q1_val", key_p: "p1_val", key_d: "d1_val" },
    { sl_no: 2, checklist: "Scope of Supply including Qty", key_q: "q2_val", key_p: "p2_val", key_d: "d2_val" },
    { sl_no: 3, checklist: "Any Technical Requirements", key_q: "q3_val", key_p: "p3_val", key_d: "d3_val" },
    { sl_no: 4, checklist: "Billing Address", key_q: "q4_val", key_p: "p4_val", key_d: "d4_val" },
    { sl_no: 5, checklist: "Shipping Address", key_q: "q5_val", key_p: "p5_val", key_d: "d5_val" },
    { sl_no: 6, checklist: "Delivery Time/Date", key_q: "q6_val", key_p: "p6_val", key_d: "d6_val" },
    { sl_no: 7, checklist: "Mode of Delivery", key_q: "q7_val", key_p: "p7_val", key_d: "d7_val" },
    { sl_no: 8, checklist: "Supporting Documentation", key_q: "q8_val", key_p: "p8_val", key_d: "d8_val" },
    { sl_no: 9, checklist: "National & International Standards", key_q: "q9_val", key_p: "p9_val", key_d: "d9_val" },
    { sl_no: 10, checklist: "Payment Terms", key_q: "q10_val", key_p: "p10_val", key_d: "d10_val" },
    { sl_no: 11, checklist: "Any Penalty clause", key_q: "q11_val", key_p: "p11_val", key_d: "d11_val" },
    { sl_no: 12, checklist: "Any Claims", key_q: "q12_val", key_p: "p12_val", key_d: "d12_val" },
    { sl_no: 13, checklist: "Any Specific Legal Requirements", key_q: "q13_val", key_p: "p13_val", key_d: "d13_val" },
    { sl_no: 14, checklist: "Warranty / Guarantee", key_q: "q14_val", key_p: "p14_val", key_d: "d14_val" },
    { sl_no: 15, checklist: "Any Other Requirements(Specify)", key_q: "q15_val", key_p: "p15_val", key_d: "d15_val" }
];

export default function ContractReview({ proposalId: propProposalId, submissionId: propSubmissionId, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [readingQuotation, setReadingQuotation] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');


    // Details state
    const [quoteNo, setQuoteNo] = useState('');
    const [quoteDate, setQuoteDate] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [poDate, setPoDate] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectType, setSelectType] = useState('Quotation'); // 'Quotation' | 'Tender' | 'Proposal'
    const [filename, setFilename] = useState('Customer_Contract_Review_Checklist.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('051'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');


    // Checklist values (defaulting to completely empty as requested)
    const [reviewValues, setReviewValues] = useState({});

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
                        if (fData.po_number) setPoNumber(fData.po_number);
                        if (fData.po_date) setPoDate(fData.po_date);
                        if (fData.customer_name) setCustomerName(fData.customer_name);
                        if (fData.quote_no) setQuoteNo(fData.quote_no);
                        if (fData.quote_date) setQuoteDate(fData.quote_date);

                        const rList = fData.review_points || [];
                        const updatedValues = { ...reviewValues };
                        rList.forEach((pt, idx) => {
                            const template = REVIEW_ITEMS_TEMPLATES[idx];
                            if (template) {
                                updatedValues[template.key_q] = pt.quotation_clause || pt.yes_no_na || pt.response || '';
                                updatedValues[template.key_p] = pt.po_clause || pt.details || '';
                                updatedValues[template.key_d] = pt.deviations || '';
                            }
                        });
                        setReviewValues(updatedValues);

                    }
                } catch (err) {
                    console.error('Failed to load ISO Contract Review submission:', err);
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
            setQuoteNo(prop.quote_reference || '');

            // Format proposal date safely (YYYY-MM-DD to DD.MM.YYYY)
            if (prop.quote_date) {
                const parts = prop.quote_date.split('-');
                if (parts.length === 3) {
                    setQuoteDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
                } else {
                    setQuoteDate(prop.quote_date);
                }
            } else {
                setQuoteDate('');
            }

            setPoNumber(prop.order_number || '');

            // Format order date safely (YYYY-MM-DD to DD-MM-YYYY)
            if (prop.order_date) {
                const parts = prop.order_date.split('-');
                if (parts.length === 3) {
                    setPoDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    setPoDate(prop.order_date);
                }
            } else {
                setPoDate('');
            }

            setCustomerName(prop.customer_name || '');

            // Auto-detect selectType based on request type
            const reqType = (prop.request_type || '').toLowerCase();
            if (reqType.includes('tender')) {
                setSelectType('Tender');
            } else if (reqType.includes('proposal')) {
                setSelectType('Proposal');
            } else {
                setSelectType('Quotation');
            }

            // Auto-load quotation details for selected proposal
            handleLoadQuotationData(val);
        } else {
            setQuoteNo('');
            setQuoteDate('');
            setPoNumber('');
            setPoDate('');
            setCustomerName('');
            setSelectType('Quotation');
        }
    };

    // Read and load quotation details from backend quotation reader
    const handleLoadQuotationData = async (proposalIdToLoad = null) => {
        const pId = proposalIdToLoad || selectedProposalId;
        if (!pId) {
            alert('Please select a proposal first, or upload a quotation file.');
            return;
        }

        setReadingQuotation(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/iso/quotation-reader/proposal-quotation/${pId}`);
            if (res.data) {
                const data = res.data;
                if (data.company_name) setCustomerName(data.company_name);
                if (data.enquiry_ref) setQuoteNo(data.enquiry_ref);
                if (data.date) setQuoteDate(data.date);

                setReviewValues(prev => ({
                    ...prev,
                    q1_val: data.company_name || prev.q1_val || '',
                    q2_val: data.subject || prev.q2_val || '',
                    q6_val: data.delivery_period || '06 months from the date of acceptance',
                    q10_val: data.payment_terms || '80% after completion of the work & 20% after the successful implementation & submission of report.'
                }));
            }
        } catch (err) {
            console.error('Failed to load quotation data:', err);
        } finally {
            setReadingQuotation(false);
        }
    };

    // Direct file upload quotation reader
    const handleQuotationFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setReadingQuotation(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post(`${API_BASE_URL}/iso/quotation-reader/extract`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data) {
                const data = res.data;
                if (data.company_name) setCustomerName(data.company_name);
                if (data.enquiry_ref) setQuoteNo(data.enquiry_ref);
                if (data.date) setQuoteDate(data.date);

                setReviewValues(prev => ({
                    ...prev,
                    q1_val: data.company_name || prev.q1_val || '',
                    q2_val: data.subject || prev.q2_val || '',
                    q6_val: data.delivery_period || '06 months from the date of acceptance',
                    q10_val: data.payment_terms || '80% after completion of the work & 20% after the successful implementation & submission of report.'
                }));

                alert(`File "${file.name}" read successfully! Quotation details filled.`);
            }




        } catch (err) {
            console.error('File quotation OCR error:', err);
            alert('Failed to read quotation file.');
        } finally {
            setReadingQuotation(false);
            event.target.value = '';
        }
    };


    const handleReset = () => {
        setSelectedProposalId('');
        setQuoteNo('');
        setQuoteDate('');
        setPoNumber('');
        setPoDate('');
        setCustomerName('');
        setSelectType('Quotation');
        setFilename('Customer_Contract_Review_Checklist.docx');
        setRevisionCode(getDefaultRevisionCode('051'));
        setDocNo('');
        setDocDate(getTodayDateString());
        setPreparedBy('');
        setApprovedBy('');
        setReviewValues({});
    };

    // Handle value changes in the checklist table cells
    const handleValueChange = (key, val) => {
        setReviewValues(prev => ({
            ...prev,
            [key]: val
        }));
    };

    // Generate and download Word Document
    const handleGenerate = async () => {
        if (!quoteNo || !customerName) {
            alert('Please fill at least the Quotation Number and Customer Name details.');
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams();
            if (selectedProposalId) {
                params.append('project_id', selectedProposalId);
            }
            params.append('quote_no', quoteNo);
            params.append('quote_date', quoteDate);
            params.append('po_number', poNumber);
            params.append('po_date', poDate);
            params.append('customer_name', customerName);
            params.append('select_type', selectType);
            params.append('group_name', revisionCode);

            // Read user centre fresh from localStorage at generate time
            const freshCentreDept = getLoggedUserCentreDept();
            params.append('centre_dept', freshCentreDept);
            params.append('doc_no', docNo);
            params.append('doc_date', docDate);
            params.append('prepared_by', preparedBy);
            params.append('approved_by', approvedBy);
            params.append('filename', filename);

            // Populate checklist overrides (only non-empty values are sent, else backend generates empty cells)
            REVIEW_ITEMS_TEMPLATES.forEach(pt => {
                if (reviewValues[pt.key_q]) params.append(pt.key_q, reviewValues[pt.key_q]);
                if (reviewValues[pt.key_p]) params.append(pt.key_p, reviewValues[pt.key_p]);
                if (reviewValues[pt.key_d]) params.append(pt.key_d, reviewValues[pt.key_d]);
            });

            const downloadUrl = `${API_BASE_URL}/iso/contract-review/generate?${params.toString()}`;

            const response = await axios.get(downloadUrl, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename || 'Customer_Contract_Review_Checklist.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating document:', err);
            alert('Failed to generate Customer Contract Review Checklist.');
        } finally {
            setGenerating(false);
        }
    };



    // Handle saving draft or submitting form to PostgreSQL database
    const handleSaveSubmission = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const headerData = {
                documentTitle: 'CUSTOMER CONTRACT REVIEW CHECKLIST',
                docNo: docNo || '051/001',
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || 'SMPM',
                isoSpec: 'ISO 9001-2015',
                preparedName: preparedBy,
                approvedName: approvedBy,
                groupName: revisionCode,
            };

            const reviewPointsList = REVIEW_ITEMS_TEMPLATES.map(pt => ({
                sl_no: pt.sl_no,
                review_point: pt.checklist,
                yes_no_na: reviewValues[pt.key_q] || '',
                details: reviewValues[pt.key_p] || ''
            }));

            const formDataPayload = {
                quote_no: quoteNo,
                quote_date: quoteDate,
                po_number: poNumber,
                po_date: poDate,
                customer_name: customerName,
                select_type: selectType,
                review_points: reviewPointsList,
            };

            const payload = {
                doc_type: 'CONTRACT_REVIEW',
                document_no: docNo || '051/001',
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
            alert(`ISO Contract Review Checklist ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved as Draft'} successfully!`);
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
                await isoSubmissionService.updateSubmission(submissionId, {
                    form_data: {
                        quote_no: quoteNo,
                        quote_date: quoteDate,
                        po_number: poNumber,
                        po_date: poDate,
                        customer_name: customerName,
                        select_type: selectType,
                        prepared_by: preparedBy || getLoggedUserName(),
                        approved_by: currentApproverName,
                        review_values: reviewValues
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

                    {!isReadOnly && (
                        <>
                            <button
                                onClick={() => handleLoadQuotationData()}
                                disabled={readingQuotation || !selectedProposalId}
                                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                title="Auto-fill details from Proposal Quotation document"
                            >
                                <FileTextOutlined /> {readingQuotation ? 'Reading Quotation...' : 'Load Data from Quotation'}
                            </button>

                            <label className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all shadow-sm">
                                <UploadOutlined /> Read Quotation File
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={handleQuotationFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </>
                    )}

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

                {/* 1. DOCUMENT HEADER TABLE */}
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
                                Customer Contract Review Checklist
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

                <table className="w-full border-collapse border border-slate-800 text-xs mb-6 text-center">
                    <tbody>
                        <tr className="bg-slate-50 font-bold">
                            <td className="border border-slate-800 p-2 w-[22%] select-none">
                                <div className="flex flex-col gap-0.5 justify-center items-center font-bold">
                                    <span
                                        onClick={() => !isReadOnly && setSelectType('Quotation')}
                                        className={`${!isReadOnly ? 'cursor-pointer hover:text-indigo-600' : ''} transition-all ${selectType === 'Quotation' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Quotation No
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">/</span>
                                    <span
                                        onClick={() => !isReadOnly && setSelectType('Tender')}
                                        className={`${!isReadOnly ? 'cursor-pointer hover:text-indigo-600' : ''} transition-all ${selectType === 'Tender' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Tender
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">/</span>
                                    <span
                                        onClick={() => !isReadOnly && setSelectType('Proposal')}
                                        className={`${!isReadOnly ? 'cursor-pointer hover:text-indigo-600' : ''} transition-all ${selectType === 'Proposal' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Proposal
                                    </span>
                                </div>
                            </td>
                            <td className="border border-slate-800 p-2 w-[18%]">Quotation<br />Date / Tender</td>
                            <td className="border border-slate-800 p-2 w-[26%]">Purchase Order<br />No</td>
                            <td className="border border-slate-800 p-2 w-[18%]">Purchase Order<br />Date</td>
                            <td className="border border-slate-800 p-2 w-[16%]">Customer Name</td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{quoteNo || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={quoteNo}
                                        onChange={(e) => setQuoteNo(e.target.value)}
                                        placeholder="Enter reference..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{quoteDate || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={quoteDate}
                                        onChange={(e) => setQuoteDate(e.target.value)}
                                        placeholder="Enter date..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{poNumber || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={poNumber}
                                        onChange={(e) => setPoNumber(e.target.value)}
                                        placeholder="Enter PO No..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{poDate || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={poDate}
                                        onChange={(e) => setPoDate(e.target.value)}
                                        placeholder="Enter PO Date..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                    />
                                )}
                            </td>
                            <td className="border border-slate-800 p-2">
                                {isReadOnly ? (
                                    <span className="font-semibold text-slate-900">{customerName || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Enter customer..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                    />
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold text-center">
                            <th className="border border-slate-800 p-2 w-[5%]">Sl. No.</th>
                            <th className="border border-slate-800 p-2 w-[35%]">Aspects to be Reviewed</th>
                            <th className="border border-slate-800 p-2 w-[20%]">Quotation Ref / Clause</th>
                            <th className="border border-slate-800 p-2 w-[20%]">PO Ref / Clause</th>
                            <th className="border border-slate-800 p-2 w-[20%]">Deviations / Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REVIEW_ITEMS_TEMPLATES.map((item) => (

                            <tr key={item.sl_no} className="hover:bg-slate-50/30 transition-colors">
                                <td className="border border-slate-800 p-2 text-center font-semibold text-slate-600 align-top">{item.sl_no}.</td>
                                <td className="border border-slate-800 p-2 text-left text-[11px] leading-relaxed text-slate-700 align-top font-medium">{item.checklist}</td>
                                <td className="border border-slate-800 p-1 text-center align-top">
                                    {isReadOnly ? (
                                        <span className="font-semibold text-slate-800 text-[11px] leading-snug break-words whitespace-pre-wrap block">{reviewValues[item.key_q] || '--'}</span>
                                    ) : (
                                        <textarea
                                            value={reviewValues[item.key_q] || ''}
                                            onChange={(e) => setReviewValues({ ...reviewValues, [item.key_q]: e.target.value })}
                                            rows={2}
                                            placeholder="--"
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 text-center font-medium text-slate-800 text-[11px] leading-snug p-1 resize-y rounded"
                                        />
                                    )}
                                </td>
                                <td className="border border-slate-800 p-1 text-center align-top">
                                    {isReadOnly ? (
                                        <span className="font-semibold text-slate-800 text-[11px] leading-snug break-words whitespace-pre-wrap block">{reviewValues[item.key_p] || '--'}</span>
                                    ) : (
                                        <textarea
                                            value={reviewValues[item.key_p] || ''}
                                            onChange={(e) => setReviewValues({ ...reviewValues, [item.key_p]: e.target.value })}
                                            rows={2}
                                            placeholder="--"
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 text-center font-medium text-slate-800 text-[11px] leading-snug p-1 resize-y rounded"
                                        />
                                    )}
                                </td>
                                <td className="border border-slate-800 p-1 text-center align-top">
                                    {isReadOnly ? (
                                        <span className="font-medium text-slate-800 text-[11px] leading-snug break-words whitespace-pre-wrap block">{reviewValues[item.key_d] || '--'}</span>
                                    ) : (
                                        <textarea
                                            value={reviewValues[item.key_d] || ''}
                                            onChange={(e) => setReviewValues({ ...reviewValues, [item.key_d]: e.target.value })}
                                            rows={2}
                                            placeholder="--"
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 text-center font-medium text-slate-800 text-[11px] leading-snug p-1 resize-y rounded"
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>


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
