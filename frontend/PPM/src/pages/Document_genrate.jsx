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
    EyeOutlined,
    CompressOutlined,
    ExpandOutlined,
    ApartmentOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

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

export default function DocumentGenerate() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(100);

    // Dynamic state for Scope Bullet Points & Attachments
    const [scopeItems, setScopeItems] = useState([]);
    const [newScopeInput, setNewScopeInput] = useState('');
    const [scopeAttachments, setScopeAttachments] = useState([]);

    // Dynamic state for Terms Bullet Points (Starts empty)
    const [termsItems, setTermsItems] = useState([]);
    const [newTermInput, setNewTermInput] = useState('');

    // Dynamic state for Pricing Tables (Starts empty)
    const [tables, setTables] = useState([]);

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
                const res = await axios.get(`${API_BASE_URL}/customers/from-proposals`);
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    setCustomerSuggestions(res.data);
                } else {
                    const resFallback = await axios.get(`${API_BASE_URL}/customers/`);
                    if (resFallback.data && Array.isArray(resFallback.data)) {
                        setCustomerSuggestions(
                            resFallback.data.map((c) => ({
                                ...c,
                                addresses: c.address ? [c.address] : [],
                            }))
                        );
                    }
                }
            } catch (err) {
                console.error('Error loading customer suggestions:', err);
            }
        };
        fetchCustomers();
    }, [form]);

    // Handle searching customers by name, address, email or phone
    const handleCustomerSearch = (searchText) => {
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

            form.setFieldsValue({
                customer_raw: formatted,
                email_to: c.email || form.getFieldValue('email_to') || '',
                kind_attention: c.alternate_contact_details || form.getFieldValue('kind_attention') || '',
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
                customer_lines,
                kind_attention: values.kind_attention || '',
                reference: values.reference || '',
                subject: values.subject || '',
                sac_code: values.sac_code || '',
                scope_intro: values.scope_intro || '',
                scope_items: scopeItems,
                terms_items: termsItems,
                tables: tables,
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
                // Ensure kind_attention name (e.g. Manjunath) does not populate alternate_contact_details number field
                if (extractedData.alternate_contact_details && values.kind_attention) {
                    const altStr = String(extractedData.alternate_contact_details).trim().toLowerCase();
                    const kindStr = String(values.kind_attention).trim().toLowerCase();
                    if (altStr === kindStr || kindStr.includes(altStr) || altStr.includes(kindStr)) {
                        extractedData.alternate_contact_details = '';
                    }
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
            <div className="max-w-7xl mx-auto mb-8 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <FileWordOutlined className="text-blue-600" />
                    <span>Document Studio</span>
                    <span>/</span>
                    <span className="text-slate-700">Proposal Generator</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight m-0">
                                Official Document Studio
                            </h1>
                            <Tag className="bg-blue-50 text-blue-700 border-blue-200 font-bold rounded-full px-3 py-0.5 text-xs">
                                PRO DOCUMENT V2.0
                            </Tag>
                        </div>
                        <p className="text-slate-500 text-sm m-0">
                            Build, format, and stream enterprise proposal documents with real-time A4 preview and instant proposal extraction.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Live Completion Progress Widget */}
                        <div className="hidden sm:flex flex-col items-end gap-1 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200/80">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Document Readiness: <strong className="text-blue-600">{progressPercent}%</strong>
                            </span>
                            <Progress
                                percent={progressPercent}
                                size="small"
                                showInfo={false}
                                strokeColor={{ '0%': '#2563EB', '100%': '#16A34A' }}
                                className="w-36 m-0"
                            />
                        </div>

                        <Button
                            type="primary"
                            size="large"
                            icon={<DownloadOutlined />}
                            loading={loading && !addToProposalsLoading}
                            onClick={() => {
                                setActionType('download');
                                form.submit();
                            }}
                            className="bg-[#2563EB] hover:bg-[#1E40AF] border-none rounded-xl h-11 px-6 font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                        >
                            Export DOCX
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Studio Workspace Grid: Left Column Editor | Right Column Live Preview */}
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
                        {/* Left Column: Input Form Studio (15 Cols on desktop) */}
                        <Col xs={24} lg={15} xl={15} className="space-y-6">

                            {/* Card 1: Basic Metadata & Template Settings */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                                                <FileWordOutlined className="text-lg" />
                                            </div>
                                            <span>1. Document Metadata & Header Settings</span>
                                        </Space>
                                        <Tag className="bg-slate-100 text-slate-600 border-slate-200 rounded-full font-mono text-[11px] font-bold px-3 py-0.5">
                                            SECTION 01
                                        </Tag>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                <p className="text-slate-500 text-xs mb-5 block m-0">
                                    Specify document header attributes including issue date, department center code, and target export filename.
                                </p>

                                <Row gutter={[16, 16]}>
                                    <Col xs={24} sm={12} md={6}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Proposal Date <span className="text-red-500">*</span></span>}
                                            name="date"
                                            rules={[{ required: true, message: 'Date is required' }]}
                                        >
                                            <Input
                                                prefix={<CalendarOutlined className="text-slate-400" />}
                                                placeholder="DD/MM/YYYY"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} sm={12} md={6}>
                                        <Form.Item
                                            label={
                                                <Space size={4}>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Dept / Division</span>
                                                    <Tooltip title="Auto-fetched from logged-in account user center. Click reload to refresh.">
                                                        <InfoCircleOutlined className="text-slate-400 text-xs" />
                                                    </Tooltip>
                                                </Space>
                                            }
                                            name="dept"
                                        >
                                            <Input
                                                prefix={<ApartmentOutlined className="text-slate-400" />}
                                                placeholder="e.g. C-SMPM"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                                suffix={
                                                    <Tooltip title="Re-sync with logged-in user center">
                                                        <ReloadOutlined
                                                            className="cursor-pointer text-blue-600 hover:text-blue-800 transition-colors"
                                                            onClick={() => {
                                                                const c = getUserCenter();
                                                                if (c) {
                                                                    form.setFieldsValue({ dept: c });
                                                                    message.info(`Updated department code to ${c}`);
                                                                } else {
                                                                    message.warning('No user center found in current account');
                                                                }
                                                            }}
                                                        />
                                                    </Tooltip>
                                                }
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} sm={12} md={6}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Save Filename</span>}
                                            name="filename"
                                        >
                                            <Input
                                                placeholder="Proposal_Name.docx"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} sm={12} md={6}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">SAC Code</span>}
                                            name="sac_code"
                                        >
                                            <Input
                                                placeholder="e.g. 998313"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Card 2: Email & Distribution List */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-2xs">
                                                <MailOutlined className="text-lg" />
                                            </div>
                                            <span>2. Distribution & Email List</span>
                                        </Space>
                                        <Tag className="bg-indigo-50 text-indigo-700 border-indigo-200 rounded-full font-mono text-[11px] font-bold px-3 py-0.5">
                                            SECTION 02
                                        </Tag>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                <p className="text-slate-500 text-xs mb-5 block m-0">
                                    Primary and copy email addresses to embed into the official Proposal header metadata block.
                                </p>

                                <Row gutter={[16, 16]}>
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Email - To (Comma separated)</span>}
                                            name="email_to"
                                        >
                                            <Input
                                                prefix={<MailOutlined className="text-slate-400" />}
                                                placeholder="client@company.com, purchase@company.com"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Email - Cc (Comma separated)</span>}
                                            name="email_cc"
                                        >
                                            <Input
                                                prefix={<MailOutlined className="text-slate-400" />}
                                                placeholder="head@cmti.res.in, accounts@cmti.res.in"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Card 3: Customer Information & Subject */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                                                <BankOutlined className="text-lg" />
                                            </div>
                                            <span>3. Customer & Proposal Context</span>
                                        </Space>
                                        <Tag className="bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full font-mono text-[11px] font-bold px-3 py-0.5">
                                            SECTION 03
                                        </Tag>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} md={12}>
                                        <div className="mb-3 space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/90">
                                            <div>
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                                                    <BankOutlined className="text-emerald-600" /> Customer Name (Search Database)
                                                </span>
                                                <AutoComplete
                                                    options={customerOptions}
                                                    onSearch={handleCustomerSearch}
                                                    onSelect={handleCustomerSelect}
                                                    placeholder="Search existing customers..."
                                                    style={{ width: '100%' }}
                                                >
                                                    <Input
                                                        placeholder="Search customer name..."
                                                        size="large"
                                                        className="rounded-xl border-slate-200 hover:border-emerald-500 focus:border-emerald-500 h-10 text-xs font-medium"
                                                        allowClear
                                                    />
                                                </AutoComplete>
                                            </div>

                                            {addressOptions.length > 0 && (
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                                                        <BankOutlined className="text-blue-600" /> Address Options
                                                    </span>
                                                    <AutoComplete
                                                        options={addressOptions}
                                                        onSelect={handleAddressSelect}
                                                        placeholder="Type or select address..."
                                                        style={{ width: '100%' }}
                                                    >
                                                        <Input
                                                            placeholder="Select address..."
                                                            size="large"
                                                            className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-10 text-xs font-medium"
                                                            allowClear
                                                        />
                                                    </AutoComplete>
                                                </div>
                                            )}
                                        </div>

                                        <Form.Item
                                            label={
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                                    Customer Name & Address <span className="text-red-500">*</span>
                                                </span>
                                            }
                                            name="customer_raw"
                                            rules={[{ required: true, message: 'Customer details are required' }]}
                                            tooltip="Line 1: Company / Client Name. Following lines: Street address & Pincode."
                                        >
                                            <TextArea
                                                rows={4}
                                                placeholder="M/s. ABC Industries Ltd.&#10;Plot No. 45, Industrial Area&#10;Bengaluru - 560058"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 text-sm font-medium p-3"
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Kind Attention</span>}
                                            name="kind_attention"
                                        >
                                            <Input
                                                placeholder="e.g. Mr. Rajesh Sharma (General Manager)"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Reference</span>}
                                            name="reference"
                                        >
                                            <Input
                                                placeholder="e.g. Email enquiry dated 12/07/2026"
                                                size="large"
                                                className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item
                                    label={
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                            Proposal Subject <span className="text-red-500">*</span>
                                        </span>
                                    }
                                    name="subject"
                                    rules={[{ required: true, message: 'Subject line is required' }]}
                                    tooltip="Wrap text with **double asterisks** to emphasize figures or key text in bold."
                                >
                                    <Input
                                        prefix={<FileTextOutlined className="text-slate-400" />}
                                        placeholder="Proposal for Design, Fabrication & Testing of..."
                                        size="large"
                                        className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-semibold text-slate-900"
                                    />
                                </Form.Item>
                            </Card>

                            {/* Card 4: Scope of Work */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100 shadow-2xs">
                                                <FileTextOutlined className="text-lg" />
                                            </div>
                                            <span>4. Scope of Work</span>
                                        </Space>
                                        <Tag className="bg-cyan-50 text-cyan-700 border-cyan-200 rounded-full font-mono text-[11px] font-bold px-3 py-0.5">
                                            {scopeItems.length} POINTS
                                        </Tag>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                <Form.Item
                                    label={<span className="text-xs font-bold uppercase tracking-wider text-slate-700">Introductory Paragraph (Optional)</span>}
                                    name="scope_intro"
                                >
                                    <TextArea
                                        rows={2}
                                        placeholder="With reference to your enquiry, we are pleased to submit our formal technical & financial Proposal..."
                                        className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 text-sm font-medium p-3"
                                    />
                                </Form.Item>

                                <Divider orientation="left" style={{ margin: '20px 0 14px 0', fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Scope Bullet Points List
                                </Divider>

                                {scopeItems.length === 0 ? (
                                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-4">
                                        No scope points added yet. Type a point below and click <strong>Add Point</strong>.
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 mb-4">
                                        {scopeItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 hover:bg-slate-100/70 transition-colors"
                                            >
                                                <Text className="text-slate-800 text-sm leading-relaxed flex-1 mr-3 font-medium">
                                                    <span className="font-bold text-blue-600 mr-2.5">•</span>
                                                    {item}
                                                </Text>
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveScopeItem(idx)}
                                                    className="hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Row gutter={8}>
                                    <Col flex="auto">
                                        <Input
                                            placeholder="Enter scope item point (use **text** for bold)"
                                            value={newScopeInput}
                                            onChange={(e) => setNewScopeInput(e.target.value)}
                                            onPressEnter={(e) => {
                                                e.preventDefault();
                                                handleAddScopeItem();
                                            }}
                                            size="large"
                                            className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                        />
                                    </Col>
                                    <Col flex="none">
                                        <Button
                                            type="primary"
                                            ghost
                                            icon={<PlusOutlined />}
                                            onClick={handleAddScopeItem}
                                            size="large"
                                            className="rounded-xl font-semibold border-blue-500 text-blue-600 h-11 px-5"
                                        >
                                            Add Point
                                        </Button>
                                    </Col>
                                </Row>

                                {/* Scope Attachments Section */}
                                <Divider orientation="left" style={{ margin: '24px 0 14px 0', fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Scope Attachments & Documents
                                </Divider>

                                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4.5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Space className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            <PaperClipOutlined className="text-blue-500 text-sm" />
                                            <span>Attach Proposal Documents / Annexures</span>
                                        </Space>

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
                                                className="rounded-lg text-xs border-blue-500 text-blue-600 font-semibold"
                                            >
                                                Attach Files
                                            </Button>
                                        </Upload>
                                    </div>

                                    <Text className="text-slate-500 text-[11px] block">
                                        Upload technical specs, drawings, or annexures to consider as Proposal document attachments.
                                    </Text>

                                    {scopeAttachments.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200/80">
                                            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-600">
                                                <PaperClipOutlined className="text-slate-500 text-sm" />
                                                <span>Attached Documents ({scopeAttachments.length})</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {scopeAttachments.map((file, idx) => (
                                                    <div
                                                        key={`${file.name}-${idx}`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs text-blue-600"
                                                    >
                                                        <PaperClipOutlined className="text-slate-400 text-xs" />
                                                        <span className="max-w-[200px] truncate" title={file.name}>
                                                            {file.name}
                                                        </span>
                                                        <span
                                                            onClick={() => setScopeAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                                            className="text-slate-400 hover:text-red-500 cursor-pointer ml-1 font-bold text-xs"
                                                        >
                                                            ✕
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {/* Card 5: Terms & Conditions */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
                                                <CheckCircleOutlined className="text-lg" />
                                            </div>
                                            <span>5.Payment Terms and Conditions</span>
                                        </Space>
                                        <Tag className="bg-amber-50 text-amber-700 border-amber-200 rounded-full font-mono text-[11px] font-bold px-3 py-0.5">
                                            {termsItems.length} CLAUSES
                                        </Tag>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                {termsItems.length === 0 ? (
                                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-4">
                                        No terms & conditions added yet. Type a term below and click <strong>Add Clause</strong>.
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 mb-4">
                                        {termsItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/90 hover:bg-slate-100/70 transition-colors"
                                            >
                                                <Text className="text-slate-800 text-sm leading-relaxed flex-1 mr-3 font-medium">
                                                    <span className="font-bold text-amber-600 mr-2.5">{idx + 1}.</span>
                                                    {item}
                                                </Text>
                                                <Button
                                                    type="text"
                                                    danger
                                                    size="small"
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleRemoveTermItem(idx)}
                                                    className="hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Row gutter={8}>
                                    <Col flex="auto">
                                        <Input
                                            placeholder="Enter commercial or delivery clause"
                                            value={newTermInput}
                                            onChange={(e) => setNewTermInput(e.target.value)}
                                            onPressEnter={(e) => {
                                                e.preventDefault();
                                                handleAddTermItem();
                                            }}
                                            size="large"
                                            className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-medium"
                                        />
                                    </Col>
                                    <Col flex="none">
                                        <Button
                                            type="primary"
                                            ghost
                                            icon={<PlusOutlined />}
                                            onClick={handleAddTermItem}
                                            size="large"
                                            className="rounded-xl font-semibold border-amber-500 text-amber-600 h-11 px-5"
                                        >
                                            Add Clause
                                        </Button>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Card 6: Dynamic Tables Studio */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-2xs">
                                                <PrinterOutlined className="text-lg" />
                                            </div>
                                            <span>6. Pricing & Cost Break-Up Tables</span>
                                        </Space>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<PlusOutlined />}
                                            onClick={handleAddTable}
                                            className="rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 h-8 px-3 text-xs shadow-xs"
                                        >
                                            Add Table
                                        </Button>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                {tables.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        No breakdown tables attached. Click <strong>Add Table</strong> to insert a cost summary table.
                                    </div>
                                ) : (
                                    tables.map((tbl, tIdx) => (
                                        <div
                                            key={tIdx}
                                            className="p-5 mb-6 bg-slate-50/70 rounded-2xl border border-slate-200/90 space-y-4 shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <Input
                                                    prefix={<Text className="font-bold text-slate-500 text-xs uppercase mr-1">Table Title:</Text>}
                                                    value={tbl.title}
                                                    onChange={(e) => handleTableTitleChange(tIdx, e.target.value)}
                                                    placeholder="e.g. Cost Break-Up Summary"
                                                    className="font-bold text-slate-800 rounded-xl border-slate-200 h-11 text-sm"
                                                    size="large"
                                                />
                                                <Popconfirm
                                                    title="Delete Table"
                                                    description="Are you sure you want to remove this pricing table?"
                                                    onConfirm={() => handleRemoveTable(tIdx)}
                                                    okText="Yes"
                                                    cancelText="No"
                                                >
                                                    <Button danger type="text" icon={<DeleteOutlined />} className="rounded-lg">
                                                        Remove
                                                    </Button>
                                                </Popconfirm>
                                            </div>

                                            {/* Column Headers setup */}
                                            <div className="space-y-2">
                                                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                                    Column Headers ({tbl.headers.length})
                                                </Text>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {tbl.headers.map((h, hIdx) => (
                                                        <div
                                                            key={hIdx}
                                                            className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-2xs"
                                                        >
                                                            <Input
                                                                variant="borderless"
                                                                size="small"
                                                                value={h}
                                                                onChange={(e) => handleHeaderChange(tIdx, hIdx, e.target.value)}
                                                                className="w-28 text-xs font-bold text-slate-800"
                                                            />
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined style={{ fontSize: '10px' }} />}
                                                                onClick={() => handleRemoveHeaderColumn(tIdx, hIdx)}
                                                            />
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="dashed"
                                                        size="small"
                                                        icon={<PlusOutlined />}
                                                        onClick={() => handleAddHeaderColumn(tIdx)}
                                                        className="rounded-xl text-xs font-semibold"
                                                    >
                                                        Add Column
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Rows Data Matrix */}
                                            <div className="space-y-2 overflow-x-auto">
                                                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                                    Row Data Items ({tbl.rows.length})
                                                </Text>
                                                <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-slate-200 text-sm shadow-2xs">
                                                    <thead>
                                                        <tr className="bg-slate-100/90 border-b border-slate-200">
                                                            {tbl.headers.map((h, hIdx) => (
                                                                <th key={hIdx} className="p-3 text-left text-xs font-bold text-slate-700">
                                                                    {h || `Col ${hIdx + 1}`}
                                                                </th>
                                                            ))}
                                                            <th className="p-3 text-center w-12 text-xs font-bold text-slate-700">
                                                                Action
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tbl.rows.map((row, rIdx) => (
                                                            <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                                                {row.map((cell, cIdx) => (
                                                                    <td key={cIdx} className="p-2">
                                                                        <Input
                                                                            size="small"
                                                                            value={cell}
                                                                            onChange={(e) =>
                                                                                handleCellChange(tIdx, rIdx, cIdx, e.target.value)
                                                                            }
                                                                            className="rounded-lg text-xs font-medium border-slate-200"
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
                                                    className="mt-2 rounded-xl text-xs font-semibold h-9"
                                                >
                                                    Add Row to {tbl.title || 'Table'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </Card>

                            {/* Card 7: Signatories & Approval Blocks */}
                            <Card
                                title={
                                    <div className="flex items-center justify-between py-1">
                                        <Space className="text-slate-900 font-bold text-base sm:text-lg">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                                                <UserOutlined className="text-lg" />
                                            </div>
                                            <span>7. Signatory & Approval Blocks</span>
                                        </Space>
                                        <Button
                                            type="primary"
                                            ghost
                                            icon={<PlusOutlined />}
                                            onClick={handleAddSignatory}
                                            size="small"
                                            className="rounded-xl font-semibold border-blue-500 text-blue-600"
                                        >
                                            + Add Signatory
                                        </Button>
                                    </div>
                                }
                                className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/90 bg-white overflow-hidden"
                                styles={{ body: { padding: '24px' } }}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {signatories.map((sig, sIdx) => (
                                        <div
                                            key={sIdx}
                                            className="p-4.5 bg-slate-50/70 rounded-2xl border border-slate-200/90 space-y-3 relative shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                                                    Signatory #{sIdx + 1}
                                                </span>
                                                <Space>
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        icon={<ReloadOutlined />}
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
                                                        className="p-0 text-xs font-bold text-blue-600 hover:text-blue-800"
                                                    >
                                                        Fill My Profile
                                                    </Button>
                                                    {signatories.length > 1 && (
                                                        <Button
                                                            type="text"
                                                            danger
                                                            size="small"
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => handleRemoveSignatory(sIdx)}
                                                        />
                                                    )}
                                                </Space>
                                            </div>

                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 block">
                                                    Signatory Name
                                                </span>
                                                <Input
                                                    placeholder="e.g. Dr. Rajesh Kumar"
                                                    value={sig.name}
                                                    onChange={(e) =>
                                                        handleSignatoryChange(sIdx, 'name', e.target.value)
                                                    }
                                                    size="large"
                                                    className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 h-11 text-sm font-semibold"
                                                />
                                            </div>

                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 block">
                                                    Designation Line(s) (One per line)
                                                </span>
                                                <TextArea
                                                    rows={3}
                                                    placeholder="Scientist-D&#10;C-SMPM&#10;CMTI, Bengaluru"
                                                    value={sig.lines_raw}
                                                    onChange={(e) =>
                                                        handleSignatoryChange(sIdx, 'lines_raw', e.target.value)
                                                    }
                                                    className="rounded-xl border-slate-200 hover:border-blue-500 focus:border-blue-500 text-sm font-medium p-3"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex justify-start">
                                    <Button
                                        type="dashed"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddSignatory}
                                        size="large"
                                        className="rounded-xl border-blue-500 text-blue-600 font-semibold h-11 px-5"
                                    >
                                        Add Another Signatory
                                    </Button>
                                </div>
                            </Card>
                        </Col>

                        {/* Right Column: Live A4 Document Preview & Quick Export Sidebar (9 Cols on desktop) */}
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

                                        {/* Emails */}
                                        {(formValues.email_to || formValues.email_cc) && (
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
                                            <div>
                                                <span className="font-bold text-slate-900">Kind Attention: </span>
                                                <span className="text-slate-700 font-medium">{formValues.kind_attention}</span>
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
                    </Row>
                </Form>
            </div>
        </div>
    );
}
