import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    DownloadOutlined,
    UploadOutlined,
    PaperClipOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    InboxOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { Upload, message } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getCurrentUserRole } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

export default function Sqap({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [submissionData, setSubmissionData] = useState(null);
    const [fileList, setFileList] = useState([]);

    // Project Details from linked proposal
    const [projectTitle, setProjectTitle] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [sanctionLetterNo, setSanctionLetterNo] = useState('');

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isReadOnly = isAdmin ? false : (status === 'APPROVED' || (status === 'SUBMITTED' && isApprover));

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
            setSanctionLetterNo(p.sanction_letter_no || p.project_number || p.quote_number || p.po_number || '');
        }
    }, [selectedProposalId, proposals]);

    // Load Existing Submission if editing
    const loadSubmission = async (subId) => {
        try {
            const sub = await isoSubmissionService.getSubmissionById(subId);
            if (sub) {
                setSubmissionData(sub);
                setSubmissionId(sub.id);
                setStatus(sub.status || 'DRAFT');
                if (sub.proposal_id) setSelectedProposalId(String(sub.proposal_id));

                const fd = sub.form_data || {};
                if (fd.project_title) setProjectTitle(fd.project_title);
                if (fd.customer_name) setCustomerName(fd.customer_name);
                if (fd.sanction_letter_no) setSanctionLetterNo(fd.sanction_letter_no);

                if (fd.is_uploaded && fd.file_path) {
                    setUploadedFile({
                        name: fd.uploaded_filename || 'ISO_SQAP_055.docx',
                        url: fd.file_path,
                        date: sub.updated_at
                    });
                }
            }
        } catch (err) {
            console.error('Failed to load SQAP submission:', err);
        } finally {
            setTimeout(() => { isHydratedRef.current = true; }, 400);
        }
    };

    useEffect(() => {
        if (propSubmissionId) {
            loadSubmission(propSubmissionId);
        } else if (selectedProposalId) {
            // Find existing SQAP submission for this proposal
            isoSubmissionService.getSubmissions({ proposal_id: selectedProposalId, doc_type: 'SQAP' })
                .then(subs => {
                    if (Array.isArray(subs) && subs.length > 0) {
                        loadSubmission(subs[0].id);
                    } else {
                        setTimeout(() => { isHydratedRef.current = true; }, 400);
                    }
                })
                .catch(err => {
                    console.error(err);
                    setTimeout(() => { isHydratedRef.current = true; }, 400);
                });
        } else {
            setTimeout(() => { isHydratedRef.current = true; }, 400);
        }
    }, [propSubmissionId, selectedProposalId]);

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
                documentTitle: 'Software Quality Assurance Plan (SQAP)',
                docNo: 'CMTI-QMS-055',
                code: 'Rev00',
                dateStr: new Date().toISOString().split('T')[0],
                centreDept: getLoggedUserGroup() || '',
                preparedName: getLoggedUserName(),
                approvedName: '',
            };

            const formDataPayload = {
                project_title: projectTitle,
                customer_name: customerName,
                sanction_letter_no: sanctionLetterNo,
                is_uploaded: uploadedFile ? true : false,
                uploaded_filename: uploadedFile?.name || '',
                file_path: uploadedFile?.url || '',
            };

            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

            const payload = {
                doc_type: 'SQAP',
                document_no: 'CMTI-QMS-055',
                proposal_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                header_data: headerData,
                form_data: formDataPayload,
                status: currentDocStatus,
                created_by: userId,
            };

            let response;
            if (submissionIdRef.current) {
                response = await axios.put(`${API_BASE_URL}/iso-submissions/${submissionIdRef.current}`, payload);
            } else {
                response = await axios.post(`${API_BASE_URL}/iso-submissions/`, payload);
                if (response.data && response.data.id) {
                    setSubmissionId(response.data.id);
                    submissionIdRef.current = response.data.id;
                }
            }

            setAutoSaveState('saved');
            setLastSavedAt(new Date());
        } catch (err) {
            console.error('Auto-save error in SQAP:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, projectTitle, customerName, sanctionLetterNo, uploadedFile, selectedProposalId]);

    // Debounced Auto-Save
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const timer = setTimeout(() => { performAutoSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [projectTitle, customerName, sanctionLetterNo, uploadedFile, selectedProposalId, performAutoSave, isReadOnly]);

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

    // Download Word Template
    const handleDownloadTemplate = async () => {
        setDownloadingTemplate(true);
        try {
            const payload = {
                project_title: projectTitle,
                customer_name: customerName,
                sanction_letter_no: sanctionLetterNo,
                project_no: sanctionLetterNo,
                released_by_org: 'CMTI',
                user_agency_org: customerName,
                prepared_by_name: getLoggedUserName() || '',
                group_name: getLoggedUserGroup(),
                doc_no: '055',
                filename: `ISO_SQAP_055_Template.docx`
            };

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
            message.success('SQAP Template downloaded successfully!');
        } catch (err) {
            console.error('Template download error:', err);
            message.error('Failed to download SQAP template.');
        } finally {
            setDownloadingTemplate(false);
        }
    };

    // Upload Completed SQAP Document
    const handleUploadSubmit = async () => {
        if (!fileList.length) {
            message.warning('Please select a file to upload.');
            return;
        }

        setUploading(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formData = new FormData();
            formData.append('file', fileList[0]);
            formData.append('doc_type', 'SQAP');
            formData.append('document_no', '055');
            if (selectedProposalId) formData.append('proposal_id', selectedProposalId);
            if (userId) formData.append('created_by', userId);

            const res = await isoSubmissionService.uploadFile(formData);
            message.success('SQAP document uploaded and submitted for approval successfully!');
            setFileList([]);
            if (res && res.id) {
                loadSubmission(res.id);
            }
        } catch (err) {
            console.error('Upload error:', err);
            message.error('Failed to upload SQAP document.');
        } finally {
            setUploading(false);
        }
    };

    // Download Uploaded File
    const handleDownloadUploadedFile = async () => {
        if (!uploadedFile) return;
        try {
            message.loading({ content: 'Downloading file...', key: 'dl' });
            if (uploadedFile.url && uploadedFile.url.startsWith('http')) {
                await isoSubmissionService.downloadFileFromUrl(uploadedFile.url, uploadedFile.name);
            } else if (submissionId) {
                await isoSubmissionService.exportWord(submissionId, uploadedFile.name);
            }
            message.success({ content: 'File downloaded successfully!', key: 'dl' });
        } catch (err) {
            console.error('Download error:', err);
            message.error({ content: 'Failed to download file.', key: 'dl' });
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

        setActionLoading(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            await isoSubmissionService.updateStatus(submissionId, newStatus, comment, userId);
            setStatus(newStatus);
            message.success(`ISO SQAP status updated to ${newStatus}`);
            loadSubmission(submissionId);
        } catch (err) {
            console.error('Status update error:', err);
            message.error('Failed to update status.');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Top Navigation & Action Controls */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
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
                        title="Go Back (Auto-saves draft)"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Software Quality Assurance Plan (SQAP)</h1>
                        <p className="text-xs text-slate-500 font-mono">Document No: CMTI-QMS-055/Rev00</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        uploadedFile ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                        'bg-slate-100 text-slate-600 border border-slate-300'
                    }`}>
                        {status === 'DRAFT' && uploadedFile ? 'UPLOADED' : status}
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

                    {isApprover && status === 'SUBMITTED' && (
                        <div className="flex items-center gap-2 border-l pl-3 ml-2 border-slate-200">
                            <button
                                onClick={() => handleStatusUpdate('APPROVED')}
                                disabled={actionLoading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition"
                            >
                                <CheckOutlined /> Approve
                            </button>
                            <button
                                onClick={() => handleStatusUpdate('REJECTED')}
                                disabled={actionLoading}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition"
                            >
                                <CloseOutlined /> Reject
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Proposal Selector Card */}
            <div className="w-full max-w-4xl bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Link Proposal:</label>
                    <select
                        value={selectedProposalId}
                        onChange={(e) => setSelectedProposalId(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                    >
                        <option value="">-- Select Linked Proposal (Auto-Fill) --</option>
                        {proposals.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.project_number ? `${p.project_number} - ` : ''}{p.quote_description || p.customer_name || `Proposal #${p.id}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="text-xs text-slate-500 font-mono">
                    <strong>Doc Code:</strong> CMTI-QMS-055/Rev00
                </div>
            </div>

            {/* Main Content: 2-Step Download & Upload Workflow Cards */}
            <div className="w-full max-w-4xl space-y-6">

                {/* Step 1: Download Template */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 text-2xl flex-shrink-0">
                            <FileWordOutlined />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Step 1</span>
                                <h3 className="text-base font-bold text-slate-800">Download SQAP Template (.docx)</h3>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Download the standard ISO 9001-2015 SQAP template document (CMTI-QMS-055/Rev00) formatted with the Release & Acceptance Stakeholder table and Project Information.
                            </p>
                            {customerName && (
                                <p className="text-[11px] text-slate-600 font-mono pt-1">
                                    Pre-filled for: <strong>{projectTitle || 'Linked Project'}</strong> ({customerName})
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleDownloadTemplate}
                        disabled={downloadingTemplate}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition whitespace-nowrap flex-shrink-0"
                    >
                        <DownloadOutlined /> {downloadingTemplate ? 'Downloading...' : 'Download Template (.docx)'}
                    </button>
                </div>

                {/* Step 2: Upload Completed Document */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 hover:shadow-md transition">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-2xl flex-shrink-0">
                            <UploadOutlined />
                        </div>
                        <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Step 2</span>
                                <h3 className="text-base font-bold text-slate-800">Upload Filled SQAP Document</h3>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Fill the downloaded Word template offline with all required signatures and details, then upload the completed file (<strong>.docx</strong>, <strong>.pdf</strong>, or <strong>.doc</strong>) for submission and review.
                            </p>
                        </div>
                    </div>

                    {/* Upload Dropzone */}
                    <div className="pt-2">
                        <Upload.Dragger
                            beforeUpload={(file) => {
                                setFileList([file]);
                                return false; // Prevent automatic upload
                            }}
                            onRemove={() => setFileList([])}
                            fileList={fileList}
                            maxCount={1}
                            accept=".docx,.pdf,.doc"
                            className="bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-4 transition"
                        >
                            <p className="ant-upload-drag-icon text-indigo-500 text-3xl mb-2">
                                <InboxOutlined />
                            </p>
                            <p className="text-xs font-semibold text-slate-700">
                                Click or drag filled SQAP file to this area to upload
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Supported formats: Microsoft Word (.docx, .doc) or PDF (.pdf)
                            </p>
                        </Upload.Dragger>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleUploadSubmit}
                            disabled={uploading || !fileList.length}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm transition"
                        >
                            <UploadOutlined /> {uploading ? 'Uploading...' : 'Upload & Submit for Approval'}
                        </button>
                    </div>
                </div>

                {/* Step 3: Current Submitted File Status & Download */}
                {uploadedFile && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircleOutlined className="text-emerald-500 text-base" /> Current Submitted Document
                            </h3>
                            <span className={`text-xs font-bold px-3 py-0.5 rounded-full uppercase ${
                                status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                'bg-slate-100 text-slate-700'
                            }`}>
                                Status: {status}
                            </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="text-2xl text-indigo-600">
                                    <PaperClipOutlined />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800">{uploadedFile.name}</h4>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        Uploaded on: {new Date(uploadedFile.date || Date.now()).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleDownloadUploadedFile}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                            >
                                <DownloadOutlined /> Download File
                            </button>
                        </div>

                        {submissionData?.rejection_comment && (
                            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                                <strong>Rejection Reason:</strong> {submissionData.rejection_comment}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
