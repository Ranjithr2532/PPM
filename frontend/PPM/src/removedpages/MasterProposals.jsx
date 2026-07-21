import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Table,
  Tooltip,
  Typography,
  message,
  DatePicker,
} from 'antd'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import AcknowledgeProposalsTable from './AcknowledgeProposalsTable'

import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { DISPLAY_DATE_FORMAT, formatDate, formatIndianNumber } from '../config/date.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { Title } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

const MASTER_FIELDS = [
  { name: 'quote_date', label: 'Quote Date' },
  { name: 'customer_name', label: 'Customer Name' },
  { name: 'description', label: 'Description' },
  { name: 'quote_amt', label: 'Quote Amount' },
  { name: 'reference', label: 'Reference' },
  { name: 'quotation_ref', label: 'Quotation Ref' },
  { name: 'indentor', label: 'Indentor' },
  { name: 'department', label: 'Department' },
  { name: 'contact_details', label: 'Contact Details' },
  { name: 'order_number', label: 'Order Number' },
  { name: 'date', label: 'Date' },
  { name: 'amount', label: 'Amount' },
]

// Helper function to convert Excel serial date to proper date
const excelSerialToDate = (serial) => {
  if (!serial || isNaN(serial)) return null
  // Excel serial date starts from 1900-01-01
  const excelEpoch = new Date(1899, 11, 30)
  const date = new Date(excelEpoch.getTime() + serial * 86400000)
  return dayjs(date).format('YYYY-MM-DD')
}

