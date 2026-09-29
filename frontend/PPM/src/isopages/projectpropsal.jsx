import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    DownloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    CloseOutlined,
    BoldOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    InboxOutlined,
    PaperClipOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    BankOutlined,
    ApartmentOutlined,
} from '@ant-design/icons';
import { DatePicker, message, Form, Input, Select, Upload, Tag, Row, Col, Button, Tooltip, AutoComplete } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const { Dragger } = Upload;
const { TextArea } = Input;

const CUSTOMER_TYPE_OPTIONS = [
    'Govt',
    'Private',
    'MHI',
    'MSME',
    'Research Institute',
    'Educational institute',
];

const REQUEST_TYPE_OPTIONS = [
    'Call for Proposal',
    'Mail',
    'Discussion',
    'Initiative',
    'Tender',
    'Direct Enquiry',
    'Budgetry offer',
    'EOI',
];

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

export default function ProjectProposal({ submissionId: propSubmissionId, proposalId: propProposalId, existingRecord, onBack, onSuccess, onAddToProposals, docInfo, stageConfig }) {
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitProposalLoading, setSubmitProposalLoading] = useState(false);
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [proposalId, setProposalId] = useState(propProposalId || existingRecord?.id || null);
    const [status, setStatus] = useState('DRAFT');

    // Document Header & Metadata State
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode] = useState(getDefaultRevisionCode('009'));
    const [docNo, setDocNo] = useState(docInfo?.document_no || docInfo?.code || '');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [filename, setFilename] = useState('CMTI_Project_Proposal.docx');

    // General Project Details
    const [titleOfProject, setTitleOfProject] = useState(existingRecord?.quote_reference || existingRecord?.activity || existingRecord?.quote_description || '');
    const [projectNo, setProjectNo] = useState(existingRecord?.project_number || '');
    const [projectCategory, setProjectCategory] = useState('');
    const [sponsoringAgency, setSponsoringAgency] = useState(existingRecord?.customer_name || '');
    const [sanctionOrder, setSanctionOrder] = useState(existingRecord?.order_number || '');
    const [totalCost, setTotalCost] = useState(existingRecord?.quote_amount || '');

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

    // Submission & Manual Entry Details State
    const [customerType, setCustomerType] = useState(existingRecord?.customer_type || 'Govt');
    const [requestType, setRequestType] = useState(existingRecord?.request_type || 'Direct Enquiry');
    const [quoteAmount, setQuoteAmount] = useState(existingRecord?.quote_amount || '');
    const [proposalStatus, setProposalStatus] = useState(() => {
        if (existingRecord?.proposal_status) {
            return Array.isArray(existingRecord.proposal_status)
                ? existingRecord.proposal_status
                : [existingRecord.proposal_status];
        }
        return ['Submitted'];
    });
    const [customerName, setCustomerName] = useState(existingRecord?.customer_name || existingRecord?.customer_raw || '');
    const [customerAddress, setCustomerAddress] = useState(existingRecord?.address || '');
    const [alternateContact, setAlternateContact] = useState(existingRecord?.alternate_contact_details || '');
    const [customerEmail, setCustomerEmail] = useState(existingRecord?.email || '');
    const [customerPhone, setCustomerPhone] = useState(existingRecord?.phone_no || '');
    const [quoteReference, setQuoteReference] = useState(existingRecord?.quote_reference || existingRecord?.project_number || existingRecord?.order_number || '');
    const [quoteDescription, setQuoteDescription] = useState(existingRecord?.quote_description || existingRecord?.activity || '');
    const [quotationGivenBy, setQuotationGivenBy] = useState(existingRecord?.quotation_given_by_name || getLoggedUserName() || '');
    const [centerDept, setCenterDept] = useState(existingRecord?.center || loggedCentreDept || '');
    const [groupName, setGroupName] = useState(existingRecord?.group || getLoggedUserGroup() || '');
    const [makeInIndia, setMakeInIndia] = useState(existingRecord?.make_in_india || '');
    const [tenderFileList, setTenderFileList] = useState([]);
    const [additionalAttachments, setAdditionalAttachments] = useState([]);

    // Customer Suggestions & AutoComplete
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [addressOptions, setAddressOptions] = useState([]);

    // Helper to auto-fill customer details from customer database
    const syncCustomerData = useCallback((name) => {
        if (!name || !customerSuggestions || customerSuggestions.length === 0) return;
        const query = name.trim().toLowerCase();
        const match = customerSuggestions.find(c => (c.name || '').trim().toLowerCase() === query);
        if (match) {
            if (match.customer_type) setCustomerType(match.customer_type);
            if (match.email) setCustomerEmail(match.email);
            if (match.phone_no || match.phone) setCustomerPhone(match.phone_no || match.phone);
            if (match.address) setCustomerAddress(match.address);
            if (match.alternate_contact_details) setAlternateContact(match.alternate_contact_details);
        }
    }, [customerSuggestions]);

    // Fetch customer database for autocomplete
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                };
                const res = await axios.get(`${API_BASE_URL}/customer1/`, { headers });
                if (res.data && Array.isArray(res.data)) {
                    const normalized = res.data.map(customer => {
                        const emails = Array.isArray(customer.email) ? customer.email : [];
                        const phones = Array.isArray(customer.phone) ? customer.phone : [];
                        const addresses = Array.isArray(customer.address) ? customer.address : [];
                        const alternate_contacts = Array.isArray(customer.alternate_contact_details) ? customer.alternate_contact_details : [];

                        return {
                            ...customer,
                            name: customer.name,
                            customer_type: customer.customer_type,
                            email: emails.join(', '),
                            phone_no: phones.join(', '),
                            alternate_contact_details: alternate_contacts.join(', '),
                            addresses: addresses,
                            address: addresses.join('\n'),
                        };
                    });
                    setCustomerSuggestions(normalized);
                }
            } catch (err) {
                console.error('Error loading customer suggestions:', err);
            }
        };
        fetchCustomers();
    }, []);

    // Sync customer info once customerSuggestions load if customer name already exists
    useEffect(() => {
        if (customerSuggestions.length > 0 && (customerName || sponsoringAgency)) {
            syncCustomerData(customerName || sponsoringAgency);
        }
    }, [customerSuggestions, customerName, sponsoringAgency, syncCustomerData]);

    useEffect(() => {
        if (existingRecord) {
            const title = existingRecord.quote_reference || existingRecord.activity || existingRecord.quote_description || '';
            if (title) {
                setTitleOfProject(title);
                setQuoteDescription(title);
            }

            const leader = existingRecord.project_co_ordinator || existingRecord.project_coordinator || existingRecord.quotation_given_by_name || getLoggedUserName() || '';
            if (leader) {
                setProjectLeader(leader);
                setQuotationGivenBy(leader);
            }

            if (existingRecord.customer_name) {
                setSponsoringAgency(existingRecord.customer_name);
                setCustomerName(existingRecord.customer_name);
            }
            if (existingRecord.quote_amount) {
                setTotalCost(existingRecord.quote_amount);
                setQuoteAmount(existingRecord.quote_amount);
            }
            if (existingRecord.customer_type) setCustomerType(existingRecord.customer_type);
            if (existingRecord.request_type) setRequestType(existingRecord.request_type);
            if (existingRecord.email) setCustomerEmail(existingRecord.email);
            if (existingRecord.phone_no) setCustomerPhone(existingRecord.phone_no);
            if (existingRecord.address) setCustomerAddress(existingRecord.address);
            if (existingRecord.alternate_contact_details) setAlternateContact(existingRecord.alternate_contact_details);
            if (existingRecord.center) setCenterDept(existingRecord.center);
            if (existingRecord.group) setGroupName(existingRecord.group);
            if (existingRecord.make_in_india) setMakeInIndia(existingRecord.make_in_india);
            if (existingRecord.project_number) {
                setProjectNo(existingRecord.project_number);
                setQuoteReference(existingRecord.project_number);
            }
            if (existingRecord.order_number) {
                setSanctionOrder(existingRecord.order_number);
                if (!existingRecord.project_number) setQuoteReference(existingRecord.order_number);
            }
            if (existingRecord.date_of_actual_commencement) setCommencementDate(existingRecord.date_of_actual_commencement);
            if (existingRecord.delivery_date || existingRecord.extended_delivery_date) {
                setCompletionDate(existingRecord.delivery_date || existingRecord.extended_delivery_date);
            }
            if (existingRecord.key_deliverables) {
                const lines = String(existingRecord.key_deliverables).split('\n').map(s => s.trim()).filter(Boolean);
                if (lines.length > 0) setProposedObjectives(lines);
            }
        }

        const effectiveProposalId = propProposalId || proposalId || (existingRecord ? existingRecord.id : null);
        if (effectiveProposalId && !existingRecord) {
            async function fetchProposalDetails() {
                try {
                    const res = await axios.get(`${API_BASE_URL}/proposals/${effectiveProposalId}`);
                    if (res.data) {
                        const p = res.data;
                        const title = p.quote_reference || p.activity || p.quote_description || '';
                        if (title) {
                            setTitleOfProject(title);
                            setQuoteDescription(title);
                        }

                        const leader = p.project_co_ordinator || p.project_coordinator || p.quotation_given_by_name || getLoggedUserName() || '';
                        if (leader) {
                            setProjectLeader(leader);
                            setQuotationGivenBy(leader);
                        }

                        if (p.customer_name) {
                            setSponsoringAgency(p.customer_name);
                            setCustomerName(p.customer_name);
                        }
                        if (p.quote_amount) {
                            setTotalCost(p.quote_amount);
                            setQuoteAmount(p.quote_amount);
                        }
                        if (p.customer_type) setCustomerType(p.customer_type);
                        if (p.request_type) setRequestType(p.request_type);
                        if (p.email) setCustomerEmail(p.email);
                        if (p.phone_no) setCustomerPhone(p.phone_no);
                        if (p.address) setCustomerAddress(p.address);
                        if (p.alternate_contact_details) setAlternateContact(p.alternate_contact_details);
                        if (p.center) setCenterDept(p.center);
                        if (p.group) setGroupName(p.group);
                        if (p.make_in_india) setMakeInIndia(p.make_in_india);
                        if (p.project_number) {
                            setProjectNo(p.project_number);
                            setQuoteReference(p.project_number);
                        }
                        if (p.order_number) {
                            setSanctionOrder(p.order_number);
                            if (!p.project_number) setQuoteReference(p.order_number);
                        }
                        if (p.date_of_actual_commencement) setCommencementDate(p.date_of_actual_commencement);
                        if (p.delivery_date || p.extended_delivery_date) {
                            setCompletionDate(p.delivery_date || p.extended_delivery_date);
                        }
                        if (p.key_deliverables) {
                            const lines = String(p.key_deliverables).split('\n').map(s => s.trim()).filter(Boolean);
                            if (lines.length > 0) setProposedObjectives(lines);
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
    const isReadOnly = isAdmin ? false : isApproved;

    // Helper to wrap current text in bold formatting (**bold text**)
    const wrapBoldText = (val, setter) => {
        let nextVal;
        if (!val) {
            nextVal = '**bold text**';
        } else if (val.startsWith('**') && val.endsWith('**')) {
            nextVal = val.slice(2, -2);
        } else {
            nextVal = `**${val}**`;
        }
        setter(nextVal);
        if (setter === setTitleOfProject) {
            setQuoteDescription(nextVal);
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

    // Automatically synchronize Quote Amount & Total Cost with live budget grandTotal
    useEffect(() => {
        if (grandTotal > 0) {
            if (!quoteAmount || quoteAmount === '' || quoteAmount === '0') {
                setQuoteAmount(String(grandTotal));
            }
            if (!totalCost || totalCost === '' || totalCost === '0') {
                const inLakhs = (grandTotal / 100000).toFixed(2);
                setTotalCost(`${inLakhs} Lakh`);
            }
        }
    }, [grandTotal, quoteAmount, totalCost]);

    useEffect(() => {
        if (totalCost && (!quoteAmount || quoteAmount === '' || quoteAmount === '0')) {
            setQuoteAmount(totalCost);
        }
    }, [totalCost, quoteAmount]);

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

    // Check props or URL parameters to load existing submission
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('submission_id') || searchParams.get('iso_id');
        const effectivePropId = propProposalId || existingRecord?.id || proposalId;

        async function loadSubmission() {
            try {
                let sub = null;
                if (urlId) {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) sub = res.data;
                } else if (effectivePropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: effectivePropId, doc_type: 'PROJECT_PROPOSAL' });
                    if (Array.isArray(subs) && subs.length > 0) sub = subs[0];
                }

                if (sub) {
                    setSubmissionId(sub.id);
                    submissionIdRef.current = sub.id;
                    setStatus(sub.status || 'DRAFT');
                    statusRef.current = sub.status || 'DRAFT';
                    setDocNo(sub.document_no || '');

                    const h = sub.header_data || {};
                    if (h.document_no) setDocNo(h.document_no);
                    if (h.date) setDocDate(h.date);
                    if (h.prepared_by) {
                        setPreparedBy(h.prepared_by);
                        setQuotationGivenBy(h.prepared_by);
                    }
                    if (h.approved_by) setApprovedBy(h.approved_by);

                    const f = sub.form_data || {};
                    if (f.title_of_project) {
                        setTitleOfProject(f.title_of_project);
                        setQuoteDescription(f.title_of_project);
                    }
                    if (f.project_no) {
                        setProjectNo(f.project_no);
                        setQuoteReference(f.project_no);
                    }
                    if (f.project_category) setProjectCategory(f.project_category);
                    if (f.sponsoring_agency) {
                        setSponsoringAgency(f.sponsoring_agency);
                        setCustomerName(f.sponsoring_agency);
                        syncCustomerData(f.sponsoring_agency);
                    }
                    if (f.sanction_order) {
                        setSanctionOrder(f.sanction_order);
                        if (!f.project_no) setQuoteReference(f.sanction_order);
                    }
                    if (f.total_cost) {
                        setTotalCost(f.total_cost);
                        setQuoteAmount(f.total_cost);
                    }
                    if (f.project_leader) {
                        setProjectLeader(f.project_leader);
                        setQuotationGivenBy(f.project_leader);
                    }
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
            } finally {
                setTimeout(() => {
                    isHydratedRef.current = true;
                }, 400);
            }
        }
        loadSubmission();
    }, [propSubmissionId, propProposalId, existingRecord]);

    // Construct Payload
    const buildPayload = useCallback(() => {
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
    }, [titleOfProject, projectNo, projectCategory, sponsoringAgency, sanctionOrder, totalCost, projectLeader, coLeaders, coreStMembers, devPartnersName, devPartnersRoles, commencementDate, completionDate, proposedObjectives, currentStatus, researchTasks, taskActiveMonths, recurringBudget, nonRecurringBudget, salientAchievements, expectedTrl, iprDetails, humanResources, revenueGenerated, equipmentDetails, infrastructureDetails, preparedBy, approvedBy, loggedCentreDept, docNo, docDate, filename]);

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

            let activePropId = proposalId || propProposalId || (existingRecord ? existingRecord.id : null);
            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

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
            console.error('Auto-save draft error:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, proposalId, propProposalId, existingRecord, docNo, docDate, preparedBy, approvedBy, loggedCentreDept, buildPayload]);

    // Debounced Auto-Save on field change
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;

        const timer = setTimeout(() => {
            performAutoSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [titleOfProject, projectNo, projectCategory, sponsoringAgency, sanctionOrder, totalCost, projectLeader, coLeaders, coreStMembers, devPartnersName, devPartnersRoles, commencementDate, completionDate, proposedObjectives, currentStatus, researchTasks, taskActiveMonths, recurringBudget, nonRecurringBudget, salientAchievements, expectedTrl, iprDetails, humanResources, revenueGenerated, equipmentDetails, infrastructureDetails, preparedBy, approvedBy, docNo, docDate, performAutoSave, isReadOnly]);

    // Flush on page unload / refresh
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isHydratedRef.current && !isReadOnly) {
                performAutoSave();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (isHydratedRef.current && !isReadOnly) {
                performAutoSave();
            }
        };
    }, [performAutoSave, isReadOnly]);

    // Handle searching customers by name, address, email or phone
    const handleCustomerSearch = (searchText) => {
        setCustomerName(searchText);
        setSponsoringAgency(searchText);
        syncCustomerData(searchText);
        if (!searchText || searchText.trim().length < 1) {
            setCustomerOptions([]);
            return;
        }
        const query = searchText.trim().toLowerCase();
        const matches = (customerSuggestions || [])
            .filter((c) => {
                const name = (c.name || '').toLowerCase();
                const addr = Array.isArray(c.addresses)
                    ? c.addresses.join(' ').toLowerCase()
                    : (c.address || '').toLowerCase();
                const email = (c.email || '').toLowerCase();
                const phone = (c.phone_no || '').toLowerCase();
                return (
                    name.includes(query) ||
                    addr.includes(query) ||
                    email.includes(query) ||
                    phone.includes(query)
                );
            })
            .slice(0, 15)
            .map((c) => {
                const firstAddr =
                    Array.isArray(c.addresses) && c.addresses.length > 0
                        ? c.addresses[0]
                        : c.address || '';
                return {
                    value: c.name,
                    label: (
                        <div className="py-1">
                            <div className="font-bold text-slate-800 text-xs">{c.name}</div>
                            {firstAddr && (
                                <div className="text-[11px] text-slate-500 truncate max-w-md">
                                    {firstAddr}
                                </div>
                            )}
                        </div>
                    ),
                    customer: c,
                };
            });
        setCustomerOptions(matches);
    };

    // Handle selecting customer option
    const handleCustomerSelect = (value, option) => {
        if (option && option.customer) {
            const c = option.customer;
            setSelectedCustomer(c);
            setCustomerName(c.name || value);
            setSponsoringAgency(c.name || value);

            const addrs = Array.isArray(c.addresses)
                ? c.addresses
                : c.address
                    ? [c.address]
                    : [];
            setAddressOptions(addrs.map((a) => ({ value: a, label: a })));

            const firstAddr = addrs[0] || '';
            setCustomerAddress(firstAddr);

            if (c.customer_type) setCustomerType(c.customer_type);
            if (c.email) setCustomerEmail(c.email);
            if (c.phone_no || c.phone) setCustomerPhone(c.phone_no || c.phone);
            if (c.alternate_contact_details) setAlternateContact(c.alternate_contact_details);

            const safeCustName = (c.name || 'Proposal')
                .replace(/[^a-zA-Z0-9_\-\s]/g, '')
                .trim()
                .replace(/\s+/g, '_');
            setFilename(`CMTI_Project_Proposal_${safeCustName || 'Proposal'}.docx`);

            message.info(`Selected "${c.name}" — Customer Details Populated!`);
        } else {
            setCustomerName(value);
            setSponsoringAgency(value);
            syncCustomerData(value);
        }
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

    // Submit Proposal + Generate Document + Upload directly (matching Document Studio workflow)
    const handleSubmitProposal = async () => {
        const finalCustName = (customerName || sponsoringAgency || '').trim();
        const finalQuoteDesc = (quoteDescription || titleOfProject || '').trim();
        const finalCoord = (quotationGivenBy || projectLeader || preparedBy || getLoggedUserName() || '').trim();

        if (!finalCustName) {
            message.error('Please enter Customer Name / Sponsoring Agency.');
            return;
        }
        if (!finalQuoteDesc) {
            message.error('Please enter Quote Description / Project Title.');
            return;
        }
        if (!finalCoord) {
            message.error('Please enter Quotation Given By / Coordinator.');
            return;
        }
        if (!customerType) {
            message.error('Please select Customer Type.');
            return;
        }
        if (!requestType) {
            message.error('Please select Request Type.');
            return;
        }

        setSubmitProposalLoading(true);
        try {
            // 1. Generate DOCX file
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/project-proposal/generate`, payload, {
                responseType: 'blob'
            });

            const disposition = res.headers['content-disposition'];
            let generatedFilename = filename || 'CMTI_Project_Proposal.docx';
            if (disposition && disposition.includes('filename=')) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    generatedFilename = match[1];
                }
            }
            if (!generatedFilename.toLowerCase().endsWith('.docx')) {
                generatedFilename += '.docx';
            }

            const docBlob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const docFile = new File([docBlob], generatedFilename, {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            // 2. Build proposal payload
            const rawUser = window.localStorage.getItem('ppm_user');
            let parsedUser = {};
            try {
                parsedUser = rawUser ? JSON.parse(rawUser) : {};
            } catch { }

            const uName = finalCoord || parsedUser.name || getLoggedUserName();
            const uCenter = centerDept || loggedCentreDept || parsedUser.center || '';
            const uGroup = groupName || getLoggedUserGroup() || parsedUser.group || '';

            const computedAmount = quoteAmount ? String(quoteAmount) : (totalCost ? String(totalCost) : (grandTotal > 0 ? String(grandTotal) : ''));

            let activePropId = proposalId || propProposalId || (existingRecord ? existingRecord.id : null);

            const proposalPayload = {
                enquiry_date: docDate
                    ? (dayjs(docDate, ['DD-MM-YYYY', 'YYYY-MM-DD']).isValid()
                        ? dayjs(docDate, ['DD-MM-YYYY', 'YYYY-MM-DD']).format('YYYY-MM-DD')
                        : docDate)
                    : dayjs().format('YYYY-MM-DD'),
                customer_type: customerType || 'Govt',
                customer_name: finalCustName,
                address: customerAddress || '',
                email: customerEmail || '',
                phone_no: customerPhone || '',
                alternate_contact_details: alternateContact || '',
                request_type: requestType || 'Direct Enquiry',
                make_in_india: makeInIndia || '',
                email_reference: customerEmail || '',
                quote_reference: quoteReference || projectNo || sanctionOrder || docNo || '',
                quote_description: finalQuoteDesc,
                quote_amount: computedAmount,
                quotation_given_by_name: uName,
                quotation_given_by_department: uCenter,
                center: uCenter,
                group: uGroup,
                proposal_status: Array.isArray(proposalStatus) ? proposalStatus.join(', ') : (proposalStatus || 'Submitted'),
                project_coordinator: uName,
                user_id: parsedUser.id || parsedUser.user_id || 0,
                user_name: parsedUser.name || uName,
                user_email: parsedUser.email || '',
                user_role: parsedUser.role || 'scientist',
                user_center: uCenter,
                user_group: uGroup,
                draft: false,
                is_acknowledged: false,
            };

            if (activePropId) {
                proposalPayload.id = activePropId;
            }

            // 3. Post proposal to backend
            const propResponse = await fetch(`${API_BASE_URL}/proposals/add-proposal-coordinator`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(proposalPayload),
            });

            if (!propResponse.ok) {
                const errorBody = await propResponse.json().catch(() => ({}));
                throw new Error(errorBody.detail || 'Failed to create proposal');
            }

            const result = await propResponse.json();
            const newProjectId = result?.proposal_id || activePropId;
            if (newProjectId) {
                setProposalId(newProjectId);
                activePropId = newProjectId;
            }

            // 4. Save/update ISO submission record linked to proposal_id
            try {
                const isoPayload = {
                    doc_type: 'PROJECT_PROPOSAL',
                    document_no: docNo || '009',
                    proposal_id: newProjectId || null,
                    header_data: {
                        document_no: docNo,
                        date: docDate,
                        prepared_by: preparedBy || uName,
                        approved_by: approvedBy,
                        centre_dept: loggedCentreDept
                    },
                    form_data: payload,
                    status: 'SUBMITTED'
                };

                if (submissionIdRef.current || submissionId) {
                    await isoSubmissionService.updateSubmission(submissionIdRef.current || submissionId, isoPayload);
                } else {
                    const isoRes = await isoSubmissionService.createSubmission(isoPayload);
                    if (isoRes && isoRes.id) {
                        setSubmissionId(isoRes.id);
                        submissionIdRef.current = isoRes.id;
                    }
                }
                setStatus('SUBMITTED');
            } catch (isoErr) {
                console.error('Error saving ISO submission record:', isoErr);
            }

            // 5. Upload generated docx + all attachments to /documents/
            if (newProjectId) {
                try {
                    let proposalStageId = 2;
                    if (stageConfig && stageConfig.length > 0) {
                        const proposalStage = stageConfig.find(
                            (s) => (s.name || '').toString().trim().toLowerCase() === 'proposal'
                        );
                        if (proposalStage) proposalStageId = proposalStage.id;
                    }

                    const formData = new FormData();
                    formData.append('project_id', newProjectId);
                    formData.append('stage_id', proposalStageId);
                    formData.append('uploaded_by', uName);
                    formData.append('name', 'Proposal');
                    formData.append('version', 'v1');
                    formData.append('description', 'Official ISO Project Proposal Document Generated via ISO Studio');
                    formData.append('file', docFile);

                    (additionalAttachments || []).forEach((att) => {
                        formData.append('attachment', att);
                    });

                    await fetch(`${API_BASE_URL}/documents/`, {
                        method: 'POST',
                        body: formData,
                    });

                    // 6. Upload tender images if any
                    if (tenderFileList && tenderFileList.length > 0) {
                        const finalImageUrls = [];
                        for (const item of tenderFileList) {
                            if (item.url && !item.originFileObj) {
                                finalImageUrls.push(item.url);
                            } else if (item.originFileObj || item instanceof File) {
                                const fileToUpload = item.originFileObj || item;
                                const imgFormData = new FormData();
                                imgFormData.append('project_id', newProjectId);
                                imgFormData.append('uploaded_by', uName);
                                imgFormData.append('name', `Tender Image: ${fileToUpload.name}`);
                                imgFormData.append('description', 'Tender Image');
                                imgFormData.append('file', fileToUpload);

                                const docUploadRes = await fetch(`${API_BASE_URL}/documents/`, {
                                    method: 'POST',
                                    body: imgFormData,
                                });
                                if (docUploadRes.ok) {
                                    const docResData = await docUploadRes.json();
                                    if (docResData?.url) {
                                        finalImageUrls.push(docResData.url);
                                    }
                                }
                            }
                        }

                        if (finalImageUrls.length > 0) {
                            await fetch(`${API_BASE_URL}/proposals/${newProjectId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tender_images: JSON.stringify(finalImageUrls) }),
                            });
                        }
                    }
                } catch (docErr) {
                    console.error('Error uploading proposal documents:', docErr);
                }
            }

            message.success('Proposal submitted and ISO document generated successfully!');

            if (onSuccess) {
                onSuccess(newProjectId);
            } else if (onAddToProposals) {
                onAddToProposals(docFile, proposalPayload, additionalAttachments);
            }
        } catch (err) {
            console.error('Failed to submit proposal:', err);
            message.error(err.message || 'Failed to submit proposal');
        } finally {
            setSubmitProposalLoading(false);
        }
    };

    // Save as Draft or Submit
    const handleSaveSubmission = async (targetStatus = 'DRAFT') => {
        if (targetStatus === 'SUBMITTED') {
            return handleSubmitProposal();
        }
        setSubmitting(true);
        try {
            // 1. Create or update record in main proposals database table
            let activePropId = proposalId || propProposalId || (existingRecord ? existingRecord.id : null);

            const proposalPayload = {
                id: activePropId || undefined,
                quote_description: quoteDescription || titleOfProject || existingRecord?.quote_description || 'ISO Project Proposal',
                activity: quoteDescription || titleOfProject || existingRecord?.activity || 'ISO Project Proposal',
                customer_name: customerName || sponsoringAgency || existingRecord?.customer_name || 'N/A',
                quotation_given_by_name: quotationGivenBy || projectLeader || preparedBy || getLoggedUserName() || '',
                project_coordinator: quotationGivenBy || projectLeader || preparedBy || getLoggedUserName() || '',
                quote_amount: quoteAmount || totalCost || existingRecord?.quote_amount || '0',
                center: centerDept || loggedCentreDept || existingRecord?.center || '',
                group: groupName || existingRecord?.group || loggedCentreDept || '',
                proposal_status: Array.isArray(proposalStatus) ? proposalStatus.join(', ') : (proposalStatus || 'Submitted'),
                draft: true,
                is_acknowledged: false,
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
                setQuoteAmount(String(data.grand_total));
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
                        onClick={async () => {
                            if (isHydratedRef.current && !isReadOnly) {
                                await performAutoSave();
                            }
                            if (onBack) onBack();
                        }}
                        className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold text-xs bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-colors"
                        title="Back to Directory (Auto-saves draft)"
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

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
                    {/* Scientist Create / Edit Controls */}
                    {!isReadOnly && (
                        <button
                            onClick={() => handleSaveSubmission('SUBMITTED')}
                            disabled={submitting}
                            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md"
                        >
                            {submitting ? 'Submitting...' : <><CheckOutlined /> Submit Form</>}
                        </button>
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
                                <div className="flex items-center gap-1">
                                    <span>Date:</span>
                                    {isReadOnly ? (
                                        <span className="font-bold text-slate-900 px-1">{docDate || '--'}</span>
                                    ) : (
                                        <DatePicker
                                            size="small"
                                            format="DD-MM-YYYY"
                                            value={docDate ? dayjs(docDate, ['DD-MM-YYYY', 'YYYY-MM-DD']) : null}
                                            onChange={(date, dateString) => setDocDate(dateString || '')}
                                            placeholder="DD-MM-YYYY"
                                            className="w-28 text-[9px] py-0 px-1 border-0 border-b border-slate-300 rounded-none bg-transparent"
                                            allowClear={false}
                                        />
                                    )}
                                </div>
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
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setTitleOfProject(val);
                                    setQuoteDescription(val);
                                }}
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
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setProjectNo(val);
                                        if (!quoteReference || quoteReference === projectNo || quoteReference === sanctionOrder) {
                                            setQuoteReference(val);
                                        }
                                    }}
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
                                    <AutoComplete
                                        value={sponsoringAgency}
                                        options={customerOptions}
                                        onSearch={handleCustomerSearch}
                                        onSelect={handleCustomerSelect}
                                        onChange={(val) => {
                                            setSponsoringAgency(val);
                                            setCustomerName(val);
                                            syncCustomerData(val);
                                        }}
                                        placeholder="Agency name / Customer"
                                        className="flex-1 text-xs font-semibold"
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
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSanctionOrder(val);
                                            if (!quoteReference || quoteReference === projectNo || quoteReference === sanctionOrder) {
                                                setQuoteReference(val);
                                            }
                                        }}
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
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setTotalCost(val);
                                    setQuoteAmount(val);
                                }}
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
                        5. Project Leader and Co-leaders (if any)
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
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setProjectLeader(val);
                                        setQuotationGivenBy(val);
                                        setPreparedBy(val);
                                    }}
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

            {/* PROPOSAL SUBMISSION & MANUAL ENTRY DETAILS */}
            <div className="w-full max-w-[21cm] border-2 border-blue-600 bg-white mt-8 mb-8 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]">
                <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-blue-900 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircleOutlined className="text-lg text-emerald-400" />
                        <div>
                            <span className="font-extrabold text-sm uppercase tracking-wider block">
                                Proposal Submission & Manual Entry Details
                            </span>
                            <span className="text-[11px] text-blue-200 font-normal">
                                These fields are automatically synchronized with ISO Project Proposal. Complete and verify below before final submission.
                            </span>
                        </div>
                    </div>
                    <Tag color="green" className="font-bold border-none px-3 py-1 text-xs">
                        Auto-Synced
                    </Tag>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Customer Type <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    placeholder="Customer Type"
                                    className="w-full"
                                    value={customerType || 'Govt'}
                                    onChange={(val) => setCustomerType(val)}
                                >
                                    {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                                        <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Request Type <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    placeholder="Request Type"
                                    className="w-full"
                                    value={requestType || 'Direct Enquiry'}
                                    onChange={(val) => setRequestType(val)}
                                >
                                    {REQUEST_TYPE_OPTIONS.map((opt) => (
                                        <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                                    ))}
                                </Select>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Quote Amount (₹)
                                </label>
                                <Input
                                    value={quoteAmount !== '' ? quoteAmount : (totalCost || (grandTotal > 0 ? String(grandTotal) : ''))}
                                    onChange={(e) => {
                                        setQuoteAmount(e.target.value);
                                        setTotalCost(e.target.value);
                                    }}
                                    placeholder={totalCost ? String(totalCost) : (grandTotal > 0 ? String(grandTotal) : '0')}
                                    prefix={<span className="text-slate-400 font-bold">₹</span>}
                                    className="font-mono font-semibold"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Proposal Status
                                </label>
                                <Select
                                    mode="tags"
                                    placeholder="Proposal Status"
                                    className="w-full"
                                    value={Array.isArray(proposalStatus) ? proposalStatus : [proposalStatus].filter(Boolean)}
                                    onChange={(val) => setProposalStatus(val)}
                                >
                                    <Select.Option value="Submitted">Submitted</Select.Option>
                                    <Select.Option value="Accepted">Accepted</Select.Option>
                                    <Select.Option value="Rejected">Rejected</Select.Option>
                                    <Select.Option value="Awaiting">Awaiting</Select.Option>
                                </Select>
                            </div>
                        </Col>
                    </Row>

                    {/* Tender specifics if selected */}
                    {requestType === 'Tender' && (
                        <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-lg space-y-3">
                            <div className="font-bold text-blue-900 text-xs flex items-center gap-2">
                                <Tag color="blue">Tender Details</Tag>
                                <span>Make In India & Tender Image Uploads</span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                    Make In India Details
                                </label>
                                <TextArea
                                    rows={2}
                                    value={makeInIndia}
                                    onChange={(e) => setMakeInIndia(e.target.value)}
                                    placeholder="Enter Make In India percentage/details..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">
                                    Tender Images (Multiple)
                                </label>
                                <Upload
                                    listType="picture-card"
                                    multiple
                                    accept="image/*"
                                    fileList={tenderFileList}
                                    beforeUpload={() => false}
                                    onChange={({ fileList }) => setTenderFileList(fileList)}
                                >
                                    <div>
                                        <PlusOutlined />
                                        <div className="text-xs mt-1">Upload</div>
                                    </div>
                                </Upload>
                            </div>
                        </div>
                    )}

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Customer Name <span className="text-red-500">*</span>
                                </label>
                                <AutoComplete
                                    value={customerName || sponsoringAgency}
                                    options={customerOptions}
                                    onSearch={handleCustomerSearch}
                                    onSelect={handleCustomerSelect}
                                    onChange={(val) => {
                                        setCustomerName(val);
                                        setSponsoringAgency(val);
                                        syncCustomerData(val);
                                    }}
                                    placeholder="Customer or Company Name"
                                    className="w-full font-semibold"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Alternate Contact / Kind Attention
                                </label>
                                <Input
                                    value={alternateContact}
                                    onChange={(e) => setAlternateContact(e.target.value)}
                                    placeholder="Contact Person / Alternate Details"
                                />
                            </div>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Email Reference / Address
                                </label>
                                <Input
                                    value={customerEmail || customerAddress}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    placeholder="customer@domain.com"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Phone Number
                                </label>
                                <Input
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Phone / Mobile No."
                                />
                            </div>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Quote / Enquiry Reference
                                </label>
                                <Input
                                    value={quoteReference || projectNo || sanctionOrder || docNo}
                                    onChange={(e) => setQuoteReference(e.target.value)}
                                    placeholder="Ref Number / Inquiry ID"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Quote Description / Project Title <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={quoteDescription || titleOfProject}
                                    onChange={(e) => {
                                        setQuoteDescription(e.target.value);
                                        setTitleOfProject(e.target.value);
                                    }}
                                    placeholder="Project Activity or Description"
                                    className="font-semibold"
                                />
                            </div>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={8}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Quotation Given By / Coordinator <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={quotationGivenBy || projectLeader || preparedBy || getLoggedUserName()}
                                    onChange={(e) => {
                                        setQuotationGivenBy(e.target.value);
                                        setProjectLeader(e.target.value);
                                        setPreparedBy(e.target.value);
                                    }}
                                    placeholder="Scientist Name"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={8}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Centre / Department
                                </label>
                                <Input
                                    value={centerDept || loggedCentreDept}
                                    onChange={(e) => setCenterDept(e.target.value)}
                                    placeholder="Centre / Dept"
                                />
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={8}>
                            <div>
                                <label className="font-bold text-xs text-slate-800 block mb-1">
                                    Group
                                </label>
                                <Input
                                    value={groupName || getLoggedUserGroup()}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Group Name"
                                />
                            </div>
                        </Col>
                    </Row>

                    {/* Additional Supporting File Attachments */}
                    <div className="pt-2 border-t border-slate-200">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                            Attach Additional Supporting Documents (PDFs, Drawings, Excel, Specs):
                        </label>
                        <Dragger
                            multiple
                            fileList={additionalAttachments.map((f, i) => ({ uid: `${i}`, name: f.name, status: 'done' }))}
                            beforeUpload={(file) => {
                                setAdditionalAttachments((prev) => [...prev, file]);
                                message.success(`Attached ${file.name}`);
                                return false;
                            }}
                            onRemove={(file) => {
                                setAdditionalAttachments((prev) => prev.filter((f) => f.name !== file.name));
                            }}
                            className="p-3 bg-slate-50 border-slate-300"
                        >
                            <p className="ant-upload-drag-icon text-slate-400 mb-1">
                                <InboxOutlined className="text-2xl text-blue-500" />
                            </p>
                            <p className="ant-upload-text text-xs font-semibold text-slate-700">
                                Click or drag supporting documents to attach to this proposal
                            </p>
                            <p className="ant-upload-hint text-[11px] text-slate-400">
                                Supports technical drawings, datasheets, PDFs, and spreadsheets.
                            </p>
                        </Dragger>
                    </div>

                    {/* Final Action Submission Bar */}
                    <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl">
                        <div className="text-xs text-slate-500">
                            Clicking <strong>Submit Proposal</strong> will automatically generate the <code>.docx</code> ISO project proposal document, create the proposal record, and upload all files.
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Button
                                icon={<DownloadOutlined />}
                                loading={generating}
                                onClick={handleGenerateDoc}
                                className="rounded-xl border-slate-400 text-slate-800 font-semibold h-11 px-4"
                            >
                                Export DOCX
                            </Button>

                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                loading={submitProposalLoading}
                                onClick={handleSubmitProposal}
                                className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-extrabold text-sm h-11 px-8 shadow-md hover:shadow-lg transition-all border-none"
                            >
                                Submit Proposal
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
