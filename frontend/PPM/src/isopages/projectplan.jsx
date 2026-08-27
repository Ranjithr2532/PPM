import React, { useState, useEffect, useCallback } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getCurrentUserRole } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const DEFAULT_PLAN_TASKS = [];

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

export default function ProjectPlan({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form fields
    const [projectTitle, setProjectTitle] = useState('');
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [projectNo, setProjectNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [totalMonths, setTotalMonths] = useState(6);
    const [commencementDate, setCommencementDate] = useState('');
    const [completionDate, setCompletionDate] = useState('');
    const [tasks, setTasks] = useState(DEFAULT_PLAN_TASKS);
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [docNo, setDocNo] = useState('053');
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    // Load Proposal options
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

    // Load proposal details & pre-fill Research Tasks & Months from ISO Project Proposal if available
    useEffect(() => {
        if (!selectedProposalId) return;
        const p = proposals.find(item => String(item.id) === String(selectedProposalId));
        if (p) {
            setProjectTitle(p.title_of_project || p.quote_description || p.project_name || '');
            setCustomerName(p.customer_name || '');
            setProjectNo(p.project_number || '');
            if (p.commencement_date) setCommencementDate(p.commencement_date);
            if (p.completion_date) setCompletionDate(p.completion_date);
            if (p.duration || p.duration_months) {
                const d = Number(p.duration || p.duration_months);
                if (!isNaN(d) && d > 0) setTotalMonths(d);
            }
        }

        // Fetch associated ISO Project Proposal (Doc 009) to extract research_tasks & dates & total months
        const loadProposalIso = async () => {
            try {
                const subs = await isoSubmissionService.getSubmissions({ proposal_id: selectedProposalId, doc_type: 'PROJECT_PROPOSAL' });
                if (Array.isArray(subs) && subs.length > 0) {
                    const latest = subs[0];
                    const fd = latest.form_data || {};
                    if (fd.title_of_project) setProjectTitle(fd.title_of_project);
                    if (fd.project_no) setProjectNo(fd.project_no);
                    if (fd.commencement_date) setCommencementDate(fd.commencement_date);
                    if (fd.completion_date) setCompletionDate(fd.completion_date);

                    const activeMonthsMap = fd.task_active_months || {};

                    // Extract total months duration
                    let calculatedMonths = 6;
                    if (fd.total_months) {
                        calculatedMonths = Number(fd.total_months) || 6;
                    } else if (fd.commencement_date && fd.completion_date) {
                        try {
                            const [d1, m1, y1] = fd.commencement_date.split(/[-.]/).map(Number);
                            const [d2, m2, y2] = fd.completion_date.split(/[-.]/).map(Number);
                            if (y1 && m1 && y2 && m2) {
                                const diff = (y2 - y1) * 12 + (m2 - m1) + 1;
                                if (diff > 0) calculatedMonths = diff;
                            }
                        } catch (e) {}
                    }

                    // Check max month in activeMonthsMap
                    Object.values(activeMonthsMap).forEach(list => {
                        if (Array.isArray(list)) {
                            list.forEach(m => {
                                const mInt = Number(m);
                                if (!isNaN(mInt) && mInt > calculatedMonths) calculatedMonths = mInt;
                            });
                        }
                    });

                    if (calculatedMonths > 0) setTotalMonths(Math.min(12, calculatedMonths));

                    if (Array.isArray(fd.research_tasks) && fd.research_tasks.length > 0) {
                        const extractedTasks = fd.research_tasks.map((rt, idx) => {
                            let rawName = typeof rt === 'string' ? rt : (rt.task_name || rt.name || '');
                            const cleanedName = rawName.replace(/^\d+\.\s*/, '').trim();

                            let activeWeeks = [];
                            const monthsSel = activeMonthsMap[idx] || activeMonthsMap[String(idx)] || [];
                            if (Array.isArray(monthsSel)) {
                                monthsSel.forEach(m => {
                                    const mInt = Number(m);
                                    if (!isNaN(mInt) && mInt > 0) {
                                        for (let w = 1; w <= 4; w++) {
                                            activeWeeks.push((mInt - 1) * 4 + w);
                                        }
                                    }
                                });
                            }

                            return {
                                sl_no: String(idx + 1),
                                sub_no: '',
                                task_name: cleanedName || rawName,
                                active_weeks: activeWeeks
                            };
                        });

                        // Only pre-fill tasks if current tasks list is empty
                        setTasks(prev => (prev.length === 0 ? extractedTasks : prev));
                    }
                }
            } catch (err) {
                console.error('Error fetching ISO proposal details for plan:', err);
            }
        };

        loadProposalIso();
    }, [selectedProposalId, proposals]);

    // Handle week toggle on task
    const toggleTaskWeek = (taskIndex, weekNumber) => {
        if (isReadOnly) return;
        setTasks(prev => {
            const next = [...prev];
            const currentWeeks = next[taskIndex].active_weeks || [];
            if (currentWeeks.includes(weekNumber)) {
                next[taskIndex] = {
                    ...next[taskIndex],
                    active_weeks: currentWeeks.filter(w => w !== weekNumber)
                };
            } else {
                next[taskIndex] = {
                    ...next[taskIndex],
                    active_weeks: [...currentWeeks, weekNumber].sort((a, b) => a - b)
                };
            }
            return next;
        });
    };

    const handleAddMainTask = () => {
        if (isReadOnly) return;
        setTasks(prev => {
            const lastMainTask = [...prev].reverse().find(t => t.sl_no && !t.sub_no);
            const nextSl = lastMainTask ? (Number(lastMainTask.sl_no) + 1 || prev.length + 1) : (prev.length + 1);
            return [
                ...prev,
                { sl_no: String(nextSl), sub_no: '', task_name: 'New Activity / Main Task', active_weeks: [] }
            ];
        });
    };

    const handleAddSubTask = () => {
        if (isReadOnly) return;
        setTasks(prev => {
            const lastSubTask = [...prev].reverse().find(t => t.sub_no);
            let nextSub = 'a';
            if (lastSubTask && lastSubTask.sub_no) {
                const charCode = lastSubTask.sub_no.charCodeAt(0);
                nextSub = String.fromCharCode(charCode + 1);
            }
            return [
                ...prev,
                { sl_no: '', sub_no: nextSub, task_name: 'New Sub-task / Activity', active_weeks: [] }
            ];
        });
    };

    const handleInsertSubTask = (index) => {
        if (isReadOnly) return;
        setTasks(prev => {
            const next = [...prev];
            const currentTask = next[index];

            let nextSub = 'a';
            if (currentTask && currentTask.sub_no && currentTask.sub_no.length === 1) {
                const charCode = currentTask.sub_no.charCodeAt(0);
                nextSub = String.fromCharCode(charCode + 1);
            }

            const newSubTask = {
                sl_no: '',
                sub_no: nextSub,
                task_name: 'New Sub-activity',
                active_weeks: []
            };

            next.splice(index + 1, 0, newSubTask);
            return next;
        });
    };

    const handleDeleteTask = (index) => {
        if (isReadOnly) return;
        setTasks(prev => prev.filter((_, i) => i !== index));
    };

    const handleTaskChange = (index, field, value) => {
        if (isReadOnly) return;
        setTasks(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const buildPayload = () => ({
        project_title: projectTitle,
        schedule_title: scheduleTitle,
        project_no: projectNo,
        customer_name: customerName,
        commencement_date: commencementDate,
        completion_date: completionDate,
        total_months: Number(totalMonths) || 6,
        tasks: tasks,
        prepared_by: preparedBy,
        approved_by: approvedBy,
        group_name: getLoggedUserGroup(),
        doc_no: docNo,
        doc_date: docDate,
        filename: `ISO_ProjectPlan_${projectNo || '053'}.docx`
    });

    // Download Word Document (.docx)
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/project-plan/generate`, payload, {
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

    // Save or Submit
    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formDataPayload = buildPayload();

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: 'PROJECT_PLAN',
                document_no: docNo || '053',
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
            alert(`ISO Project Plan ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save project plan.');
        } finally {
            setSubmitting(false);
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

        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            await isoSubmissionService.updateStatus(submissionId, newStatus, comment, userId);
            setStatus(newStatus);
            alert(`ISO Project Plan status updated to ${newStatus}`);
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
                        <h1 className="text-xl font-bold text-slate-800">ISO Project Plan (Document 053)</h1>
                        <p className="text-xs text-slate-500">Project Schedule & Gantt Chart Execution Matrix</p>
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

            {/* Document Form Area */}
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
                {/* Header Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-300 p-4 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-10 object-contain" />
                            <span className="font-bold text-slate-800 text-sm">CMTI</span>
                        </div>
                        <div className="col-span-6 text-center border-x border-slate-300 px-2">
                            <h2 className="text-lg font-bold text-slate-900 tracking-wide uppercase">PROJECT PLAN</h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: CMTI-SMC-QMS-053/Rev00</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/053</div>
                            <div><strong>Page:</strong> 1 of 1</div>
                        </div>
                    </div>

                    {/* Proposal Selector & Metadata */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Link Proposal</label>
                            <select
                                value={selectedProposalId}
                                onChange={(e) => setSelectedProposalId(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
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
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project / Customer Title</label>
                            <input
                                type="text"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. BEL Industry 4.0 Pilot Project"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Schedule Sub-title</label>
                            <input
                                type="text"
                                value={scheduleTitle}
                                onChange={(e) => setScheduleTitle(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="e.g. MES Software Development & Implementation Schedule"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Total Duration (Months)</label>
                            <select
                                value={totalMonths}
                                onChange={(e) => setTotalMonths(Number(e.target.value))}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                    <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''} ({m * 4} Weeks)</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label>
                            <input
                                type="text"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                                disabled={isReadOnly}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Approved By</label>
                            <input
                                type="text"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Approver Name / Center Head"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Interactive Schedule Matrix / Gantt Chart Table */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">Project Tasks & Weekly Schedule Matrix</h3>
                        {!isReadOnly && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAddMainTask}
                                    className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 transition"
                                >
                                    <PlusOutlined /> Add Main Task
                                </button>
                                <button
                                    onClick={handleAddSubTask}
                                    className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition"
                                >
                                    <PlusOutlined /> Add Sub-task
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                    <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sl#</th>
                                    <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sub</th>
                                    <th className="p-1.5 border-r border-slate-300 text-left min-w-[200px] text-[11px]" rowSpan={2}>Task / Activity Description</th>
                                    {Array.from({ length: totalMonths }).map((_, mIdx) => (
                                        <th key={mIdx} colSpan={4} className="p-1 border-r border-slate-300 text-center bg-blue-50/80 font-bold text-[11px]">
                                            MONTH {mIdx + 1}
                                        </th>
                                    ))}
                                    {!isReadOnly && <th className="p-1.5 text-center min-w-[90px] text-[11px]" rowSpan={2}>Action</th>}
                                </tr>
                                <tr className="bg-slate-50 text-slate-600 border-b border-slate-300">
                                    {Array.from({ length: totalMonths * 4 }).map((_, wIdx) => (
                                        <th key={wIdx} className="p-0.5 border-r border-slate-300 text-center text-[10px] w-6 bg-slate-100/60 font-semibold">
                                            {(wIdx % 4) + 1}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task, tIdx) => {
                                    const isMainHdr = Boolean(task.sl_no && !task.sub_no);
                                    return (
                                        <tr key={tIdx} className={`border-b border-slate-200 transition hover:bg-slate-50/80 ${isMainHdr ? 'bg-slate-50/70 font-semibold' : ''}`}>
                                            <td className="p-1 border-r border-slate-200 text-center">
                                                <input
                                                    type="text"
                                                    value={task.sl_no || ''}
                                                    onChange={(e) => handleTaskChange(tIdx, 'sl_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-center text-xs bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-slate-200 text-center">
                                                <input
                                                    type="text"
                                                    value={task.sub_no || ''}
                                                    onChange={(e) => handleTaskChange(tIdx, 'sub_no', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full text-center text-xs bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded"
                                                />
                                            </td>
                                            <td className="p-1.5 border-r border-slate-200">
                                                <input
                                                    type="text"
                                                    value={task.task_name || ''}
                                                    onChange={(e) => handleTaskChange(tIdx, 'task_name', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className={`w-full text-xs bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded ${isMainHdr ? 'font-bold text-slate-900' : 'text-slate-700'}`}
                                                />
                                            </td>
                                            {Array.from({ length: totalMonths * 4 }).map((_, wIdx) => {
                                                const weekNum = wIdx + 1;
                                                const isActive = (task.active_weeks || []).includes(weekNum);
                                                return (
                                                    <td
                                                        key={wIdx}
                                                        onClick={() => toggleTaskWeek(tIdx, weekNum)}
                                                        className={`border-r border-slate-200 text-center cursor-pointer select-none transition ${
                                                            isActive
                                                                ? 'bg-blue-600 text-white font-extrabold'
                                                                : 'hover:bg-blue-100/50'
                                                        }`}
                                                    >
                                                        {isActive ? 'X' : ''}
                                                    </td>
                                                );
                                            })}
                                            {!isReadOnly && (
                                                <td className="p-1 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => handleInsertSubTask(tIdx)}
                                                            title="Add Sub-task directly below this row"
                                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 transition flex items-center gap-0.5"
                                                        >
                                                            <PlusOutlined className="text-[9px]" /> Subtask
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTask(tIdx)}
                                                            title="Delete this task row"
                                                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition"
                                                        >
                                                            <DeleteOutlined />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
