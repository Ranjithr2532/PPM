import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Button,
  message,
  Typography,
  Space,
  Divider,
  Tag,
  Popconfirm,
  Tooltip,
  Select,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  FileWordOutlined,
  TableOutlined,
  CheckSquareOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { isoSubmissionService } from '../services/isoSubmissionService';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function GenericIsoForm({
  proposalId,
  submissionId,
  docInfo = {},
  onBack,
}) {
  const docName = docInfo.name || 'ISO Document';
  const docCode = docInfo.code || 'CMTI-QMS/Rev00';
  const docNo = docInfo.document_no || '000';
  const docTypeKey = (docInfo.name || 'ISO').toUpperCase().replace(/\s+/g, '_');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentSubmission, setCurrentSubmission] = useState(null);

  // Form Fields
  const [headerData, setHeaderData] = useState({
    docNo: docNo,
    centreDept: 'SMPM',
    groupName: 'SMPM',
    dateStr: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    preparedName: '',
    approvedName: '',
  });

  const [projectTitle, setProjectTitle] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('');

  // Dynamic Table State
  const [tableHeaders, setTableHeaders] = useState(['Sl No', 'Item Description', 'Specification / Details', 'Qty', 'Remarks']);
  const [tableRows, setTableRows] = useState([
    ['1', '', '', '', ''],
  ]);

  // Dynamic Checklist / Review Points
  const [checklistPoints, setChecklistPoints] = useState([]);

  // Dynamic Sections
  const [customSections, setCustomSections] = useState([]);

  // Conclusion
  const [conclusion, setConclusion] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');

  // Fetch Existing Submission Data
  const loadExistingData = useCallback(async () => {
    setLoading(true);
    try {
      let sub = null;
      if (submissionId) {
        sub = await isoSubmissionService.getSubmissionById(submissionId);
      } else if (proposalId) {
        const list = await isoSubmissionService.getSubmissions({
          proposal_id: proposalId,
          doc_type: docTypeKey,
        });
        if (list && list.length > 0) {
          sub = list[0];
        }
      }

      if (sub) {
        setCurrentSubmission(sub);
        const f = sub.form_data || {};
        const h = sub.header_data || {};

        setHeaderData((prev) => ({
          ...prev,
          docNo: sub.document_no || h.docNo || docNo,
          centreDept: h.centreDept || 'SMPM',
          groupName: h.groupName || 'SMPM',
          dateStr: h.dateStr || prev.dateStr,
          preparedName: h.preparedName || '',
          approvedName: h.approvedName || '',
        }));

        setProjectTitle(f.project_title || f.title_of_project || '');
        setProjectNo(f.project_no || '');
        setCustomerName(f.customer_name || '');
        setDescription(f.description || '');
        setConclusion(f.conclusion || '');
        setPreparedBy(f.prepared_by || '');
        setApprovedBy(f.approved_by || '');

        if (Array.isArray(f.custom_headers) && f.custom_headers.length > 0) {
          setTableHeaders(f.custom_headers);
        }
        if (Array.isArray(f.custom_rows) && f.custom_rows.length > 0) {
          setTableRows(f.custom_rows);
        }
        if (Array.isArray(f.checklist_points)) {
          setChecklistPoints(f.checklist_points);
        }
        if (Array.isArray(f.sections)) {
          setCustomSections(f.sections);
        }
      } else if (proposalId) {
        // Fetch project metadata
        try {
          const pRes = await axios.get(`${API_BASE_URL}/proposals/${proposalId}`);
          if (pRes.data) {
            setProjectTitle(pRes.data.project_title || pRes.data.title || '');
            setProjectNo(pRes.data.project_no || pRes.data.proposal_no || '');
            setCustomerName(pRes.data.customer_name || pRes.data.client || '');
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Error loading generic ISO submission:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId, proposalId, docTypeKey, docNo]);

  useEffect(() => {
    loadExistingData();
  }, [loadExistingData]);

  // Table Column Management
  const addColumn = () => {
    const colName = `Column ${tableHeaders.length + 1}`;
    setTableHeaders([...tableHeaders, colName]);
    setTableRows(tableRows.map((row) => [...row, '']));
  };

  const updateColumnName = (colIndex, newName) => {
    const updated = [...tableHeaders];
    updated[colIndex] = newName;
    setTableHeaders(updated);
  };

  const removeColumn = (colIndex) => {
    if (tableHeaders.length <= 1) {
      message.warning('At least one column is required.');
      return;
    }
    setTableHeaders(tableHeaders.filter((_, i) => i !== colIndex));
    setTableRows(tableRows.map((row) => row.filter((_, i) => i !== colIndex)));
  };

  // Table Row Management
  const addRow = () => {
    const newRow = tableHeaders.map((_, i) => (i === 0 ? String(tableRows.length + 1) : ''));
    setTableRows([...tableRows, newRow]);
  };

  const updateCell = (rowIndex, colIndex, val) => {
    const updated = [...tableRows];
    updated[rowIndex] = [...updated[rowIndex]];
    updated[rowIndex][colIndex] = val;
    setTableRows(updated);
  };

  const removeRow = (rowIndex) => {
    if (tableRows.length <= 1) {
      message.warning('At least one row is required.');
      return;
    }
    const filtered = tableRows.filter((_, i) => i !== rowIndex);
    // Auto-update first column if it's numbered
    const renumbered = filtered.map((row, idx) => {
      const copy = [...row];
      if (!isNaN(parseInt(copy[0]))) {
        copy[0] = String(idx + 1);
      }
      return copy;
    });
    setTableRows(renumbered);
  };

  // Checklist Points Management
  const addChecklistPoint = () => {
    setChecklistPoints([
      ...checklistPoints,
      {
        sl_no: String(checklistPoints.length + 1),
        point: '',
        yes_no_na: 'Yes',
        details: '',
      },
    ]);
  };

  const updateChecklistPoint = (idx, field, val) => {
    const updated = [...checklistPoints];
    updated[idx] = { ...updated[idx], [field]: val };
    setChecklistPoints(updated);
  };

  const removeChecklistPoint = (idx) => {
    const updated = checklistPoints.filter((_, i) => i !== idx);
    setChecklistPoints(updated.map((pt, i) => ({ ...pt, sl_no: String(i + 1) })));
  };

  // Custom Sections Management
  const addCustomSection = () => {
    setCustomSections([
      ...customSections,
      {
        title: `Section ${customSections.length + 1}`,
        content: '',
      },
    ]);
  };

  const updateCustomSection = (idx, field, val) => {
    const updated = [...customSections];
    updated[idx] = { ...updated[idx], [field]: val };
    setCustomSections(updated);
  };

  const removeCustomSection = (idx) => {
    setCustomSections(customSections.filter((_, i) => i !== idx));
  };

  // Payload Builder
  const getPayload = (status = 'DRAFT') => {
    const rawUser = window.localStorage.getItem('ppm_user');
    const userId = rawUser ? JSON.parse(rawUser)?.id : null;

    return {
      doc_type: docTypeKey,
      document_no: headerData.docNo || docNo,
      proposal_id: proposalId ? parseInt(proposalId) : null,
      status: status,
      created_by: userId,
      header_data: {
        ...headerData,
        code: docCode,
        docTitle: docName,
        preparedName: preparedBy || headerData.preparedName,
        approvedName: approvedBy || headerData.approvedName,
      },
      form_data: {
        doc_title: docName,
        doc_code: docCode,
        project_title: projectTitle,
        project_no: projectNo,
        customer_name: customerName,
        description: description,
        custom_headers: tableHeaders,
        custom_rows: tableRows,
        checklist_points: checklistPoints,
        sections: customSections,
        conclusion: conclusion,
        prepared_by: preparedBy,
        approved_by: approvedBy,
      },
    };
  };

  // Save / Submit Handlers
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = getPayload('DRAFT');
      if (currentSubmission?.id) {
        const updated = await isoSubmissionService.updateSubmission(currentSubmission.id, payload);
        setCurrentSubmission(updated);
      } else {
        const created = await isoSubmissionService.createSubmission(payload);
        setCurrentSubmission(created);
      }
      message.success('Draft saved successfully!');
    } catch (err) {
      console.error('Error saving draft:', err);
      message.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = getPayload('SUBMITTED');
      if (currentSubmission?.id) {
        const updated = await isoSubmissionService.updateSubmission(currentSubmission.id, payload);
        setCurrentSubmission(updated);
      } else {
        const created = await isoSubmissionService.createSubmission(payload);
        setCurrentSubmission(created);
      }
      message.success('ISO Document submitted successfully!');
    } catch (err) {
      console.error('Error submitting document:', err);
      message.error('Failed to submit document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadWord = async () => {
    setDownloading(true);
    try {
      let subId = currentSubmission?.id;
      if (!subId) {
        const payload = getPayload('DRAFT');
        const created = await isoSubmissionService.createSubmission(payload);
        setCurrentSubmission(created);
        subId = created.id;
      }
      const safeName = `ISO_${docName.replace(/\s+/g, '_')}_${docNo}.docx`;
      await isoSubmissionService.exportWord(subId, safeName);
      message.success('Word document downloaded successfully!');
    } catch (err) {
      console.error('Error exporting word:', err);
      message.error('Failed to export Word document');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header Card */}
      <Card className="rounded-2xl shadow-sm border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                className="font-medium text-slate-600 hover:text-indigo-600"
              >
                Back
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Title level={4} className="!mb-0 text-slate-800 font-bold">
                  {docName}
                </Title>
                <Tag color="indigo" className="font-semibold text-xs">
                  Doc #{docNo}
                </Tag>
                {currentSubmission?.status && (
                  <Tag
                    color={
                      currentSubmission.status === 'APPROVED'
                        ? 'success'
                        : currentSubmission.status === 'SUBMITTED'
                          ? 'processing'
                          : 'warning'
                    }
                    className="font-bold text-xs uppercase"
                  >
                    {currentSubmission.status}
                  </Tag>
                )}
              </div>
              <Text className="text-xs text-slate-500 font-mono">
                Code: {docCode} | Quality Management Standard Template
              </Text>
            </div>
          </div>

          <Space wrap className="justify-end">
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={savingDraft}
              className="font-semibold text-slate-700"
            >
              Save Draft
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
            >
              Submit for Approval
            </Button>
            <Button
              icon={<FileWordOutlined />}
              onClick={handleDownloadWord}
              loading={downloading}
              className="font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              Export Word (.docx)
            </Button>
          </Space>
        </div>
      </Card>

      {/* ISO Document Metadata / Header Form */}
      <Card
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <span>📋 Document & Project Details</span>
          </div>
        }
        className="rounded-2xl shadow-sm border-slate-200 bg-white"
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Doc Number</Text>
            <Input
              value={headerData.docNo}
              onChange={(e) => setHeaderData({ ...headerData, docNo: e.target.value })}
              placeholder="e.g. 065"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Document Date</Text>
            <Input
              value={headerData.dateStr}
              onChange={(e) => setHeaderData({ ...headerData, dateStr: e.target.value })}
              placeholder="DD-MM-YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Centre / Department</Text>
            <Input
              value={headerData.centreDept}
              onChange={(e) => setHeaderData({ ...headerData, centreDept: e.target.value })}
              placeholder="e.g. SMPM"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Group Name</Text>
            <Input
              value={headerData.groupName}
              onChange={(e) => setHeaderData({ ...headerData, groupName: e.target.value })}
              placeholder="e.g. SMC"
            />
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Project Title</Text>
            <Input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Enter project title"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Project Number</Text>
            <Input
              value={projectNo}
              onChange={(e) => setProjectNo(e.target.value)}
              placeholder="Enter project number"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Customer / Agency</Text>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </Col>
          <Col xs={24}>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Description / Summary</Text>
            <TextArea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description or purpose of this document"
            />
          </Col>
        </Row>
      </Card>

      {/* Dynamic Data Table Card */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <TableOutlined className="text-indigo-600" />
              <span>📊 Dynamic ISO Data Table</span>
            </div>
            <Space size="small">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={addColumn}
                className="font-medium text-xs border-indigo-200 text-indigo-700 bg-indigo-50"
              >
                + Add Column
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={addRow}
                className="font-medium text-xs bg-slate-800"
              >
                + Add Row
              </Button>
            </Space>
          </div>
        }
        className="rounded-2xl shadow-sm border-slate-200 bg-white"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                {tableHeaders.map((hdr, colIdx) => (
                  <th key={colIdx} className="p-2 border border-slate-300 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <Input
                        size="small"
                        value={hdr}
                        onChange={(e) => updateColumnName(colIdx, e.target.value)}
                        className="font-bold text-xs bg-transparent border-slate-300 focus:bg-white"
                      />
                      {tableHeaders.length > 1 && (
                        <Popconfirm
                          title="Delete Column"
                          description="Delete this column and its data?"
                          onConfirm={() => removeColumn(colIdx)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            className="p-1 h-6 w-6"
                            title="Delete Column"
                          />
                        </Popconfirm>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-2 border border-slate-300 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50 border-b border-slate-200">
                  {tableHeaders.map((_, colIdx) => (
                    <td key={colIdx} className="p-1.5 border border-slate-200">
                      <Input
                        size="small"
                        value={row[colIdx] || ''}
                        onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                        placeholder="Enter value"
                        className="text-xs"
                      />
                    </td>
                  ))}
                  <td className="p-1 border border-slate-200 text-center">
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeRow(rowIdx)}
                      className="p-1 h-6 w-6"
                      title="Delete Row"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex justify-between items-center text-xs text-slate-500">
          <span>Click any column header to rename it. Use buttons above to add more columns or rows.</span>
          <Button size="small" icon={<PlusOutlined />} onClick={addRow} className="text-xs">
            + Add Row
          </Button>
        </div>
      </Card>

      {/* Dynamic Checklist / Review Points Card */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <CheckSquareOutlined className="text-emerald-600" />
              <span>✅ Review Points / Checklist (Optional)</span>
            </div>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={addChecklistPoint}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200"
            >
              + Add Review Point
            </Button>
          </div>
        }
        className="rounded-2xl shadow-sm border-slate-200 bg-white"
      >
        {checklistPoints.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            <p>No checklist points added yet.</p>
            <Button size="small" icon={<PlusOutlined />} onClick={addChecklistPoint} className="mt-2 text-xs">
              Add First Review Point
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {checklistPoints.map((pt, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="w-12 text-xs font-bold text-slate-500">#{pt.sl_no}</div>
                <div className="flex-1 w-full">
                  <Input
                    size="small"
                    value={pt.point}
                    onChange={(e) => updateChecklistPoint(idx, 'point', e.target.value)}
                    placeholder="Enter review requirement / checklist point"
                    className="text-xs font-medium"
                  />
                </div>
                <div className="w-32">
                  <Select
                    size="small"
                    value={pt.yes_no_na}
                    onChange={(val) => updateChecklistPoint(idx, 'yes_no_na', val)}
                    className="w-full text-xs"
                    options={[
                      { value: 'Yes', label: 'Yes' },
                      { value: 'No', label: 'No' },
                      { value: 'NA', label: 'NA' },
                    ]}
                  />
                </div>
                <div className="flex-1 w-full">
                  <Input
                    size="small"
                    value={pt.details}
                    onChange={(e) => updateChecklistPoint(idx, 'details', e.target.value)}
                    placeholder="Remarks / details"
                    className="text-xs"
                  />
                </div>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeChecklistPoint(idx)}
                  title="Remove Point"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Additional Custom Sections Card */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <AppstoreAddOutlined className="text-amber-600" />
              <span>📝 Additional Sections (Optional)</span>
            </div>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={addCustomSection}
              className="text-xs font-semibold text-amber-800 bg-amber-50 border-amber-200"
            >
              + Add Section
            </Button>
          </div>
        }
        className="rounded-2xl shadow-sm border-slate-200 bg-white"
      >
        {customSections.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            <p>No additional sections added.</p>
            <Button size="small" icon={<PlusOutlined />} onClick={addCustomSection} className="mt-2 text-xs">
              Add Custom Section
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {customSections.map((sec, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    value={sec.title}
                    onChange={(e) => updateCustomSection(idx, 'title', e.target.value)}
                    placeholder="Section Title"
                    className="font-bold text-xs"
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeCustomSection(idx)}
                    title="Delete Section"
                  />
                </div>
                <TextArea
                  rows={3}
                  value={sec.content}
                  onChange={(e) => updateCustomSection(idx, 'content', e.target.value)}
                  placeholder="Enter section content / description"
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Conclusion & Signatures */}
      <Card
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <span>✍️ Conclusion & Signatures</span>
          </div>
        }
        className="rounded-2xl shadow-sm border-slate-200 bg-white"
      >
        <div className="space-y-4">
          <div>
            <Text className="text-xs font-semibold text-slate-600 block mb-1">Conclusion / Final Remarks</Text>
            <TextArea
              rows={3}
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Enter final conclusions, clearance, or approval remarks"
            />
          </div>

          <Divider className="my-3" />

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Text className="text-xs font-semibold text-slate-600 block mb-1">Prepared By (Name & Designation)</Text>
              <Input
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="e.g. Mr. John Doe, Scientist-C"
              />
            </Col>
            <Col xs={24} sm={12}>
              <Text className="text-xs font-semibold text-slate-600 block mb-1">Approved By (Name & Designation)</Text>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="e.g. Dr. Jane Smith, Centre Head"
              />
            </Col>
          </Row>
        </div>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-10 bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Text className="text-white text-xs font-medium hidden sm:inline">
            Template: <strong>{docName}</strong> ({docNo})
          </Text>
        </div>
        <Space>
          <Button onClick={handleSaveDraft} loading={savingDraft} className="bg-white text-slate-900 font-semibold text-xs">
            Save Draft
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting} className="bg-indigo-500 hover:bg-indigo-600 font-semibold text-xs">
            Submit for Approval
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadWord} loading={downloading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs border-none">
            Download Word
          </Button>
        </Space>
      </div>
    </div>
  );
}
