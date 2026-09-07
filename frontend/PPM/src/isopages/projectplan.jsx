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
import { isoSubmissionService, getLoggedUserName, getLoggedUserGroup, getCurrentUserRole } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const DEFAULT_PLAN_TASKS = [];

const getDefaultRevisionCode = (docCode) => {
    const group = getLoggedUserGroup();
    const groupStr = group ? group : '      ';
    return `CMTI-QMS-${groupStr}-${docCode}/Rev00`;
};

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
};

export default function ProjectPlan({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack, docInfo }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    
    // Active plan type: 'PLANNED' | 'ACTUAL'
    const [planType, setPlanType] = useState('PLANNED');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Auto-save draft tracking states & refs
    const isHydratedRef = useRef(false);
    const submissionIdRef = useRef(submissionId);
    const planTypeRef = useRef(planType);
    const statusRef = useRef(status);
    const isSavingRef = useRef(false);
    const [autoSaveState, setAutoSaveState] = useState('idle'); // 'saving', 'saved', 'error', 'idle'
    const [lastSavedAt, setLastSavedAt] = useState(null);

    useEffect(() => {
        submissionIdRef.current = submissionId;
    }, [submissionId]);

    useEffect(() => {
        planTypeRef.current = planType;
    }, [planType]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Track saved submissions for both Planned and Actual plans
    const [plannedSubmission, setPlannedSubmission] = useState(null);
    const [actualSubmission, setActualSubmission] = useState(null);

    // In-memory working cache when switching between tabs
    const [plannedStateCache, setPlannedStateCache] = useState(null);
    const [actualStateCache, setActualStateCache] = useState(null);

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
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('053'));
    const [docDate, setDocDate] = useState(getTodayDateString());

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);
    const isActual = planType === 'ACTUAL';
    const isComparison = planType === 'COMPARISON';

    // Helper to populate form fields from a loaded submission record
    const populateFormFromSubmission = useCallback((rec) => {
        if (!rec) return;
        setSubmissionId(rec.id);
        submissionIdRef.current = rec.id;
        setStatus(rec.status || 'DRAFT');
        statusRef.current = rec.status || 'DRAFT';

        const fData = rec.form_data || {};
        const hData = rec.header_data || {};

        if (hData.code) setRevisionCode(hData.code);
        if (hData.docNo) setDocNo(hData.docNo);
        if (hData.dateStr) setDocDate(hData.dateStr);

        if (fData.project_title) setProjectTitle(fData.project_title);
        if (fData.schedule_title) setScheduleTitle(fData.schedule_title);
        if (fData.project_no) setProjectNo(fData.project_no);
        if (fData.customer_name) setCustomerName(fData.customer_name);
        if (fData.commencement_date !== undefined) setCommencementDate(fData.commencement_date || '');
        if (fData.completion_date !== undefined) setCompletionDate(fData.completion_date || '');
        if (fData.total_months) setTotalMonths(Number(fData.total_months) || 6);
        if (Array.isArray(fData.tasks)) setTasks(fData.tasks);
        if (fData.prepared_by) setPreparedBy(fData.prepared_by);
        if (fData.approved_by) setApprovedBy(fData.approved_by || '');
        if (fData.doc_no) setDocNo(fData.doc_no);
        if (fData.doc_date) setDocDate(fData.doc_date);

        const recType = (fData.plan_type || (rec.doc_type === 'PROJECT_PLAN_ACTUAL' || rec.doc_type === 'ACTUAL_PROJECT_PLAN' ? 'ACTUAL' : 'PLANNED')).toUpperCase();
        setPlanType(recType);
        planTypeRef.current = recType;

        setTimeout(() => {
            isHydratedRef.current = true;
        }, 300);
    }, []);

    // Fetch dynamic doc number / code from docInfo or /iso-document-list/
    useEffect(() => {
        async function fetchDocDetails() {
            try {
                if (docInfo && (docInfo.document_no || docInfo.code)) {
                    const rawDocNo = (docInfo.document_no || '053').trim();
                    const cleanDocNo = rawDocNo.padStart(3, '0');
                    setDocNo(cleanDocNo);
                    const group = getLoggedUserGroup() || '      ';
                    setRevisionCode(`CMTI-QMS-${group}-${cleanDocNo}/Rev00`);
                    return;
                }
                const res = await axios.get(`${API_BASE_URL}/iso-document-list/`);
                if (Array.isArray(res.data)) {
                    const matched = res.data.find(d =>
                        (d.document_no && (d.document_no.trim() === '053' || d.document_no.trim() === '53')) ||
                        (d.name && (d.name.toLowerCase().includes('plan') || d.name.toLowerCase().includes('schedule')))
                    );
                    if (matched) {
                        const rawDocNo = (matched.document_no || '053').trim();
                        const cleanDocNo = rawDocNo.padStart(3, '0');
                        setDocNo(cleanDocNo);
                        const group = getLoggedUserGroup() || '      ';
                        setRevisionCode(`CMTI-QMS-${group}-${cleanDocNo}/Rev00`);
                    }
                }
            } catch (err) {
                console.error('Failed to load ISO doc details for Plan:', err);
            }
        }
        fetchDocDetails();
    }, [docInfo]);

    // Load existing submissions (Planned & Actual) for this proposal / submission ID
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('id') || searchParams.get('submission_id');
        const urlPropId = propProposalId || searchParams.get('proposal_id');

        const effectivePropId = urlPropId || selectedProposalId;
        if (urlPropId) setSelectedProposalId(String(urlPropId));

        async function loadSubmissions() {
            try {
                let currentSub = null;
                if (urlId) {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) currentSub = res.data;
                }

                const propToQuery = currentSub?.proposal_id || effectivePropId;
                if (propToQuery) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: propToQuery });
                    const planSubs = (subs || []).filter(s =>
                        s.doc_type === 'PROJECT_PLAN' ||
                        s.doc_type === 'PROJECT_PLAN_ACTUAL' ||
                        s.doc_type === 'ACTUAL_PROJECT_PLAN' ||
                        (s.document_no && s.document_no.trim() === '053')
                    );

                    let pSub = planSubs.find(s =>
                        (s.doc_type === 'PROJECT_PLAN' && s.form_data?.plan_type !== 'ACTUAL') ||
                        s.form_data?.plan_type === 'PLANNED'
                    );
                    let aSub = planSubs.find(s =>
                        s.doc_type === 'PROJECT_PLAN_ACTUAL' ||
                        s.doc_type === 'ACTUAL_PROJECT_PLAN' ||
                        s.form_data?.plan_type === 'ACTUAL'
                    );

                    setPlannedSubmission(pSub || null);
                    setActualSubmission(aSub || null);

                    if (currentSub) {
                        const isCurrentActual = currentSub.doc_type === 'PROJECT_PLAN_ACTUAL' ||
                            currentSub.doc_type === 'ACTUAL_PROJECT_PLAN' ||
                            currentSub.form_data?.plan_type === 'ACTUAL';

                        if (isCurrentActual) {
                            aSub = currentSub;
                            setActualSubmission(currentSub);
                        } else {
                            pSub = currentSub;
                            setPlannedSubmission(currentSub);
                        }
                        populateFormFromSubmission(currentSub);
                    } else if (pSub) {
                        populateFormFromSubmission(pSub);
                    } else if (aSub) {
                        populateFormFromSubmission(aSub);
                    }
                } else if (currentSub) {
                    populateFormFromSubmission(currentSub);
                }
            } catch (err) {
                console.error('Failed to load project plan submissions:', err);
            }
        }

        loadSubmissions();
    }, [propSubmissionId, propProposalId, populateFormFromSubmission]);

    // Load proposals list (for fallback matching)
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

    // Fetch and auto-fill proposal details directly for the selected proposal (if in planned mode and new)
    useEffect(() => {
        const effectivePropId = propProposalId || selectedProposalId;
        if (!effectivePropId) return;

        // If a submission is already loaded, avoid overwriting with defaults
        if (submissionId || plannedSubmission) return;

        const loadProposalDetails = async () => {
            try {
                // 1. Fetch proposal details
                let p = proposals.find(item => String(item.id) === String(effectivePropId));
                if (!p) {
                    const pRes = await axios.get(`${API_BASE_URL}/proposals/${effectivePropId}`);
                    p = pRes.data;
                }
                if (p) {
                    setProjectTitle(prev => prev || p.title_of_project || p.quote_description || p.project_name || p.activity || '');
                    setCustomerName(prev => prev || p.customer_name || '');
                    setProjectNo(prev => prev || p.project_number || '');
                    if (p.commencement_date) setCommencementDate(prev => prev || p.commencement_date);
                    if (p.completion_date) setCompletionDate(prev => prev || p.completion_date);
                    if (p.duration || p.duration_months) {
                        const d = Number(p.duration || p.duration_months);
                        if (!isNaN(d) && d > 0) setTotalMonths(prev => prev || d);
                    }
                }

                // 2. Fetch associated ISO Project Proposal (Doc 009) to extract research_tasks & dates & total months
                const subs = await isoSubmissionService.getSubmissions({ proposal_id: effectivePropId, doc_type: 'PROJECT_PROPOSAL' });
                if (Array.isArray(subs) && subs.length > 0) {
                    const latest = subs[0];
                    const fd = latest.form_data || {};
                    if (fd.title_of_project) setProjectTitle(prev => prev || fd.title_of_project);
                    if (fd.project_no) setProjectNo(prev => prev || fd.project_no);
                    if (fd.commencement_date) setCommencementDate(prev => prev || fd.commencement_date);
                    if (fd.completion_date) setCompletionDate(prev => prev || fd.completion_date);

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
                        } catch (e) { }
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

                    if (calculatedMonths > 0) setTotalMonths(prev => prev || Math.min(12, calculatedMonths));

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
                console.error('Error fetching proposal details for plan:', err);
            } finally {
                setTimeout(() => {
                    isHydratedRef.current = true;
                }, 400);
            }
        };

        loadProposalDetails();
    }, [propProposalId, selectedProposalId, proposals, submissionId, plannedSubmission]);

    // Mouse drag-selection states for Gantt week matrix
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState('ADD'); // 'ADD' or 'REMOVE'
    const [dragTaskIdx, setDragTaskIdx] = useState(null);

    // Global mouseup listener to end drag anywhere on screen
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsDragging(false);
            setDragTaskIdx(null);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Handle week toggle on single click
    const toggleTaskWeek = (taskIndex, weekNumber) => {
        if (isReadOnly || isComparison) return;
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

    // Handle week drag start (mouse down on cell)
    const handleCellMouseDown = (taskIndex, weekNumber, e) => {
        if (isReadOnly || isComparison) return;
        if (e.button !== 0) return; // Only trigger on primary left-click
        e.preventDefault();

        const currentWeeks = tasks[taskIndex]?.active_weeks || [];
        const isCurrentlyActive = currentWeeks.includes(weekNumber);
        const mode = isCurrentlyActive ? 'REMOVE' : 'ADD';

        setIsDragging(true);
        setDragMode(mode);
        setDragTaskIdx(taskIndex);

        setTasks(prev => {
            const next = [...prev];
            const curTask = { ...next[taskIndex] };
            let updatedWeeks = [...(curTask.active_weeks || [])];
            if (mode === 'ADD') {
                if (!updatedWeeks.includes(weekNumber)) {
                    updatedWeeks.push(weekNumber);
                }
            } else {
                updatedWeeks = updatedWeeks.filter(w => w !== weekNumber);
            }
            curTask.active_weeks = updatedWeeks.sort((a, b) => a - b);
            next[taskIndex] = curTask;
            return next;
        });
    };

    // Handle week drag over (mouse enter on cell during drag)
    const handleCellMouseEnter = (taskIndex, weekNumber) => {
        if (!isDragging || isReadOnly || isComparison) return;
        if (taskIndex !== dragTaskIdx) return; // Keep drag action focused on current task row

        setTasks(prev => {
            const next = [...prev];
            const curTask = { ...next[taskIndex] };
            let updatedWeeks = [...(curTask.active_weeks || [])];
            if (dragMode === 'ADD') {
                if (!updatedWeeks.includes(weekNumber)) {
                    updatedWeeks.push(weekNumber);
                }
            } else {
                updatedWeeks = updatedWeeks.filter(w => w !== weekNumber);
            }
            curTask.active_weeks = updatedWeeks.sort((a, b) => a - b);
            next[taskIndex] = curTask;
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

    const handleCreateActualPlan = () => {
        // Cache current planned state
        setPlannedStateCache({
            projectTitle,
            scheduleTitle,
            projectNo,
            customerName,
            totalMonths,
            commencementDate,
            completionDate,
            tasks,
            preparedBy,
            approvedBy,
            docNo,
            revisionCode,
            docDate,
            submissionId,
            status
        });

        // If an actual submission already exists in DB, load it
        if (actualSubmission) {
            populateFormFromSubmission(actualSubmission);
            setPlanType('ACTUAL');
            return;
        }

        // If an actual state was already cached in memory during this session, restore it
        if (actualStateCache) {
            setProjectTitle(actualStateCache.projectTitle);
            setScheduleTitle(actualStateCache.scheduleTitle);
            setProjectNo(actualStateCache.projectNo);
            setCustomerName(actualStateCache.customerName);
            setTotalMonths(actualStateCache.totalMonths);
            setCommencementDate(actualStateCache.commencementDate);
            setCompletionDate(actualStateCache.completionDate);
            setTasks(actualStateCache.tasks);
            setPreparedBy(actualStateCache.preparedBy);
            setApprovedBy(actualStateCache.approvedBy);
            setSubmissionId(actualStateCache.submissionId || null);
            setStatus(actualStateCache.status || 'DRAFT');
            setPlanType('ACTUAL');
            return;
        }

        // Derive new Actual Plan from Planned Plan:
        // Copy: project information, task names, task structure (sl_no, sub_no), static definition fields
        // DO NOT COPY: actual start/end dates, actual duration/weeks, actual progress/completion
        const derivedActualTasks = (tasks || []).map(t => ({
            sl_no: t.sl_no || '',
            sub_no: t.sub_no || '',
            task_name: t.task_name || '',
            active_weeks: [] // CRITICAL: Gantt chart active execution weeks empty
        }));

        setSubmissionId(null);
        setStatus('DRAFT');
        setPlanType('ACTUAL');
        setCommencementDate(''); // Empty for real execution tracking
        setCompletionDate('');   // Empty for real execution tracking
        setTasks(derivedActualTasks);
        setScheduleTitle(scheduleTitle ? `${scheduleTitle} (Actual)` : 'Actual Project Execution Schedule');
        setApprovedBy('');

        alert('Actual Project Plan created successfully with task structure from Planned Plan.\n\nActual start/end dates and Gantt execution weeks are empty for real-world execution tracking.');
    };

    const handleSwitchToPlannedPlan = () => {
        // Cache current actual state in memory
        setActualStateCache({
            projectTitle,
            scheduleTitle,
            projectNo,
            customerName,
            totalMonths,
            commencementDate,
            completionDate,
            tasks,
            preparedBy,
            approvedBy,
            docNo,
            revisionCode,
            docDate,
            submissionId,
            status
        });

        if (plannedSubmission) {
            populateFormFromSubmission(plannedSubmission);
        } else if (plannedStateCache) {
            setProjectTitle(plannedStateCache.projectTitle);
            setScheduleTitle(plannedStateCache.scheduleTitle);
            setProjectNo(plannedStateCache.projectNo);
            setCustomerName(plannedStateCache.customerName);
            setTotalMonths(plannedStateCache.totalMonths);
            setCommencementDate(plannedStateCache.commencementDate || '');
            setCompletionDate(plannedStateCache.completionDate || '');
            setTasks(plannedStateCache.tasks);
            setPreparedBy(plannedStateCache.preparedBy);
            setApprovedBy(plannedStateCache.approvedBy);
            setSubmissionId(plannedStateCache.submissionId || null);
            setStatus(plannedStateCache.status || 'DRAFT');
        }
        setPlanType('PLANNED');
    };

    const handleSwitchToComparison = () => {
        // Cache current working state
        if (planType === 'PLANNED') {
            setPlannedStateCache({
                projectTitle,
                scheduleTitle,
                projectNo,
                customerName,
                totalMonths,
                tasks,
                preparedBy,
                approvedBy,
                docNo,
                revisionCode,
                docDate,
                submissionId,
                status
            });
        } else if (planType === 'ACTUAL') {
            setActualStateCache({
                projectTitle,
                scheduleTitle,
                projectNo,
                customerName,
                totalMonths,
                tasks,
                preparedBy,
                approvedBy,
                docNo,
                revisionCode,
                docDate,
                submissionId,
                status
            });
        }
        setPlanType('COMPARISON');
    };

    const buildPayload = () => {
        const isActual = planType === 'ACTUAL';
        return {
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
            plan_type: planType,
            planned_submission_id: plannedSubmission?.id || plannedStateCache?.submissionId || null,
            filename: isActual ? `ISO_Actual_ProjectPlan_${projectNo || '053'}.docx` : `ISO_ProjectPlan_${projectNo || '053'}.docx`
        };
    };

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

    // Download Comparison Word Document (.docx)
    const handleGenerateComparisonDoc = async () => {
        setGenerating(true);
        try {
            const plannedTasksList = plannedStateCache?.tasks || plannedSubmission?.form_data?.tasks || (planType === 'PLANNED' ? tasks : DEFAULT_PLAN_TASKS);
            const actualTasksList = actualStateCache?.tasks || actualSubmission?.form_data?.tasks || (planType === 'ACTUAL' ? tasks : []);
            const monthsVal = Math.max(Number(totalMonths) || 6, plannedStateCache?.totalMonths || 6, actualStateCache?.totalMonths || 6);

            const payload = {
                project_title: projectTitle || plannedStateCache?.projectTitle || actualStateCache?.projectTitle,
                schedule_title: scheduleTitle || "Planned vs Actual Schedule Execution & Variance Matrix",
                project_no: projectNo || plannedStateCache?.projectNo || actualStateCache?.projectNo,
                customer_name: customerName || plannedStateCache?.customerName || actualStateCache?.customerName,
                total_months: monthsVal,
                planned_tasks: plannedTasksList,
                actual_tasks: actualTasksList,
                prepared_by: preparedBy,
                approved_by: approvedBy,
                group_name: getLoggedUserGroup(),
                doc_no: docNo,
                doc_date: docDate,
                filename: `ISO_ProjectPlan_Comparison_${projectNo || '053'}.docx`
            };

            const res = await axios.post(`${API_BASE_URL}/iso/project-plan/generate-comparison`, payload, {
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
            console.error('Word doc comparison generation error:', err);
            alert('Failed to generate Comparison Word document.');
        } finally {
            setGenerating(false);
        }
    };

    // Robust Auto-Save Draft to Database
    const performAutoSave = useCallback(async () => {
        if (isReadOnly || isComparison) return;
        if (!isHydratedRef.current) return;
        if (isSavingRef.current) return;

        isSavingRef.current = true;
        setAutoSaveState('saving');
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const isActual = planTypeRef.current === 'ACTUAL';
            const formDataPayload = {
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
                plan_type: planTypeRef.current,
                planned_submission_id: plannedSubmission?.id || plannedStateCache?.submissionId || null,
                filename: isActual ? `ISO_Actual_ProjectPlan_${projectNo || '053'}.docx` : `ISO_ProjectPlan_${projectNo || '053'}.docx`
            };

            const headerData = {
                documentTitle: isActual ? 'ACTUAL PROJECT PLAN' : 'PROJECT PLAN',
                docNo: docNo || '053',
                code: revisionCode,
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: getLoggedUserGroup() || '',
                groupName: revisionCode,
                preparedName: preparedBy || getLoggedUserName(),
                approvedName: approvedBy,
            };

            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: isActual ? 'PROJECT_PLAN_ACTUAL' : 'PROJECT_PLAN',
                document_no: docNo || '053',
                header_data: headerData,
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

            if (res) {
                if (isActual) {
                    setActualSubmission(res);
                } else {
                    setPlannedSubmission(res);
                }
            }
            setAutoSaveState('saved');
            setLastSavedAt(new Date());
        } catch (err) {
            console.error('Auto-save draft error:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, isComparison, projectTitle, scheduleTitle, projectNo, customerName, commencementDate, completionDate, totalMonths, tasks, preparedBy, approvedBy, docNo, revisionCode, docDate, selectedProposalId, plannedSubmission, plannedStateCache]);

    // Debounced Auto-Save on any field / week changes
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly || isComparison) return;

        const timer = setTimeout(() => {
            performAutoSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [projectTitle, scheduleTitle, projectNo, customerName, totalMonths, tasks, preparedBy, approvedBy, docNo, revisionCode, docDate, planType, performAutoSave, isReadOnly, isComparison]);

    // Immediate flush on page refresh / tab close
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isHydratedRef.current && !isReadOnly && !isComparison) {
                performAutoSave();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (isHydratedRef.current && !isReadOnly && !isComparison) {
                performAutoSave();
            }
        };
    }, [performAutoSave, isReadOnly, isComparison]);

    // Save or Submit
    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const isActual = planType === 'ACTUAL';
            const formDataPayload = buildPayload();
            const headerData = {
                documentTitle: isActual ? 'ACTUAL PROJECT PLAN' : 'PROJECT PLAN',
                docNo: docNo || '053',
                code: revisionCode,
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: getLoggedUserGroup() || '',
                groupName: revisionCode,
                preparedName: preparedBy || getLoggedUserName(),
                approvedName: approvedBy,
            };

            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                doc_type: isActual ? 'PROJECT_PLAN_ACTUAL' : 'PROJECT_PLAN',
                document_no: docNo || '053',
                header_data: headerData,
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

            if (isActual) {
                setActualSubmission(res);
            } else {
                setPlannedSubmission(res);
            }

            const planName = isActual ? 'Actual Project Plan' : 'Planned Project Plan';
            alert(`ISO ${planName} ${targetStatus === 'SUBMITTED' ? 'Submitted for Approval' : 'Saved'} successfully!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save project plan.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Back or Close with automatic draft flush
    const handleCloseOrBack = async () => {
        if (isHydratedRef.current && !isReadOnly && !isComparison) {
            await performAutoSave();
        }
        if (onClose) onClose();
        else if (onBack) onBack();
    };

    // Approval / Rejection
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
            alert(`ISO Project Plan status updated to ${newStatus}`);
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status.');
        }
    };

    // Comparison datasets
    const plannedTasksForComparison = plannedStateCache?.tasks || plannedSubmission?.form_data?.tasks || (planType === 'PLANNED' ? tasks : DEFAULT_PLAN_TASKS);
    const actualTasksForComparison = actualStateCache?.tasks || actualSubmission?.form_data?.tasks || (planType === 'ACTUAL' ? tasks : []);
    const compTotalMonths = Math.max(1, Number(totalMonths) || 1, Number(plannedSubmission?.form_data?.total_months) || 1, Number(actualSubmission?.form_data?.total_months) || 1);
    const maxCompTasksLen = Math.max(plannedTasksForComparison.length, actualTasksForComparison.length);

    // Summary KPI metrics for Comparison
    const totalPlannedWeeks = plannedTasksForComparison.reduce((sum, t) => sum + (t.active_weeks || []).length, 0);
    const totalActualWeeks = actualTasksForComparison.reduce((sum, t) => sum + (t.active_weeks || []).length, 0);
    let totalOverrunWeeks = 0;
    actualTasksForComparison.forEach((aTask, idx) => {
        const pTask = plannedTasksForComparison[idx] || {};
        const pWeeks = pTask.active_weeks || [];
        const aWeeks = aTask.active_weeks || [];
        aWeeks.forEach(w => {
            if (!pWeeks.includes(w) && pWeeks.length > 0) totalOverrunWeeks += 1;
        });
    });

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Header Controls */}
            <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCloseOrBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                        title="Back (Automatically saves draft)"
                    >
                        <ArrowLeftOutlined className="text-lg" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-800">ISO Project Plan (Doc 053)</h1>
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                isComparison ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                isActual ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                                {isComparison ? '📊 Planned vs Actual Comparison Sheet' :
                                 isActual ? '⏱️ Actual Execution Plan' :
                                 '📋 Planned Baseline Plan'}
                            </span>

                            {/* Auto-Save Draft Status Badge */}
                            {!isComparison && (
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
                            )}
                        </div>
                        <p className="text-xs text-slate-500">Project Schedule & Gantt Chart Execution Matrix</p>
                    </div>
                </div>

                {/* Plan Type Selector Tabs & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Plan Mode Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                        <button
                            onClick={handleSwitchToPlannedPlan}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                planType === 'PLANNED'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-blue-600 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>📋 Planned Plan</span>
                            {plannedSubmission && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                    plannedSubmission.status === 'APPROVED' ? 'bg-emerald-500 text-white' :
                                    plannedSubmission.status === 'SUBMITTED' ? 'bg-amber-400 text-slate-900' :
                                    'bg-slate-200 text-slate-700'
                                }`}>
                                    {plannedSubmission.status}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleCreateActualPlan}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                planType === 'ACTUAL'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>⏱️ Actual Plan</span>
                            {actualSubmission ? (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                    actualSubmission.status === 'APPROVED' ? 'bg-emerald-500 text-white' :
                                    actualSubmission.status === 'SUBMITTED' ? 'bg-amber-400 text-slate-900' :
                                    'bg-slate-200 text-slate-700'
                                }`}>
                                    {actualSubmission.status}
                                </span>
                            ) : (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                    + Create
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleSwitchToComparison}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                planType === 'COMPARISON'
                                    ? 'bg-purple-700 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-purple-700 hover:bg-slate-200/60'
                            }`}
                        >
                            <span>📊 Comparison Sheet</span>
                        </button>
                    </div>

                    {!isComparison && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                            status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                            status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                        }`}>
                            {status}
                        </span>
                    )}

                    {isComparison ? (
                        <button
                            onClick={handleGenerateComparisonDoc}
                            disabled={generating}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                        >
                            <FileWordOutlined /> {generating ? 'Generating...' : 'Comparison Word (.docx)'}
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerateDoc}
                            disabled={generating}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                        >
                            <FileWordOutlined /> {generating ? 'Generating...' : 'Word (.docx)'}
                        </button>
                    )}

                    {!isReadOnly && !isComparison && (
                        <button
                            onClick={() => handleSaveOrSubmit('SUBMITTED')}
                            disabled={submitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                        >
                            {submitting ? 'Submitting...' : `Submit ${isActual ? 'Actual Plan' : 'Plan'}`}
                        </button>
                    )}

                    {isApprover && isSubmitted && !isComparison && (
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

            {/* Document Form / Comparison Area */}
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
                {/* Mode Specific Banner */}
                {isComparison ? (
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-purple-950 text-xs">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-extrabold uppercase tracking-wider bg-purple-700 text-white px-2 py-0.5 rounded text-[10px]">
                                        Variance & Comparison Matrix
                                    </span>
                                    <span className="font-bold text-slate-800 text-sm">Project Schedule Comparison (Planned vs Actual)</span>
                                </div>
                                <p className="text-slate-600 text-xs">
                                    Side-by-side Gantt chart comparison of Planned baseline milestones against Actual execution progress.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleGenerateComparisonDoc}
                                    disabled={generating}
                                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5"
                                >
                                    <FileWordOutlined /> Export Comparison Doc (.docx)
                                </button>
                            </div>
                        </div>

                        {/* Summary KPI Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <div className="text-[11px] font-semibold text-blue-700">Planned Milestones</div>
                                <div className="text-lg font-extrabold text-blue-950 mt-0.5">{plannedTasksForComparison.length} Tasks</div>
                                <div className="text-[10px] text-blue-600 font-medium">{totalPlannedWeeks} Total Planned Weeks</div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <div className="text-[11px] font-semibold text-emerald-700">Actual Executed</div>
                                <div className="text-lg font-extrabold text-emerald-950 mt-0.5">{actualTasksForComparison.length} Tasks Tracked</div>
                                <div className="text-[10px] text-emerald-600 font-medium">{totalActualWeeks} Total Executed Weeks</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="text-[11px] font-semibold text-slate-600">Total Duration Window</div>
                                <div className="text-lg font-extrabold text-slate-900 mt-0.5">{compTotalMonths} Months</div>
                                <div className="text-[10px] text-slate-500 font-medium">{compTotalMonths * 4} Total Matrix Weeks</div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                            <span className="font-bold text-slate-700">Legend:</span>
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center rounded">P</span>
                                <span className="text-slate-600 font-medium">Planned Schedule</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center rounded">A</span>
                                <span className="text-slate-600 font-medium">Actual Execution</span>
                            </div>
                        </div>
                    </div>
                ) : !isActual ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">Planned Baseline</span>
                            <span>This represents the original targeted project plan schedule and Gantt chart milestones.</span>
                        </div>
                        {!actualSubmission && (
                            <button
                                onClick={handleCreateActualPlan}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm whitespace-nowrap flex items-center gap-1"
                            >
                                <PlusOutlined /> Create Actual Plan
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">Actual Execution</span>
                            <span>Task structure and project definitions are derived from the Planned Plan. Mark executed weeks below to track progress.</span>
                        </div>
                        <button
                            onClick={handleSwitchToPlannedPlan}
                            className="text-blue-700 hover:text-blue-900 font-semibold text-xs whitespace-nowrap"
                        >
                            &larr; View Planned Plan
                        </button>
                    </div>
                )}

                {/* Header Table */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-300 p-4 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                            <img src={cmtiLogo} alt="CMTI Logo" className="h-10 object-contain" />
                            <span className="font-bold text-slate-800 text-sm">CMTI</span>
                        </div>
                        <div className="col-span-6 text-center border-x border-slate-300 px-2">
                            <h2 className="text-lg font-bold text-slate-900 tracking-wide uppercase">
                                {isComparison ? 'PROJECT PLAN - COMPARISON SHEET' :
                                 isActual ? 'ACTUAL PROJECT PLAN' : 'PROJECT PLAN'}
                            </h2>
                            <p className="text-xs text-slate-500 font-mono">Document No: {revisionCode}</p>
                        </div>
                        <div className="col-span-3 text-right text-xs font-mono text-slate-600 space-y-1">
                            <div><strong>Ref:</strong> CMTI/QMS/{docNo || '053'}</div>
                            <div><strong>Page:</strong> 1 of 1</div>
                        </div>
                    </div>

                    {/* Metadata Fields */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project / Customer Title</label>
                            <input
                                type="text"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                                disabled={isReadOnly || isComparison}
                                placeholder="e.g. BEL Industry 4.0 Pilot Project"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Schedule Sub-title</label>
                            <input
                                type="text"
                                value={scheduleTitle}
                                onChange={(e) => setScheduleTitle(e.target.value)}
                                disabled={isReadOnly || isComparison}
                                placeholder={isActual ? "e.g. Actual Project Execution Schedule" : "e.g. MES Software Development & Implementation Schedule"}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Project Number</label>
                            <input
                                type="text"
                                value={projectNo}
                                onChange={(e) => setProjectNo(e.target.value)}
                                disabled={isReadOnly || isComparison}
                                placeholder="e.g. ISP2504205"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Total Duration (Months)</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={totalMonths}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setTotalMonths('');
                                    } else {
                                        const num = parseInt(val, 10);
                                        setTotalMonths(isNaN(num) ? '' : num);
                                    }
                                }}
                                onBlur={() => {
                                    if (!totalMonths || Number(totalMonths) < 1) {
                                        setTotalMonths(6);
                                    }
                                }}
                                disabled={isReadOnly || isComparison}
                                placeholder="e.g. 6"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Prepared By</label>
                            <input
                                type="text"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                                disabled={isReadOnly || isComparison}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Approved By</label>
                            <input
                                type="text"
                                value={approvedBy}
                                onChange={(e) => setApprovedBy(e.target.value)}
                                disabled={isReadOnly || isComparison}
                                placeholder="Approver Name / Center Head"
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Interactive Schedule Matrix / Comparison Gantt Chart Table */}
                {isComparison ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    Planned vs Actual Execution Comparison Gantt Matrix
                                </h3>
                                <p className="text-[11px] text-purple-700 font-medium">
                                    Each task displays both Planned (P) baseline and Actual (A) executed weeks.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                        <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sl#</th>
                                        <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sub</th>
                                        <th className="p-1.5 border-r border-slate-300 text-left min-w-[200px] text-[11px]" rowSpan={2}>Task / Activity Description</th>
                                        <th className="p-1 border-r border-slate-300 text-center w-12 text-[10px] font-bold" rowSpan={2}>Type</th>
                                        {Array.from({ length: compTotalMonths }).map((_, mIdx) => (
                                            <th key={mIdx} colSpan={4} className="p-1 border-r border-slate-300 text-center font-bold text-[11px] bg-purple-50 text-purple-900">
                                                MONTH {mIdx + 1}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-300">
                                        {Array.from({ length: compTotalMonths * 4 }).map((_, wIdx) => (
                                            <th key={wIdx} className="p-0.5 border-r border-slate-300 text-center text-[10px] w-6 bg-slate-100/60 font-semibold">
                                                {(wIdx % 4) + 1}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: maxCompTasksLen }).map((_, tIdx) => {
                                        const pTask = plannedTasksForComparison[tIdx] || {};
                                        const aTask = actualTasksForComparison[tIdx] || {};

                                        const sl = pTask.sl_no || aTask.sl_no || '';
                                        const sub = pTask.sub_no || aTask.sub_no || '';
                                        const name = pTask.task_name || aTask.task_name || '';

                                        const pWeeks = pTask.active_weeks || [];
                                        const aWeeks = aTask.active_weeks || [];

                                        const isMainHdr = Boolean(sl && !sub);

                                        return (
                                            <React.Fragment key={tIdx}>
                                                {/* Planned Sub-row */}
                                                <tr className={`border-t border-slate-300 ${isMainHdr ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}`}>
                                                    <td className="p-1 border-r border-slate-200 text-center font-medium" rowSpan={2}>
                                                        {sl}
                                                    </td>
                                                    <td className="p-1 border-r border-slate-200 text-center text-slate-500" rowSpan={2}>
                                                        {sub}
                                                    </td>
                                                    <td className={`p-1.5 border-r border-slate-200 ${isMainHdr ? 'font-bold text-slate-900' : 'text-slate-800'}`} rowSpan={2}>
                                                        {name}
                                                    </td>
                                                    <td className="p-1 border-r border-slate-200 text-center bg-blue-50/80 font-bold text-blue-800 text-[10px]">
                                                        Plan
                                                    </td>
                                                    {Array.from({ length: compTotalMonths * 4 }).map((_, wIdx) => {
                                                        const weekNum = wIdx + 1;
                                                        const isActive = pWeeks.includes(weekNum);
                                                        return (
                                                            <td
                                                                key={wIdx}
                                                                className={`border-r border-slate-200 text-center font-bold select-none ${
                                                                    isActive ? 'bg-blue-600 text-white font-extrabold' : 'bg-white'
                                                                }`}
                                                            >
                                                                {isActive ? 'P' : ''}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>

                                                {/* Actual Sub-row */}
                                                <tr className={`border-b border-slate-300 ${isMainHdr ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}`}>
                                                    <td className="p-1 border-r border-slate-200 text-center bg-emerald-50 font-bold text-emerald-800 text-[10px]">
                                                        Act
                                                    </td>
                                                    {Array.from({ length: compTotalMonths * 4 }).map((_, wIdx) => {
                                                        const weekNum = wIdx + 1;
                                                        const isActive = aWeeks.includes(weekNum);
                                                        return (
                                                            <td
                                                                key={wIdx}
                                                                className={`border-r border-slate-200 text-center font-bold select-none ${
                                                                    isActive ? 'bg-emerald-600 text-white font-black' : 'bg-white'
                                                                }`}
                                                            >
                                                                {isActive ? 'A' : ''}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    {isActual
                                        ? 'Actual Task Execution Matrix'
                                        : 'Planned Tasks & Weekly Schedule Matrix (Target Baseline)'}
                                </h3>
                                <p className={`text-[11px] font-medium ${isActual ? 'text-emerald-700' : 'text-blue-700'}`}>
                                    💡 Click or <span className="font-bold underline">click & drag across weeks</span> to quickly select or deselect schedule blocks.
                                </p>
                            </div>
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

                        <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-sm select-none">
                            <table className="w-full text-xs border-collapse select-none">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                                        <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sl#</th>
                                        <th className="p-1.5 border-r border-slate-300 text-center w-10 text-[11px]" rowSpan={2}>Sub</th>
                                        <th className="p-1.5 border-r border-slate-300 text-left min-w-[200px] text-[11px]" rowSpan={2}>Task / Activity Description</th>
                                        {Array.from({ length: Math.max(1, Number(totalMonths) || 1) }).map((_, mIdx) => (
                                            <th key={mIdx} colSpan={4} className={`p-1 border-r border-slate-300 text-center font-bold text-[11px] ${
                                                isActual ? 'bg-emerald-50 text-emerald-900' : 'bg-blue-50/80 text-blue-900'
                                            }`}>
                                                MONTH {mIdx + 1}
                                            </th>
                                        ))}
                                        {!isReadOnly && <th className="p-1.5 text-center min-w-[90px] text-[11px]" rowSpan={2}>Action</th>}
                                    </tr>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-300">
                                        {Array.from({ length: Math.max(1, Number(totalMonths) || 1) * 4 }).map((_, wIdx) => (
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
                                                {Array.from({ length: Math.max(1, Number(totalMonths) || 1) * 4 }).map((_, wIdx) => {
                                                    const weekNum = wIdx + 1;
                                                    const isActive = (task.active_weeks || []).includes(weekNum);
                                                    return (
                                                        <td
                                                            key={wIdx}
                                                            onMouseDown={(e) => handleCellMouseDown(tIdx, weekNum, e)}
                                                            onMouseEnter={() => handleCellMouseEnter(tIdx, weekNum)}
                                                            className={`border-r border-slate-200 text-center cursor-pointer select-none transition h-7 ${
                                                                isActive
                                                                    ? (isActual ? 'bg-emerald-500 shadow-inner' : 'bg-blue-600 shadow-inner')
                                                                    : (isActual ? 'hover:bg-emerald-100/70 active:bg-emerald-200' : 'hover:bg-blue-100/60 active:bg-blue-200')
                                                            }`}
                                                            title={`Week ${weekNum} (Click or drag to toggle)`}
                                                        >
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
                )}
            </div>
        </div>
    );
}