function MasterProposals() {
  const [form] = Form.useForm()
  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [searchText, setSearchText] = useState('')
  const [centerFilter, setCenterFilter] = useState(null)
  const [departmentFilter, setDepartmentFilter] = useState(null)
  const [quoteDateRange, setQuoteDateRange] = useState(null)

  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewingRecord, setViewingRecord] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [bulkImportLoading, setBulkImportLoading] = useState(false)

  const renderViewValue = useCallback(
    (fieldName, value) => {
      if (value === null || value === undefined || value === '') return '-'
      if (fieldName === 'quote_date' || fieldName === 'date') {
        return formatDate(value)
      }
      if (fieldName === 'quote_amt' || fieldName === 'amount') {
        return formatIndianNumber(value)
      }
      return String(value)
    },
    [],
  )

  const fetchProposals = useCallback(async () => {
    setTableLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/master_proposals/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch proposals')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload)
        ? payload.map((item) => ({ ...item, key: item.id }))
        : []
      setTableData(normalized)
      setFilteredData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch proposals')
    } finally {
      setTableLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  // Filters
  useEffect(() => {
    let filtered = [...tableData]

    if (searchText) {
      const s = searchText.trim().toLowerCase()
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(s),
        ),
      )
    }

    if (centerFilter) {
      filtered = filtered.filter((item) => item.center === centerFilter)
    }

    if (departmentFilter) {
      filtered = filtered.filter((item) => item.department === departmentFilter)
    }

    if (quoteDateRange && quoteDateRange.length === 2) {
      filtered = filtered.filter((item) => {
        if (!item.quote_date) return false
        const quoteDate = dayjs(item.quote_date)
        if (!quoteDate.isValid()) return false
        const start = quoteDateRange[0].startOf('day')
        const end = quoteDateRange[1].endOf('day')
        return (
          quoteDate.isSameOrAfter(start) && quoteDate.isSameOrBefore(end)
        )
      })
    }

    setFilteredData(filtered)
  }, [searchText, centerFilter, departmentFilter, quoteDateRange, tableData])

  const uniqueCenters = useMemo(() => {
    const centers = [
      ...new Set(tableData.map((item) => item.center).filter(Boolean)),
    ]
    return centers.sort()
  }, [tableData])

  const uniqueDepartments = useMemo(() => {
    const departments = [
      ...new Set(tableData.map((item) => item.department).filter(Boolean)),
    ]
    return departments.sort()
  }, [tableData])

  // Export to Excel (Master Proposals)
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning('No data to export')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item) => ({
        'Quote Date': item.quote_date || '',
        'Customer Name': item.customer_name || '',
        Description: item.description || '',
        'Quote Amount': item.quote_amt || '',
        Reference: item.reference || '',
        'Quotation Ref': item.quotation_ref || '',
        Indentor: item.indentor || '',
        Department: item.department || '',
        'Contact Details': item.contact_details || '',
        'Order Number': item.order_number || '',
        Date: item.date || '',
        Amount: item.amount || '',
      })),
    )

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Proposals')
    XLSX.writeFile(
      workbook,
      `master_proposals_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`,
    )
    message.success('Excel file downloaded successfully')
  }

  // Import preview helpers with date conversion
  const handleImportFileChange = (event) => {
    const file = event.target?.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false })
        const headers = rows[0] || []
        const body = rows.slice(1)
        setImportPreview({ headers, rows: body, sheetName: firstSheetName })
        setImportModalOpen(true)
        message.success('File loaded. Preview opened.')
      } catch (error) {
        console.error(error)
        message.error('Unable to read Excel file')
      } finally {
        if (event.target) {
          event.target.value = ''
        }
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleBulkImport = async () => {
    if (!importPreview?.rows?.length) {
      message.warning('No rows to import')
      return
    }
    setBulkImportLoading(true)

    try {
      const headerToField = {
        quotedate: 'quote_date',
        customername: 'customer_name',
        description: 'description',
        quoteamt: 'quote_amt',
        quoteamount: 'quote_amt',
        reference: 'reference',
        quotationref: 'quotation_ref',
        quotationreference: 'quotation_ref',
        indentor: 'indentor',
        department: 'department',
        contactdetails: 'contact_details',
        ordernumber: 'order_number',
        date: 'date',
        amount: 'amount',
      }

      const normalizeKey = (value) =>
        (value || '')
          .toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')

      const items = importPreview.rows.map((row) => {
        const obj = {}
        importPreview.headers.forEach((header, idx) => {
          const key = headerToField[normalizeKey(header)]
          if (!key) return

          const raw = row[idx]
          let value

          if (raw === null || raw === undefined || raw === '') {
            value = ''
          } else if (raw instanceof Date) {
            value = dayjs(raw).format('YYYY-MM-DD')
          } else if (key === 'quote_date' || key === 'date') {
            // Handle Excel serial dates for date fields
            const numVal = Number(raw)
            if (!isNaN(numVal) && numVal > 1000) {
              value = excelSerialToDate(numVal) || String(raw)
            } else {
              value = String(raw)
            }
          } else {
            value = String(raw)
          }

          obj[key] = value
        })

        // Ensure all required fields exist with empty string as default
        MASTER_FIELDS.forEach((field) => {
          if (!(field.name in obj)) {
            obj[field.name] = ''
          }
        })

        return obj
      })

      const response = await fetch(`${API_BASE_URL}/master_proposals/bulk`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Bulk import failed')
      }

      message.success('Master proposals imported successfully')
      await fetchProposals()
      setImportModalOpen(false)
      setImportPreview(null)
    } finally {
      setBulkImportLoading(false)
    }
  }

  const openViewModal = useCallback((record) => {
    setViewingRecord(record)
    setViewModalOpen(true)
  }, [])

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false)
    setViewingRecord(null)
  }, [])

  const openEditModal = useCallback(
    (record) => {
      setEditingRecord(record)
      form.setFieldsValue(record)
      setModalOpen(true)
    },
    [form],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    form.resetFields()
  }, [form])

  const handleSubmit = async (values) => {
    const payload = {}
    MASTER_FIELDS.forEach((field) => {
      payload[field.name] = values[field.name] ?? ''
    })
    const isEditing = Boolean(editingRecord)
    const url = isEditing
      ? `${API_BASE_URL}/master_proposals/${editingRecord.id}`
      : `${API_BASE_URL}/master_proposals/`
    const method = isEditing ? 'PUT' : 'POST'

    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Request failed')
      }
      await fetchProposals()
      message.success(isEditing ? 'Proposal updated' : 'Proposal created')
      closeModal()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to save proposal')
    }
  }

  const handleDelete = useCallback(
    async (record) => {
      setDeletingId(record.id)
      try {
        const response = await fetch(`${API_BASE_URL}/master_proposals/${record.id}`, {
          method: 'DELETE',
          headers: { accept: '*/*' },
        })
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || 'Failed to delete proposal')
        }
        message.success('Proposal deleted')
        await fetchProposals()
      } catch (error) {
        console.error(error)
        message.error(error.message || 'Unable to delete proposal')
      } finally {
        setDeletingId(null)
      }
    },
    [fetchProposals],
  )

  const columns = useMemo(
    () => [
      {
        title: 'SL NO',
        key: 'slno',
        width: 60,
        align: 'center',
        render: (text, record, index) => index + 1,
      },
      {
        title: 'Quotation Ref',
        dataIndex: 'quotation_ref',
        key: 'quotation_ref',
        ellipsis: true,
      },
      {
        title: 'Quote Date',
        dataIndex: 'quote_date',
        key: 'quote_date',
        width: 110,
        render: (value) => formatDate(value),
      },
      {
        title: 'Customer Name',
        dataIndex: 'customer_name',
        key: 'customer_name',
        ellipsis: true,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        ellipsis: {
          showTitle: true,
        },
        render: (value) => (
          <Tooltip title={value} placement="topLeft">
            <span className="description-cell">{value}</span>
          </Tooltip>
        ),
      },
      {
        title: 'Quote Amount',
        dataIndex: 'quote_amt',
        key: 'quote_amt',
        width: 120,
        align: 'right',
        render: (value) => formatIndianNumber(value),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 90,
        fixed: 'right',
        align: 'center',
        render: (_, record) => (
          <div className="flex justify-center items-center gap-1">
            <Tooltip title="View">
              <Button
                size="small"
                type="link"
                icon={<EyeOutlined />}
                onClick={() => openViewModal(record)}
                style={{ color: '#1890ff', padding: '0 2px' }}
              />
            </Tooltip>
            <Tooltip title="Edit">
              <Button
                size="small"
                type="link"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
                style={{ color: '#52c41a', padding: '0 2px' }}
              />
            </Tooltip>
            <Popconfirm
              title="Delete this proposal?"
              description="This action cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true, loading: deletingId === record.id, size: 'small' }}
              cancelText="Cancel"
              cancelButtonProps={{ size: 'small' }}
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title="Delete">
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === record.id}
                  style={{ padding: '0 2px' }}
                />
              </Tooltip>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [openViewModal, openEditModal, handleDelete, deletingId],
  )

  return (
    <>
      {/* Master Proposals Table - Responsive with fixed header on vertical scroll */}
      <div className="rounded-3xl bg-white p-4 md:p-6 shadow-sm mt-8">
        <AcknowledgeProposalsTable fetchProposalsTrigger={fetchProposals} />
      </div>

      {/* View Modal */}
      <Modal
        title="Master Proposal Details"
        open={viewModalOpen}
        onCancel={closeViewModal}
        footer={[
          <Button key="close" type="primary" onClick={closeViewModal}>
            Close
          </Button>,
        ]}
        maskClosable={false}
        width="90%"
        style={{ maxWidth: 900 }}
      >
        {viewingRecord && (
          <div className="grid gap-6">
            {/* Primary Information Section */}
            <Card
              title="Primary Information"
              size="small"
              className="bg-blue-50"
            >
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, sm: 2 }}
                items={[
                  {
                    key: 'quotation_ref',
                    label: 'Quotation Ref',
                    children: renderViewValue('quotation_ref', viewingRecord?.quotation_ref),
                  },
                  {
                    key: 'quote_date',
                    label: 'Quote Date',
                    children: renderViewValue('quote_date', viewingRecord?.quote_date),
                  },
                  {
                    key: 'customer_name',
                    label: 'Customer Name',
                    children: renderViewValue('customer_name', viewingRecord?.customer_name),
                  },
                  {
                    key: 'quote_amt',
                    label: 'Quote Amount',
                    children: renderViewValue('quote_amt', viewingRecord?.quote_amt),
                  },
                  {
                    key: 'description',
                    label: 'Description',
                    children: renderViewValue('description', viewingRecord?.description),
                    span: 2,
                  },
                ]}
              />
            </Card>

            {/* Additional Details Section */}
            <Card
              title="Additional Details"
              size="small"
              className="bg-gray-50"
            >
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, sm: 2 }}
                items={[
                  {
                    key: 'reference',
                    label: 'Reference',
                    children: renderViewValue('reference', viewingRecord?.reference),
                  },
                  {
                    key: 'indentor',
                    label: 'Indentor',
                    children: renderViewValue('indentor', viewingRecord?.indentor),
                  },
                  {
                    key: 'department',
                    label: 'Department',
                    children: renderViewValue('department', viewingRecord?.department),
                  },
                  {
                    key: 'contact_details',
                    label: 'Contact Details',
                    children: renderViewValue('contact_details', viewingRecord?.contact_details),
                  },
                ]}
              />
            </Card>

            {/* Order Information Section */}
            <Card
              title="Order Information"
              size="small"
              className="bg-green-50"
            >
              <Descriptions
                bordered
                size="small"
                column={{ xs: 1, sm: 2 }}
                items={[
                  {
                    key: 'order_number',
                    label: 'Order Number',
                    children: renderViewValue('order_number', viewingRecord?.order_number),
                  },
                  {
                    key: 'date',
                    label: 'Date',
                    children: renderViewValue('date', viewingRecord?.date),
                  },
                  {
                    key: 'amount',
                    label: 'Amount',
                    children: renderViewValue('amount', viewingRecord?.amount),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>

      {/* Edit / Add Modal */}
      <Modal
        title={editingRecord ? 'Edit Proposal' : 'Add Proposal'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => {
          form
            .validateFields()
            .then(handleSubmit)
            .catch(() => { })
        }}
        okText={editingRecord ? 'Update' : 'Create'}
        maskClosable={false}
        width="90%"
        style={{ maxWidth: 800 }}
      >
        <Form form={form} layout="vertical">
          {MASTER_FIELDS.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: 'Required' }] : []}
            >
              <Input />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* Import preview modal - Responsive */}
      <Modal
        title="Import Preview"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={[
          <Button key="delete" onClick={() => setImportModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="send"
            type="primary"
            loading={bulkImportLoading}
            onClick={handleBulkImport}
          >
            Import
          </Button>,
        ]}
        width="90%"
        style={{ maxWidth: 900 }}
      >
        {importPreview ? (
          <div className="max-h-96 overflow-auto border border-slate-200 rounded-md">
            <Table
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={
                (importPreview.headers || []).map((h, idx) => ({
                  title: h || `Col ${idx + 1}`,
                  dataIndex: String(idx),
                  key: String(idx),
                }))
              }
              dataSource={
                (importPreview.rows || []).map((row, rowIndex) => {
                  const obj = { key: rowIndex }
                  row.forEach((cell, colIndex) => {
                    obj[String(colIndex)] = cell
                  })
                  return obj
                })
              }
            />
          </div>
        ) : (
          <p>No preview available.</p>
        )}
      </Modal>
    </>
  )
}

export default MasterProposals