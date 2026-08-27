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
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { CostEstimationModal, convertHeadersToDocumentTables } from './CostBreakDownAction';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

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

export default function DocumentGenerate({ onAddToProposals, projectId }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [addToProposalsLoading, setAddToProposalsLoading] = useState(false);
    const [actionType, setActionType] = useState('download'); // 'download' | 'addToProposals'
    const [previewZoom, setPreviewZoom] = useState(100);
    const [previewVisible, setPreviewVisible] = useState(false);

    // Dynamic state for Scope Bullet Points & Attachments
    const [scopeItems, setScopeItems] = useState([]);
    const [newScopeInput, setNewScopeInput] = useState('');
    const [scopeAttachments, setScopeAttachments] = useState([]);

    // Dynamic state for Terms Bullet Points (Starts empty)
    const [termsItems, setTermsItems] = useState([]);
    const [newTermInput, setNewTermInput] = useState('');

    // Dynamic state for Pricing Tables (Starts empty)
    const [tables, setTables] = useState([]);

    // Dynamic state for Internal Cost Estimation Tables (Starts empty)
    const [internalCostTables, setInternalCostTables] = useState([]);
    const [rawStudioHeaders, setRawStudioHeaders] = useState([]);
    const [costModalOpen, setCostModalOpen] = useState(false);

    // AI Email Extraction State
    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiEmailText, setAiEmailText] = useState('');
    const [aiExtracting, setAiExtracting] = useState(false);
    const [aiExtractedSummary, setAiExtractedSummary] = useState(null);

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

            // Format customer raw address block (ensure no email address appears in customer name/address)
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

            // Filename based on Customer Name
            let generatedFilename = form.getFieldValue('filename');
            const nameForFile = cleanCustName || data.proposal_subject || 'Proposal';
            const safeName = nameForFile
                .replace(/[^a-zA-Z0-9_\-\s]/g, '')
                .trim()
                .replace(/\s+/g, '_');
            generatedFilename = `${safeName || 'Proposal'}.docx`;

            // Populate form values
            const updates = {
                filename: generatedFilename,
            };
            if (data.email_to && data.email_to.length > 0) {
                updates.email_to = data.email_to.join(', ');
            }
            if (data.email_cc && data.email_cc.length > 0) {
                updates.email_cc = data.email_cc.join(', ');
            }
            if (data.phone_number) {
                updates.phone = data.phone_number;
            }
            if (custRaw) {
                updates.customer_raw = custRaw;
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
            }
            if (data.proposal_subject) {
                updates.subject = data.proposal_subject;
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
                    const addrs = Array.isArray(matched.addresses)
                        ? matched.addresses
                        : matched.address
                            ? [matched.address]
                            : [];
                    setAddressOptions(addrs.map((a) => ({ value: a, label: a })));
                }
            }

            form.setFieldsValue(updates);

            // Populate scope items safely
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
            } else {
                setScopeItems([]);
            }

            setAiExtractedSummary({
                customer: data.customer_name,
                subject: data.proposal_subject,
                scopeCount: validScopes.length
            });

            message.success('Proposal details successfully extracted and populated into the document form!');
        } catch (err) {
            console.error('Email extraction error:', err);
            if (err.response?.status === 503) {
                message.error('AI service is unavailable. Please ensure Ollama & FastAPI are running.');
            } else if (err.response?.status === 504) {
                message.error('AI request timed out. Please try again.');
            } else {
                message.error('Failed to extract email details. Please check network/backend status.');
            }
        } finally {
            setAiExtracting(false);
        }
    };

    // Helper to calculate subtotal for a table in internalCostTables
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

    const grandInternalTotal = useMemo(() => {
        return internalCostTables.reduce((sum, tbl) => sum + getTableSubtotal(tbl), 0);
    }, [internalCostTables]);

    // Dynamic state for Multiple Signatories
    const [signatories, setSignatories] = useState([
        {
            name: '',
            lines_raw: '',
        },
    ]);

    // Watched form values for live preview synchronization
    const formValues = Form.useWatch([], form) || {};

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

    // Customer suggestions state
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [customerSearchText, setCustomerSearchText] = useState('');
    const [addressOptions, setAddressOptions] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Auto-fetch center, logged-in user info, and customer database on mount
    useEffect(() => {
        const fetchedCenter = getUserCenter();
        const fetchedDesignation = getUserDesignation();
        if (fetchedCenter) {
            form.setFieldsValue({ dept: fetchedCenter });
        }

        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                if (parsedUser.name) {
                    const desigLine = fetchedDesignation ? `${fetchedDesignation}` : '';
                    const centerLine = fetchedCenter ? `${fetchedCenter}` : '';
                    const lines = [desigLine, centerLine, 'CMTI, Bengaluru'].filter(Boolean).join('\n');
                    setSignatories([
                        {
                            name: parsedUser.name,
                            lines_raw: lines,
                        },
                    ]);
                }
            }
        } catch (e) {
            console.error('Error populating user signatory:', e);
        }

        // Fetch customer list with addresses from proposals/customer db
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
    }, [form]);

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
                email_to: c.email || form.getFieldValue('email_to') || '',
                phone: c.phone_no || c.phone || form.getFieldValue('phone') || '',
                kind_attention: c.alternate_contact_details || form.getFieldValue('kind_attention') || '',
                filename: `${safeCustName || 'Proposal'}.docx`,
            });

            message.info(`Selected "${c.name}" — Name & Address populated!`);
        }
    };

    // Handle selecting address from address options
    const handleAddressSelect = (addressVal) => {
        const currentRaw = form.getFieldValue('customer_raw') || '';
        const lines = currentRaw.split('\n');
        const custName = lines[0] || (selectedCustomer ? selectedCustomer.name : '');
        const formatted = addressVal ? `${custName}\n${addressVal}` : custName;
        form.setFieldsValue({ customer_raw: formatted });
        message.info('Updated document customer address');
    };

    // Handle adding scope point
    const handleAddScopeItem = () => {
        if (!newScopeInput.trim()) return;
        setScopeItems([...scopeItems, newScopeInput.trim()]);
        setNewScopeInput('');
    };

    const handleRemoveScopeItem = (index) => {
        setScopeItems(scopeItems.filter((_, i) => i !== index));
    };

    // Handle adding terms point
    const handleAddTermItem = () => {
        if (!newTermInput.trim()) return;
        setTermsItems([...termsItems, newTermInput.trim()]);
        setNewTermInput('');
    };

    const handleRemoveTermItem = (index) => {
        setTermsItems(termsItems.filter((_, i) => i !== index));
    };

    // Handle table editing
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

    // Form submission handler to generate DOCX or Add to Proposals
    const handleSubmit = async (values) => {
        const isAddToProposals = actionType === 'addToProposals';
        if (isAddToProposals) {
            setAddToProposalsLoading(true);
        } else {
            setLoading(true);
        }

        try {
            // Process email lists
            const email_to = (values.email_to || '')
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean);
            const email_cc = (values.email_cc || '')
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean);

            // Process customer lines
            const customer_lines = (values.customer_raw || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);

            // Process signatories array
            const formattedSignatories = signatories.map((sig) => ({
                name: sig.name || '',
                lines: (sig.lines_raw || '')
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean),
            }));

            const primarySig = formattedSignatories[0] || { name: '', lines: [] };

            const payload = {
                date: values.date || new Date().toLocaleDateString('en-GB'),
                dept: values.dept || '',
                email_to,
                email_cc,
                phone: values.phone || '',
                customer_lines,
                kind_attention: values.kind_attention || '',
                reference: values.reference || '',
                subject: values.subject || '',
                sac_code: values.sac_code || '',
                scope_intro: values.scope_intro || '',
                scope_items: scopeItems,
                terms_items: termsItems,
                tables: tables,
                internal_cost_tables: internalCostTables,
                signatory_name: primarySig.name,
                signatory_lines: primarySig.lines,
                signatories: formattedSignatories,
                filename: values.filename || '',
            };

            const response = await axios.post(
                `${API_BASE_URL}/Proposal/generate`,
                payload,
                {
                    responseType: 'blob',
                }
            );

            // Header disposition check
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

            if (isAddToProposals) {
                // Act as uploaded document structure: Parse DOCX via /proposals/add-proposal-coordinator
                const docFile = new File([blob], filename, {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                });

                const formData = new FormData();
                formData.append('mode', 'upload');
                formData.append('file', docFile);

                let extractedData = {};
                try {
                    const uploadRes = await axios.post(
                        `${API_BASE_URL}/proposals/add-proposal-coordinator`,
                        formData,
                        { headers: { 'Content-Type': 'multipart/form-data' } }
                    );
                    if (uploadRes.data && uploadRes.data.success && uploadRes.data.data) {
                        extractedData = uploadRes.data.data;
                    }
                } catch (parseErr) {
                    console.warn('Backend parsing fallback to form values:', parseErr);
                }

                // Ensure key fields from Document Generator are prefilled if missing from parser
                if (!extractedData.customer_name && customer_lines[0]) {
                    extractedData.customer_name = customer_lines[0];
                }
                if (!extractedData.customer_type) {
                    if (selectedCustomer && selectedCustomer.customer_type) {
                        extractedData.customer_type = selectedCustomer.customer_type;
                    } else if (extractedData.customer_name) {
                        const found = customerSuggestions.find(
                            (c) => c.name && c.name.trim().toLowerCase() === extractedData.customer_name.trim().toLowerCase()
                        );
                        if (found && found.customer_type) {
                            extractedData.customer_type = found.customer_type;
                        }
                    }
                }
                if (!extractedData.address && customer_lines.length > 1) {
                    extractedData.address = customer_lines.slice(1).join(', ');
                }
                if (!extractedData.email && email_to.length > 0) {
                    extractedData.email = email_to.join(', ');
                }
                if (!extractedData.email_reference) {
                    extractedData.email_reference = extractedData.email || email_to.join(', ') || values.reference || '';
                }
                if (!extractedData.quote_reference && values.reference) {
                    extractedData.quote_reference = values.reference;
                }
                if (!extractedData.quote_description && values.subject) {
                    extractedData.quote_description = values.subject;
                }
                if (!extractedData.center && values.dept) {
                    extractedData.center = values.dept;
                }
                if (values.kind_attention) {
                    extractedData.kind_attention = values.kind_attention;
                }
                if (values.phone) {
                    if (!extractedData.phone_no) extractedData.phone_no = values.phone;
                    if (!extractedData.alternate_contact_details) extractedData.alternate_contact_details = values.phone;
                }

                message.success(`Document "${filename}" generated & extracted into Proposal Form!`);

                if (onAddToProposals) {
                    onAddToProposals(docFile, extractedData, scopeAttachments);
                }
            } else {
                // Standard Download DOCX
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(downloadUrl);

                message.success(`Proposal document "${filename}" generated successfully!`);
            }
        } catch (err) {
            console.error('Failed to generate Proposal document:', err);
            message.error(
                err.response?.data?.message ||
                'Failed to generate document. Please verify backend service.'
            );
        } finally {
            setLoading(false);
            setAddToProposalsLoading(false);
        }
    };

    // Calculate completion percentage for the live progress indicator
    const calculateProgress = () => {
        let score = 0;
        if (formValues.date) score += 15;
        if (formValues.dept) score += 10;
        if (formValues.customer_raw) score += 20;
        if (formValues.subject) score += 20;
        if (scopeItems.length > 0) score += 15;
        if (termsItems.length > 0) score += 10;
        if (signatories.some((s) => s.name.trim())) score += 10;
        return Math.min(score, 100);
    };

    const progressPercent = calculateProgress();

    return (
        <div className="w-full min-h-screen bg-[#F8FAFC] py-6 px-4 sm:px-6 lg:px-10 font-sans antialiased text-[#0F172A]">

            {/* Enterprise Header Area */}
            <div className="max-w-7xl mx-auto mb-8 bg-white p-5 border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-5 text-slate-900 select-none">
                {/* Left side: Studio Info & Readiness */}
                <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            DOCUMENT STUDIO / PROPOSAL GENERATOR
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">
                                Official Document Studio
                            </h1>
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-mono">
                                PRO DOCUMENT V2.0
                            </span>
                        </div>
                        <p className="text-slate-500 text-xs m-0 leading-normal max-w-xl">
                            Build, format, and stream enterprise proposal documents with real-time A4 preview and instant proposal extraction.
                        </p>
                    </div>

                    <div className="h-10 w-px bg-slate-200 hidden md:block" />

                    {/* Document Readiness */}
                    <div className="min-w-[130px]">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
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

                {/* Right side: Modern Buttons */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Button
                        icon={<RobotOutlined className={aiPanelOpen ? "text-indigo-600" : ""} />}
                        onClick={() => setAiPanelOpen(!aiPanelOpen)}
                        className={`rounded-none border border-slate-900 font-bold text-xs h-11 px-5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${aiPanelOpen ? 'bg-indigo-50 text-indigo-950 border-indigo-900 shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]' : 'bg-white text-slate-900 hover:bg-slate-50'
                            }`}
                    >
                        {aiPanelOpen ? 'Hide  Auto-Fill' : ' Extract  Email and  Auto-Fill'}
                    </Button>

                    <Button
                        icon={previewVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setPreviewVisible(!previewVisible)}
                        className="rounded-none border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 font-bold text-xs h-11 px-5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        {previewVisible ? 'Hide Preview' : 'Show Preview'}
                    </Button>

                    <Button
                        icon={<DownloadOutlined />}
                        loading={loading && !addToProposalsLoading}
                        onClick={() => {
                            setActionType('download');
                            form.submit();
                        }}
                        className="rounded-none border border-slate-900 text-slate-900 bg-white hover:bg-slate-50 font-bold text-xs h-11 px-5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        Export DOCX
                    </Button>

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        loading={addToProposalsLoading}
                        onClick={() => {
                            setActionType('addToProposals');
                            form.submit();
                        }}
                        className="rounded-none border border-slate-900 bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs h-11 px-5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        Add to Proposals
                    </Button>
                </div>
            </div>

            {/* Main Studio Workspace Grid */}
            <div className="max-w-7xl mx-auto">
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
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
                    }}
                    className="w-full"
                >
                    <Row gutter={[24, 24]}>
                        {/* Left Column: Input Form Studio */}
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
                                                Extract Email Auto-Fill & Document Populate
                                            </span>
                                            <span className="text-[10px] text-slate-300 font-normal block">
                                                Paste customer email thread from Outlook/Gmail to instantly populate customer info, subject, scope, and metadata.
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
                                                    className="rounded-none border border-slate-900 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] active:translate-x-[1px] transition-all flex items-center gap-1.5"
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
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider">
                                    1. Document Metadata & Header Settings
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Specify document header attributes including issue date, department code, and target export filename.
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
                                                    <Input prefix={<CalendarOutlined className="text-slate-450 mr-1" />} variant="borderless" className="p-1 text-xs" />
                                                </Form.Item>
                                            </td>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="dept" noStyle>
                                                    <Input
                                                        prefix={<ApartmentOutlined className="text-slate-450 mr-1" />}
                                                        variant="borderless"
                                                        className="p-1 text-xs font-semibold"
                                                        suffix={
                                                            <ReloadOutlined
                                                                className="cursor-pointer text-blue-600 hover:text-blue-800 text-[10px]"
                                                                title="Reload department from profile"
                                                                onClick={() => {
                                                                    const c = getUserCenter();
                                                                    if (c) {
                                                                        form.setFieldsValue({ dept: c });
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
                                                    <Input variant="borderless" className="p-1 text-xs" placeholder="Proposal_Name.docx" />
                                                </Form.Item>
                                            </td>
                                            <td className="p-1">
                                                <Form.Item name="sac_code" noStyle>
                                                    <Input variant="borderless" className="p-1 text-xs" placeholder="e.g. 998313" />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 2: Distribution & Contact List */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider">
                                    2. Distribution & Contact List
                                </div>
                                <div className="p-3 text-slate-500 text-xs border-b border-slate-900 leading-normal bg-slate-50/50">
                                    Primary, copy email addresses and contact phone numbers to embed into the official Proposal header metadata block.
                                </div>
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <th className="border-r border-slate-900 p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-5/12">EMAIL - TO (COMMA SEPARATED)</th>
                                            <th className="border-r border-slate-900 p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-4/12">EMAIL - CC (COMMA SEPARATED)</th>
                                            <th className="p-2 text-left font-bold uppercase tracking-wider text-slate-700 w-3/12">PHONE NUMBER</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="email_to" noStyle>
                                                    <Input prefix={<MailOutlined className="text-slate-450 mr-1" />} variant="borderless" className="p-1 text-xs" placeholder="client@company.com, purchase@company.com" />
                                                </Form.Item>
                                            </td>
                                            <td className="border-r border-slate-900 p-1">
                                                <Form.Item name="email_cc" noStyle>
                                                    <Input prefix={<MailOutlined className="text-slate-450 mr-1" />} variant="borderless" className="p-1 text-xs" placeholder="head@cmti.res.in, accounts@cmti.res.in" />
                                                </Form.Item>
                                            </td>
                                            <td className="p-1">
                                                <Form.Item name="phone" noStyle>
                                                    <Input prefix={<PhoneOutlined className="text-slate-450 mr-1" />} variant="borderless" className="p-1 text-xs" placeholder="e.g. +91 9876543210, 080-22195784" />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 3: Customer & Proposal Context */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider">
                                    Customer & Proposal Context
                                </div>
                                <table className="w-full border-collapse text-xs">
                                    <tbody>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="border-r border-slate-900 p-2 font-bold uppercase tracking-wider text-slate-700 w-1/2 text-left">CUSTOMER NAME - CUSTOMER NAME (SEARCH DATABASE)</td>
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 w-1/2 text-left">KIND ATTENTION</td>
                                        </tr>
                                        <tr className="border-b border-slate-900">
                                            <td className="border-r border-slate-900 p-1">
                                                <AutoComplete
                                                    options={customerOptions}
                                                    value={customerSearchText}
                                                    onChange={(val) => {
                                                        setCustomerSearchText(val);
                                                        handleCustomerSearch(val);
                                                    }}
                                                    onSelect={handleCustomerSelect}
                                                    style={{ width: '100%' }}
                                                >
                                                    <Input placeholder="Search existing name..." variant="borderless" className="p-1 text-xs font-semibold" />
                                                </AutoComplete>
                                            </td>
                                            <td className="p-1 align-top">
                                                <Form.Item name="kind_attention" noStyle>
                                                    <TextArea
                                                        variant="borderless"
                                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                                        className="p-1 text-xs font-medium"
                                                        placeholder="e.g. Mr. Rajesh Sharma&#10;General Manager"
                                                    />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="border-r border-slate-900 p-2 font-bold uppercase tracking-wider text-slate-700 text-left">CUSTOMER ADDRESS</td>
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">REFERENCE</td>
                                        </tr>
                                        <tr className="border-b border-slate-900">
                                            <td className="border-r border-slate-900 p-2 align-top">
                                                {addressOptions.length > 0 && (
                                                    <div className="mb-2 pb-2 border-b border-slate-200">
                                                        <span className="text-[10px] font-bold text-slate-400 block mb-1">Address Option:</span>
                                                        <AutoComplete
                                                            options={addressOptions}
                                                            onSelect={handleAddressSelect}
                                                            style={{ width: '100%' }}
                                                        >
                                                            <Input placeholder="Click to choose address option..." size="small" className="text-xs" />
                                                        </AutoComplete>
                                                    </div>
                                                )}
                                                <Form.Item name="customer_raw" noStyle rules={[{ required: true, message: 'Customer name & address is required' }]}>
                                                    <TextArea variant="borderless" rows={3} className="p-1 text-xs font-medium" placeholder="e.g. Mr. customer Address" />
                                                </Form.Item>
                                            </td>
                                            <td className="p-2 align-top">
                                                <Form.Item name="reference" noStyle>
                                                    <Input variant="borderless" className="p-1 text-xs font-medium" placeholder="e.g. Email enquiry dated 12/07/2026" />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td colSpan={2} className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">PROPOSAL SUBJECT</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={2} className="p-1.5">
                                                <Form.Item name="subject" noStyle rules={[{ required: true, message: 'Subject line is required' }]}>
                                                    <Input variant="borderless" className="p-1 text-xs font-bold text-slate-900" placeholder="Proposal for Design, Fabrication & Testing of..." />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Card 4: Scope of Work */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>4. Scope of Work</span>
                                    <span className="bg-slate-800 text-slate-200 border border-slate-700 rounded-full font-mono text-[10px] font-bold px-2 py-0.5">
                                        {scopeItems.length} POINTS
                                    </span>
                                </div>
                                <table className="w-full border-collapse text-xs">
                                    <tbody>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">INTRODUCTORY PARAGRAPH (OPTIONAL)</td>
                                        </tr>
                                        <tr className="border-b border-slate-900">
                                            <td className="p-1.5">
                                                <Form.Item name="scope_intro" noStyle>
                                                    <TextArea variant="borderless" rows={2} className="p-1 text-xs font-medium" placeholder="With reference to your enquiry, we are pleased to submit our formal proposal..." />
                                                </Form.Item>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">SCOPE BULLET POINTS LIST</td>
                                        </tr>
                                        <tr className="border-b border-slate-900">
                                            <td className="p-3 bg-slate-50/50">
                                                {scopeItems.length === 0 ? (
                                                    <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-3">
                                                        No scope points added yet. Type a point below and press Enter or click Add Point.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 mb-3">
                                                        {scopeItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-start justify-between p-2.5 bg-white border border-slate-250 rounded-xl hover:bg-slate-50/50 transition-colors shadow-3xs">
                                                                <Text className="text-slate-800 text-xs leading-relaxed flex-1 mr-3 font-semibold">
                                                                    <span className="font-bold text-blue-600 mr-2">•</span>
                                                                    {item}
                                                                </Text>
                                                                <Button
                                                                    type="text"
                                                                    danger
                                                                    size="small"
                                                                    icon={<DeleteOutlined className="text-[10px]" />}
                                                                    onClick={() => handleRemoveScopeItem(idx)}
                                                                    className="hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Enter scope item point (press Enter or click Add)"
                                                        value={newScopeInput}
                                                        onChange={(e) => setNewScopeInput(e.target.value)}
                                                        onPressEnter={(e) => {
                                                            e.preventDefault();
                                                            handleAddScopeItem();
                                                        }}
                                                        className="rounded-xl border-slate-200 h-10 text-xs font-semibold"
                                                    />
                                                    <Button
                                                        type="primary"
                                                        ghost
                                                        icon={<PlusOutlined />}
                                                        onClick={handleAddScopeItem}
                                                        className="rounded-xl font-bold border-blue-500 text-blue-600 h-10 px-4 text-xs"
                                                    >
                                                        Add Point
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">SCOPE ATTACHMENTS & DOCUMENTS</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] text-slate-500 block leading-tight">
                                                        Upload technical specs, drawings, or annexures to consider as Proposal document attachments.
                                                    </span>
                                                    <Upload
                                                        beforeUpload={(file) => {
                                                            setScopeAttachments((prev) => [...prev, file]);
                                                            return false;
                                                        }}
                                                        showUploadList={false}
                                                        multiple
                                                    >
                                                        <Button
                                                            size="small"
                                                            type="primary"
                                                            ghost
                                                            icon={<UploadOutlined />}
                                                            className="rounded-xl text-xs border-blue-500 text-blue-600 font-bold"
                                                        >
                                                            Attach Files
                                                        </Button>
                                                    </Upload>
                                                </div>
                                                {scopeAttachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                                        {scopeAttachments.map((file, idx) => (
                                                            <div key={`${file.name}-${idx}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-blue-600">
                                                                <PaperClipOutlined className="text-slate-400 text-xs" />
                                                                <span className="max-w-[200px] truncate">{file.name}</span>
                                                                <span
                                                                    onClick={() => setScopeAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                                                    className="text-slate-400 hover:text-red-500 cursor-pointer ml-1 font-bold"
                                                                >
                                                                    ✕
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Card 5: Payment Terms and Conditions */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>5. Payment Terms and Conditions</span>
                                    <span className="bg-slate-800 text-slate-200 border border-slate-700 rounded-full font-mono text-[10px] font-bold px-2 py-0.5">
                                        {termsItems.length} CLAUSES
                                    </span>
                                </div>
                                <table className="w-full border-collapse text-xs">
                                    <tbody>
                                        <tr className="bg-slate-50 border-b border-slate-900">
                                            <td className="p-2 font-bold uppercase tracking-wider text-slate-700 text-left">TERMS & CONDITIONS (NUMBERED LIST)</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 bg-slate-50/50">
                                                {termsItems.length === 0 ? (
                                                    <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-3">
                                                        No terms & conditions added yet. Type a term below and click Add Clause.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 mb-3">
                                                        {termsItems.map((item, idx) => (
                                                            <div key={idx} className="flex items-start justify-between p-2.5 bg-white border border-slate-250 rounded-xl hover:bg-slate-50/50 transition-colors shadow-3xs">
                                                                <Text className="text-slate-800 text-xs leading-relaxed flex-1 mr-3 font-semibold">
                                                                    <span className="font-bold text-amber-600 mr-2">{idx + 1}.</span>
                                                                    {item}
                                                                </Text>
                                                                <Button
                                                                    type="text"
                                                                    danger
                                                                    size="small"
                                                                    icon={<DeleteOutlined className="text-[10px]" />}
                                                                    onClick={() => handleRemoveTermItem(idx)}
                                                                    className="hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Enter commercial or delivery clause"
                                                        value={newTermInput}
                                                        onChange={(e) => setNewTermInput(e.target.value)}
                                                        onPressEnter={(e) => {
                                                            e.preventDefault();
                                                            handleAddTermItem();
                                                        }}
                                                        className="rounded-xl border-slate-200 h-10 text-xs font-semibold"
                                                    />
                                                    <Button
                                                        type="primary"
                                                        ghost
                                                        icon={<PlusOutlined />}
                                                        onClick={handleAddTermItem}
                                                        className="rounded-xl font-bold border-amber-500 text-amber-600 h-10 px-4 text-xs"
                                                    >
                                                        Add Clause
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Card 6: Pricing & Cost Break-Up Tables */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>6.Tables</span>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<PlusOutlined className="text-[10px]" />}
                                        onClick={handleAddTable}
                                        className="rounded-lg font-bold bg-slate-800 hover:bg-slate-700 border-none text-[10px] h-7 px-2.5 text-white"
                                    >
                                        Add Table
                                    </Button>
                                </div>
                                <div className="p-3">
                                    {tables.length === 0 ? (
                                        <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                                            No breakdown tables attached. Click <strong>Add Table</strong> to insert a cost summary table.
                                        </div>
                                    ) : (
                                        tables.map((tbl, tIdx) => (
                                            <div key={tIdx} className="mb-6 p-4 border border-slate-300 bg-slate-50/50 rounded-xl space-y-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <Input
                                                        prefix={<Text className="font-extrabold text-slate-550 text-xs uppercase mr-1">Table Title:</Text>}
                                                        value={tbl.title}
                                                        onChange={(e) => handleTableTitleChange(tIdx, e.target.value)}
                                                        placeholder="e.g. Cost Break-Up Summary"
                                                        className="font-bold text-slate-800 rounded-lg border-slate-200 h-9 text-xs"
                                                    />
                                                    <Popconfirm
                                                        title="Delete Table"
                                                        description="Are you sure you want to remove this pricing table?"
                                                        onConfirm={() => handleRemoveTable(tIdx)}
                                                        okText="Yes"
                                                        cancelText="No"
                                                    >
                                                        <Button danger type="text" size="small" icon={<DeleteOutlined />} className="rounded-lg text-xs hover:bg-red-50">
                                                            Remove
                                                        </Button>
                                                    </Popconfirm>
                                                </div>

                                                {/* Column Headers setup */}
                                                <div className="space-y-1.5">
                                                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                        Column Headers ({tbl.headers.length})
                                                    </Text>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {tbl.headers.map((h, hIdx) => (
                                                            <div key={hIdx} className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-3xs">
                                                                <Input
                                                                    variant="borderless"
                                                                    size="small"
                                                                    value={h}
                                                                    onChange={(e) => handleHeaderChange(tIdx, hIdx, e.target.value)}
                                                                    className="w-24 text-[11px] font-bold text-slate-800 p-0"
                                                                />
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    danger
                                                                    icon={<DeleteOutlined style={{ fontSize: '9px' }} />}
                                                                    onClick={() => handleRemoveHeaderColumn(tIdx, hIdx)}
                                                                    className="p-0.5 flex items-center justify-center"
                                                                />
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="dashed"
                                                            size="small"
                                                            icon={<PlusOutlined />}
                                                            onClick={() => handleAddHeaderColumn(tIdx)}
                                                            className="rounded-lg text-[10px] font-bold h-6"
                                                        >
                                                            Add Col
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Rows Data Matrix */}
                                                <div className="space-y-1.5 overflow-x-auto">
                                                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                        Row Data Items ({tbl.rows.length})
                                                    </Text>
                                                    <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-slate-200 text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-100 border-b border-slate-250">
                                                                {tbl.headers.map((h, hIdx) => (
                                                                    <th key={hIdx} className="p-2 text-left font-bold text-slate-700">
                                                                        {h || `Col ${hIdx + 1}`}
                                                                    </th>
                                                                ))}
                                                                <th className="p-2 text-center w-10 font-bold text-slate-700">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tbl.rows.map((row, rIdx) => (
                                                                <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                                    {row.map((cell, cIdx) => (
                                                                        <td key={cIdx} className="p-1">
                                                                            <Input
                                                                                size="small"
                                                                                value={cell}
                                                                                onChange={(e) => handleCellChange(tIdx, rIdx, cIdx, e.target.value)}
                                                                                className="rounded-lg text-[11px] font-semibold border-slate-200"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="p-1 text-center">
                                                                        <Button
                                                                            type="text"
                                                                            danger
                                                                            size="small"
                                                                            icon={<DeleteOutlined />}
                                                                            onClick={() => handleRemoveTableRow(tIdx, rIdx)}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <Button
                                                        type="dashed"
                                                        block
                                                        icon={<PlusOutlined />}
                                                        onClick={() => handleAddTableRow(tIdx)}
                                                        className="mt-2 rounded-xl text-[11px] font-bold h-8"
                                                    >
                                                        Add Row to {tbl.title || 'Table'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Card 7: Internal Cost Estimation */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>7. Internal Cost Estimation</span>
                                    <Button
                                        type="primary"
                                        icon={<EditOutlined className="text-[10px]" />}
                                        onClick={() => setCostModalOpen(true)}
                                        className="rounded-lg font-bold bg-slate-800 hover:bg-slate-700 border-none text-[10px] h-7 px-2.5 text-white"
                                    >
                                        {internalCostTables.length === 0 ? "Add Cost ↗" : "Edit Cost ↗"}
                                    </Button>
                                </div>
                                <div className="p-3">
                                    <CostEstimationModal
                                        open={costModalOpen}
                                        onClose={() => setCostModalOpen(false)}
                                        projectId={projectId || null}
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

                                    {internalCostTables.length === 0 ? (
                                        <div className="p-5 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-2">
                                            <Text className="text-xs text-slate-500 block">No internal cost breakdown attached to this proposal.</Text>
                                            <Button
                                                type="primary"
                                                size="small"
                                                icon={<PlusOutlined />}
                                                onClick={() => setCostModalOpen(true)}
                                                className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-[11px] shadow-xs text-white"
                                            >
                                                Add Cost Breakdown ↗
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                    Cost Summary ({internalCostTables.length} {internalCostTables.length === 1 ? 'Section' : 'Sections'})
                                                </Text>
                                                <Popconfirm
                                                    title="Clear Internal Cost Breakdown?"
                                                    description="This will remove all internal cost tables attached to this proposal draft."
                                                    onConfirm={() => {
                                                        setInternalCostTables([]);
                                                        setRawStudioHeaders([]);
                                                    }}
                                                    okText="Clear"
                                                    cancelText="Cancel"
                                                    okButtonProps={{ danger: true, size: "small" }}
                                                >
                                                    <Button danger type="text" size="small" icon={<DeleteOutlined style={{ fontSize: 10 }} />} className="text-xs font-semibold">
                                                        Clear
                                                    </Button>
                                                </Popconfirm>
                                            </div>

                                            <div className="overflow-hidden border border-slate-200/90 rounded-xl bg-white shadow-3xs">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="py-2 px-3 font-bold text-slate-600">Ref</th>
                                                            <th className="py-2 px-3 font-bold text-slate-600">Cost Section Category</th>
                                                            <th className="py-2 px-3 font-bold text-slate-600 text-center">Items</th>
                                                            <th className="py-2 px-3 font-bold text-slate-600 text-right">Subtotal (₹)</th>
                                                            <th className="py-2 px-3 font-bold text-slate-600 text-center w-16">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {internalCostTables.map((tbl, idx) => {
                                                            const letter = String.fromCharCode(65 + idx);
                                                            const subtotal = getTableSubtotal(tbl);
                                                            return (
                                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                                    <td className="py-2 px-3 font-bold text-purple-700">Section {letter}</td>
                                                                    <td className="py-2 px-3 font-semibold text-slate-800">{tbl.title || `Section ${letter}`}</td>
                                                                    <td className="py-2 px-3 text-center font-medium text-slate-500">{tbl.rows?.length || 0}</td>
                                                                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                                        ₹ {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <Button
                                                                            type="link"
                                                                            size="small"
                                                                            icon={<EditOutlined style={{ fontSize: 10 }} />}
                                                                            onClick={() => setCostModalOpen(true)}
                                                                            className="text-purple-600 hover:text-purple-800 p-0 text-xs font-bold"
                                                                        >
                                                                            Edit
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                                        <tr>
                                                            <td colSpan={3} className="py-2 px-3 font-bold text-slate-700 text-right">
                                                                Grand Total Estimated Cost:
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-extrabold text-purple-700 text-[13px]">
                                                                ₹ {grandInternalTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card 8: Signatories & Approvals */}
                            <div className="border border-slate-900 bg-white mb-6">
                                <div className="bg-[#0F172A] text-white p-3 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>8. Signatories & Approvals</span>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<PlusOutlined className="text-[10px]" />}
                                        onClick={handleAddSignatory}
                                        className="rounded-lg font-bold bg-slate-800 hover:bg-slate-700 border-none text-[10px] h-7 px-2.5 text-white"
                                    >
                                        Add Signatory
                                    </Button>
                                </div>
                                <div className="p-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {signatories.map((sig, sIdx) => (
                                            <div key={sIdx} className="p-4 bg-slate-50/50 rounded-xl border border-slate-200 space-y-3 shadow-3xs">
                                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                                    <span className="font-extrabold text-slate-700 text-[10px] uppercase tracking-wider">
                                                        Signatory #{sIdx + 1}
                                                    </span>
                                                    <Space size="small">
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            icon={<ReloadOutlined style={{ fontSize: 10 }} />}
                                                            onClick={() => {
                                                                try {
                                                                    const rawUser = window.localStorage.getItem('ppm_user');
                                                                    if (rawUser) {
                                                                        const parsedUser = JSON.parse(rawUser);
                                                                        const desig = getUserDesignation();
                                                                        const center = getUserCenter();
                                                                        const lines = [desig, center, 'CMTI, Bengaluru'].filter(Boolean).join('\n');
                                                                        const updated = [...signatories];
                                                                        updated[sIdx] = {
                                                                            name: parsedUser.name || updated[sIdx].name,
                                                                            lines_raw: lines,
                                                                        };
                                                                        setSignatories(updated);
                                                                        message.info('Populated signatory details from logged-in account');
                                                                    }
                                                                } catch (e) {
                                                                    message.warning('Could not read user account details');
                                                                }
                                                            }}
                                                            className="p-0 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                                                        >
                                                            Fill My Profile
                                                        </Button>
                                                        {signatories.length > 1 && (
                                                            <Button
                                                                type="text"
                                                                danger
                                                                size="small"
                                                                icon={<DeleteOutlined className="text-[10px]" />}
                                                                onClick={() => handleRemoveSignatory(sIdx)}
                                                                className="hover:bg-red-50 rounded-lg"
                                                            />
                                                        )}
                                                    </Space>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                                                        Signatory Name
                                                    </span>
                                                    <Input
                                                        placeholder="e.g. Dr. Rajesh Kumar"
                                                        value={sig.name}
                                                        onChange={(e) => handleSignatoryChange(sIdx, 'name', e.target.value)}
                                                        className="rounded-lg border-slate-200 h-9 text-xs font-semibold"
                                                    />
                                                </div>

                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 block">
                                                        Designation Line(s) (One per line)
                                                    </span>
                                                    <TextArea
                                                        rows={2}
                                                        placeholder="Scientist-D&#10;C-SMPM&#10;CMTI, Bengaluru"
                                                        value={sig.lines_raw}
                                                        onChange={(e) => handleSignatoryChange(sIdx, 'lines_raw', e.target.value)}
                                                        className="rounded-lg border-slate-200 text-xs font-medium p-2"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex justify-end gap-3 select-none border-t border-slate-100 pt-3">
                                        <Button
                                            size="large"
                                            icon={<DownloadOutlined />}
                                            loading={loading && !addToProposalsLoading}
                                            onClick={() => {
                                                setActionType('download');
                                                form.submit();
                                            }}
                                            className="rounded-xl h-11 px-5 text-xs font-bold border-slate-350 text-slate-700 hover:text-blue-600 hover:border-blue-500"
                                        >
                                            Export DOCX
                                        </Button>
                                        <Button
                                            type="primary"
                                            size="large"
                                            icon={<PlusOutlined />}
                                            loading={addToProposalsLoading}
                                            onClick={() => {
                                                setActionType('addToProposals');
                                                form.submit();
                                            }}
                                            className="bg-[#16A34A] hover:bg-[#15803D] border-none rounded-xl h-11 px-5 text-xs font-bold text-white shadow-sm"
                                        >
                                            Add to Proposals
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Col>

                        {/* Right Column: Live A4 Document Preview & Quick Export Sidebar (9 Cols on desktop) */}
                        {previewVisible && (
                            <Col xs={24} lg={9} xl={9} className="space-y-6">
                                <div className="sticky top-6 space-y-6">

                                    {/* Document Preview Toolbar & Container */}
                                    <Card
                                        title={
                                            <div className="flex items-center justify-between py-1">
                                                <Space className="text-slate-900 font-bold text-base">
                                                    <EyeOutlined className="text-blue-600" /> Live Document Preview
                                                </Space>
                                                <Space size="xs">
                                                    <Tooltip title="Zoom Out">
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<CompressOutlined />}
                                                            onClick={() => setPreviewZoom(Math.max(70, previewZoom - 10))}
                                                            className="hover:bg-slate-200/60 rounded-lg"
                                                        />
                                                    </Tooltip>
                                                    <Text className="text-xs font-mono font-bold text-slate-600 px-1">{previewZoom}%</Text>
                                                    <Tooltip title="Zoom In">
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<ExpandOutlined />}
                                                            onClick={() => setPreviewZoom(Math.min(130, previewZoom + 10))}
                                                            className="hover:bg-slate-200/60 rounded-lg"
                                                        />
                                                    </Tooltip>
                                                </Space>
                                            </div>
                                        }
                                        className="shadow-xl rounded-2xl border border-slate-200/90 bg-slate-900/5 backdrop-blur-xs overflow-hidden"
                                        styles={{ body: { padding: '16px' } }}
                                    >
                                        {/* Simulated A4 Paper Card */}
                                        <div
                                            className="bg-white rounded-xl p-8 shadow-2xl border border-slate-200/90 transition-transform duration-200 overflow-y-auto max-h-[calc(100vh-220px)] min-h-[580px] space-y-5 font-sans text-xs text-slate-800 select-none"
                                            style={{
                                                transform: `scale(${previewZoom / 100})`,
                                                transformOrigin: 'top center',
                                            }}
                                        >
                                            {/* Document Right Header */}
                                            <div className="text-right text-slate-600 space-y-1 border-b border-slate-100 pb-3.5">
                                                <div className="font-bold text-xs text-slate-900">Date: {formValues.date || new Date().toLocaleDateString('en-GB')}</div>
                                                {formValues.dept && <div className="font-bold text-blue-700 text-xs">Dept: {formValues.dept}</div>}
                                            </div>

                                            {/* Emails & Contact */}
                                            {(formValues.email_to || formValues.email_cc || formValues.phone) && (
                                                <div className="space-y-1 bg-slate-50/90 p-3 rounded-xl border border-slate-200/80 font-mono text-[11px]">
                                                    {formValues.email_to && (
                                                        <div>
                                                            <strong className="text-slate-700">Email: </strong>
                                                            <span className="text-blue-600 font-semibold">{formValues.email_to}</span>
                                                        </div>
                                                    )}
                                                    {formValues.email_cc && (
                                                        <div>
                                                            <strong className="text-slate-700">Cc: </strong>
                                                            <span className="text-blue-600 font-semibold">{formValues.email_cc}</span>
                                                        </div>
                                                    )}
                                                    {formValues.phone && (
                                                        <div>
                                                            <strong className="text-slate-700">Phone: </strong>
                                                            <span className="text-blue-600 font-semibold">{formValues.phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Heading */}
                                            <div className="text-center font-black text-sm text-slate-900 tracking-wider uppercase py-1.5 border-b-2 border-slate-900">
                                                PROPOSAL INFORMATION
                                            </div>

                                            {/* Customer Information */}
                                            {formValues.customer_raw && (
                                                <div>
                                                    <div className="font-bold text-slate-900 text-xs mb-1">Customer:</div>
                                                    <div className="whitespace-pre-line text-slate-700 pl-3 border-l-2 border-blue-500 font-sans leading-relaxed">
                                                        {formValues.customer_raw}
                                                    </div>
                                                </div>
                                            )}

                                            {formValues.kind_attention && (
                                                <div className="flex items-start gap-1">
                                                    <span className="font-bold text-slate-900 shrink-0">Kind Attention: </span>
                                                    <span className="text-slate-700 font-medium whitespace-pre-line">{formValues.kind_attention}</span>
                                                </div>
                                            )}

                                            {formValues.reference && (
                                                <div>
                                                    <span className="font-bold text-slate-900">Reference: </span>
                                                    <span className="text-slate-700 font-medium">{formValues.reference}</span>
                                                </div>
                                            )}

                                            {formValues.subject && (
                                                <div>
                                                    <span className="font-bold text-slate-900">Subject: </span>
                                                    <span className="text-slate-900 font-bold">{formValues.subject}</span>
                                                </div>
                                            )}

                                            {formValues.sac_code && (
                                                <div>
                                                    <span className="font-bold text-slate-900">SAC Code: </span>
                                                    <span className="text-slate-700 font-medium">{formValues.sac_code}</span>
                                                </div>
                                            )}

                                            {/* Scope of Work */}
                                            {(formValues.scope_intro || scopeItems.length > 0) && (
                                                <div className="space-y-2 pt-3 border-t border-slate-200">
                                                    <div className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Scope of Work:</div>
                                                    {formValues.scope_intro && (
                                                        <p className="text-slate-700 leading-relaxed italic m-0">{formValues.scope_intro}</p>
                                                    )}
                                                    {scopeItems.length > 0 && (
                                                        <ul className="list-disc list-inside space-y-1.5 text-slate-700 pl-1">
                                                            {scopeItems.map((item, i) => (
                                                                <li key={i} className="leading-relaxed">{item}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}

                                            {/* Terms & Conditions */}
                                            {termsItems.length > 0 && (
                                                <div className="space-y-2 pt-3 border-t border-slate-200">
                                                    <div className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Payment Terms & Conditions:</div>
                                                    <ol className="list-decimal list-inside space-y-1.5 text-slate-700 pl-1">
                                                        {termsItems.map((item, i) => (
                                                            <li key={i} className="leading-relaxed">{item}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}

                                            {/* Cost Tables Preview */}
                                            {tables.length > 0 && (
                                                <div className="space-y-3 pt-3 border-t border-slate-200">
                                                    {tables.map((t, idx) => (
                                                        <div key={idx} className="space-y-1.5">
                                                            {t.title && <div className="font-bold text-slate-800 text-xs">{t.title}</div>}
                                                            <table className="w-full border-collapse border border-slate-300 text-[10px]">
                                                                <thead>
                                                                    <tr className="bg-slate-100">
                                                                        {t.headers.map((h, hIdx) => (
                                                                            <th key={hIdx} className="border border-slate-300 p-1.5 font-bold text-slate-900 text-left">
                                                                                {h}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {t.rows.map((r, rIdx) => (
                                                                        <tr key={rIdx}>
                                                                            {r.map((cell, cIdx) => (
                                                                                <td key={cIdx} className="border border-slate-300 p-1.5 text-slate-700 font-medium">
                                                                                    {cell}
                                                                                </td>
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
                                                <div className="pt-8 border-t border-slate-300">
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-right">
                                                        {signatories.map((sig, i) => (
                                                            <div key={i} className="space-y-0.5">
                                                                {sig.name && <div className="font-extrabold text-slate-900 text-xs">{sig.name},</div>}
                                                                {sig.lines_raw && (
                                                                    <div className="whitespace-pre-line text-slate-600 text-[11px] leading-snug">
                                                                        {sig.lines_raw}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Action Floating CTA Panel */}
                                    <Card
                                        className="shadow-xl rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                        styles={{ body: { padding: '20px' } }}
                                    >
                                        <div className="space-y-3">
                                            <Row gutter={[12, 12]}>
                                                <Col xs={24} sm={12}>
                                                    <Button
                                                        type="primary"
                                                        size="large"
                                                        block
                                                        icon={<DownloadOutlined />}
                                                        loading={loading && !addToProposalsLoading}
                                                        onClick={() => {
                                                            setActionType('download');
                                                            form.submit();
                                                        }}
                                                        className="bg-[#2563EB] hover:bg-[#1E40AF] rounded-xl h-12 text-sm font-extrabold shadow-md hover:shadow-lg transition-all duration-200 border-none"
                                                    >
                                                        Generate DOCX
                                                    </Button>
                                                </Col>
                                                <Col xs={24} sm={12}>
                                                    <Button
                                                        type="primary"
                                                        size="large"
                                                        block
                                                        icon={<PlusOutlined />}
                                                        loading={addToProposalsLoading}
                                                        onClick={() => {
                                                            setActionType('addToProposals');
                                                            form.submit();
                                                        }}
                                                        className="bg-[#16A34A] hover:bg-[#15803D] rounded-xl h-12 text-sm font-extrabold shadow-md hover:shadow-lg transition-all duration-200 border-none"
                                                    >
                                                        Add to Proposals
                                                    </Button>
                                                </Col>
                                            </Row>

                                            <Text className="text-center block text-slate-400 text-xs">
                                                Streams official <code className="text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">.docx</code> directly or auto-fills into Proposal entry.
                                            </Text>
                                        </div>
                                    </Card>
                                </div>
                            </Col>
                        )}
                    </Row>
                </Form>
            </div>
        </div>
    );
}
