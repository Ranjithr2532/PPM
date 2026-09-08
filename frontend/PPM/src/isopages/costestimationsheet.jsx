import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    DownloadOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    PrinterOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckOutlined,
    ReloadOutlined,
    CalculatorOutlined,
    SyncOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName, getCurrentUserRole } from '../services/isoSubmissionService';

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const last2 = (y) => String(y).slice(-2);

const num = (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const clean = String(v).replace(/,/g, '').trim();
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
};

const formatIndian = (val) => {
    const clean = String(val ?? '').replace(/,/g, '').trim();
    const n = Number(clean);
    if (isNaN(n) || n === 0) return '0';
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

// Formats user-typed string into Indian comma grouping (e.g. 1000000 -> 10,00,000)
// Allows text like NA, NIL, N/A, na, nil (in any casing/mix) to be typed freely without stripping
const formatInputWithCommas = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const str = String(raw);
    // If input contains letters or characters like / or -, keep as-is (allows typing NA, NIL, N/A, etc.)
    if (/[a-zA-Z\/-]/.test(str)) {
        return str;
    }
    const clean = str.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    let intPart = parts[0];
    const decPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';

    if (!intPart && !decPart) return '';
    if (intPart) {
        const digits = intPart.replace(/^0+(?=\d)/, '');
        if (digits.length <= 3) {
            intPart = digits;
        } else {
            const last3 = digits.slice(-3);
            const rest = digits.slice(0, -3);
            intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
        }
    }
    return intPart + decPart;
};

// Row definitions
const MAIN_ROWS_DEF = [
    { cod: "C1", label: "Infrastructure Dev. Cost (Works & Services)", group: "C", editable: true },
    { cod: "C2", label: "Site preparation at customer site (W&S)", group: "C", editable: true },
    { cod: "C3", label: "Equipment / Apparatus / Instruments required @ CMTI", group: "C", editable: true },
    { cod: "C4", label: "Subsystems / Apparatus required for product", group: "C", editable: true },
    { cod: "C", label: "Capital Cost (C1+C2+C3+C4)", group: null, computed: "C" },
    { cod: "R1", label: "TA/DA - India", group: "R", editable: true },
    { cod: "R2", label: "TA/DA - Abroad", group: "R", editable: true },
    { cod: "R3", label: "Project consumables", group: "R", editable: true },
    { cod: "R4", label: "Equipment Maintenance", group: "R", editable: true },
    { cod: "R5", label: "Prototype Dev. Cost", group: "R", editable: true },
    { cod: "R6", label: "Tech. HR (temporary staff)", group: "R", editable: true },
    { cod: "R7", label: "Contingency", group: "R", editable: true },
    { cod: "R", label: "Recurring Cost (R1+R2+R3+R4+R5+R6+R7)", group: null, computed: "R" },
    { cod: "PEC", label: "Project Execution Cost (P = C+R)", group: null, computed: "PEC" },
    { cod: "E1", label: "Scientific Input - Staff Salary", group: "E", editable: true },
    { cod: "E2", label: "R&D support charges incl. equipment utilization", group: "E", editable: true },
    { cod: "E3", label: "Institute Overheads", group: "E", editable: true },
    { cod: "E", label: "Total Establishment Cost (E1+E2+E3)", group: null, computed: "E" },
    { cod: "TPC", label: "Total Project Cost (C+R+E)", group: null, computed: "TPC" },
];

