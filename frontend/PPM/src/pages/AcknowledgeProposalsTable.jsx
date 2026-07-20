import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
  message,
  DatePicker,
  Select,
  Row,
  Col,
  Popover,
  Card,
  Statistic
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'

import { ExcelRenderer } from 'react-excel-renderer'
import mammoth from 'mammoth'

import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { formatDate } from '../config/date.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)


const AcknowledgeProposalsTable = ({ fetchProposalsTrigger }) => {
  const [pendingProposals, setPendingProposals] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  // Document modal state
  const [stageConfig, setStageConfig] = useState([])
  const [docsModalVisible, setDocsModalVisible] = useState(false)
  const [projectDocs, setProjectDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)

  const [excelRendererData, setExcelRendererData] = useState(null)
  const [excelRendererLoading, setExcelRendererLoading] = useState(false)
  const [excelRendererError, setExcelRendererError] = useState(null)
  const [wordDocumentContent, setWordDocumentContent] = useState(null)
  const [wordDocumentLoading, setWordDocumentLoading] = useState(false)
  const [wordDocumentError, setWordDocumentError] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState('')

  const [expandedRowKeys, setExpandedRowKeys] = useState([])
  const [searchText, setSearchText] = useState('')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('ALL')

  const filteredProposals = useMemo(() => {
    return pendingProposals.filter((p) => {
      const matchesSearch = searchText
        ? [p.customer_name, p.quote_reference, p.quotation_given_by_name]
            .some(val => (val || '').toString().toLowerCase().includes(searchText.toLowerCase()))
        : true

      const matchesCustomerType = customerTypeFilter === 'ALL'
        ? true
        : (p.customer_type || '').toString().toLowerCase().trim().includes(customerTypeFilter.toLowerCase())

      return matchesSearch && matchesCustomerType
    })
  }, [pendingProposals, searchText, customerTypeFilter])

  const fetchPendingProposals = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/false`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to fetch pending proposals')
      const data = await response.json()
      const normalized = Array.isArray(data)
        ? data.map((item) => ({ ...item, key: item.id }))
        : []

      // Fetch all documents to compute per-proposal document counts
      try {
        const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
          headers: { accept: 'application/json' },
        })
        if (docsRes.ok) {
          const allDocs = await docsRes.json()
          const docsByProject = {}
            ; (Array.isArray(allDocs) ? allDocs : []).forEach((d) => {
              const pid = d.project_id
              if (pid != null) docsByProject[pid] = (docsByProject[pid] || 0) + 1
            })
          normalized.forEach((item) => {
            item._docCount = docsByProject[item.id] || 0
          })
        }
      } catch (docErr) {
        console.error('Failed to fetch document counts:', docErr)
      }

      setPendingProposals(normalized)
    } catch (error) {
      console.error(error)
      message.error('Unable to fetch pending proposals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        if (parsedUser?.role) {
          setCurrentUserRole(parsedUser.role)
        }
      }
    } catch (error) {
      console.error('Failed to read user from localStorage', error)
    }
  }, [])

  const isGuest = currentUserRole?.toLowerCase().trim() === 'guest'

  useEffect(() => {
    fetchPendingProposals()
    fetchStageConfig()
  }, [fetchPendingProposals])

  const fetchStageConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stages/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch stage configuration')
      const data = await res.json()
      setStageConfig(Array.isArray(data) ? data.map((item) => ({ ...item, key: item.id })) : [])
    } catch (error) {
      console.error('Error fetching stage configuration:', error)
    }
  }, [])

  const fetchProjectDocuments = useCallback(async (projectId) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch documents')
      const data = await res.json()
      const docs = Array.isArray(data) ? data : []

      const filtered = docs.filter((d) => d.project_id === projectId)

      const sortedByDate = [...filtered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      )

      const withVersions = sortedByDate.map((d, idx) => {
        const stage = stageConfig.find((s) => s.id === d.stage_id)
        const stageName = stage?.name || 'Document'
        return {
          ...d,
          version: d.version || (idx + 1),
          display_name: d.name || `${stageName} v${d.version || (idx + 1)}`,
        }
      })

      setProjectDocs(withVersions)
    } catch (err) {
      console.error('Error fetching project documents:', err)
      message.error(err.message || 'Unable to load documents')
      setProjectDocs([])
    } finally {
      setDocsLoading(false)
    }
  }, [stageConfig])

  const openDocsModal = useCallback(async (projectId) => {
    setDocsModalVisible(true)
    await fetchProjectDocuments(projectId)
  }, [fetchProjectDocuments])

  // const viewDocument = useCallback((doc) => {
  //   if (!doc?.url) {
  //     return message.error('Document URL is not available')
  //   }
  //   setViewDocumentUrl(doc.url)
  // }, [])

  const loadExcelWithRenderer = async (url) => {
    setExcelRendererLoading(true)
    setExcelRendererError(null)
    setExcelRendererData(null)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch Excel file: ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], 'excel.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      ExcelRenderer(file, (err, resp) => {
        if (err) {
          setExcelRendererError(`Failed to parse Excel file: ${err.message || err}`)
          setExcelRendererLoading(false)
        } else {
          setExcelRendererData(resp)
          setExcelRendererLoading(false)
        }
      })
    } catch (error) {
      setExcelRendererError(`Error loading Excel file: ${error.message}`)
      setExcelRendererLoading(false)
    }
  }

  const loadWordDocument = async (url) => {
    setWordDocumentLoading(true)
    setWordDocumentError(null)
    setWordDocumentContent(null)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch Word document: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      setWordDocumentContent(result.value)
      setWordDocumentLoading(false)
    } catch (error) {
      setWordDocumentError(`Error loading Word document: ${error.message}`)
      setWordDocumentLoading(false)
    }
  }

  const viewDocument = useCallback((doc) => {
    if (!doc?.url) {
      return message.error('Document URL is not available')
    }
    const url = doc.url
    setViewDocumentUrl(url)
    setExcelRendererData(null)
    setExcelRendererError(null)
    setWordDocumentContent(null)
    setWordDocumentError(null)

    const urlNoQuery = url.split('#')[0].split('?')[0]
    const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()

    if (ext === 'xlsx' || ext === 'xls') {
      loadExcelWithRenderer(url)
    } else if (ext === 'docx' || ext === 'doc') {
      loadWordDocument(url)
    }
  }, [])

  // Refresh when master proposals are updated (optional sync)
  useEffect(() => {
    fetchPendingProposals()
  }, [fetchProposalsTrigger])

  const handleAcknowledge = async (id, acknowledge = true) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/acknowledge/${id}`, {
        method: 'PUT',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_acknowledged: acknowledge }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Failed to update acknowledgement')
      }

      message.success(acknowledge ? 'Proposal accepted' : 'Proposal rejected')
      fetchPendingProposals()  // Refresh pending list
      fetchProposalsTrigger()  // Refresh master proposals if needed
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Failed to update acknowledgement')
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  // Essential columns shown directly in the row
  const pendingColumns = [
    {
      title: 'Enquiry Date',
      dataIndex: 'enquiry_date',
      key: 'enquiry_date',
      width: 120,
      render: (text) => formatDate(text),
    },
    { title: 'Customer Name', dataIndex: 'customer_name', key: 'customer_name', width: 180, ellipsis: true },
    {
      title: 'Customer Type',
      dataIndex: 'customer_type',
      key: 'customer_type',
      width: 130,
      render: (value) => {
        if (!value) return '-'
        const normalized = String(value).toLowerCase().trim()
        let bg = '#F3F4F6'
        let color = '#374151'
        if (normalized.includes('private')) {
          bg = '#DCFCE7'
          color = '#15803D'
        } else if (normalized.includes('govt') || normalized.includes('government') || normalized.includes('public')) {
          bg = '#E0F2FE'
          color = '#0369A1'
        }
        return (
          <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: bg, color: color }}>
            {value}
          </span>
        )
      }
    },
    { title: 'Quote Reference', dataIndex: 'quote_reference', key: 'quote_reference', width: 160, ellipsis: true },
    {
      title: 'Quote Date',
      dataIndex: 'quote_date',
      key: 'quote_date',
      render: (text) => formatDate(text),
      width: 120,
    },
    { title: 'Quote Amount', dataIndex: 'quote_amount', key: 'quote_amount', width: 130 },
    { title: 'Quotation By', dataIndex: 'quotation_given_by_name', key: 'quotation_given_by_name', width: 150 },
    {
      key: 'enquiry_documents',
      title: 'Documents',
      width: 140,
      render: (_, record) => {
        const count = record._docCount
        if (count === undefined) return <span style={{ color: '#999' }}>-</span>
        if (count > 0) {
          return (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDocsModal(record.id)}>
              View ({count})
            </Button>
          )
        }
        return <span style={{ color: '#999' }}>No documents</span>
      },
    },
    ...(!isGuest
      ? [
        {
          title: 'Action',
          key: 'action',
          fixed: 'right',
          width: 200,
          render: (_, record) => (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                loading={actionLoading[record.id]}
                onClick={() => handleAcknowledge(record.id, true)}
              >
                Accept
              </Button>
              <Popconfirm
                title="Reject this proposal?"
                description="This will acknowledge it as rejected."
                onConfirm={() => handleAcknowledge(record.id, false)}
                okText="Reject"
                okButtonProps={{ danger: true }}
              >
                <Button danger size="small" loading={actionLoading[record.id]}>
                  Reject
                </Button>
              </Popconfirm>
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined style={{ fontSize: 16, color: '#1890ff' }} />}
                onClick={() =>
                  setExpandedRowKeys((prev) =>
                    prev.includes(record.key) ? [] : [record.key],
                  )
                }
              />
            </Space>
          ),
        },
      ]
      : []),
  ]

  // Everything else lives here, revealed by clicking the row's expand arrow
  const renderExpandedRow = (record) => (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-inner">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Contact Details */}
        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
          <div className="font-semibold text-xs text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2">
            Contact Details
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Address</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.address || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Phone</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.phone_no || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Email</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.email || '-'}</div>
          </div>
        </div>

        {/* Column 2: Proposal Specs */}
        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
          <div className="font-semibold text-xs text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2">
            Proposal Specs
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Request Type</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.request_type || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Department</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.quotation_given_by_department || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Email Ref</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.email_reference || '-'}</div>
          </div>
        </div>

        {/* Column 3: Financial Adjustments */}
        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
          <div className="font-semibold text-xs text-emerald-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2">
            Financial Adjustments
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Revised Date</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{formatDate(record['revised/negotiated_quote_date']) || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Revised Amount</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record['revised/negotiated_quote_amount'] || '-'}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Description</div>
            <div className="text-slate-800 font-medium text-sm mt-0.5">{record.quote_description || '-'}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-100">
        <Typography.Title level={3} className="!mb-0 flex flex-wrap items-center gap-2 text-slate-800">
          Acknowledge Proposals Submitted by Project Coordinators
          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
            {pendingProposals.length} Pending
          </span>
        </Typography.Title>
        <div className="flex items-center gap-3">
          <Input.Search
            placeholder="Search proposals..."
            allowClear
            size="middle"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={setSearchText}
            style={{ width: 260 }}
            className="rounded-lg"
          />
          <Select
            placeholder="Filter Customer Type"
            value={customerTypeFilter}
            onChange={setCustomerTypeFilter}
            style={{ width: 185 }}
            className="rounded-lg"
            options={[
              { label: 'All Customer Types', value: 'ALL' },
              { label: 'Government (Govt)', value: 'Govt' },
              { label: 'Private', value: 'Private' }
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto acknowledge-table">
        <Table
          rowKey="key"
          columns={pendingColumns}
          dataSource={filteredProposals}
          loading={loading}
          pagination={{ pageSize: 15 }}
          bordered
          scroll={{ y: 500 }}
          sticky
          expandable={{
            expandedRowRender: renderExpandedRow,
            expandedRowKeys: expandedRowKeys,
            onExpand: (expanded, record) => {
              setExpandedRowKeys(expanded ? [record.key] : [])
            },
            showExpandColumn: false,
          }}
          locale={{ emptyText: 'No pending proposals to acknowledge' }}
        />
      </div>

      <style>{`
        .acknowledge-table .ant-table-thead > tr > th {
          color: #334155 !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          background-color: #f8fafc !important;
        }
        .acknowledge-table .ant-table-tbody > tr:hover > td {
          background-color: #f1f5f9 !important;
        }
      `}</style>

      {/* Uploaded Documents (Version List) Modal */}
      <Modal
        title="Uploaded Enquiry Documents"
        open={docsModalVisible}
        onCancel={() => setDocsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDocsModalVisible(false)}>Close</Button>,
        ]}
        width={700}
        maskClosable={false}
      >
        <Table
          rowKey="id"
          dataSource={projectDocs}
          loading={docsLoading}
          pagination={false}
          columns={[
            {
              title: 'Version',
              dataIndex: 'version',
              key: 'version',
              width: 80,
              render: (v) => (v ? `v${v}` : '-'),
            },
            {
              title: 'Name',
              dataIndex: 'display_name',
              key: 'name',
            },
            {
              title: 'Uploaded By',
              dataIndex: 'uploaded_by',
              key: 'uploaded_by',
              width: 150,
            },
            {
              title: 'Uploaded At',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (value) => (value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '-'),
            },
            {
              title: 'View',
              key: 'view',
              width: 80,
              render: (_, record) => (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => viewDocument(record)}
                />
              ),
            },
            {
              title: 'Attachments',
              dataIndex: 'attachment',
              key: 'attachment',
              width: 160,
              render: (attachments) => {
                if (!attachments || attachments.length === 0) {
                  return <span style={{ color: '#999' }}>-</span>
                }
                const VISIBLE_LIMIT = 2
                const visible = attachments.slice(0, VISIBLE_LIMIT)
                const overflow = attachments.slice(VISIBLE_LIMIT)

                const overflowContent = (
                  <Space direction="vertical" size={4}>
                    {overflow.map((url, idx) => (
                      <a
                        key={idx}
                        onClick={() => viewDocument({ url })}
                        style={{ fontSize: 12, cursor: 'pointer' }}
                      >
                        Attachment {VISIBLE_LIMIT + idx + 1}
                      </a>
                    ))}
                  </Space>
                )

                return (
                  <Space direction="vertical" size={2}>
                    {visible.map((url, idx) => (
                      <a
                        key={idx}
                        onClick={() => viewDocument({ url })}
                        style={{ fontSize: 12, cursor: 'pointer' }}
                      >
                        Attachment {idx + 1}
                      </a>
                    ))}
                    {overflow.length > 0 && (
                      <Popover
                        content={overflowContent}
                        title="More attachments"
                        trigger="click"
                        placement="right"
                      >
                        <a style={{ fontSize: 12, cursor: 'pointer' }}>
                          +{overflow.length} more
                        </a>
                      </Popover>
                    )}
                  </Space>
                )
              },
            },



          ]}
        />
        {(!docsLoading && !projectDocs.length) && (
          <div className="text-center text-gray-500 mt-4">No documents uploaded yet.</div>
        )}
      </Modal>

      <Modal
        title="Document Viewer"
        open={!!viewDocumentUrl}
        onCancel={() => {
          setViewDocumentUrl(null)
          setExcelRendererData(null)
          setExcelRendererError(null)
          setWordDocumentContent(null)
          setWordDocumentError(null)
        }}
        footer={null}
        width={1100}
      >
        {(() => {
          const currentUrl = viewDocumentUrl || ''
          const ext = (currentUrl.split('#')[0].split('?')[0].split('.').pop() || '').toLowerCase()

          if (!currentUrl) return null

          if (ext === 'xlsx' || ext === 'xls') {
            if (excelRendererLoading) return <div className="text-center py-10">Loading Excel file...</div>
            if (excelRendererError) {
              return (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">{excelRendererError}</p>
                  <Button type="primary" onClick={() => window.open(currentUrl, '_blank')}>Download Excel File</Button>
                </div>
              )
            }
            if (excelRendererData) {
              const rows = excelRendererData.rows || []
              const cols = excelRendererData.cols || []
              return rows.length > 0 ? (
                <div className="h-[70vh] overflow-auto border rounded">
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {cols.map((col, i) => (
                          <th key={i} style={{ border: '1px solid #d9d9d9', padding: 6, background: '#f5f5f5' }}>
                            {col.name || `Column ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ border: '1px solid #d9d9d9', padding: 6 }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="text-center py-10 text-gray-500">No data found in Excel file</div>
            }
            return <div className="text-center py-10">Loading Excel file...</div>
          }

          if (ext === 'docx' || ext === 'doc') {
            if (wordDocumentLoading) return <div className="text-center py-10">Loading Word document...</div>
            if (wordDocumentError) {
              return (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">{wordDocumentError}</p>
                  <Button type="primary" onClick={() => window.open(currentUrl, '_blank')}>Download Document</Button>
                </div>
              )
            }
            if (wordDocumentContent) {
              return (
                <div
                  className="h-[70vh] overflow-auto border rounded p-6 bg-white"
                  dangerouslySetInnerHTML={{ __html: wordDocumentContent }}
                />
              )
            }
            return <div className="text-center py-10">Loading Word document...</div>
          }

          return <iframe src={currentUrl} className="w-full h-[80vh]" title="Document" />
        })()}
      </Modal>
    </div>
  )
}


export default AcknowledgeProposalsTable;