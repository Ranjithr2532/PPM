import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    DownloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    FolderOpenOutlined,
    EyeOutlined,
    PaperClipOutlined,
    FilePdfOutlined,
    FileExcelOutlined,
    FileImageOutlined,
    FileTextOutlined,
    LinkOutlined,
    ExpandOutlined,
    CompressOutlined
} from '@ant-design/icons';
import axios from 'axios';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService, getLoggedUserName } from '../services/isoSubmissionService';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const resolveDocUrl = (url) => {
    if (!url) return '';
    if (typeof url !== 'string') return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }
    const cleanBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanPath}`;
};

const getFileTypeInfo = (url, name) => {
    const target = (name || url || '').toLowerCase();
    const clean = target.split('?')[0].split('#')[0];
    const ext = clean.split('.').pop();

    if (['pdf'].includes(ext)) {
        return { type: 'pdf', label: 'PDF Document', color: 'red', icon: <FilePdfOutlined /> };
    }
    if (['doc', 'docx'].includes(ext)) {
        return { type: 'word', label: 'Word Document', color: 'blue', icon: <FileWordOutlined /> };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return { type: 'excel', label: 'Excel Spreadsheet', color: 'green', icon: <FileExcelOutlined /> };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        return { type: 'image', label: 'Image', color: 'purple', icon: <FileImageOutlined /> };
    }
    if (['txt', 'log', 'json', 'md'].includes(ext)) {
        return { type: 'text', label: 'Text File', color: 'slate', icon: <FileTextOutlined /> };
    }
    return { type: 'generic', label: 'File', color: 'default', icon: <FileTextOutlined /> };
};



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
        return (parsedUser.group || parsedUser.groupName || '').trim().toUpperCase();
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
        const parsedUser = JSON.parse(rawUser);
        const r = (parsedUser.role || '').toLowerCase().trim();
        if (r === 'centre head' || r === 'center head') return 'ch';
        if (r === 'group head') return 'gh';
        return r || 'scientist';
    } catch (e) {
        return 'scientist';
    }
};

const DEFAULT_RESPONSES = {
    r1_response: 'Yes',
    r1_details: '',
    r2_response: 'Yes',
    r2_details: '',
    r3_response: 'No',
    r3_details: '',
    r4_response: 'No',
    r4_details: '',
    r5_response: 'No',
    r5_details: '',
    r6_response: 'No',
    r6_details: '',
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
        point: "Any other requirements not stated in the enquiry, but necessary in the intended use.\nEg : Item has be flame proof,\nItem has to be used in different sites etc.\nPlease mention in details",
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
        point: "All Statutory & Regulatory requirement applicable?\neg : Fire safety certification, etc",
        key_resp: "r5_response",
        key_det: "r5_details",
    },
    {
        sl_no: 6,
        point: "Any Operation Risk related to following is identified (if yes give details)\n1. New Technology\n2. Ability and capacity to provide product or service\n3. Short delivery time frame",
        key_resp: "r6_response",
        key_det: "r6_details",
    },
];

export default function Fesability({ proposalId: propProposalId, submissionId: propSubmissionId, onBack, docInfo }) {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState(propProposalId ? String(propProposalId) : '');
    const [projectNumber, setProjectNumber] = useState('');
    const [submissionId, setSubmissionId] = useState(propSubmissionId || null);
    const [status, setStatus] = useState('DRAFT');

    // Project Stage-Wise Documents States
    const [projectStages, setProjectStages] = useState([]);
    const [selectedStageId, setSelectedStageId] = useState(null);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [showDocListMenu, setShowDocListMenu] = useState(false);
    const docListMenuRef = useRef(null);

    // Floating & Draggable Document Viewer States
    const [showDocViewer, setShowDocViewer] = useState(false);
    const [activeViewerDoc, setActiveViewerDoc] = useState(null);
    const [docViewerUrl, setDocViewerUrl] = useState('');
    const [docViewType, setDocViewType] = useState('loading'); // 'loading' | 'html' | 'excel' | 'pdf' | 'image' | 'iframe' | 'error'
    const [docHtmlContent, setDocHtmlContent] = useState('');
    const [excelWorkbook, setExcelWorkbook] = useState(null);
    const [excelSheetNames, setExcelSheetNames] = useState([]);
    const [activeSheetName, setActiveSheetName] = useState('');
    const [isViewerMaximized, setIsViewerMaximized] = useState(false);

    // Draggable window coordinates & drag handling
    const [docViewerPos, setDocViewerPos] = useState({ x: 200, y: 80 });
    const [isDraggingDocWin, setIsDraggingDocWin] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posStartX: 200, posStartY: 80 });

    const handleMouseDownDocHeader = (e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) return;
        if (isViewerMaximized) return;
        setIsDraggingDocWin(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posStartX: docViewerPos.x,
            posStartY: docViewerPos.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDraggingDocWin) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            setDocViewerPos({
                x: Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posStartX + dx)),
                y: Math.max(10, Math.min(window.innerHeight - 100, dragStartRef.current.posStartY + dy))
            });
        };

        const handleMouseUp = () => {
            if (isDraggingDocWin) setIsDraggingDocWin(false);
        };

        if (isDraggingDocWin) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingDocWin]);

    // Close document list dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (docListMenuRef.current && !docListMenuRef.current.contains(event.target)) {
                setShowDocListMenu(false);
            }
        };
        if (showDocListMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDocListMenu]);

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

    // Document state (replaces Ant Design form state)
    const [partyDetails, setPartyDetails] = useState('');
    const [enquiryRef, setEnquiryRef] = useState('');
    const [description, setDescription] = useState('');
    const [conclusion, setConclusion] = useState('Feasible'); // 'Feasible' | 'Not Feasible'
    const [filename, setFilename] = useState('CMTI_Feasibility_Report.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [docNo, setDocNo] = useState(() => docInfo?.document_no || '049');
    const [revisionCode, setRevisionCode] = useState(() => getDefaultRevisionCode(docInfo?.document_no || '049'));
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState(() => getLoggedUserName());
    const [approvedBy, setApprovedBy] = useState('');
    const [responses, setResponses] = useState(DEFAULT_RESPONSES);

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
    const isReadOnly = isAdmin ? false : isApproved;

    useEffect(() => {
        if (docInfo) {
            const num = docInfo.document_no || '049';
            setDocNo(num);
            setRevisionCode(getDefaultRevisionCode(num));
        }
    }, [docInfo]);

    // Fetch document number dynamically from ISODocumentList database table
    useEffect(() => {
        axios.get(`${API_BASE_URL}/iso-document-list/`)
            .then(res => {
                if (Array.isArray(res.data)) {
                    const match = res.data.find(
                        d => (d.name || '').toUpperCase().includes('FEASIBILITY') || (d.document_no || '').startsWith('049') || d.document_no === '49'
                    );
                    if (match) {
                        const num = docInfo?.document_no || match.document_no || '049';
                        setDocNo(num);
                        setRevisionCode(getDefaultRevisionCode(num));
                    }
                }
            })
            .catch(err => console.error('Error fetching ISO document list for Feasibility:', err));
    }, []);

    // Check props or URL parameters to load existing submission
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlId = propSubmissionId || searchParams.get('id') || searchParams.get('submission_id');
        const urlPropId = propProposalId || searchParams.get('proposal_id');

        if (urlPropId) {
            setSelectedProposalId(String(urlPropId));
        }

        async function loadSubmission() {
            try {
                let sub = null;
                if (urlId) {
                    const res = await axios.get(`${API_BASE_URL}/iso-submissions/${urlId}`);
                    if (res.data) sub = res.data;
                } else if (urlPropId) {
                    const subs = await isoSubmissionService.getSubmissions({ proposal_id: urlPropId, doc_type: 'FEASIBILITY' });
                    if (Array.isArray(subs) && subs.length > 0) sub = subs[0];
                }

                if (sub) {
                    setSubmissionId(sub.id);
                    submissionIdRef.current = sub.id;
                    setStatus(sub.status || 'DRAFT');
                    statusRef.current = sub.status || 'DRAFT';
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
                    const updatedResp = { ...DEFAULT_RESPONSES };
                    rList.forEach((pt, idx) => {
                        const template = REVIEW_POINTS_TEMPLATES[idx];
                        if (template) {
                            if (pt.yes_no_na !== undefined || pt.response !== undefined) {
                                updatedResp[template.key_resp] = pt.yes_no_na || pt.response || '';
                            }
                            if (pt.details !== undefined) {
                                updatedResp[template.key_det] = pt.details || '';
                            }
                        }
                    });
                    setResponses(updatedResp);
                }
            } catch (err) {
                console.error('Failed to load ISO submission:', err);
            } finally {
                setTimeout(() => { isHydratedRef.current = true; }, 400);
            }
        }
        loadSubmission();
    }, [propSubmissionId, propProposalId]);

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
                documentTitle: 'FEASIBILITY REVIEW FORM',
                docNo: docNo || '',
                code: revisionCode,
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || '',
                isoSpec: '',
                groupName: getLoggedUserGroup() || '',
                preparedName: preparedBy || getLoggedUserName(),
                approvedName: approvedBy || '',
            };

            const reviewPointsList = REVIEW_POINTS_TEMPLATES.map((item) => ({
                sl_no: item.sl_no,
                point: item.point,
                yes_no_na: responses[item.key_resp] || '',
                details: responses[item.key_det] || '',
            }));

            const formDataPayload = {
                party_details: partyDetails,
                enquiry_ref_no: enquiryRef,
                description_of_the_enquiry: description,
                review_points: reviewPointsList,
                conclusion: conclusion,
            };

            const currentDocStatus = (statusRef.current === 'APPROVED' || statusRef.current === 'SUBMITTED') ? statusRef.current : 'DRAFT';

            const payload = {
                doc_type: 'FEASIBILITY',
                document_no: docNo || '',
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
            console.error('Auto-save error in Feasibility:', err);
            setAutoSaveState('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [isReadOnly, docNo, revisionCode, docDate, loggedCentreDept, preparedBy, approvedBy, responses, partyDetails, enquiryRef, description, conclusion, selectedProposalId]);

    // Debounced Auto-Save
    useEffect(() => {
        if (!isHydratedRef.current || isReadOnly) return;
        const timer = setTimeout(() => { performAutoSave(); }, 1000);
        return () => clearTimeout(timer);
    }, [partyDetails, enquiryRef, description, responses, conclusion, preparedBy, approvedBy, docNo, docDate, selectedProposalId, performAutoSave, isReadOnly]);

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

            if (!name && !group && !center) return;

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

    // Auto-select first proposal if not already specified
    useEffect(() => {
        if (proposals.length > 0 && !selectedProposalId) {
            setSelectedProposalId(String(proposals[0].id));
        }
    }, [proposals, selectedProposalId]);

    // Automatically pre-populate details when proposal is selected or proposals loaded
    useEffect(() => {
        if (!selectedProposalId) return;

        if (proposals.length > 0) {
            const prop = proposals.find(p => String(p.id) === String(selectedProposalId));
            if (prop) {
                if (prop.project_number) setProjectNumber(prop.project_number);
                if (prop.customer_name || prop.customerName) setPartyDetails(prop.customer_name || prop.customerName);
                if (prop.email_reference || prop.emailReference) setEnquiryRef(prop.email_reference || prop.emailReference);
                if (prop.quote_description || prop.quoteDescription) setDescription(prop.quote_description || prop.quoteDescription);
                return;
            }
        }

        // Direct fetch if proposal not found in current proposals list
        axios.get(`${API_BASE_URL}/proposals/${selectedProposalId}`)
            .then(res => {
                if (res.data) {
                    const prop = res.data;
                    if (prop.project_number) setProjectNumber(prop.project_number);
                    if (prop.customer_name || prop.customerName) setPartyDetails(prop.customer_name || prop.customerName);
                    if (prop.email_reference || prop.emailReference) setEnquiryRef(prop.email_reference || prop.emailReference);
                    if (prop.quote_description || prop.quoteDescription) setDescription(prop.quote_description || prop.quoteDescription);
                }
            })
            .catch(err => console.error('Error fetching proposal details:', err));
    }, [selectedProposalId, proposals]);

    // Fetch project stage configuration and stage-wise documents strictly
    const fetchProjectDocuments = useCallback(async (projId) => {
        const pid = projId || selectedProposalId;
        if (!pid) return;
        try {
            const token = localStorage.getItem('token');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

            // 1. Fetch stage configuration for ordering
            let configs = [];
            try {
                const stageCfgRes = await axios.get(`${API_BASE_URL}/stages/`, { headers: authHeaders });
                if (Array.isArray(stageCfgRes.data)) {
                    configs = stageCfgRes.data;
                }
            } catch (cfgErr) {
                console.warn('Could not fetch stage config:', cfgErr);
            }

            // 2. Fetch stage-wise documents strictly from /proposals/stage_wise/{pid}
            const stageWiseRes = await axios.get(`${API_BASE_URL}/proposals/stage_wise/${pid}`, { headers: authHeaders });
            const stagesData = Array.isArray(stageWiseRes.data) ? stageWiseRes.data : [];

            const getStagePosition = (stageId, rawPos) => {
                const matched = configs.find(c => c.id === stageId);
                const pos = matched?.position ?? rawPos;
                const num = Number(pos);
                return isNaN(num) ? 999 : num;
            };

            const processedStages = stagesData
                .filter(stg => (stg.stage_name || '').trim().toLowerCase() !== 'dgdfh')
                .map((stg) => {
                    const pos = getStagePosition(stg.stage_id, stg.position);
                    const docs = Array.isArray(stg.documents) ? stg.documents : [];
                    return {
                        stage_id: stg.stage_id,
                        stage_name: stg.stage_name,
                        position: pos,
                        documents: docs.map((d, idx) => ({
                            ...d,
                            version: d.version || (idx + 1),
                            display_name: d.name || `Document v${d.version || idx + 1}`,
                            stage_name: stg.stage_name,
                            stage_position: pos
                        }))
                    };
                })
                .sort((a, b) => a.position - b.position);

            setProjectStages(processedStages);

            // Auto-select first stage that has documents, or the first stage
            const firstWithDocs = processedStages.find(s => s.documents.length > 0);
            if (firstWithDocs) {
                setSelectedStageId(String(firstWithDocs.stage_id));
                if (firstWithDocs.documents && firstWithDocs.documents.length > 0) {
                    setSelectedDocId(String(firstWithDocs.documents[0].id || firstWithDocs.documents[0].name || firstWithDocs.documents[0].url));
                }
            } else if (processedStages.length > 0) {
                setSelectedStageId(String(processedStages[0].stage_id));
                setSelectedDocId('');
            }
        } catch (err) {
            console.error('Error fetching stage-wise project documents:', err);
            setProjectStages([]);
        }
    }, [selectedProposalId]);

    // Automatically fetch documents when selectedProposalId changes
    useEffect(() => {
        if (selectedProposalId) {
            fetchProjectDocuments(selectedProposalId);
        }
    }, [selectedProposalId, fetchProjectDocuments]);

    // Switch active Excel sheet in viewer
    const handleSwitchExcelSheet = (sheetName, wb = excelWorkbook) => {
        if (!wb || !wb.Sheets[sheetName]) return;
        setActiveSheetName(sheetName);
        try {
            const html = XLSX.utils.sheet_to_html(wb.Sheets[sheetName]);
            setDocHtmlContent(html);
        } catch (e) {
            console.error('Error switching Excel sheet:', e);
        }
    };

    // View specific document in draggable floating preview window
    const handleViewDocument = async (doc, customUrl, customName) => {
        const rawTargetUrl = customUrl || doc?.url || doc?.file;
        if (!rawTargetUrl) {
            alert('Document file URL is not available.');
            return;
        }
        if (doc) {
            setSelectedDocId(String(doc.id || doc.name || doc.url));
            if (doc.stage_id) {
                setSelectedStageId(String(doc.stage_id));
            }
        }
        const resolvedUrl = resolveDocUrl(rawTargetUrl);
        const docName = customName || doc?.display_name || doc?.name || 'Document';
        const typeInfo = getFileTypeInfo(resolvedUrl, docName);

        setActiveViewerDoc({
            ...doc,
            name: docName,
            url: resolvedUrl,
            typeInfo
        });
        setDocViewerUrl(resolvedUrl);
        setDocViewerPos({
            x: Math.max(20, window.innerWidth - 680),
            y: 80
        });
        setIsViewerMaximized(false);
        setShowDocViewer(true);

        const cleanUrl = resolvedUrl.split('?')[0].split('#')[0].toLowerCase();
        const ext = cleanUrl.split('.').pop();

        if (ext === 'docx' || ext === 'doc') {
            setDocViewType('loading');
            setDocHtmlContent('');
            setExcelWorkbook(null);
            setExcelSheetNames([]);
            try {
                const res = await axios.get(resolvedUrl, { responseType: 'arraybuffer' });
                const result = await mammoth.convertToHtml({ arrayBuffer: res.data });
                setDocHtmlContent(result.value || '<p className="p-4 text-slate-500 italic">No readable text content found in Word document.</p>');
                setDocViewType('html');
            } catch (err) {
                console.error('Error rendering Word document with mammoth:', err);
                setDocViewType('error');
            }
        } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            setDocViewType('loading');
            setDocHtmlContent('');
            try {
                const res = await axios.get(resolvedUrl, { responseType: 'arraybuffer' });
                const wb = XLSX.read(res.data, { type: 'array' });
                setExcelWorkbook(wb);
                const sheets = wb.SheetNames || [];
                setExcelSheetNames(sheets);
                if (sheets.length > 0) {
                    const firstSheet = sheets[0];
                    setActiveSheetName(firstSheet);
                    const html = XLSX.utils.sheet_to_html(wb.Sheets[firstSheet]);
                    setDocHtmlContent(html);
                } else {
                    setDocHtmlContent('<p className="p-4 text-slate-500 italic">Workbook contains no sheets.</p>');
                }
                setDocViewType('excel');
            } catch (err) {
                console.error('Error rendering Excel document with xlsx:', err);
                setDocViewType('error');
            }
        } else if (ext === 'pdf') {
            setDocViewType('pdf');
        } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
            setDocViewType('image');
        } else {
            setDocViewType('iframe');
        }
    };

    const activeStage = projectStages.find(s => String(s.stage_id) === String(selectedStageId)) || projectStages[0] || null;
    const activeStageDocs = activeStage?.documents || [];
    const totalProjectDocsCount = projectStages.reduce((acc, s) => acc + (s.documents ? s.documents.length : 0), 0);

    const handleReset = () => {
        setConclusion('Feasible');
        setFilename('CMTI_Feasibility_Report.docx');
        setDocDate(getTodayDateString());
        setPreparedBy(getLoggedUserName());
        setApprovedBy('');
        setResponses({ ...DEFAULT_RESPONSES });
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

            const loggedGroup = getLoggedUserGroup();

            params.append('party_details', partyDetails);
            params.append('enquiry_ref', enquiryRef);
            params.append('description', description);
            params.append('conclusion', conclusion);
            params.append('centre_dept', freshCentreDept);
            params.append('group_name', loggedGroup || '');
            params.append('doc_code', revisionCode);
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
                docNo: docNo || '',
                code: revisionCode,
                dateStr: docDate,
                pageStr: '1 of 1',
                centreDept: loggedCentreDept || '',
                isoSpec: '',
                preparedName: preparedBy,
                preparedRole: 'Scientist',
                approvedName: approvedBy,
                approvedRole: 'CH/GH'
            };

            const reviewPointsList = REVIEW_POINTS_TEMPLATES.map(pt => ({
                sl_no: pt.sl_no,
                point: pt.point,
                response: responses[pt.key_resp] || '',
                details: responses[pt.key_det] || ''
            }));

            const formDataPayload = {
                party_details: partyDetails,
                enquiry_ref_no: enquiryRef,
                description_of_the_enquiry: description,
                review_points: reviewPointsList,
                conclusion: conclusion,
            };

            const payload = {
                doc_type: 'FEASIBILITY',
                document_no: docNo || '',
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

            setStatus(targetStatus);
            if (targetStatus === 'SUBMITTED') {
                alert('Feasibility Report submitted successfully for Approval!');
            } else {
                alert('Draft saved successfully!');
            }
        } catch (err) {
            console.error('Error saving submission:', err);
            alert('Failed to save document. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle approver (CH/GH) approve or reject actions
    const handleFormStatusUpdate = async (nextStatus) => {
        if (!submissionId) {
            alert('Cannot update status of unsaved document.');
            return;
        }

        setSubmitting(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const approverName = currentUser.name || getLoggedUserName();

            await isoSubmissionService.updateStatus(
                submissionId,
                nextStatus,
                nextStatus === 'APPROVED' ? `Approved by ${approverName}` : `Rejected by ${approverName}`
            );

            setStatus(nextStatus);
            if (nextStatus === 'APPROVED') {
                setApprovedBy(approverName);
                alert('Feasibility Report approved successfully!');
            } else {
                alert('Feasibility Report rejected.');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const isFeasible = conclusion === 'Feasible';

    return (
        <div className="flex flex-col items-center bg-slate-100 min-h-screen p-4 md:p-8 font-sans">
            {/* Status Alert Banner */}
            {isApproved && (
                <div className="w-full max-w-4xl bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>🔒 ISO Document APPROVED. This document is officially approved and locked against editing.</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono uppercase">APPROVED</span>
                </div>
            )}
            {!isApproved && isSubmitted && (
                <div className="w-full max-w-4xl bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span>📋 ISO Document Status: SUBMITTED (Editable before final approval).</span>
                    <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-mono uppercase">SUBMITTED</span>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="w-full max-w-[21cm] bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                    {onBack && (
                        <button
                            onClick={async () => {
                                if (isHydratedRef.current && !isReadOnly) {
                                    await performAutoSave();
                                }
                                onBack();
                            }}
                            className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold text-xs bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 transition-all"
                            title="Back (Auto-saves draft)"
                        >
                            <ArrowLeftOutlined /> Back
                        </button>
                    )}

                    {proposals.length > 1 ? (
                        <select
                            value={selectedProposalId}
                            onChange={(e) => setSelectedProposalId(e.target.value)}
                            className="text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-300 outline-none cursor-pointer transition-all max-w-[220px] truncate"
                            title="Select Project / Proposal"
                        >
                            {proposals.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.project_number ? `Proj: ${p.project_number}` : `Proposal #${p.id}`} {p.customer_name ? `- ${p.customer_name}` : ''}
                                </option>
                            ))}
                        </select>
                    ) : projectNumber ? (
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                            Project: {projectNumber}
                        </span>
                    ) : null}

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                        status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'
                        }`}>
                        {status}
                    </span>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
                    {/* Create / Edit Controls */}
                    {!isReadOnly && (
                        <button
                            onClick={() => handleSaveSubmission('SUBMITTED')}
                            disabled={submitting}
                            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                        >
                            {submitting ? 'Saving...' : <><CheckOutlined /> {isSubmitted ? 'Save & Update' : 'Submit Form'}</>}
                        </button>
                    )}

                    {isApprover && isSubmitted && (
                        <>
                            <button
                                onClick={() => handleFormStatusUpdate('APPROVED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                            >
                                <CheckOutlined /> Approve Document
                            </button>

                            <button
                                onClick={() => handleFormStatusUpdate('REJECTED')}
                                disabled={submitting}
                                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-rose-600/10 cursor-pointer"
                            >
                                <CloseOutlined /> Reject Document
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                    >
                        {generating ? 'Generating...' : <><DownloadOutlined /> Download Word</>}
                    </button>

                    {/* View Docs Button with Interactive Stage-Wise Document List Dropdown */}
                    <div className="relative inline-block" ref={docListMenuRef}>
                        <button
                            type="button"
                            onClick={() => setShowDocListMenu(!showDocListMenu)}
                            className="flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-md shadow-cyan-600/10 cursor-pointer"
                            title="Touch to view stage-wise project documents"
                        >
                            <FolderOpenOutlined className="text-xs" />
                            <span>View Docs</span>
                            <span className="text-[10px] opacity-75 ml-0.5">{showDocListMenu ? '▲' : '▼'}</span>
                        </button>

                        {/* Interactive Stage-Wise Document List Dropdown Menu */}
                        {showDocListMenu && (
                            <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[9998] p-3 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                        <FolderOpenOutlined className="text-cyan-600" />
                                        <span>Project Documents List</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {totalProjectDocsCount} Total
                                    </span>
                                </div>

                                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                                    {projectStages.length === 0 || totalProjectDocsCount === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-xs italic">
                                            No documents available for this project.
                                        </div>
                                    ) : (
                                        projectStages.map((stg) => {
                                            const docs = stg.documents || [];
                                            if (docs.length === 0) return null;
                                            return (
                                                <div key={stg.stage_id} className="space-y-1">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center justify-between">
                                                        <span>{stg.position < 900 ? `Stage ${stg.position}` : 'Stage'}: {stg.stage_name}</span>
                                                        <span className="text-slate-400">({docs.length})</span>
                                                    </div>
                                                    <div className="space-y-1 pl-1">
                                                        {docs.map((doc, dIdx) => {
                                                            const tInfo = getFileTypeInfo(doc.url, doc.name);
                                                            return (
                                                                <div
                                                                    key={doc.id || dIdx}
                                                                    onClick={() => {
                                                                        setShowDocListMenu(false);
                                                                        setSelectedStageId(String(stg.stage_id));
                                                                        handleViewDocument(doc);
                                                                    }}
                                                                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-cyan-50 border border-transparent hover:border-cyan-200 cursor-pointer transition-all group"
                                                                >
                                                                    <div className={`p-1 rounded text-xs flex items-center justify-center shrink-0 ${tInfo.type === 'pdf' ? 'bg-red-50 text-red-600' :
                                                                            tInfo.type === 'word' ? 'bg-blue-50 text-blue-600' :
                                                                                tInfo.type === 'excel' ? 'bg-emerald-50 text-emerald-600' :
                                                                                    tInfo.type === 'image' ? 'bg-purple-50 text-purple-600' :
                                                                                        'bg-slate-100 text-slate-600'
                                                                        }`}>
                                                                        {tInfo.icon}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-xs font-semibold text-slate-700 group-hover:text-cyan-800 truncate" title={doc.display_name || doc.name}>
                                                                            {doc.display_name || doc.name || 'Document'}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                                            {doc.version && <span>v{doc.version}</span>}
                                                                            {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString()}</span>}
                                                                        </div>
                                                                    </div>
                                                                    <EyeOutlined className="text-slate-400 group-hover:text-cyan-600 text-xs shrink-0" />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
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
                                <td className="border border-slate-800 p-2 text-left text-[11px] leading-relaxed text-slate-700 whitespace-pre-line">{pt.point}</td>
                                <td className="border border-slate-800 p-1 text-center align-middle">
                                    {isReadOnly ? (
                                        <span className={`font-bold px-2 py-0.5 rounded ${responses[pt.key_resp] === 'Yes' ? 'text-emerald-700 bg-emerald-50' :
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
                            <span className={`font-extrabold text-sm px-3 py-1 rounded border ${conclusion === 'Feasible' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
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

            {/* ========================================================================= */}
            {/* DRAGGABLE & NON-BLOCKING DOCUMENT VIEWER WINDOW (z-[9999]) */}
            {/* ========================================================================= */}
            {showDocViewer && (
                <div className="fixed inset-0 z-[9999] pointer-events-none">
                    <div
                        style={isViewerMaximized ? {} : { left: `${docViewerPos.x}px`, top: `${docViewerPos.y}px` }}
                        className={
                            isViewerMaximized
                                ? 'pointer-events-auto fixed inset-4 bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden transition-all z-[9999]'
                                : 'pointer-events-auto fixed bg-white rounded-2xl shadow-2xl border border-slate-300 w-[680px] h-[740px] max-w-[95vw] max-h-[92vh] flex flex-col overflow-hidden transition-shadow duration-150 z-[9999]'
                        }
                    >
                        {/* Header Bar (Drag handle) */}
                        <div
                            onMouseDown={handleMouseDownDocHeader}
                            className={`flex items-center justify-between px-4 py-3 bg-slate-900 text-white select-none border-b border-slate-700 ${isViewerMaximized ? 'cursor-default' : isDraggingDocWin ? 'cursor-grabbing' : 'cursor-grab'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                {!isViewerMaximized && (
                                    <span className="text-slate-400 font-mono text-xs cursor-grab" title="Drag to move">⠿⠿</span>
                                )}
                                <div className={`p-1 rounded-md text-xs flex items-center justify-center shrink-0 ${activeViewerDoc?.typeInfo?.type === 'pdf' ? 'bg-red-500/20 text-red-400' :
                                        activeViewerDoc?.typeInfo?.type === 'word' ? 'bg-blue-500/20 text-blue-400' :
                                            activeViewerDoc?.typeInfo?.type === 'excel' ? 'bg-emerald-500/20 text-emerald-400' :
                                                activeViewerDoc?.typeInfo?.type === 'image' ? 'bg-purple-500/20 text-purple-400' :
                                                    'bg-slate-700 text-slate-300'
                                    }`}>
                                    {activeViewerDoc?.typeInfo?.icon || <FileTextOutlined />}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-xs text-white truncate max-w-[280px]" title={activeViewerDoc?.name}>
                                        {activeViewerDoc?.name || 'Document Preview'}
                                    </h3>
                                    {!isViewerMaximized && (
                                        <span className="text-[10px] text-slate-400 font-normal block leading-tight">
                                            Drag header to move window
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {/* Maximize / Restore Toggle */}
                                <button
                                    onClick={() => setIsViewerMaximized(!isViewerMaximized)}
                                    className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-xs transition-all border border-slate-700 cursor-pointer"
                                    title={isViewerMaximized ? 'Restore Window' : 'Maximize Window'}
                                >
                                    {isViewerMaximized ? <CompressOutlined /> : <ExpandOutlined />}
                                </button>

                                {/* Open in New Tab */}
                                <a
                                    href={docViewerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-all border border-slate-700 flex items-center gap-1"
                                    title="Open in new browser tab"
                                >
                                    <LinkOutlined />
                                </a>

                                {/* Download File */}
                                <a
                                    href={docViewerUrl}
                                    download={activeViewerDoc?.name || 'document'}
                                    className="text-[11px] font-bold text-cyan-300 hover:text-white bg-slate-800 hover:bg-cyan-900/60 px-2.5 py-1 rounded-lg transition-all border border-slate-700 flex items-center gap-1"
                                    title="Download File"
                                >
                                    <DownloadOutlined /> Download
                                </a>

                                {/* Close Button */}
                                <button
                                    onClick={() => setShowDocViewer(false)}
                                    className="text-slate-400 hover:text-white font-bold text-base leading-none px-2 py-1 rounded-lg hover:bg-rose-600/80 transition-all cursor-pointer ml-1"
                                    title="Close Window"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* In-Viewer Dropdown Quick Switcher Sub-Header Bar */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700 flex-wrap text-xs select-none">
                            {/* Stage Switcher Dropdown */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Stage:</span>
                                <select
                                    value={selectedStageId || ''}
                                    onChange={(e) => {
                                        const stgId = e.target.value;
                                        setSelectedStageId(stgId);
                                        const stg = projectStages.find(s => String(s.stage_id) === String(stgId));
                                        if (stg && stg.documents && stg.documents.length > 0) {
                                            handleViewDocument(stg.documents[0]);
                                        }
                                    }}
                                    className="text-[11px] font-semibold text-slate-200 bg-slate-900 px-2 py-1 rounded border border-slate-700 outline-none cursor-pointer max-w-[150px] truncate"
                                >
                                    {projectStages.map((stg) => (
                                        <option key={stg.stage_id} value={stg.stage_id}>
                                            {stg.position < 900 ? `S${stg.position}` : 'Stage'}: {stg.stage_name} ({stg.documents?.length || 0})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Doc Switcher Dropdown */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Doc:</span>
                                <select
                                    value={selectedDocId || ''}
                                    onChange={(e) => {
                                        const docKey = e.target.value;
                                        const doc = activeStageDocs.find(d => String(d.id || d.name || d.url) === String(docKey));
                                        if (doc) handleViewDocument(doc);
                                    }}
                                    disabled={activeStageDocs.length === 0}
                                    className="text-[11px] font-semibold text-slate-200 bg-slate-900 px-2 py-1 rounded border border-slate-700 outline-none cursor-pointer max-w-[180px] truncate disabled:text-slate-600"
                                >
                                    {activeStageDocs.length === 0 ? (
                                        <option value="">No docs</option>
                                    ) : (
                                        activeStageDocs.map((doc, idx) => (
                                            <option key={doc.id || idx} value={String(doc.id || doc.name || doc.url)}>
                                                {doc.display_name || doc.name || `Document v${doc.version || idx + 1}`}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Attachments pills if active doc has any */}
                            {activeViewerDoc && (activeViewerDoc.attachment || activeViewerDoc.attachments) && (
                                (() => {
                                    let atts = activeViewerDoc.attachment || activeViewerDoc.attachments || [];
                                    if (typeof atts === 'string') {
                                        try { atts = JSON.parse(atts); } catch { atts = [atts]; }
                                    }
                                    if (!Array.isArray(atts)) atts = atts ? [atts] : [];
                                    const validAtts = atts.filter(a => a && typeof a === 'string');
                                    if (validAtts.length === 0) return null;
                                    return (
                                        <div className="flex items-center gap-1 ml-auto flex-wrap">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-0.5">
                                                <PaperClipOutlined /> Attachments:
                                            </span>
                                            {validAtts.map((attUrl, attIdx) => {
                                                const attName = decodeURIComponent(attUrl.split('/').pop().split('?')[0]) || `File ${attIdx + 1}`;
                                                return (
                                                    <button
                                                        key={attIdx}
                                                        onClick={() => handleViewDocument(activeViewerDoc, attUrl, attName)}
                                                        className="text-[10px] font-medium bg-slate-700 hover:bg-cyan-700 text-slate-200 px-2 py-0.5 rounded transition-all cursor-pointer truncate max-w-[120px]"
                                                        title={`View ${attName}`}
                                                    >
                                                        {attName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        {/* Excel Multi-Sheet Switcher Bar */}
                        {docViewType === 'excel' && excelSheetNames.length > 1 && (
                            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 border-b border-slate-300 overflow-x-auto select-none">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1">
                                    <FileExcelOutlined className="text-emerald-700" /> Sheets:
                                </span>
                                {excelSheetNames.map((sName) => (
                                    <button
                                        key={sName}
                                        onClick={() => handleSwitchExcelSheet(sName)}
                                        className={`text-[11px] font-bold px-3 py-1 rounded-md border transition-all cursor-pointer shrink-0 ${activeSheetName === sName
                                                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        {sName}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Viewer Body Content */}
                        <div className="flex-1 bg-slate-100 p-3 overflow-auto">
                            {docViewType === 'loading' && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 font-semibold text-xs">
                                    <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Loading and parsing document content...</span>
                                </div>
                            )}

                            {docViewType === 'html' && (
                                <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 overflow-auto text-slate-800 max-w-full">
                                    <div
                                        className="prose prose-slate max-w-none text-xs leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:bg-slate-100 [&_th]:font-bold [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_p]:my-1.5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                        dangerouslySetInnerHTML={{ __html: docHtmlContent }}
                                    />
                                </div>
                            )}

                            {docViewType === 'excel' && (
                                <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 overflow-auto text-slate-800 max-w-full">
                                    <div
                                        className="text-xs overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:bg-slate-100 [&_th]:font-bold [&_th]:text-slate-800 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_td]:text-slate-700 [&_tr:nth-child(even)]:bg-slate-50/70 [&_tr:hover]:bg-cyan-50/50 font-sans"
                                        dangerouslySetInnerHTML={{ __html: docHtmlContent }}
                                    />
                                </div>
                            )}

                            {docViewType === 'pdf' && (
                                <iframe
                                    src={docViewerUrl}
                                    title={activeViewerDoc?.name || 'PDF Document Viewer'}
                                    className="w-full h-full bg-white rounded-xl border border-slate-300 shadow-inner"
                                />
                            )}

                            {docViewType === 'image' && (
                                <div className="w-full h-full flex items-center justify-center p-4 bg-slate-950/90 rounded-xl">
                                    <img
                                        src={docViewerUrl}
                                        alt={activeViewerDoc?.name || 'Document Image'}
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                    />
                                </div>
                            )}

                            {docViewType === 'iframe' && (
                                <iframe
                                    src={docViewerUrl}
                                    title={activeViewerDoc?.name || 'Document Viewer'}
                                    className="w-full h-full bg-white rounded-xl border border-slate-300 shadow-inner"
                                />
                            )}

                            {docViewType === 'error' && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 text-center p-6 bg-white rounded-xl border border-slate-200">
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-full text-2xl">
                                        <FileTextOutlined />
                                    </div>
                                    <p className="font-semibold text-rose-600 text-xs">Could not render direct preview for this document format.</p>
                                    <p className="text-[11px] text-slate-400 max-w-sm">You can open the document in a new tab or download it directly to view on your device.</p>
                                    <div className="flex items-center gap-2 pt-2">
                                        <a
                                            href={docViewerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-xs"
                                        >
                                            Open in New Tab
                                        </a>
                                        <a
                                            href={docViewerUrl}
                                            download={activeViewerDoc?.name || 'document'}
                                            className="bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-cyan-700 transition-colors shadow-xs"
                                        >
                                            Download File
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