export default function CostEstimationSheet({ proposalId: propProposalId, submissionId: propSubmissionId, onClose, onBack, docInfo }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');
    const [generating, setGenerating] = useState(false);
    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [pendingGenAction, setPendingGenAction] = useState('doc');
    const [submitting, setSubmitting] = useState(false);

    // Setup screen state - opens immediately on load to ask project duration
    const [showSetup, setShowSetup] = useState(!propSubmissionId);
    const [startYear, setStartYear] = useState('');
    const [endYear, setEndYear] = useState('');
    const [setupError, setSetupError] = useState('');

    // Generated FY Labels: ["FY (26-27)", "FY (27-28)", "FY (28-29)"]
    const [fyLabels, setFyLabels] = useState([]);

    // Meta Header
    const [formatNo, setFormatNo] = useState('');
    const [preparedOn, setPreparedOn] = useState(getTodayDateString());
    const [projectNo, setProjectNo] = useState('');
    const [projectTitle, setProjectTitle] = useState('');

    // Values Matrix: { [cod]: [fy0_val, fy1_val, ...] }
    const [fyValues, setFyValues] = useState({});

    // Sub-Tables state
    const [revenueData, setRevenueData] = useState({
        external_work: '',
        internal_work: ''
    });

    const [infraData, setInfraData] = useState({
        civil: '',
        electrical: '',
        ac_clean_room: '',
        furniture_utilities: ''
    });

    const [techHrData, setTechHrData] = useState({
        consultant_experts: '',
        ra_srf_jrf: '',
        proj_engineers_fellow: '',
        support_staff: ''
    });

    const [staffData, setStaffData] = useState({
        sct_e_above: '',
        sct_b_d_sto: '',
        technical_staff: ''
    });

    const [equipList, setEquipList] = useState([
        { equipment: '', cost: '' }
    ]);

    const [commentsNotes, setCommentsNotes] = useState('');
    const [preparedBy, setPreparedBy] = useState(getLoggedUserName() || '');
    const [approvedBy, setApprovedBy] = useState('');
    const [groupHeadTitle, setGroupHeadTitle] = useState('Group Head');
    const [centreHeadTitle, setCentreHeadTitle] = useState('Centre Head');
    const [caoTitle, setCaoTitle] = useState('Chief Accounts Officer');
    const [underflowFlags, setUnderflowFlags] = useState({ infra: false, techHr: false, staff: false, equip: false });
    const showUnderflowWarning = underflowFlags.infra || underflowFlags.techHr || underflowFlags.staff || underflowFlags.equip;

    const userRole = getCurrentUserRole();
    const isApprover = userRole === 'ch' || userRole === 'gh' || userRole === 'admin' || userRole === 'director';
    const isSubmitted = status === 'SUBMITTED';
    const isApproved = status === 'APPROVED';
    const isReadOnly = isApproved;

    // Initialize fyValues structure for current fyLabels
    const initFyValues = useCallback((labels) => {
        setFyValues(prev => {
            const next = { ...prev };
            MAIN_ROWS_DEF.forEach(r => {
                if (r.editable) {
                    const existing = Array.isArray(next[r.cod]) ? next[r.cod] : [];
                    next[r.cod] = labels.map((_, i) => existing[i] !== undefined ? existing[i] : '');
                }
            });
            return next;
        });
    }, []);

    // Generate Sheet from Setup
    const handleGenerateCostSheet = () => {
        const s = parseInt(startYear, 10);
        const e = parseInt(endYear, 10);
        if (!s || !e || e < s || s < 1950 || e > 2100) {
            setSetupError("Please enter a valid 4-digit starting year (e.g. 2026) and ending year (e.g. 2028).");
            return;
        }
        if (e - s > 10) {
            setSetupError("Duration looks too long (maximum 10 years).");
            return;
        }
        setSetupError('');

        const newLabels = [];
        for (let y = s; y <= e; y++) {
            newLabels.push(`FY (${last2(y)}-${last2(y + 1)})`);
        }
        setFyLabels(newLabels);
        initFyValues(newLabels);
        setShowSetup(false);
    };

    // Sub-Table Totals
    const revenueTotal = useMemo(() => {
        return num(revenueData.external_work) + num(revenueData.internal_work);
    }, [revenueData]);

    const infraTotal = useMemo(() => {
        return num(infraData.civil) + num(infraData.electrical) + num(infraData.ac_clean_room) + num(infraData.furniture_utilities);
    }, [infraData]);

    const techHrTotal = useMemo(() => {
        return num(techHrData.consultant_experts) + num(techHrData.ra_srf_jrf) + num(techHrData.proj_engineers_fellow) + num(techHrData.support_staff);
    }, [techHrData]);

    const staffTotal = useMemo(() => {
        return num(staffData.sct_e_above) + num(staffData.sct_b_d_sto) + num(staffData.technical_staff);
    }, [staffData]);

    const equipTotal = useMemo(() => {
        return equipList.reduce((sum, item) => sum + num(item.cost), 0);
    }, [equipList]);

    // Computed Main Table Matrix per FY
    const computedMatrix = useMemo(() => {
        const matrix = {}; // { [cod]: [val0, val1, ...] }
        const rowTotals = {}; // { [cod]: total }

        fyLabels.forEach((_, colIdx) => {
            // Editable Row Values at colIdx
            const getVal = (cod) => num(fyValues[cod]?.[colIdx]);

            // C = C1 + C2 + C3 + C4
            const C = getVal("C1") + getVal("C2") + getVal("C3") + getVal("C4");
            // R = R1 + ... + R7
            const R = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"].reduce((s, c) => s + getVal(c), 0);
            // PEC = C + R
            const PEC = C + R;
            // E = E1 + E2 + E3
            const E = ["E1", "E2", "E3"].reduce((s, c) => s + getVal(c), 0);
            // TPC = C + R + E
            const TPC = C + R + E;

            if (!matrix["C"]) matrix["C"] = [];
            if (!matrix["R"]) matrix["R"] = [];
            if (!matrix["PEC"]) matrix["PEC"] = [];
            if (!matrix["E"]) matrix["E"] = [];
            if (!matrix["TPC"]) matrix["TPC"] = [];

            matrix["C"][colIdx] = C;
            matrix["R"][colIdx] = R;
            matrix["PEC"][colIdx] = PEC;
            matrix["E"][colIdx] = E;
            matrix["TPC"][colIdx] = TPC;
        });

        // Compute Row Totals
        MAIN_ROWS_DEF.forEach(r => {
            if (r.editable) {
                const arr = fyValues[r.cod] || [];
                rowTotals[r.cod] = arr.reduce((s, v) => s + num(v), 0);
            } else if (matrix[r.cod]) {
                rowTotals[r.cod] = matrix[r.cod].reduce((s, v) => s + num(v), 0);
            }
        });

        return { matrix, rowTotals };
    }, [fyLabels, fyValues]);

    // Effective Infrastructure Total: Link COD/main table C1 + C2 amount if present, or subtable sum
    const displayInfraTotal = useMemo(() => {
        const mainC1C2 = (computedMatrix.rowTotals['C1'] || 0) + (computedMatrix.rowTotals['C2'] || 0);
        return mainC1C2 > 0 ? mainC1C2 : infraTotal;
    }, [computedMatrix.rowTotals, infraTotal]);

    const displayTechHrTotal = useMemo(() => {
        const mainR6 = computedMatrix.rowTotals['R6'] || 0;
        return mainR6 > 0 ? mainR6 : techHrTotal;
    }, [computedMatrix.rowTotals, techHrTotal]);

    const displayStaffTotal = useMemo(() => {
        const mainE1 = computedMatrix.rowTotals['E1'] || 0;
        return mainE1 > 0 ? mainE1 : staffTotal;
    }, [computedMatrix.rowTotals, staffTotal]);

    const displayEquipTotal = useMemo(() => {
        const mainC3C4 = (computedMatrix.rowTotals['C3'] || 0) + (computedMatrix.rowTotals['C4'] || 0);
        return mainC3C4 > 0 ? mainC3C4 : equipTotal;
    }, [computedMatrix.rowTotals, equipTotal]);

    // Over-budget overflow flags for sub-tables
    // Only active when main table has an allocated budget for that cost code
    const infraOverflow = useMemo(() => {
        const mainC1C2 = (computedMatrix.rowTotals['C1'] || 0) + (computedMatrix.rowTotals['C2'] || 0);
        return mainC1C2 > 0 && infraTotal > mainC1C2;
    }, [computedMatrix.rowTotals, infraTotal]);

    const techHrOverflow = useMemo(() => {
        const mainR6 = computedMatrix.rowTotals['R6'] || 0;
        return mainR6 > 0 && techHrTotal > mainR6;
    }, [computedMatrix.rowTotals, techHrTotal]);

    const staffOverflow = useMemo(() => {
        const mainE1 = computedMatrix.rowTotals['E1'] || 0;
        return mainE1 > 0 && staffTotal > mainE1;
    }, [computedMatrix.rowTotals, staffTotal]);

    const equipOverflow = useMemo(() => {
        const mainC3C4 = (computedMatrix.rowTotals['C3'] || 0) + (computedMatrix.rowTotals['C4'] || 0);
        return mainC3C4 > 0 && equipTotal > mainC3C4;
    }, [computedMatrix.rowTotals, equipTotal]);

    // Underflow: sub-table total is LESS than allocated budget in main table
    const infraUnderflow = useMemo(() => {
        const mainC1C2 = (computedMatrix.rowTotals['C1'] || 0) + (computedMatrix.rowTotals['C2'] || 0);
        return mainC1C2 > 0 && infraTotal < mainC1C2;
    }, [computedMatrix.rowTotals, infraTotal]);

    const techHrUnderflow = useMemo(() => {
        const mainR6 = computedMatrix.rowTotals['R6'] || 0;
        return mainR6 > 0 && techHrTotal < mainR6;
    }, [computedMatrix.rowTotals, techHrTotal]);

    const staffUnderflow = useMemo(() => {
        const mainE1 = computedMatrix.rowTotals['E1'] || 0;
        return mainE1 > 0 && staffTotal < mainE1;
    }, [computedMatrix.rowTotals, staffTotal]);

    const equipUnderflow = useMemo(() => {
        const mainC3C4 = (computedMatrix.rowTotals['C3'] || 0) + (computedMatrix.rowTotals['C4'] || 0);
        return mainC3C4 > 0 && equipTotal < mainC3C4;
    }, [computedMatrix.rowTotals, equipTotal]);

    // Input Change Handler for Main Grid
    // Allows numeric values (with Indian comma formatting) AND text like NA / NIL / N/A (any casing/small/mixed)
    const handleFyInputChange = (cod, colIdx, val) => {
        const formatted = formatInputWithCommas(val);
        setFyValues(prev => {
            const next = { ...prev };
            const arr = [...(next[cod] || fyLabels.map(() => ''))];
            arr[colIdx] = formatted;
            next[cod] = arr;
            return next;
        });
    };

    // Sub-Table Change Handlers with Indian Comma Formatting
    const handleRevenueChange = (field, val) => {
        const formatted = formatInputWithCommas(val);
        setRevenueData(prev => ({ ...prev, [field]: formatted }));
    };

    const handleInfraChange = (field, val) => {
        const formatted = formatInputWithCommas(val);
        setInfraData(prev => ({ ...prev, [field]: formatted }));
    };

    const handleTechHrChange = (field, val) => {
        const formatted = formatInputWithCommas(val);
        setTechHrData(prev => ({ ...prev, [field]: formatted }));
    };

    const handleStaffChange = (field, val) => {
        const formatted = formatInputWithCommas(val);
        setStaffData(prev => ({ ...prev, [field]: formatted }));
    };

    // Sync Helper: Put Subtable Totals into FY 0 of C1, C3, R6, E1
    const syncSubtotalsToMainTable = () => {
        setFyValues(prev => {
            const next = { ...prev };
            const ensureArr = (cod) => [...(next[cod] || fyLabels.map(() => ''))];

            if (infraTotal > 0) {
                const arr = ensureArr("C1");
                arr[0] = formatIndian(infraTotal);
                next["C1"] = arr;
            }
            if (equipTotal > 0) {
                const arr = ensureArr("C3");
                arr[0] = formatIndian(equipTotal);
                next["C3"] = arr;
            }
            if (techHrTotal > 0) {
                const arr = ensureArr("R6");
                arr[0] = formatIndian(techHrTotal);
                next["R6"] = arr;
            }
            if (staffTotal > 0) {
                const arr = ensureArr("E1");
                arr[0] = formatIndian(staffTotal);
                next["E1"] = arr;
            }
            return next;
        });
    };

    // Load Proposals & auto-populate docInfo
    useEffect(() => {
        if (docInfo) {
            const pNo = docInfo.project_no || docInfo.project_number || docInfo.proposal_number || '';
            const pTitle = docInfo.project_title || docInfo.title_of_project || docInfo.quote_description || docInfo.activity || docInfo.title || '';
            if (pNo) setProjectNo(pNo);
            if (pTitle) setProjectTitle(pTitle);
        }

        axios.get(`${API_BASE_URL}/proposals/`)
            .then(res => {
                if (Array.isArray(res.data)) {
                    setProposals(res.data);
                    if (selectedProposalId) {
                        const prop = res.data.find(p => String(p.id) === String(selectedProposalId));
                        if (prop) {
                            setProjectNo(prev => prev || prop.project_number || prop.proposal_number || '');
                            setProjectTitle(prev => prev || prop.title_of_project || prop.quote_description || prop.activity || prop.project_name || prop.project_title || prop.subject || prop.title || prop.name || '');
                        }
                    }
                }
            })
            .catch(err => console.error("Failed to load proposals", err));
    }, [docInfo, selectedProposalId]);

    // Proposal Select Handler
    const handleProposalChange = (pId) => {
        setSelectedProposalId(pId);
        if (!pId) return;
        const prop = proposals.find(p => String(p.id) === String(pId));
        if (prop) {
            setProjectNo(prop.project_number || prop.proposal_number || '');
            setProjectTitle(prop.title_of_project || prop.quote_description || prop.activity || prop.project_name || prop.project_title || prop.subject || prop.title || prop.name || '');
        }
    };

    // Load Existing Submission
    useEffect(() => {
        if (!submissionId) {
            initFyValues(fyLabels);
            return;
        }
        isoSubmissionService.getSubmissionById(submissionId)
            .then(res => {
                if (!res) return;
                setStatus(res.status || 'DRAFT');
                const fd = res.form_data || {};
                if (fd.start_year) setStartYear(fd.start_year);
                if (fd.end_year) setEndYear(fd.end_year);
                if (Array.isArray(fd.fy_labels) && fd.fy_labels.length > 0) {
                    setFyLabels(fd.fy_labels);
                }
                if (fd.format_no) setFormatNo(fd.format_no);
                if (fd.prepared_on) setPreparedOn(fd.prepared_on);
                if (fd.project_no) setProjectNo(fd.project_no);
                if (fd.project_title) setProjectTitle(fd.project_title);
                if (fd.fy_values) setFyValues(fd.fy_values);
                if (fd.revenue_data) setRevenueData(fd.revenue_data);
                if (fd.infra_data) setInfraData(fd.infra_data);
                if (fd.tech_hr_data) setTechHrData(fd.tech_hr_data);
                if (fd.staff_data) setStaffData(fd.staff_data);
                if (fd.equip_list) setEquipList(fd.equip_list);
                if (fd.comments_notes) setCommentsNotes(fd.comments_notes);
                if (fd.prepared_by) setPreparedBy(fd.prepared_by);
                if (fd.approved_by) setApprovedBy(fd.approved_by);
                if (fd.group_head_title || fd.signatures?.group_head_title) setGroupHeadTitle(fd.group_head_title || fd.signatures?.group_head_title);
                if (fd.centre_head_title || fd.signatures?.centre_head_title) setCentreHeadTitle(fd.centre_head_title || fd.signatures?.centre_head_title);
                if (fd.cao_title || fd.signatures?.cao_title) setCaoTitle(fd.cao_title || fd.signatures?.cao_title);
            })
            .catch(err => console.error("Failed to load cost estimation sheet submission", err));
    }, [submissionId, initFyValues]);

    // Reset underflow warning when values change
    const resetUnderflowWarning = () => setUnderflowFlags({ infra: false, techHr: false, staff: false, equip: false });

    // Build Payload for Backend (.docx generation & DB Save)
    const buildPayload = (targetStatus = status) => {
        // Build account heads object
        const accountHeadsPayload = {};
        MAIN_ROWS_DEF.forEach(r => {
            if (r.editable) {
                const arr = fyValues[r.cod] || fyLabels.map(() => 0);
                accountHeadsPayload[r.cod] = {
                    values: arr,
                    total: computedMatrix.rowTotals[r.cod] || 0
                };
            } else {
                const arr = computedMatrix.matrix[r.cod] || fyLabels.map(() => 0);
                accountHeadsPayload[r.cod] = {
                    values: arr,
                    total: computedMatrix.rowTotals[r.cod] || 0
                };
            }
        });

        return {
            start_year: startYear,
            end_year: endYear,
            fy_labels: fyLabels,
            format_no: formatNo,
            prepared_on: preparedOn,
            project_no: projectNo,
            project_title: projectTitle,
            account_heads: accountHeadsPayload,
            revenue_projection: {
                ...revenueData,
                total: revenueTotal
            },
            infra_details: {
                ...infraData,
                total_c1_c2: displayInfraTotal,
                total_c1: displayInfraTotal
            },
            tech_hr_details: {
                ...techHrData,
                total_r6: displayTechHrTotal
            },
            staff_charges: {
                ...staffData,
                total_e1: displayStaffTotal
            },
            equipment_details: equipList,
            equip_total_c3_c4: displayEquipTotal,
            comments_notes: commentsNotes,
            prepared_by: preparedBy,
            approved_by: approvedBy,
            group_head_title: groupHeadTitle,
            centre_head_title: centreHeadTitle,
            cao_title: caoTitle,
            signatures: {
                group_head_title: groupHeadTitle,
                centre_head_title: centreHeadTitle,
                cao_title: caoTitle
            },
            fy_values: fyValues,
            revenue_data: revenueData,
            infra_data: infraData,
            tech_hr_data: techHrData,
            staff_data: staffData,
            equip_list: equipList,
            status: targetStatus,
            filename: `Project_Cost_Estimation_Sheet_${projectNo || 'New'}.docx`
        };
    };

    // Download Generated Word (.docx)
    const handleGenerateDoc = async (force = false) => {
        const sumRow = (cod) => (fyValues[cod] || []).reduce((s, v) => s + num(v), 0);

        const _mainC1C2 = sumRow('C1') + sumRow('C2');
        const _mainR6 = sumRow('R6');
        const _mainE1 = sumRow('E1');
        const _mainC3C4 = sumRow('C3') + sumRow('C4');

        const _infraUnderflow = _mainC1C2 > 0 && infraTotal < _mainC1C2;
        const _techHrUnderflow = _mainR6 > 0 && techHrTotal < _mainR6;
        const _staffUnderflow = _mainE1 > 0 && staffTotal < _mainE1;
        const _equipUnderflow = _mainC3C4 > 0 && equipTotal < _mainC3C4;

        const hasOverflow = infraOverflow || techHrOverflow || staffOverflow || equipOverflow;
        const hasUnderflow = _infraUnderflow || _techHrUnderflow || _staffUnderflow || _equipUnderflow;

        if (hasOverflow) {
            const subtableElem = document.getElementById('subtables-section');
            if (subtableElem) subtableElem.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (hasUnderflow && !force) {
            setPendingGenAction('doc');
            setUnderflowFlags({ infra: _infraUnderflow, techHr: _techHrUnderflow, staff: _staffUnderflow, equip: _equipUnderflow });
            setTimeout(() => {
                const subtableElem = document.getElementById('subtables-section');
                if (subtableElem) subtableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
            return;
        }

        setGenerating(true);
        try {
            const payload = buildPayload();
            const res = await axios.post(`${API_BASE_URL}/iso/cost-estimation-sheet/generate`, payload, {
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
            setUnderflowFlags({ infra: false, techHr: false, staff: false, equip: false });
        } catch (err) {
            console.error('Word generation error:', err);
            alert('Failed to generate Word document.');
        } finally {
            setGenerating(false);
        }
    };

    // Download Generated Excel (.xlsx)
    const handleGenerateExcel = async (force = false) => {
        const sumRow = (cod) => (fyValues[cod] || []).reduce((s, v) => s + num(v), 0);

        const _mainC1C2 = sumRow('C1') + sumRow('C2');
        const _mainR6 = sumRow('R6');
        const _mainE1 = sumRow('E1');
        const _mainC3C4 = sumRow('C3') + sumRow('C4');

        const _infraUnderflow = _mainC1C2 > 0 && infraTotal < _mainC1C2;
        const _techHrUnderflow = _mainR6 > 0 && techHrTotal < _mainR6;
        const _staffUnderflow = _mainE1 > 0 && staffTotal < _mainE1;
        const _equipUnderflow = _mainC3C4 > 0 && equipTotal < _mainC3C4;

        const hasOverflow = infraOverflow || techHrOverflow || staffOverflow || equipOverflow;
        const hasUnderflow = _infraUnderflow || _techHrUnderflow || _staffUnderflow || _equipUnderflow;

        if (hasOverflow) {
            const subtableElem = document.getElementById('subtables-section');
            if (subtableElem) subtableElem.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (hasUnderflow && !force) {
            setPendingGenAction('excel');
            setUnderflowFlags({ infra: _infraUnderflow, techHr: _techHrUnderflow, staff: _staffUnderflow, equip: _equipUnderflow });
            setTimeout(() => {
                const subtableElem = document.getElementById('subtables-section');
                if (subtableElem) subtableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
            return;
        }

        setGeneratingExcel(true);
        try {
            const payload = buildPayload();
            const excelFilename = `Project_Cost_Estimation_Sheet_${projectNo || 'New'}.xlsx`;
            payload.filename = excelFilename;

            const res = await axios.post(`${API_BASE_URL}/iso/cost-estimation-sheet/generate-excel`, payload, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', excelFilename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setUnderflowFlags({ infra: false, techHr: false, staff: false, equip: false });
        } catch (err) {
            console.error('Excel generation error:', err);
            alert('Failed to generate Excel sheet.');
        } finally {
            setGeneratingExcel(false);
        }
    };

    // Save Draft or Submit
    const handleSaveOrSubmit = async (targetStatus = 'DRAFT') => {
        setSubmitting(true);
        try {
            const payload = {
                proposal_id: selectedProposalId ? Number(selectedProposalId) : null,
                document_no: docInfo?.document_no || 'COST_EST',
                document_name: 'Project Cost Estimation Sheet',
                doc_type: 'COST_ESTIMATION_SHEET',
                status: targetStatus,
                form_data: buildPayload()
            };

            if (submissionId) {
                await isoSubmissionService.updateSubmission(submissionId, payload);
            } else {
                const created = await isoSubmissionService.createSubmission(payload);
                if (created?.id) setSubmissionId(created.id);
            }

            setStatus(targetStatus);
            alert(`Project Cost Estimation Sheet successfully saved as ${targetStatus}!`);
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save document submission.');
        } finally {
            setSubmitting(false);
        }
    };

    // Equipment Add / Remove / Change
    const handleAddEquipRow = () => {
        setEquipList(prev => [...prev, { equipment: '', cost: '' }]);
    };

    const handleRemoveEquipRow = (idx) => {
        setEquipList(prev => prev.filter((_, i) => i !== idx));
    };

    const handleEquipChange = (idx, field, val) => {
        const formatted = field === 'cost' ? formatInputWithCommas(val) : val;
        setEquipList(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: formatted };
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-slate-100 p-3 md:p-6 font-sans text-slate-900 flex flex-col items-center">
            <style dangerouslySetInnerHTML={{
                __html: `
                /* Remove number spinner arrows */
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                }
                input[type=number] {
                    -moz-appearance: textfield !important;
                }
                .grid-input:focus {
                    background-color: #fffbeb !important;
                }
            `}} />

            {/* Top Toolbar (no-print) */}
            <div className="w-full max-w-[1580px] bg-white border border-slate-300 rounded-xl shadow-xs p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 no-print sticky top-3 z-40">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                        >
                            <ArrowLeftOutlined /> Back
                        </button>
                    )}
                    <div>
                        <h2 className="text-sm md:text-base font-bold text-slate-800 m-0">
                            Project Cost Estimation Sheet
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">
                            {fyLabels.join(' • ')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                            'bg-amber-100 text-amber-800'
                        }`}>
                        {status}
                    </span>

                    <button
                        onClick={() => setShowSetup(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
                    >
                        <ReloadOutlined /> Change Duration
                    </button>

                    {!isReadOnly && (
                        <button
                            onClick={() => handleSaveOrSubmit('DRAFT')}
                            disabled={submitting}
                            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition shadow-xs"
                        >
                            {submitting ? 'Saving...' : 'Save Draft'}
                        </button>
                    )}

                    <button
                        onClick={() => handleGenerateDoc()}
                        disabled={generating}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                        <FileWordOutlined /> {generating ? 'Generating...' : 'Download Word'}
                    </button>

                    <button
                        onClick={() => handleGenerateExcel()}
                        disabled={generatingExcel}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                        <FileExcelOutlined /> {generatingExcel ? 'Generating...' : 'Download Excel'}
                    </button>
                </div>
            </div>

            {/* DURATION SETUP MODAL / SCREEN */}
            {showSetup && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-300 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-base font-bold text-slate-900 m-0">
                                Project Duration Setup
                            </h3>
                            <button
                                onClick={() => setShowSetup(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-600 m-0 leading-relaxed">
                            Enter the project duration in years to generate dynamic Financial Year (FY) columns for the estimation sheet.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Starting Year</label>
                                <input
                                    type="number"
                                    value={startYear}
                                    onChange={(e) => setStartYear(e.target.value)}
                                    placeholder="e.g. 2026"
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Ending Year</label>
                                <input
                                    type="number"
                                    value={endYear}
                                    onChange={(e) => setEndYear(e.target.value)}
                                    placeholder="e.g. 2028"
                                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-semibold"
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
                            <InfoCircleOutlined className="mr-1" />
                            Financial years will be generated as <strong>FY(YY-YY+1)</strong> — e.g. {startYear || '...'} to {endYear || '...'} produces: <strong>{(() => {
                                const s = parseInt(startYear, 10);
                                const e = parseInt(endYear, 10);
                                if (!s || !e || e < s || (e - s) > 10 || s < 1950 || e > 2100) return 'FY (..) - FY (..)';
                                const arr = [];
                                for (let y = s; y <= e; y++) arr.push(`FY (${last2(y)}-${last2(y + 1)})`);
                                return arr.join(', ');
                            })()}</strong>
                        </div>

                        {setupError && (
                            <div className="text-xs text-rose-600 font-semibold">{setupError}</div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowSetup(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateCostSheet}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                            >
                                Generate Cost Sheet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN INTERACTIVE SHEET CONTAINER (Comfortable Large View) */}
            <div className="w-full max-w-[1580px] bg-white border border-slate-800 shadow-2xl rounded-none p-4 md:p-6 mb-12 space-y-4 sheet-container">

                {/* ========================================================================= */}
                {/* 3-COLUMN MASTER GRID (Matching new_Project_cost_Estimation.docx layout)   */}
                {/* ========================================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                    {/* --------------------------------------------------------------------- */}
                    {/* COLUMN 1 (LEFT, 5 Cols): INFO BOX + MAIN ACCOUNT HEADS TABLE          */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="lg:col-span-5 space-y-3">

                        {/* 1. Institute Info Box */}
                        <div className="border border-slate-800 bg-white">
                            <div className="bg-slate-200 text-slate-900 font-bold p-1.5 text-center border-b border-slate-800 text-xs md:text-sm tracking-wide">
                                <div>Central Manufacturing Technology Institute</div>
                                <div className="text-[11px] font-semibold text-slate-700 tracking-normal">ISO 9001:2015</div>
                            </div>
                            <div className="p-1.5 border-b border-slate-800 flex items-center gap-2 bg-white">
                                <span className="font-bold text-slate-800 shrink-0 text-xs">Prepared on:</span>
                                <input
                                    type="text"
                                    value={preparedOn}
                                    onChange={(e) => setPreparedOn(e.target.value)}
                                    disabled={isReadOnly}
                                    className="w-full text-xs md:text-sm outline-none border-b border-dashed border-slate-400 bg-transparent font-medium"
                                />
                            </div>
                            <div className="bg-slate-200 text-slate-900 font-bold p-1.5 text-center border-b border-slate-800 uppercase tracking-wider text-xs md:text-sm">
                                PROJECT COST ESTIMATION SHEET
                            </div>
                            <div className="grid grid-cols-12 border-b border-slate-800">
                                <div className="col-span-4 p-1.5 font-bold text-slate-800 border-r border-slate-800 bg-slate-50 text-xs">
                                    Project No.:
                                </div>
                                <div className="col-span-8 p-1.5 flex items-center">
                                    <input
                                        type="text"
                                        value={projectNo}
                                        onChange={(e) => setProjectNo(e.target.value)}
                                        disabled={isReadOnly}
                                        placeholder="Project Number"
                                        className="w-full text-xs md:text-sm outline-none bg-transparent font-bold text-slate-900"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-12">
                                <div className="col-span-4 p-1.5 font-bold text-slate-800 border-r border-slate-800 bg-slate-50 text-xs">
                                    Project Title:
                                </div>
                                <div className="col-span-8 p-1.5 flex items-start">
                                    <textarea
                                        value={projectTitle}
                                        onChange={(e) => setProjectTitle(e.target.value)}
                                        disabled={isReadOnly}
                                        rows={2}
                                        placeholder="Project Title"
                                        className="w-full text-xs md:text-sm outline-none bg-transparent font-medium resize-none leading-relaxed text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Main Multi-Year Account Heads Table */}
                        <div className="border border-slate-800 overflow-x-auto bg-white shadow-xs">
                            <table className="w-full text-xs md:text-[12.5px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold text-center border-b border-slate-800">
                                        <th className="p-1 border border-slate-800 w-10">COD</th>
                                        <th className="p-1 border border-slate-800 text-left min-w-[160px]">Account Heads</th>
                                        {fyLabels.map((fy, i) => (
                                            <th key={i} className="p-1 border border-slate-800 min-w-[70px]">{fy}<br /><span className="font-normal text-slate-600">(₹)</span></th>
                                        ))}
                                        <th className="p-1 border border-slate-800 min-w-[80px]">Total<br /><span className="font-normal text-slate-600">(₹)</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MAIN_ROWS_DEF.map(row => {
                                        const isGrandTotal = row.computed === "TPC";
                                        const isSubtotal = Boolean(row.computed) && !isGrandTotal;
                                        const rowBg = isGrandTotal ? 'bg-slate-300 font-bold' : isSubtotal ? 'bg-slate-100 font-bold' : 'bg-white';

                                        return (
                                            <tr key={row.cod} className={`${rowBg} hover:bg-amber-50/40 transition-colors`}>
                                                <td className="p-1 border border-slate-800 text-center font-bold text-slate-900">{row.cod}</td>
                                                <td className="p-1 border border-slate-800 text-left leading-snug">{row.label}</td>

                                                {/* FY Columns */}
                                                {fyLabels.map((_, colIdx) => {
                                                    if (row.editable) {
                                                        return (
                                                            <td key={colIdx} className="p-0 border border-slate-800">
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    value={fyValues[row.cod]?.[colIdx] ?? ''}
                                                                    onChange={(e) => handleFyInputChange(row.cod, colIdx, e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="grid-input w-full p-1 md:p-1.5 text-right text-xs md:text-[12.5px] border-none outline-none bg-transparent font-medium"
                                                                />
                                                            </td>
                                                        );
                                                    } else {
                                                        const val = computedMatrix.matrix[row.cod]?.[colIdx] ?? 0;
                                                        return (
                                                            <td key={colIdx} className="p-1 md:p-1.5 border border-slate-800 text-right font-mono font-bold bg-slate-50/60">
                                                                ₹{formatIndian(val)}
                                                            </td>
                                                        );
                                                    }
                                                })}

                                                {/* Total Column */}
                                                <td className={`p-1 md:p-1.5 border border-slate-800 text-right font-mono font-bold ${isGrandTotal ? 'text-slate-950 text-xs md:text-sm' : 'text-slate-900 bg-slate-100/80'}`}>
                                                    ₹{formatIndian(computedMatrix.rowTotals[row.cod] ?? 0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                    </div>

                    {/* --------------------------------------------------------------------- */}
                    {/* COLUMN 2 (MIDDLE, 4 Cols): REVENUE + INFRA + TECH HR + STAFF CHARGES  */}
                    {/* --------------------------------------------------------------------- */}
                    <div id="subtables-section" className="lg:col-span-4 space-y-3">

                        {/* 1. Estimated Revenue Projection */}
                        <div className="border border-slate-800 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-xs md:text-[12.5px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-800">
                                        <th colSpan={2} className="p-1.5 text-center">
                                            Estimated Revenue Projection
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-800">
                                        <th className="p-1 border-r border-slate-800 w-1/2"></th>
                                        <th className="p-1 text-center w-1/2">Estimated Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-800 hover:bg-amber-50/40">
                                        <td className="p-1.5 border-r border-slate-800 font-medium">External Work</td>
                                        <td className="p-0">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={revenueData.external_work}
                                                onChange={(e) => handleRevenueChange('external_work', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                            />
                                        </td>
                                    </tr>
                                    <tr className="border-b border-slate-800 hover:bg-amber-50/40">
                                        <td className="p-1.5 border-r border-slate-800 font-medium">Internal Work</td>
                                        <td className="p-0">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={revenueData.internal_work}
                                                onChange={(e) => handleRevenueChange('internal_work', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                            />
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-100 font-bold border-t border-slate-800">
                                        <td className="p-1.5 border-r border-slate-800 text-slate-900">Total</td>
                                        <td className="p-1.5 text-right font-mono text-slate-900">
                                            {formatIndian(revenueTotal)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 2. Details of Infrastructure Development */}
                        <div className="border border-slate-800 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-xs md:text-[12.5px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-800">
                                        <th colSpan={3} className="p-1.5 text-center">
                                            Details of Infrastructure Development
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-800">
                                        <th className="p-1 border-r border-slate-800 w-8">SN</th>
                                        <th className="p-1 border-r border-slate-800 text-left">Description</th>
                                        <th className="p-1 w-32">Estimated Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { sn: '1', key: 'civil', label: 'Civil' },
                                        { sn: '2', key: 'electrical', label: 'Electrical' },
                                        { sn: '3', key: 'ac_clean_room', label: 'AC / Clean Room' },
                                        { sn: '4', key: 'furniture_utilities', label: 'Furniture / Utilities' },
                                    ].map(item => (
                                        <tr key={item.key} className="border-b border-slate-800 hover:bg-amber-50/40">
                                            <td className="p-1 border-r border-slate-800 text-center font-semibold text-slate-600">{item.sn}</td>
                                            <td className="p-1 border-r border-slate-800 font-medium">{item.label}</td>
                                            <td className="p-0">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={infraData[item.key]}
                                                    onChange={(e) => handleInfraChange(item.key, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full p-1 md:p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className={`font-bold border-t border-slate-800 ${infraOverflow ? 'bg-rose-100' : underflowFlags.infra ? 'bg-amber-50' : 'bg-slate-100'}`}>
                                        <td colSpan={2} className={`p-1.5 border-r border-slate-800 ${infraOverflow ? 'text-rose-700' : underflowFlags.infra ? 'text-amber-800' : 'text-slate-900'}`}>
                                            Total (C1+C2)
                                            {infraOverflow && <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-200 px-1.5 py-0.5 rounded-full">⚠ Exceeds Budget</span>}
                                            {underflowFlags.infra && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">⚠ Less Than Budget</span>}
                                        </td>
                                        <td className={`p-1.5 text-right font-mono ${infraOverflow ? 'text-rose-700' : underflowFlags.infra ? 'text-amber-800' : 'text-slate-900'}`}>
                                            ₹{formatIndian(displayInfraTotal)}
                                        </td>
                                    </tr>
                                    {infraOverflow && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-rose-50 border-t border-rose-300">
                                                <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-semibold">
                                                    <span>⚠</span>
                                                    <span>Sub-items total <strong>₹{formatIndian(infraTotal)}</strong> exceeds allocated budget <strong>₹{formatIndian(displayInfraTotal)}</strong>. Please reduce.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {underflowFlags.infra && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-amber-50 border-t border-amber-300">
                                                <div className="flex items-center justify-between gap-1.5 text-[11px] text-amber-800 font-semibold">
                                                    <span>⚠ Sub-items total <strong>₹{formatIndian(infraTotal)}</strong> is less than allocated budget <strong>₹{formatIndian(displayInfraTotal)}</strong>.</span>
                                                    <button onClick={() => pendingGenAction === 'excel' ? handleGenerateExcel(true) : handleGenerateDoc(true)} className="underline text-amber-900 hover:text-indigo-700 text-[10px] font-bold ml-2 whitespace-nowrap cursor-pointer">Generate Anyway →</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Details of Technical HR */}
                        <div className="border border-slate-800 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-xs md:text-[12.5px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-800">
                                        <th colSpan={3} className="p-1.5 text-center">
                                            Details of Technical HR
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-800">
                                        <th className="p-1 border-r border-slate-800 w-8">SN</th>
                                        <th className="p-1 border-r border-slate-800 text-left">Technical HR</th>
                                        <th className="p-1 w-32">Estimated Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { sn: '1', key: 'consultant_experts', label: 'Consultant / Experts' },
                                        { sn: '2', key: 'ra_srf_jrf', label: 'RA / SRF / JRF' },
                                        { sn: '3', key: 'proj_engineers_fellow', label: 'Proj . Engineers / Fellow' },
                                        { sn: '4', key: 'support_staff', label: 'Support Staff Hiring' },
                                    ].map(item => (
                                        <tr key={item.key} className="border-b border-slate-800 hover:bg-amber-50/40">
                                            <td className="p-1 border-r border-slate-800 text-center font-semibold text-slate-600">{item.sn}</td>
                                            <td className="p-1 border-r border-slate-800 font-medium">{item.label}</td>
                                            <td className="p-0">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={techHrData[item.key]}
                                                    onChange={(e) => handleTechHrChange(item.key, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full p-1 md:p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className={`font-bold border-t border-slate-800 ${techHrOverflow ? 'bg-rose-100' : underflowFlags.techHr ? 'bg-amber-50' : 'bg-slate-100'}`}>
                                        <td colSpan={2} className={`p-1.5 border-r border-slate-800 ${techHrOverflow ? 'text-rose-700' : underflowFlags.techHr ? 'text-amber-800' : 'text-slate-900'}`}>
                                            Total Tech. HR (R6)
                                            {techHrOverflow && <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-200 px-1.5 py-0.5 rounded-full">⚠ Exceeds Budget</span>}
                                            {underflowFlags.techHr && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">⚠ Less Than Budget</span>}
                                        </td>
                                        <td className={`p-1.5 text-right font-mono ${techHrOverflow ? 'text-rose-700' : underflowFlags.techHr ? 'text-amber-800' : 'text-slate-900'}`}>
                                            ₹{formatIndian(displayTechHrTotal)}
                                        </td>
                                    </tr>
                                    {techHrOverflow && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-rose-50 border-t border-rose-300">
                                                <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-semibold">
                                                    <span>⚠</span>
                                                    <span>Sub-items total <strong>₹{formatIndian(techHrTotal)}</strong> exceeds allocated budget <strong>₹{formatIndian(displayTechHrTotal)}</strong>. Please reduce.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {underflowFlags.techHr && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-amber-50 border-t border-amber-300">
                                                <div className="flex items-center justify-between gap-1.5 text-[11px] text-amber-800 font-semibold">
                                                    <span>⚠ Sub-items total <strong>₹{formatIndian(techHrTotal)}</strong> is less than allocated budget <strong>₹{formatIndian(displayTechHrTotal)}</strong>.</span>
                                                    <button onClick={() => pendingGenAction === 'excel' ? handleGenerateExcel(true) : handleGenerateDoc(true)} className="underline text-amber-900 hover:text-indigo-700 text-[10px] font-bold ml-2 whitespace-nowrap cursor-pointer">Generate Anyway →</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 4. Regular Staff Charges */}
                        <div className="border border-slate-800 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-xs md:text-[12.5px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-800">
                                        <th colSpan={3} className="p-1.5 text-center">
                                            Regular Staff Charges
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-800">
                                        <th className="p-1 border-r border-slate-800 w-8">SN</th>
                                        <th className="p-1 border-r border-slate-800 text-left">Levels</th>
                                        <th className="p-1 w-32">Estimated Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { sn: '1', key: 'sct_e_above', label: 'Sct . E &  Above' },
                                        { sn: '2', key: 'sct_b_d_sto', label: 'Sct . B to D & STO' },
                                        { sn: '3', key: 'technical_staff', label: 'Technical Staff' },
                                    ].map(item => (
                                        <tr key={item.key} className="border-b border-slate-800 hover:bg-amber-50/40">
                                            <td className="p-1 border-r border-slate-800 text-center font-semibold text-slate-600">{item.sn}</td>
                                            <td className="p-1 border-r border-slate-800 font-medium">{item.label}</td>
                                            <td className="p-0">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={staffData[item.key]}
                                                    onChange={(e) => handleStaffChange(item.key, e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full p-1 md:p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className={`font-bold border-t border-slate-800 ${staffOverflow ? 'bg-rose-100' : underflowFlags.staff ? 'bg-amber-50' : 'bg-slate-100'}`}>
                                        <td colSpan={2} className={`p-1.5 border-r border-slate-800 ${staffOverflow ? 'text-rose-700' : underflowFlags.staff ? 'text-amber-800' : 'text-slate-900'}`}>
                                            Total (E1)
                                            {staffOverflow && <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-200 px-1.5 py-0.5 rounded-full">⚠ Exceeds Budget</span>}
                                            {underflowFlags.staff && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">⚠ Less Than Budget</span>}
                                        </td>
                                        <td className={`p-1.5 text-right font-mono ${staffOverflow ? 'text-rose-700' : underflowFlags.staff ? 'text-amber-800' : 'text-slate-900'}`}>
                                            ₹{formatIndian(displayStaffTotal)}
                                        </td>
                                    </tr>
                                    {staffOverflow && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-rose-50 border-t border-rose-300">
                                                <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-semibold">
                                                    <span>⚠</span>
                                                    <span>Sub-items total <strong>₹{formatIndian(staffTotal)}</strong> exceeds allocated budget <strong>₹{formatIndian(displayStaffTotal)}</strong>. Please reduce.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {underflowFlags.staff && (
                                        <tr>
                                            <td colSpan={3} className="px-2 py-1.5 bg-amber-50 border-t border-amber-300">
                                                <div className="flex items-center justify-between gap-1.5 text-[11px] text-amber-800 font-semibold">
                                                    <span>⚠ Sub-items total <strong>₹{formatIndian(staffTotal)}</strong> is less than allocated budget <strong>₹{formatIndian(displayStaffTotal)}</strong>.</span>
                                                    <button onClick={() => pendingGenAction === 'excel' ? handleGenerateExcel(true) : handleGenerateDoc(true)} className="underline text-amber-900 hover:text-indigo-700 text-[10px] font-bold ml-2 whitespace-nowrap cursor-pointer">Generate Anyway →</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>

                    {/* --------------------------------------------------------------------- */}
                    {/* COLUMN 3 (RIGHT, 3 Cols): DETAILS OF EQUIPMENTS / APPARATUS           */}
                    {/* --------------------------------------------------------------------- */}
                    <div className="lg:col-span-3 border border-slate-800 bg-white flex flex-col justify-between shadow-xs">
                        <table className="w-full text-xs md:text-[12.5px] border-collapse">
                            <thead>
                                <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-800">
                                    <th colSpan={!isReadOnly ? 4 : 3} className="p-1.5 text-center leading-tight">
                                        Details of Equipments / Apparatus / Instruments
                                    </th>
                                </tr>
                                <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-800">
                                    <th className="p-1 border-r border-slate-800 w-8">SN</th>
                                    <th className="p-1 border-r border-slate-800 text-left">Equipment</th>
                                    <th className="p-1 min-w-[80px]">Estimated Cost</th>
                                    {!isReadOnly && <th className="p-1 w-6"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {equipList.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-800 hover:bg-amber-50/40">
                                        <td className="p-1 border-r border-slate-800 text-center font-semibold text-slate-600 align-top pt-1.5">{idx + 1}</td>
                                        <td className="p-0.5 border-r border-slate-800 align-top">
                                            <textarea
                                                value={item.equipment}
                                                onChange={(e) => {
                                                    handleEquipChange(idx, 'equipment', e.target.value);
                                                    e.target.style.height = 'auto';
                                                    e.target.style.height = `${e.target.scrollHeight}px`;
                                                }}
                                                ref={(el) => {
                                                    if (el) {
                                                        el.style.height = 'auto';
                                                        el.style.height = `${el.scrollHeight}px`;
                                                    }
                                                }}
                                                disabled={isReadOnly}
                                                rows={1}
                                                className="w-full p-1 text-xs md:text-[12px] outline-none bg-transparent font-medium focus:bg-amber-50 resize-none overflow-hidden leading-snug align-top block"
                                                placeholder="Enter equipment details..."
                                            />
                                        </td>
                                        <td className="p-0 align-top">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.cost}
                                                onChange={(e) => handleEquipChange(idx, 'cost', e.target.value)}
                                                disabled={isReadOnly}
                                                className="w-full p-1 md:p-1.5 text-right text-xs md:text-[12.5px] outline-none bg-transparent font-semibold focus:bg-amber-50"
                                            />
                                        </td>
                                        {!isReadOnly && (
                                            <td className="p-1 text-center align-top pt-1.5">
                                                <button
                                                    onClick={() => handleRemoveEquipRow(idx)}
                                                    className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                                                    title="Remove row"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                <tr className={`font-bold border-t border-slate-800 ${equipOverflow ? 'bg-rose-100' : underflowFlags.equip ? 'bg-amber-50' : 'bg-slate-100'}`}>
                                    <td colSpan={2} className={`p-1.5 border-r border-slate-800 ${equipOverflow ? 'text-rose-700' : underflowFlags.equip ? 'text-amber-800' : 'text-slate-900'}`}>
                                        Total (C3+C4)
                                        {equipOverflow && <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-200 px-1.5 py-0.5 rounded-full">⚠ Exceeds Budget</span>}
                                        {underflowFlags.equip && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">⚠ Less Than Budget</span>}
                                    </td>
                                    <td className={`p-1.5 text-right font-mono ${equipOverflow ? 'text-rose-700' : underflowFlags.equip ? 'text-amber-800' : 'text-slate-900'}`}>
                                        ₹{formatIndian(displayEquipTotal)}
                                    </td>
                                    {!isReadOnly && <td></td>}
                                </tr>
                                {equipOverflow && (
                                    <tr>
                                        <td colSpan={!isReadOnly ? 4 : 3} className="px-2 py-1.5 bg-rose-50 border-t border-rose-300">
                                            <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-semibold">
                                                <span>⚠</span>
                                                <span>Equipment total <strong>₹{formatIndian(equipTotal)}</strong> exceeds allocated budget <strong>₹{formatIndian(displayEquipTotal)}</strong>. Please reduce.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {underflowFlags.equip && (
                                    <tr>
                                        <td colSpan={!isReadOnly ? 4 : 3} className="px-2 py-1.5 bg-amber-50 border-t border-amber-300">
                                            <div className="flex items-center justify-between gap-1.5 text-[11px] text-amber-800 font-semibold">
                                                <span>⚠ Equipment total <strong>₹{formatIndian(equipTotal)}</strong> is less than allocated budget <strong>₹{formatIndian(displayEquipTotal)}</strong>.</span>
                                                <button onClick={() => pendingGenAction === 'excel' ? handleGenerateExcel(true) : handleGenerateDoc(true)} className="underline text-amber-900 hover:text-indigo-700 text-[10px] font-bold ml-2 whitespace-nowrap cursor-pointer">Generate Anyway →</button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {!isReadOnly && (
                            <div className="p-1.5 bg-slate-50 border-t border-slate-200 text-left">
                                <button
                                    onClick={handleAddEquipRow}
                                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded cursor-pointer"
                                >
                                    + Add equipment row
                                </button>
                            </div>
                        )}
                    </div>

                </div>

                {/* ========================================================================= */}
                {/* 3. COMMENTS / NOTES                                                       */}
                {/* ========================================================================= */}
                <div className="pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm font-bold text-slate-800 shrink-0">Comments/Notes:</span>
                        <input
                            type="text"
                            value={commentsNotes}
                            onChange={(e) => setCommentsNotes(e.target.value)}
                            disabled={isReadOnly}
                            placeholder="Add comments or notes..."
                            className="w-full text-xs md:text-sm border-b border-slate-400 outline-none pb-0.5 font-medium text-slate-900 bg-transparent"
                        />
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* 4. AUTHORITY SIGNATURES (6 Columns)                                       */}
                {/* ========================================================================= */}
                <div id="signatures-section" className="pt-8 pb-3">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                        {[
                            { title: 'Project Leader / Project Co-Ordinator', editable: false },
                            { title: groupHeadTitle, value: groupHeadTitle, setter: setGroupHeadTitle, editable: true, tooltip: 'Click to edit Group Head designation' },
                            { title: centreHeadTitle, value: centreHeadTitle, setter: setCentreHeadTitle, editable: true, tooltip: 'Click to edit Centre Head designation' },
                            { title: caoTitle, value: caoTitle, setter: setCaoTitle, editable: true, tooltip: 'Click to edit Chief Accounts Officer designation' },
                            { title: 'Head (PPM)', editable: false },
                            { title: 'Director', editable: false }
                        ].map((sig, idx) => (
                            <div key={idx} className="flex flex-col justify-end">
                                <div className="border-t border-slate-800 pt-1.5 text-xs md:text-[12px] font-bold text-slate-900">
                                    {sig.editable ? (
                                        <input
                                            type="text"
                                            value={sig.value}
                                            onChange={(e) => sig.setter(e.target.value)}
                                            disabled={isReadOnly}
                                            title={sig.tooltip}
                                            className="w-full text-center font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-indigo-500 outline-none bg-transparent hover:bg-amber-50/50 text-xs md:text-[12px]"
                                        />
                                    ) : (
                                        sig.title
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
