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

const DEFAULT_BOI_ITEMS = [
    { sl_no: '1', document_type: 'ISO 9001-2015 / QMS Certificate', checked: true, remarks: '' },
    { sl_no: '2', document_type: 'Calibration Certificate', checked: true, remarks: '' },
    { sl_no: '3', document_type: 'Certificate of Compliance (COC)', checked: true, remarks: '' },
    { sl_no: '4', document_type: 'Warranty Certificate', checked: true, remarks: '' },
    { sl_no: '5', document_type: 'CE/ Relevant Standard (For Electrical)', checked: false, remarks: '' },
    { sl_no: '6', document_type: 'User Manual', checked: true, remarks: '' },
];

const DEFAULT_MFG_ITEMS = [
    { sl_no: '1', document_type: 'ISO 9001-2015 / QMS Certificate', checked: true, remarks: '' },
    { sl_no: '2', document_type: 'Material Chemical Certificate', checked: true, remarks: '' },
    { sl_no: '3', document_type: 'NDT Test Certificate (Ultrasonic Test, DPT, MPT)', checked: false, remarks: '' },
    { sl_no: '4', document_type: 'Heat Treatment Certificate (Hardening, Carburizing, Blackening, Tempering, Annealing)', checked: false, remarks: '' },
    { sl_no: '5', document_type: 'QAP Documents As per CMTI Standards (Casting, Forging, Welding, Fabrication, Machining, Gear Cutting)', checked: true, remarks: '' },
    { sl_no: '6', document_type: 'Dimensional Inspection Report', checked: true, remarks: '' },
    { sl_no: '7', document_type: 'Job Card', checked: false, remarks: '' },
    { sl_no: '8', document_type: 'Witness', checked: false, remarks: '' },
];

