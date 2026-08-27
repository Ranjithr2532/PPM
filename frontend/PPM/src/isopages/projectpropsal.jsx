import React, { useState, useEffect } from 'react';
import {
    DownloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    BoldOutlined
} from '@ant-design/icons';
import { DatePicker, message } from 'antd';
import dayjs from 'dayjs';
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

const getCurrentUserRole = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
        if (!rawUser) return 'scientist';
        const parsed = JSON.parse(rawUser);
        const r = (parsed.role || '').toLowerCase().trim();
        if (r === 'centre head' || r === 'center head') return 'ch';
        if (r === 'group head') return 'gh';
        return r || 'scientist';
    } catch (e) {
        return 'scientist';
    }
};

export default function ProjectProposal({ submissionId: propSubmissionId, proposalId: propProposalId, existingRecord, onBack, onSuccess }) {
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [proposalId, setProposalId] = useState(propProposalId || existingRecord?.id || null);
    const [status, setStatus] = useState('DRAFT');

    // Document Header & Metadata State
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode] = useState(getDefaultRevisionCode('009'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [filename, setFilename] = useState('CMTI_Project_Proposal.docx');

    // General Project Details
    const [titleOfProject, setTitleOfProject] = useState(existingRecord?.quote_description || existingRecord?.activity || '');
    const [projectNo, setProjectNo] = useState('');
    const [projectCategory, setProjectCategory] = useState('');
    const [sponsoringAgency, setSponsoringAgency] = useState('');
    const [sanctionOrder, setSanctionOrder] = useState('');
    const [totalCost, setTotalCost] = useState('');

    // Team & Leaders (by default the project leader is the Project Co-ordinator of that proposal)
    const [projectLeader, setProjectLeader] = useState(() => {
        return (
            existingRecord?.project_co_ordinator ||
            existingRecord?.project_coordinator ||
            existingRecord?.quotation_given_by_name ||
            getLoggedUserName() ||
            ''
        );
    });
    const [coLeaders, setCoLeaders] = useState('');
    const [coreStMembers, setCoreStMembers] = useState([]);

    useEffect(() => {
        if (existingRecord) {
            const desc = existingRecord.quote_description || existingRecord.activity || '';
            if (desc) {
                setTitleOfProject(desc);
            }
            const leader = existingRecord.project_co_ordinator || existingRecord.project_coordinator || existingRecord.quotation_given_by_name || getLoggedUserName() || '';
            if (leader) {
                setProjectLeader(leader);
            }
            if (existingRecord.customer_name) {
                setSponsoringAgency(existingRecord.customer_name);
            }
            if (existingRecord.quote_amount) {
                setTotalCost(existingRecord.quote_amount);
            }
        } else if (proposalId || propProposalId) {
            const pid = proposalId || propProposalId;
            async function fetchProposalDetails() {
                try {
                    const res = await axios.get(`${API_BASE_URL}/proposals/${pid}`);
                    if (res.data) {
                        const p = res.data;
                        if (p.quote_description || p.activity) {
                            setTitleOfProject(p.quote_description || p.activity);
                        }
                        const leader = p.project_co_ordinator || p.project_coordinator || p.quotation_given_by_name || getLoggedUserName() || '';
                        if (leader) {
                            setProjectLeader(leader);
                        }
                        if (p.customer_name) {
                            setSponsoringAgency(p.customer_name);
                        }
                        if (p.quote_amount) {
                            setTotalCost(p.quote_amount);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load proposal details for ISO proposal:', e);
                }
            }
            fetchProposalDetails();
        }
    }, [existingRecord, proposalId, propProposalId]);

    // Partners
    const [devPartnersName, setDevPartnersName] = useState('');
    const [devPartnersRoles, setDevPartnersRoles] = useState('');

    // Dates
    const [commencementDate, setCommencementDate] = useState('');
    const [completionDate, setCompletionDate] = useState('');

    // Objectives & Research Tasks
    const [proposedObjectives, setProposedObjectives] = useState([]);
    const [currentStatus, setCurrentStatus] = useState('');
    const [researchTasks, setResearchTasks] = useState([]);
    const [taskActiveMonths, setTaskActiveMonths] = useState({});

    // Financial Budgets
    const [recurringBudget, setRecurringBudget] = useState([]);
    const [nonRecurringBudget, setNonRecurringBudget] = useState([]);

    // Outputs & Tech details
    const [salientAchievements, setSalientAchievements] = useState('');
    const [expectedTrl, setExpectedTrl] = useState('');
    const [iprDetails, setIprDetails] = useState('');
    const [humanResources, setHumanResources] = useState([]);
    const [revenueGenerated, setRevenueGenerated] = useState('');
    const [equipmentDetails, setEquipmentDetails] = useState([]);
    const [infrastructureDetails, setInfrastructureDetails] = useState('');

    const userRole = getCurrentUserRole();
    const isAdmin = ['admin', 'director'].includes(userRole);
    const isApprover = ['ch', 'centre head', 'center head', 'gh', 'group head', 'admin', 'dh'].includes(userRole);
    const isApproved = status === 'APPROVED';
    const isSubmitted = status === 'SUBMITTED';
    // Admin CAN edit any document; Scientists/Approvers viewing SUBMITTED or APPROVED docs are READ-ONLY
    const isReadOnly = isAdmin ? false : (isApproved || isSubmitted || isApprover);

    // Helper to wrap current text in bold formatting (**bold text**)
    const wrapBoldText = (val, setter) => {
        if (!val) {
            setter('**bold text**');
        } else if (val.startsWith('**') && val.endsWith('**')) {
            setter(val.slice(2, -2));
        } else {
            setter(`**${val}**`);
        }
    };

    // Helper to calculate total duration in months dynamically
    const calculateDurationMonths = (startStr, endStr) => {
        if (!startStr || !endStr) return 6;
        try {
            const parseDate = (str) => {
                const clean = String(str).trim();
                const parts = clean.split(/[-/]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) {
                        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    } else if (parts[2].length === 4) {
                        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    }
                }
                const d = new Date(clean);
                return isNaN(d.getTime()) ? null : d;
            };

            const s = parseDate(startStr);
            const e = parseDate(endStr);
            if (s && e && e >= s) {
                const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
                return Math.max(months, 1);
            }
        } catch (err) {
            console.error(err);
        }
        return 6;
    };

    const durationMonths = calculateDurationMonths(commencementDate, completionDate);

    const toggleTaskMonth = (taskIdx, monthNum) => {
        if (isReadOnly) return;
        setTaskActiveMonths((prev) => {
            const currentMonths = prev[taskIdx] || [];
            let updated;
            if (currentMonths.includes(monthNum)) {
                updated = currentMonths.filter((m) => m !== monthNum);
            } else {
                updated = [...currentMonths, monthNum].sort((a, b) => a - b);
            }
            return { ...prev, [taskIdx]: updated };
        });
    };

    // Calculate budget totals live
    const calcSubtotal = (budgetList) => {
        return budgetList.reduce((sum, item) => {
            const val = parseFloat(String(item.budget_amount || '0').replace(/[^\d.]/g, '')) || 0;
            return sum + val;
        }, 0);
    };

    const totalA = calcSubtotal(recurringBudget);
    const totalB = calcSubtotal(nonRecurringBudget);
    const grandTotal = totalA + totalB;

    // Check props or URL parameters to load existing submission
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('id') || searchParams.get('submission_id');

        if (urlId) {
            async function loadSubmission() {
                try {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) {
                        const sub = res.data;
                        setSubmissionId(sub.id);
                        setStatus(sub.status || 'DRAFT');
                        setDocNo(sub.document_no || '');

                        const h = sub.header_data || {};
                        if (h.document_no) setDocNo(h.document_no);
                        if (h.date) setDocDate(h.date);
                        if (h.prepared_by) setPreparedBy(h.prepared_by);
                        if (h.approved_by) setApprovedBy(h.approved_by);

                        const f = sub.form_data || {};
                        if (f.title_of_project) setTitleOfProject(f.title_of_project);
                        if (f.project_no) setProjectNo(f.project_no);
                        if (f.project_category) setProjectCategory(f.project_category);
                        if (f.sponsoring_agency) setSponsoringAgency(f.sponsoring_agency);
                        if (f.sanction_order) setSanctionOrder(f.sanction_order);
                        if (f.total_cost) setTotalCost(f.total_cost);
                        if (f.project_leader) setProjectLeader(f.project_leader);
                        if (f.co_leaders) setCoLeaders(f.co_leaders);
                        if (Array.isArray(f.core_st_members)) setCoreStMembers(f.core_st_members);
                        if (f.dev_partners_name) setDevPartnersName(f.dev_partners_name);
                        if (f.dev_partners_roles) setDevPartnersRoles(f.dev_partners_roles);
                        if (f.commencement_date) setCommencementDate(f.commencement_date);
                        if (f.completion_date) setCompletionDate(f.completion_date);
                        if (Array.isArray(f.proposed_objectives)) setProposedObjectives(f.proposed_objectives);
                        if (f.current_status) setCurrentStatus(f.current_status);
                        if (Array.isArray(f.research_tasks)) setResearchTasks(f.research_tasks);
                        if (f.task_active_months) setTaskActiveMonths(f.task_active_months);
                        if (Array.isArray(f.recurring_budget)) setRecurringBudget(f.recurring_budget);
                        if (Array.isArray(f.non_recurring_budget)) setNonRecurringBudget(f.non_recurring_budget);
                        if (f.salient_achievements) setSalientAchievements(f.salient_achievements);
                        if (f.expected_trl) setExpectedTrl(f.expected_trl);
                        if (f.ipr_details) setIprDetails(f.ipr_details);
                        if (Array.isArray(f.human_resources)) setHumanResources(f.human_resources);
                        if (f.revenue_generated) setRevenueGenerated(f.revenue_generated);
                        if (Array.isArray(f.equipment_details)) setEquipmentDetails(f.equipment_details);
                        if (f.infrastructure_details) setInfrastructureDetails(f.infrastructure_details);
                    }
                } catch (err) {
                    console.error('Failed to load submission:', err);
                    message.error('Could not load ISO submission details');
                }
            }
            loadSubmission();
        }
    }, [propSubmissionId]);

    // Construct Payload
    const buildPayload = () => {
        return {
            title_of_project: titleOfProject,
            project_no: projectNo,
            project_category: projectCategory,
            sponsoring_agency: sponsoringAgency,
            sanction_order: sanctionOrder,
            total_cost: totalCost,
            project_leader: projectLeader,
            co_leaders: coLeaders,
            core_st_members: coreStMembers,
            dev_partners_name: devPartnersName,
            dev_partners_roles: devPartnersRoles,
            commencement_date: commencementDate,
            completion_date: completionDate,
            proposed_objectives: proposedObjectives,
            current_status: currentStatus,
            research_tasks: researchTasks,
            task_active_months: taskActiveMonths,
            recurring_budget: recurringBudget,
            non_recurring_budget: nonRecurringBudget,
            salient_achievements: salientAchievements,
            expected_trl: expectedTrl,
            ipr_details: iprDetails,
            human_resources: humanResources,
            revenue_generated: revenueGenerated,
            equipment_details: equipmentDetails,
            infrastructure_details: infrastructureDetails,
            prepared_by: preparedBy,
            approved_by: approvedBy,
            centre_dept: loggedCentreDept,
            group_name: getLoggedUserGroup(),
            doc_no: docNo,
            doc_date: docDate,
            filename: filename
        };
    };

    // Generate Word Document (.docx)
    const handleGenerateDoc = async () => {
        setGenerating(true);
        try {
            const payload = buildPayload();

            const res = await axios.post(`${API_BASE_URL}/iso/project-proposal/generate`, payload, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            message.success('Project Proposal Word Document downloaded successfully!');
        } catch (err) {
            console.error('Error generating Project Proposal doc:', err);
            message.error('Failed to generate document. Please check required fields.');
        } finally {
            setGenerating(false);
        }
    };

    // Save as Draft or Submit
    const handleSaveSubmission = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            // 1. Create or update record in main proposals database table
            let activePropId = proposalId || propProposalId || (existingRecord ? existingRecord.id : null);

            const proposalPayload = {
                id: activePropId || undefined,
                quote_description: titleOfProject || existingRecord?.quote_description || 'ISO Project Proposal',
                activity: titleOfProject || existingRecord?.activity || 'ISO Project Proposal',
                customer_name: sponsoringAgency || existingRecord?.customer_name || 'N/A',
                quotation_given_by_name: preparedBy || getLoggedUserName() || '',
                project_coordinator: projectLeader || preparedBy || getLoggedUserName() || '',
                quote_amount: totalCost || existingRecord?.quote_amount || '0',
                center: loggedCentreDept || existingRecord?.center || '',
                group: existingRecord?.group || loggedCentreDept || '',
                proposal_status: 'Submitted',
                draft: true,
            };

            const propRes = await axios.post(`${API_BASE_URL}/proposals/add-proposal-coordinator`, proposalPayload);
            const savedPropId = propRes.data?.proposal_id || activePropId;
            if (savedPropId) {
                setProposalId(savedPropId);
                activePropId = savedPropId;
            }

            // 2. Create or update ISO submission record linked to proposal_id
            const payload = {
                doc_type: 'PROJECT_PROPOSAL',
                document_no: docNo || '009',
                proposal_id: activePropId || null,
                header_data: {
                    document_no: docNo,
                    date: docDate,
                    prepared_by: preparedBy,
                    approved_by: approvedBy,
                    centre_dept: loggedCentreDept
                },
                form_data: buildPayload(),
                status: targetStatus
            };

            let res;
            if (submissionId) {
                res = await isoSubmissionService.updateSubmission(submissionId, payload);
                message.success(`Project Proposal updated successfully (${targetStatus})`);
            } else {
                res = await isoSubmissionService.createSubmission(payload);
                setSubmissionId(res.id);
                message.success(`Project Proposal created successfully (${targetStatus})`);
            }
            setStatus(res.status || targetStatus);

            if (onSuccess) {
                onSuccess(activePropId);
            }
        } catch (err) {
            console.error('Error saving submission:', err);
            message.error('Failed to save ISO submission record.');
        } finally {
            setSubmitting(false);
        }
    };

    // Approver update status
    const handleFormStatusUpdate = async (targetStatus) => {
        if (!submissionId) return;
        setSubmitting(true);
        try {
            await isoSubmissionService.updateStatus(submissionId, targetStatus, null, preparedBy);
            setStatus(targetStatus);
            message.success(`ISO Document status updated to ${targetStatus}`);
        } catch (err) {
            console.error('Error updating status:', err);
            message.error('Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExtractFromCostEstimation = async () => {
        if (!proposalId) {
            message.warning("No proposal ID associated with this document. Please save a draft first or ensure a project is selected.");
            return;
        }
        try {
            const res = await axios.get(`${API_BASE_URL}/dynamic-tables/${proposalId}/latest-costs`);
            const data = res.data;
            if (!data || (!data.recurring?.length && !data.non_recurring?.length)) {
                message.info("No saved cost breakdown data found for this proposal.");
                return;
            }

            if (data.recurring && Array.isArray(data.recurring)) {
                const mappedRecurring = data.recurring.map((t, idx) => {
                    const itemDetails = t.items && t.items.length > 0 ? ` (${t.items.join(", ")})` : "";
                    return {
                        sl_no: `${idx + 1}.`,
                        item_type: "Recurring",
                        items: `${t.table_name}${itemDetails}`,
                        budget_amount: String(t.subtotal || 0),
                        remarks: ""
                    };
                });
                setRecurringBudget(mappedRecurring);
            }

            if (data.non_recurring && Array.isArray(data.non_recurring)) {
                const mappedNonRecurring = data.non_recurring.map((t, idx) => {
                    const itemDetails = t.items && t.items.length > 0 ? ` (${t.items.join(", ")})` : "";
                    return {
                        sl_no: `${idx + 1}.`,
                        item_type: "Non-Recurring",
                        items: `${t.table_name}${itemDetails}`,
                        budget_amount: String(t.subtotal || 0),
                        remarks: ""
                    };
                });
                setNonRecurringBudget(mappedNonRecurring);
            }

            if (data.grand_total !== undefined) {
                const inLakhs = (data.grand_total / 100000).toFixed(2);
                setTotalCost(`${inLakhs} Lakh`);
            }

            message.success("Successfully loaded cost estimation data!");
        } catch (err) {
            console.error("Failed to extract cost estimation details:", err);
            message.error("Failed to load cost estimation data. Please try again.");
        }
    };

    // Dynamic array handler helpers
    const handleArrayChange = (setter, list, index, val) => {
        const updated = [...list];
        updated[index] = val;
        setter(updated);
    };

    const handleArrayRemove = (setter, list, index) => {
        const updated = list.filter((_, i) => i !== index);
        setter(updated);
    };

    const handleArrayAdd = (setter, list, defaultVal = '') => {
        setter([...list, defaultVal]);
    };

    // Budget table handlers
    const handleBudgetChange = (setter, list, index, field, val) => {
        const updated = [...list];
        updated[index] = { ...updated[index], [field]: val };
        setter(updated);
    };

    // Equipment table handlers
    const handleEquipmentChange = (index, field, val) => {
        const updated = [...equipmentDetails];
        updated[index] = { ...updated[index], [field]: val };
        setEquipmentDetails(updated);
    };

    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">

            {/* Status Alert Banners */}
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
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold text-xs bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-colors"
                    >
                        <ArrowLeftOutlined /> Back to Directory
                    </button>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                        status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'
                        }`}>
                        {status}
                    </span>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
                    {/* Scientist Create / Edit Controls */}
                    {!isReadOnly && (
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
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
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
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                            >
                                <CheckOutlined /> Approve Document
                            </button>

                            <button
                                onClick={() => handleFormStatusUpdate('REJECTED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                            >
                                <CloseOutlined /> Reject Document
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleGenerateDoc}
                        disabled={generating}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                    >
                        {generating ? 'Generating...' : <><DownloadOutlined /> Download Word</>}
                    </button>
                </div>
            </div>

            {/* Bold Text Formatting Tip Banner */}
            {!isReadOnly && (
                <div className="w-full max-w-4xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 px-4 py-2.5 rounded-xl mb-4 text-xs flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-2">
                        <BoldOutlined className="text-indigo-600 text-sm font-bold" />
                        <span className="font-semibold">Bold Text Option:</span> Use <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">**text**</code> or <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">&lt;b&gt;text&lt;/b&gt;</code> in any field or click the <span className="bg-white text-slate-800 font-extrabold px-1.5 py-0.5 rounded border border-slate-300">B</span> button to write in <strong>BOLD</strong> in your Word document!
                    </span>
                </div>
            )}

            {/* Simulated Printable Word A4 Document Canvas */}
            <div className="w-full max-w-[21cm] bg-white shadow-2xl border border-slate-200 p-[1.5cm] flex flex-col font-sans text-slate-800 text-xs leading-relaxed min-h-[29.7cm]">

                {/* 1. DOCUMENT HEADER TABLE (3x3 matching standard ISO header) */}
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
                                        placeholder="e.g. CMTI/PPBD/009"
                                        className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-28 px-1 py-0 text-[9px] font-normal text-slate-800"
                                    />
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-sm bg-slate-50 uppercase tracking-wider text-slate-900 border-t border-slate-800">
                                FORMAT FOR PROJECT PROPOSAL
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

                {/* Subtitle */}
                <div className="text-center font-semibold italic text-slate-600 mb-6">
                    (Required to be submit for all categories of projects)
                </div>

                {/* POINT 1: TITLE OF THE PROJECT */}
                <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                        <div className="font-bold text-xs uppercase tracking-wide text-slate-900">
                            1. Title of the Project
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={() => wrapBoldText(titleOfProject, setTitleOfProject)}
                                title="Toggle Bold format (**text**)"
                                className="text-[10px] font-extrabold bg-slate-100 hover:bg-indigo-100 text-indigo-700 border border-slate-300 px-2 py-0.5 rounded transition-all flex items-center gap-1"
                            >
                                <BoldOutlined /> Bold
                            </button>
                        )}
                    </div>
                    <div className="border border-slate-800 p-3 rounded">
                        {isReadOnly ? (
                            <span className="font-semibold text-slate-900 text-sm">{titleOfProject || '--'}</span>
                        ) : (
                            <input
                                type="text"
                                value={titleOfProject}
                                onChange={(e) => setTitleOfProject(e.target.value)}
                                placeholder="Enter Project Title (use **bold** for bold terms)..."
                                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs outline-none focus:bg-white font-semibold text-indigo-950"
                            />
                        )}
                    </div>
                </div>

                {/* POINT 2: PROJECT DETAILS */}
                <div className="space-y-4 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        2. Project Details
                    </div>

                    <div className="grid grid-cols-1 gap-2 border border-slate-800 p-3 rounded">
                        <div className="flex items-center gap-2">
                            <span className="font-bold w-44 text-slate-700">Project Number (PPM):</span>
                            {isReadOnly ? (
                                <span className="font-medium text-slate-900">{projectNo || '--'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={projectNo}
                                    onChange={(e) => setProjectNo(e.target.value)}
                                    placeholder="e.g. GST2502201"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs outline-none"
                                />
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-200">
                            <span className="font-bold text-slate-700">Project Category: DIP / GSP / ISP / GAP / CLP / ICP / AIP / LSP / ILP :</span>
                            {isReadOnly ? (
                                <span className="font-bold text-indigo-900">{projectCategory || '-'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={projectCategory}
                                    onChange={(e) => setProjectCategory(e.target.value)}
                                    placeholder="e.g. ILP"
                                    className="w-32 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-2">
                                <span className="font-bold w-44 text-slate-700">Sponsoring Agency/Industry:</span>
                                {isReadOnly ? (
                                    <span className="font-medium text-slate-900">{sponsoringAgency || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={sponsoringAgency}
                                        onChange={(e) => setSponsoringAgency(e.target.value)}
                                        placeholder="Agency name"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold w-44 text-slate-700">Original Sanction Order:</span>
                                {isReadOnly ? (
                                    <span className="font-medium text-slate-900">{sanctionOrder || '--'}</span>
                                ) : (
                                    <input
                                        type="text"
                                        value={sanctionOrder}
                                        onChange={(e) => setSanctionOrder(e.target.value)}
                                        placeholder="Sanction ref"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* POINT 3: TOTAL COST OF THE PROJECT */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        3. Total cost of the project (Rs. in Lakh).
                    </div>
                    <div className="border border-slate-800 p-3 rounded flex items-center gap-3">
                        <span className="font-bold w-48 text-slate-700">Total Cost (Rs. in Lakh):</span>
                        {isReadOnly ? (
                            <span className="font-bold text-slate-900 text-sm">{totalCost || '--'}</span>
                        ) : (
                            <input
                                type="text"
                                value={totalCost}
                                onChange={(e) => setTotalCost(e.target.value)}
                                placeholder="e.g. 40.38 Lakh"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs font-bold text-slate-900 outline-none"
                            />
                        )}
                    </div>
                    <div className="text-[10px] italic text-slate-500 pl-1">
                        (Please provide head wise details as per sanction order)
                    </div>
                </div>

                {/* POINT 4: FINANCIAL PROPOSAL */}
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1 px-2">
                            <span className="font-bold text-xs uppercase tracking-wide text-slate-900">
                                4. Financial proposal
                            </span>

                            <button
                                type="button"
                                onClick={handleExtractFromCostEstimation}
                                className="ml-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-lg shadow-md shadow-indigo-600/10 transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 border-0 outline-none"
                            >
                                <DownloadOutlined style={{ fontSize: 12 }} />
                                Load Costs Data
                            </button>
                        </div>
                        <div className="text-[11px] font-bold text-indigo-700">
                            Grand Total: Rs. {grandTotal.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-[10px] italic text-slate-500 mb-1">
                        (Please provide headwise and yearwise as per the project cost estimation format)
                    </div>

                    {/* Section A: Recurring Expenses Table */}
                    <div className="space-y-2">
                        <div className="font-bold text-xs bg-slate-50 p-1.5 border border-slate-800 flex justify-between">
                            <span>A. Recurring Expenses</span>
                            <span>Subtotal: Rs. {totalA.toLocaleString()}</span>
                        </div>
                        <table className="w-full border-collapse border border-slate-800 text-xs">
                            <thead>
                                <tr className="bg-slate-100 font-bold text-center">
                                    <th className="border border-slate-800 p-1.5 w-10">Sl</th>
                                    <th className="border border-slate-800 p-1.5">Items</th>
                                    <th className="border border-slate-800 p-1.5 w-28">Budget (Rs.)</th>
                                    <th className="border border-slate-800 p-1.5">Remarks / Justification</th>
                                    {!isReadOnly && <th className="border border-slate-800 p-1.5 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {recurringBudget.length === 0 ? (
                                    <tr>
                                        <td colSpan={isReadOnly ? 4 : 5} className="border border-slate-800 p-2 text-center text-slate-400 italic">No items added</td>
                                    </tr>
                                ) : (
                                    recurringBudget.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-slate-800 p-1 text-center font-semibold">
                                                {isReadOnly ? item.sl_no : (
                                                    <input
                                                        type="text"
                                                        value={item.sl_no}
                                                        onChange={(e) => handleBudgetChange(setRecurringBudget, recurringBudget, idx, 'sl_no', e.target.value)}
                                                        className="w-full text-center outline-none bg-transparent"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1">
                                                {isReadOnly ? <span className="whitespace-pre-wrap">{item.items}</span> : (
                                                    <textarea
                                                        rows={2}
                                                        value={item.items}
                                                        onChange={(e) => handleBudgetChange(setRecurringBudget, recurringBudget, idx, 'items', e.target.value)}
                                                        placeholder="Items (use **text** for bold)"
                                                        className="w-full outline-none bg-transparent resize-none"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1 text-right font-semibold">
                                                {isReadOnly ? item.budget_amount : (
                                                    <input
                                                        type="text"
                                                        value={item.budget_amount}
                                                        onChange={(e) => handleBudgetChange(setRecurringBudget, recurringBudget, idx, 'budget_amount', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent font-semibold"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1">
                                                {isReadOnly ? item.remarks : (
                                                    <textarea
                                                        rows={2}
                                                        value={item.remarks}
                                                        onChange={(e) => handleBudgetChange(setRecurringBudget, recurringBudget, idx, 'remarks', e.target.value)}
                                                        placeholder="Remarks"
                                                        className="w-full outline-none bg-transparent resize-none"
                                                    />
                                                )}
                                            </td>
                                            {!isReadOnly && (
                                                <td className="border border-slate-800 p-1 text-center">
                                                    <button onClick={() => handleArrayRemove(setRecurringBudget, recurringBudget, idx)} className="text-red-500">
                                                        <DeleteOutlined />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {!isReadOnly && (
                            <button onClick={() => handleArrayAdd(setRecurringBudget, recurringBudget, { sl_no: `${recurringBudget.length + 1}.`, item_type: "Recurring", items: "", budget_amount: "0", remarks: "" })} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <PlusOutlined /> Add Recurring Item
                            </button>
                        )}
                    </div>

                    {/* Section B: Non-Recurring Expenses Table */}
                    <div className="space-y-2 pt-2">
                        <div className="font-bold text-xs bg-slate-50 p-1.5 border border-slate-800 flex justify-between">
                            <span>B. Non-Recurring Expenses (Hardware / Equipment)</span>
                            <span>Subtotal: Rs. {totalB.toLocaleString()}</span>
                        </div>
                        <table className="w-full border-collapse border border-slate-800 text-xs">
                            <thead>
                                <tr className="bg-slate-100 font-bold text-center">
                                    <th className="border border-slate-800 p-1.5 w-10">Sl</th>
                                    <th className="border border-slate-800 p-1.5">Items</th>
                                    <th className="border border-slate-800 p-1.5 w-28">Budget (Rs.)</th>
                                    <th className="border border-slate-800 p-1.5">Remarks / Justification</th>
                                    {!isReadOnly && <th className="border border-slate-800 p-1.5 w-8"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {nonRecurringBudget.length === 0 ? (
                                    <tr>
                                        <td colSpan={isReadOnly ? 4 : 5} className="border border-slate-800 p-2 text-center text-slate-400 italic">No items added</td>
                                    </tr>
                                ) : (
                                    nonRecurringBudget.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-slate-800 p-1 text-center font-semibold">
                                                {isReadOnly ? item.sl_no : (
                                                    <input
                                                        type="text"
                                                        value={item.sl_no}
                                                        onChange={(e) => handleBudgetChange(setNonRecurringBudget, nonRecurringBudget, idx, 'sl_no', e.target.value)}
                                                        className="w-full text-center outline-none bg-transparent"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1">
                                                {isReadOnly ? <span className="whitespace-pre-wrap">{item.items}</span> : (
                                                    <textarea
                                                        rows={2}
                                                        value={item.items}
                                                        onChange={(e) => handleBudgetChange(setNonRecurringBudget, nonRecurringBudget, idx, 'items', e.target.value)}
                                                        placeholder="Items (use **text** for bold)"
                                                        className="w-full outline-none bg-transparent resize-none"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1 text-right font-semibold">
                                                {isReadOnly ? item.budget_amount : (
                                                    <input
                                                        type="text"
                                                        value={item.budget_amount}
                                                        onChange={(e) => handleBudgetChange(setNonRecurringBudget, nonRecurringBudget, idx, 'budget_amount', e.target.value)}
                                                        className="w-full text-right outline-none bg-transparent font-semibold"
                                                    />
                                                )}
                                            </td>
                                            <td className="border border-slate-800 p-1">
                                                {isReadOnly ? item.remarks : (
                                                    <textarea
                                                        rows={2}
                                                        value={item.remarks}
                                                        onChange={(e) => handleBudgetChange(setNonRecurringBudget, nonRecurringBudget, idx, 'remarks', e.target.value)}
                                                        placeholder="Remarks"
                                                        className="w-full outline-none bg-transparent resize-none"
                                                    />
                                                )}
                                            </td>
                                            {!isReadOnly && (
                                                <td className="border border-slate-800 p-1 text-center">
                                                    <button onClick={() => handleArrayRemove(setNonRecurringBudget, nonRecurringBudget, idx)} className="text-red-500">
                                                        <DeleteOutlined />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {!isReadOnly && (
                            <button onClick={() => handleArrayAdd(setNonRecurringBudget, nonRecurringBudget, { sl_no: `${nonRecurringBudget.length + 1}.`, item_type: "Non-Recurring", items: "", budget_amount: "0", remarks: "" })} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <PlusOutlined /> Add Non-Recurring Item
                            </button>
                        )}
                    </div>
                </div>

                {/* POINT 5: PROJECT LEADER AND CO-LEADERS */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        5. Project Leader and Co-leaders (if any
                    </div>
                    <div className="border border-slate-800 p-3 rounded space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-bold w-60 text-slate-700">Principal Coordinator/ Leader/ Investigator:</span>
                            {isReadOnly ? (
                                <span className="font-semibold text-slate-900">{projectLeader || '--'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={projectLeader}
                                    onChange={(e) => setProjectLeader(e.target.value)}
                                    placeholder="Leader Name & Designation"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                />
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-200">
                            <span className="font-bold w-60 text-slate-700">Co-leaders:</span>
                            {isReadOnly ? (
                                <span className="font-medium text-slate-900">{coLeaders || '--'}</span>
                            ) : (
                                <input
                                    type="text"
                                    value={coLeaders}
                                    onChange={(e) => setCoLeaders(e.target.value)}
                                    placeholder="Co-leaders"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                />
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-200 space-y-1">
                            <span className="font-bold text-slate-700 block">Core S&T members (Scientist-B and above): (it is mandatory to include the core team on project completion report)</span>
                            {coreStMembers.map((member, idx) => (
                                <div key={idx} className="flex gap-2 items-center pl-2">
                                    <span className="font-semibold text-slate-500">•</span>
                                    {isReadOnly ? <span className="font-medium text-slate-900">{member}</span> : (
                                        <>
                                            <input
                                                type="text"
                                                value={member}
                                                onChange={(e) => handleArrayChange(setCoreStMembers, coreStMembers, idx, e.target.value)}
                                                placeholder="Member Name & Designation"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                            />
                                            <button onClick={() => handleArrayRemove(setCoreStMembers, coreStMembers, idx)} className="text-red-500">
                                                <DeleteOutlined />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <button onClick={() => handleArrayAdd(setCoreStMembers, coreStMembers, '')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1">
                                    <PlusOutlined /> Add Core Team Member
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* POINT 6: PARTICIPATING INSTITUTE / COLLABORATORS */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        6. Participating (development partner if any) institute/collaborators/industry partners with their role of involvement/responsibility
                    </div>
                    <div className="border border-slate-800 p-3 rounded space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-bold w-64 text-slate-700">Name and address of development partners:</span>
                            {isReadOnly ? <span className="font-medium text-slate-900">{devPartnersName || '--'}</span> : (
                                <input
                                    type="text"
                                    value={devPartnersName}
                                    onChange={(e) => setDevPartnersName(e.target.value)}
                                    placeholder="Name and address"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                />
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-slate-200">
                            <span className="font-bold w-64 text-slate-700">Roles and responsibility (original as per MoU agreements/Revised if any):</span>
                            {isReadOnly ? <span className="font-medium text-slate-900">{devPartnersRoles || '--'}</span> : (
                                <input
                                    type="text"
                                    value={devPartnersRoles}
                                    onChange={(e) => setDevPartnersRoles(e.target.value)}
                                    placeholder="Roles & responsibilities"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* POINT 7: DATE OF COMMENCEMENT AND COMPLETION */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        7. Date of commencement and completion
                    </div>
                    <div className="border border-slate-800 p-3 rounded grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-bold w-44 text-slate-700">Date of commencement:</span>
                            {isReadOnly ? <span className="font-medium text-slate-900">{commencementDate || '--'}</span> : (
                                <DatePicker
                                    format="DD-MM-YYYY"
                                    value={commencementDate ? dayjs(commencementDate, ['DD-MM-YYYY', 'YYYY-MM-DD']) : null}
                                    onChange={(date, dateString) => setCommencementDate(dateString || '')}
                                    placeholder="Select Date (DD-MM-YYYY)"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded py-1 text-xs"
                                />
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-bold w-44 text-slate-700">Expected date of completion:</span>
                            {isReadOnly ? <span className="font-medium text-slate-900">{completionDate || '--'}</span> : (
                                <DatePicker
                                    format="DD-MM-YYYY"
                                    value={completionDate ? dayjs(completionDate, ['DD-MM-YYYY', 'YYYY-MM-DD']) : null}
                                    onChange={(date, dateString) => setCompletionDate(dateString || '')}
                                    placeholder="Select Date (DD-MM-YYYY)"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded py-1 text-xs"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* POINT 8: PROPOSED OBJECTIVES */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        8. Proposed Objectives
                    </div>
                    <div className="border border-slate-800 p-3 rounded space-y-2">
                        {proposedObjectives.map((obj, idx) => (
                            <div key={idx} className="flex gap-2 items-center pl-2 mb-1">
                                <span className="font-bold text-slate-500">•</span>
                                {isReadOnly ? <span className="font-medium text-slate-900">{obj}</span> : (
                                    <>
                                        <input
                                            type="text"
                                            value={obj}
                                            onChange={(e) => handleArrayChange(setProposedObjectives, proposedObjectives, idx, e.target.value)}
                                            placeholder="Objective description (use **bold** for bold terms)"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                        />
                                        <button onClick={() => handleArrayRemove(setProposedObjectives, proposedObjectives, idx)} className="text-red-500">
                                            <DeleteOutlined />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {!isReadOnly && (
                            <button onClick={() => handleArrayAdd(setProposedObjectives, proposedObjectives, '')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1">
                                <PlusOutlined /> Add Objective
                            </button>
                        )}
                    </div>
                </div>

                {/* POINT 9: CURRENT DOMESTIC AND INTERNATIONAL STATUS */}
                <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                        <div className="font-bold text-xs uppercase tracking-wide text-slate-900">
                            9. Current domestic and international status (State of the art vis-a- vis knowledge gaps) (not more than a page
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={() => wrapBoldText(currentStatus, setCurrentStatus)}
                                title="Toggle Bold format (**text**)"
                                className="text-[10px] font-extrabold bg-slate-100 hover:bg-indigo-100 text-indigo-700 border border-slate-300 px-2 py-0.5 rounded transition-all flex items-center gap-1"
                            >
                                <BoldOutlined /> Bold
                            </button>
                        )}
                    </div>
                    <div className="border border-slate-800 p-3 rounded">
                        {isReadOnly ? <div className="whitespace-pre-wrap font-medium text-slate-900">{currentStatus || '--'}</div> : (
                            <textarea
                                rows={3}
                                value={currentStatus}
                                onChange={(e) => setCurrentStatus(e.target.value)}
                                placeholder="Current domestic & international status (use **text** to make specific words bold)..."
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs outline-none"
                            />
                        )}
                    </div>
                </div>

                {/* POINT 10: RESEARCH METHODOLOGY AND TIMELINE */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        10. Research Methodology and Timeline (Research Tasks and timeline as planned) (include Gantt chart)
                    </div>
                    <div className="border border-slate-800 p-3 rounded space-y-3">
                        <div>
                            <span className="font-bold text-slate-700 block mb-1">Research Tasks (Timeline Tasks):</span>
                            {researchTasks.map((task, idx) => (
                                <div key={idx} className="flex gap-2 items-center pl-2 mb-1">
                                    <span className="font-bold text-slate-500 text-xs w-5">{idx + 1}.</span>
                                    {isReadOnly ? <span className="font-medium text-slate-900">{task}</span> : (
                                        <>
                                            <input
                                                type="text"
                                                value={task}
                                                onChange={(e) => handleArrayChange(setResearchTasks, researchTasks, idx, e.target.value)}
                                                placeholder="Task description (use **bold** for bold terms)"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                            />
                                            <button onClick={() => handleArrayRemove(setResearchTasks, researchTasks, idx)} className="text-red-500">
                                                <DeleteOutlined />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <button onClick={() => handleArrayAdd(setResearchTasks, researchTasks, '')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1">
                                    <PlusOutlined /> Add Research Task
                                </button>
                            )}
                        </div>

                        {/* Gantt Chart Table Interactive Preview */}
                        <div className="pt-3 border-t border-slate-200">
                            <div className="font-bold text-xs text-slate-800 mb-1 flex items-center justify-between">
                                <span>Table 1. Timeline for the proposed tasks (Gantt Chart Selection)</span>
                                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                    Calculated Duration: {durationMonths} Months
                                </span>
                            </div>
                            {!isReadOnly && (
                                <div className="text-[10px] text-indigo-600 mb-2 italic">
                                    💡 Click on any month number cell (1, 2, 3...) to toggle 'X' selection for each task.
                                </div>
                            )}
                            <div className="overflow-x-auto border border-slate-800 rounded">
                                <table className="w-full border-collapse text-[10px]">
                                    <thead>
                                        <tr className="bg-slate-100 font-bold text-center">
                                            <th className="border border-slate-800 p-1.5 text-left min-w-[160px]">Activities / Months</th>
                                            {Array.from({ length: durationMonths }, (_, i) => i + 1).map((m) => (
                                                <th key={m} className="border border-slate-800 p-1 w-8 text-center">{m}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {researchTasks.length === 0 ? (
                                            <tr>
                                                <td className="border border-slate-800 p-1.5 text-slate-400 italic">1. -</td>
                                                {Array.from({ length: durationMonths }, (_, i) => (
                                                    <td key={i} className="border border-slate-800 p-1"></td>
                                                ))}
                                            </tr>
                                        ) : (
                                            researchTasks.map((task, idx) => {
                                                const activeList = taskActiveMonths[idx] || [];
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="border border-slate-800 p-1.5 font-medium text-slate-800">
                                                            {idx + 1}. {task || '-'}
                                                        </td>
                                                        {Array.from({ length: durationMonths }, (_, i) => {
                                                            const m = i + 1;
                                                            const isSelected = activeList.includes(m);
                                                            return (
                                                                <td
                                                                    key={m}
                                                                    onClick={() => toggleTaskMonth(idx, m)}
                                                                    className={`border border-slate-800 p-1 text-center font-extrabold cursor-pointer transition-all select-none ${isSelected
                                                                        ? 'bg-slate-300 text-slate-900 shadow-inner'
                                                                        : 'hover:bg-slate-100 text-slate-300'
                                                                        }`}
                                                                    title={`Click to toggle Month ${m} for Task ${idx + 1}`}
                                                                >
                                                                    {isSelected ? 'X' : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* POINT 11: TECHNICAL PERFORMANCE */}
                <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                        <div className="font-bold text-xs uppercase tracking-wide text-slate-900">
                            11. Technical Performance: Salient achievements envisaged summarizing the contributions towards technology development and research outputs
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={() => wrapBoldText(salientAchievements, setSalientAchievements)}
                                title="Toggle Bold format (**text**)"
                                className="text-[10px] font-extrabold bg-slate-100 hover:bg-indigo-100 text-indigo-700 border border-slate-300 px-2 py-0.5 rounded transition-all flex items-center gap-1"
                            >
                                <BoldOutlined /> Bold
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] italic text-slate-500 mb-1">
                        (Please provide key highlights / novelty/techno-economic benefits of developments)
                    </div>
                    <div className="border border-slate-800 p-3 rounded space-y-3">
                        <div>
                            <span className="font-bold text-slate-700 block mb-1">Salient Achievements & Benefits:</span>
                            {isReadOnly ? <div className="whitespace-pre-wrap font-medium text-slate-900">{salientAchievements || '--'}</div> : (
                                <textarea
                                    rows={2}
                                    value={salientAchievements}
                                    onChange={(e) => setSalientAchievements(e.target.value)}
                                    placeholder="Highlights & benefits (use **text** for bold)..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs outline-none"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <div className="flex items-center gap-2">
                                <span className="font-bold w-48 text-slate-700">Expected TRL & Tools:</span>
                                {isReadOnly ? <span className="font-medium text-slate-900">{expectedTrl || '--'}</span> : (
                                    <input
                                        type="text"
                                        value={expectedTrl}
                                        onChange={(e) => setExpectedTrl(e.target.value)}
                                        placeholder="TRL details"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold w-40 text-slate-700">IPR Details:</span>
                                {isReadOnly ? <span className="font-medium text-slate-900">{iprDetails || '--'}</span> : (
                                    <input
                                        type="text"
                                        value={iprDetails}
                                        onChange={(e) => setIprDetails(e.target.value)}
                                        placeholder="IPR details"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 space-y-1">
                            <span className="font-bold text-slate-700 block">Human resources to be trained under this project:</span>
                            {humanResources.map((hr, idx) => (
                                <div key={idx} className="flex gap-2 items-center pl-2 mb-1">
                                    <span className="font-semibold text-slate-500">•</span>
                                    {isReadOnly ? <span className="font-medium text-slate-900">{hr}</span> : (
                                        <>
                                            <input
                                                type="text"
                                                value={hr}
                                                onChange={(e) => handleArrayChange(setHumanResources, humanResources, idx, e.target.value)}
                                                placeholder="Human resources details"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                                            />
                                            <button onClick={() => handleArrayRemove(setHumanResources, humanResources, idx)} className="text-red-500">
                                                <DeleteOutlined />
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <button onClick={() => handleArrayAdd(setHumanResources, humanResources, '')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1">
                                    <PlusOutlined /> Add Human Resources Entry
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* POINT 12: REVENUE / INCOME GENERATED */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        12. Revenue/income generated for the Institute (Provide details)
                    </div>
                    <div className="border border-slate-800 p-3 rounded">
                        {isReadOnly ? <span className="font-medium text-slate-900">{revenueGenerated || '--'}</span> : (
                            <input
                                type="text"
                                value={revenueGenerated}
                                onChange={(e) => setRevenueGenerated(e.target.value)}
                                placeholder="Revenue details"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                            />
                        )}
                    </div>
                </div>

                {/* POINT 13: DETAILS OF EQUIPMENTS AND INSTRUMENTS */}
                <div className="space-y-3 mb-6">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        13. Details of Equipments and instruments (Project head C-3, C-4)
                    </div>
                    <table className="w-full border-collapse border border-slate-800 text-xs">
                        <thead>
                            <tr className="bg-slate-50 font-bold text-center">
                                <th className="border border-slate-800 p-1.5 w-10">Sl No</th>
                                <th className="border border-slate-800 p-1.5">Technical Name of facility</th>
                                <th className="border border-slate-800 p-1.5">Key specifications</th>
                                <th className="border border-slate-800 p-1.5 w-24">Estimated Cost</th>
                                <th className="border border-slate-800 p-1.5 w-20">AMC required</th>
                                <th className="border border-slate-800 p-1.5 w-20">Utilization plan</th>
                                {!isReadOnly && <th className="border border-slate-800 p-1.5 w-8"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {equipmentDetails.length === 0 ? (
                                <tr>
                                    <td colSpan={isReadOnly ? 6 : 7} className="border border-slate-800 p-2 text-center text-slate-400 italic">No equipment items added</td>
                                </tr>
                            ) : (
                                equipmentDetails.map((eq, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-slate-800 p-1 text-center font-semibold">{eq.sl_no}</td>
                                        <td className="border border-slate-800 p-1">
                                            {isReadOnly ? eq.technical_name : (
                                                <input
                                                    type="text"
                                                    value={eq.technical_name}
                                                    onChange={(e) => handleEquipmentChange(idx, 'technical_name', e.target.value)}
                                                    placeholder="Facility name"
                                                    className="w-full outline-none bg-transparent"
                                                />
                                            )}
                                        </td>
                                        <td className="border border-slate-800 p-1">
                                            {isReadOnly ? <span className="whitespace-pre-wrap">{eq.key_specifications}</span> : (
                                                <textarea
                                                    rows={2}
                                                    value={eq.key_specifications}
                                                    onChange={(e) => handleEquipmentChange(idx, 'key_specifications', e.target.value)}
                                                    placeholder="Specifications"
                                                    className="w-full outline-none bg-transparent resize-none"
                                                />
                                            )}
                                        </td>
                                        <td className="border border-slate-800 p-1 text-right font-semibold">
                                            {isReadOnly ? eq.estimated_cost : (
                                                <input
                                                    type="text"
                                                    value={eq.estimated_cost}
                                                    onChange={(e) => handleEquipmentChange(idx, 'estimated_cost', e.target.value)}
                                                    placeholder="Cost"
                                                    className="w-full text-right outline-none bg-transparent font-semibold"
                                                />
                                            )}
                                        </td>
                                        <td className="border border-slate-800 p-1 text-center">
                                            {isReadOnly ? eq.amc_required : (
                                                <input
                                                    type="text"
                                                    value={eq.amc_required}
                                                    onChange={(e) => handleEquipmentChange(idx, 'amc_required', e.target.value)}
                                                    placeholder="Yes/No"
                                                    className="w-full text-center outline-none bg-transparent"
                                                />
                                            )}
                                        </td>
                                        <td className="border border-slate-800 p-1 text-center">
                                            {isReadOnly ? eq.utilization_plan : (
                                                <input
                                                    type="text"
                                                    value={eq.utilization_plan}
                                                    onChange={(e) => handleEquipmentChange(idx, 'utilization_plan', e.target.value)}
                                                    placeholder="Plan"
                                                    className="w-full text-center outline-none bg-transparent"
                                                />
                                            )}
                                        </td>
                                        {!isReadOnly && (
                                            <td className="border border-slate-800 p-1 text-center">
                                                <button onClick={() => handleArrayRemove(setEquipmentDetails, equipmentDetails, idx)} className="text-red-500">
                                                    <DeleteOutlined />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {!isReadOnly && (
                        <button onClick={() => handleArrayAdd(setEquipmentDetails, equipmentDetails, { sl_no: equipmentDetails.length + 1, technical_name: "", key_specifications: "", estimated_cost: "0", amc_required: "No", utilization_plan: "" })} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            <PlusOutlined /> Add Equipment Item
                        </button>
                    )}
                </div>

                {/* POINT 14: DETAILS OF INFRASTRUCTURE PROPOSED */}
                <div className="space-y-3 mb-8">
                    <div className="font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-1 text-slate-900">
                        14. Details of Infrastructure proposed to be created (Project head C1)
                    </div>
                    <div className="border border-slate-800 p-3 rounded">
                        {isReadOnly ? <span className="font-medium text-slate-900">{infrastructureDetails || '--'}</span> : (
                            <input
                                type="text"
                                value={infrastructureDetails}
                                onChange={(e) => setInfrastructureDetails(e.target.value)}
                                placeholder="Infrastructure details"
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                            />
                        )}
                    </div>
                </div>

                {/* SIGNATURES BLOCK */}
                <div className="mt-auto pt-8 border-t-2 border-slate-800 space-y-12 text-xs">
                    <div className="grid grid-cols-2 gap-8 font-bold text-slate-900">
                        <div>(Signature of Project Leader and Co-leaders)</div>
                        <div className="text-right">(Signature of Center Head)<br /><span className="text-[10px] font-normal text-slate-600">JD & CH, C-SMPM</span></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 font-bold text-slate-900 pt-4 border-t border-slate-300">
                        <div>Head, PP&BD:</div>
                        <div className="text-center">FA & CAO:</div>
                        <div className="text-right">Director – for kind approval please</div>
                    </div>
                </div>

                {/* ISO FOOTER / REVISION CODE BAR */}
                <div className="mt-8 pt-3 border-t border-slate-400 text-[10px] text-slate-600 flex justify-between items-center font-mono">
                    <div>ISO 9001-2015</div>
                    <div>{revisionCode}</div>
                </div>

            </div>
        </div>
    );
}
