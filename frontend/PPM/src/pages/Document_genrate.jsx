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
  Badge,
  Spin,
  Progress,
  AutoComplete,
  InputNumber,
  Select,
  Radio,
  Table,
  Modal,
  Drawer,
  Popover,
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
  RightOutlined,
  DownOutlined,
  UpOutlined,
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
  const { Title, Text, Paragraph } = Typography;
  const { TextArea } = Input;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);

  // Dynamic state for Scope Bullet Points (Starts empty)
  const [scopeItems, setScopeItems] = useState([]);
  const [newScopeInput, setNewScopeInput] = useState('');

  // Dynamic state for Terms Bullet Points (Starts empty)
  const [termsItems, setTermsItems] = useState([]);
  const [newTermInput, setNewTermInput] = useState('');

  // Dynamic state for Pricing Tables (Starts empty)
  const [tables, setTables] = useState([]);
  const [isEnteringHeader, setIsEnteringHeader] = useState(false);

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

  // Auto-fetch center and logged-in user info on mount
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
  }, [form]);

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
    const hasManpower = tables.some((t) => t.header_name === MANPOWER_HEADER);
    if (!hasManpower) {
      const newTableSpec = {
        header_name: MANPOWER_HEADER,
        columns: MANPOWER_COLUMNS,
        rows: [emptyRow(MANPOWER_COLUMNS, MANPOWER_HEADER)],
      };
      setTables([...tables, newTableSpec]);
    } else {
      setIsEnteringHeader(true);
    }
  };

  const handleAddTableConfirm = (newTableSpec) => {
    setTables([...tables, newTableSpec]);
    setIsEnteringHeader(false);
  };

  const handleRemoveTable = (tIndex) => {
    setTables(tables.filter((_, i) => i !== tIndex));
  };

  const handleTableUpdate = (tIndex, updatedTableSpec) => {
    const next = [...tables];
    next[tIndex] = updatedTableSpec;
    setTables(next);
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

  // Form submission handler to generate DOCX
  const handleSubmit = async (values) => {
    setLoading(true);
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
        tables: transformTablesForPreviewAndPayload(tables),
        signatory_name: primarySig.name,
        signatory_lines: primarySig.lines,
        signatories: formattedSignatories,
        filename: values.filename || '',
      };

      const response = await axios.post(
        `${API_BASE_URL}/quotation/generate`,
        payload,
        {
          responseType: 'blob',
        }
      );

      // Create download trigger for the returned blob
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Header disposition check
      const disposition = response.headers['content-disposition'];
      let filename = values.filename || 'Quotation.docx';
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      if (!filename.toLowerCase().endsWith('.docx')) {
        filename += '.docx';
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      message.success(`Quotation document "${filename}" generated successfully!`);
    } catch (err) {
      console.error('Failed to generate quotation document:', err);
      message.error(
        err.response?.data?.message ||
          'Failed to generate document. Please verify backend service.'
      );
    } finally {
      setLoading(false);
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
    <div className="max-w-[1400px] mx-auto py-6 px-4 space-y-8 font-sans antialiased text-slate-800">
      {/* Simple Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: '24px' }}>
            Proposal Generator
          </Title>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<DownloadOutlined />}
          loading={loading}
          onClick={() => form.submit()}
          style={{
            backgroundColor: '#10b981',
            borderColor: '#10b981',
            borderRadius: '10px',
            height: '44px',
            paddingLeft: '24px',
            paddingRight: '24px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Generate & Export (.docx)
        </Button>
      </div>

      {/* Main Studio Workspace Grid: Left Column Editor | Right Column Live Preview */}
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
          {/* Left Column: Input Form Studio (7 Cols on desktop) */}
          <Col xs={24} lg={15} xl={15} className="space-y-6">
            
            {/* Card 1: Basic Metadata & Template Settings */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FileWordOutlined className="text-lg" />
                    </div>
                    <span>1. Document Metadata & Settings</span>
                  </Space>
                  <Tag color="blue" className="rounded-md font-mono text-xs">SECTION 01</Tag>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <Text className="text-slate-500 text-xs mb-4 block">
                Specify document header attributes including issue date, department code, and export filename.
              </Text>

              <Row gutter={16}>
                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">Quotation Date <span className="text-red-500">*</span></Text>}
                    name="date"
                    rules={[{ required: true, message: 'Date is required' }]}
                  >
                    <Input
                      prefix={<CalendarOutlined className="text-slate-400" />}
                      placeholder="DD/MM/YYYY"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    label={
                      <Space size={4}>
                        <Text className="text-xs font-semibold text-slate-700">Dept / Division</Text>
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
                      className="rounded-xl"
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
                    label={<Text className="text-xs font-semibold text-slate-700">Save Filename</Text>}
                    name="filename"
                  >
                    <Input
                      placeholder="Quotation_Name.docx"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={6}>
                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">SAC Code</Text>}
                    name="sac_code"
                  >
                    <Input
                      placeholder="e.g. 998313"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Card 2: Email & Distribution List */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <MailOutlined className="text-lg" />
                    </div>
                    <span>2. Distribution & Email List</span>
                  </Space>
                  <Tag color="indigo" className="rounded-md font-mono text-xs">SECTION 02</Tag>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <Text className="text-slate-500 text-xs mb-4 block">
                Primary and copy email addresses to embed in the quotation header block.
              </Text>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">Email - To (Comma separated)</Text>}
                    name="email_to"
                  >
                    <Input
                      prefix={<MailOutlined className="text-slate-400" />}
                      placeholder="client@company.com, purchase@company.com"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">Email - Cc (Comma separated)</Text>}
                    name="email_cc"
                  >
                    <Input
                      prefix={<MailOutlined className="text-slate-400" />}
                      placeholder="head@cmti.res.in, accounts@cmti.res.in"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Card 3: Customer Information & Subject */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <BankOutlined className="text-lg" />
                    </div>
                    <span>3. Customer & Quotation Context</span>
                  </Space>
                  <Tag color="emerald" className="rounded-md font-mono text-xs">SECTION 03</Tag>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={
                      <Text className="text-xs font-semibold text-slate-700">
                        Customer Name & Address <span className="text-red-500">*</span>
                      </Text>
                    }
                    name="customer_raw"
                    rules={[{ required: true, message: 'Customer details are required' }]}
                    tooltip="Line 1: Company / Client Name. Following lines: Street address & Pincode."
                  >
                    <TextArea
                      rows={4}
                      placeholder="M/s. ABC Industries Ltd.&#10;Plot No. 45, Industrial Area&#10;Bengaluru - 560058"
                      className="rounded-xl font-sans"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">Kind Attention</Text>}
                    name="kind_attention"
                  >
                    <Input
                      placeholder="e.g. Mr. Rajesh Sharma (General Manager)"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>

                  <Form.Item
                    label={<Text className="text-xs font-semibold text-slate-700">Reference</Text>}
                    name="reference"
                  >
                    <Input
                      placeholder="e.g. Email enquiry dated 12/07/2026"
                      size="large"
                      className="rounded-xl"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={
                  <Text className="text-xs font-semibold text-slate-700">
                    Quotation Subject <span className="text-red-500">*</span>
                  </Text>
                }
                name="subject"
                rules={[{ required: true, message: 'Subject line is required' }]}
                tooltip="Wrap text with **double asterisks** to emphasize figures or key text in bold."
              >
                <Input
                  prefix={<FileTextOutlined className="text-slate-400" />}
                  placeholder="Quotation for Design, Fabrication & Testing of..."
                  size="large"
                  className="rounded-xl font-medium"
                />
              </Form.Item>
            </Card>

            {/* Card 4: Scope of Work */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                      <FileTextOutlined className="text-lg" />
                    </div>
                    <span>4. Scope of Work</span>
                  </Space>
                  <Tag color="cyan" className="rounded-md font-mono text-xs">{scopeItems.length} POINTS</Tag>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <Form.Item
                label={<Text className="text-xs font-semibold text-slate-700">Introductory Paragraph (Optional)</Text>}
                name="scope_intro"
              >
                <TextArea
                  rows={2}
                  placeholder="With reference to your enquiry, we are pleased to submit our formal technical & financial quotation..."
                  className="rounded-xl"
                />
              </Form.Item>

              <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: '13px', color: '#64748b' }}>
                Scope Bullet Points List
              </Divider>

              {scopeItems.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-4">
                  No scope points added yet. Type a point below and click <strong>Add Scope Point</strong>.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {scopeItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:bg-slate-100/60 transition-colors"
                    >
                      <Text className="text-slate-800 text-sm leading-relaxed flex-1 mr-3">
                        <span className="font-bold text-blue-600 mr-2">•</span>
                        {item}
                      </Text>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveScopeItem(idx)}
                        className="hover:bg-red-50 rounded-lg"
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
                    className="rounded-xl"
                  />
                </Col>
                <Col flex="none">
                  <Button
                    type="primary"
                    ghost
                    icon={<PlusOutlined />}
                    onClick={handleAddScopeItem}
                    size="large"
                    className="rounded-xl font-semibold border-blue-500 text-blue-600"
                  >
                    Add Point
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* Card 5: Terms & Conditions */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <CheckCircleOutlined className="text-lg" />
                    </div>
                    <span>5. Terms and Conditions</span>
                  </Space>
                  <Tag color="gold" className="rounded-md font-mono text-xs">{termsItems.length} CLAUSES</Tag>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              {termsItems.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400 text-xs mb-4">
                  No terms & conditions added yet. Type a term below and click <strong>Add Clause</strong>.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {termsItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:bg-slate-100/60 transition-colors"
                    >
                      <Text className="text-slate-800 text-sm leading-relaxed flex-1 mr-3">
                        <span className="font-bold text-amber-600 mr-2">{idx + 1}.</span>
                        {item}
                      </Text>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveTermItem(idx)}
                        className="hover:bg-red-50 rounded-lg"
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
                    className="rounded-xl"
                  />
                </Col>
                <Col flex="none">
                  <Button
                    type="primary"
                    ghost
                    icon={<PlusOutlined />}
                    onClick={handleAddTermItem}
                    size="large"
                    className="rounded-xl font-semibold border-amber-500 text-amber-600"
                  >
                    Add Clause
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* Card 6: Dynamic Tables Studio */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <PrinterOutlined className="text-lg" />
                    </div>
                    <span>6. Pricing & Cost Break-Up Tables</span>
                  </Space>
                  {!isEnteringHeader && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddTable}
                      className="rounded-lg font-semibold bg-purple-600 hover:bg-purple-700"
                    >
                      Add Table
                    </Button>
                  )}
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <AddHeaderForm
                existingHeaderNames={tables.map((t) => t.header_name)}
                isEnteringHeader={isEnteringHeader}
                onAdd={handleAddTableConfirm}
              />

              {tables.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  No breakdown tables attached. Click <strong>Add Table</strong> to insert a cost summary table.
                </div>
              ) : (
                tables.map((tbl, tIdx) => (
                  <div
                    key={tIdx}
                    className="p-4 mb-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <Input
                        prefix={<Text className="font-semibold text-slate-400 text-xs">Table Title:</Text>}
                        value={tbl.header_name}
                        onChange={(e) => {
                          const nextTbl = { ...tbl, header_name: e.target.value };
                          handleTableUpdate(tIdx, nextTbl);
                        }}
                        placeholder="e.g. Cost Break-Up Summary"
                        className="font-bold text-slate-800 rounded-xl"
                        size="large"
                      />
                      <Popconfirm
                        title="Delete Table"
                        description="Are you sure you want to remove this pricing table?"
                        onConfirm={() => handleRemoveTable(tIdx)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button danger type="text" icon={<DeleteOutlined />}>
                          Remove
                        </Button>
                      </Popconfirm>
                    </div>

                    <HeaderRowsEditor
                      headerItem={tbl}
                      onChange={(updatedTbl) => handleTableUpdate(tIdx, updatedTbl)}
                    />
                  </div>
                ))
              )}
            </Card>

            {/* Card 7: Signatories & Approval Blocks */}
            <Card
              title={
                <div className="flex items-center justify-between">
                  <Space className="text-slate-900 font-bold text-lg">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
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
                    className="rounded-lg font-semibold"
                  >
                    + Add Signatory
                  </Button>
                </div>
              }
              className="shadow-sm hover:shadow-md transition-shadow duration-200 rounded-2xl border border-slate-200/80 bg-white"
              styles={{ body: { padding: '24px' } }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {signatories.map((sig, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 relative shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <Text className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Signatory #{sIdx + 1}
                      </Text>
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
                          className="p-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
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
                      <Text className="text-xs font-semibold text-slate-600 mb-1 block">
                        Signatory Name
                      </Text>
                      <Input
                        placeholder="e.g. Dr. Rajesh Kumar"
                        value={sig.name}
                        onChange={(e) =>
                          handleSignatoryChange(sIdx, 'name', e.target.value)
                        }
                        size="large"
                        className="rounded-xl font-semibold"
                      />
                    </div>

                    <div>
                      <Text className="text-xs font-semibold text-slate-600 mb-1 block">
                        Designation Line(s) (One per line)
                      </Text>
                      <TextArea
                        rows={3}
                        placeholder="Scientist-D&#10;C-SMPM&#10;CMTI, Bengaluru"
                        value={sig.lines_raw}
                        onChange={(e) =>
                          handleSignatoryChange(sIdx, 'lines_raw', e.target.value)
                        }
                        className="rounded-xl font-sans"
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
                  className="rounded-xl border-blue-500 text-blue-600 font-semibold"
                >
                  Add Another Signatory
                </Button>
              </div>
            </Card>
          </Col>

          {/* Right Column: Live A4 Document Preview & Quick Export Sidebar (5 Cols on desktop) */}
          <Col xs={24} lg={9} xl={9} className="space-y-6">
            <div className="sticky top-6 space-y-6">
              
              {/* Document Preview Toolbar & Container */}
              <Card
                title={
                  <div className="flex items-center justify-between">
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
                        />
                      </Tooltip>
                      <Text className="text-xs font-mono font-bold text-slate-500 px-1">{previewZoom}%</Text>
                      <Tooltip title="Zoom In">
                        <Button
                          type="text"
                          size="small"
                          icon={<ExpandOutlined />}
                          onClick={() => setPreviewZoom(Math.min(130, previewZoom + 10))}
                        />
                      </Tooltip>
                    </Space>
                  </div>
                }
                className="shadow-xl rounded-2xl border border-slate-200/90 bg-slate-900/5 backdrop-blur-xs"
                styles={{ body: { padding: '16px' } }}
              >
                {/* Simulated A4 Paper Card */}
                <div
                  className="bg-white rounded-xl p-6 shadow-2xl border border-slate-200/80 transition-transform duration-200 overflow-y-auto max-h-[680px] space-y-4 font-sans text-xs text-slate-800 select-none"
                  style={{
                    transform: `scale(${previewZoom / 100})`,
                    transformOrigin: 'top center',
                  }}
                >
                  {/* Document Right Header */}
                  <div className="text-right text-slate-600 space-y-0.5 border-b border-slate-100 pb-3">
                    <div className="font-semibold">Date: {formValues.date || new Date().toLocaleDateString('en-GB')}</div>
                    {formValues.dept && <div className="font-semibold text-blue-700">Dept: {formValues.dept}</div>}
                  </div>

                  {/* Emails */}
                  {(formValues.email_to || formValues.email_cc) && (
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px]">
                      {formValues.email_to && (
                        <div>
                          <strong className="text-slate-700">Email: </strong>
                          <span className="text-blue-600">{formValues.email_to}</span>
                        </div>
                      )}
                      {formValues.email_cc && (
                        <div>
                          <strong className="text-slate-700">Cc: </strong>
                          <span className="text-blue-600">{formValues.email_cc}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Heading */}
                  <div className="text-center font-bold text-sm text-slate-900 tracking-wide uppercase py-1 border-b border-slate-200">
                    Quotation Information
                  </div>

                  {/* Customer Information */}
                  {formValues.customer_raw && (
                    <div>
                      <div className="font-bold text-slate-900 mb-0.5">Customer:</div>
                      <div className="whitespace-pre-line text-slate-700 pl-2 border-l-2 border-blue-400 font-sans">
                        {formValues.customer_raw}
                      </div>
                    </div>
                  )}

                  {formValues.kind_attention && (
                    <div>
                      <span className="font-bold text-slate-900">Kind Attention: </span>
                      <span className="text-slate-700">{formValues.kind_attention}</span>
                    </div>
                  )}

                  {formValues.reference && (
                    <div>
                      <span className="font-bold text-slate-900">Reference: </span>
                      <span className="text-slate-700">{formValues.reference}</span>
                    </div>
                  )}

                  {formValues.subject && (
                    <div>
                      <span className="font-bold text-slate-900">Subject: </span>
                      <span className="text-slate-900 font-semibold">{formValues.subject}</span>
                    </div>
                  )}

                  {formValues.sac_code && (
                    <div>
                      <span className="font-bold text-slate-900">SAC Code: </span>
                      <span className="text-slate-700">{formValues.sac_code}</span>
                    </div>
                  )}

                  {/* Scope of Work */}
                  {(formValues.scope_intro || scopeItems.length > 0) && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="font-bold text-slate-900 text-xs">Scope of Work:</div>
                      {formValues.scope_intro && (
                        <p className="text-slate-700 leading-relaxed italic m-0">{formValues.scope_intro}</p>
                      )}
                      {scopeItems.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                          {scopeItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Terms & Conditions */}
                  {termsItems.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="font-bold text-slate-900 text-xs">Terms & Conditions:</div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                        {termsItems.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Cost Tables Preview */}
                  {(() => {
                    const previewTables = transformTablesForPreviewAndPayload(tables);
                    if (previewTables.length === 0) return null;
                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        {previewTables.map((t, idx) => (
                          <div key={idx} className="space-y-1">
                            {t.title && <div className="font-bold text-slate-800">{t.title}</div>}
                            <table className="w-full border-collapse border border-slate-300 text-[10px]">
                              <thead>
                                <tr className="bg-blue-50/80">
                                  {t.headers.map((h, hIdx) => (
                                    <th key={hIdx} className="border border-slate-300 p-1 font-bold text-slate-800 text-left">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {t.rows.map((r, rIdx) => (
                                  <tr key={rIdx}>
                                    {r.map((cell, cIdx) => (
                                      <td key={cIdx} className="border border-slate-300 p-1">
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
                    );
                  })()}

                  {/* Signatories Footer */}
                  {signatories.some((s) => s.name.trim() || s.lines_raw.trim()) && (
                    <div className="pt-6 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-right">
                        {signatories.map((sig, i) => (
                          <div key={i} className="space-y-0.5">
                            {sig.name && <div className="font-bold text-slate-900">{sig.name},</div>}
                            {sig.lines_raw && (
                              <div className="whitespace-pre-line text-slate-600 text-[11px]">
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
                className="shadow-xl rounded-2xl border border-slate-200/90 bg-white"
                styles={{ body: { padding: '20px' } }}
              >
                <div className="space-y-3">
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<DownloadOutlined />}
                    loading={loading}
                    onClick={() => form.submit()}
                    style={{
                      backgroundColor: '#2563eb',
                      borderRadius: '12px',
                      height: '52px',
                      fontSize: '16px',
                      fontWeight: 700,
                      boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)',
                    }}
                    className="hover:scale-[1.01] transition-transform duration-200"
                  >
                    Generate Word Document (.docx)
                  </Button>

                  <Text className="text-center block text-slate-400 text-xs">
                    Streams official <code className="text-slate-600 font-semibold">.docx</code> directly from backend services.
                  </Text>
                </div>
              </Card>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

function HeaderRowsEditor({ headerItem, onChange }) {
    const { header_name: headerName, columns, rows } = headerItem;
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [focusRowIndex, setFocusRowIndex] = useState(null);
    const [ratesModalOpen, setRatesModalOpen] = useState(false);
    const [officialRates, setOfficialRates] = useState([]);
    const [loadingRates, setLoadingRates] = useState(false);
    const [pendingCustomRate, setPendingCustomRate] = useState(null);
    const [customRoleInput, setCustomRoleInput] = useState("");
    const [customRoleModalOpen, setCustomRoleModalOpen] = useState(false);

    useEffect(() => {
        if (headerName === MANPOWER_HEADER) {
            axios.get(`${API_BASE_URL}/manpower-rates/`)
                .then(res => {
                    if (Array.isArray(res.data)) {
                        setOfficialRates(res.data);
                    }
                })
                .catch(err => console.error("Failed to load manpower rates", err));
        }
    }, [headerName]);

    const fetchOfficialRates = async () => {
        setLoadingRates(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/manpower-rates/`);
            if (Array.isArray(res.data)) {
                setOfficialRates(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch manpower rates", e);
        } finally {
            setLoadingRates(false);
        }
    };

    const roleOptions = useMemo(() => {
        if (officialRates.length > 0) {
            return officialRates.map(r => ({
                value: r.designation,
                rate_other: r.rate_other_activities,
                rate_dev: r.rate_design_developmental_activities
            }));
        }
        return STANDARD_ROLES;
    }, [officialRates]);

    // Auto-complete descriptions storage
    const [savedDescriptions, setSavedDescriptions] = useState(() => {
        try {
            const stored = localStorage.getItem("costEstimation_savedDescriptions");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const saveDescriptionToMemory = (text, rateValue = 0) => {
        const trimmed = text?.trim();
        if (!trimmed) return;
        setSavedDescriptions((prev) => {
            const existingIdx = prev.findIndex(
                (item) => item.value.toLowerCase() === trimmed.toLowerCase()
            );
            let updated;
            if (existingIdx > -1) {
                updated = [...prev];
                updated[existingIdx] = { value: prev[existingIdx].value, rate: rateValue > 0 ? rateValue : prev[existingIdx].rate };
            } else {
                updated = [...prev, { value: trimmed, rate: rateValue }];
            }
            localStorage.setItem("costEstimation_savedDescriptions", JSON.stringify(updated));
            return updated;
        });
    };

    const computeRowAmount = (cb) => {
        if (!cb) return 0;
        const rate = cb.rate ?? 0;
        const quantity = cb.quantity ?? 1;
        const type = cb.type ?? "hourly";
        if (type === "monthly") {
            const months = cb.months ?? 0;
            return rate * months * quantity;
        } else {
            const hours = cb.hours ?? 0;
            const days = cb.days ?? 0;
            return rate * hours * days * quantity;
        }
    };

    const updateRow = (index, key, value) => {
        const next = [...rows];
        next[index] = { ...next[index], [key]: value };
        onChange({ ...headerItem, rows: next });
    };

    const updateManpowerField = (index, key, val) => {
        const next = [...rows];
        const currentCb = next[index]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
        
        let updatedCb = { ...currentCb, [key]: val ?? 0 };
        
        if (key === "type") {
            updatedCb = {
                type: val,
                rate: currentCb.rate ?? 0,
                quantity: currentCb.quantity ?? 1,
                hours: val === "hourly" ? (currentCb.hours || 0) : 0,
                days: val === "hourly" ? (currentCb.days || 0) : 0,
                months: val === "monthly" ? (currentCb.months || 0) : 0,
            };
        }
        
        const newAmount = computeRowAmount(updatedCb);
        
        next[index] = {
            ...next[index],
            "Cost Breakup": updatedCb,
            "Total Amount": newAmount
        };
        onChange({ ...headerItem, rows: next });

        if (key === "rate" && val > 0) {
            const roleName = next[index]["Role"];
            if (roleName) {
                saveDescriptionToMemory(roleName, val);
            }
        }
    };

    const addRow = () => {
        const nextRows = [...rows, emptyRow(columns, headerName)];
        onChange({ ...headerItem, rows: nextRows });
        setFocusRowIndex(nextRows.length - 1);
    };

    useEffect(() => {
        if (focusRowIndex !== null) {
            const inputEl = document.getElementById(`row-desc-${focusRowIndex}`);
            if (inputEl) {
                inputEl.focus();
            }
            setFocusRowIndex(null);
        }
    }, [focusRowIndex]);

    const removeRow = (index) => {
        onChange({ ...headerItem, rows: rows.filter((_, i) => i !== index) });
    };

    const removeColumn = (colName) => {
        const nextColumns = columns.filter((c) => c !== colName);
        const nextRows = rows.map((r) => {
            const nextRow = { ...r };
            delete nextRow[colName];
            return nextRow;
        });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const renameColumn = (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return;
        if (trimmed === oldName) return;
        if (columns.includes(trimmed)) {
            message.warning("Column name already exists");
            return;
        }
        const nextColumns = columns.map((c) => (c === oldName ? trimmed : c));
        const nextRows = rows.map((r) => {
            const nextRow = { ...r };
            if (oldName in nextRow) {
                nextRow[trimmed] = nextRow[oldName];
                delete nextRow[oldName];
            }
            return nextRow;
        });
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
    };

    const [editingCol, setEditingCol] = useState(null);
    const [tempColName, setTempColName] = useState("");

    const startEditingCol = (col) => {
        setEditingCol(col);
        setTempColName(col);
    };

    const confirmRenameCol = (oldName) => {
        const trimmed = tempColName.trim();
        if (!trimmed) {
            setEditingCol(null);
            return;
        }
        if (trimmed === oldName) {
            setEditingCol(null);
            return;
        }
        if (columns.includes(trimmed)) {
            message.warning("Column name already exists");
            setEditingCol(null);
            return;
        }
        renameColumn(oldName, trimmed);
        setEditingCol(null);
    };

    const confirmAddColumn = () => {
        const trimmed = newColumnName.trim();
        if (!trimmed) {
            setAddingColumn(false);
            return;
        }
        if (columns.includes(trimmed)) {
            message.warning("Column already exists");
            return;
        }

        const amountIndex = columns.indexOf("Total Amount");
        const nextColumns =
            amountIndex === -1
                ? [...columns, trimmed]
                : [...columns.slice(0, amountIndex), trimmed, ...columns.slice(amountIndex)];

        const nextRows = rows.map((r) => ({ ...r, [trimmed]: "" }));
        onChange({ ...headerItem, columns: nextColumns, rows: nextRows });
        setNewColumnName("");
        setAddingColumn(false);
    };

    const previewTotal = useMemo(() => {
        if (headerName === MANPOWER_HEADER) {
            return rows.reduce((sum, r) => {
                const cb = r["Cost Breakup"] || {};
                const type = cb.type ?? "hourly";
                if (type === "monthly") {
                    return sum + (cb.rate || 0) * (cb.months || 0) * (cb.quantity || 1);
                } else {
                    return sum + (cb.rate || 0) * (cb.hours || 0) * (cb.days || 0) * (cb.quantity || 1);
                }
            }, 0);
        }
        if (columns.includes("Total Amount")) {
            return rows.reduce((sum, r) => sum + (Number(r["Total Amount"]) || 0), 0);
        }
        return null;
    }, [rows, columns, headerName]);

    const tableColumns = [];

    if (headerName === MANPOWER_HEADER) {
        tableColumns.push(
            {
                title: "Role",
                dataIndex: "Role",
                key: "Role",
                width: 160,
                render: (_, record, index) => (
                    <AutoComplete
                        id={`row-desc-${index}`}
                        value={record["Role"] || ""}
                        options={roleOptions}
                        filterOption={(inputValue, option) =>
                            option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                        onSelect={(value, option) => {
                            updateRow(index, "Role", value);
                            if (option && (option.rate_other || option.rate_dev)) {
                                const suggestedRate = option.rate_other || option.rate_dev || 0;
                                const currentCb = record["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
                                if (!currentCb.rate || currentCb.rate === 0) {
                                    updateManpowerField(index, "rate", suggestedRate);
                                }
                            }
                        }}
                        onChange={(value) => updateRow(index, "Role", value)}
                        style={{ width: "100%" }}
                    >
                        <Input 
                            placeholder="Enter role..." 
                            style={{ color: "#1e293b", backgroundColor: "#ffffff" }}
                        />
                    </AutoComplete>
                ),
            },
            {
                title: "Type",
                key: "type",
                width: 90,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    return (
                        <Select
                            value={type}
                            onChange={(v) => updateManpowerField(index, "type", v)}
                            options={[
                                { label: "Hourly", value: "hourly" },
                                { label: "Monthly", value: "monthly" },
                            ]}
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: "Rate",
                key: "rate",
                width: 100,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const roleName = record["Role"] || "";
                    const matchedRate = officialRates.find(
                        (r) => r.designation.toLowerCase() === roleName.trim().toLowerCase()
                    );

                    const inputEl = (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.rate === 0 ? undefined : cb.rate}
                            onChange={(v) => updateManpowerField(index, "rate", v)}
                            placeholder="Rate"
                            style={{ width: "100%" }}
                        />
                    );

                    if (!matchedRate) return inputEl;

                    const popoverContent = (
                        <div className="p-2 space-y-1.5 min-w-[210px]">
                            <div className="text-[11px] font-bold text-slate-700 border-b pb-1">
                                Official Admin Rates for {matchedRate.designation}
                            </div>
                            <button
                                type="button"
                                onClick={() => updateManpowerField(index, "rate", Number(matchedRate.rate_other_activities))}
                                className="w-full text-left px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold text-blue-700 flex items-center justify-between transition-colors cursor-pointer"
                            >
                                <span>Other Activities</span>
                                <span className="font-black">₹{Number(matchedRate.rate_other_activities).toLocaleString("en-IN")}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => updateManpowerField(index, "rate", Number(matchedRate.rate_design_developmental_activities))}
                                className="w-full text-left px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-bold text-emerald-700 flex items-center justify-between transition-colors cursor-pointer"
                            >
                                <span>Design & Dev</span>
                                <span className="font-black">₹{Number(matchedRate.rate_design_developmental_activities).toLocaleString("en-IN")}</span>
                            </button>
                        </div>
                    );

                    return (
                        <Popover content={popoverContent} trigger="click" placement="top">
                            {inputEl}
                        </Popover>
                    );
                },
            },
            {
                title: "Hrs / Mos",
                key: "hours_months",
                width: 95,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isMonthly = type === "monthly";
                    const val = isMonthly ? cb.months : cb.hours;
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={val === 0 ? undefined : val}
                            onChange={(v) => updateManpowerField(index, isMonthly ? "months" : "hours", v)}
                            placeholder={isMonthly ? "Mos" : "Hrs"}
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: "Days",
                key: "days",
                width: 70,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    const type = cb.type ?? "hourly";
                    const isMonthly = type === "monthly";
                    if (isMonthly) {
                        return <span style={{ color: "#ccc", display: "block", textAlign: "center" }}>—</span>;
                    }
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.days === 0 ? undefined : cb.days}
                            onChange={(v) => updateManpowerField(index, "days", v)}
                            placeholder="Days"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: "Qty",
                key: "quantity",
                width: 80,
                render: (_, record, index) => {
                    const cb = record["Cost Breakup"] || {};
                    return (
                        <InputNumber
                            min={0}
                            controls={false}
                            value={cb.quantity === 0 ? undefined : cb.quantity}
                            onChange={(v) => updateManpowerField(index, "quantity", v)}
                            placeholder="0"
                            style={{ width: "100%" }}
                        />
                    );
                },
            },
            {
                title: "Amount",
                dataIndex: "Total Amount",
                key: "Total Amount",
                width: 100,
                render: (_, record, index) => (
                    <InputNumber
                        min={0}
                        controls={false}
                        value={record["Total Amount"]}
                        onChange={(v) => updateRow(index, "Total Amount", v ?? 0)}
                        style={{ width: "100%" }}
                    />
                ),
            }
        );
    } else {
        tableColumns.push(
            ...columns.map((col) => {
                const isEditing = editingCol === col;
                const isFirstCol = col === columns[0];
                return {
                    title: (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                            {isEditing ? (
                                <Input
                                    size="small"
                                    value={tempColName}
                                    onChange={(e) => setTempColName(e.target.value)}
                                    onBlur={() => confirmRenameCol(col)}
                                    onPressEnter={() => confirmRenameCol(col)}
                                    autoFocus
                                    style={{ width: 90 }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span>{col}</span>
                            )}
                            {!isFirstCol && col !== "Total Amount" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                    {!isEditing && (
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<EditOutlined style={{ fontSize: 10 }} />}
                                            style={{ padding: 0, width: 16, height: 16, minWidth: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            onClick={() => startEditingCol(col)}
                                            title="Rename column"
                                        />
                                    )}
                                    <Popconfirm
                                        title={`Delete column "${col}"?`}
                                        onConfirm={() => removeColumn(col)}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                                            style={{ padding: 0, width: 16, height: 16, minWidth: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Delete column"
                                        />
                                    </Popconfirm>
                                </div>
                            )}
                        </div>
                    ),
                    dataIndex: col,
                    key: col,
                    render: (_, record, index) => {
                        if (col === "Total Amount") {
                            return (
                                <InputNumber
                                    min={0}
                                    controls={false}
                                    value={record[col]}
                                    onChange={(v) => updateRow(index, col, v ?? 0)}
                                    style={{ width: 120 }}
                                />
                            );
                        }
                        if (isFirstCol) {
                            return (
                                <AutoComplete
                                    id={`row-desc-${index}`}
                                    value={record[col] || ""}
                                    options={savedDescriptions}
                                    filterOption={(inputValue, option) =>
                                        option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                    onChange={(value) => updateRow(index, col, value)}
                                    onSelect={(value) => {
                                        updateRow(index, col, value);
                                        const match = savedDescriptions.find((item) => item.value === value);
                                        if (match && match.rate > 0) {
                                            const currentCb = record["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
                                            const updatedCb = { ...currentCb, rate: match.rate };
                                            const newAmount = computeRowAmount(updatedCb);
                                            const nextRows = [...rows];
                                            nextRows[index] = {
                                                ...nextRows[index],
                                                [col]: value,
                                                "Cost Breakup": updatedCb,
                                                "Total Amount": newAmount,
                                            };
                                            onChange({ ...headerItem, rows: nextRows });
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        const currentCb = record["Cost Breakup"] || {};
                                        const rate = currentCb.rate || 0;
                                        saveDescriptionToMemory(val, rate);
                                    }}
                                    style={{ width: "100%" }}
                                >
                                    <Input 
                                        placeholder={`Enter ${col.toLowerCase()}...`}
                                        style={{ color: "#1e293b", backgroundColor: "#ffffff" }}
                                    />
                                </AutoComplete>
                            );
                        }
                        return <Input value={record[col]} onChange={(e) => updateRow(index, col, e.target.value)} />;
                    },
                };
            }),
            {
                title: addingColumn ? (
                    <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <Input
                            size="small"
                            autoFocus
                            placeholder="Column name"
                            value={newColumnName}
                            onChange={(e) => setNewColumnName(e.target.value)}
                            onPressEnter={confirmAddColumn}
                            style={{ width: 110 }}
                        />
                        <Button size="small" type="primary" onClick={confirmAddColumn}>
                            Add
                        </Button>
                        <Button size="small" danger onClick={() => { setAddingColumn(false); setNewColumnName(""); }}>
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="small"
                        type="text"
                        icon={<PlusOutlined />}
                        onClick={() => setAddingColumn(true)}
                        title="Add column"
                    />
                ),
                key: "__add_column__",
                width: addingColumn ? 250 : 50,
            }
        );
    }

    tableColumns.push({
        title: "",
        key: "actions",
        width: 50,
        render: (_, __, index) => (
            <Popconfirm title="Remove row?" onConfirm={() => removeRow(index)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
        ),
    });

    const applyOfficialRateToTable = (designation, rate, activityTypeLabel, customRoleOverride = null) => {
        const isOthers = designation.toLowerCase().includes("other");

        // If user selected "Others" and custom role name is not provided yet, open custom role input modal!
        if (isOthers && !customRoleOverride) {
            setPendingCustomRate({ designation, rate, activityTypeLabel });
            setCustomRoleInput("");
            setCustomRoleModalOpen(true);
            return;
        }

        const finalRoleName = (customRoleOverride || designation).trim();
        const numRate = Number(rate) || 0;
        let nextRows = [...rows];

        // Prevent Duplicate: Check if exact same role and same rate already exists
        const isDuplicate = nextRows.some(r => {
            const role = (r["Role"] || "").trim().toLowerCase();
            const cb = r["Cost Breakup"] || {};
            return role === finalRoleName.toLowerCase() && Number(cb.rate) === numRate;
        });

        if (isDuplicate) {
            message.warning(`"${finalRoleName}" (₹${numRate}) is already added in the table.`);
            return;
        }

        // Find the first completely empty row (no role and no rate filled)
        let targetIndex = nextRows.findIndex(r => {
            const hasRole = r["Role"] && r["Role"].trim() !== "";
            const cb = r["Cost Breakup"] || {};
            const hasRate = cb.rate && cb.rate > 0;
            return !hasRole && !hasRate;
        });

        if (targetIndex === -1) {
            // Append a brand new row
            const newRow = emptyRow(MANPOWER_COLUMNS, MANPOWER_HEADER);
            newRow["Role"] = finalRoleName;
            const currentCb = newRow["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
            const updatedCb = { ...currentCb, rate: numRate };
            newRow["Cost Breakup"] = updatedCb;
            newRow["Total Amount"] = computeRowAmount(updatedCb);
            nextRows.push(newRow);
        } else {
            // Populate into existing empty row
            const currentCb = nextRows[targetIndex]["Cost Breakup"] || { type: "hourly", rate: 0, hours: 0, days: 0, months: 0, quantity: 1 };
            const updatedCb = { ...currentCb, rate: numRate };
            nextRows[targetIndex] = {
                ...nextRows[targetIndex],
                "Role": finalRoleName,
                "Cost Breakup": updatedCb,
                "Total Amount": computeRowAmount(updatedCb)
            };
        }

        onChange({ ...headerItem, rows: nextRows });
        message.success(`Inserted ${finalRoleName} (${activityTypeLabel}: ₹${rate}) into table`);
    };

    const handleConfirmCustomRole = () => {
        const roleName = customRoleInput.trim();
        if (!roleName) {
            message.warning("Please enter a role name");
            return;
        }
        if (pendingCustomRate) {
            applyOfficialRateToTable(
                pendingCustomRate.designation,
                pendingCustomRate.rate,
                pendingCustomRate.activityTypeLabel,
                roleName
            );
        }
        setCustomRoleModalOpen(false);
        setPendingCustomRate(null);
        setCustomRoleInput("");
    };

    return (
        <div className="space-y-3">
            {headerName === MANPOWER_HEADER && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/70 rounded-xl px-3.5 py-2 text-xs">
                    <span className="text-slate-700 font-medium flex items-center gap-1.5">
                        <InfoCircleOutlined className="text-blue-600 font-bold text-sm" />
                        Check standard rates configured by Admin for each role.
                    </span>
                    <Button
                        size="small"
                        type="primary"
                        icon={<InfoCircleOutlined />}
                        onClick={() => {
                            fetchOfficialRates();
                            setRatesModalOpen(true);
                        }}
                        className="text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    >
                        {ratesModalOpen ? "Close Reference" : "View Rates Reference"}
                    </Button>
                </div>
            )}

            <Table
                rowKey={(_, index) => String(index)}
                columns={tableColumns}
                dataSource={rows}
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                footer={() => (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", width: "100%" }}>
                        <div />
                        <Button 
                            icon={<PlusOutlined />} 
                            onClick={addRow}
                            style={{ justifySelf: "center" }}
                        >
                            Add Row
                        </Button>
                        {previewTotal !== null && (
                            <div style={{ textAlign: "right", fontWeight: 600 }}>
                                Total: {previewTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        )}
                    </div>
                )}
            />

            <Drawer
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <InfoCircleOutlined className="text-blue-600" />
                        <span>Official Manpower Rates Reference</span>
                    </div>
                }
                placement="right"
                open={ratesModalOpen}
                onClose={() => setRatesModalOpen(false)}
                mask={false}
                width={480}
                styles={{
                    body: { padding: "16px" },
                    header: { padding: "16px 20px" }
                }}
            >
                <div className="space-y-4">
                    <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                        <InfoCircleOutlined className="text-blue-600 font-bold text-sm shrink-0" />
                        <span>Click any rate cell in the table below to <strong>auto-fill</strong> it into your table!</span>
                    </div>

                    <Table
                        rowKey="id"
                        dataSource={officialRates}
                        loading={loadingRates}
                        pagination={false}
                        bordered
                        size="small"
                        columns={[
                            {
                                title: "Designation / Role",
                                dataIndex: "designation",
                                key: "designation",
                                render: (text) => (
                                    <span className="font-extrabold text-slate-800 text-xs">{text}</span>
                                ),
                            },
                            {
                                title: "Other Activities",
                                dataIndex: "rate_other_activities",
                                key: "rate_other_activities",
                                align: "right",
                                render: (val, record) => (
                                    <button
                                        type="button"
                                        onClick={() => applyOfficialRateToTable(record.designation, val, "Other Activities")}
                                        className="w-full text-right px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200/80 transition-all cursor-pointer active:scale-95"
                                        title="Click to insert into table"
                                    >
                                        ₹{Number(val).toLocaleString("en-IN")}
                                    </button>
                                ),
                            },
                            {
                                title: "Design & Dev",
                                dataIndex: "rate_design_developmental_activities",
                                key: "rate_design_developmental_activities",
                                align: "right",
                                render: (val, record) => (
                                    <button
                                        type="button"
                                        onClick={() => applyOfficialRateToTable(record.designation, val, "Design & Dev")}
                                        className="w-full text-right px-2.5 py-1 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200/80 transition-all cursor-pointer active:scale-95"
                                        title="Click to insert into table"
                                    >
                                        ₹{Number(val).toLocaleString("en-IN")}
                                    </button>
                                ),
                            },
                        ]}
                    />
                </div>
            </Drawer>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <UserOutlined className="text-blue-600" />
                        <span>Enter Custom Role / Designation</span>
                    </div>
                }
                open={customRoleModalOpen}
                onCancel={() => {
                    setCustomRoleModalOpen(false);
                    setPendingCustomRate(null);
                }}
                onOk={handleConfirmCustomRole}
                okText="Add to Table"
                cancelText="Cancel"
                okButtonProps={{ className: "bg-blue-600 hover:bg-blue-700 font-bold" }}
                width={420}
                destroyOnClose
            >
                <div className="py-2 space-y-3">
                    <p className="text-xs text-slate-600 font-medium">
                        You selected the <strong>{pendingCustomRate?.activityTypeLabel}</strong> rate (<strong>₹{pendingCustomRate?.rate}</strong>) for Others. Please enter the specific designation/role name:
                    </p>
                    <Input
                        placeholder="e.g. Junior Research Fellow, Lab Assistant, Project Associate..."
                        value={customRoleInput}
                        onChange={(e) => setCustomRoleInput(e.target.value)}
                        onPressEnter={handleConfirmCustomRole}
                        autoFocus
                    />
                </div>
            </Modal>
        </div>
    );
}

function AddHeaderForm({ existingHeaderNames, onAdd, isEnteringHeader, activeHeaderName }) {
    const [customName, setCustomName] = useState("");

    const handleAddCustom = () => {
        const name = customName.trim();
        if (!name) {
            message.warning("Enter a header name");
            return;
        }
        if (existingHeaderNames.includes(name)) {
            message.warning("A header with this name already exists");
            return;
        }
        const isManpower = name === MANPOWER_HEADER;
        onAdd({
            header_name: name,
            columns: isManpower ? MANPOWER_COLUMNS : DEFAULT_CUSTOM_COLUMNS,
            rows: [emptyRow(isManpower ? MANPOWER_COLUMNS : DEFAULT_CUSTOM_COLUMNS, name)],
        });
        setCustomName("");
    };

    if (isEnteringHeader) {
        return (
            <div style={{ border: "1px dashed #ccc", padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <Input
                        autoFocus
                        placeholder="Enter Table Name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onPressEnter={handleAddCustom}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustom}>
                        Create
                    </Button>
                </div>
            </div>
        );
    }

    if (activeHeaderName !== MANPOWER_HEADER) {
        return null;
    }

    return (
        <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
            Role, Cost Breakup (rate × hours × days × quantity), Amount - calculated automatically.
        </div>
    );
}
