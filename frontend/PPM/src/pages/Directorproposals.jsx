import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import {
  AutoComplete,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  DatePicker,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { DISPLAY_DATE_FORMAT, formatDate, formatIndianNumber } from '../config/date.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { Title } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker

const CUSTOMER_TYPE_OPTIONS = [
  'Govt',
  'Private',
  'MHI',
  'MSME',
  'Academic Institute',
  'PSU',
  'Others',
]

const DATE_FIELD_OPTIONS = [
  { value: 'enquiry_date', label: 'Enquiry Date' },
  { value: 'quote_date', label: 'Quote Date' },
  { value: 'revised_negotiated_quote_date', label: 'Revised Quote Date' },
  { value: 'order_date', label: 'Order Date' },
  { value: 'delivery_date', label: 'Delivery Date' },
  { value: 'extended_delivery_date', label: 'Extended Delivery' },
  { value: 'date_of_actual_commencement', label: 'Actual Commencement' },
  { value: 'dispatch_date', label: 'Dispatch Date' },
  { value: 'technical_completed_year', label: 'Technical Completion Year' },
  { value: 'financial_completed_year', label: 'Financial Completion Year' },
  { value: 'details_of_external_internal_review_meeting', label: 'Review Meeting Details' },
  { value: 'created_at', label: 'Created At' },
  { value: 'updated_at', label: 'Updated At' },
]

const REQUEST_TYPE_OPTIONS = [
  'Call for Proposal',
  'Mail',
  'Discussion',
  'Initiative',
  'Tender',
  'Direct Enquiry',
  'Budgetry offer',
  'EOI',
]

const PROPOSAL_FIELDS = [
  { name: 'id', label: 'SL NO', width: 120, fixed: 'left', inForm: false, render: (text, record, index) => index + 1, },
  { name: 'enquiry_date', label: 'Enquiry Date', width: 150 },
  { name: 'customer_type', label: 'Customer Type', width: 170 },
  { name: 'customer_name', label: 'Customer Name', width: 170 },
  { name: 'address', label: 'Address', width: 240 },
  { name: 'email', label: 'Email', width: 200 },
  { name: 'phone_no', label: 'Phone No.', width: 150 },
  { name: 'alternate_contact_details', label: 'Alternate Contact', width: 220 },
  {
    name: 'request_type',
    label: 'Request Type',
    width: 160,
    render: (value) => (value ? <Tag color="blue">{value}</Tag> : null),
  },
  { name: 'email_reference', label: 'Email Reference', width: 200 },
  { name: 'quote_reference', label: 'Quote Reference', width: 190 },
  { name: 'quote_description', label: 'Quote Description', width: 240, input: 'textarea' },
  { name: 'quote_date', label: 'Quote Date', width: 140 },
  { name: 'quote_amount', label: 'Quote Amount', width: 160 },
  { name: 'proposal_status', label: 'Proposal Status', width: 160, input: 'select' },
  { name: 'revised_negotiated', label: 'Revised / Negotiated', width: 190, apiName: 'revised/negotiated' },
  { name: 'revised_negotiated_quote_date', label: 'Revised Quote Date', width: 190, apiName: 'revised/negotiated_quote_date' },
  { name: 'revised_negotiated_quote_amount', label: 'Revised Quote Amount', width: 210, apiName: 'revised/negotiated_quote_amount' },
  { name: 'quotation_given_by_department', label: 'Department', width: 180 },
  { name: 'quotation_given_by_name', label: 'Quotation Given By', width: 200 },
  { name: 'project_number', label: 'Project Number', width: 140 },
  { name: 'center', label: 'Centre', width: 150 },
  { name: 'group', label: 'Group', width: 150 },
  { name: 'proposals_converted', label: 'Proposals Converted', width: 180, input: 'select' },
  { name: 'if_not_reason', label: 'If Not Reason', width: 200, input: 'textarea' },
  { name: 'project_co_ordinator', label: 'Project Co-ordinator', width: 200 },
  { name: 'party_name', label: 'Party Name', width: 200 },
  { name: 'activity', label: 'Activity', width: 160 },
  { name: 'key_deliverables', label: 'Key Deliverables', width: 240, input: 'textarea' },
  { name: 'order_number', label: 'Order Number', width: 150 },
  { name: 'order_date', label: 'Order Date', width: 150 },
  { name: 'delivery_date', label: 'Delivery Date', width: 160 },
  { name: 'extended_delivery_date', label: 'Extended Delivery', width: 190 },
  { name: 'date_of_actual_commencement', label: 'Actual Commencement', width: 210 },
  { name: 'order_value', label: 'Order Value', width: 170 },
  { name: 'details_of_external_internal_review_meeting', label: 'Review Meeting Details', width: 260, input: 'textarea' },
  { name: 'closer_report', label: 'Closure Report', width: 200, input: 'textarea' },
  { name: 'technical_completed_year', label: 'Technical Completion Year', width: 220 },
  { name: 'financial_completed_year', label: 'Financial Completion Year', width: 220 },
  { name: 'status', label: 'Status', width: 150, input: 'select' },
  { name: 'ppm_remarks', label: 'PPM Remarks', width: 200, input: 'textarea' },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 160 },
  { name: 'created_at', label: 'Created At', width: 190, inForm: false },
  { name: 'updated_at', label: 'Updated At', width: 190, inForm: false },
  { name: 'updated_by', label: 'Updated By', width: 150, required: true },
]

const FORM_FIELDS = PROPOSAL_FIELDS.filter((field) => field.inForm !== false)
const TABLE_FIELDS = PROPOSAL_FIELDS

const getApiName = (name) => {
  const field = PROPOSAL_FIELDS.find((item) => item.name === name)
  return field?.apiName ?? name
}

const uniqueKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const normalizeValue = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFKC')
    .toLowerCase()

const mapApiToUi = (record) => {
  const mapped = {}
  TABLE_FIELDS.forEach((field) => {
    const apiName = getApiName(field.name)
    mapped[field.name] = record?.[apiName] ?? ''
  })
  mapped.key = record?.id ?? uniqueKey()
  // Preserve payments data for dynamic column rendering
  mapped.payments = record?.payments || []
  return mapped
}

const mapUiToApi = (values) => {
  const payload = {}
  FORM_FIELDS.forEach((field) => {
    const apiName = getApiName(field.name)
    payload[apiName] = values[field.name] ?? ''
  })
  return payload
}

// Helper function to check if proposals_converted is Yes
const isProposalConverted = (proposalsConverted) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue === 'yes'
}

// Helper functions to format center and group names with prefixes
const formatCenterName = (center) => {
  if (!center || typeof center !== 'string') return center
  const trimmed = center.trim()
  // Don't add prefix if it already has one
  return trimmed.startsWith('C-') ? trimmed : `C-${trimmed}`
}

const formatGroupName = (group) => {
  if (!group || typeof group !== 'string') return group
  const trimmed = group.trim()
  // Don't add prefix if it already has one
  return trimmed.startsWith('G-') ? trimmed : `G-${trimmed}`
}

