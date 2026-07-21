import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EditOutlined,
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Descriptions,
  Typography,
  message,
  DatePicker,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  AutoComplete,
  Radio,
  Tooltip,
} from 'antd'
import * as XLSX from 'xlsx'
import { ExcelRenderer } from 'react-excel-renderer'
import mammoth from 'mammoth'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { DISPLAY_DATE_FORMAT, formatDate } from '../config/date.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { Title, Text } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

const CUSTOMER_TYPE_OPTIONS = [
  'Govt',
  'Private',
  'MHI',
  'MSME',
  'Educational institute',
]

const REQUEST_TYPE_OPTIONS = [
  'Call for Proposal',
  'Mail',
  'Discussion',
  'WhatsApp',
  'Visit',
]

// Slim columns for CH (matching GH restricted view)
const TABLE_FIELDS = [
  { name: 'id', label: 'SL NO', width: 50, render: (text, record, index) => index + 1 },
  { name: 'project_number', label: 'Project Number', width: 100 },
  { name: 'activity', label: 'Project Name', width: 140 },
  { name: 'customer_name', label: 'Customer Name', width: 120 },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 100 },
  { name: 'project_co_ordinator', label: 'Project Co-ordinator', width: 120 },
]

// All fields for data mapping (internal use)
const ALL_FIELDS = [
  { name: 'id', label: 'ID (PK)', width: 80, inForm: false },
  { name: 'enquiry_date', label: 'Enquiry Date', width: 150 },
  { name: 'customer_type', label: 'Customer Type', width: 170 },
  { name: 'customer_name', label: 'Customer Name', width: 170 },
  { name: 'address', label: 'Address', width: 240 },
  { name: 'email', label: 'Email', width: 200 },
  { name: 'phone_no', label: 'Phone No.', width: 150 },
  { name: 'alternate_contact_details', label: 'Alternate Contact', width: 220 },
  { name: 'request_type', label: 'Request Type', width: 160 },
  { name: 'email_reference', label: 'Email Reference', width: 200 },
  { name: 'quote_reference', label: 'Quote Reference', width: 190 },
  { name: 'quote_description', label: 'Quote Description', width: 240 },
  { name: 'quote_date', label: 'Quote Date', width: 140 },
  { name: 'quote_amount', label: 'Quote Amount', width: 160 },
  { name: 'revised_negotiated', label: 'Revised / Negotiated', width: 190, apiName: 'revised/negotiated' },
  { name: 'revised_negotiated_quote_date', label: 'Revised Quote Date', width: 190, apiName: 'revised/negotiated_quote_date' },
  { name: 'revised_negotiated_quote_amount', label: 'Revised Quote Amount', width: 210, apiName: 'revised/negotiated_quote_amount' },
  { name: 'quotation_given_by_name', label: 'Quotation Given By', width: 200 },
  { name: 'quotation_given_by_department', label: 'Department', width: 180 },
  { name: 'proposals_converted', label: 'Proposals Converted', width: 180, input: 'select' },
  { name: 'if_not_reason', label: 'If Not Reason', width: 200, input: 'textarea' },
  { name: 'project_number', label: 'Project Number', width: 140 },
  { name: 'party_name', label: 'Party Name', width: 200 },
  { name: 'activity', label: 'Activity', width: 160 },
  { name: 'key_deliverables', label: 'Key Deliverables', width: 240 },
  { name: 'order_number', label: 'Order Number', width: 150 },
  { name: 'order_date', label: 'Order Date', width: 150 },
  { name: 'delivery_date', label: 'Delivery Date', width: 160 },
  { name: 'extended_delivery_date', label: 'Extended Delivery', width: 190 },
  { name: 'date_of_actual_commencement', label: 'Actual Commencement', width: 210 },
  { name: 'order_value', label: 'Order Value', width: 170 },
  { name: 'details_of_external_internal_review_meeting', label: 'Review Meeting Details', width: 260 },
  { name: 'project_co_ordinator', label: 'Project Coordinator', width: 200 },
  { name: 'center', label: 'Centre', width: 150 },
  { name: 'coordinator_remarks', label: 'Coordinator Remarks', width: 220 },
  { name: 'closure_report', label: 'Closure Report', width: 200, input: 'textarea' },
  { name: 'technical_completed_year', label: 'Technical Completion Year', width: 220 },
  { name: 'financial_completed_year', label: 'Financial Completion Year', width: 220 },
  { name: 'status', label: 'Status', width: 150 },
  { name: 'proposal_status', label: 'Proposal Status', width: 160 },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 160 },
  { name: 'ppm_remarks', label: 'PPM Remarks', width: 200 },
  { name: 'created_at', label: 'Created At', width: 190 },
  { name: 'updated_at', label: 'Updated At', width: 190 },
  { name: 'updated_by', label: 'Updated By', width: 150 },
  { name: 'group', label: 'Group', width: 150 },
  { name: 'is_acknowledged', label: 'Is Acknowledged', width: 150 },
]

const getApiName = (name) => {
  const field = ALL_FIELDS.find((item) => item.name === name)
  return field?.apiName ?? name
}

const uniqueKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const mapApiToUi = (record) => {
  const mapped = {}
  ALL_FIELDS.forEach((field) => {
    const apiName = getApiName(field.name)
    mapped[field.name] = record?.[apiName] ?? ''
  })
  mapped.key = record?.id ?? uniqueKey()
  return mapped
}

const calculateOverdueDays = (deliveryDate, extendedDelivery) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const referenceDate = extendedDelivery
    ? new Date(extendedDelivery)
    : deliveryDate
      ? new Date(deliveryDate)
      : null

  if (!referenceDate || isNaN(referenceDate.getTime())) return null

  const diffMs = today - referenceDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
}

const wrapWithTooltip = (content, maxLength = 30) => {
  if (!content || typeof content !== 'string') return content || '-'
  const displayText = content.length > maxLength ? `${content.substring(0, maxLength)}...` : content
  return (
    <Tooltip title={content} placement="topLeft">
      <span>{displayText}</span>
    </Tooltip>
  )
}

// Helper function to check if proposals_converted is Yes
const isProposalConverted = (proposalsConverted) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue === 'yes'
}

