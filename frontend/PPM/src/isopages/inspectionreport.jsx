import React, { useState, useEffect } from 'react';
import {
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    TableOutlined
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

export default function InspectionReport({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Info block fields
    const [reportNo, setReportNo] = useState('');
    const [date, setDate] = useState(getTodayDateString());
    const [projectNo, setProjectNo] = useState('');
    const [type, setType] = useState('');
    const [drawingNo, setDrawingNo] = useState('');
    const [drawingName, setDrawingName] = useState('');
    const [quantity, setQuantity] = useState('');

    // Dynamic Measurement Rows
    const [rows, setRows] = useState([
        { sl_no: '1', specified_dimensions: '', drawing_zone: '', measured_values: '', instrument_used: '', remarks: '' }
    ]);

    // Footer & Signatures
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('085');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    // Load Proposals list
    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/`);
                if (Array.isArray(res.data)) setProposals(res.data);
            } catch (err) {
                console.error('Failed to load proposals:', err);
            }
        };
        fetchProposals();
    }, []);

    // Auto-fill project info when a proposal is selected
    useEffect(() => {
        if (!selectedProposalId) return;
        const p = proposals.find(item => String(item.id) === String(selectedProposalId));
        if (p) {
            setProjectNo(p.project_number || '');
            setDrawingName(p.quote_description || p.project_name || '');
        }
    }, [selectedProposalId, proposals]);

    // Load existing submission data if editing
    useEffect(() => {
        const loadSubmission = async (subId) => {
            try {
                const sub = await isoSubmissionService.getSubmissionById(subId);
                if (sub) {
                    setSubmissionId(sub.id);
                    setStatus(sub.status || 'DRAFT');
                    if (sub.proposal_id) setSelectedProposalId(String(sub.proposal_id));

                    const fd = sub.form_data || {};
                    if (fd.report_no) setReportNo(fd.report_no);
                    if (fd.date) setDate(fd.date);
                    if (fd.project_no) setProjectNo(fd.project_no);
                    if (fd.type) setType(fd.type);
                    if (fd.drawing_no) setDrawingNo(fd.drawing_no);
                    if (fd.drawing_name) setDrawingName(fd.drawing_name);
                    if (fd.quantity) setQuantity(fd.quantity);

                    if (Array.isArray(fd.rows)) {
                        setRows(fd.rows);
                    }
                    if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                    if (fd.approved_by) setApprovedBy(fd.approved_by);
                    if (fd.doc_no) setDocNo(fd.doc_no);
                    if (fd.doc_date) setDocDate(fd.doc_date);
                }
            } catch (err) {
                console.error('Failed to load Inspection Report submission:', err);
            }
        };

        if (propSubmissionId) {
            loadSubmission(propSubmissionId);
        }
    }, [propSubmissionId]);

    // Measurement Row Handlers
    const handleAddRow = () => {
        if (isReadOnly) return;
        setRows(prev => [
            ...prev,
            { sl_no: String(prev.length + 1), specified_dimensions: '', drawing_zone: '', measured_values: '', instrument_used: '', remarks: '' }
        ]);
    };

    const handleRemoveRow = (rowIdx) => {
        if (isReadOnly) return;
        setRows(prev => {
            const next = prev.filter((_, i) => i !== rowIdx);
            // Re-sequence Sl. Nos
            return next.map((r, i) => ({ ...r, sl_no: String(i + 1) }));
        });
    };

    const handleCellChange = (rowIdx, field, val) => {
        if (isReadOnly) return;
        setRows(prev => prev.map((row, rI) => {
            if (rI !== rowIdx) return row;
            return { ...row, [field]: val };
        }));
    };

    const buildPayload = () => ({
        report_no: reportNo,
        date: date,
        project_no: projectNo,
        type: type,
        drawing_no: drawingNo,
        drawing_name: drawingName,
        quantity: quantity,
        rows: rows,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        centre_dept: getLoggedUserCentreDept(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_Inspection_Report_${projectNo || '085'}.docx`
    });

    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/inspection-report/generate`, payload, {
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

    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'INSPECTION_REPORT',
                document_no: docNo || '085',
                form_data: formDataPayload,
                status: targetStatus,
                created_by: userId
            };

            let res;
            if (submissionId) {
                res = await isoSubmissionService.updateSubmission(submissionId, payload);
            } else {
                res = await isoSubmissionService.createSubmission(payload);
                if (res && res.id) setSubmissionId(res.id);
            }

            setStatus(res?.status || targetStatus);
            alert(`ISO Inspection Report ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save submission.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        if (!submissionId) return;
        let comment = null;
        if (newStatus === 'REJECTED') {
            comment = prompt('Please enter rejection reason:');
            if (!comment) return;
        }

        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            await isoSubmissionService.updateStatus(submissionId, newStatus, comment, userId);
            setStatus(newStatus);
            alert(`ISO Inspection Report status updated to ${newStatus}`);
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
                        onClick={onClose || onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Inspection Report</h1>
                        <p className="text-xs text-slate-500">Document No: CMTI-QMS-085/Rev00</p>
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
                        <>
                            <button
                                onClick={() => handleSaveOrSubmit('DRAFT')}
                                disabled={submitting}
                                className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                            >
                                Save Draft
                            </button>
                            <button
                                onClick={() => handleSaveOrSubmit('SUBMITTED')}
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                            >
                                Submit
                            </button>
                        </>
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
                            <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase">INSPECTION REPORT</h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: CMTI-QMS-085/Rev00</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/085</div>
                            <div><strong>Page:</strong> 1 of 1</div>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Link Proposal</label>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            >
                                <option value="">-- Select Proposal --</option>
                                {proposals.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.project_number ? `${p.project_number} - ` : ''}{p.quote_description || p.customer_name || `Proposal #${p.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Report No.</label>
                            <input
                                type="text"
                                value={reportNo}
                                onChange={(e) => setReportNo(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Report Number"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                            <input
                                type="text"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="DD.MM.YYYY"
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
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                            <input
                                type="text"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. Prototype / Production / Job Work"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Drawing No.</label>
                            <input
                                type="text"
                                value={drawingNo}
                                onChange={(e) => setDrawingNo(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Drawing Number"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Drawing Name / Item Description</label>
                            <input
                                type="text"
                                value={drawingName}
                                onChange={(e) => setDrawingName(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Drawing Name"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                            <input
                                type="text"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Quantity"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Measurement Entries Table */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <TableOutlined className="text-indigo-600" /> Measurement Entries
                        </h3>
                        {!isReadOnly && (
                            <button
                                onClick={handleAddRow}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm"
                            >
                                <PlusOutlined /> Add Measurement Row
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    <th className="p-2 border-r border-slate-300 text-center font-bold w-16">Sl No</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold min-w-[150px]">Specified Dimensions</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold min-w-[100px]">Drawing Zone</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold min-w-[150px]">Measured Values</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold min-w-[180px]">Instrument used (with Serial No)</th>
                                    <th className="p-2 border-r border-slate-300 text-center font-bold min-w-[150px]">Remarks</th>
                                    {!isReadOnly && <th className="p-2 w-12 text-center font-bold">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={isReadOnly ? 6 : 7} className="p-4 text-center text-slate-400 italic">
                                            No measurement entries added yet. Click "Add Measurement Row" to start.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                            <td className="p-2 text-center border-r border-slate-200 font-medium text-slate-500">
                                                <input
                                                    type="text"
                                                    value={row.sl_no || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'sl_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none text-center outline-none"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.specified_dimensions || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'specified_dimensions', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.drawing_zone || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'drawing_zone', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1 text-center"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.measured_values || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'measured_values', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.instrument_used || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'instrument_used', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={row.remarks || ''}
                                                    onChange={(e) => handleCellChange(rowIdx, 'remarks', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-xs bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-500 rounded p-1"
                                                />
                                            </td>
                                            {!isReadOnly && (
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => handleRemoveRow(rowIdx)}
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
                    <div className="text-[11px] text-slate-500 text-right italic pr-1">
                        (All dimensions in mm unless stated specifically)
                    </div>
                </div>

                {/* Footer Signatures Setup */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl">
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Inspected By</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Inspected By (Name)</label>
                                <input
                                    type="text"
                                    value={preparedBy}
                                    onChange={(e) => setPreparedBy(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Inspector Name"
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white mt-1 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Sign Date</label>
                                <input
                                    type="text"
                                    value={docDate}
                                    onChange={(e) => setDocDate(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="DD.MM.YYYY"
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white mt-1 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Approved By</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Approved By (Name)</label>
                                <input
                                    type="text"
                                    value={approvedBy}
                                    onChange={(e) => setApprovedBy(e.target.value)}
                                    disabled={isReadOnly}
                                    placeholder="Approver Name"
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white mt-1 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