function DirectorProposals() {
  const [form] = Form.useForm()
  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [liveExcelModalOpen, setLiveExcelModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [centreFilter, setCentreFilter] = useState([])
  const [orderDateRange, setOrderDateRange] = useState(null)
  const [enquiryDateRange, setEnquiryDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [projectNumberFilter, setProjectNumberFilter] = useState([])
  const [groupFilter, setGroupFilter] = useState([])
  const [projectCoordinatorFilter, setProjectCoordinatorFilter] = useState([])
  const [isAcknowledgedFilter, setIsAcknowledgedFilter] = useState(null)
  const [selectedDateField, setSelectedDateField] = useState('enquiry_date')
  const [dateRange, setDateRange] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [bulkImportLoading, setBulkImportLoading] = useState(false)
  const [currentUserName, setCurrentUserName] = useState('')
  const [allCustomerSuggestions, setAllCustomerSuggestions] = useState([])
  const [customerOptions, setCustomerOptions] = useState([])
  const [addressOptions, setAddressOptions] = useState([])
  const [phoneOptions, setPhoneOptions] = useState([])
  const [emailOptions, setEmailOptions] = useState([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [proposalCount, setProposalCount] = useState(0)
  const [centres, setCentres] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedCentreId, setSelectedCentreId] = useState(null)
  const [users, setUsers] = useState([])
  const [availableCoordinators, setAvailableCoordinators] = useState([])

  // Document modal state
  const [stageConfig, setStageConfig] = useState([])
  const [docsModalVisible, setDocsModalVisible] = useState(false)
  const [projectDocs, setProjectDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)
  const [viewDocumentBlobUrl, setViewDocumentBlobUrl] = useState(null)
  const [viewDocumentMime, setViewDocumentMime] = useState('')
  const [viewDocumentPreviewLoading, setViewDocumentPreviewLoading] = useState(false)
  const [viewDocumentPreviewError, setViewDocumentPreviewError] = useState('')

  // Queries state for admin users
  const [queriesModalOpen, setQueriesModalOpen] = useState(false)
  const [queriesData, setQueriesData] = useState([])
  const [queriesLoading, setQueriesLoading] = useState(false)
  const [selectedProjectForQueries, setSelectedProjectForQueries] = useState(null)
  
  // Response modal state
  const [responseModalOpen, setResponseModalOpen] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [responseLoading, setResponseLoading] = useState(false)
  
  // Unresponded query counts for Query History button logic
  const [unrespondedQueryCounts, setUnrespondedQueryCounts] = useState({})

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

      const stageFiltered = projectDocsRaw.filter((d) => {
        if (!enquiryStageId) return true
        const docStageId = d?.stage_id ?? d?.stage ?? d?.stageId
        if (docStageId == null) return false
        return String(docStageId) === String(enquiryStageId)
      })

      const filtered = stageFiltered

      const baseName = (enquiryStage?.name || 'Enquiry').toString().trim() || 'Enquiry'

      const sortedByDate = [...filtered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      )

      const withVersions = sortedByDate.map((d, idx) => ({
        ...d,
        version: idx + 1,
        display_name: d.name || `${baseName} v${idx + 1}`,
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

  // Queries functions for admin users
  const fetchQueriesForProject = useCallback(async (projectId) => {
    console.log(`Fetching queries for project ${projectId}...`)
    setQueriesLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        console.error('Failed to fetch queries - Response not ok:', response.status, response.statusText)
        throw new Error('Failed to fetch queries')
      }
      const allQueries = await response.json()
      console.log('All queries from API:', allQueries)
      
      // Filter queries TO admin (not from admin) AND for this specific project
      const adminQueries = Array.isArray(allQueries) 
        ? allQueries.filter(query => 
            String(query.to) === 'admin' && 
            String(query.project_id) === String(projectId)
          )
        : []
      console.log(`Project ${projectId}: Found ${adminQueries.length} admin queries`)
      
      const sortedQueries = adminQueries.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      console.log('Setting queries data:', sortedQueries)
      setQueriesData(sortedQueries)
      return adminQueries.length
    } catch (error) {
      console.error('Error fetching queries:', error)
      message.error('Failed to fetch queries')
      return 0
    } finally {
      setQueriesLoading(false)
    }
  }, [])

  const openQueriesModal = useCallback(async (record) => {
    setSelectedProjectForQueries(record)
    setQueriesModalOpen(true)
    // Use existing queries data from record instead of fetching again (like ScientistProposals.jsx)
    const projectQueries = record.queries || []
    console.log('Using existing queries from record:', projectQueries)
    
    // Check if queries exist
    if (!projectQueries || projectQueries.length === 0) {
      console.log('No queries found for this project')
      message.info('No queries found for this project')
      return
    }
    
    // Sort queries by date (newest first) for modal display
    const sortedQueries = projectQueries.sort((a, b) => {
      try {
        const dateA = new Date(a.updated_at).getTime()
        const dateB = new Date(b.updated_at).getTime()
        return dateB - dateA
      } catch (error) {
        console.error('Error sorting queries:', error)
        return 0
      }
    })
    console.log('Setting queries data:', sortedQueries)
    setQueriesData(sortedQueries)
  }, [])

  const closeQueriesModal = useCallback(() => {
    setQueriesModalOpen(false)
    setQueriesData([])
    setSelectedProjectForQueries(null)
  }, [])

  // Response functions for admin users
  const openResponseModal = useCallback((query) => {
    setSelectedQuery(query)
    setResponseText(query.respond_to_remarks || '')
    setResponseModalOpen(true)
  }, [])

  const closeResponseModal = useCallback(() => {
    setResponseModalOpen(false)
    setSelectedQuery(null)
    setResponseText('')
  }, [])

  const handleResponseSubmit = async () => {
    if (!selectedQuery?.id) {
      message.error('No query selected')
      return
    }

    if (!responseText.trim()) {
      message.error('Please enter a response')
      return
    }

    setResponseLoading(true)
    
    try {
      const payload = {
        from_: selectedQuery.from_,     // Keep same from as original query
        to: selectedQuery.to,           // Keep same to as original query
        project_id: selectedQuery.project_id,
        remarks_description: selectedQuery.remarks_description,
        respond_to_remarks: responseText.trim()
      }

      console.log('Sending response payload:', payload)
      console.log('API URL:', `${API_BASE_URL}/Remarkss/`)
      
      const response = await fetch(`${API_BASE_URL}/Remarkss/${selectedQuery.id}`, {
        method: 'PUT',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to submit response')
      }

      message.success('Response submitted successfully')
      closeResponseModal()
      
      // Refresh queries data
      if (selectedProjectForQueries) {
        await fetchQueriesForProject(selectedProjectForQueries.id)
      }
      
      // Refresh all queries
      const allQueriesResponse = await fetch(`${API_BASE_URL}/Remarkss/`, {
        headers: { accept: 'application/json' },
      })
      if (allQueriesResponse.ok) {
        const data = await allQueriesResponse.json()
        setAllQueries(data)
      }
      const fetchEvent = new Event('refresh-proposals')
      window.dispatchEvent(fetchEvent)
      
    } catch (error) {
      console.error('Error submitting response:', error)
      message.error(error.message || 'Failed to submit response')
    } finally {
      setResponseLoading(false)
    }
  }

  const openDetailModal = useCallback((record) => {
    setSelectedRecord(record)
    setDetailModalOpen(true)
    // Fetch enquiry documents for this proposal
    if (record?.id) {
      fetchProjectDocuments(record.id)
    }
  }, [fetchProjectDocuments])

  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false)
    setSelectedRecord(null)
  }, [])

  const renderDetailValue = useCallback((fieldName, value) => {
    if (value === undefined || value === null || value === '') return '-'

    const dateFields = new Set([
      'enquiry_date',
      'quote_date',
      'revised_negotiated_quote_date',
      'order_date',
      'delivery_date',
      'extended_delivery_date',
      'date_of_actual_commencement',
      'dispatch_date',
      'created_at',
      'updated_at',
    ])

    const amountFields = new Set([
      'quote_amount',
      'revised_negotiated_quote_amount',
      'order_value',
    ])

    if (dateFields.has(fieldName)) {
      return formatDate(value)
    }

    if (amountFields.has(fieldName)) {
      return formatIndianNumber(value)
    }

    return String(value)
  }, [])

  const fetchProposals = useCallback(async () => {
    setTableLoading(true)
    try {
      // Build query parameters for date filtering
      const params = new URLSearchParams()
      if (selectedDateField && dateRange && dateRange.length === 2) {
        params.append('date_field', selectedDateField)
        params.append('start_date', dateRange[0].format('YYYY-MM-DD'))
        params.append('end_date', dateRange[1].format('YYYY-MM-DD'))
      }

      // Add parameter to fetch by "Quotation Given By Name" instead of coordinator
      if (currentUserName) {
        console.log('Current User Name:', currentUserName)
        params.append('quotation_given_by', currentUserName)
      }

      const queryString = params.toString()
      const url = `${API_BASE_URL}/proposals/${queryString ? '?' + queryString : ''}`
      console.log('API URL:', url)

      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch proposals')
      }
      const payload = await response.json()
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.Data)
          ? payload.Data
          : Array.isArray(payload?.data)
            ? payload.data
            : []
      // Debug logging for payments data
      if (list.length > 0) {
        console.log('First proposal payments:', list[0]?.payments)
        console.log('Raw API response keys:', Object.keys(list[0] || {}))
        console.log('Max payments across proposals:', Math.max(...list.map(p => p.payments?.length || 0), 0))
      }
      if (list.length) {
        console.log('Proposals API first raw record:', list[0])
        console.log('Proposals API first mapped record:', mapApiToUi(list[0]))
      } else {
        console.log('Proposals API returned empty list. Raw payload:', payload)
      }
      const normalized = list.map(mapApiToUi)

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

      // Fetch all queries once and attach to each proposal
      let allQueries = []
      try {
        const queriesResponse = await fetch(`${API_BASE_URL}/Remarkss/`, {
          headers: { accept: 'application/json' },
        })
        if (queriesResponse.ok) {
          allQueries = await queriesResponse.json()
        }
      } catch (error) {
        console.error('Failed to fetch queries:', error)
      }

      // Attach filtered queries to each proposal
      const proposalsWithQueries = normalized.map(proposal => {
        // Filter queries for this specific project (show all queries, not just TO admin)
        const projectQueries = Array.isArray(allQueries) 
          ? allQueries.filter(query => 
              String(query.project_id) === String(proposal.id)
            )
          : []
        // console.log(`Proposal ${proposal.id}: Found ${projectQueries.length} queries`)
        return { ...proposal, queries: projectQueries }
      })
      
      console.log('Proposals with admin queries loaded:', proposalsWithQueries.map(p => ({
        id: p.id,
        project_number: p.project_number,
        queriesCount: p.queries?.length || 0
      })))

      setTableData(proposalsWithQueries)
      setFilteredData(proposalsWithQueries)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch proposals')
    } finally {
      setTableLoading(false)
    }
  }, [selectedDateField, dateRange])

  const fetchProposalCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/master_proposals/count`, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Unable to fetch proposal count')
      }

      const payload = await response.json() // { count: 742 }
      setProposalCount(payload.count)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch proposal count')
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

  const openDocsModal = useCallback(async (projectId) => {
    setDocsModalVisible(true)
    await fetchProjectDocuments(projectId)
  }, [fetchProjectDocuments])

  const viewDocument = useCallback(
    async (doc) => {
      // Try url or file field (different APIs may use different field names)
      const url = doc?.url || doc?.file
      if (!url) {
        console.log('Document object:', doc)
        console.log('Available fields:', Object.keys(doc || {}))
        return message.error('Document URL is not available')
      }

      // Reset previous preview
      if (viewDocumentBlobUrl) {
        URL.revokeObjectURL(viewDocumentBlobUrl)
      }
      setViewDocumentBlobUrl(null)
      setViewDocumentMime('')
      setViewDocumentPreviewError('')

      setViewDocumentUrl(url)
      setViewDocumentPreviewLoading(true)

      try {
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.status} ${response.statusText}`)
        }
        const contentType = response.headers.get('content-type') || ''
        const blob = await response.blob()
        const mime = (contentType || blob.type || '').toLowerCase()
        const blobUrl = URL.createObjectURL(blob)

        setViewDocumentMime(mime)
        setViewDocumentBlobUrl(blobUrl)
      } catch (err) {
        console.error('Document preview error:', err)
        // If fetch fails, show the error but still allow opening in new tab
        setViewDocumentPreviewError(
          err?.message || 'Unable to load document preview. Click "Open / Download" to view the document.'
        )
      } finally {
        setViewDocumentPreviewLoading(false)
      }
    },
    [viewDocumentBlobUrl],
  )

  useEffect(() => {
    return () => {
      if (viewDocumentBlobUrl) {
        URL.revokeObjectURL(viewDocumentBlobUrl)
      }
    }
  }, [viewDocumentBlobUrl])

  const fetchCentres = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/centres/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch centres')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload : []
      setCentres(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch centres')
    }
  }, [])

  const fetchGroups = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch groups')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload : []
      setGroups(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch groups')
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch users')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload : []
      setUsers(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch users')
    }
  }, [])

  const fetchCustomerSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/customers/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch customer suggestions')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload.map(customer => ({
        name: customer.name,
        customer_type: customer.customer_type,
        address: null,
        email: customer.email,
        phone_no: customer.phone_no,
        alternate_contact_details: customer.alternate_contact_details,
        addresses: customer.address ? [customer.address] : []
      })).filter(c => c.name && c.name.trim()) : []
      setAllCustomerSuggestions(normalized)
      return normalized
    } catch (error) {
      console.error('Customer suggestions fetch error:', error)
      setAllCustomerSuggestions([])
      return []
    }
  }, [])

  const searchCustomers = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setCustomerOptions([])
        return
      }

      const normalized = searchValue.trim().toLowerCase()

      // Ensure we have the full list fetched
      let customerList = allCustomerSuggestions
      if (!customerList.length) {
        customerList = await fetchCustomerSuggestions()
      }

      const matches = (customerList || [])
        .filter((c) => c?.name?.toLowerCase().includes(normalized))
        .slice(0, 20)

      const options = matches.map((customer) => ({
        value: customer.name,
        label: `${customer.name} ${customer.customer_type ? `(${customer.customer_type})` : ''}`,
        customer,
      }))

      setCustomerOptions(options)
    },
    [allCustomerSuggestions, fetchCustomerSuggestions],
  )

  const searchAddresses = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setAddressOptions([])
        return
      }

      const currentName = form.getFieldValue('customer_name')?.trim()
      if (!currentName) {
        setAddressOptions([])
        return
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/customers/addresses?name=${encodeURIComponent(currentName)}`,
          { headers: { accept: 'application/json' } },
        )
        if (!response.ok) throw new Error('Unable to fetch addresses')
        const payload = await response.json()
        const addresses = Array.isArray(payload) ? payload : []
        const normalized = searchValue.trim().toLowerCase()
        const matches = addresses
          .filter((a) => a?.toLowerCase().includes(normalized))
          .slice(0, 20)
        setAddressOptions(matches.map((a) => ({ value: a, label: a })))
      } catch (error) {
        console.error('Address search error:', error)
        setAddressOptions([])
      }
    },
    [form],
  )

  const searchEmails = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setEmailOptions([])
        return
      }

      const normalized = searchValue.trim().toLowerCase()

      let customerList = allCustomerSuggestions
      if (!customerList.length) {
        customerList = await fetchCustomerSuggestions()
      }

      const matches = (customerList || [])
        .map((c) => c.email)
        .filter(Boolean)
        .filter((e) => e.toLowerCase().includes(normalized))
        .slice(0, 20)

      setEmailOptions(matches.map((e) => ({ value: e, label: e })))
    },
    [allCustomerSuggestions, fetchCustomerSuggestions],
  )

  const searchPhones = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setPhoneOptions([])
        return
      }

      const normalized = searchValue.trim().toLowerCase()

      let customerList = allCustomerSuggestions
      if (!customerList.length) {
        customerList = await fetchCustomerSuggestions()
      }

      const matches = (customerList || [])
        .map((c) => c.phone_no)
        .filter(Boolean)
        .filter((p) => p.toLowerCase().includes(normalized))
        .slice(0, 20)

      setPhoneOptions(matches.map((p) => ({ value: p, label: p })))
    },
    [allCustomerSuggestions, fetchCustomerSuggestions],
  )

  const handleCustomerSelect = useCallback(
    (value, option) => {
      const customer = option?.customer
      if (!customer) return

      const addresses = Array.isArray(customer.addresses) ? customer.addresses : []
      setAddressOptions(addresses.map((a) => ({ value: a, label: a })))

      const phones = []
      if (customer.phone_no) phones.push(customer.phone_no)
      if (customer.alternate_contact_details) phones.push(customer.alternate_contact_details)
      setPhoneOptions(Array.from(new Set(phones)).map((p) => ({ value: p, label: p })))

      const emails = []
      if (customer.email) emails.push(customer.email)
      setEmailOptions(Array.from(new Set(emails)).map((e) => ({ value: e, label: e })))

      // Only pre-fill the customer name/type; let the user choose / type other contact details
      form.setFieldsValue({
        customer_name: customer.name,
        customer_type: customer.customer_type || '',
      })
    },
    [form],
  )

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        if (parsedUser && parsedUser.name) {
          setCurrentUserName(parsedUser.name)
        }
      }
    } catch (error) {
      console.error('Failed to read user from localStorage', error)
    }

    // Trigger delivery notification check on every page load
    fetch(`${API_BASE_URL}/proposals/check-delivery-notifications`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    }).catch(err => console.log('Notification check error:', err))

    fetchProposals()
    fetchProposalCount()
    fetchCentres()
    fetchGroups()
    fetchUsers()
    fetchStageConfig()
  }, [fetchProposals, fetchProposalCount, fetchCentres, fetchGroups, fetchUsers, fetchStageConfig])

  const openAddModal = useCallback(() => {
    setEditingRecord(null)
    form.resetFields()
    if (currentUserName) {
      form.setFieldsValue({ updated_by: currentUserName })
    }
    setSelectedCentreId(null)
    setModalOpen(true)
  }, [form, currentUserName])

  const openEditModal = useCallback(
    (record) => {
      setEditingRecord(record)
      form.setFieldsValue({ ...record, updated_by: currentUserName || record.updated_by })

      const centerCodeFromRecord = (record.center || '').trim()
      if (centerCodeFromRecord) {
        const matchedCentre = centres.find(
          (c) => (c.code || '').trim() === centerCodeFromRecord,
        )
        setSelectedCentreId(matchedCentre ? matchedCentre.id : null)
      } else {
        setSelectedCentreId(null)
      }

      setModalOpen(true)
    },
    [form, currentUserName, centres],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    form.resetFields()
  }, [form])

  const handleSubmit = async (values) => {
    setSubmitLoading(true)
    const payload = mapUiToApi(values)
    const isEditingProject = Boolean(editingRecord?.project_number?.toString().trim())
    if (isEditingProject) {
      delete payload.proposal_status
    }
    const isEditing = Boolean(editingRecord)
    const url = isEditing
      ? `${API_BASE_URL}/proposals/${editingRecord.id}`
      : `${API_BASE_URL}/proposals/`
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
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = useCallback(
    async (record) => {
      setDeletingId(record.id)
      try {
        const response = await fetch(`${API_BASE_URL}/proposals/${record.id}`, {
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

  // Calculate statistics
  useEffect(() => {
    let filtered = [...tableData]

    if (searchText) {
      const lowerSearch = searchText.toLowerCase()
      filtered = filtered.filter((item) =>
        Object.entries(item).some(([key, value]) => {
          if (key === 'id' && value !== undefined && value !== null) {
            return String(value).toLowerCase() === lowerSearch
          }
          return value !== undefined && value !== null && String(value).toLowerCase().includes(lowerSearch)
        })
      )
    }

    if (projectNumberFilter && projectNumberFilter.length > 0) {
      filtered = filtered.filter((item) =>
        item.project_number && projectNumberFilter.some(filter => 
          item.project_number.toUpperCase().startsWith(filter.toUpperCase())
        )
      )
    }

    if (groupFilter && groupFilter.length > 0) {
      filtered = filtered.filter((item) => {
        const groupValue = (item.group || '').trim()
        if (!groupValue) return false
        return groupFilter.some((filterValue) => {
          return (
            filterValue === groupValue ||
            groupLookup.nameByCode[filterValue] === groupValue ||
            groupLookup.codeByName[groupValue] === filterValue
          )
        })
      })
    }

    if (projectCoordinatorFilter && projectCoordinatorFilter.length > 0) {
      filtered = filtered.filter((item) => {
        const coordinator = normalizeValue(item.project_co_ordinator)
        return projectCoordinatorFilter.some((filterValue) => coordinator === normalizeValue(filterValue))
      })
    }

    if (centreFilter && centreFilter.length > 0) {
      filtered = filtered.filter((item) => 
        item.center && centreFilter.includes(item.center)
      )
    }

    if (statusFilter === 'totalProjects') {
      filtered = filtered.filter(
        (item) => item.project_number && item.project_number.trim() !== '',
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
        (item) =>
          item.status === 'Ongoing',
      )
    } else if (statusFilter === 'proposals') {
      filtered = filtered.filter(
        (item) =>
          !item.project_number || item.project_number.trim() === ''
      )
    }

    if (isAcknowledgedFilter !== null) {
      filtered = filtered.filter((item) => item.is_acknowledged === isAcknowledgedFilter)
    }

    setFilteredData(filtered)
  }, [searchText, centreFilter, orderDateRange, statusFilter, projectNumberFilter, groupFilter, projectCoordinatorFilter, isAcknowledgedFilter, tableData, selectedDateField, dateRange])

  // Get unique centers for filter
  const uniqueCentres = useMemo(() => {
    const centers = [
      ...new Set(tableData.map((item) => item.center).filter(Boolean)),
    ]
    return centers.sort()
  }, [tableData])

  const centreCodeOptions = useMemo(
    () =>
      centres
        .map((c) => (c.code || '').trim())
        .filter((code) => code)
        .sort(),
    [centres],
  )

  const projectCoordinatorOptions = useMemo(() => {
    const seen = new Map()
    tableData
      .map((item) => (item.project_co_ordinator || '').trim())
      .filter(Boolean)
      .forEach((name) => {
        const normalized = normalizeValue(name)
        if (!seen.has(normalized)) {
          seen.set(normalized, name.toUpperCase())
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [tableData])

  const departmentOptions = useMemo(
    () =>
      groups
        .map((g) => (g.code || '').trim())
        .filter((code) => code)
        .sort(),
    [groups],
  )

  const groupLookup = useMemo(() => {
    const codeByName = {}
    const nameByCode = {}
    groups.forEach((g) => {
      const code = (g.code || '').trim()
      const name = (g.name || '').trim()
      if (code) nameByCode[code] = code
      if (name) codeByName[name] = code
    })
    return { codeByName, nameByCode }
  }, [groups])

  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          selectedCentreId == null
            ? true
            : Number(g.centre_id) === Number(selectedCentreId),
      ),
    [groups, selectedCentreId],
  )

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning('No data to export')
      return
    }

    // Calculate max payments across all proposals
    const maxPayments = Math.max(...filteredData.map(p => p.payments?.length || 0), 0)

    // Payment sub-columns configuration (same as table columns)
    const paymentFields = [
      { key: 'invoice_no', label: 'Inv#' },
      { key: 'invoice_date', label: 'Inv Date' },
      { key: 'gross_amount', label: 'Gross' },
      { key: 'get_amount', label: 'GST Amt' },
      { key: 'amount_claimed', label: 'Amt Claimed' },
      { key: 'amount_recieved', label: 'Amt Recd' },
      { key: 'recieved_date', label: 'Recd Date' },
      { key: 'tds', label: 'TDS' },
      { key: 'get_tds', label: 'GST TDS' },
      { key: 'ld', label: 'LD' },
      { key: 'bal', label: 'Balance' },
      { key: 'follow_up_status', label: 'Status' },
    ]

    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item) => {
        const row = {}
        // Add standard proposal fields
        TABLE_FIELDS.forEach((field) => {
          row[field.label] = item[field.name] || ''
        })
        // Add payment fields for each invoice
        if (item.payments && item.payments.length > 0) {
          item.payments.forEach((payment, idx) => {
            paymentFields.forEach((field) => {
              row[`Inv ${idx + 1} ${field.label}`] = payment[field.key] || ''
            })
          })
        }
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

  // Excel serial date starts from 1899-12-30
  const EXCEL_EPOCH = dayjs('1899-12-30')
  const isExcelDateSerial = (num) =>
    typeof num === 'number' && num >= 40000 && num < 1000000

  const excelSerialToDateString = (serial) => {
    const days = Math.floor(serial) - (serial >= 24107 ? 1 : 0)
    const date = EXCEL_EPOCH.add(days, 'day')
    return date.format('YYYY-MM-DD')
  }

  const normalizeHeaderKey = (value) => {
    if (!value) return ''
    return value
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  const handleBulkImport = async () => {
    if (!importPreview?.rows?.length) {
      message.warning('No rows to import')
      return
    }
    setBulkImportLoading(true)
    try {
      // Build lookup from normalized header -> internal field name
      const fieldLookup = PROPOSAL_FIELDS.reduce((acc, field) => {
        const labelKey = normalizeHeaderKey(field.label)
        const nameKey = normalizeHeaderKey(field.name)
        const apiKey = normalizeHeaderKey(getApiName(field.name))
        const fieldName = field.name
        if (labelKey) acc[labelKey] = fieldName
        if (nameKey) acc[nameKey] = fieldName
        if (apiKey) acc[apiKey] = fieldName
        return acc
      }, {})

      const payload = importPreview.rows.map((row) => {
        const values = {}
        importPreview.headers.forEach((header, idx) => {
          const rawValue = row[idx]
          let cleanValue = rawValue

          const headerKey = normalizeHeaderKey(header)
          let fieldName = fieldLookup[headerKey]

          // Extra robust mapping for tricky columns
          if (!fieldName) {
            const hk = headerKey

            // Email Reference (Email Ref, Email Reference No, Email Ref No etc.)
            if (
              hk.includes('email') &&
              (hk.includes('reference') || hk.includes('ref'))
            ) {
              fieldName = 'email_reference'
            }
            // Centre / Centre
            else if (hk.includes('center') || hk.includes('centre')) {
              fieldName = 'center'
            }
            // Co-ordinator Remarks / Coordinator Remarks / Co Ordinator Remarks etc.
            else if (
              (hk.includes('coord') || hk.includes('coordinator') || hk.includes('coordinator')) &&
              hk.includes('remark')
            ) {
              fieldName = 'co_ordinator_remarks'
            }
            // Closer / Closure Report (Closure Report, Closer Rep etc.)
            else if (
              (hk.includes('closer') || hk.includes('closure') || hk.includes('closeout')) &&
              (hk.includes('report') || hk.includes('rep'))
            ) {
              fieldName = 'closer_report'
            }
          }

          if (!fieldName) return

          // Handle Excel date serial numbers (e.g., 45400 → "2024-06-01")
          if (typeof rawValue === 'number' && isExcelDateSerial(rawValue)) {
            cleanValue = excelSerialToDateString(rawValue)
          }
          // Force all other numbers to strings
          else if (typeof rawValue === 'number') {
            cleanValue = rawValue.toString()
          }
          // Handle actual JS Date objects from XLSX
          else if (rawValue instanceof Date) {
            cleanValue = dayjs(rawValue).format('YYYY-MM-DD')
          }
          // Trim strings
          else if (typeof rawValue === 'string') {
            cleanValue = rawValue.trim()
          }
          // Empty cells
          else if (rawValue === null || rawValue === undefined) {
            cleanValue = ''
          }

          values[fieldName] = cleanValue
        })

        // Ensure required field is present
        if (!values.updated_by) {
          values.updated_by = 'Excel Import'
        }

        return mapUiToApi(values)
      })

      const response = await fetch(`${API_BASE_URL}/proposals/bulk`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Import failed: ${err.substring(0, 200)}...`)
      }

      const result = await response.json()
      message.success(`${result.length} proposals imported successfully!`)
      await fetchProposals()
      setImportModalOpen(false)
      setImportPreview(null)
    } catch (err) {
      console.error('Bulk import error:', err)
      message.error(err.message || 'Failed to import data. Check console for details.')
    } finally {
      setBulkImportLoading(false)
    }
  }

  // Import Excel and build preview
  const handleImportFileChange = (event) => {
    const file = event.target?.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
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

  // Helper function to calculate overdue days
  const calculateOverdueDays = (deliveryDate, extendedDelivery) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Use extended delivery date if present, otherwise use delivery date
    const referenceDate = extendedDelivery
      ? new Date(extendedDelivery)
      : deliveryDate
        ? new Date(deliveryDate)
        : null

    if (!referenceDate || isNaN(referenceDate.getTime())) return null

    const diffMs = today - referenceDate
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    return diffDays // positive = overdue, negative = still within deadline
  }

  const columns = useMemo(() => {
    return [
      {
        key: 'sl_no',
        title: 'SL NO',
        width: 90,
        fixed: 'left',
        render: (_, __, index) => index + 1,
      },
      {
        key: 'project_number',
        dataIndex: 'project_number',
        title: 'Project Number',
        ellipsis: { showTitle: false },
        render: (value) => {
          const projectNumber = value && value.toString().trim() !== '' ? value : 'Still Proposal'
          return (
            <Tooltip title={projectNumber} placement="topLeft">
              <span>{projectNumber}</span>
            </Tooltip>
          )
        },
      },
      {
        key: 'activity',
        dataIndex: 'activity',
        title: 'Project Name',
        ellipsis: { showTitle: false },
        render: (_, record) => {
          const activity = record?.activity?.toString().trim()
          const quoteDescription = record?.quote_description?.toString().trim()
          const projectName = activity || quoteDescription || '-'
          return (
            <Tooltip title={projectName} placement="topLeft">
              <span>{projectName}</span>
            </Tooltip>
          )
        },
      },
      {
        key: 'customer_name',
        dataIndex: 'customer_name',
        title: 'Customer Name',
        ellipsis: { showTitle: false },
        render: (value) => {
          const customerName = value || '-'
          return (
            <Tooltip title={customerName} placement="topLeft">
              <span>{customerName}</span>
            </Tooltip>
          )
        },
      },
      {
        key: 'overdue_days',
        title: 'Overdue Days',
        width: 150,
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
          }

          if (overdueDays < 0) {
            return (
              <span style={{ color: '#389e0d', fontWeight: 500 }}>
                {Math.abs(overdueDays)} days remaining
              </span>
            )
          }

          return (
            <span style={{ color: '#fa8c16', fontWeight: 500 }}>
              Due Today
            </span>
          )
        },
      },
      {
        key: 'dispatch_date',
        dataIndex: 'dispatch_date',
        title: 'Dispatch Date',
        width: 150,
        render: (value) => formatDate(value),
      },
      {
        key: 'project_co_ordinator',
        dataIndex: 'project_co_ordinator',
        title: 'Project Co-ordinator',
        ellipsis: { showTitle: false },
        render: (_, record) => {
          const projectCoordinator = record?.project_co_ordinator?.toString().trim()
          const quotationGivenBy = record?.quotation_given_by_name?.toString().trim()
          const displayName = projectCoordinator || quotationGivenBy || '-'
          const coordinatorName = displayName !== '-' ? displayName.toUpperCase() : '-'
          return (
            <Tooltip title={coordinatorName} placement="topLeft">
              <span>{coordinatorName}</span>
            </Tooltip>
          )
        },
      },
      {
        key: 'more',
        title: 'More',
        fixed: 'right',
        width: 110,
        render: (_, record) => (
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record)}
          >
            More
          </Button>
        ),
      },
    ]
  }, [openDetailModal])

  // Compact projects view derived from proposals (currently unused, but kept)
  const projectRows = useMemo(
    () =>
      tableData
        .filter((item) => item.project_number && item.project_number.trim() !== '')
        .map((item) => {
          let status = 'Pending'
          if (
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '' &&
            item.financial_completed_year &&
            item.financial_completed_year.trim() !== ''
          ) {
            status = 'Financially Completed'
          } else if (
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== ''
          ) {
            status = 'Technically Completed'
          }
          return {
            key: item.key,
            project_number: item.project_number,
            party_name: item.party_name,
            center: item.center,
            order_date: item.order_date,
            technical_completed_year: item.technical_completed_year,
            financial_completed_year: item.financial_completed_year,
            status,
          }
        }),
    [tableData],
  )

  const projectColumns = [
    { title: 'Project Number', dataIndex: 'project_number', key: 'project_number' },
    { title: 'Party Name', dataIndex: 'party_name', key: 'party_name' },
    { title: 'Centre', dataIndex: 'center', key: 'center' },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date', render: (value) => formatDate(value) },
    {
      title: 'Technical Year',
      dataIndex: 'technical_completed_year',
      key: 'technical_completed_year',
    },
    {
      title: 'Financial Year',
      dataIndex: 'financial_completed_year',
      key: 'financial_completed_year',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => {
        let color = 'default'
        if (value === 'Technically Completed') color = 'orange'
        if (value === 'Financially Completed') color = 'green'
        if (value === 'Pending') color = 'red'
        return <Tag color={color}>{value}</Tag>
      },
    },
  ]

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalProposals = tableData.filter(
      (item) => !item.project_number || item.project_number.trim() === '',
    ).length
    
    const totalProjects = tableData.filter(
      (item) => item.project_number && item.project_number.trim() !== '',
    ).length

    const technicallyCompleted = tableData.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '',
    ).length

    const financiallyCompleted = tableData.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        item.financial_completed_year &&
        item.financial_completed_year.trim() !== '',
    ).length

    const financiallyNotCompleted = tableData.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        (!item.financial_completed_year || item.financial_completed_year.trim() === ''),
    ).length

    const pendingProjects = tableData.filter(
      (item) => item.status === 'Ongoing' || item.status === 'On Hold',
    ).length

    const onHoldProjects = tableData.filter(
      (item) => item.status === 'On Hold',
    ).length

    // Calculate project code breakdown
    const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']
    const projectCodeBreakdown = {}
    tableData.forEach((item) => {
      if (item.project_number) {
        const prefix = PROJECT_PREFIXES.find((p) =>
          item.project_number.toUpperCase().startsWith(p),
        )
        if (prefix) {
          projectCodeBreakdown[prefix] = (projectCodeBreakdown[prefix] || 0) + 1
        } else {
          projectCodeBreakdown.Other = (projectCodeBreakdown.Other || 0) + 1
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
  }, [tableData])

  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <Tabs
          defaultActiveKey="proposals"
          items={[
            {
              key: 'proposals',
              label: 'Proposals',
              children: (
                <div className="space-y-6">
                  {/* Statistics Cards */}
<div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                    <Card
                      className="bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter(null)}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                            Total Proposals Submitted
                          </span>
                        }
                        value={statistics.allCount}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => {
                        setStatusFilter('proposals')
                        setProjectNumberFilter([])
                      }}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                            Pending
                          </span>
                        }
                        value={statistics.totalProposals}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('totalProjects')}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                           Converted to Projects
                          </span>
                        }
                        value={statistics.totalProjects}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
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
                        title={
                          <span className="text-white/90">
                            Technically Completed
                          </span>
                        }
                        value={statistics.technicallyCompleted}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('financiallyNotCompleted')}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                            Financially Not Completed
                          </span>
                        }
                        value={statistics.financiallyNotCompleted}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('financiallyCompleted')}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                            Financially Completed
                          </span>
                        }
                        value={statistics.financiallyCompleted}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => setStatusFilter('pendingProjects')}
                    >
                      <Statistic
                        title={
                          <span className="text-white/90">
                            Ongoing Projects
                          </span>
                        }
                        value={statistics.pendingProjects}
                        valueStyle={{
                          color: '#fff',
                          fontSize: '28px',
                          fontWeight: 'bold',
                        }}
                      />
                      {statistics.onHoldProjects > 0 && (
                        <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8, marginTop: '4px' }}>
                          On hold: {statistics.onHoldProjects}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Search and Filters Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                      <Title level={4} className="!mb-0">
                        Search & Filters
                      </Title>
                    </div>
                    <Row gutter={[16, 16]}>
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
                      {/* Clear Filters button (clears search + all filters) */}
                      <Col xs={24} sm={12} md={2} className="flex items-center">
                        <Button
                          onClick={() => {
                            setSearchText('')
                            setCentreFilter([])
                            setOrderDateRange(null)
                            setStatusFilter(null)
                            setProjectNumberFilter([])
                            setGroupFilter([])
                            setProjectCoordinatorFilter([])
                            setIsAcknowledgedFilter(null)
                            setSelectedDateField('enquiry_date')
                            setDateRange(null)
                          }}
                          size="large"
                          style={{ width: '100%' }}
                        >
                          Clear Filters
                        </Button>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Select
                          mode="multiple"
                          placeholder="Filter by Project Number"
                          value={projectNumberFilter}
                          onChange={setProjectNumberFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                        >
                          {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT'].map((code) => (
                            <Select.Option key={code} value={code}>
                              {code}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Select
                          mode="multiple"
                          placeholder="Filter by Centre"
                          value={centreFilter}
                          onChange={setCentreFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                        >
                          {uniqueCentres.map((center) => (
                            <Select.Option key={center} value={center}>
                              {formatCenterName(center)}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Select
                          mode="multiple"
                          placeholder="Filter by Group"
                          value={groupFilter}
                          onChange={setGroupFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                        >
                          {departmentOptions.map((name) => (
                            <Select.Option key={name} value={name}>
                              {formatGroupName(name)}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Select
                          mode="multiple"
                          placeholder="Filter by Project Co-ordinator"
                          value={projectCoordinatorFilter}
                          onChange={setProjectCoordinatorFilter}
                          size="large"
                          allowClear
                          style={{ width: '100%' }}
                        >
                          {(projectCoordinatorOptions || []).map((name) => (
                            <Select.Option key={name} value={name}>
                              {name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Form.Item label="Filter by Date Field:">
                          <Select
                            value={selectedDateField}
                            onChange={setSelectedDateField}
                            size="large"
                            style={{ width: '100%' }}
                            styles={{ popup: { root: { minWidth: 280 } } }}
                          >
                            {DATE_FIELD_OPTIONS.map((option) => (
                              <Select.Option key={option.value} value={option.value}>
                                {option.label}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Form.Item label="Date Range:">
                          <RangePicker
                            placeholder={['Start Date', 'End Date']}
                            value={dateRange}
                            onChange={setDateRange}
                            size="large"
                            style={{ width: '100%' }}
                            format={DISPLAY_DATE_FORMAT}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Form.Item label="Is Acknowledged:">
                          <Select
                            placeholder="Filter by Is Acknowledged"
                            value={isAcknowledgedFilter}
                            onChange={setIsAcknowledgedFilter}
                            size="large"
                            allowClear
                            style={{ width: '100%' }}
                          >
                            <Select.Option value={true}>Yes</Select.Option>
                            <Select.Option value={false}>No</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            size="small"
                            onClick={handleExportExcel}
                            style={{
                              background: 'linear-gradient(to right, #10b981, #059669)',
                              border: 'none',
                              boxShadow: '0 2px 12px rgba(16, 185, 129, 0.25)',
                            }}
                          >
                            Export to Excel
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </div>


                  <Modal
                    title="Proposal Details"
                    open={detailModalOpen}
                    onCancel={closeDetailModal}
                    footer={null}
                    width={1100}
                    maskClosable
                    centered
                    destroyOnHidden
                    styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
                  >
                    {!selectedRecord ? (
                      <div className="text-slate-500">No proposal selected.</div>
                    ) : (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {isProposalConverted(selectedRecord.proposals_converted) ? (
                          // Show all details if proposals_converted is Yes
                          <>
                            <Card
                              size="small"
                              className="bg-slate-50"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Overview</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={{ xs: 1, sm: 2, md: 3 }}
                                labelStyle={{ width: 170, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Project Number">
                                  {renderDetailValue('project_number', selectedRecord.project_number)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Status">
                                  {renderDetailValue('status', selectedRecord.status)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Activity">
                                  {renderDetailValue('activity', selectedRecord.activity)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer Name">
                                  {renderDetailValue('customer_name', selectedRecord.customer_name)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer Type">
                                  {renderDetailValue('customer_type', selectedRecord.customer_type)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Order Number">
                                  {renderDetailValue('order_number', selectedRecord.order_number)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                  {renderDetailValue('email', selectedRecord.email)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Phone No.">
                                  {renderDetailValue('phone_no', selectedRecord.phone_no)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Alternate Contact">
                                  {renderDetailValue(
                                    'alternate_contact_details',
                                    selectedRecord.alternate_contact_details,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Centre">
                                  {renderDetailValue('center', formatCenterName(selectedRecord.center))}
                                </Descriptions.Item>
                                <Descriptions.Item label="Group">
                                  {renderDetailValue('group', formatGroupName(selectedRecord.group))}
                                </Descriptions.Item>
                                <Descriptions.Item label="Project Co-ordinator">
                                  {renderDetailValue(
                                    'project_co_ordinator',
                                    selectedRecord.project_co_ordinator,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Proposal Status">
                                  {renderDetailValue('proposal_status', selectedRecord.proposal_status)}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>

                            <Card
                              size="small"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Dates</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={{ xs: 1, sm: 2, md: 3 }}
                                labelStyle={{ width: 170, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Enquiry Date">
                                  {renderDetailValue('enquiry_date', selectedRecord.enquiry_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quote Date">
                                  {renderDetailValue('quote_date', selectedRecord.quote_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Revised Quote Date">
                                  {renderDetailValue(
                                    'revised_negotiated_quote_date',
                                    selectedRecord.revised_negotiated_quote_date,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Order Date">
                                  {renderDetailValue('order_date', selectedRecord.order_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Delivery Date">
                                  {renderDetailValue('delivery_date', selectedRecord.delivery_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Extended Delivery">
                                  {renderDetailValue(
                                    'extended_delivery_date',
                                    selectedRecord.extended_delivery_date,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Dispatch Date">
                                  {renderDetailValue('dispatch_date', selectedRecord.dispatch_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Technical Completion Year">
                                  {renderDetailValue(
                                    'technical_completed_year',
                                    selectedRecord.technical_completed_year,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Financial Completion Year">
                                  {renderDetailValue(
                                    'financial_completed_year',
                                    selectedRecord.financial_completed_year,
                                  )}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>

                            <Card
                              size="small"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Description</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={1}
                                labelStyle={{ width: 220, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Address">
                                  {renderDetailValue('address', selectedRecord.address)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quote Description">
                                  {renderDetailValue('quote_description', selectedRecord.quote_description)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Key Deliverables">
                                  {renderDetailValue('key_deliverables', selectedRecord.key_deliverables)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Review Meeting Details">
                                  {renderDetailValue(
                                    'details_of_external_internal_review_meeting',
                                    selectedRecord.details_of_external_internal_review_meeting,
                                  )}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>

                            <Card
                              size="small"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Financials</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={{ xs: 1, sm: 2, md: 3 }}
                                labelStyle={{ width: 170, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Quote Amount">
                                  {renderDetailValue('quote_amount', selectedRecord.quote_amount)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Revised Quote Amount">
                                  {renderDetailValue(
                                    'revised_negotiated_quote_amount',
                                    selectedRecord.revised_negotiated_quote_amount,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Order Value">
                                  {renderDetailValue('order_value', selectedRecord.order_value)}
                                </Descriptions.Item>
                                <Descriptions.Item label="PPM Remarks">
                                  {renderDetailValue('ppm_remarks', selectedRecord.ppm_remarks)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Updated By">
                                  {renderDetailValue('updated_by', selectedRecord.updated_by)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Updated At">
                                  {renderDetailValue('updated_at', selectedRecord.updated_at)}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          </>
                        ) : (
                          // Show limited details from enquiry date to if_not_reason if proposals_converted is No/null/empty
                          <>
                            <Card
                              size="small"
                              className="bg-slate-50"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Enquiry Details</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={{ xs: 1, sm: 2, md: 3 }}
                                labelStyle={{ width: 170, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Enquiry Date">
                                  {renderDetailValue('enquiry_date', selectedRecord.enquiry_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer Name">
                                  {renderDetailValue('customer_name', selectedRecord.customer_name)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer Type">
                                  {renderDetailValue('customer_type', selectedRecord.customer_type)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                  {renderDetailValue('email', selectedRecord.email)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Phone No.">
                                  {renderDetailValue('phone_no', selectedRecord.phone_no)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Address">
                                  {renderDetailValue('address', selectedRecord.address)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Request Type">
                                  {renderDetailValue('request_type', selectedRecord.request_type)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Email Reference">
                                  {renderDetailValue('email_reference', selectedRecord.email_reference)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quote Reference">
                                  {renderDetailValue('quote_reference', selectedRecord.quote_reference)}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>

                            <Card
                              size="small"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Quote Details</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={{ xs: 1, sm: 2, md: 3 }}
                                labelStyle={{ width: 170, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Quote Date">
                                  {renderDetailValue('quote_date', selectedRecord.quote_date)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quote Amount">
                                  {renderDetailValue('quote_amount', selectedRecord.quote_amount)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quote Description">
                                  {renderDetailValue('quote_description', selectedRecord.quote_description)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Proposal Status">
                                  {renderDetailValue('proposal_status', selectedRecord.proposal_status)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Quotation Given By">
                                  {renderDetailValue('quotation_given_by_name', selectedRecord.quotation_given_by_name)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Department">
                                  {renderDetailValue('quotation_given_by_department', selectedRecord.quotation_given_by_department)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Centre">
                                  {renderDetailValue('center', formatCenterName(selectedRecord.center))}
                                </Descriptions.Item>
                                <Descriptions.Item label="Group">
                                  {renderDetailValue('group', formatGroupName(selectedRecord.group))}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>

                            <Card
                              size="small"
                              styles={{ body: { padding: 14 } }}
                              title={<span className="font-semibold">Conversion Status</span>}
                            >
                              <Descriptions
                                bordered
                                size="small"
                                column={1}
                                labelStyle={{ width: 220, fontWeight: 600 }}
                              >
                                <Descriptions.Item label="Proposals Converted">
                                  {renderDetailValue('proposals_converted', selectedRecord.proposals_converted)}
                                </Descriptions.Item>
                                <Descriptions.Item label="If Not Reason">
                                  {renderDetailValue('if_not_reason', selectedRecord.if_not_reason)}
                                </Descriptions.Item>
                              </Descriptions>
                            </Card>
                          </>
                        )}

                        {Array.isArray(selectedRecord?.payments) && selectedRecord.payments.length > 0 && (
                          <Card
                            size="small"
                            styles={{ body: { padding: 14 } }}
                            title={<span className="font-semibold">Payment Details</span>}
                          >
                            <Table
                              size="small"
                              pagination={false}
                              rowKey={(row, idx) => row?.id ?? row?.invoice_no ?? idx}
                              scroll={{ x: 'max-content' }}
                              columns={[
                                {
                                  title: 'Invoice No',
                                  dataIndex: 'invoice_no',
                                  key: 'invoice_no',
                                  width: 140,
                                  render: (v) => v || '-',
                                },
                                {
                                  title: 'Invoice Date',
                                  dataIndex: 'invoice_date',
                                  key: 'invoice_date',
                                  width: 130,
                                  render: (v) => formatDate(v) || '-',
                                },
                                {
                                  title: 'Gross Amount',
                                  dataIndex: 'gross_amount',
                                  key: 'gross_amount',
                                  width: 140,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'GST Amount',
                                  dataIndex: 'get_amount',
                                  key: 'get_amount',
                                  width: 120,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Amount Claimed',
                                  dataIndex: 'amount_claimed',
                                  key: 'amount_claimed',
                                  width: 150,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Amount Received',
                                  dataIndex: 'amount_recieved',
                                  key: 'amount_recieved',
                                  width: 150,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Received Date',
                                  dataIndex: 'recieved_date',
                                  key: 'recieved_date',
                                  width: 140,
                                  render: (v) => formatDate(v) || '-',
                                },
                                {
                                  title: 'TDS',
                                  dataIndex: 'tds',
                                  key: 'tds',
                                  width: 100,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'GST TDS',
                                  dataIndex: 'get_tds',
                                  key: 'get_tds',
                                  width: 110,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'LD',
                                  dataIndex: 'ld',
                                  key: 'ld',
                                  width: 90,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Balance',
                                  dataIndex: 'bal',
                                  key: 'bal',
                                  width: 120,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Follow Up Status',
                                  dataIndex: 'follow_up_status',
                                  key: 'follow_up_status',
                                  width: 160,
                                  render: (v) => v || '-',
                                },
                              ]}
                              dataSource={selectedRecord.payments}
                            />
                          </Card>
                        )}

                        <Card
                          size="small"
                          styles={{ body: { padding: 14 } }}
                          title={<span className="font-semibold">Closure</span>}
                        >
                          <Descriptions
                            bordered
                            size="small"
                            column={1}
                            labelStyle={{ width: 220, fontWeight: 600 }}
                          >
                            <Descriptions.Item label="Co-ordinator Remarks">
                              {renderDetailValue(
                                'co_ordinator_remarks',
                                selectedRecord.co_ordinator_remarks,
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Closure Report">
                              {renderDetailValue('closer_report', selectedRecord.closer_report)}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>

                        <Card
                          size="small"
                          styles={{ body: { padding: 14 } }}
                          title={<span className="font-semibold">Enquiry Documents</span>}
                        >
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
                                render: (value) =>
                                  value ? dayjs(value).format(DISPLAY_DATE_FORMAT + ' HH:mm') : '-',
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
                          {!docsLoading && !projectDocs.length && (
                            <div className="text-center text-gray-500 mt-4">
                              No enquiry documents uploaded
                            </div>
                          )}
                        </Card>
                      </Space>
                    )}
                  </Modal>

                  {/* Proposals Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Title level={4} className="!mb-1">
                          Proposal / Projects
                        </Title>
                        <p className="text-slate-500 text-sm">
                          Showing {filteredData.length} of
                          Proposals / Projects
                        </p>
                        <div className="flex items-center gap-4 mb-4">
                        </div>
                      </div>
                    </div>
                    <Table
                      className="admin-proposals-table"
                      rowKey="key"
                      columns={columns}
                      dataSource={filteredData}
                      loading={tableLoading}
                      pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                      }}
                      sticky
                      bordered
                      tableLayout="fixed"
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="Document Viewer"
        open={!!viewDocumentUrl}
        onCancel={() => {
          setViewDocumentUrl(null)
          setViewDocumentPreviewError('')
          setViewDocumentMime('')
          setViewDocumentPreviewLoading(false)
          if (viewDocumentBlobUrl) {
            URL.revokeObjectURL(viewDocumentBlobUrl)
          }
          setViewDocumentBlobUrl(null)
        }}
        footer={null}
        width={1100}
      >
        {(() => {
          const currentUrl = viewDocumentUrl || ''
          const urlNoQuery = currentUrl.split('#')[0].split('?')[0]
          const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
          const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
          const isOffice = officeTypes.includes(ext)
          const previewUrl = viewDocumentBlobUrl || currentUrl
          const mime = (viewDocumentMime || '').toLowerCase()
          const canPreviewByMime =
            mime.startsWith('application/pdf') || mime.startsWith('image/') || mime.startsWith('text/')

          if (!currentUrl) return null

          if (viewDocumentPreviewLoading) {
            return (
              <div className="flex items-center justify-center h-[60vh]">
                <Spin />
              </div>
            )
          }

          if (viewDocumentPreviewError) {
            return (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="text-6xl mb-4">📎</div>
                <h3 className="text-xl font-semibold">Document Preview</h3>
                <p className="text-gray-500 text-center max-w-md">{viewDocumentPreviewError}</p>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => window.open(currentUrl, '_blank')}
                  className="mt-4"
                >
                  Open / Download
                </Button>
              </div>
            )
          }

          // Office files - show download button
          if (isOffice) {
            return (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-xl font-semibold">
                  {ext ? ext.toUpperCase() : 'Document'}
                </h3>
                <p className="text-gray-500 text-center max-w-md">
                  This document type cannot be previewed directly. Please download to view.
                </p>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(currentUrl, '_blank')}
                  className="mt-4"
                >
                  Download Document
                </Button>
              </div>
            )
          }

          // Preview by MIME (works for /documents/:id/download endpoints without extensions)
          if (canPreviewByMime) {
            if (mime.startsWith('image/')) {
              return (
                <div className="w-full h-[80vh] flex items-center justify-center bg-white">
                  <img
                    src={previewUrl}
                    alt="Document"
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                </div>
              )
            }

            return <iframe src={previewUrl} className="w-full h-[80vh]" title="Document" />
          }

          // Unknown file types - offer download
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <div className="text-6xl mb-4">📎</div>
              <h3 className="text-xl font-semibold">Document Preview</h3>
              <Button
                type="primary"
                size="large"
                onClick={() => window.open(currentUrl, '_blank')}
                className="mt-4"
              >
                Open / Download
              </Button>
            </div>
          )
        })()}
      </Modal>

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
          initialValues={{
            updated_by: localStorage.getItem('loggedInUser'),
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {FORM_FIELDS.map((field) => {
              const isEditingProject = Boolean(editingRecord?.project_number?.toString().trim())
              if (isEditingProject && field.name === 'proposal_status') {
                return null
              }

              const dateFields = [
                'enquiry_date',
                'quote_date',
                'revised_negotiated_quote_date',
                'order_date',
                'delivery_date',
                'extended_delivery_date',
                'date_of_actual_commencement',
                'dispatch_date',
              ]
              const isDateField = dateFields.includes(field.name)

              if (isDateField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value
                        ? dayjs(value).isValid()
                          ? dayjs(value)
                          : null
                        : null,
                    })}
                    normalize={(value) => {
                      if (!value) return ''
                      if (dayjs.isDayjs(value)) {
                        return value.format('YYYY-MM-DD')
                      }
                      return value
                    }}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      format={DISPLAY_DATE_FORMAT}
                      placeholder={`Select ${field.label}`}
                    />
                  </Form.Item>
                )
              }

              const InputComponent = field.input === 'textarea' ? TextArea : Input
              const isUpdatedByField = field.name === 'updated_by'
              const isCustomerName = field.name === 'customer_name'
              const isAddressField = field.name === 'address'
              const isEmailField = field.name === 'email'
              const isPhoneField = field.name === 'phone_no'

              if (isCustomerName) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
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

              if (isAddressField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                  >
                    <AutoComplete
                      options={addressOptions}
                      onSearch={searchAddresses}
                      placeholder="Type or select address..."
                      style={{ width: '100%' }}
                      allowClear
                      onSelect={(value) => form.setFieldsValue({ address: value })}
                    >
                      <Input />
                    </AutoComplete>
                  </Form.Item>
                )
              }

              if (isEmailField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                  >
                    <AutoComplete
                      options={emailOptions}
                      onSearch={searchEmails}
                      placeholder="Type or select email..."
                      style={{ width: '100%' }}
                      allowClear
                      onSelect={(value) => form.setFieldsValue({ email: value })}
                    >
                      <Input />
                    </AutoComplete>
                  </Form.Item>
                )
              }

              if (isPhoneField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                  >
                    <AutoComplete
                      options={phoneOptions}
                      onSearch={searchPhones}
                      placeholder="Type or select phone..."
                      style={{ width: '100%' }}
                      allowClear
                      onSelect={(value) => form.setFieldsValue({ phone_no: value })}
                    >
                      <Input />
                    </AutoComplete>
                  </Form.Item>
                )
              }

              if (field.name === 'customer_type') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value ? [value] : [],
                    })}
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
                      {CUSTOMER_TYPE_OPTIONS.map((option) => (
                        <Select.Option key={option} value={option}>
                          {option}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'request_type') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value ? [value] : [],
                    })}
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
                      {REQUEST_TYPE_OPTIONS.map((option) => (
                        <Select.Option key={option} value={option}>
                          {option}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'quotation_given_by_department') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value ? [value] : [],
                    })}
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
                      {departmentOptions.map((dept) => (
                        <Select.Option key={dept} value={dept}>
                          {dept}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'center') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value ? [value] : [],
                    })}
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
                      onChange={(val) => {
                        const value = Array.isArray(val)
                          ? val[val.length - 1] || ''
                          : val || ''
                        form.setFieldsValue({ center: value, group: undefined })
                        const matchedCentre = centres.find(
                          (c) => (c.code || '').trim() === (value || '').trim(),
                        )
                        setSelectedCentreId(matchedCentre ? matchedCentre.id : null)
                      }}
                    >
                      {centreCodeOptions.map((code) => (
                        <Select.Option key={code} value={code}>
                          {code}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'group') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please select ${field.label}`,
                          },
                        ]
                        : []
                    }
                  >
                    <Select 
                      allowClear 
                      disabled={!selectedCentreId}
                      onChange={(groupValue) => {
                        // Find the selected center and group
                        const selectedCenterCode = form.getFieldValue('center')
                        const selectedCenter = centres.find(c => c.code === selectedCenterCode)
                        const selectedGroup = filteredGroups.find(g => g.code === groupValue)
                        
                        if (selectedCenter && selectedGroup) {
                          // Find all users matching the center and group
                          const matchingUsers = users.filter(user => 
                            user.center === selectedCenterCode && user.group === groupValue
                          )
                          
                          // Update available coordinators list
                          setAvailableCoordinators(matchingUsers)
                          
                          // If there's only one coordinator, auto-select them
                          if (matchingUsers.length === 1) {
                            form.setFieldsValue({ project_co_ordinator: matchingUsers[0].name })
                          } else {
                            // Clear if multiple coordinators or none
                            form.setFieldsValue({ project_co_ordinator: '' })
                          }
                        } else {
                          // Clear if center or group not selected
                          setAvailableCoordinators([])
                          form.setFieldsValue({ project_co_ordinator: '' })
                        }
                        
                        // Re-fetch users to get the updated list for the new center/group
                        setTimeout(() => fetchUsers(), 100) // Small delay to ensure form is updated first
                      }}
                    >
                      {filteredGroups.map((group) => (
                        <Select.Option key={group.id} value={group.code}>
                          {group.code}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'proposal_status') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                          {
                            required: true,
                            message: `Please enter ${field.label}`,
                          },
                        ]
                        : []
                    }
                    getValueProps={(value) => ({
                      value: value ? [value] : [],
                    })}
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

              if (field.name === 'status') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                  >
                    <Select placeholder="-- Select Status --" allowClear>
                      <Select.Option value="Ongoing">Ongoing</Select.Option>
                      <Select.Option value="Completed">Completed</Select.Option>
                      <Select.Option value="On Hold">On Hold</Select.Option>
                      <Select.Option value="Delayed">Delayed</Select.Option>
                      <Select.Option value="Technically completed">Technically completed</Select.Option>
                      <Select.Option value="Short closed by cutomer">Short closed by cutomer</Select.Option>
                      <Select.Option value="Short closed by CMTI">Short closed by CMTI</Select.Option>
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'project_co_ordinator') {
                // Get unique coordinator names
                const uniqueCoordinators = availableCoordinators.filter((user, index, self) =>
                  index === self.findIndex((u) => u.name === user.name)
                )
                
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    rules={
                      field.required
                        ? [
                            {
                              required: true,
                              message: `Please select ${field.label}`,
                            },
                          ]
                        : []
                    }
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder="Select Project Co-ordinator"
                      filterOption={(input, option) =>
                        option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {uniqueCoordinators.map((user) => (
                        <Select.Option key={user.id} value={user.name}>
                          {user.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={
                    field.required
                      ? [
                        {
                          required: true,
                          message: `Please enter ${field.label}`,
                        },
                      ]
                      : []
                  }
                >
                  <InputComponent
                    rows={field.input === 'textarea' ? 2 : undefined}
                    disabled={isUpdatedByField}
                  />
                </Form.Item>
              )
            })}
          </div>
        </Form>
      </Modal>

      {/* Queries Modal for admin users */}
      <Modal
        title={`Queries for Project: ${selectedProjectForQueries?.project_number || selectedProjectForQueries?.activity || 'N/A'}`}
        open={queriesModalOpen}
        onCancel={closeQueriesModal}
        width={800}
        footer={[
          <Button key="close" onClick={closeQueriesModal}>Close</Button>,
        ]}
      >
        <Table
          dataSource={queriesData}
          loading={queriesLoading}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'From',
              dataIndex: 'from_',
              key: 'from_',
              width: 100,
            },
            {
              title: 'Query',
              dataIndex: 'remarks_description',
              key: 'remarks_description',
              ellipsis: true,
              render: (text, record) => (
                <span style={{ 
                  color: record.respond_to_remarks ? '#52c41a' : '#ff4d4f',
                  fontWeight: record.respond_to_remarks ? 'normal' : 'bold'
                }}>
                  {text}
                </span>
              ),
            },
            {
              title: 'Date',
              dataIndex: 'updated_at',
              key: 'updated_at',
              width: 120,
              render: (value) => {
                if (!value) return '-'
                const queryDate = dayjs(value)
                const today = dayjs().startOf('day')
                const yesterday = dayjs().subtract(1, 'day').startOf('day')
                
                if (queryDate.isSame(today, 'day')) {
                  return 'Today ' + queryDate.format('HH:mm')
                } else if (queryDate.isSame(yesterday, 'day')) {
                  return 'Yesterday ' + queryDate.format('HH:mm')
                } else {
                  return queryDate.format('DD-MM-YYYY HH:mm')
                }
              },
            },
            {
              title: 'Response',
              dataIndex: 'respond_to_remarks',
              key: 'respond_to_remarks',
              ellipsis: true,
              width: 150,
              render: (response) => response ? (
                <span style={{ color: '#52c41a', fontWeight: '500' }}>{response}</span>
              ) : (
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>No Response</span>
              ),
            },
            {
              title: 'Action',
              key: 'action',
              width: 80,
              render: (_, record) => (
                <span>
                  {/* Only show Respond button if there's no response yet AND query was sent TO admin (from user) */}
                  {!record.respond_to_remarks && String(record.to) === 'admin' && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => openResponseModal(record)}
                    >
                      Respond
                    </Button>
                  )}
                </span>
              ),
            },
          ]}
        />
        {queriesData.length === 0 && !queriesLoading && (
          <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '16px' }}>No queries found for this project.</div>
        )}
      </Modal>

      {/* Response Modal for admin users */}
      <Modal
        title="Respond to Query"
        open={responseModalOpen}
        onCancel={closeResponseModal}
        width={600}
        footer={[
          <Button key="cancel" onClick={closeResponseModal}>Cancel</Button>,
          <Button key="submit" type="primary" loading={responseLoading} onClick={handleResponseSubmit}>
            Submit Response
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>Query:</label>
            <div style={{ padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              {selectedQuery?.remarks_description || '-'}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>From:</label>
            <Input value={selectedQuery?.from_ || ''} disabled />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>Your Response:</label>
            <Input.TextArea
              rows={4}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Enter your response..."
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default DirectorProposals