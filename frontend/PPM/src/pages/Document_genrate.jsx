import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    Typography,
    Space,
    Divider,
    Row,
    Col,
    Popconfirm,
    message,
    Tooltip,
    Tag,
    Spin,
    Progress,
    Upload,
    AutoComplete,
    Select,
    DatePicker,
    Alert,
    Checkbox,
} from 'antd';
import {
    FileWordOutlined,
    PlusOutlined,
    DeleteOutlined,
    DownloadOutlined,
    InfoCircleOutlined,
    ThunderboltOutlined,
    UserOutlined,
    ReloadOutlined,
    CalendarOutlined,
    MailOutlined,
    BankOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    PrinterOutlined,
    CalculatorOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    CompressOutlined,
    ExpandOutlined,
    ApartmentOutlined,
    SafetyCertificateOutlined,
    PaperClipOutlined,
    UploadOutlined,
    EditOutlined,
    RobotOutlined,
    PhoneOutlined,
    InboxOutlined,
    ArrowLeftOutlined,
    SendOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../config/api.js';
import { DISPLAY_DATE_FORMAT, formatDate } from '../config/date.js';
import { CostEstimationModal, convertHeadersToDocumentTables } from './CostBreakDownAction';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

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

const MANPOWER_HEADER = "Manpower";
const MANPOWER_COLUMNS = ["Role", "Cost Breakup", "Total Amount"];
const DEFAULT_CUSTOM_COLUMNS = ["Description", "Total Amount"];
const STANDARD_ROLES = [
    { value: "Scientist B" },
    { value: "Scientist C" },
    { value: "Scientist D" },
    { value: "Scientist E" },
    { value: "Scientist F" },
    { value: "Scientist G" },
];

function emptyRow(columns, headerName) {
    const row = {};
    columns.forEach((col) => {
        if (col === "Cost Breakup") {
            row[col] = { type: "hourly", rate: 0, hours: 0, days: 0, quantity: 1 };
        } else if (col === "Total Amount") {
            row[col] = 0;
        } else {
            row[col] = "";
        }
    });
    return row;
}

const transformTablesForPreviewAndPayload = (structuredTables) => {
    return (structuredTables || []).map((tbl) => {
        if (tbl.header_name === MANPOWER_HEADER) {
            const headers = ["Role", "Billing Type", "Rate", "Hours / Months", "Days", "Manpower", "Total Amount"];
            const rows = tbl.rows.map((row) => {
                const cb = row["Cost Breakup"] || {};
                const type = cb.type === "monthly" ? "Monthly" : "Hourly";
                const rate = String(cb.rate ?? 0);
                const hoursMonths = String(cb.type === "monthly" ? (cb.months ?? 0) : (cb.hours ?? 0));
                const days = cb.type === "monthly" ? "—" : String(cb.days ?? 0);
                const qty = String(cb.quantity ?? 1);
                const total = String(row["Total Amount"] ?? 0);

                return [
                    row["Role"] || "",
                    type,
                    rate,
                    hoursMonths,
                    days,
                    qty,
                    total
                ];
            });
            return {
                title: "Manpower Cost Breakdown",
                headers,
                rows
            };
        } else {
            const headers = tbl.columns || [];
            const rows = tbl.rows.map((row) => {
                return headers.map((col) => String(row[col] ?? ''));
            });
            return {
                title: tbl.header_name || "",
                headers,
                rows
            };
        }
    });
};

export default function DocumentGenerate({
    onAddToProposals,
    projectId,
    onSuccess,
    onBack,
    onCancel,
    currentUser,
    stageConfig = [],
    convertingDraftRecord = null,
}) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitProposalLoading, setSubmitProposalLoading] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(100);
    const [previewVisible, setPreviewVisible] = useState(false);

    // Dynamic state for Scope Bullet Points & Attachments
    const [scopeItems, setScopeItems] = useState([]);
    const [newScopeInput, setNewScopeInput] = useState('');
    const [scopeAttachments, setScopeAttachments] = useState([]);
    const [additionalAttachments, setAdditionalAttachments] = useState([]);
    const [tenderFileList, setTenderFileList] = useState([]);

    // Dynamic state for Terms Bullet Points
    const [termsItems, setTermsItems] = useState([]);
    const [newTermInput, setNewTermInput] = useState('');

    // Dynamic state for Pricing Tables
    const [tables, setTables] = useState([]);

    // Dynamic state for Internal Cost Estimation Tables
    const [internalCostTables, setInternalCostTables] = useState([]);
    const [rawStudioHeaders, setRawStudioHeaders] = useState([]);
    const [costModalOpen, setCostModalOpen] = useState(false);
    const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false);

    // AI Email Extraction State
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiEmailText, setAiEmailText] = useState('');
    const [aiExtracting, setAiExtracting] = useState(false);
    const [aiExtractedSummary, setAiExtractedSummary] = useState(null);

    // Customer suggestions state
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [customerSearchText, setCustomerSearchText] = useState('');
    const [addressOptions, setAddressOptions] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Watched form values
    const formValues = Form.useWatch([], form) || {};
    const watchedRequestType = Form.useWatch('request_type', form);
    const isTenderSelected = (Array.isArray(watchedRequestType) ? watchedRequestType.join(' ') : String(watchedRequestType || '')).toLowerCase().includes('tender');

    // Dynamic state for Multiple Signatories
    const [signatories, setSignatories] = useState([
        {
            name: '',
            lines_raw: '',
        },
    ]);

    // Helper to extract designation from logged-in user
    const getUserDesignation = () => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                const desig = parsedUser.designation || parsedUser.role || parsedUser.user_role || '';
                if (desig) {
                    const trimmed = desig.trim();
                    if (/^scientist[\s-]*([a-z])$/i.test(trimmed)) {
                        const letter = trimmed.match(/^scientist[\s-]*([a-z])$/i)[1].toUpperCase();
                        return `Scientist-${letter}`;
                    }
                    return trimmed;
                }
            }
        } catch (err) {
            console.error('Error reading user designation:', err);
        }
        return '';
    };

    // Helper to extract center from logged-in user
    const getUserCenter = () => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                const rawCenter = parsedUser.center || parsedUser.centre || parsedUser.group || '';
                if (rawCenter) {
                    const trimmed = rawCenter.trim();
                    if (/^c-/i.test(trimmed)) {
                        return trimmed.toUpperCase();
                    }
                    return `C-${trimmed.toUpperCase()}`;
                }
            }
        } catch (err) {
            console.error('Error reading user center:', err);
        }
        return '';
    };

    const getUserName = () => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                return (parsedUser.name || '').trim();
            }
        } catch {}
        return '';
    };

    const getUserGroup = () => {
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                return (parsedUser.group || '').trim();
            }
        } catch {}
        return '';
    };

    // Calculate subtotal for tables
    const getTableSubtotal = (tbl) => {
        if (!tbl || !tbl.rows || !Array.isArray(tbl.rows)) return 0;
        const headers = tbl.headers || [];
        let amtColIdx = headers.findIndex(h => /amount|cost|total/i.test(h));
        if (amtColIdx === -1) amtColIdx = headers.length - 1;

        return tbl.rows.reduce((sum, r) => {
            let val = 0;
            if (Array.isArray(r)) {
                const raw = r[amtColIdx] !== undefined ? r[amtColIdx] : r[r.length - 1];
                val = parseFloat(String(raw || '').replace(/[^0-9.-]+/g, '')) || 0;
            } else if (typeof r === 'object' && r !== null) {
                const raw = r[headers[amtColIdx]] || r['Total Amount'] || r['Total Amount (₹)'] || '0';
                val = parseFloat(String(raw || '').replace(/[^0-9.-]+/g, '')) || 0;
            }
            return sum + val;
        }, 0);
    };

    const grandPricingTotal = useMemo(() => {
        return tables.reduce((sum, tbl) => sum + getTableSubtotal(tbl), 0);
    }, [tables]);

    const grandInternalTotal = useMemo(() => {
        return internalCostTables.reduce((sum, tbl) => sum + getTableSubtotal(tbl), 0);
    }, [internalCostTables]);

    // Auto-fetch center, logged-in user info, and customer database on mount
    useEffect(() => {
        const fetchedCenter = getUserCenter();
        const fetchedDesignation = getUserDesignation();
        const fetchedName = getUserName();
        const fetchedGroup = getUserGroup();

        const initialValues = {
            date: new Date().toLocaleDateString('en-GB'),
            dept: fetchedCenter || '',
            quotation_given_by_name: fetchedName || '',
            quotation_given_by_department: fetchedCenter || '',
            center: fetchedCenter || '',
            group: fetchedGroup || '',
            proposal_status: ['Submitted'],
            request_type: 'Direct Enquiry',
            customer_type: 'Govt',
        };

        if (convertingDraftRecord) {
            if (convertingDraftRecord.quote_description) {
                initialValues.subject = convertingDraftRecord.quote_description;
                initialValues.quote_description = convertingDraftRecord.quote_description;
            }
            if (convertingDraftRecord.customer_name) {
                initialValues.customer_raw = convertingDraftRecord.customer_name;
                initialValues.customer_name = convertingDraftRecord.customer_name;
            }
        }

        form.setFieldsValue(initialValues);

        if (fetchedName) {
            const desigLine = fetchedDesignation ? `${fetchedDesignation}` : '';
            const centerLine = fetchedCenter ? `${fetchedCenter}` : '';
            const lines = [desigLine, centerLine, 'CMTI, Bengaluru'].filter(Boolean).join('\n');
            setSignatories([
                {
                    name: fetchedName,
                    lines_raw: lines,
                },
            ]);
        }

        // Fetch customer list with addresses
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
    }, [form, convertingDraftRecord]);

    // Handle searching customers by name, address, email or phone
    const handleCustomerSearch = (searchText) => {
        setCustomerSearchText(searchText);
        if (!searchText || searchText.trim().length < 1) {
            setCustomerOptions([]);
            return;
        }
        const query = searchText.trim().toLowerCase();
        const matches = customerSuggestions
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
        setCustomerSearchText(value);
        if (option && option.customer) {
            const c = option.customer;
            setSelectedCustomer(c);

            const addrs = Array.isArray(c.addresses)
                ? c.addresses
                : c.address
                    ? [c.address]
                    : [];
            setAddressOptions(addrs.map((a) => ({ value: a, label: a })));

            const firstAddr = addrs[0] || '';
            const formatted = firstAddr ? `${c.name}\n${firstAddr}` : c.name;

            const safeCustName = (c.name || 'Proposal')
                .replace(/[^a-zA-Z0-9_\-\s]/g, '')
                .trim()
                .replace(/\s+/g, '_');

            form.setFieldsValue({
                customer_raw: formatted,
                customer_name: c.name,
                customer_type: c.customer_type || form.getFieldValue('customer_type') || 'Govt',
                address: firstAddr || '',
                email_to: c.email || form.getFieldValue('email_to') || '',
                email: c.email || form.getFieldValue('email') || '',
                phone: c.phone_no || c.phone || form.getFieldValue('phone') || '',
                phone_no: c.phone_no || c.phone || form.getFieldValue('phone_no') || '',
                kind_attention: c.alternate_contact_details || form.getFieldValue('kind_attention') || '',
                alternate_contact_details: c.alternate_contact_details || form.getFieldValue('alternate_contact_details') || '',
                filename: `${safeCustName || 'Proposal'}.docx`,
            });

            message.info(`Selected "${c.name}" — Customer Details Populated!`);
        }
    };

    // Handle selecting address from address options
    const handleAddressSelect = (addressVal) => {
        const currentRaw = form.getFieldValue('customer_raw') || '';
        const lines = currentRaw.split('\n');
        const custName = lines[0] || (selectedCustomer ? selectedCustomer.name : '');
        const formatted = addressVal ? `${custName}\n${addressVal}` : custName;
        form.setFieldsValue({ customer_raw: formatted, address: addressVal });
        message.info('Updated document customer address');
    };

    // Handle extracting details from customer email to auto-fill Document Form
    const handleExtractEmailForDocument = async () => {
        if (!aiEmailText.trim()) {
            message.warning('Please paste the customer email text first.');
            return;
        }

        setAiExtracting(true);
        setAiExtractedSummary(null);

        try {
            const res = await axios.post(`${API_BASE_URL}/ai/extract-email`, {
                email_text: aiEmailText
            }, {
                timeout: 130000
            });

            const data = res.data || {};

            const cleanCustName = (data.customer_name && !data.customer_name.includes('@')) ? data.customer_name.trim() : '';
            const cleanCustAddr = (data.customer_address && !data.customer_address.includes('@')) ? data.customer_address.trim() : '';

            let custRaw = '';
            if (cleanCustName && cleanCustAddr) {
                custRaw = `${cleanCustName}\n${cleanCustAddr}`;
            } else if (cleanCustName) {
                custRaw = cleanCustName;
            } else if (cleanCustAddr) {
                custRaw = cleanCustAddr;
            }

            let generatedFilename = form.getFieldValue('filename');
            const nameForFile = cleanCustName || data.proposal_subject || 'Proposal';
            const safeName = nameForFile
                .replace(/[^a-zA-Z0-9_\-\s]/g, '')
                .trim()
                .replace(/\s+/g, '_');
            generatedFilename = `${safeName || 'Proposal'}.docx`;

            const updates = {
                filename: generatedFilename,
            };
            if (data.email_to && data.email_to.length > 0) {
                updates.email_to = data.email_to.join(', ');
                updates.email = data.email_to.join(', ');
            }
            if (data.email_cc && data.email_cc.length > 0) {
                updates.email_cc = data.email_cc.join(', ');
            }
            if (data.phone_number) {
                updates.phone = data.phone_number;
                updates.phone_no = data.phone_number;
            }
            if (custRaw) {
                updates.customer_raw = custRaw;
                updates.customer_name = cleanCustName;
                updates.address = cleanCustAddr;
            }
            if (data.kind_attention) {
                let ka = data.kind_attention;
                if (typeof ka === 'string') {
                    const rawLines = ka.replace(/,/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
                    const seen = new Set();
                    const cleanLines = [];
                    rawLines.forEach(l => {
                        const low = l.toLowerCase();
                        if (!seen.has(low)) {
                            seen.add(low);
                            cleanLines.push(l);
                        }
                    });
                    ka = cleanLines.join('\n');
                }
                updates.kind_attention = ka;
                updates.alternate_contact_details = ka;
            }
            if (data.proposal_subject) {
                updates.subject = data.proposal_subject;
                updates.quote_description = data.proposal_subject;
            }
            if (data.introductory_paragraph) {
                updates.scope_intro = data.introductory_paragraph;
            }
            if (cleanCustName) {
                setCustomerSearchText(cleanCustName);
                const matched = customerSuggestions.find(
                    (c) => c.name && (
                        c.name.trim().toLowerCase() === cleanCustName.trim().toLowerCase() ||
                        c.name.toLowerCase().includes(cleanCustName.toLowerCase()) ||
                        cleanCustName.toLowerCase().includes(c.name.toLowerCase())
                    )
                );
                if (matched) {
                    setSelectedCustomer(matched);
                    if (matched.customer_type) {
                        updates.customer_type = matched.customer_type;
                    }
                    const addrs = Array.isArray(matched.addresses)
                        ? matched.addresses
                        : matched.address
                            ? [matched.address]
                            : [];
                    setAddressOptions(addrs.map((a) => ({ value: a, label: a })));
                }
            }

            form.setFieldsValue(updates);

            const rawScopes = (Array.isArray(data.scope_of_work) && data.scope_of_work.length > 0)
                ? data.scope_of_work
                : (Array.isArray(data.objectives) && data.objectives.length > 0)
                    ? data.objectives
                    : [];

            const validScopes = rawScopes.filter(
                (item) => typeof item === 'string' && item.trim().length > 3 && !item.toLowerCase().includes('array of') && !item.toLowerCase().includes('list of')
            );

            if (validScopes.length > 0) {
                setScopeItems(validScopes);
            }

            setAiExtractedSummary({
                customer: data.customer_name,
                subject: data.proposal_subject,
                scopeCount: validScopes.length
            });

            message.success('Proposal details successfully extracted and populated into Document Studio & Proposal Form!');
        } catch (err) {
            console.error('Email extraction error:', err);
            message.error('Failed to extract email details.');
        } finally {
            setAiExtracting(false);
        }
    };

    // Scope & Term handlers
    const handleAddScopeItem = () => {
        if (!newScopeInput.trim()) return;
        setScopeItems([...scopeItems, newScopeInput.trim()]);
        setNewScopeInput('');
    };

    const handleRemoveScopeItem = (index) => {
        setScopeItems(scopeItems.filter((_, i) => i !== index));
    };

    const handleAddTermItem = () => {
        if (!newTermInput.trim()) return;
        setTermsItems([...termsItems, newTermInput.trim()]);
        setNewTermInput('');
    };

    const handleRemoveTermItem = (index) => {
        setTermsItems(termsItems.filter((_, i) => i !== index));
    };

    // Table Handlers
    const handleAddTable = () => {
        setTables([
            ...tables,
            {
                title: '',
                headers: ['Sl No', 'Item Description', 'Qty', 'Amount'],
                rows: [['1', '', '', '']],
            },
        ]);
    };

    const handleRemoveTable = (tIndex) => {
        setTables(tables.filter((_, i) => i !== tIndex));
    };

    const handleTableTitleChange = (tIndex, value) => {
        const updated = [...tables];
        updated[tIndex].title = value;
        setTables(updated);
    };

    const handleHeaderChange = (tIndex, hIndex, value) => {
        const updated = [...tables];
        updated[tIndex].headers[hIndex] = value;
        setTables(updated);
    };

    const handleAddHeaderColumn = (tIndex) => {
        const updated = [...tables];
        updated[tIndex].headers.push(`Column ${updated[tIndex].headers.length + 1}`);
        updated[tIndex].rows.forEach((row) => row.push(''));
        setTables(updated);
    };

    const handleRemoveHeaderColumn = (tIndex, hIndex) => {
        const updated = [...tables];
        if (updated[tIndex].headers.length <= 1) {
            message.warning('A table must have at least 1 column');
            return;
        }
        updated[tIndex].headers.splice(hIndex, 1);
        updated[tIndex].rows.forEach((row) => row.splice(hIndex, 1));
        setTables(updated);
    };

    const handleCellChange = (tIndex, rIndex, cIndex, value) => {
        const updated = [...tables];
        updated[tIndex].rows[rIndex][cIndex] = value;
        setTables(updated);
    };

    const handleAddTableRow = (tIndex) => {
        const updated = [...tables];
        const newRow = new Array(updated[tIndex].headers.length).fill('');
        updated[tIndex].rows.push(newRow);
        setTables(updated);
    };

    const handleRemoveTableRow = (tIndex, rIndex) => {
        const updated = [...tables];
        updated[tIndex].rows.splice(rIndex, 1);
        setTables(updated);
    };

    // Internal Cost Estimation Table Handlers
    const handleAddInternalTable = () => {
        setInternalCostTables([
            ...internalCostTables,
            {
                title: 'Internal Cost Estimation Breakup',
                headers: ['Role / Item', 'Rate (₹)', 'Duration (Days)', 'Qty', 'Total Amount (₹)'],
                rows: [['', '', '', '', '']],
            },
        ]);
    };

    const handleRemoveInternalTable = (tIndex) => {
        setInternalCostTables(internalCostTables.filter((_, i) => i !== tIndex));
    };

    const handleInternalTableTitleChange = (tIndex, value) => {
        const updated = [...internalCostTables];
        updated[tIndex].title = value;
        setInternalCostTables(updated);
    };

    const handleInternalHeaderChange = (tIndex, hIndex, value) => {
        const updated = [...internalCostTables];
        updated[tIndex].headers[hIndex] = value;
        setInternalCostTables(updated);
    };

    const handleAddInternalHeaderColumn = (tIndex) => {
        const updated = [...internalCostTables];
        updated[tIndex].headers.push(`Column ${updated[tIndex].headers.length + 1}`);
        updated[tIndex].rows.forEach((row) => row.push(''));
        setInternalCostTables(updated);
    };

    const handleRemoveInternalHeaderColumn = (tIndex, hIndex) => {
        const updated = [...internalCostTables];
        if (updated[tIndex].headers.length <= 1) {
            message.warning('A table must have at least 1 column');
            return;
        }
        updated[tIndex].headers.splice(hIndex, 1);
        updated[tIndex].rows.forEach((row) => row.splice(hIndex, 1));
        setInternalCostTables(updated);
    };

    const handleInternalCellChange = (tIndex, rIndex, cIndex, value) => {
        const updated = [...internalCostTables];
        updated[tIndex].rows[rIndex][cIndex] = value;
        setInternalCostTables(updated);
    };

    const handleAddInternalTableRow = (tIndex) => {
        const updated = [...internalCostTables];
        const newRow = new Array(updated[tIndex].headers.length).fill('');
        updated[tIndex].rows.push(newRow);
        setInternalCostTables(updated);
    };

    const handleRemoveInternalTableRow = (tIndex, rIndex) => {
        const updated = [...internalCostTables];
        updated[tIndex].rows.splice(rIndex, 1);
        setInternalCostTables(updated);
    };

    // Signatory handlers
    const handleAddSignatory = () => {
        setSignatories([
            ...signatories,
            {
                name: '',
                lines_raw: '',
            },
        ]);
    };

    const handleRemoveSignatory = (index) => {
        if (signatories.length <= 1) {
            message.warning('At least one signatory block is required.');
            return;
        }
        setSignatories(signatories.filter((_, i) => i !== index));
    };

    const handleSignatoryChange = (index, field, value) => {
        const updated = [...signatories];
        updated[index][field] = value;
        setSignatories(updated);
    };

    // Generate DOCX blob helper
    const generateDocxBlob = async (values) => {
        const email_to = (values.email_to || values.email || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);
        const email_cc = (values.email_cc || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);

        const customer_lines = (values.customer_raw || '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

        if (customer_lines.length === 0 && values.customer_name) {
            customer_lines.push(values.customer_name.trim());
            if (values.address) {
                customer_lines.push(values.address.trim());
            }
        }

        const formattedSignatories = signatories.map((sig) => ({
            name: sig.name || values.quotation_given_by_name || getUserName(),
            lines: (sig.lines_raw || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
        }));

        const primarySig = formattedSignatories[0] || { name: values.quotation_given_by_name || getUserName(), lines: [] };

        const payload = {
            date: values.date || new Date().toLocaleDateString('en-GB'),
            dept: values.dept || values.center || getUserCenter(),
            email_to,
            email_cc,
            phone: values.phone || values.phone_no || '',
            customer_lines,
            kind_attention: values.kind_attention || values.alternate_contact_details || '',
            reference: values.reference || values.quote_reference || '',
            subject: values.subject || values.quote_description || '',
            sac_code: values.sac_code || '',
            scope_intro: values.scope_intro || '',
            scope_items: scopeItems,
            terms_items: termsItems,
            tables: tables,
            internal_cost_tables: internalCostTables,
            signatory_name: primarySig.name,
            signatory_lines: primarySig.lines,
            signatories: formattedSignatories,
            filename: values.filename || 'Proposal.docx',

            // Quotation requirements
            technical_requirements: values.technical_requirements || '',
            billing_address: values.billing_address || '',
            shipping_address: values.shipping_address || '',
            delivery_time_date: values.delivery_time_date || '',
            mode_of_delivery: values.mode_of_delivery || '',
            supporting_documentation: values.supporting_documentation || '',
            standards: values.standards || '',
            penalty_clause: values.penalty_clause || '',
            claims: values.claims || '',
            legal_requirements: values.legal_requirements || '',
            other_requirements: values.other_requirements || '',
        };

        const response = await axios.post(
            `${API_BASE_URL}/Proposal/generate`,
            payload,
            {
                responseType: 'blob',
            }
        );

        const disposition = response.headers['content-disposition'];
        let filename = values.filename || 'Proposal.docx';
        if (disposition && disposition.includes('filename=')) {
            const match = disposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) {
                filename = match[1];
            }
        }
        if (!filename.toLowerCase().endsWith('.docx')) {
            filename += '.docx';
        }

        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        return { blob, filename, payload };
    };

    // Export DOCX directly
    const handleExportDocx = async () => {
        setLoading(true);
        try {
            const values = form.getFieldsValue();
            const { blob, filename } = await generateDocxBlob(values);

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            message.success(`Proposal document "${filename}" exported successfully!`);
        } catch (err) {
            console.error('Failed to export DOCX:', err);
            message.error('Failed to export document. Please check backend service.');
        } finally {
            setLoading(false);
        }
    };

    // Submit Proposal + Generate Document + Upload directly
    const handleSubmitProposal = async () => {
        try {
            await form.validateFields();
        } catch (validationErr) {
            message.error('Please fill all required proposal fields before submitting.');
            return;
        }

        const values = form.getFieldsValue();
        const custRaw = (values.customer_raw || '').split('\n').map(s => s.trim()).filter(Boolean);
        const custName = values.customer_name || custRaw[0] || (selectedCustomer ? selectedCustomer.name : '');
        const quoteDesc = values.quote_description || values.subject || '';

        if (!custName) {
            message.error('Please enter Customer Name or Customer Information block.');
            return;
        }
        if (!quoteDesc) {
            message.error('Please enter Subject / Quote Description.');
            return;
        }

        setSubmitProposalLoading(true);
        try {
            // 1. Generate DOCX file
            const { blob, filename } = await generateDocxBlob(values);
            const docFile = new File([blob], filename, {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            // 2. Build proposal payload
            const rawUser = window.localStorage.getItem('ppm_user');
            let parsedUser = {};
            try {
                parsedUser = rawUser ? JSON.parse(rawUser) : {};
            } catch {}

            const uName = values.quotation_given_by_name || parsedUser.name || getUserName();
            const uCenter = values.center || values.dept || parsedUser.center || getUserCenter();
            const uGroup = values.group || parsedUser.group || getUserGroup();

            const proposalPayload = {
                enquiry_date: values.date || new Date().toLocaleDateString('en-GB'),
                customer_type: values.customer_type || (selectedCustomer && selectedCustomer.customer_type) || 'Govt',
                customer_name: custName,
                address: values.address || custRaw.slice(1).join(', ') || '',
                email: values.email || values.email_to || '',
                phone_no: values.phone_no || values.phone || '',
                alternate_contact_details: values.alternate_contact_details || values.kind_attention || '',
                request_type: values.request_type || 'Direct Enquiry',
                make_in_india: values.make_in_india || '',
                email_reference: values.email_reference || values.reference || values.email_to || '',
                quote_reference: values.quote_reference || values.reference || '',
                quote_description: quoteDesc,
                quote_amount: values.quote_amount ? String(values.quote_amount) : (grandPricingTotal > 0 ? String(grandPricingTotal) : (grandInternalTotal > 0 ? String(grandInternalTotal) : '')),
                quotation_given_by_name: uName,
                quotation_given_by_department: values.quotation_given_by_department || uCenter || '',
                center: uCenter,
                group: uGroup,
                proposal_status: Array.isArray(values.proposal_status) ? values.proposal_status.join(', ') : (values.proposal_status || 'Submitted'),
                project_coordinator: uName,
                user_id: parsedUser.id || parsedUser.user_id || 0,
                user_name: parsedUser.name || uName,
                user_email: parsedUser.email || '',
                user_role: parsedUser.role || 'scientist',
                user_center: uCenter,
                user_group: uGroup,
            };

            if (convertingDraftRecord && convertingDraftRecord.id) {
                proposalPayload.id = convertingDraftRecord.id;
                proposalPayload.draft = false;
            }

            // 3. Post proposal to backend
            const response = await fetch(`${API_BASE_URL}/proposals/add-proposal-coordinator`, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(proposalPayload),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody.detail || 'Failed to create proposal');
            }

            const result = await response.json();
            const newProjectId = result?.proposal_id;

            // Save the internal cost estimation dynamic tables to database if we have tables
            if (newProjectId && rawStudioHeaders && rawStudioHeaders.length > 0) {
                try {
                    const token = localStorage.getItem('token');
                    await axios.post(
                        `${API_BASE_URL}/dynamic-tables/${newProjectId}/generate-word`,
                        {
                            title: values.subject || "Internal Cost Estimation",
                            created_by: uName,
                            tables: rawStudioHeaders,
                        },
                        {
                            headers: {
                                accept: 'application/json',
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            responseType: 'blob',
                        }
                    );
                    console.log("Successfully saved cost estimation tables to DB under ID:", newProjectId);
                } catch (dbErr) {
                    console.error("Failed to save cost estimation tables:", dbErr);
                }
            }

            // 4. Upload generated docx + all attachments to /documents/
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
                    formData.append('description', 'Official Proposal Document Generated via Document Studio');
                    formData.append('file', docFile);

                    const allAtts = [...scopeAttachments, ...additionalAttachments];
                    allAtts.forEach((att) => {
                        formData.append('attachment', att);
                    });

                    await fetch(`${API_BASE_URL}/documents/`, {
                        method: 'POST',
                        body: formData,
                    });

                    // 5. Upload tender images if any
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

            message.success('Proposal submitted and document generated successfully!');

            if (onSuccess) {
                onSuccess(newProjectId);
            } else if (onAddToProposals) {
                onAddToProposals(docFile, proposalPayload, [...scopeAttachments, ...additionalAttachments]);
            }
        } catch (err) {
            console.error('Failed to submit proposal:', err);
            message.error(err.message || 'Failed to submit proposal');
        } finally {
            setSubmitProposalLoading(false);
        }
    };

    // Calculate completion percentage
    const calculateProgress = () => {
        let score = 0;
        if (formValues.date) score += 10;
        if (formValues.dept) score += 10;
        if (formValues.customer_raw || formValues.customer_name) score += 20;
        if (formValues.subject || formValues.quote_description) score += 20;
        if (scopeItems.length > 0) score += 15;
        if (termsItems.length > 0) score += 10;
        if (signatories.some((s) => s.name.trim())) score += 15;
        return Math.min(score, 100);
    };

    const progressPercent = calculateProgress();

    return (
        <div className="w-full min-h-screen bg-[#F8FAFC] py-4 px-3 sm:px-5 lg:px-6 font-sans antialiased text-[#0F172A]">

            {/* Enterprise Header Area */}
            <div className="max-w-7xl mx-auto mb-6 bg-white p-4 sm:p-5 border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-900 select-none shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                {/* Left side: Studio Info & Readiness */}
                <div className="flex flex-col md:flex-row md:items-center gap-5 flex-1">
                    {onBack && (
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={onBack}
                            className="rounded-none border border-slate-900 font-bold text-xs h-10 px-3 bg-slate-50 hover:bg-slate-100"
                        >
                            Back
                        </Button>
                    )}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                            DOCUMENT STUDIO & PROPOSAL GENERATOR
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">
                                Create Proposal & Document Studio
                            </h1>
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-mono">
                                PRO DOCUMENT V2.0
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs m-0 leading-normal max-w-xl">
                            Format official proposal document with live preview, then review & submit the proposal entry below in one seamless step.
                        </p>
                    </div>

                    <div className="h-10 w-px bg-slate-200 hidden md:block" />

                    {/* Document Readiness */}
                    <div className="min-w-[130px]">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                            DOCUMENT READINESS:
                        </div>
                        <div className="text-sm font-extrabold text-blue-600 mb-1 font-mono">
                            {progressPercent}%
                        </div>
                        <Progress
                            percent={progressPercent}
                            size="small"
                            showInfo={false}
                            strokeColor={{ '0%': '#2563EB', '100%': '#16A34A' }}
                            className="m-0 w-32"
                        />
                    </div>
                </div>

                {/* Right side: Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <Button
                        icon={<RobotOutlined className={aiPanelOpen ? "text-indigo-600" : ""} />}
                        onClick={() => setAiPanelOpen(!aiPanelOpen)}
                        className={`rounded-none border border-slate-900 font-bold text-xs h-10 px-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${aiPanelOpen ? 'bg-indigo-50 text-indigo-950 border-indigo-900' : 'bg-white text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        {aiPanelOpen ? 'Hide Auto-Fill' : 'AI Extract & Auto-Fill'}
                    </Button>

                    <Button
                        icon={previewVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setPreviewVisible(!previewVisible)}
                        className="rounded-none border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        {previewVisible ? 'Hide Preview' : 'Show Preview'}
                    </Button>

                    <Button
                        icon={<DownloadOutlined />}
                        loading={loading}
                        onClick={handleExportDocx}
                        className="rounded-none border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        Export DOCX
                    </Button>

                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={submitProposalLoading}
                        onClick={handleSubmitProposal}
                        className="rounded-none border border-slate-900 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs h-10 px-5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        Submit Proposal
                    </Button>
                </div>
            </div>

            {/* Main Form Context */}
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    date: new Date().toLocaleDateString('en-GB'),
                    dept: '',
                    email_to: '',
                    email_cc: '',
                    phone: '',
                    customer_raw: '',
                    kind_attention: '',
                    reference: '',
                    subject: '',
                    sac_code: '',
                    scope_intro: '',
                    customer_type: 'Govt',
                    request_type: 'Direct Enquiry',
                    proposal_status: ['Submitted'],
                    technical_requirements: '',
                    billing_address: '',
                    shipping_address: '',
                    delivery_time_date: '',
                    mode_of_delivery: '',
                    supporting_documentation: '',
                    standards: '',
                    penalty_clause: '',
                    claims: '',
                    legal_requirements: '',
                    other_requirements: '',
                }}
                className="w-full"
            >
                {/* Main Studio Workspace Grid */}
                <div className="max-w-7xl mx-auto">
                    <Row gutter={[24, 24]}>
                        {/* Left Column: Document Studio Form */}
                        <Col xs={24} lg={previewVisible ? 15 : 24} xl={previewVisible ? 15 : 24} className="space-y-6">

                            {/* AI Email Extraction / Auto-Fill Panel */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div
                                    onClick={() => setAiPanelOpen(!aiPanelOpen)}
                                    className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-800 transition"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-6 h-6 rounded bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                                            <RobotOutlined className="text-xs" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs uppercase tracking-wider block">
                                                AI Email Auto-Fill & Document Populate
                                            </span>
                                            <span className="text-[10px] text-slate-300 font-normal block">
                                                Paste customer email thread from Outlook/Gmail to auto-populate customer info, subject, scope, and proposal metadata.
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-300 hover:underline">
                                        {aiPanelOpen ? '▲ Collapse Panel' : '▼ Expand & Paste Email'}
                                    </span>
                                </div>

                                {aiPanelOpen && (
                                    <div className="p-4 bg-slate-50/80 border-t border-slate-900 space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                    <MailOutlined className="text-indigo-600" />
                                                    Paste Customer Email Thread:
                                                </label>
                                                {aiEmailText.length > 0 && (
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {aiEmailText.length} chars
                                                    </span>
                                                )}
                                            </div>
                                            <TextArea
                                                rows={6}
                                                value={aiEmailText}
                                                onChange={(e) => setAiEmailText(e.target.value)}
                                                placeholder="Paste complete raw customer email here (including headers, forwarded body, technical requirements, signature)..."
                                                className="text-xs font-mono rounded-none border border-slate-900 focus:border-indigo-600 bg-white"
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="primary"
                                                    loading={aiExtracting}
                                                    disabled={!aiEmailText.trim()}
                                                    onClick={handleExtractEmailForDocument}
                                                    className="rounded-none border border-slate-900 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] transition-all flex items-center gap-1.5"
                                                >
                                                    {aiExtracting ? 'Analyzing Email with AI...' : ' Extract & Populate Document'}
                                                </Button>

                                                <Button
                                                    onClick={() => {
                                                        setAiEmailText('');
                                                        setAiExtractedSummary(null);
                                                    }}
                                                    disabled={!aiEmailText}
                                                    className="rounded-none border border-slate-900 text-slate-700 bg-white hover:bg-slate-100 text-xs h-9 px-3"
                                                >
                                                    Clear
                                                </Button>
                                            </div>

                                            {aiExtractedSummary && (
                                                <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1.5 font-medium animate-fadeIn">
                                                    <CheckCircleOutlined className="text-emerald-600" />
                                                    <span>
                                                        Populated: <strong>{aiExtractedSummary.customer || 'Customer'}</strong> | <strong>{aiExtractedSummary.scopeCount} Scope Items</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Section 1: Document Metadata & Header Settings */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>1. Document Metadata & Header Settings</span>
                                    <span className="text-[10px] text-slate-400 font-normal">DOCX Structure</span>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Specify document header attributes including issue date, department code, target export filename, and SAC code.
                                </div>
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <th className="border-r border-slate-900 p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-1/4">PROPOSAL DATE</th>
                                            <th className="border-r border-slate-900 p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-1/4">DEPT / DIVISION</th>
                                            <th className="border-r border-slate-900 p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-1/4">SAVE FILENAME</th>
                                            <th className="p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-1/4">SAC CODE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="date" noStyle rules={[{ required: true, message: 'Date is required' }]}>
                                                    <Input prefix={<CalendarOutlined className="text-slate-400 mr-1" />} variant="borderless" className="p-1 text-xs" />
                                                </Form.Item>
                                            </td>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="dept" noStyle>
                                                    <Input
                                                        prefix={<ApartmentOutlined className="text-slate-400 mr-1" />}
                                                        variant="borderless"
                                                        className="p-1 text-xs font-semibold"
                                                        suffix={
                                                            <ReloadOutlined
                                                                className="cursor-pointer text-blue-600 hover:text-blue-800 text-[10px]"
                                                                title="Reload department from profile"
                                                                onClick={() => {
                                                                    const c = getUserCenter();
                                                                    if (c) {
                                                                        form.setFieldsValue({ dept: c, quotation_given_by_department: c, center: c });
                                                                        message.info(`Updated department to ${c}`);
                                                                    } else {
                                                                        message.warning('No user center found');
                                                                    }
                                                                }}
                                                            />
                                                        }
                                                    />
                                                </Form.Item>
                                            </td>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="filename" noStyle>
                                                    <Input prefix={<FileWordOutlined className="text-blue-600 mr-1" />} placeholder="Proposal.docx" variant="borderless" className="p-1 text-xs font-mono" />
                                                </Form.Item>
                                            </td>
                                            <td className="p-1">
                                                <Form.Item name="sac_code" noStyle>
                                                    <Input prefix={<SafetyCertificateOutlined className="text-slate-400 mr-1" />} placeholder="998333" variant="borderless" className="p-1 text-xs" />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 2: Customer Addressing & Recipient Metadata */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>2. Customer Addressing & Recipient Information</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Contact & Reference</span>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Select from saved database or enter custom recipient details. First line is Customer Name; subsequent lines form the Address.
                                </div>

                                <div className="p-3 space-y-4">
                                    {/* AutoComplete Customer Search */}
                                    <div className="bg-blue-50/60 p-3 border border-blue-200">
                                        <div className="text-[11px] font-bold text-blue-950 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <BankOutlined className="text-blue-600" />
                                            <span>Quick Customer Search & Auto-Fill:</span>
                                        </div>
                                        <AutoComplete
                                            value={customerSearchText}
                                            options={customerOptions}
                                            onSearch={handleCustomerSearch}
                                            onSelect={handleCustomerSelect}
                                            placeholder="Type customer name, email, or address to auto-complete..."
                                            className="w-full text-xs"
                                        />
                                    </div>

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} md={12}>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Customer Name & Address Block <span className="text-red-500">*</span>
                                                </label>
                                                <Form.Item name="customer_raw" noStyle rules={[{ required: true, message: 'Customer address is required' }]}>
                                                    <TextArea
                                                        rows={4}
                                                        placeholder="M/s Bharat Electronics Ltd&#10;Jalahalli Post, Bangalore - 560013"
                                                        className="text-xs rounded-none border border-slate-900 focus:border-blue-600"
                                                        onChange={(e) => {
                                                            const lines = (e.target.value || '').split('\n').map(s => s.trim()).filter(Boolean);
                                                            form.setFieldsValue({
                                                                customer_name: lines[0] || '',
                                                                address: lines.slice(1).join(', ') || '',
                                                            });
                                                        }}
                                                    />
                                                </Form.Item>
                                                {addressOptions.length > 1 && (
                                                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] text-slate-500 font-bold">Alternate Saved Addresses:</span>
                                                        {addressOptions.map((opt, idx) => (
                                                            <Button
                                                                key={idx}
                                                                size="small"
                                                                onClick={() => handleAddressSelect(opt.value)}
                                                                className="text-[10px] h-5 px-1.5 bg-slate-100 text-slate-700 border-slate-300"
                                                            >
                                                                Addr #{idx + 1}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                                        Kind Attention
                                                    </label>
                                                    <Form.Item name="kind_attention" noStyle>
                                                        <Input
                                                            prefix={<UserOutlined className="text-slate-400 mr-1" />}
                                                            placeholder="Mr. Rajesh Sharma, General Manager"
                                                            className="text-xs rounded-none border border-slate-900"
                                                            onChange={(e) => form.setFieldsValue({ alternate_contact_details: e.target.value })}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <Row gutter={[8, 8]}>
                                                    <Col span={14}>
                                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                                            Email Address
                                                        </label>
                                                        <Form.Item name="email_to" noStyle>
                                                            <Input
                                                                prefix={<MailOutlined className="text-slate-400 mr-1" />}
                                                                placeholder="rajesh@bel.co.in"
                                                                className="text-xs rounded-none border border-slate-900"
                                                                onChange={(e) => form.setFieldsValue({ email: e.target.value })}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={10}>
                                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                                            Phone No.
                                                        </label>
                                                        <Form.Item name="phone" noStyle>
                                                            <Input
                                                                prefix={<PhoneOutlined className="text-slate-400 mr-1" />}
                                                                placeholder="9845012345"
                                                                className="text-xs rounded-none border border-slate-900"
                                                                onChange={(e) => form.setFieldsValue({ phone_no: e.target.value })}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>
                                            </div>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]} className="pt-2 border-t border-slate-200">
                                        <Col xs={24} md={12}>
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                                Proposal Subject / Title <span className="text-red-500">*</span>
                                            </label>
                                            <Form.Item name="subject" noStyle rules={[{ required: true, message: 'Subject is required' }]}>
                                                <Input
                                                    prefix={<FileTextOutlined className="text-slate-400 mr-1" />}
                                                    placeholder="Proposal for Precision Machining and Testing of Titanium Components"
                                                    className="text-xs rounded-none border border-slate-900 font-semibold"
                                                    onChange={(e) => form.setFieldsValue({ quote_description: e.target.value })}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                                Customer Enquiry Reference
                                            </label>
                                            <Form.Item name="reference" noStyle>
                                                <Input
                                                    prefix={<InfoCircleOutlined className="text-slate-400 mr-1" />}
                                                    placeholder="BEL/PUR/2026/048 dated 15-08-2026"
                                                    className="text-xs rounded-none border border-slate-900"
                                                    onChange={(e) => form.setFieldsValue({ quote_reference: e.target.value, email_reference: e.target.value })}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </div>

                            {/* Section 3: Scope of Work & Deliverables */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>3. Scope of Work & Key Deliverables</span>
                                    <span className="text-[10px] text-slate-400 font-normal">{scopeItems.length} Bullet Points</span>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Outline the technical scope of work, activities, and milestones.
                                </div>

                                <div className="p-3 space-y-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                            Introductory Scope Paragraph:
                                        </label>
                                        <Form.Item name="scope_intro" noStyle>
                                            <TextArea
                                                rows={2}
                                                placeholder="With reference to your enquiry, CMTI proposes to undertake the following technical scope of work..."
                                                className="text-xs rounded-none border border-slate-900"
                                            />
                                        </Form.Item>
                                    </div>

                                    {/* Scope items list */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                            Scope Activities / Bullet Points:
                                        </label>
                                        {scopeItems.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300 text-xs">
                                                <span className="font-bold text-blue-600 w-6">#{idx + 1}</span>
                                                <span className="flex-1 text-slate-800">{item}</span>
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveScopeItem(idx)}
                                                />
                                            </div>
                                        ))}

                                        <div className="flex items-center gap-2 pt-1">
                                            <Input
                                                value={newScopeInput}
                                                onChange={(e) => setNewScopeInput(e.target.value)}
                                                onPressEnter={handleAddScopeItem}
                                                placeholder="Add new scope deliverable bullet point..."
                                                className="text-xs rounded-none border border-slate-900"
                                            />
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={handleAddScopeItem}
                                                className="rounded-none border border-slate-900 bg-blue-600 hover:bg-blue-700 font-bold text-xs h-8 px-3"
                                            >
                                                Add Item
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Commercial Pricing Tables */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>4. Commercial Pricing & Cost Tables</span>
                                    <div className="flex items-center gap-2">
                                        {grandPricingTotal > 0 && (
                                            <span className="bg-emerald-500 text-white font-mono px-2 py-0.5 text-[10px] rounded-sm font-bold">
                                                Total: ₹{grandPricingTotal.toLocaleString('en-IN')}
                                            </span>
                                        )}
                                        <Button
                                            size="small"
                                            icon={<PlusOutlined />}
                                            onClick={handleAddTable}
                                            className="rounded-none bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] font-bold h-6"
                                        >
                                            Add Pricing Table
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Configure itemized deliverables, quantities, rates, and amounts.
                                </div>

                                <div className="p-3 space-y-4">
                                    {tables.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300">
                                            No pricing tables added yet. Click <strong>Add Pricing Table</strong> above to add cost itemization.
                                        </div>
                                    ) : (
                                        tables.map((t, tIndex) => (
                                            <div key={tIndex} className="border border-slate-900 p-3 bg-slate-50/60 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <Input
                                                        value={t.title}
                                                        onChange={(e) => handleTableTitleChange(tIndex, e.target.value)}
                                                        placeholder="Table Title (e.g. Schedule of Deliverables & Commercial Terms)"
                                                        className="text-xs font-bold rounded-none border border-slate-900 w-2/3"
                                                    />
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="small"
                                                            onClick={() => handleAddHeaderColumn(tIndex)}
                                                            className="text-[10px] border-slate-400 font-medium"
                                                        >
                                                            + Column
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            onClick={() => handleAddTableRow(tIndex)}
                                                            className="text-[10px] border-slate-400 font-medium"
                                                        >
                                                            + Row
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => handleRemoveTable(tIndex)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse border border-slate-900 text-xs bg-white">
                                                        <thead>
                                                            <tr className="bg-slate-100 border-b border-slate-900">
                                                                {t.headers.map((h, hIndex) => (
                                                                    <th key={hIndex} className="border-r border-slate-900 p-1 font-bold text-slate-800">
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <Input
                                                                                value={h}
                                                                                onChange={(e) => handleHeaderChange(tIndex, hIndex, e.target.value)}
                                                                                variant="borderless"
                                                                                className="p-0 text-xs font-bold"
                                                                            />
                                                                            {t.headers.length > 1 && (
                                                                                <span
                                                                                    onClick={() => handleRemoveHeaderColumn(tIndex, hIndex)}
                                                                                    className="text-slate-400 hover:text-red-500 cursor-pointer text-[10px] px-1 font-mono"
                                                                                >
                                                                                    ✕
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </th>
                                                                ))}
                                                                <th className="p-1 w-8 text-center text-slate-400">#</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {t.rows.map((row, rIndex) => (
                                                                <tr key={rIndex} className="border-b border-slate-200">
                                                                    {row.map((cell, cIndex) => (
                                                                        <td key={cIndex} className="border-r border-slate-200 p-1">
                                                                            <Input
                                                                                value={cell}
                                                                                onChange={(e) => handleCellChange(tIndex, rIndex, cIndex, e.target.value)}
                                                                                variant="borderless"
                                                                                className="p-0 text-xs"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="p-1 text-center">
                                                                        <span
                                                                            onClick={() => handleRemoveTableRow(tIndex, rIndex)}
                                                                            className="text-slate-300 hover:text-red-500 cursor-pointer text-xs"
                                                                        >
                                                                            ✕
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Section 5: Internal Cost Estimation */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>5. Internal Cost Estimation</span>
                                    <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => setCostModalOpen(true)}
                                        className="rounded-none bg-blue-600 hover:bg-blue-700 text-white border-none text-[10px] font-bold h-6"
                                    >
                                        Open Cost Estimation Sheet
                                    </Button>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Configure internal costing sheet, manpower, and expenses (currently not saved to database).
                                </div>
                                <div className="p-3">
                                    {internalCostTables.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300">
                                            No cost estimation applied yet. Click <strong>Open Cost Estimation Sheet</strong> to configure.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {internalCostTables.map((tbl, idx) => (
                                                <div key={idx} className="border border-slate-200 p-2.5 bg-slate-50">
                                                    <div className="font-bold text-xs text-slate-800 mb-1">{tbl.title || `Table ${idx + 1}`}</div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-[11px] border-collapse bg-white">
                                                            <thead>
                                                                <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                                                                    {tbl.headers.map((h, hIdx) => (
                                                                        <th key={hIdx} className="p-1.5 font-bold border-r border-slate-200">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {tbl.rows.map((r, rIdx) => (
                                                                    <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50">
                                                                        {r.map((cell, cIdx) => (
                                                                            <td key={cIdx} className="p-1.5 text-slate-600 border-r border-slate-200">{cell}</td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                            {grandInternalTotal > 0 && (
                                                <div className="text-right font-bold text-xs text-slate-900 pt-2 border-t border-slate-200">
                                                    Grand Internal Total: <span className="text-blue-700 font-mono">₹{grandInternalTotal.toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section 6: Quotation Requirement */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>6. Quotation Requirement</span>
                                    <span className="text-[10px] text-slate-400 font-normal">Terms & Logistics</span>
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Define project-specific technical constraints, delivery terms, and legal/billing requirements.
                                </div>
                                <div className="p-3">
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="technical_requirements" label={<span className="font-bold text-xs text-slate-800">Any Technical Requirements</span>}>
                                                <TextArea rows={2} placeholder="e.g. Specific tolerance, material grade..." />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="billing_address" label={<span className="font-bold text-xs text-slate-800">Billing Address</span>}>
                                                <TextArea 
                                                    rows={2} 
                                                    placeholder="Billing Address..." 
                                                    onChange={(e) => {
                                                        if (shippingSameAsBilling) {
                                                            form.setFieldsValue({ shipping_address: e.target.value });
                                                        }
                                                    }}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-xs text-slate-800">Shipping Address</span>
                                                <Checkbox 
                                                    checked={shippingSameAsBilling}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setShippingSameAsBilling(checked);
                                                        if (checked) {
                                                            form.setFieldsValue({
                                                                shipping_address: form.getFieldValue('billing_address') || ''
                                                            });
                                                        }
                                                    }}
                                                    className="text-[11px] text-slate-500 font-semibold"
                                                >
                                                    Same as Billing
                                                </Checkbox>
                                            </div>
                                            <Form.Item name="shipping_address" noStyle>
                                                <TextArea 
                                                    rows={2} 
                                                    placeholder="Shipping Address..." 
                                                    disabled={shippingSameAsBilling}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]} className="mt-2">
                                        <Col xs={24} md={8}>
                                            <Form.Item name="delivery_time_date" label={<span className="font-bold text-xs text-slate-800">Delivery Time/Date</span>}>
                                                <Input placeholder="e.g. 4 Weeks from PO" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="mode_of_delivery" label={<span className="font-bold text-xs text-slate-800">Mode of Delivery</span>}>
                                                <Input placeholder="e.g. Hand Delivery, Speed Post" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="supporting_documentation" label={<span className="font-bold text-xs text-slate-800">Supporting Documentation</span>}>
                                                <Input placeholder="e.g. Calibration certificates, test reports" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]} className="mt-2">
                                        <Col xs={24} md={8}>
                                            <Form.Item name="standards" label={<span className="font-bold text-xs text-slate-800">National & International Standards</span>}>
                                                <Input placeholder="e.g. ISO 9001, AS9100" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="penalty_clause" label={<span className="font-bold text-xs text-slate-800">Any Penalty Clause</span>}>
                                                <Input placeholder="e.g. LD clause 0.5% per week" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="claims" label={<span className="font-bold text-xs text-slate-800">Any Claims</span>}>
                                                <Input placeholder="e.g. Warranty support, replacement claims" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]} className="mt-2">
                                        <Col xs={24} md={12}>
                                            <Form.Item name="legal_requirements" label={<span className="font-bold text-xs text-slate-800">Any Specific Legal Requirements</span>}>
                                                <Input placeholder="e.g. NDA, Intellectual Property rights" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="other_requirements" label={<span className="font-bold text-xs text-slate-800">Any Other Requirements (Specify)</span>}>
                                                <Input placeholder="Any other requirements..." />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </div>

                            {/* Section 7: Signatories & Terms */}
                            <div className="border border-slate-900 bg-white mb-6 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>7. Terms & Signatories</span>
                                    <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddSignatory}
                                        className="rounded-none bg-slate-800 text-white border-slate-700 text-[10px] h-6"
                                    >
                                        + Signatory
                                    </Button>
                                </div>

                                <div className="p-3 space-y-4">
                                    {/* Terms items */}
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                            Payment Terms & Conditions:
                                        </label>
                                        {termsItems.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 border border-slate-300 text-xs mb-1.5">
                                                <span className="font-bold text-slate-500 w-6">#{idx + 1}</span>
                                                <span className="flex-1 text-slate-800">{item}</span>
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveTermItem(idx)}
                                                />
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={newTermInput}
                                                onChange={(e) => setNewTermInput(e.target.value)}
                                                onPressEnter={handleAddTermItem}
                                                placeholder="Add payment / delivery term point..."
                                                className="text-xs rounded-none border border-slate-900"
                                            />
                                            <Button
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={handleAddTermItem}
                                                className="rounded-none border border-slate-900 bg-slate-100 text-xs font-semibold h-8"
                                            >
                                                Add Term
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Signatories */}
                                    <div className="pt-2 border-t border-slate-200">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                                            Authorized Signatories:
                                        </label>
                                        <Row gutter={[12, 12]}>
                                            {signatories.map((sig, idx) => (
                                                <Col xs={24} sm={12} key={idx}>
                                                    <div className="border border-slate-900 p-2.5 bg-slate-50 space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-bold text-slate-700">Signatory #{idx + 1}</span>
                                                            {signatories.length > 1 && (
                                                                <Button
                                                                    type="text"
                                                                    danger
                                                                    size="small"
                                                                    icon={<DeleteOutlined />}
                                                                    onClick={() => handleRemoveSignatory(idx)}
                                                                />
                                                            )}
                                                        </div>
                                                        <Input
                                                            value={sig.name}
                                                            onChange={(e) => handleSignatoryChange(idx, 'name', e.target.value)}
                                                            placeholder="Signatory Full Name"
                                                            className="text-xs rounded-none border border-slate-400 font-semibold"
                                                        />
                                                        <TextArea
                                                            rows={2}
                                                            value={sig.lines_raw}
                                                            onChange={(e) => handleSignatoryChange(idx, 'lines_raw', e.target.value)}
                                                            placeholder="Scientist-E&#10;Centre for Precision Machining&#10;CMTI, Bengaluru"
                                                            className="text-[11px] rounded-none border border-slate-400"
                                                        />
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 8: PROPOSAL SUBMISSION & MANUAL ENTRY DETAILS */}
                            <div className="border-2 border-blue-600 bg-white mb-6 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)]">
                                <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-blue-900 text-white p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircleOutlined className="text-lg text-emerald-400" />
                                        <div>
                                            <span className="font-extrabold text-sm uppercase tracking-wider block">
                                                8. Proposal Submission & Manual Entry Details
                                            </span>
                                            <span className="text-[11px] text-blue-200 font-normal">
                                                These fields are automatically synchronized with Document Studio. Complete and verify below before final submission.
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
                                            <Form.Item
                                                name="customer_type"
                                                label={<span className="font-bold text-xs text-slate-800">Customer Type</span>}
                                                rules={[{ required: true, message: 'Please select customer type' }]}
                                            >
                                                <Select placeholder="Customer Type" className="w-full">
                                                    {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                                                        <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12} md={6}>
                                            <Form.Item
                                                name="request_type"
                                                label={<span className="font-bold text-xs text-slate-800">Request Type</span>}
                                                rules={[{ required: true, message: 'Please select request type' }]}
                                            >
                                                <Select placeholder="Request Type" className="w-full">
                                                    {REQUEST_TYPE_OPTIONS.map((opt) => (
                                                        <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12} md={6}>
                                            <Form.Item
                                                name="quote_amount"
                                                label={<span className="font-bold text-xs text-slate-800">Quote Amount (₹)</span>}
                                            >
                                                <Input
                                                    placeholder={grandPricingTotal > 0 ? String(grandPricingTotal) : (grandInternalTotal > 0 ? String(grandInternalTotal) : '0')}
                                                    prefix={<span className="text-slate-400 font-bold">₹</span>}
                                                    className="font-mono font-semibold"
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12} md={6}>
                                            <Form.Item
                                                name="proposal_status"
                                                label={<span className="font-bold text-xs text-slate-800">Proposal Status</span>}
                                            >
                                                <Select mode="tags" placeholder="Proposal Status" className="w-full">
                                                    <Select.Option value="Submitted">Submitted</Select.Option>
                                                    <Select.Option value="Accepted">Accepted</Select.Option>
                                                    <Select.Option value="Rejected">Rejected</Select.Option>
                                                    <Select.Option value="Awaiting">Awaiting</Select.Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    {/* Tender specifics if selected */}
                                    {isTenderSelected && (
                                        <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-lg space-y-3">
                                            <div className="font-bold text-blue-900 text-xs flex items-center gap-2">
                                                <Tag color="blue">Tender Details</Tag>
                                                <span>Make In India & Tender Image Uploads</span>
                                            </div>

                                            <Form.Item name="make_in_india" label={<span className="text-xs font-semibold text-slate-700">Make In India Details</span>}>
                                                <TextArea rows={2} placeholder="Enter Make In India percentage/details..." />
                                            </Form.Item>

                                            <Form.Item label={<span className="text-xs font-semibold text-slate-700">Tender Images (Multiple)</span>}>
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
                                            </Form.Item>
                                        </div>
                                    )}

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="customer_name"
                                                label={<span className="font-bold text-xs text-slate-800">Customer Name</span>}
                                                rules={[{ required: true, message: 'Customer Name is required' }]}
                                            >
                                                <Input placeholder="Customer or Company Name" className="font-semibold" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="alternate_contact_details"
                                                label={<span className="font-bold text-xs text-slate-800">Alternate Contact / Kind Attention</span>}
                                            >
                                                <Input placeholder="Contact Person / Alternate Details" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="email"
                                                label={<span className="font-bold text-xs text-slate-800">Email Reference / Address</span>}
                                            >
                                                <Input placeholder="customer@domain.com" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="phone_no"
                                                label={<span className="font-bold text-xs text-slate-800">Phone Number</span>}
                                            >
                                                <Input placeholder="Phone / Mobile No." />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="quote_reference"
                                                label={<span className="font-bold text-xs text-slate-800">Quote / Enquiry Reference</span>}
                                            >
                                                <Input placeholder="Ref Number / Inquiry ID" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="quote_description"
                                                label={<span className="font-bold text-xs text-slate-800">Quote Description / Project Title</span>}
                                                rules={[{ required: true, message: 'Quote description is required' }]}
                                            >
                                                <Input placeholder="Project Activity or Description" className="font-semibold" />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12} md={8}>
                                            <Form.Item
                                                name="quotation_given_by_name"
                                                label={<span className="font-bold text-xs text-slate-800">Quotation Given By / Coordinator</span>}
                                                rules={[{ required: true, message: 'Coordinator Name is required' }]}
                                            >
                                                <Input placeholder="Scientist Name" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12} md={8}>
                                            <Form.Item
                                                name="center"
                                                label={<span className="font-bold text-xs text-slate-800">Centre / Department</span>}
                                            >
                                                <Input placeholder="Centre / Dept" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} sm={12} md={8}>
                                            <Form.Item
                                                name="group"
                                                label={<span className="font-bold text-xs text-slate-800">Group</span>}
                                            >
                                                <Input placeholder="Group Name" />
                                            </Form.Item>
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
                                            Clicking <strong>Submit Proposal</strong> will automatically generate the <code>.docx</code> proposal document, create the proposal record, and upload all files.
                                        </div>

                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <Button
                                                icon={<DownloadOutlined />}
                                                loading={loading}
                                                onClick={handleExportDocx}
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
                        </Col>

                        {/* Right Column: Live A4 Document Preview */}
                        {previewVisible && (
                            <Col xs={24} lg={9} xl={9}>
                                <div className="sticky top-6 space-y-4">
                                    <Card
                                        className="shadow-2xl rounded-2xl border border-slate-300 bg-white overflow-hidden"
                                        styles={{ body: { padding: '24px' } }}
                                    >
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                                            <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                                <PrinterOutlined className="text-blue-600" />
                                                Live A4 Document Preview
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                Zoom: {previewZoom}%
                                            </span>
                                        </div>

                                        {/* A4 Paper Mock */}
                                        <div
                                            className="bg-white border border-slate-300 p-6 shadow-md rounded font-serif text-xs leading-relaxed space-y-4 max-h-[750px] overflow-y-auto"
                                            style={{
                                                transform: `scale(${previewZoom / 100})`,
                                                transformOrigin: 'top center',
                                            }}
                                        >
                                            {/* Header */}
                                            <div className="text-right text-slate-600 space-y-0.5 border-b border-slate-100 pb-2">
                                                <div className="font-bold text-xs text-slate-900">Date: {formValues.date || new Date().toLocaleDateString('en-GB')}</div>
                                                {formValues.dept && <div className="font-bold text-blue-700 text-xs">Dept: {formValues.dept}</div>}
                                            </div>

                                            {/* Customer block */}
                                            {formValues.customer_raw && (
                                                <div>
                                                    <div className="font-bold text-slate-900 text-xs mb-0.5">To:</div>
                                                    <div className="whitespace-pre-line text-slate-700 pl-2 border-l-2 border-blue-500 font-sans text-[11px] leading-snug">
                                                        {formValues.customer_raw}
                                                    </div>
                                                </div>
                                            )}

                                            {formValues.subject && (
                                                <div className="font-bold text-slate-900 text-xs border-y border-slate-200 py-1">
                                                    Sub: {formValues.subject}
                                                </div>
                                            )}

                                            {/* Scope */}
                                            {(formValues.scope_intro || scopeItems.length > 0) && (
                                                <div className="space-y-1 text-[11px]">
                                                    <div className="font-bold text-slate-900">Scope of Work:</div>
                                                    {formValues.scope_intro && <p className="italic text-slate-600 mb-1">{formValues.scope_intro}</p>}
                                                    <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                                                        {scopeItems.map((item, i) => (
                                                            <li key={i}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Tables */}
                                            {tables.length > 0 && (
                                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                                    {tables.map((t, idx) => (
                                                        <div key={idx} className="space-y-1">
                                                            {t.title && <div className="font-bold text-slate-800 text-[11px]">{t.title}</div>}
                                                            <table className="w-full border-collapse border border-slate-300 text-[10px]">
                                                                <thead>
                                                                    <tr className="bg-slate-100">
                                                                        {t.headers.map((h, hIdx) => (
                                                                            <th key={hIdx} className="border border-slate-300 p-1 text-left font-bold">{h}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {t.rows.map((r, rIdx) => (
                                                                        <tr key={rIdx}>
                                                                            {r.map((cell, cIdx) => (
                                                                                <td key={cIdx} className="border border-slate-300 p-1 text-slate-700">{cell}</td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Signatories Footer */}
                                            {signatories.some((s) => s.name.trim() || s.lines_raw.trim()) && (
                                                <div className="pt-4 border-t border-slate-300 text-right space-y-1">
                                                    {signatories.map((sig, i) => (
                                                        <div key={i}>
                                                            {sig.name && <div className="font-bold text-slate-900 text-xs">{sig.name}</div>}
                                                            {sig.lines_raw && <div className="whitespace-pre-line text-slate-600 text-[10px] leading-snug">{sig.lines_raw}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </Col>
                        )}
                    </Row>
                </div>
            </Form>

            <CostEstimationModal
                open={costModalOpen}
                onClose={() => setCostModalOpen(false)}
                projectId={null}
                hideGenerateWord={true}
                initialHeaders={rawStudioHeaders}
                onApply={(studioHeaders) => {
                    setRawStudioHeaders(studioHeaders);
                    const formattedTables = convertHeadersToDocumentTables(studioHeaders);
                    if (formattedTables && formattedTables.length > 0) {
                        setInternalCostTables(formattedTables);
                    }
                }}
                title={formValues.subject || "Internal Cost Estimation"}
            />
        </div>
    );
}