function Proposals() {
  const [form] = Form.useForm()
  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [remarksModalOpen, setRemarksModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [remarksTarget, setRemarksTarget] = useState('admin')
  const [remarksDescription, setRemarksDescription] = useState('')
  const [remarksLoading, setRemarksLoading] = useState(false)
  
  // Queries state for CH users
  const [queriesModalOpen, setQueriesModalOpen] = useState(false)
  const [queriesData, setQueriesData] = useState([])
  const [queriesLoading, setQueriesLoading] = useState(false)
  const [selectedProjectForQueries, setSelectedProjectForQueries] = useState(null)
  const [allQueries, setAllQueries] = useState([])
  const [searchText, setSearchText] = useState('')
  const [centerFilter, setCenterFilter] = useState(null)
  const [groupFilter, setGroupFilter] = useState(null)
  const [orderDateRange, setOrderDateRange] = useState(null)
  const [enquiryDateRange, setEnquiryDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [projectNumberFilter, setProjectNumberFilter] = useState(null)
  const [currentUserName, setCurrentUserName] = useState('')
  const [currentUserCenter, setCurrentUserCenter] = useState('')
  const [currentUserGroup, setCurrentUserGroup] = useState('')
  const [proposalCount, setProposalCount] = useState(0)
  const [stats, setStats] = useState({
    totalProposals: 0,
    totalProjects: 0,
    technicallyCompleted: 0,
    financiallyCompleted: 0,
    ongoingProjects: 0
  })
  const [customerOptions, setCustomerOptions] = useState([])

  // Unacknowledged proposals state
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false)
  const [originalTableData, setOriginalTableData] = useState([])

  // Document modal state
  const [stageConfig, setStageConfig] = useState([])
  const [docsModalVisible, setDocsModalVisible] = useState(false)
  const [projectDocs, setProjectDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)
  const [excelRendererData, setExcelRendererData] = useState(null)
  const [excelRendererLoading, setExcelRendererLoading] = useState(false)
  const [excelRendererError, setExcelRendererError] = useState(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [wordDocumentContent, setWordDocumentContent] = useState(null)
  const [wordDocumentLoading, setWordDocumentLoading] = useState(false)
  const [wordDocumentError, setWordDocumentError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const fetchProposals = useCallback(async () => {
    setTableLoading(true)

    let center = null
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        center = parsedUser?.center?.trim().toLowerCase() || null
      }
    } catch (err) {
      console.error('Failed to parse ppm_user from localStorage', err)
    }

    if (!center) {
      message.error('User center not found. Please log in again.')
      setTableLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proposals/by-centre/${center}`, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch proposals for center "${center}": ${response.status} ${errorText}`)
      }

      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload.map(mapApiToUi) : []

      // Fetch all documents to compute per-proposal document counts (Enquiry stage only)
      try {
        // First fetch stage config to identify Enquiry stage
        const stagesRes = await fetch(`${API_BASE_URL}/stages/`, {
          headers: { accept: 'application/json' },
        })
        let enquiryStageId = null
        if (stagesRes.ok) {
          const stages = await stagesRes.json()
          const enquiryStage = (Array.isArray(stages) ? stages : []).find(
            (s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry',
          )
          enquiryStageId = enquiryStage?.id
        }

        const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
          headers: { accept: 'application/json' },
        })
        if (docsRes.ok) {
          const allDocs = await docsRes.json()
          const docsByProject = {}
            ; (Array.isArray(allDocs) ? allDocs : []).forEach((d) => {
              const pid = d?.project_id ?? d?.project ?? d?.projectId
              if (pid == null) return
              // Only count Enquiry stage documents
              if (enquiryStageId) {
                const docStageId = d?.stage_id ?? d?.stage ?? d?.stageId
                if (docStageId == null || String(docStageId) !== String(enquiryStageId)) return
              }
              docsByProject[pid] = (docsByProject[pid] || 0) + 1
            })
          normalized.forEach((item) => {
            item._docCount = docsByProject[item.id] || 0
          })
        }
      } catch (docErr) {
        console.error('Failed to fetch document counts:', docErr)
      }

      setTableData(normalized)
      setFilteredData(normalized)
      setOriginalTableData(normalized)
    } catch (error) {
      console.error('Fetch proposals error:', error)
      message.error(error.message || 'Unable to fetch proposals for your center')
      setTableData([])
      setFilteredData([])
    } finally {
      setTableLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    let center = ''
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        center = parsedUser?.center || ''
      }
    } catch (err) {
      console.error('Failed to parse ppm_user from localStorage', err)
    }

    if (!center) {
      return
    }

    try {
      const encodedCenter = encodeURIComponent(center)
      const response = await fetch(`${API_BASE_URL}/proposals/stats/by-center/${encodedCenter}`, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Unable to fetch proposal stats')
      }

      const payload = await response.json()
      setStats(payload)

      try {
        const countResponse = await fetch(`${API_BASE_URL}/proposals/count/by-centre/${encodedCenter}`, {
          headers: { accept: 'application/json' },
        })
        if (countResponse.ok) {
          const countPayload = await countResponse.json()
          setProposalCount(countPayload?.count ?? 0)
        } else {
          setProposalCount(0)
        }
      } catch (countError) {
        console.error(countError)
        setProposalCount(0)
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

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

  const fetchUnacknowledgedCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/unacknowledged`, {
        headers: { accept: 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        const count = Array.isArray(data) ? data.length : 0
        setUnacknowledgedCount(count)
      }
    } catch (error) {
      console.error('Failed to fetch unacknowledged count:', error)
    }
  }

  const fetchUnacknowledgedProposals = async () => {
    setTableLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/unacknowledged`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Unable to fetch unacknowledged proposals')
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload.map(mapApiToUi) : []
      setTableData(normalized)
      setFilteredData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch unacknowledged proposals')
    } finally {
      setTableLoading(false)
    }
  }

  const handleUnacknowledgedToggle = () => {
    if (showUnacknowledgedOnly) {
      setShowUnacknowledgedOnly(false)
      setTableData(originalTableData)
      setFilteredData(originalTableData)
      fetchProposals()
    } else {
      if (!unacknowledgedCount) {
        message.info('No unacknowledged proposals')
        return
      }
      setShowUnacknowledgedOnly(true)
      fetchUnacknowledgedProposals()
    }
  }

  const fetchProjectDocuments = useCallback(async (projectId) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch documents')
      const data = await res.json()
      const docs = Array.isArray(data) ? data : []

      const enquiryStage = stageConfig.find(
        (s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry',
      )
      const enquiryStageId = enquiryStage?.id

      const projectDocsRaw = docs.filter((d) => {
        const docProjectId = d?.project_id ?? d?.project ?? d?.projectId
        if (docProjectId == null || projectId == null) return false
        return String(docProjectId) === String(projectId)
      })

      const filtered = projectDocsRaw

      const sortedByDate = [...filtered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      )

      const withVersions = sortedByDate.map((d) => ({
        ...d,
        display_name: d.name || d.version || 'Document',
      }))

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

  useEffect(() => {
    if (!detailModalOpen) return
    if (!selectedRecord?.id) return
    fetchProjectDocuments(selectedRecord.id)
  }, [detailModalOpen, selectedRecord, fetchProjectDocuments])

  const viewDocument = useCallback((doc) => {
    const raw = doc?.url || doc?.file
    if (!raw) {
      return message.error('Document URL is not available')
    }
    const url = /^https?:\/\//i.test(raw)
      ? raw
      : `${API_BASE_URL}${String(raw).startsWith('/') ? '' : '/'}${raw}`
    setViewDocumentUrl(url)
  }, [])

  const loadExcelWithRenderer = async (url) => {
    setExcelRendererLoading(true)
    setExcelRendererError(null)
    setExcelRendererData(null)

    try {
      console.log('Loading Excel file with react-excel-renderer:', url)
      
      // Fetch the Excel file
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch Excel file: ${response.status}`)
      }
      
      const blob = await response.blob()
      
      // Use react-excel-renderer to parse the file
      const file = new File([blob], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      ExcelRenderer(file, (err, resp) => {
        if (err) {
          console.error('ExcelRenderer error:', err)
          setExcelRendererError(`Failed to parse Excel file: ${err.message || err}`)
          setExcelRendererLoading(false)
        } else {
          console.log('ExcelRenderer success:', resp)
          console.log('Rows structure:', resp.rows?.[0])
          console.log('Cols structure:', resp.cols)
          
          // Check if multiple sheets are available
          if (resp.sheets && resp.sheets.length > 1) {
            console.log('Multiple sheets found:', resp.sheets.map(s => s.name))
          }
          
          setExcelRendererData(resp)
          setActiveSheetIndex(0)
          setExcelRendererLoading(false)
        }
      })
      
    } catch (error) {
      console.error('Error loading Excel file:', error)
      setExcelRendererError(`Error loading Excel file: ${error.message}`)
      setExcelRendererLoading(false)
    }
  }

  const loadWordDocument = async (url) => {
    setWordDocumentLoading(true)
    setWordDocumentError(null)
    setWordDocumentContent(null)

    try {
      console.log('Loading Word document with mammoth.js:', url)
      
      // Fetch the Word document
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch Word document: ${response.status}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      
      // Use mammoth.js to convert Word document to HTML
      const result = await mammoth.convertToHtml(
        { arrayBuffer: arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Title'] => h1.title:fresh",
            "b => strong",
            "i => em"
          ]
        }
      )
      
      console.log('Mammoth.js conversion success:', result)
      setWordDocumentContent(result.value)
      setWordDocumentLoading(false)
      
    } catch (error) {
      console.error('Error loading Word document:', error)
      setWordDocumentError(`Error loading Word document: ${error.message}`)
      setWordDocumentLoading(false)
    }
  }

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        if (parsedUser && parsedUser.name) {
          setCurrentUserName(parsedUser.name)
          setCurrentUserCenter(parsedUser.center || '')
          setCurrentUserGroup(parsedUser.group || '')
        }
      }
    } catch (error) {
      console.error('Failed to read user from localStorage', error)
    }

    fetchProposals()
    fetchStats()
    fetchStageConfig()
    fetchUnacknowledgedCount()
  }, [fetchProposals, fetchStats, fetchStageConfig])

  // Load Excel/Word files when viewDocumentUrl changes
  useEffect(() => {
    const currentUrl = viewDocumentUrl || ''
    if (!currentUrl) return
    
    const urlNoQuery = currentUrl.split('#')[0].split('?')[0]
    const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
    const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
    const isOffice = officeTypes.includes(ext)

    if (isOffice) {
      if (ext === 'xlsx' || ext === 'xls') {
        loadExcelWithRenderer(currentUrl)
      } else if (ext === 'docx' || ext === 'doc') {
        loadWordDocument(currentUrl)
      }
    }
  }, [viewDocumentUrl])

  // Fetch all queries for the table
  useEffect(() => {
    const fetchAllQueries = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
          headers: { accept: 'application/json' },
        })
        if (response.ok) {
          const data = await response.json()
          setAllQueries(data)
        }
      } catch (error) {
        console.error('Error fetching all queries:', error)
      }
    }
    
    fetchAllQueries()
  }, [])

  const openDetailModal = useCallback((record) => {
    setSelectedRecord(record)
    setDetailModalOpen(true)
  }, [])

  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false)
    setSelectedRecord(null)
  }, [])

  const openEditModal = useCallback(
    (record) => {
      setEditingRecord(record)
      form.setFieldsValue({ ...record, updated_by: currentUserName || record.updated_by })
      setModalOpen(true)
    },
    [form, currentUserName],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    form.resetFields()
    setCustomerOptions([])
  }, [form])

  const openRemarksModal = useCallback((record) => {
    setSelectedRecord(record)
    setRemarksTarget('admin')
    setRemarksModalOpen(true)
  }, [])

  const closeRemarksModal = useCallback(() => {
    setRemarksModalOpen(false)
    setSelectedRecord(null)
    setRemarksTarget('admin')
    setRemarksDescription('')
  }, [])

  // Queries functionality for CH users
  const fetchQueriesForProject = useCallback(async (projectId) => {
    setQueriesLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to fetch queries')
      
      const allQueriesData = await response.json()
      
      // Filter queries for this specific project
      const projectQueries = projectId 
        ? allQueriesData.filter(query => String(query.project_id) === String(projectId))
        : []
      
      // Sort queries by date (newest first) for modal display
      const sortedQueries = projectQueries.sort((a, b) => {
        try {
          const dateA = new Date(a.updated_at).getTime()
          const dateB = new Date(b.updated_at).getTime()
          return dateB - dateA
        } catch {
          return 0
        }
      })
      
      setQueriesData(sortedQueries)
    } catch (error) {
      console.error('Error fetching queries:', error)
      message.error('Failed to fetch queries')
      setQueriesData([])
    } finally {
      setQueriesLoading(false)
    }
  }, [])

  const openQueriesModal = useCallback(async (record) => {
    setSelectedProjectForQueries(record)
    setQueriesModalOpen(true)
    await fetchQueriesForProject(record.id)
  }, [fetchQueriesForProject])

  const closeQueriesModal = useCallback(() => {
    setQueriesModalOpen(false)
    setQueriesData([])
    setSelectedProjectForQueries(null)
  }, [])

  // Search customers by name
  const searchCustomers = useCallback(async (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) {
      setCustomerOptions([])
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/customers/search?name=${encodeURIComponent(searchValue.trim())}`,
        { headers: { accept: 'application/json' } }
      )

      if (!response.ok) throw new Error('Failed to search customers')

      const customers = await response.json()
      const options = customers.map((customer) => ({
        value: customer.name,
        label: `${customer.name} ${customer.customer_type ? `(${customer.customer_type})` : ''}`,
        customer: customer,
      }))
      setCustomerOptions(options)
    } catch (error) {
      console.error('Customer search error:', error)
      setCustomerOptions([])
    }
  }, [])

  // Handle customer selection - auto-fill related fields
  const handleCustomerSelect = useCallback((value, option) => {
    const customer = option?.customer
    if (customer) {
      form.setFieldsValue({
        customer_name: customer.name,
        customer_type: customer.customer_type || '',
        address: customer.address || '',
        email: customer.email || '',
        phone_no: customer.phone_no || '',
        alternate_contact_details: customer.alternate_contact_details || '',
      })
    }
  }, [form])

  const handleSubmit = async (values) => {
    if (!editingRecord) {
      await handleCreate(values)
      return
    }

    if (!editingRecord?.id) {
      message.error('No record selected for editing')
      return
    }

    setSubmitLoading(true)

    const payload = {
      project_id: editingRecord.id,
      extended_delivery_date: values.extended_delivery_date || '',
      co_ordinator_remarks: values.co_ordinator_remarks || '',
      technical_completed_year: values.technical_completed_year || null,
      proposal_status: values.proposal_status || '',
      updated_by: values.updated_by || localStorage.getItem('loggedInUser') || '',
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proposals/coordinator-update`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || 'Failed to update proposal')
      }

      message.success('Proposal updated successfully')
      closeModal()
      await fetchProposals()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to update proposal')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCreate = async (values) => {
    setSubmitLoading(true)
    try {
      const createFields = [
        'enquiry_date', 'customer_type', 'customer_name', 'address', 'email', 'phone_no',
        'alternate_contact_details', 'request_type', 'email_reference', 'quote_reference',
        'quote_description', 'quote_date', 'quote_amount', 'revised_negotiated',
        'revised_negotiated_quote_date', 'revised_negotiated_quote_amount',
        'quotation_given_by_name', 'quotation_given_by_department', 'center', 'group',
        'proposal_status',
      ]

      const payload = {}
      createFields.forEach((fieldName) => {
        const apiName = getApiName(fieldName)
        payload[apiName] = values[fieldName] ?? ''
      })

      const response = await fetch(`${API_BASE_URL}/proposals/add-proposal-coordinator`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || 'Failed to create proposal')
      }

      message.success('Proposal created successfully')
      closeModal()
      await fetchProposals()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to create proposal')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleRemarksSubmit = async () => {
    if (!selectedRecord?.id) {
      message.error('No record selected')
      return
    }

    setRemarksLoading(true)
    
    try {
      const payload = {
        from_: currentUserGroup || 'Center head',
        to: remarksTarget === 'admin' ? 'admin' : (selectedRecord.project_co_ordinator || selectedRecord.quotation_given_by_name || 'Unknown'),
        project_id: selectedRecord.id,
        remarks_description: remarksDescription,
        respond_to_remarks: null  // Send null for new remarks
      }

      console.log('Sending payload:', payload)
      console.log('API URL:', `${API_BASE_URL}/Remarkss/`)
      
      const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || 'Failed to create remark')
      }

      message.success('Remark created successfully')
      closeRemarksModal()
    } catch (error) {
      console.error('Full error object:', error)
      console.error('Error type:', typeof error)
      
      if (error instanceof Error) {
        message.error(error.message || 'Unable to create remark')
      } else {
        message.error('Unable to create remark')
      }
    } finally {
      setRemarksLoading(false)
    }
  }

  const statistics = useMemo(() => {
    // Always use original data to show normal counts regardless of filters
    const dataSource = originalTableData.length > 0 ? originalTableData : tableData
    
    const totalProposals = dataSource.filter((item) => !item.project_number || item.project_number.trim() === '').length
    const totalProjects = dataSource.filter((item) => item.project_number && item.project_number.trim() !== '').length
    const technicallyCompleted = dataSource.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '',
    ).length
    const financiallyCompleted = dataSource.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        item.financial_completed_year &&
        item.financial_completed_year.trim() !== '',
    ).length
    const financiallyNotCompleted = dataSource.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        (!item.financial_completed_year || item.financial_completed_year.trim() === ''),
    ).length
    const pendingProjects = dataSource.filter(
      (item) => item.status === 'Ongoing' || item.status === 'On Hold',
    ).length

    const onHoldProjects = dataSource.filter(
      (item) => item.status === 'On Hold',
    ).length

    // Calculate project code breakdown
    const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']
    const projectCodeBreakdown = {}
    dataSource.forEach((item) => {
      if (item.project_number) {
        const prefix = PROJECT_PREFIXES.find((p) =>
          item.project_number.toUpperCase().startsWith(p),
        )
        if (prefix) {
          projectCodeBreakdown[prefix] = (projectCodeBreakdown[prefix] || 0) + 1
        }
      }
    })

    return {
      allCount: totalProposals + totalProjects,
      totalProposals,
      totalProjects,
      technicallyCompleted,
      financiallyCompleted,
      financiallyNotCompleted,
      pendingProjects,
      onHoldProjects,
      projectCodeBreakdown,
    }
  }, [originalTableData, tableData])

  useEffect(() => {
    let filtered = [...tableData]

    if (searchText) {
      const s = searchText.trim()
      if (/^\d+$/.test(s)) {
        filtered = filtered.filter((item) => String(item.id) === s)
      } else {
        const searchLower = s.toLowerCase()
        filtered = filtered.filter((item) =>
          Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchLower),
          ),
        )
      }
    }

    if (centerFilter) {
      filtered = filtered.filter((item) => item.center === centerFilter)
    }

    if (groupFilter) {
      filtered = filtered.filter((item) => item.group === groupFilter)
    }

    if (projectNumberFilter) {
      const prefix = projectNumberFilter.toUpperCase()
      filtered = filtered.filter((item) => {
        const pn = (item.project_number || '').toString().trim().toUpperCase()
        if (!pn) return false
        return pn.startsWith(prefix)
      })
    }

    if (orderDateRange && orderDateRange.length === 2) {
      filtered = filtered.filter((item) => {
        if (!item.order_date) return false
        const orderDate = dayjs(item.order_date)
        if (!orderDate.isValid()) return false
        const start = orderDateRange[0].startOf('day')
        const end = orderDateRange[1].endOf('day')
        return (
          orderDate.isSameOrAfter(start) && orderDate.isSameOrBefore(end)
        )
      })
    }

    if (enquiryDateRange && enquiryDateRange.length === 2) {
      filtered = filtered.filter((item) => {
        if (!item.enquiry_date) return false
        const enquiryDate = dayjs(item.enquiry_date)
        if (!enquiryDate.isValid()) return false
        const start = enquiryDateRange[0].startOf('day')
        const end = enquiryDateRange[1].endOf('day')
        return (
          enquiryDate.isSameOrAfter(start) &&
          enquiryDate.isSameOrBefore(end)
        )
      })
    }

    if (statusFilter && statusFilter !== 'totalProjects') {
      if (statusFilter === 'proposals') {
        filtered = filtered.filter(
          (item) => !item.project_number || item.project_number.trim() === '',
        )
      } else if (statusFilter === 'technicallyCompleted') {
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '',
        )
      } else if (statusFilter === 'financiallyCompleted') {
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '' &&
            item.financial_completed_year &&
            item.financial_completed_year.trim() !== '',
        )
      } else if (statusFilter === 'financiallyNotCompleted') {
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '' &&
            (!item.financial_completed_year || item.financial_completed_year.trim() === ''),
        )
      } else if (statusFilter === 'pendingProjects') {
        filtered = filtered.filter(
          (item) => item.status === 'Ongoing' || item.status === 'On Hold',
        )
      } else {
        // For other status filters, filter by status
        filtered = filtered.filter((item) => {
          const status = (item.status || '').toString().trim()
          return status === statusFilter
        })
      }
    } else if (statusFilter === 'totalProjects') {
      filtered = filtered.filter(
        (item) => item.project_number && item.project_number.trim() !== '',
      )
    }

    setFilteredData(filtered)
  }, [
    searchText,
    centerFilter,
    groupFilter,
    orderDateRange,
    enquiryDateRange,
    statusFilter,
    projectNumberFilter,
    tableData,
  ])

  const uniqueCenters = useMemo(() => {
    const centers = [
      ...new Set(tableData.map((item) => item.center).filter(Boolean)),
    ]
    return centers.sort()
  }, [tableData])

  const uniqueGroups = useMemo(() => {
    const groups = [
      ...new Set(tableData.map((item) => item.group).filter(Boolean)),
    ]
    return groups.sort()
  }, [tableData])

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning('No data to export')
      return
    }
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item) => {
        const row = {}
        TABLE_FIELDS.forEach((field) => {
          row[field.label] = item[field.name] || ''
        })
        return row
      }),
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proposals')
    XLSX.writeFile(
      workbook,
      `proposals_export_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`,
    )
    message.success('Excel file downloaded successfully')
  }

  const columns = useMemo(() => {
    if (statusFilter === 'proposals') {
      return [
        {
          key: 'id',
          dataIndex: 'id',
          title: 'SL NO',
          width: 50,
          render: (text, record, index) => index + 1,
        },
        {
          key: 'enquiry_date',
          dataIndex: 'enquiry_date',
          title: 'Enquiry Date',
          width: 110,
          render: (value) => formatDate(value),
        },
        {
          key: 'customer_type',
          dataIndex: 'customer_type',
          title: 'Customer Type',
          width: 100,
        },
        {
          key: 'customer_name',
          dataIndex: 'customer_name',
          title: 'Customer Name',
          width: 120,
        },
        {
          key: 'address',
          dataIndex: 'address',
          title: 'Address',
          width: 120,
          ellipsis: true,
        },
        {
          key: 'email',
          dataIndex: 'email',
          title: 'Email',
          width: 120,
          ellipsis: true,
        },
        {
          key: 'activity',
          dataIndex: 'activity',
          title: 'Project Name',
          width: 140,
          render: (value, record) => {
            const projectValue = value || record.quote_description || 'No Project Name'
            return (
              <Tooltip title={projectValue} placement="topLeft">
                <span>{projectValue.length > 20 ? projectValue.substring(0, 20) + '...' : projectValue}</span>
              </Tooltip>
            )
          },
        },
        {
          key: 'quotation_given_by_name',
          dataIndex: 'quotation_given_by_name',
          title: 'Proposal Given By',
          width: 140,
          ellipsis: true,
        },
        {
          key: 'actions',
          title: 'Actions',
          width: 70,
          render: (_, record) => (
            <Button
              size="small"
              type="link"
              onClick={(e) => {
                e.stopPropagation()
                openDetailModal(record)
              }}
            >
              More
            </Button>
          ),
        },
      ]
    }

    const dateFields = new Set([
      'order_date',
      'delivery_date',
      'extended_delivery_date',
      'date_of_actual_commencement',
      'dispatch_date',
      'technical_completed_year',
      'financial_completed_year',
    ])

    const baseColumns = TABLE_FIELDS.map((field) => {
      const baseColumn = {
        key: field.name,
        dataIndex: field.name,
        title: field.label,
        width: field.width,
        fixed: field.fixed,
      }

      if (field.name === 'status') {
        return {
          ...baseColumn,
          render: (value) => {
            if (!value) return '-'
            const statusColors = {
              'Ongoing': { bg: '#e3f2fd', color: '#1565c0' },
              'Completed': { bg: '#e8f5e9', color: '#2e7d32' },
              'Delayed': { bg: '#fff3e0', color: '#e65100' },
              'On Hold': { bg: '#f3e5f5', color: '#6a1b9a' },
              'Technically completed': { bg: '#e0f7fa', color: '#00695c' },
              'Short closed by cutomer': { bg: '#fce4ec', color: '#c62828' },
              'Short closed by CMTI': { bg: '#fce4ec', color: '#c62828' },
            }
            const colors = statusColors[value] || { bg: '#f5f5f5', color: '#616161' }
            return (
              <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                backgroundColor: colors.bg,
                color: colors.color,
                fontWeight: 500,
              }}>
                {value}
              </span>
            )
          }
        }
      }

      if (field.name === 'activity') {
        return {
          ...baseColumn,
          render: (value, record) => {
            const projectValue = value || record.quote_description || 'No Project Name'
            return (
              <Tooltip title={projectValue} placement="topLeft">
                <span>{projectValue.length > 25 ? projectValue.substring(0, 25) + '...' : projectValue}</span>
              </Tooltip>
            )
          },
        }
      }

      if (field.name === 'project_co_ordinator') {
        return {
          ...baseColumn,
          render: (value, record) => {
            // Show project coordinator if available, otherwise show proposal given by
            const coordinator = value && value.trim() !== '' 
              ? value 
              : (record.quotation_given_by_name && record.quotation_given_by_name.trim() !== '' 
                ? record.quotation_given_by_name 
                : '-')
            return (
              <Tooltip title={coordinator} placement="topLeft">
                <span>{coordinator.length > 20 ? coordinator.substring(0, 20) + '...' : coordinator}</span>
              </Tooltip>
            )
          },
        }
      }

      return {
        ...baseColumn,
        render: field.render ?? (dateFields.has(field.name) ? (value) => formatDate(value) : undefined),
      }
    })

    const customerNameIndex = baseColumns.findIndex(
      (col) => col.key === 'customer_name',
    )

    const overdueDaysColumn = {
      key: 'overdue_days',
      dataIndex: 'overdue_days',
      title: 'Overdue Days',
      width: 140,
      render: (_, record) => {
        // Don't show overdue days if project is completed
        if (record.status === 'Completed') return 'Project Completed '

        const overdueDays = calculateOverdueDays(
          record.delivery_date,
          record.extended_delivery_date,
        )

        if (overdueDays === null) return '-'

        if (overdueDays > 0) {
          return (
            <span style={{ color: '#cf1322', fontWeight: 500 }}>
              {overdueDays} days overdue
            </span>
          )
        } else if (overdueDays < 0) {
          return (
            <span style={{ color: '#389e0d', fontWeight: 500 }}>
              {Math.abs(overdueDays)} days remaining
            </span>
          )
        } else {
          return (
            <span style={{ color: '#fa8c16', fontWeight: 500 }}>
              Due Today
            </span>
          )
        }
      },
    }

    if (customerNameIndex !== -1) {
      baseColumns.splice(customerNameIndex + 1, 0, overdueDaysColumn)
    }

    return [
      ...baseColumns,
      {
        key: 'enquiry_documents',
        title: 'Enquiry Documents',
        width: 110,
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
      {
        key: 'actions',
        title: 'Actions',
        width: 120,
        render: (_, record) => (
          <Space size="small">
            <Button
              size="small"
              type="link"
              onClick={(e) => {
                e.stopPropagation()
                openDetailModal(record)
              }}
            >
              More
            </Button>
            {allQueries.filter(query => String(query.project_id) === String(record.id)).length > 0 && (
              <Button 
                size="small" 
                type="link" 
                onClick={(e) => {
                  e.stopPropagation()
                  openQueriesModal(record)
                }}
                style={{
                  color: allQueries.filter(query => String(query.project_id) === String(record.id)).some(query => dayjs(query.updated_at).isAfter(dayjs().subtract(2, 'day').startOf('day'))) ? '#ff4d4f' : '#1890ff',
                  fontWeight: allQueries.filter(query => String(query.project_id) === String(record.id)).some(query => dayjs(query.updated_at).isAfter(dayjs().subtract(2, 'day').startOf('day'))) ? 'bold' : 'normal'
                }}
              >
                Queries ({allQueries.filter(query => String(query.project_id) === String(record.id)).length})
              </Button>
            )}
          </Space>
        ),
      },
    ]
  }, [openEditModal, openDetailModal, openDocsModal, openRemarksModal, openQueriesModal, allQueries, statusFilter])

  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <Tabs
          defaultActiveKey="proposals"
          items={[
            {
              key: 'proposals',
              label: 'Total Proposals Submitted',
              children: (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                    <Card
                      className="bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter(null)}
                    >
                      <Statistic
                        title={<span className="text-white/90">All</span>}
                        value={statistics.allCount}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('proposals')}
                    >
                      <Statistic
                        title={<span className="text-white/90">Pending</span>}
                        value={statistics.totalProposals}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('totalProjects')}
                    >
                      <Statistic
                        title={<span className="text-white/90"> Converted to Projects</span>}
                        value={statistics.totalProjects}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                      {Object.keys(statistics.projectCodeBreakdown).length > 0 && (
                        <div className="mt-2 text-xs text-white/80">
                          {Object.entries(statistics.projectCodeBreakdown)
                            .filter(([, count]) => count > 0)
                            .map(([code, count], idx, arr) => (
                              <span key={code}>
                                {code}: {count}
                                {idx < arr.length - 1 ? ' | ' : ''}
                              </span>
                            ))}
                        </div>
                      )}
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('technicallyCompleted')}
                    >
                      <Statistic
                        title={<span className="text-white/90">Technically Completed</span>}
                        value={statistics.technicallyCompleted}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('financiallyNotCompleted')}
                    >
                      <Statistic
                        title={<span className="text-white/90">Financially Not Completed</span>}
                        value={statistics.financiallyNotCompleted}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('financiallyCompleted')}
                    >
                      <Statistic
                        title={<span className="text-white/90">Financially Completed</span>}
                        value={statistics.financiallyCompleted}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('pendingProjects')}
                    >
                      <Statistic
                        title={<span className="text-white/90">Ongoing Projects</span>}
                        value={statistics.pendingProjects}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                      {statistics.onHoldProjects > 0 && (
                        <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8, marginTop: '4px' }}>
                          On hold: {statistics.onHoldProjects}
                        </div>
                      )}
                    </Card>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                      <Title level={4} className="!mb-0">Search & Filters</Title>
                    </div>
                    <Row gutter={[16, 16]}>
                      {/* Row 1: Search, Project Number, Group, Clear */}
                      <Col xs={24} sm={12} md={6}>
                        <Input
                          placeholder="Search proposals... (type ID to search by PK)"
                          prefix={<SearchOutlined />}
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          size="large"
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Select
                          placeholder="Filter by Project Number"
                          value={projectNumberFilter}
                          onChange={setProjectNumberFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                        >
                          {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT', 'SVP', 'TOT'].map((code) => (
                            <Select.Option key={code} value={code}>{code}</Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        
                        <Select
                          placeholder="Select Group to Filter"
                          value={groupFilter}
                          onChange={setGroupFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                          className="shadow-sm"
                        >
                          {uniqueGroups.map((group) => (
                            <Select.Option key={group} value={group}>
                              <span className="font-medium">{group}</span>
                            </Select.Option>
                          ))}
                        </Select>
                        {groupFilter && (
                          <div className="mt-1">
                            <Tag color="blue" closable onClose={() => setGroupFilter(null)}>
                              Group: {groupFilter}
                            </Tag>
                          </div>
                        )}
                      </Col>
                      <Col xs={24} sm={12} md={6} className="flex items-center">
                        <Button
                          onClick={() => {
                            setSearchText('')
                            setCenterFilter(null)
                            setGroupFilter(null)
                            setOrderDateRange(null)
                            setEnquiryDateRange(null)
                            setStatusFilter(null)
                            setProjectNumberFilter(null)
                          }}
                          size="large"
                          style={{ width: '100%' }}
                        >
                          Clear Filters
                        </Button>
                      </Col>

                      {/* Row 2: Order Date, Enquiry Date, Export */}
                      <Col xs={24} sm={12} md={6}>
                        <RangePicker
                          placeholder={['Start Order Date', 'End Order Date']}
                          value={orderDateRange}
                          onChange={setOrderDateRange}
                          size="large"
                          style={{ width: '100%' }}
                          format={DISPLAY_DATE_FORMAT}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <RangePicker
                          placeholder={['Start Enquiry Date', 'End Enquiry Date']}
                          value={enquiryDateRange}
                          onChange={setEnquiryDateRange}
                          size="large"
                          style={{ width: '100%' }}
                          format={DISPLAY_DATE_FORMAT}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6} className="flex items-center">
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          size="large"
                          onClick={handleExportExcel}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 border-none shadow-md hover:shadow-lg w-full"
                        >
                          Export to Excel
                        </Button>
                      </Col>
                    </Row>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Title level={4} className="!mb-1">Proposal</Title>
                        <p className="text-slate-500 text-sm">
                          Showing {filteredData.length} of {tableData.length} proposals
                        </p>
                      </div>
                      <Space wrap>
                        {statusFilter === 'proposals' && (
                          <Button
                            type={showUnacknowledgedOnly ? 'primary' : 'default'}
                            size="large"
                            danger
                            disabled={!unacknowledgedCount}
                            onClick={handleUnacknowledgedToggle}
                            className={showUnacknowledgedOnly ? 'shadow-md hover:shadow-lg' : ''}
                          >
                            ⚠️ Unacknowledged
                          </Button>
                        )}
                      </Space>
                    </div>
                    <Table
                      className="role-proposals-table"
                      rowKey="id"
                      columns={columns}
                      dataSource={filteredData}
                      loading={tableLoading}
                      pagination={{ pageSize: 10 }}
                      tableLayout="fixed"
                      sticky
                      bordered
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Detail View Modal */}
      <Modal
        title="Proposal Details"
        open={detailModalOpen}
        onCancel={closeDetailModal}
        width={900}
        footer={[
          <Button key="close" onClick={closeDetailModal}>Close</Button>,
          <Button key="remarks" type="primary" onClick={() => {
            closeDetailModal()
            openRemarksModal(selectedRecord)
          }}>Remarks</Button>,
          statusFilter !== 'proposals' && (
            <Button key="edit" type="primary" onClick={() => {
              closeDetailModal()
              openEditModal(selectedRecord)
            }}>Edit</Button>
          ),
        ]}
        maskClosable={false}
      >
        {selectedRecord && (
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }} className="space-y-4">
            {isProposalConverted(selectedRecord.proposals_converted) ? (
              // Show all details if proposals_converted is Yes
              <>
                <Card title="Customer / Enquiry" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Enquiry Date">{formatDate(selectedRecord?.enquiry_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Customer Type">{selectedRecord?.customer_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Customer Name">{selectedRecord?.customer_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{selectedRecord?.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Phone No.">{selectedRecord?.phone_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Alternate Contact">{selectedRecord?.alternate_contact_details || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Request Type">{selectedRecord?.request_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Email Reference">{selectedRecord?.email_reference || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Address" span={2}>{selectedRecord?.address || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="CMTI / Coordinator" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Proposal Given By">{selectedRecord?.quotation_given_by_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Department">{selectedRecord?.quotation_given_by_department || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Centre">{selectedRecord?.center || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Group">{selectedRecord?.group || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Proposal Status">{selectedRecord?.proposal_status || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Project / Order" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Project Number">{selectedRecord?.project_number || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Project Name">{selectedRecord?.activity || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Party Name">{selectedRecord?.party_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Order Number">{selectedRecord?.order_number || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Order Date">{formatDate(selectedRecord?.order_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Order Value">{selectedRecord?.order_value || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Key Deliverables" span={2}>{selectedRecord?.key_deliverables || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Project Co-ordinator">{selectedRecord?.project_co_ordinator || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Dispatch Date">{formatDate(selectedRecord?.dispatch_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Status">{selectedRecord?.status || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Quotation" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Quote Reference">{selectedRecord?.quote_reference || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Date">{formatDate(selectedRecord?.quote_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Amount">{selectedRecord?.quote_amount || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Revised/Negotiated">{selectedRecord?.revised_negotiated || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Revised Quote Date">{formatDate(selectedRecord?.revised_negotiated_quote_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Revised Quote Amount">{selectedRecord?.revised_negotiated_quote_amount || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Description" span={2}>{selectedRecord?.quote_description || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Delivery & Completion" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Delivery Date">{formatDate(selectedRecord?.delivery_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Extended Delivery">{formatDate(selectedRecord?.extended_delivery_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Actual Commencement">{formatDate(selectedRecord?.date_of_actual_commencement) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Technical Completion Year">{selectedRecord?.technical_completed_year || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Financial Completion Year">{selectedRecord?.financial_completed_year || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Closure Report" span={2}>{selectedRecord?.closure_report || '-'}</Descriptions.Item>
                    <Descriptions.Item label="PPM Remarks" span={2}>{selectedRecord?.ppm_remarks || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Review Meeting Details" span={2}>{selectedRecord?.details_of_external_internal_review_meeting || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Updated By">{selectedRecord?.updated_by || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Updated At">{formatDate(selectedRecord?.updated_at) || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Acknowledgement" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Is Acknowledged">{selectedRecord?.is_acknowledged === true ? 'Yes' : selectedRecord?.is_acknowledged === false ? 'No' : '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            ) : (
              // Show limited details from enquiry date to if_not_reason if proposals_converted is No/null/empty
              <>
                <Card title="Customer / Enquiry" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Enquiry Date">{formatDate(selectedRecord?.enquiry_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Customer Type">{selectedRecord?.customer_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Customer Name">{selectedRecord?.customer_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{selectedRecord?.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Phone No.">{selectedRecord?.phone_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Alternate Contact">{selectedRecord?.alternate_contact_details || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Request Type">{selectedRecord?.request_type || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Email Reference">{selectedRecord?.email_reference || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Address" span={2}>{selectedRecord?.address || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="CMTI / Coordinator" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Proposal Given By">{selectedRecord?.quotation_given_by_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Department">{selectedRecord?.quotation_given_by_department || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Centre">{selectedRecord?.center || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Group">{selectedRecord?.group || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Proposal Status">{selectedRecord?.proposal_status || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Quotation" size="small" className="bg-blue-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Quote Reference">{selectedRecord?.quote_reference || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Date">{formatDate(selectedRecord?.quote_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Amount">{selectedRecord?.quote_amount || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Quote Description" span={2}>{selectedRecord?.quote_description || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Conversion Status" size="small" className="bg-yellow-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Proposals Converted">{selectedRecord?.proposals_converted || '-'}</Descriptions.Item>
                    <Descriptions.Item label="If Not Reason" span={2}>{selectedRecord?.if_not_reason || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            )}

            <Card title="Documents" size="small" className="bg-gray-50">
              <Table
                size="small"
                rowKey={(row, idx) => row?.id ?? row?.key ?? idx}
                dataSource={projectDocs}
                loading={docsLoading}
                pagination={false}
                columns={[
                  {
                    title: 'Version',
                    dataIndex: 'version',
                    key: 'version',
                    width: 80,
                    render: (v) => v || '-',
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
                    render: (value) => (value ? dayjs(value).format(DISPLAY_DATE_FORMAT + ' HH:mm') : '-'),
                  },
                  {
                    title: 'View',
                    key: 'view',
                    width: 80,
                    render: (_, record) => (
                      <Button type="link" icon={<EyeOutlined />} onClick={() => viewDocument(record)} />
                    ),
                  },
                ]}
              />
              {(!docsLoading && !projectDocs.length) && (
                <div className="text-center text-gray-500 mt-4">No documents uploaded</div>
              )}
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title={editingRecord ? 'Edit Proposal' : 'Add Proposal'}
        open={modalOpen}
        onCancel={closeModal}
        width={1000}
        okText={editingRecord ? 'Update' : 'Create'}
        confirmLoading={submitLoading}
        onOk={() => form.submit()}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ updated_by: localStorage.getItem('loggedInUser') }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {ALL_FIELDS.filter(f => !['id', 'created_at', 'updated_at'].includes(f.name)).map((field) => {
              const allowedEditFields = [
                'extended_delivery_date',
                'co_ordinator_remarks',
                'technical_completed_year',
                'updated_by',
                'proposal_status',
              ]

              if (editingRecord && !allowedEditFields.includes(field.name)) {
                return null
              }

              const dateFields = [
                'enquiry_date', 'quote_date', 'revised_negotiated_quote_date',
                'order_date', 'delivery_date', 'extended_delivery_date',
                'date_of_actual_commencement', 'dispatch_date',
              ]
              const isDateField = dateFields.includes(field.name)

              if (isDateField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : []}
                    getValueProps={(value) => ({ value: value ? dayjs(value).isValid() ? dayjs(value) : null : null })}
                    normalize={(value) => {
                      if (!value) return ''
                      if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD')
                      return value
                    }}
                  >
                    <DatePicker style={{ width: '100%' }} format={DISPLAY_DATE_FORMAT} placeholder={`Select ${field.label}`} />
                  </Form.Item>
                )
              }

              const InputComponent = ['Description', 'Deliverables', 'Remarks', 'Report', 'Details'].some(t => field.label?.includes(t)) ? TextArea : Input
              const isUpdatedByField = field.name === 'updated_by'
              const isProposalStatusField = field.name === 'proposal_status'
              const isReadOnlyField = ['quotation_given_by_name', 'quotation_given_by_department', 'center', 'group'].includes(field.name)
              const isCustomerName = field.name === 'customer_name'
              const shouldDisable = isUpdatedByField || (isReadOnlyField && editingRecord)

              if (isCustomerName && !editingRecord) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : []}
                  >
                    <AutoComplete
                      options={customerOptions}
                      onSearch={searchCustomers}
                      onSelect={handleCustomerSelect}
                      placeholder="Search existing customers..."
                      style={{ width: '100%' }}
                      allowClear
                    >
                      <Input />
                    </AutoComplete>
                  </Form.Item>
                )
              }

              if (isProposalStatusField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : []}
                    getValueProps={(value) => ({ value: value ? [value] : [] })}
                    normalize={(value) => {
                      if (Array.isArray(value)) {
                        return value[value.length - 1] || ''
                      }
                      return value || ''
                    }}
                  >
                    <Select
                      mode="tags"
                      showSearch
                      allowClear
                      placeholder={field.label}
                    >
                      <Select.Option value="Submitted">Submitted</Select.Option>
                      <Select.Option value="Accepted">Accepted</Select.Option>
                      <Select.Option value="Rejected">Rejected</Select.Option>
                      <Select.Option value="Awaiting">Awaiting</Select.Option>
                    </Select>
                  </Form.Item>
                )
              }

              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : []}
                >
                  <InputComponent rows={2} disabled={shouldDisable} />
                </Form.Item>
              )
            })}
          </div>
        </Form>
      </Modal>

      {/* Uploaded Documents (Version List) Modal */}
      <Modal
        title="Uploaded Documents"
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
              render: (v) => v || '-',
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
              render: (value) => (value ? dayjs(value).format(DISPLAY_DATE_FORMAT + ' HH:mm') : '-'),
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
          ]}
        />
        {(!docsLoading && !projectDocs.length) && (
          <div className="text-center text-gray-500 mt-4">No documents uploaded yet.</div>
        )}
      </Modal>

      {/* Remarks Modal */}
      <Modal
        title="Create Remarks"
        open={remarksModalOpen}
        onCancel={closeRemarksModal}
        width={600}
        footer={[
          <Button key="cancel" onClick={closeRemarksModal}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            loading={remarksLoading}
            onClick={handleRemarksSubmit}
          >
            Submit Remarks
          </Button>,
        ]}
        maskClosable={false}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Target:</label>
            <Radio.Group 
              value={remarksTarget} 
              onChange={(e) => setRemarksTarget(e.target.value)}
              buttonStyle="solid"
              className="w-full"
            >
              <Radio.Button value="admin" className="w-1/2 text-center">Admin</Radio.Button>
              <Radio.Button value="pi" className="w-1/2 text-center">PI</Radio.Button>
            </Radio.Group>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">From:</label>
            <Input 
              value={currentUserGroup || 'Center head'} 
              disabled 
              className="w-full" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">To:</label>
            <Input 
              value={remarksTarget === 'admin' ? 'admin' : (selectedRecord?.project_co_ordinator || selectedRecord?.quotation_given_by_name || 'Unknown')} 
              disabled 
              className="w-full" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Project ID:</label>
            <Input 
              value={selectedRecord?.id || ''} 
              disabled 
              className="w-full" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Remarks Description:</label>
            <Input 
              value={remarksDescription} 
              onChange={(e) => setRemarksDescription(e.target.value)}
              className="w-full" 
            />
          </div>
        </div>
      </Modal>

      {/* Queries Modal for CH users */}
      <Modal
        title={`Queries for Project: ${selectedProjectForQueries?.project_number || selectedProjectForQueries?.activity || 'N/A'}`}
        open={queriesModalOpen}
        onCancel={closeQueriesModal}
        width={800}
        footer={[
          <Button key="close" onClick={closeQueriesModal}>Close</Button>,
        ]}
      >
        <div className="mb-4">
          <Button 
            type="primary" 
            onClick={() => {
              if (selectedProjectForQueries) {
                closeQueriesModal()
                openRemarksModal(selectedProjectForQueries)
              }
            }}
          >
            Add Remarks
          </Button>
        </div>
        <Table
          dataSource={queriesData}
          loading={queriesLoading}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'From',
              dataIndex: 'from_',
              key: 'from',
              width: 120,
            },
            {
              title: 'To',
              dataIndex: 'to',
              key: 'to',
              width: 120,
            },
            {
              title: 'Query',
              dataIndex: 'remarks_description',
              key: 'query',
            },
            {
              title: 'Response',
              dataIndex: 'respond_to_remarks',
              key: 'response',
              render: (text) => text || (
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>No Response</span>
              ),
            },
            {
              title: 'Date',
              dataIndex: 'updated_at',
              key: 'date',
              width: 150,
              render: (text) => {
                const date = dayjs(text)
                return date.format('DD MMM YYYY, HH:mm')
              },
            },
          ]}
        />
      </Modal>

      <Modal
        title="Document Viewer"
        open={!!viewDocumentUrl}
        onCancel={() => {
          setViewDocumentUrl(null)
          setExcelRendererData(null)
          setExcelRendererError(null)
          setExcelRendererLoading(false)
          setActiveSheetIndex(0)
          setWordDocumentContent(null)
          setWordDocumentError(null)
          setWordDocumentLoading(false)
          setIsFullscreen(false)
        }}
        footer={null}
        width={1100}
      >
        {(() => {
          const currentUrl = viewDocumentUrl || ''
          const urlNoQuery = currentUrl.split('#')[0].split('?')[0]
          const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
          const directPreviewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt'].includes(ext)
          const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
          const isOffice = officeTypes.includes(ext)

          if (!currentUrl) return null

          // Office files (including Excel and Word) - show viewer or download option
          if (isOffice) {
            // For Excel files, use react-excel-renderer
            if (ext === 'xlsx' || ext === 'xls') {
              if (excelRendererLoading) {
                return (
                  <div className="flex items-center justify-center h-[60vh]">
                    <Spin size="large" tip="Loading Excel file..." />
                  </div>
                )
              }

              if (excelRendererError) {
                return (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="text-6xl mb-4">??</div>
                    <h3 className="text-xl font-semibold">Excel Viewer Error</h3>
                    <p className="text-gray-500 text-center max-w-md">{excelRendererError}</p>
                    <div className="space-x-2">
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => window.open(currentUrl, '_blank')}
                      >
                        Download Excel File
                      </Button>
                      <Button onClick={() => loadExcelWithRenderer(currentUrl)}>
                        Retry
                      </Button>
                    </div>
                  </div>
                )
              }

              if (excelRendererData) {
                return (
                  <div className={`w-full ${isFullscreen ? 'h-full' : 'h-[80vh]'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Excel Viewer</h3>
                        {/* Sheet tabs */}
                        {excelRendererData.sheets && excelRendererData.sheets.length > 1 && (
                          <div className="flex space-x-1 mt-2 border-b">
                            {excelRendererData.sheets.map((sheet, index) => (
                              <button
                                key={index}
                                className={`px-3 py-1 text-sm border-b-2 transition-colors ${
                                  activeSheetIndex === index
                                    ? 'border-blue-500 text-blue-600 font-medium'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                                onClick={() => setActiveSheetIndex(index)}
                              >
                                {sheet.name || `Sheet ${index + 1}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-x-2">
                        <Button 
                          size="small" 
                          onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </Button>
                        <Button 
                          size="small" 
                          icon={<DownloadOutlined />}
                          onClick={() => window.open(currentUrl, '_blank')}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                    
                    <style>{`
                      .excel-scroll-container {
                        overflow: auto;
                        max-height: 60vh;
                        border: 1px solid #d9d9d9;
                        border-radius: 6px;
                      }
                      .excel-table {
                        border-collapse: collapse;
                        font-size: 12px;
                        min-width: 100%;
                      }
                      .excel-table th,
                      .excel-table td {
                        border: 1px solid #d9d9d9;
                        padding: 4px 8px;
                        text-align: left;
                        white-space: nowrap;
                        min-width: 80px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      }
                      .excel-table th {
                        background-color: #f5f5f5;
                        font-weight: 600;
                        position: sticky;
                        top: 0;
                        z-index: 10;
                      }
                      .excel-table td:hover {
                        background-color: #f0f8ff;
                        white-space: normal;
                        word-wrap: break-word;
                      }
                    `}</style>
                    {(() => {
                      // Get current sheet data
                      const currentSheet = excelRendererData.sheets ? excelRendererData.sheets[activeSheetIndex] : excelRendererData
                      const currentRows = currentSheet?.rows || excelRendererData.rows || []
                      const currentCols = currentSheet?.cols || excelRendererData.cols || []
                      
                      return currentRows.length > 0 ? (
                        <div className="excel-scroll-container h-full">
                          <table className="excel-table">
                            <thead>
                              <tr>
                                {currentCols.map((col, index) => (
                                  <th key={index}>{col.name || `Column ${index + 1}`}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {currentRows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <td 
                                      key={cellIndex} 
                                      title={cell}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[60vh] text-gray-500">
                          No data available in this Excel file
                        </div>
                      )
                    })()}
                  </div>
                )
              }
            }
            
            // For Word documents, use mammoth.js
            if (ext === 'docx' || ext === 'doc') {
              if (wordDocumentLoading) {
                return (
                  <div className="flex items-center justify-center h-[60vh]">
                    <Spin size="large" tip="Loading Word document..." />
                  </div>
                )
              }

              if (wordDocumentError) {
                return (
                  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                    <div className="text-6xl mb-4">??</div>
                    <h3 className="text-xl font-semibold">Word Document Viewer Error</h3>
                    <p className="text-gray-500 text-center max-w-md">{wordDocumentError}</p>
                    <div className="space-x-2">
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => window.open(currentUrl, '_blank')}
                      >
                        Download Word Document
                      </Button>
                      <Button onClick={() => loadWordDocument(currentUrl)}>
                        Retry
                      </Button>
                    </div>
                  </div>
                )
              }

              if (wordDocumentContent) {
                return (
                  <div className={`w-full ${isFullscreen ? 'h-full' : 'h-[80vh]'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Word Document Viewer - Mammoth.js</h3>
                      <div className="space-x-2">
                        <Button 
                          size="small" 
                          onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </Button>
                        <Button 
                          size="small" 
                          icon={<DownloadOutlined />}
                          onClick={() => window.open(currentUrl, '_blank')}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                    <div 
                      className={`overflow-auto border border-gray-300 rounded-lg p-4 ${isFullscreen ? 'h-[90vh]' : 'h-[70vh]'}`}
                      dangerouslySetInnerHTML={{ __html: wordDocumentContent }}
                    />
                  </div>
                )
              }
            }
            
            // For other Office files (PowerPoint, etc.)
            return (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="text-6xl mb-4">??</div>
                <h3 className="text-xl font-semibold">
                  {ext.toUpperCase()} Document
                </h3>
                <p className="text-gray-500 text-center max-w-md">
                  This document type cannot be previewed directly. Please download to view.
                </p>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(currentUrl, '_blank')}
                  className="mt-4"
                >
                  Download Document
                </Button>
              </div>
            )
          }

          // PDF and images - use iframe preview
          if (directPreviewable) {
            return <iframe src={currentUrl} className="w-full h-[80vh]" title="Document" />
          }

          // Unknown file types - offer download
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <div className="text-6xl mb-4">??</div>
              <h3 className="text-xl font-semibold">
                Document Preview
              </h3>
              <Button
                type="primary"
                size="large"
                onClick={() => window.open(currentUrl, '_blank')}
                className="mt-4"
              >
                Open Document
              </Button>
            </div>
          )
        })()}
      </Modal>
    </>
  )
}

export default Proposals