export default function TechnicalSpecification({ proposalId: propProposalId, submissionId: propSubmissionId, docInfo, onClose, onBack }) {
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
    const [itemDescription, setItemDescription] = useState('');

    // Section 1: Specs Table
    const [specs, setSpecs] = useState([
        { sl_no: '1', specification: '', requirement: '', vendor_compliance: '' }
    ]);

    // Section 2: Scope of Supply Table
    const [scopeOfSupply, setScopeOfSupply] = useState([
        { sl_no: '1', particulars: '', qty: '', remarks: '' }
    ]);

    // Section 3: Checklists
    const [boiChecklist, setBoiChecklist] = useState(DEFAULT_BOI_ITEMS);
    const [mfgChecklist, setMfgChecklist] = useState(DEFAULT_MFG_ITEMS);

    // Signatures & Doc Header
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('065');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : isApproved;

    // Directly fetch proposal details
    useEffect(() => {
        const targetPid = effectiveProposalId || selectedProposalId;
        if (!targetPid) return;

        const fetchProposal = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/${targetPid}`);
                const p = res.data;
                if (p) {
                    setProjectTitle(prev => prev || p.title_of_project || p.quote_description || p.project_name || '');
                    setCustomerName(prev => prev || p.customer_name || '');
                    setProjectNo(prev => prev || p.project_number || '');
                    setItemDescription(prev => prev || p.quote_description || p.project_name || '');
                }
            } catch (err) {
                console.error('Failed to load proposal details:', err);
            }
        };
        fetchProposal();
    }, [effectiveProposalId, selectedProposalId]);

    // Load Existing Submission if editing
    useEffect(() => {
        const loadSubmission = async () => {
            try {
                let sub = null;
                const targetSubId = propSubmissionId || null;
                const targetPropId = propProposalId || selectedProposalId;

                if (targetSubId) {
                    sub = await isoSubmissionService.getSubmissionById(targetSubId);
                } else if (targetPropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: targetPropId, doc_type: 'TECHNICAL_SPECIFICATION' });
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
                    if (fd.item_description) setItemDescription(fd.item_description);

                    if (Array.isArray(fd.specs) && fd.specs.length > 0) setSpecs(fd.specs);
                    if (Array.isArray(fd.scope_of_supply) && fd.scope_of_supply.length > 0) setScopeOfSupply(fd.scope_of_supply);
                    if (Array.isArray(fd.boi_checklist) && fd.boi_checklist.length > 0) setBoiChecklist(fd.boi_checklist);
                    if (Array.isArray(fd.mfg_checklist) && fd.mfg_checklist.length > 0) setMfgChecklist(fd.mfg_checklist);

                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load Technical Specification submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        };

        loadSubmission();
    }, [propSubmissionId, propProposalId]);

    // Specs Handlers
    const handleAddSpecRow = () => {
        if (isReadOnly) return;
        setSpecs(prev => [
            ...prev,
            { sl_no: String(prev.length + 1), specification: '', requirement: '', vendor_compliance: '' }
        ]);
    };

    const handleRemoveSpecRow = (idx) => {
        if (isReadOnly) return;
        setSpecs(prev => {
            const next = prev.filter((_, i) => i !== idx);
            return next.map((r, i) => ({ ...r, sl_no: String(i + 1) }));
        });
    };

    const handleSpecChange = (idx, field, val) => {
        if (isReadOnly) return;
        setSpecs(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    // Scope of Supply Handlers
    const handleAddScopeRow = () => {
        if (isReadOnly) return;
        setScopeOfSupply(prev => [
            ...prev,
            { sl_no: String(prev.length + 1), particulars: '', qty: '', remarks: '' }
        ]);
    };

    const handleRemoveScopeRow = (idx) => {
        if (isReadOnly) return;
        setScopeOfSupply(prev => {
            const next = prev.filter((_, i) => i !== idx);
            return next.map((r, i) => ({ ...r, sl_no: String(i + 1) }));
        });
    };

    const handleScopeChange = (idx, field, val) => {
        if (isReadOnly) return;
        setScopeOfSupply(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    // Checklist Handlers
    const toggleBoiCheck = (idx) => {
        if (isReadOnly) return;
        setBoiChecklist(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
    };

    const handleBoiChange = (idx, field, val) => {
        if (isReadOnly) return;
        setBoiChecklist(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    };

    const toggleMfgCheck = (idx) => {
        if (isReadOnly) return;
        setMfgChecklist(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
    };

    const handleMfgChange = (idx, field, val) => {
        if (isReadOnly) return;
        setMfgChecklist(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    };

    const buildPayload = () => ({
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        item_description: itemDescription,
        specs: specs,
        scope_of_supply: scopeOfSupply,
        boi_checklist: boiChecklist,
        mfg_checklist: mfgChecklist,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        centre_dept: getLoggedUserCentreDept(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_Technical_Specification_${projectNo || '065'}.docx`
    });

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/technical-specification/generate`, payload, {
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
                doc_type: 'TECHNICAL_SPECIFICATION',
                document_no: docNo || '065',
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
            console.error('Auto-save error in TechnicalSpecification:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, projectTitle, projectNo, customerName, itemDescription, specs, scopeOfSupply, boiChecklist, mfgChecklist, preparedBy, approvedBy, docNo, docDate, selectedProposalId]);

    // Debounced Auto-Save
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const timer = setTimeout(() => { performAutoSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [projectTitle, projectNo, customerName, itemDescription, specs, scopeOfSupply, boiChecklist, mfgChecklist, preparedBy, approvedBy, docNo, docDate, selectedProposalId, performAutoSave, isReadOnly]);

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
                doc_type: 'TECHNICAL_SPECIFICATION',
                document_no: docNo || '065',
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
            alert(`ISO Technical Specification ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
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
            alert(`ISO Technical Specification status updated to ${newStatus}`);
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
                            <h1 className="text-xl font-bold text-slate-800">Technical Specification</h1>
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
                        <p className="text-xs text-slate-500">Document No: CMTI-SMC-QMS-065/Rev00</p>
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
                            <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">TECHNICAL SPECIFICATION</h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: CMTI-SMC-QMS-065/Rev00</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/065</div>
                            <div><strong>Page:</strong> 1 of 1</div>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Title</label>
                            <input
                                type="text"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Project Title"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
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
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none font-semibold text-slate-800"
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
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                            <input
                                type="text"
                                value={docDate}
                                onChange={(e) => setDocDate(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="DD.MM.YYYY"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 1: Item Description & Technical Specifications */}
                <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                            DESCRIPTION OF ITEM:
                        </label>
                        <textarea
                            rows={2}
                            value={itemDescription}
                            onChange={(e) => setItemDescription(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Enter detailed description of the item / equipment..."
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <TableOutlined className="text-indigo-600" /> Technical Specification Parameters
                            </h3>
                            {!isReadOnly && (
                                <button
                                    onClick={handleAddSpecRow}
                                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                                >
                                    <PlusOutlined /> Add Parameter
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                        <th className="p-2 border-r border-slate-300 text-center font-bold w-14">Sl No</th>
                                        <th className="p-2 border-r border-slate-300 text-left font-bold min-w-[220px]">Specification</th>
                                        <th className="p-2 border-r border-slate-300 text-left font-bold min-w-[220px]">Requirement</th>
                                        <th className="p-2 border-r border-slate-300 text-left font-bold min-w-[200px]">Vendor Compliance</th>
                                        {!isReadOnly && <th className="p-2 w-12 text-center font-bold">Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {specs.length === 0 ? (
                                        <tr>
                                            <td colSpan={isReadOnly ? 4 : 5} className="p-4 text-center text-slate-400 italic">
                                                No specification parameters added yet. Click "+ Add Parameter" to start.
                                            </td>
                                        </tr>
                                    ) : (
                                        specs.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                                <td className="p-2 text-center border-r border-slate-200 font-medium text-slate-500">
                                                    <input
                                                        type="text"
                                                        value={row.sl_no || ''}
                                                        onChange={(e) => handleSpecChange(rowIdx, 'sl_no', e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-full text-xs bg-transparent border-none text-center outline-none"
                                                    />
                                                </td>
                                                <td className="p-1 border-r border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={row.specification || ''}
                                                        onChange={(e) => handleSpecChange(rowIdx, 'specification', e.target.value)}
                                                        disabled={isReadOnly}
                                                        placeholder="e.g. Dimensions / Power / Material"
                                                        className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                    />
                                                </td>
                                                <td className="p-1 border-r border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={row.requirement || ''}
                                                        onChange={(e) => handleSpecChange(rowIdx, 'requirement', e.target.value)}
                                                        disabled={isReadOnly}
                                                        placeholder="Target Value / Standard"
                                                        className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                    />
                                                </td>
                                                <td className="p-1 border-r border-slate-200">
                                                    <input
                                                        type="text"
                                                        value={row.vendor_compliance || ''}
                                                        onChange={(e) => handleSpecChange(rowIdx, 'vendor_compliance', e.target.value)}
                                                        disabled={isReadOnly}
                                                        placeholder="Vendor response / Comply"
                                                        className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                    />
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="p-1 text-center">
                                                        <button
                                                            onClick={() => handleRemoveSpecRow(rowIdx)}
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
                </div>

                {/* Section 2: Scope of Supply */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Scope of Supply</h3>
                            <p className="text-xs text-slate-500 italic">Supplier need to supply below mentioned items,</p>
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={handleAddScopeRow}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                            >
                                <PlusOutlined /> Add Scope Item
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    <th className="p-2 border-r border-slate-300 text-center font-bold w-14">Sl.No.</th>
                                    <th className="p-2 border-r border-slate-300 text-left font-bold min-w-[300px]">Particulars</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold w-24">Qty</th>
                                    <th className="p-2 border-r border-slate-300 text-left font-bold min-w-[180px]">Remarks</th>
                                    {!isReadOnly && <th className="p-2 w-12 text-center font-bold">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {scopeOfSupply.length === 0 ? (
                                    <tr>
                                        <td colSpan={isReadOnly ? 4 : 5} className="p-4 text-center text-slate-400 italic">
                                            No scope items added yet. Click "+ Add Scope Item" to start.
                                        </td>
                                    </tr>
                                ) : (
                                    scopeOfSupply.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-2 text-center border-r border-slate-200 font-medium text-slate-500">
                                                <input
                                                    type="text"
                                                    value={row.sl_no || ''}
                                                    onChange={(e) => handleScopeChange(rowIdx, 'sl_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none text-center outline-none"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.particulars || ''}
                                                    onChange={(e) => handleScopeChange(rowIdx, 'particulars', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Item name / Particulars"
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.qty || ''}
                                                    onChange={(e) => handleScopeChange(rowIdx, 'qty', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Qty / Units"
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1 text-center font-medium"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.remarks || ''}
                                                    onChange={(e) => handleScopeChange(rowIdx, 'remarks', e.target.value)}
                                                    disabled={isReadOnly}
                                                    placeholder="Remarks / Note"
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            {!isReadOnly && (
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => handleRemoveScopeRow(rowIdx)}
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

                {/* Section 3: Checklists */}
                <div className="space-y-6 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        Checklist for the Documents Required from Vendor / Supplier
                    </h3>

                    {/* 3A: Bought Out Items */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-indigo-700">For Bought Out Items (BOI)</h4>
                        <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                        <th className="p-2 border-r border-slate-300 text-center font-bold w-14">Sl No</th>
                                        <th className="p-2 border-r border-slate-300 text-left font-bold">Document Type</th>
                                        <th className="p-2 text-center font-bold w-24">Tick mark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {boiChecklist.map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-2 text-center border-r border-slate-200 text-slate-500 font-medium">
                                                {item.sl_no || idx + 1}
                                            </td>
                                            <td className="p-2 border-r border-slate-200 font-medium text-slate-700">
                                                {item.document_type}
                                            </td>
                                            <td className="p-2 text-center">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(item.checked)}
                                                        onChange={() => toggleBoiCheck(idx)}
                                                        disabled={isReadOnly}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed transition"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3B: Manufacturing Items */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-indigo-700">For Manufacturing Items</h4>
                        <div className="overflow-x-auto border border-slate-300 rounded-lg bg-white">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                        <th className="p-2 border-r border-slate-300 text-center font-bold w-14">Sl No</th>
                                        <th className="p-2 border-r border-slate-300 text-left font-bold">Document Type</th>
                                        <th className="p-2 text-center font-bold w-24">Tick mark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mfgChecklist.map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-2 text-center border-r border-slate-200 text-slate-500 font-medium">
                                                {item.sl_no || idx + 1}
                                            </td>
                                            <td className="p-2 border-r border-slate-200 font-medium text-slate-700 whitespace-pre-line">
                                                {item.document_type}
                                            </td>
                                            <td className="p-2 text-center">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(item.checked)}
                                                        onChange={() => toggleMfgCheck(idx)}
                                                        disabled={isReadOnly}
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed transition"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
                                placeholder="Prepared By Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white mt-1 outline-none"
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
                                placeholder="Approved By Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white mt-1 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
