import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  MessageOutlined,
  FileOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Dropdown,
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
  Upload,
  Tooltip,
  Badge,
  Segmented,
} from 'antd'
import * as XLSX from 'xlsx'
import { ExcelRenderer } from 'react-excel-renderer'
import mammoth from 'mammoth'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { DISPLAY_DATE_FORMAT, formatDate, formatIndianNumber } from '../config/date.js'
import { CostEstimationModal } from './CostBreakDownAction'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

// Helper function to wrap content in tooltip for full text display
const wrapWithTooltip = (content, maxLength = 30) => {
  if (!content || content === '-' || typeof content !== 'string') {
    return content || '-'
  }

  const displayText = content.length > maxLength ? content.substring(0, maxLength) + '...' : content

  return (
    <Tooltip title={content} placement="topLeft">
      <span>{displayText}</span>
    </Tooltip>
  )
}

const { Title } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker
const { Dragger } = Upload

const toNumericVersion = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

const getDisplayFileName = (name, maxLength = 36) => {
  const value = (name || '').toString()
  if (value.length <= maxLength) return value
  const extIndex = value.lastIndexOf('.')
  const hasExt = extIndex > 0 && extIndex < value.length - 1
  if (!hasExt) return `${value.slice(0, maxLength - 3)}...`

  const ext = value.slice(extIndex)
  const base = value.slice(0, extIndex)
  const allowedBaseLength = Math.max(8, maxLength - ext.length - 3)
  return `${base.slice(0, allowedBaseLength)}...${ext}`
}

const CUSTOMER_TYPE_OPTIONS = [
  'Govt',
  'Private',
  'MHI',
  'MSME',
  'Research Institute',
  'Educational institute',
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

// All fields for data mapping (internal use)
const ALL_FIELDS = [
  { name: 'id', label: 'SL NO', width: 120, inForm: false },
  { name: 'enquiry_date', label: 'Enquiry Date', width: 150 },
  { name: 'customer_type', label: 'Customer Type', width: 170 },
  { name: 'customer_name', label: 'Customer Name', width: 170 },
  { name: 'address', label: 'Address', width: 240 },
  { name: 'email', label: 'Email', width: 200 },
  { name: 'phone_no', label: 'Phone No.', width: 150 },
  { name: 'alternate_contact_details', label: 'Alternate Contact', width: 220 },
  { name: 'request_type', label: 'Request Type', width: 160, render: (value) => (value ? <Tag color="blue">{value}</Tag> : null) },
  { name: 'email_reference', label: 'Email Reference', width: 200 },
  { name: 'quote_reference', label: 'Quote Reference', width: 190 },
  { name: 'quote_description', label: 'Quote Description', width: 240, input: 'textarea' },
  { name: 'quote_date', label: 'Quote Date', width: 140 },
  { name: 'quote_amount', label: 'Quote Amount', width: 160 },
  { name: 'revised_negotiated', label: 'Revised / Negotiated', width: 190, apiName: 'revised/negotiated' },
  { name: 'revised_negotiated_quote_date', label: 'Revised Quote Date', width: 190, apiName: 'revised/negotiated_quote_date' },
  { name: 'revised_negotiated_quote_amount', label: 'Revised Quote Amount', width: 210, apiName: 'revised/negotiated_quote_amount' },
  { name: 'quotation_given_by_department', label: 'Department', width: 180 },
  { name: 'quotation_given_by_name', label: 'Quotation Given By', width: 200 },
  { name: 'proposals_converted', label: 'Proposals Converted', width: 180, input: 'select' },
  { name: 'if_not_reason', label: 'If Not Reason', width: 200, input: 'textarea' },
  { name: 'project_number', label: 'Project Number', width: 140 },
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
  { name: 'project_co_ordinator', label: 'Project Co-ordinator', width: 200 },
  { name: 'center', label: 'Centre', width: 150 },
  { name: 'group', label: 'Group', width: 150 },
  { name: 'co_ordinator_remarks', label: 'Co-ordinator Remarks', width: 220, input: 'textarea' },
  { name: 'closer_report', label: 'Closure Report', width: 200, input: 'textarea' },
  { name: 'technical_completed_year', label: 'Technical Completion Year', width: 220 },
  { name: 'financial_completed_year', label: 'Financial Completion Year', width: 220 },
  { name: 'status', label: 'Status', width: 150 },
  { name: 'proposal_status', label: 'Proposal Status', width: 160 },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 160 },
  { name: 'ppm_remarks', label: 'PPM Remarks', width: 200, input: 'textarea' },
  { name: 'created_at', label: 'Created At', width: 190, inForm: false },
  { name: 'updated_at', label: 'Updated At', width: 190, inForm: false },
  { name: 'updated_by', label: 'Updated By', width: 150, required: true },
  { name: 'is_acknowledged', label: 'Is Acknowledged', width: 150, inForm: false },
]

// Fields required for the coordinator add endpoint
const COORDINATOR_ADD_FIELDS = [
  'enquiry_date',
  'customer_type',
  'customer_name',
  'address',
  'email',
  'phone_no',
  'alternate_contact_details',
  'request_type',
  'email_reference',
  // 'revised_negotiated_quote_amount',
  'quotation_given_by_name',
  'quotation_given_by_department',
  'center',
  'group',
  'proposal_status',
]

// Map API field names to UI field names
const API_FIELD_MAP = {
  'revised/negotiated': 'revised_negotiated',
  'revised/negotiated_quote_date': 'revised_negotiated_quote_date',
  'revised/negotiated_quote_amount': 'revised_negotiated_quote_amount',
}

// Helper function to check if proposals_converted is Yes
const isProposalConverted = (proposalsConverted) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue === 'yes'
}
const getPiName = (record) =>
  (record?.project_co_ordinator || record?.quotation_given_by_name || '').trim()

const getGhName = (record) => (record?.group || 'Group Head').trim()

const normalizeName = (v) => (v || '').toString().trim().toLowerCase()

// thread: 'admin' | 'gh'
const getThreadEvents = (queries, thread, record, currentUserName) => {
  const events = []
  const piName = normalizeName(currentUserName || getPiName(record))
  const ghName = normalizeName(getGhName(record))

  let dbRole = ''
  try {
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      dbRole = normalizeName(JSON.parse(rawUser).dbRole || '')
    }
  } catch {}

  const isSamePerson = dbRole === 'gh'

  ;(queries || []).forEach((q) => {
    const isToAdmin = normalizeName(q.to) === 'admin'
    const isFromAdmin = normalizeName(q.from_) === 'admin'

    if (thread === 'admin') {
      // Chat between Scientist (PI) and Admin
      if (isToAdmin) {
        const fromName = normalizeName(q.from_)
        if (isSamePerson) {
          if (fromName !== piName && fromName !== ghName && fromName !== 'group head') return
        } else {
          if (fromName !== piName) return
        }
      } else if (isFromAdmin) {
        const toName = normalizeName(q.to)
        if (isSamePerson) {
          if (toName !== piName && toName !== ghName && toName !== 'group head') return
        } else {
          if (toName !== piName) return
        }
      } else {
        return
      }
    } else {
      // Chat between Scientist (PI) and Group Head (GH)
      if (isToAdmin || isFromAdmin) return

      const isToPi = normalizeName(q.to) === piName
      const isFromPi = normalizeName(q.from_) === piName
      const isToGh = normalizeName(q.to) === ghName || normalizeName(q.to) === 'group head'
      const isFromGh = normalizeName(q.from_) === ghName || normalizeName(q.from_) === 'group head'

      const isGhToPi = isFromGh && isToPi
      const isPiToGh = isFromPi && isToGh

      if (!isGhToPi && !isPiToGh) return
    }

    events.push({ id: `${q.id}-msg`, dbId: q.id, content: q.remarks_description, from_: q.from_, timestamp: q.updated_at, reply_seen: q.reply_seen, respond_to_remarks: q.respond_to_remarks })
    if (q.respond_to_remarks) {
      events.push({ id: `${q.id}-reply`, dbId: q.id, content: q.respond_to_remarks, from_: q.to, timestamp: q.updated_at, reply_seen: q.reply_seen, respond_to_remarks: q.respond_to_remarks })
    }
  })
  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

const getThreadUnseenCount = (record, currentUserName, thread) => {
  if (!record || !record.queries) return 0
  const myName = normalizeName(currentUserName || '')
  const myGroupName = normalizeName(record.group || '')
  const sender = thread === 'admin' ? 'admin' : myGroupName

  let dbRole = ''
  try {
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      dbRole = normalizeName(JSON.parse(rawUser).dbRole || '')
    }
  } catch {}

  const isSamePerson = dbRole === 'gh'

  return record.queries.filter((q) => {
    // Case 1: Incoming message from sender to me
    const isFromSender = normalizeName(q.from_) === normalizeName(sender) || (sender !== 'admin' && normalizeName(q.from_) === 'group head')
    const isToMe = thread === 'admin'
      ? (isSamePerson
          ? (normalizeName(q.to) === myName || normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head')
          : normalizeName(q.to) === myName)
      : normalizeName(q.to) === myName

    if (isFromSender && isToMe && q.message_seen === false) {
      return true
    }

    // Case 2: Reply from sender to my message
    const isToSender = normalizeName(q.to) === normalizeName(sender) || (sender !== 'admin' && normalizeName(q.to) === 'group head')
    const isFromMe = thread === 'admin'
      ? (isSamePerson
          ? (normalizeName(q.from_) === myName || normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head')
          : normalizeName(q.from_) === myName)
      : normalizeName(q.from_) === myName

    if (isFromMe && isToSender && q.respond_to_remarks && q.reply_seen === false) {
      return true
    }
    return false
  }).length
}

const countUnseenReplies = (record, currentUserName, userRole) => {
  return getThreadUnseenCount(record, currentUserName, 'admin') + getThreadUnseenCount(record, currentUserName, 'gh')
}

const isPendingReply = (record, currentUserName, userRole) => {
  const queries = record.queries || []
  const myName = normalizeName(currentUserName || '')
  const myGroupName = normalizeName(record?.group || '')

  // ⚠️ Reply Needed for scientist when:
  // Admin or GH sent a NEW message directly to scientist (to=scientist)
  // AND that message has NOT been replied to yet (no respond_to_remarks)
  return queries.some((q) => {
    const isFromSender = normalizeName(q.from_) === 'admin' || normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head'
    return isFromSender && normalizeName(q.to) === myName && !q.respond_to_remarks
  })
}

const isProposalNotConverted = (proposalsConverted, ifNotReason) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  const isNo = convertedValue === 'no'
  const reasonIsBlank = !ifNotReason || String(ifNotReason).trim() === ''
  return isNo && reasonIsBlank
}

function ScientistProposals() {
  const [form] = Form.useForm()
  const [coordinatorForm] = Form.useForm()

  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [projectNumberFilter, setProjectNumberFilter] = useState(null)
  const [currentUserName, setCurrentUserName] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return (parsed.name || '').trim()
      }
    } catch {}
    return ''
  })
  const [currentUserCenter, setCurrentUserCenter] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return parsed.center || ''
      }
    } catch {}
    return ''
  })
  const [currentUserGroup, setCurrentUserGroup] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return parsed.group || ''
      }
    } catch {}
    return ''
  })
  const [stats, setStats] = useState({
    totalProposals: 0,
    totalProjects: 0,
    technicallyCompleted: 0,
    financiallyCompleted: 0,
    ongoingProjects: 0
  })
  const [coordinatorModalOpen, setCoordinatorModalOpen] = useState(false)
  const [costEstimationModalOpen, setCostEstimationModalOpen] = useState(false)
  const [selectedProposalForCostEstimation, setSelectedProposalForCostEstimation] = useState(null)

  const [coordinatorSubmitLoading, setCoordinatorSubmitLoading] = useState(false)
  const [customerOptions, setCustomerOptions] = useState([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [allCustomerSuggestions, setAllCustomerSuggestions] = useState([])
  const [addressOptions, setAddressOptions] = useState([])
  const [phoneOptions, setPhoneOptions] = useState([])
  const [emailOptions, setEmailOptions] = useState([])
  const [userRole, setUserRole] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        const role = parsedUser.dbRole || parsedUser.role
        return role?.toLowerCase() || ''
      }
    } catch (e) {
      console.error(e)
    }
    return ''
  })

  // Unacknowledged proposals state
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false)
  const [showNewMessagesOnly, setShowNewMessagesOnly] = useState(false)
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
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadProjectId, setUploadProjectId] = useState(null)
  const [enquiryFileToUpload, setEnquiryFileToUpload] = useState(null)
  const [proposalFileToUpload, setProposalFileToUpload] = useState(null)
  const [uploadedBy, setUploadedBy] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [latestEnquiryVersion, setLatestEnquiryVersion] = useState(0)
  const [latestProposalVersion, setLatestProposalVersion] = useState(0)
  const [showVersionEditor, setShowVersionEditor] = useState(false)
  const [enquiryVersionInput, setEnquiryVersionInput] = useState('')
  const [proposalVersionInput, setProposalVersionInput] = useState('')

  const [enquiryAttachments, setEnquiryAttachments] = useState([])
  const [proposalAttachments, setProposalAttachments] = useState([])



  // Store unresponded query counts for each project to conditionally show Queries button
  const [unrespondedQueryCounts, setUnrespondedQueryCounts] = useState({})

  // "Reason Required" popup state
  const [reasonPopupOpen, setReasonPopupOpen] = useState(false)
  const [reasonInputs, setReasonInputs] = useState({})
  const [savingReasonIds, setSavingReasonIds] = useState({})

  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatProject, setChatProject] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatThread, setChatThread] = useState('admin') // 'admin' | 'gh'
  const [showPendingReplyOnly, setShowPendingReplyOnly] = useState(false)

  const messagesEndRef = useRef(null)

  const chatEvents = useMemo(
    () => getThreadEvents(chatMessages, chatThread, chatProject, currentUserName),
    [chatMessages, chatThread, chatProject, currentUserName],
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (chatModalOpen) {
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [chatEvents, chatModalOpen])

  const unreadChatsCount = useMemo(() => {
    return tableData.filter((item) => countUnseenReplies(item, currentUserName, userRole) > 0).length
  }, [tableData, currentUserName, userRole])

  const pendingReplyCount = useMemo(() => {
    return tableData.filter((item) => isPendingReply(item, currentUserName, userRole)).length
  }, [tableData, currentUserName, userRole])

  // Slim columns for Scientist (matching GH restricted view) - now inside component
  const getTableFields = (isProposal = false) => {
    const baseFields = [
      { name: 'id', label: 'SL NO', width: 50, render: (text, record, index) => index + 1 },
      { name: 'project_number', label: 'Project Number', width: 100 },
      { name: 'activity', label: 'Project Name', width: 140 },
      { name: 'customer_name', label: 'Customer Name', width: 120 },
      { name: 'dispatch_date', label: 'Dispatch Date', width: 100 },
    ]

    // Add "Proposal Given By" column only for proposals (items without project number)
    if (isProposal) {
      baseFields.push({ name: 'quotation_given_by_name', label: 'Proposal Given By', width: 120 })
    }

    baseFields.push({ name: 'project_co_ordinator', label: 'Project Co-ordinator', width: 120 })

    return baseFields
  }

  const TABLE_FIELDS = [
    ...getTableFields(false),
  ]

  // Scientist can only edit certain fields
  const SCIENTIST_EDITABLE_FIELDS = [
    'extended_delivery_date',
    'co_ordinator_remarks',
    'technical_completed_year',
    'updated_by',
    'closer_report',
    'proposal_status',
    // 'if_not_reason',
  ]

  // Map API response to UI format
  const mapApiToUi = (item) => {
    const mapped = { ...item }
    // Map API field names to UI field names
    Object.entries(API_FIELD_MAP).forEach(([apiName, uiName]) => {
      if (item[apiName] !== undefined) {
        mapped[uiName] = item[apiName]
      }
    })
    return mapped
  }

  const fetchProposals = useCallback(async () => {
    setTableLoading(true)
    let name = ''
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        name = (parsedUser.name || '').trim()
        setCurrentUserName(name)
        setCurrentUserCenter(parsedUser.center || '')
        setCurrentUserGroup(parsedUser.group || '')
        const role = parsedUser.dbRole || parsedUser.role
        setUserRole(role?.toLowerCase() || '')
      }
    } catch (storageError) {
      console.error('Failed to read user from localStorage', storageError)
    }

    try {
      if (!name) {
        throw new Error('User name not found in localStorage')
      }

      const encodedName = encodeURIComponent(name)
      const url = `${API_BASE_URL}/proposals/by-name/${encodedName}?user_role=scientist`

      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setTableData([])
          setFilteredData([])
          return
        }
        throw new Error('Unable to fetch proposals')
      }

      const list = await response.json()
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
          const docsByProject = {};
          (Array.isArray(allDocs) ? allDocs : []).forEach((d) => {
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
      console.error(error)
      message.error(error.message || 'Unable to fetch proposals')
    } finally {
      setTableLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (!rawUser) return
      const parsedUser = JSON.parse(rawUser)
      const name = (parsedUser.name || '').trim()
      if (!name) return

      const encodedName = encodeURIComponent(name)
      const url = `${API_BASE_URL}/proposals/stats/by-scientist/${encodedName}`
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Unable to fetch proposal stats')
      }

      const payload = await response.json()
      setStats(payload)
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
        id: customer.id,
        name: customer.name,
        customer_type: customer.customer_type,
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

  const fetchUnacknowledgedCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/unacknowledged`, {
        headers: { accept: 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()

        let filteredData = Array.isArray(data) ? data : []

        // If user is scientist, filter by their name (trim spaces and case-insensitive)
        if (userRole === 'scientist' && currentUserName) {
          const cleanCurrentName = currentUserName.trim().toLowerCase()
          console.log('🔍 Filtering for scientist:', cleanCurrentName)

          filteredData = filteredData.filter(item => {
            const cleanCoordinatorName = (item.project_co_ordinator || '').trim().toLowerCase()
            const cleanQuotationName = (item.quotation_given_by_name || '').trim().toLowerCase()
            const isProject = Boolean(item.project_number?.trim())

            console.log('📋 Project:', {
              id: item.id,
              project_number: item.project_number,
              isProject,
              coordinator: item.project_co_ordinator,
              quotation_giver: item.quotation_given_by_name,
              cleanCoordinatorName,
              cleanQuotationName,
              coordinator_matches: cleanCoordinatorName === cleanCurrentName,
              quotation_matches: cleanQuotationName === cleanCurrentName
            })

            // For projects: only show if user is coordinator
            // For proposals/all: show if user is coordinator OR gave quotation
            if (isProject) {
              return cleanCoordinatorName === cleanCurrentName
            } else {
              return cleanCoordinatorName === cleanCurrentName || cleanQuotationName === cleanCurrentName
            }
          })

          console.log('✅ Filtered projects count:', filteredData.length)
        } else {
          console.log('Skipping filtering - not scientist or no username')
        }

        const count = filteredData.length
        setUnacknowledgedCount(count)
        console.log('Final unacknowledged count:', count)
      }
    } catch (error) {
      console.error('Failed to fetch unacknowledged count:', error)
    }
  }

  const fetchUnacknowledgedProposals = async () => {
    setTableLoading(true)
    try {
      // Use general endpoint and filter client-side for scientists
      const response = await fetch(`${API_BASE_URL}/proposals/unacknowledged`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Unable to fetch unacknowledged proposals')
      const list = await response.json()
      let normalized = (Array.isArray(list) ? list : []).map(mapApiToUi)

      // If user is scientist, filter by their name (trim spaces and case-insensitive)
      if (userRole === 'scientist' && currentUserName) {
        const cleanCurrentName = currentUserName.trim().toLowerCase()
        normalized = normalized.filter(item => {
          const cleanCoordinatorName = (item.project_co_ordinator || '').trim().toLowerCase()
          const cleanQuotationName = (item.quotation_given_by_name || '').trim().toLowerCase()
          const isProject = Boolean(item.project_number?.trim())

          // For projects: only show if user is coordinator
          // For proposals/all: show if user is coordinator OR gave quotation
          if (isProject) {
            return cleanCoordinatorName === cleanCurrentName
          } else {
            return cleanCoordinatorName === cleanCurrentName || cleanQuotationName === cleanCurrentName
          }
        })
      }

      setTableData(normalized)
      setFilteredData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch unacknowledged proposals')
    } finally {
      setTableLoading(false)
    }
  }

  const handleUnacknowledgedToggle = async () => {
    if (showUnacknowledgedOnly) {
      setShowUnacknowledgedOnly(false)
      setTableData(originalTableData)
      setFilteredData(originalTableData)
      await fetchProposals()
      // Small delay to ensure data is set, then fetch queries
      setTimeout(async () => {
        await fetchAllQueryCounts()
      }, 100)
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

  const openUploadModalForProject = useCallback(async (projectId) => {
    setUploadProjectId(projectId)
    setUploadedBy(currentUserName || '')
    setUploadDescription('')
    setEnquiryFileToUpload(null)
    setProposalFileToUpload(null)
    setEnquiryAttachments([])
    setProposalAttachments([])
    setShowVersionEditor(false)

    const enquiryStage = stageConfig.find(
      (s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry',
    )
    const proposalStage = stageConfig.find(
      (s) => (s.name || '').toString().trim().toLowerCase() === 'proposal',
    )

    let enquiryLatest = 0
    let proposalLatest = 0
    try {
      const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      const allDocs = docsRes.ok ? await docsRes.json() : []
      const docsForProject = (Array.isArray(allDocs) ? allDocs : []).filter((doc) => {
        const pid = doc?.project_id ?? doc?.project ?? doc?.projectId
        return pid != null && String(pid) === String(projectId)
      })
      enquiryLatest = docsForProject
        .filter((doc) => String(doc?.stage_id ?? doc?.stage ?? doc?.stageId) === String(enquiryStage?.id))
        .reduce((max, doc) => Math.max(max, toNumericVersion(doc?.version)), 0)
      proposalLatest = docsForProject
        .filter((doc) => String(doc?.stage_id ?? doc?.stage ?? doc?.stageId) === String(proposalStage?.id))
        .reduce((max, doc) => Math.max(max, toNumericVersion(doc?.version)), 0)
    } catch (error) {
      console.error('Unable to load latest versions', error)
    }

    setLatestEnquiryVersion(enquiryLatest)
    setLatestProposalVersion(proposalLatest)
    setEnquiryVersionInput(String(enquiryLatest + 1))
    setProposalVersionInput(String(proposalLatest + 1))
    setUploadModalVisible(true)
  }, [currentUserName, stageConfig])

  const closeUploadModal = useCallback(() => {
    setUploadModalVisible(false)
    setEnquiryFileToUpload(null)
    setProposalFileToUpload(null)
    setEnquiryAttachments([])
    setProposalAttachments([])
    setShowVersionEditor(false)
  }, [])

  const handleAddEnquiryAttachments = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      setEnquiryAttachments((prev) => [...prev, ...files])
    }
    e.target.value = '' // allow re-selecting the same file later
  }

  const handleRemoveEnquiryAttachment = (index) => {
    setEnquiryAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddProposalAttachments = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      setProposalAttachments((prev) => [...prev, ...files])
    }
    e.target.value = ''
  }

  const handleRemoveProposalAttachment = (index) => {
    setProposalAttachments((prev) => prev.filter((_, i) => i !== index))
  }


  const handleUploadBothDocuments = useCallback(async () => {
    if (!uploadProjectId) {
      message.error('Project ID not available')
      return
    }
    if (!enquiryFileToUpload && !proposalFileToUpload) {
      message.error('Please select at least one file')
      return
    }
    const uploader = (uploadedBy || currentUserName || '').trim()
    if (!uploader) {
      message.error('Your name is required')
      return
    }

    const enquiryStage = stageConfig.find(
      (s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry',
    )
    const proposalStage = stageConfig.find(
      (s) => (s.name || '').toString().trim().toLowerCase() === 'proposal',
    )

    if (!enquiryStage?.id || !proposalStage?.id) {
      message.error('Enquiry/Proposal stages not configured')
      return
    }

    const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
      headers: { accept: 'application/json' },
    })
    const allDocs = docsRes.ok ? await docsRes.json() : []
    const docsForProject = (Array.isArray(allDocs) ? allDocs : []).filter((doc) => {
      const pid = doc?.project_id ?? doc?.project ?? doc?.projectId
      return pid != null && String(pid) === String(uploadProjectId)
    })

    const getNextVersionForStage = (stageId) => {
      const maxVersion = docsForProject
        .filter((doc) => String(doc?.stage_id ?? doc?.stage ?? doc?.stageId) === String(stageId))
        .reduce((max, doc) => Math.max(max, toNumericVersion(doc?.version)), 0)
      return String(maxVersion + 1)
    }

    const uploadSingleDoc = async ({ file, stageId, name, version, attachment = [] }) => {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', uploadDescription.trim())
      formData.append('project_id', uploadProjectId)
      formData.append('stage_id', stageId)
      formData.append('uploaded_by', uploader)
      formData.append('version', version)
      formData.append('file', file)

      attachment.forEach((att) => {
        formData.append('attachment', att)
      })

      const res = await fetch(`${API_BASE_URL}/documents/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Upload failed')
        throw new Error(errText || 'Upload failed')
      }
    }

    setUploading(true)
    try {
      const uploads = []
      if (enquiryFileToUpload) {
        const enquiryVersion = showVersionEditor
          ? (enquiryVersionInput || getNextVersionForStage(enquiryStage.id))
          : getNextVersionForStage(enquiryStage.id)
        uploads.push(
          uploadSingleDoc({
            file: enquiryFileToUpload,
            stageId: enquiryStage.id,
            name: 'Enquiry',
            version: enquiryVersion,
            attachment: enquiryAttachments,
          }),
        )
      }
      if (proposalFileToUpload) {
        const proposalVersion = showVersionEditor
          ? (proposalVersionInput || getNextVersionForStage(proposalStage.id))
          : getNextVersionForStage(proposalStage.id)
        uploads.push(
          uploadSingleDoc({
            file: proposalFileToUpload,
            stageId: proposalStage.id,
            name: 'Proposal',
            version: proposalVersion,
            attachment: proposalAttachments,
          }),
        )
      }

      await Promise.all(uploads)
      message.success('Document upload completed')
      closeUploadModal()
      await fetchProjectDocuments(uploadProjectId)
    } catch (error) {
      console.error('Upload failed:', error)
      message.error(error.message || 'Document upload failed')
    } finally {
      setUploading(false)
    }
  }, [
    uploadProjectId,
    enquiryFileToUpload,
    proposalFileToUpload,
    uploadedBy,
    currentUserName,
    stageConfig,
    uploadDescription,
    showVersionEditor,
    enquiryVersionInput,
    proposalVersionInput,
    enquiryAttachments,
    proposalAttachments,
    closeUploadModal,
    fetchProjectDocuments,
  ])

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
    const loadData = async () => {
      await fetchProposals()
      await fetchStats()
      await fetchStageConfig()
      await fetchCustomerSuggestions() // Load customer suggestions
      await fetchAllQueryCounts() // Load queries after proposals are loaded
      await fetchUnacknowledgedCount() // Load unacknowledged count after user info is set
    }
    loadData()
  }, [])

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

  const openEditModal = useCallback(
    (record) => {
      setEditingRecord(record)
      form.setFieldsValue({ ...record, updated_by: currentUserName || record.updated_by })
      setModalOpen(true)
    },
    [form, currentUserName],
  )

  // Fetch all unresponded query counts for all projects
  const fetchAllQueryCounts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) return

      const allQueries = await response.json()
      if (!Array.isArray(allQueries)) return

      // Count unresponded queries per project and attach queries to records
      const counts = {}
      const queriesByProject = {}

      allQueries.forEach(query => {
        const projectId = String(query.project_id)

        // Group queries by project
        if (!queriesByProject[projectId]) {
          queriesByProject[projectId] = []
        }
        queriesByProject[projectId].push(query)

        // Count all unresponded queries for proposals view (not just queries sent TO scientist)
        if (!query.respond_to_remarks) {
          counts[projectId] = (counts[projectId] || 0) + 1
        }
      })

      // Attach queries to table data
      setTableData(prevData =>
        prevData.map(record => ({
          ...record,
          queries: queriesByProject[String(record.id)] || []
        }))
      )

      setFilteredData(prevData =>
        prevData.map(record => ({
          ...record,
          queries: queriesByProject[String(record.id)] || []
        }))
      )

      setUnrespondedQueryCounts(counts)
    } catch (error) {
      console.error('Error fetching query counts:', error)
    }
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    form.resetFields()
  }, [form])

  const openDetailModal = useCallback((record) => {
    setSelectedRecord(record)
    setDetailModalOpen(true)
  }, [])

  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false)
    setSelectedRecord(null)
  }, [])


  const loadChatMessages = useCallback(async (record, thread) => {
    setChatLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/?project_id=${record.id}`, {
        headers: { accept: 'application/json' },
      })
      const projectMessages = response.ok ? await response.json() : []
      setChatMessages(Array.isArray(projectMessages) ? projectMessages : [])
    } catch (error) {
      console.error('Error loading chat:', error)
      message.error('Unable to load conversation')
    } finally {
      setChatLoading(false)
    }
  }, [])

  const markSeenForActiveThread = useCallback(async (record, thread) => {
    if (!record) return
    const myName = normalizeName(currentUserName || '')
    const myGroupName = normalizeName(record.group || '')

    // Who is the sender of incoming messages in this thread?
    const sender = thread === 'admin' ? 'admin' : myGroupName

    // Case 1: Mark incoming messages to me from the active thread sender as seen
    const unseenMessages = (record.queries || []).filter(
      (q) => {
        const isFromSender = normalizeName(q.from_) === normalizeName(sender) || (sender !== 'admin' && normalizeName(q.from_) === 'group head')
        return isFromSender && normalizeName(q.to) === myName && q.message_seen === false
      }
    )
    unseenMessages.forEach(async (q) => {
      try {
        await fetch(`${API_BASE_URL}/Remarkss/${q.id}/mark-seen`, { method: 'PATCH' })
      } catch (e) {
        console.warn('mark-seen failed for', q.id, e)
      }
    })

    // Case 2: Mark replies from the active thread sender to my messages as seen
    const unseenReplies = (record.queries || []).filter(
      (q) => {
        const isToSender = normalizeName(q.to) === normalizeName(sender) || (sender !== 'admin' && normalizeName(q.to) === 'group head')
        return normalizeName(q.from_) === myName && isToSender && q.respond_to_remarks && q.reply_seen === false
      }
    )
    unseenReplies.forEach(async (q) => {
      try {
        await fetch(`${API_BASE_URL}/Remarkss/${q.id}/mark-reply-seen`, { method: 'PATCH' })
      } catch (e) {
        console.warn('mark-reply-seen failed for', q.id, e)
      }
    })

    const hasUpdates = unseenMessages.length > 0 || unseenReplies.length > 0
    if (hasUpdates) fetchProposals()
  }, [currentUserName])

  const openChatModal = useCallback(async (record, thread = 'admin') => {
    setChatProject(record)
    setChatThread(thread)
    setChatModalOpen(true)
    await loadChatMessages(record, thread)
    await markSeenForActiveThread(record, thread)
  }, [loadChatMessages, markSeenForActiveThread])

  const switchChatThread = useCallback(async (thread) => {
    setChatThread(thread)
    if (chatProject) {
      await loadChatMessages(chatProject, thread)
      await markSeenForActiveThread(chatProject, thread)
    }
  }, [chatProject, loadChatMessages, markSeenForActiveThread])

  const closeChatModal = useCallback(() => {
    setChatModalOpen(false)
    setChatProject(null)
    setChatMessages([])
    setChatInput('')
  }, [])

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !chatProject?.id) return
    setChatSending(true)
    try {
      const myName = normalizeName(currentUserName || 'scientist')
      const myGroupName = normalizeName(getGhName(chatProject) || '')
      const recipient = chatThread === 'admin' ? 'admin' : myGroupName

      // Find the latest unanswered message FROM the active thread sender TO scientist (no respond_to_remarks yet)
      const unansweredMsg = [...(chatMessages || [])]
        .reverse()
        .find((q) => {
          const isFromRecipient = normalizeName(q.from_) === recipient || (recipient !== 'admin' && normalizeName(q.from_) === 'group head')
          return isFromRecipient && normalizeName(q.to) === myName && !q.respond_to_remarks
        })

      if (unansweredMsg) {
        // REPLY to message: PUT on the existing row
        const payload = {
          respond_to_remarks: chatInput.trim(),
          replyer: currentUserName || 'Scientist',
          reply_seen: false,
        }
        const response = await fetch(`${API_BASE_URL}/Remarkss/${unansweredMsg.id}`, {
          method: 'PUT',
          headers: { accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to send reply')
        }
      } else {
        // NEW MESSAGE from scientist to admin or GH
        const payload = {
          from_: currentUserName || 'Scientist',
          to: chatThread === 'admin' ? 'admin' : getGhName(chatProject),
          project_id: chatProject.id,
          remarks_description: chatInput.trim(),
          respond_to_remarks: null,
          replyer: null,
          message_seen: false,
          reply_seen: false,
        }
        const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
          method: 'POST',
          headers: { accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to send message')
        }
      }

      setChatInput('')
      await loadChatMessages(chatProject, chatThread)
      await fetchAllQueryCounts()
    } catch (error) {
      console.error('Error sending message:', error)
      message.error(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }

  // Open/Close Coordinator Add Modal
  const openCoordinatorAddModal = () => {
    coordinatorForm.resetFields()

    if (currentUserName) {
      coordinatorForm.setFieldsValue({
        quotation_given_by_name: currentUserName,
        quotation_given_by_department: currentUserCenter ? currentUserCenter.toUpperCase() : '',
        center: currentUserCenter || '',
        group: currentUserGroup || '',
      })
    }

    setCoordinatorModalOpen(true)
  }

  const closeCoordinatorModal = () => {
    setCoordinatorModalOpen(false)
    coordinatorForm.resetFields()
    setCustomerOptions([])
  }

  // Search customers by name
  const searchCustomers = useCallback(async (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) {
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
      .filter((customer) => {
        const customerName = (customer.name || '').toString().trim().toLowerCase()
        return customerName.includes(normalized)
      })
      .slice(0, 20) // Limit to 20 results
      .map((customer) => ({
        value: customer.name,
        label: customer.name,
        ...customer,
      }))

    setCustomerOptions(matches)
  },
    [allCustomerSuggestions, fetchCustomerSuggestions],
  )

  const handleCustomerSelect = useCallback(
    (value, option) => {
      if (!option) return

      // Only pre-fill the customer name/type; let the user choose / type other contact details
      form.setFieldsValue({
        customer_name: option.name,
        customer_type: option.customer_type || '',
      })

      // Set address, phone, and email options for the selected customer
      const addresses = Array.isArray(option.addresses) ? option.addresses : []
      setAddressOptions(addresses.map((a) => ({ value: a, label: a })))

      const phones = []
      if (option.phone_no) phones.push(option.phone_no)
      if (option.alternate_contact_details) phones.push(option.alternate_contact_details)
      setPhoneOptions(Array.from(new Set(phones)).map((p) => ({ value: p, label: p })))

      const emails = []
      if (option.email) emails.push(option.email)
      setEmailOptions(Array.from(new Set(emails)).map((e) => ({ value: e, label: e })))
    },
    [form],
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
        const normalized = searchValue.trim().toLowerCase()

        // Find the selected customer in allCustomerSuggestions
        const selectedCustomer = allCustomerSuggestions.find(
          (customer) => customer.name === currentName
        )

        if (selectedCustomer && selectedCustomer.addresses) {
          const addresses = Array.isArray(selectedCustomer.addresses)
            ? selectedCustomer.addresses
            : [selectedCustomer.addresses].filter(Boolean)

          const matches = addresses
            .filter((a) => a?.toLowerCase().includes(normalized))
            .slice(0, 20)
          setAddressOptions(matches.map((a) => ({ value: a, label: a })))
        }
      } catch (error) {
        console.error('Address search error:', error)
        setAddressOptions([])
      }
    },
    [form, allCustomerSuggestions],
  )

  const searchEmails = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setEmailOptions([])
        return
      }

      const normalized = searchValue.trim().toLowerCase()

      // Ensure we have the full list fetched
      let customerList = allCustomerSuggestions
      if (!customerList.length) {
        customerList = await fetchCustomerSuggestions()
      }

      const matches = (customerList || [])
        .map((customer) => customer.email)
        .filter((e) => e && e.toLowerCase().includes(normalized))
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

      // Ensure we have the full list fetched
      let customerList = allCustomerSuggestions
      if (!customerList.length) {
        customerList = await fetchCustomerSuggestions()
      }

      const matches = (customerList || [])
        .flatMap((customer) => {
          const phones = []
          if (customer.phone_no) phones.push(customer.phone_no)
          if (customer.alternate_contact_details) phones.push(customer.alternate_contact_details)
          return phones
        })
        .filter((p) => p && p.toLowerCase().includes(normalized))
        .slice(0, 20)

      setPhoneOptions(matches.map((p) => ({ value: p, label: p })))
    },
    [allCustomerSuggestions, fetchCustomerSuggestions],
  )

  const handleCoordinatorSubmit = async (values) => {
    setCoordinatorSubmitLoading(true)

    // Helper to get API name if different
    const getApiName = (fieldName) => {
      const apiMap = {
        'revised_negotiated': 'revised/negotiated',
        'revised_negotiated_quote_date': 'revised/negotiated_quote_date',
        'revised_negotiated_quote_amount': 'revised/negotiated_quote_amount',
      }
      return apiMap[fieldName] || fieldName
    }

    const payload = {}
    COORDINATOR_ADD_FIELDS.forEach((fieldName) => {
      const apiName = getApiName(fieldName)
      payload[apiName] = values[fieldName] ?? ''
    })

    // Add user information and set project_coordinator
    payload.project_coordinator = values.quotation_given_by_name || currentUserName || ''
    payload.center = currentUserCenter || ''
    payload.group = currentUserGroup || ''

    // Add complete user data
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser)
      payload.user_id = parsedUser.id || 0
      payload.user_name = parsedUser.name || ''
      payload.user_email = parsedUser.email || ''
      payload.user_role = parsedUser.role || ''
      payload.user_center = parsedUser.center || ''
      payload.user_group = parsedUser.group || ''
    }

    try {
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

      const result = await response.json()
      const newProjectId = result?.proposal_id
      if (newProjectId) {
        openUploadModalForProject(newProjectId)
      }

      message.success('Proposal created successfully')
      closeCoordinatorModal()
      await fetchProposals()
      await fetchStats()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to create proposal')
    } finally {
      setCoordinatorSubmitLoading(false)
    }
  }

  const handleSubmit = async (values) => {
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
      closer_report: values.closer_report || '',
      updated_by: values.updated_by || currentUserName || '',
      //if_not_reason: values.if_not_reason || '',
    }
    const isProject = Boolean(editingRecord?.project_number?.toString().trim())
    if (!isProject) {
      payload.proposal_status = values.proposal_status || ''
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

  // Proposals marked "No" that still need an "if_not_reason" filled in
  const notConvertedNoReasonList = useMemo(
    () => tableData.filter((item) => isProposalNotConverted(item.proposals_converted, item.if_not_reason)),
    [tableData],
  )

  const openReasonPopup = () => {
    const initialInputs = {}
    notConvertedNoReasonList.forEach((item) => {
      initialInputs[item.id] = ''
    })
    setReasonInputs(initialInputs)
    setReasonPopupOpen(true)
  }

  const handleSaveReason = async (record, reasonText) => {
    const trimmedReason = (reasonText || '').trim()
    if (!trimmedReason) {
      message.error('Please enter a reason before saving')
      return
    }
    setSavingReasonIds((prev) => ({ ...prev, [record.id]: true }))
    try {
      const payload = {
        project_id: record.id,
        extended_delivery_date: record.extended_delivery_date || '',
        co_ordinator_remarks: record.co_ordinator_remarks || '',
        technical_completed_year: record.technical_completed_year || null,
        closer_report: record.closer_report || '',
        updated_by: currentUserName || record.updated_by || '',
        if_not_reason: trimmedReason,
        proposal_status: record.proposal_status || '',
      }

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
        throw new Error(errorBody.detail || 'Failed to save reason')
      }

      message.success('Reason saved successfully')

      // Reflect the change locally so the card drops off this list right away
      const updateRecord = (list) =>
        list.map((it) => (it.id === record.id ? { ...it, if_not_reason: trimmedReason } : it))

      setTableData(updateRecord)
      setFilteredData(updateRecord)
      setOriginalTableData(updateRecord)

      setReasonInputs((prev) => {
        const next = { ...prev }
        delete next[record.id]
        return next
      })
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to save reason')
    } finally {
      setSavingReasonIds((prev) => {
        const next = { ...prev }
        delete next[record.id]
        return next
      })
    }
  }

  // Statistics
  const statistics = useMemo(() => {
    const totalProposals = tableData.filter((item) => !item.project_number?.trim()).length  // Only count items WITHOUT project number
    const totalProjects = tableData.filter((item) => item.project_number?.trim()).length
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

    const convertedNo = tableData.filter(
      (item) => isProposalNotConverted(item.proposals_converted, item.if_not_reason),
    ).length

    // Calculate project code breakdown
    const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']
    const projectCodeBreakdown = {}
    tableData.forEach((item) => {
      if (item.project_number?.trim()) {
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
      convertedNo,
      projectCodeBreakdown,
    }
  }, [tableData])

  // Filter data based on search and filters
  useEffect(() => {
    console.log('Initial tableData length:', tableData.length)
    console.log('Initial filteredData length:', filteredData.length)
    console.log('Current statusFilter:', statusFilter)

    let filtered = tableData

    if (searchText) {
      const searchLower = searchText.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          (item.project_number && item.project_number.toLowerCase().includes(searchLower)) ||
          (item.activity && item.activity.toLowerCase().includes(searchLower)) ||
          (item.customer_name && item.customer_name.toLowerCase().includes(searchLower))
      )
    }


    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      filtered = filtered.filter((item) => {
        const orderDate = item.order_date ? dayjs(item.order_date) : null
        return orderDate && orderDate.isAfter(start.startOf('day')) && orderDate.isBefore(end.endOf('day'))
      })
    }

    if (statusFilter && statusFilter !== 'totalProjects') {
      if (statusFilter === 'proposals') {
        // For proposals, filter by NOT having a project number
        filtered = filtered.filter((item) => !item.project_number || item.project_number.trim() === '')
        console.log('After proposals filter:', filtered.length, 'items:', filtered.map(item => ({ project_number: item.project_number, customer_name: item.customer_name })))
      } else if (statusFilter === 'technicallyCompleted') {
        // Filter by technical completion criteria (same as statistics calculation)
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '',
        )
        console.log('After technicallyCompleted filter:', filtered.length, 'items')
      } else if (statusFilter === 'financiallyCompleted') {
        // Filter by financial completion criteria (same as statistics calculation)
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '' &&
            item.financial_completed_year &&
            item.financial_completed_year.trim() !== '',
        )
        console.log('After financiallyCompleted filter:', filtered.length, 'items')
      } else if (statusFilter === 'financiallyNotCompleted') {
        // Filter by technical completed but financial not completed
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '' &&
            (!item.financial_completed_year || item.financial_completed_year.trim() === ''),
        )
        console.log('After financiallyNotCompleted filter:', filtered.length, 'items')
      } else if (statusFilter === 'pendingProjects') {
        // Filter by ongoing status (same as statistics calculation)
        filtered = filtered.filter(
          (item) => item.status === 'Ongoing' || item.status === 'On Hold',
        )
        console.log('After pendingProjects filter:', filtered.length, 'items')
      } else if (statusFilter === 'convertedNo') {
        // Proposals explicitly marked as NOT converted ("No")
        filtered = filtered.filter((item) => isProposalNotConverted(item.proposals_converted, item.if_not_reason))
        console.log('After convertedNo filter:', filtered.length, 'items')
      }
      else {
        // For other status filters, filter by status
        filtered = filtered.filter((item) => {
          const status = (item.status || '').toString().trim()
          return status === statusFilter
        })
      }
    } else if (statusFilter === 'totalProjects') {
      // For total projects, filter by HAVING a project number
      filtered = filtered.filter((item) => item.project_number && item.project_number.trim() !== '')
      console.log('After totalProjects filter:', filtered.length, 'items:', filtered.map(item => ({ project_number: item.project_number, customer_name: item.customer_name })))
    }

    if (projectNumberFilter) {
      const searchLower = projectNumberFilter.toLowerCase()
      filtered = filtered.filter((item) => {
        const projectNumber = (item.project_number || '').toString().trim()
        return projectNumber.includes(searchLower)
      })
    }

    if (showNewMessagesOnly) {
      filtered = filtered.filter((item) => countUnseenReplies(item, currentUserName, userRole) > 0)
    }

    if (showPendingReplyOnly) {
      filtered = filtered.filter((item) => isPendingReply(item, currentUserName, userRole))
    }

    // Sort data: newest to oldest by latest query date or project date
    filtered.sort((a, b) => {
      // Get latest query date for each project
      const getLatestDate = (record) => {
        const unrespondedQueries = record.queries?.filter(q => !q.respond_to_remarks) || []
        if (unrespondedQueries.length > 0) {
          // Sort queries by date and get the newest
          const sortedQueries = unrespondedQueries.sort((x, y) =>
            new Date(y.updated_at).getTime() - new Date(x.updated_at).getTime()
          )
          const latestQuery = sortedQueries[0]
          const timestamp = new Date(latestQuery.updated_at).getTime()
          console.log(`Project ${record.project_number}: Query "${latestQuery.remarks_description}" - Date: ${latestQuery.updated_at} - Timestamp: ${timestamp}`)
          return timestamp
        }
        // If no queries, use project dispatch date or creation date
        if (record.dispatch_date) {
          const timestamp = new Date(record.dispatch_date).getTime()
          console.log(`Project ${record.project_number}: Dispatch date ${record.dispatch_date} - Timestamp: ${timestamp}`)
          return timestamp
        }
        // Fallback to oldest possible date
        console.log(`Project ${record.project_number}: No date - using oldest`)
        return new Date(0).getTime()
      }

      const dateA = getLatestDate(a)
      const dateB = getLatestDate(b)

      console.log(`Comparing: ${a.project_number} (${dateA}) vs ${b.project_number} (${dateB}) - Result: ${dateB - dateA}`)

      // Sort by date (newest first) - larger timestamp should come first
      return dateB - dateA
    })

    setFilteredData(filtered)
  }, [searchText, dateRange, statusFilter, projectNumberFilter, tableData, unrespondedQueryCounts, showNewMessagesOnly, currentUserName, userRole, showPendingReplyOnly])


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
      `scientist_proposals_export_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`,
    )
    message.success('Excel file downloaded successfully')
  }

  // Helper function to calculate overdue days
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

  const parseEnquiryDate = (val) => {
    if (!val || val === '') return Number.MIN_SAFE_INTEGER

    // Try native/ISO parsing first (covers "2024-06-01", "2024-06-01T00:00:00Z", etc.)
    let parsed = dayjs(val)
    if (parsed.isValid()) return parsed.valueOf()

    // Fallback: explicit DD-MM-YYYY strings
    parsed = dayjs(val, 'DD-MM-YYYY', true)
    if (parsed.isValid()) return parsed.valueOf()

    // Fallback: explicit DD/MM/YYYY strings
    parsed = dayjs(val, 'DD/MM/YYYY', true)
    if (parsed.isValid()) return parsed.valueOf()

    return Number.MIN_SAFE_INTEGER // Invalid dates treated as oldest
  }

  const columns = useMemo(() => {
    if (statusFilter === 'proposals' || statusFilter === 'convertedNo') {
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
          sorter: (a, b) => {
            return parseEnquiryDate(a.enquiry_date) - parseEnquiryDate(b.enquiry_date)
          },
          sortDirections: ['ascend', 'descend'],
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
          key: 'project_name',
          dataIndex: 'project_name',
          title: 'Project Name',
          width: 140,
          render: (_, record) => {
            const projectName = record.activity && record.activity.trim() !== ''
              ? record.activity
              : (record.quote_description && record.quote_description.trim() !== ''
                ? record.quote_description
                : '-')
            return wrapWithTooltip(projectName, 30)
          },
        },
        {
          key: 'address',
          dataIndex: 'address',
          title: 'Address',
          width: 120,
          ellipsis: true,
        },
        {
          key: 'quotation_given_by_name',
          dataIndex: 'quotation_given_by_name',
          title: 'Proposal Given By',
          width: 120,
          ellipsis: true,
        },
        {
          key: 'project_coordinator',
          dataIndex: 'project_coordinator',
          title: 'Project Co-ordinator',
          width: 120,
          ellipsis: true,
          render: (_, record) => {
            const coordinator = record.project_co_ordinator && record.project_co_ordinator.trim() !== ''
              ? record.project_co_ordinator
              : (record.quotation_given_by_name && record.quotation_given_by_name.trim() !== ''
                ? record.quotation_given_by_name
                : '-')
            return wrapWithTooltip(coordinator, 25)
          },
        },
        ...(statusFilter === 'convertedNo' ? [{
          key: 'if_not_reason',
          dataIndex: 'if_not_reason',
          title: 'If Not Reason',
          width: 200,
          ellipsis: true,
          render: (value) => wrapWithTooltip(value, 40),
        }] : []),
        {
          key: 'actions',
          title: 'Actions',
          width: 120,
          render: (_, record) => (
            <Space size="small">
              {/* Chat button - replaces the old Queries button */}
              <Space size={4}>
                <Badge count={countUnseenReplies(record, currentUserGroup || currentUserName, userRole)} size="small" offset={[-2, 2]}>
                  <Button
                    size="small"
                    type="link"
                    icon={<MessageOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      openChatModal(record)
                    }}
                    style={{
                      color: countUnseenReplies(record, currentUserGroup || currentUserName, userRole) > 0 ? '#ff4d4f' : '#1890ff',
                    }}
                    title="Chat"
                  />
                </Badge>
                {isPendingReply(record, currentUserName, userRole) && (
                  <span title="Reply Needed" style={{ cursor: 'pointer', fontSize: '14px' }} onClick={(e) => {
                    e.stopPropagation()
                    openChatModal(record)
                  }}>
                    ⚠️
                  </span>
                )}
              </Space>
              <Button
                size="small"
                type="link"
                icon={<InfoCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  openDetailModal(record)
                }}
                title="More Details"
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'costEstimation',
                      label: 'Cost Estimation Generator',
                      onClick: (e) => {
                        e.domEvent.stopPropagation()
                        setSelectedProposalForCostEstimation(record)
                        setCostEstimationModalOpen(true)
                      },
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button
                  size="small"
                  type="link"
                  icon={<FileOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  title="Generate/Estimate Cost"
                />
              </Dropdown>
            </Space>
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
              <Tooltip title={value} placement="topLeft">
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
              </Tooltip>
            )
          }
        }
      }

      // Custom sorter for Enquiry Date field
      // if (field.name === 'enquiry_date') {
      //   return {
      //     ...baseColumn,
      //     sorter: (a, b) => {
      //       return parseEnquiryDate(a.enquiry_date) - parseEnquiryDate(b.enquiry_date)
      //     },
      //     sortDirections: ['ascend', 'descend'],
      //     render: field.render ?? (dateFields.has(field.name)
      //       ? (value) => formatDate(value)
      //       : (value) => wrapWithTooltip(value, field.width ? Math.floor(field.width / 8) : 30)),
      //   }
      // }

      if (field.name === 'activity') {
        return {
          ...baseColumn,
          render: (_, record) => {
            const projectName = record.activity && record.activity.trim() !== ''
              ? record.activity
              : (record.quote_description && record.quote_description.trim() !== ''
                ? record.quote_description
                : '-')
            return wrapWithTooltip(projectName, 30)
          }
        }
      }

      if (field.name === 'project_co_ordinator') {
        return {
          ...baseColumn,
          render: (_, record) => {
            const coordinator = record.project_co_ordinator && record.project_co_ordinator.trim() !== ''
              ? record.project_co_ordinator
              : (record.quotation_given_by_name && record.quotation_given_by_name.trim() !== ''
                ? record.quotation_given_by_name
                : '-')
            return wrapWithTooltip(coordinator, 25)
          }
        }
      }

      if (field.name === 'project_number') {
        return {
          ...baseColumn,
          render: (value) => {
            if (!value || value.trim() === '') {
              return wrapWithTooltip('Not Converted to Projects', 25)
            }
            return wrapWithTooltip(value, 25)
          }
        }
      }

      return {
        ...baseColumn,
        render: field.render ?? (dateFields.has(field.name)
          ? (value) => formatDate(value)
          : (value) => wrapWithTooltip(value, field.width ? Math.floor(field.width / 8) : 30)),
      }
    })

    const customerNameIndex = baseColumns.findIndex(
      (col) => col.key === 'customer_name',
    )

    const overdueDaysColumn = {
      key: 'overdue_days',
      dataIndex: 'overdue_days',
      title: 'Overdue Days',
      width: 100,
      render: (_, record) => {
        // Don't show overdue days if project is completed
        if (record.status === 'Completed') return '-'

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
        key: 'actions',
        title: 'Actions',
        width: 120,
        render: (_, record) => (
          <Space size="small">
            {/* Chat button - replaces the old Queries button */}
            <Space size={4}>
              <Badge count={countUnseenReplies(record, currentUserName, userRole)} size="small" offset={[-2, 2]}>
                <Button
                  size="small"
                  type="link"
                  icon={<MessageOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    openChatModal(record)
                  }}
                  style={{
                    color: countUnseenReplies(record, currentUserName, userRole) > 0 ? '#ff4d4f' : '#1890ff',
                  }}
                  title="Chat"
                />
              </Badge>
              {isPendingReply(record, currentUserName, userRole) && (
                <span title="Reply Needed" style={{ cursor: 'pointer', fontSize: '14px' }} onClick={(e) => {
                  e.stopPropagation()
                  openChatModal(record)
                }}>
                  ⚠️
                </span>
              )}
            </Space>
            <Button
              size="small"
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                openDetailModal(record)
              }}
              title="More Details"
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'costEstimation',
                    label: 'Cost Estimation Generator',
                    onClick: (e) => {
                      e.domEvent.stopPropagation()
                      setSelectedProposalForCostEstimation(record)
                      setCostEstimationModalOpen(true)
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button
                size="small"
                type="link"
                icon={<FileOutlined />}
                onClick={(e) => e.stopPropagation()}
                title="Generate/Estimate Cost"
              />
            </Dropdown>
          </Space>
        ),
      },
    ]
  }, [openEditModal, openDetailModal, openDocsModal, openChatModal, statusFilter, currentUserName, userRole])

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
                   <style>{`
                     @keyframes blinkReasonBtn {
                       0%, 100% { opacity: 1; }
                       50% { opacity: 0.45; }
                     }
                     .blink-reason-btn {
                       animation: blinkReasonBtn 1.1s ease-in-out infinite;
                     }
                     @keyframes blinkChatBtn {
                       0%, 100% { opacity: 1; transform: scale(1); }
                       50% { opacity: 0.65; transform: scale(0.97); }
                     }
                     .blink-chat-btn {
                       animation: blinkChatBtn 1.2s ease-in-out infinite;
                       background-color: #fff1f0 !important;
                       border-color: #ffccc7 !important;
                       color: #ff4d4f !important;
                     }
                   `}</style>
                  <div className="flex justify-end">
                    <Button
                      danger
                      type="primary"
                      disabled={!statistics.convertedNo}
                      onClick={openReasonPopup}
                      className={statistics.convertedNo ? 'blink-reason-btn' : ''}
                    >
                      Reason Required ({statistics.convertedNo})
                    </Button>
                  </div>
                  {(() => {
                    const handleStatusCardClick = (val) => {
                      setStatusFilter(val)
                      setShowNewMessagesOnly(false)
                      setShowPendingReplyOnly(false)
                    }
                    return (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                        <Card
                          className="bg-gradient-to-br from-slate-500 to-slate-700 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick(null)}
                        >
                          <Statistic title={<span className="text-white/90">Total Proposals Submitted</span>} value={statistics.allCount} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        </Card>
                        <Card
                          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('proposals')}
                        >
                          <Statistic title={<span className="text-white/90">Pending</span>} value={statistics.totalProposals} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        </Card>
                        <Card
                          className="bg-gradient-to-br from-purple-500 to-purple-600 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('totalProjects')}
                        >
                          <Statistic title={<span className="text-white/90"> Converted to Projects</span>} value={statistics.totalProjects} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
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
                          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('technicallyCompleted')}
                        >
                          <Statistic title={<span className="text-white/90">Technically Completed</span>} value={statistics.technicallyCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        </Card>
                        <Card
                          className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('financiallyNotCompleted')}
                        >
                          <Statistic title={<span className="text-white/90">Financially Not Completed</span>} value={statistics.financiallyNotCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        </Card>
                        <Card
                          className="bg-gradient-to-br from-green-500 to-green-600 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('financiallyCompleted')}
                        >
                          <Statistic title={<span className="text-white/90">Financially Completed</span>} value={statistics.financiallyCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        </Card>
                        <Card
                          className="bg-gradient-to-br from-red-500 to-red-600 text-white cursor-pointer"
                          onClick={() => handleStatusCardClick('pendingProjects')}
                        >
                          <Statistic title={<span className="text-white/90">Ongoing Projects</span>} value={statistics.pendingProjects} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                          {statistics.onHoldProjects > 0 && (
                            <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8, marginTop: '4px' }}>
                              On hold: {statistics.onHoldProjects}
                            </div>
                          )}
                        </Card>
                      </div>
                    )
                  })()}

                  <div className="flex flex-col gap-6">
                    {/* Search & Filters */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4">
                        <Title level={4} className="!mb-0">Search & Filters</Title>
                      </div>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                          <Input
                            placeholder="Search proposals..."
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
                            {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT'].map((code) => (
                              <Select.Option key={code} value={code}>
                                {code}
                              </Select.Option>
                            ))}
                          </Select>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                          <RangePicker
                            placeholder={['Start Date', 'End Date']}
                            value={dateRange}
                            onChange={setDateRange}
                            size="large"
                            style={{ width: '100%' }}
                            format={DISPLAY_DATE_FORMAT}
                          />
                        </Col>
                        <Col xs={24} sm={12} md={6} className="flex items-center">
                          <Button
                            onClick={() => {
                              setSearchText('')
                              setDateRange(null)
                              setStatusFilter(null)
                              setProjectNumberFilter(null)
                              setShowNewMessagesOnly(false)
                              setShowPendingReplyOnly(false)
                            }}
                            size="large"
                            style={{ width: '100%' }}
                          >
                            Clear Filters
                          </Button>
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
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
                        <Title level={4} className="!mb-0">Proposals List</Title>
                        <Space size="small" className="flex-wrap">
                          <Button
                            type={showNewMessagesOnly ? 'primary' : 'default'}
                            size="large"
                            onClick={() => {
                              setShowNewMessagesOnly(!showNewMessagesOnly)
                              setShowPendingReplyOnly(false)
                            }}
                            className={showNewMessagesOnly ? 'shadow-md hover:shadow-lg' : (unreadChatsCount > 0 ? 'blink-chat-btn' : '')}
                            style={showNewMessagesOnly ? {} : (unreadChatsCount > 0 ? {} : { borderColor: '#1890ff', color: '#1890ff' })}
                          >
                            💬 Unread Chats ({unreadChatsCount})
                          </Button>
                          <Button
                            type={showPendingReplyOnly ? 'primary' : 'default'}
                            size="large"
                            onClick={() => {
                              setShowPendingReplyOnly(!showPendingReplyOnly)
                              setShowNewMessagesOnly(false)
                            }}
                            className={showPendingReplyOnly ? 'shadow-md hover:shadow-lg' : ''}
                            style={showPendingReplyOnly ? {} : { borderColor: '#fa8c16', color: '#fa8c16' }}
                          >
                            ⚠️ Reply Needed ({pendingReplyCount})
                          </Button>
                          <Button
                            type="primary"
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={openCoordinatorAddModal}
                            className="bg-gradient-to-r from-green-500 to-green-600 border-none shadow-md hover:shadow-lg"
                          >
                            Add Proposal
                          </Button>
                        </Space>
                      </div>
                      <Table
                        className="role-proposals-table"
                        rowKey="id"
                        columns={columns}
                        dataSource={filteredData}
                        loading={tableLoading}
                        pagination={{
                          defaultPageSize: 10,
                          showSizeChanger: true,
                          pageSizeOptions: ['10', '20', '50', '100']
                        }}
                        tableLayout="fixed"
                        sticky
                        bordered
                      />
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="Proposal Details"
        open={detailModalOpen}
        onCancel={closeDetailModal}
        width={900}
        footer={[
          <Button key="close" onClick={closeDetailModal}>Close</Button>,
          <Button
            key="upload"
            type="default"
            disabled={!selectedRecord?.id}
            onClick={() => {
              if (selectedRecord?.id) {
                closeDetailModal()
                openUploadModalForProject(selectedRecord.id)
              }
            }}
          >
            Upload
          </Button>,
          // <Button
          //   key="remarks"
          //   type="default"
          //   disabled={!selectedRecord?.id}
          //   onClick={() => {
          //     if (selectedRecord?.id) {
          //       closeDetailModal()
          //       openRemarksModal(selectedRecord)
          //     }
          //   }}
          // >
          //   Remarks
          // </Button>,
          <Button key="edit" type="primary" onClick={() => {
            closeDetailModal()
            openEditModal(selectedRecord)
          }}>Edit</Button>,
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

                <Card title="Project Details" size="small" className="bg-green-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Project Number">{selectedRecord?.project_number || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Party Name">{selectedRecord?.party_name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Activity">{selectedRecord?.activity || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Project Co-ordinator">{selectedRecord?.project_co_ordinator || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Key Deliverables" span={2}>{selectedRecord?.key_deliverables || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Order Information" size="small" className="bg-orange-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Order Number">{selectedRecord?.order_number || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Order Date">{formatDate(selectedRecord?.order_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Order Value">{selectedRecord?.order_value || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Delivery Date">{formatDate(selectedRecord?.delivery_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Extended Delivery">{formatDate(selectedRecord?.extended_delivery_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Actual Commencement">{formatDate(selectedRecord?.date_of_actual_commencement) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Dispatch Date">{formatDate(selectedRecord?.dispatch_date) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Technical Completion Year">{selectedRecord?.technical_completed_year || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Financial Completion Year">{selectedRecord?.financial_completed_year || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Status">{selectedRecord?.status || '-'}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="Meeting & Remarks" size="small" className="bg-purple-50">
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Review Meeting Details" span={2}>{selectedRecord?.details_of_external_internal_review_meeting || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Co-ordinator Remarks" span={2}>{selectedRecord?.co_ordinator_remarks || '-'}</Descriptions.Item>
                    <Descriptions.Item label="PPM Remarks" span={2}>{selectedRecord?.ppm_remarks || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Closure Report" span={2}>{selectedRecord?.closer_report || '-'}</Descriptions.Item>
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


      {/* Reason Required Popup */}
      <Modal
        title={`Proposals Needing a Reason (${notConvertedNoReasonList.length})`}
        open={reasonPopupOpen}
        onCancel={() => setReasonPopupOpen(false)}
        footer={[
          <Button key="close" onClick={() => setReasonPopupOpen(false)}>Close</Button>,
        ]}
        width={1000}
        maskClosable={false}
      >
        <Table
          rowKey="id"
          dataSource={notConvertedNoReasonList}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'SL No',
              key: 'sl_no',
              width: 60,
              render: (_, __, index) => index + 1,
            },
            {
              title: 'Customer Name',
              dataIndex: 'customer_name',
              key: 'customer_name',
              width: 180,
              render: (value) => wrapWithTooltip(value || '-', 25),
            },
            {
              title: 'Project Name',
              key: 'project_name',
              width: 200,
              render: (_, record) => {
                const projectName = record.activity && record.activity.trim() !== ''
                  ? record.activity
                  : (record.quote_description || '-')
                return wrapWithTooltip(projectName, 30)
              },
            },
            {
              title: 'Disclaimeres made in reason required',
              key: 'if_not_reason',
              render: (_, record) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <TextArea
                    rows={2}
                    placeholder="Enter reason..."
                    value={reasonInputs[record.id] ?? ''}
                    onChange={(e) =>
                      setReasonInputs((prev) => ({ ...prev, [record.id]: e.target.value }))
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    size="small"
                    loading={!!savingReasonIds[record.id]}
                    disabled={!reasonInputs[record.id]?.trim()}
                    onClick={() => handleSaveReason(record, reasonInputs[record.id])}
                  >
                    Save
                  </Button>
                </div>
              ),
            },
          ]}
          locale={{ emptyText: 'All proposals have a reason recorded.' }}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Proposal"
        open={modalOpen}
        onCancel={closeModal}
        width={1000}
        okText="Update"
        confirmLoading={submitLoading}
        onOk={() => form.submit()}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ updated_by: currentUserName }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {ALL_FIELDS.filter((f) => {
              if (!SCIENTIST_EDITABLE_FIELDS.includes(f.name)) return false

              // For proposals, only allow editing proposal_status and co_ordinator_remarks
              const isProject = Boolean(editingRecord?.project_number?.toString().trim())
              if (isProject) {
                // This is a project - don't show proposal_status
                if (f.name === 'proposal_status') return false
              } else {
                // This is a proposal - only allow these fields
                return ['proposal_status', 'co_ordinator_remarks', 'updated_by'].includes(f.name)
              }

              return true
            }).map((field) => {

              return true
            }).map((field) => {
              const dateFields = [
                'extended_delivery_date',
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
                      if (dayjs.isDayjs(value)) return value.format(DISPLAY_DATE_FORMAT)
                      return value
                    }}
                  >
                    <DatePicker style={{ width: '100%' }} format={DISPLAY_DATE_FORMAT} placeholder={`Select ${field.label}`} />
                  </Form.Item>
                )
              }

              const InputComponent = field.input === 'textarea' ? TextArea : Input
              const isUpdatedByField = field.name === 'updated_by'
              const isProposalStatusField = field.name === 'proposal_status'

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
                  <InputComponent rows={2} disabled={isUpdatedByField} />
                </Form.Item>
              )
            })}
          </div>
        </Form>
      </Modal>

      {/* Add Proposal Modal (Coordinator) */}
      <Modal
        title="Add Proposal (Coordinator)"
        open={coordinatorModalOpen}
        onCancel={closeCoordinatorModal}
        width={1100}
        okText="Submit"
        confirmLoading={coordinatorSubmitLoading}
        onOk={() => coordinatorForm.submit()}
        maskClosable={false}
      >
        <Form form={coordinatorForm} layout="vertical" onFinish={handleCoordinatorSubmit}>
          <Row gutter={[16, 16]}>
            {COORDINATOR_ADD_FIELDS.filter((fieldName) => {
              if (userRole === 'scientist') {
                return !['quotation_given_by_department', 'center', 'group'].includes(fieldName)
              }
              return true
            }).map((fieldName) => {
              const field = ALL_FIELDS.find((f) => f.name === fieldName)
              if (!field) return null

              const isDate = ['enquiry_date', 'quote_date', 'revised_negotiated_quote_date'].includes(fieldName)
              const isTextArea = field.input === 'textarea'
              const isCustomerType = fieldName === 'customer_type'
              const isRequestType = fieldName === 'request_type'
              const isProposalStatus = fieldName === 'proposal_status'
              const isReadOnlyName = fieldName === 'quotation_given_by_name'
              const isReadOnlyDept = fieldName === 'quotation_given_by_department'
              const isReadOnlyCenter = fieldName === 'center'
              const isReadOnlyGroup = fieldName === 'group'
              const isCustomerName = fieldName === 'customer_name'
              const isAddressField = fieldName === 'address'
              const isEmailField = fieldName === 'email'
              const isPhoneField = fieldName === 'phone_no'

              return (
                <Col span={12} key={fieldName}>
                  <Form.Item
                    name={fieldName}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `Please enter ${field.label}` }] : []}
                  >
                    {isDate ? (
                      <DatePicker style={{ width: '100%' }} format={DISPLAY_DATE_FORMAT} />
                    ) : isCustomerType ? (
                      <Select placeholder="Select Customer Type">
                        {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                          <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                        ))}
                      </Select>
                    ) : isRequestType ? (
                      <Select placeholder="Select Request Type">
                        {REQUEST_TYPE_OPTIONS.map((opt) => (
                          <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                        ))}
                      </Select>
                    ) : isProposalStatus ? (
                      <Select
                        mode="tags"
                        showSearch
                        allowClear
                        placeholder="Select or type Proposal Status"
                      >
                        <Select.Option value="Submitted">Submitted</Select.Option>
                        <Select.Option value="Accepted">Accepted</Select.Option>
                        <Select.Option value="Rejected">Rejected</Select.Option>
                        <Select.Option value="Awaiting">Awaiting</Select.Option>
                      </Select>
                    ) : isReadOnlyName || isReadOnlyDept || isReadOnlyCenter || isReadOnlyGroup ? (
                      <Input disabled />
                    ) : isCustomerName ? (
                      <AutoComplete
                        onSearch={searchCustomers}
                        onSelect={handleCustomerSelect}
                        options={customerOptions}
                        placeholder="Search existing customers..."
                        style={{ width: '100%' }}
                        allowClear
                      >
                        <Input />
                      </AutoComplete>
                    ) : isAddressField ? (
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
                    ) : isEmailField ? (
                      <AutoComplete
                        options={emailOptions}
                        onSearch={searchEmails}
                        placeholder="Type or select email..."
                        style={{ width: '100%' }}
                        allowClear
                      >
                        <Input />
                      </AutoComplete>
                    ) : isPhoneField ? (
                      <AutoComplete
                        options={phoneOptions}
                        onSearch={searchPhones}
                        placeholder="Type or select phone..."
                        style={{ width: '100%' }}
                        allowClear
                      >
                        <Input />
                      </AutoComplete>
                    ) : isTextArea ? (
                      <TextArea rows={3} />
                    ) : (
                      <Input placeholder={`Enter ${field.label}`} />
                    )}
                  </Form.Item>
                </Col>
              )
            })}
          </Row>
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
        title={
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-slate-800">
              Upload Project Documents
            </span>
            <span className="text-xs text-slate-400">
              Upload enquiry and/or proposal documents with version tracking
            </span>
          </div>
        }
        open={uploadModalVisible}
        onCancel={closeUploadModal}
        width={900}
        styles={{ body: { padding: "16px" } }}
        footer={[
          <Button key="cancel" onClick={closeUploadModal}>
            Cancel
          </Button>,
          <Button
            key="upload-selected"
            type="primary"
            loading={uploading}
            className="px-6"
            onClick={handleUploadBothDocuments}
          >
            Upload Documents
          </Button>,
        ]}
      >
        <div className="space-y-4">

          {/* Info Banner */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            You can upload either one or both documents. Versions are automatically managed.
          </div>

          {/* Upload Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

            {/* Enquiry Upload */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white w-full overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 mb-0">
                  Enquiry Document
                </p>
                <Tooltip title="Add attachments">
                  <label
                    htmlFor="enquiry-attachment-input"
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    <PlusOutlined style={{ fontSize: 12 }} />
                  </label>
                </Tooltip>
                <input
                  id="enquiry-attachment-input"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleAddEnquiryAttachments}
                />
              </div>

              <p className="text-xs text-slate-500 mb-2">
                Latest uploaded version: v{latestEnquiryVersion} | Next: v{latestEnquiryVersion + 1}
              </p>

              <div className="flex justify-center">
                <Dragger
                  multiple={false}
                  maxCount={1}
                  className="!p-4 !border-dashed !border-blue-300 rounded-lg"
                  style={{ width: "260px" }}
                  beforeUpload={(file) => {
                    setEnquiryFileToUpload(file)
                    return false
                  }}
                  onRemove={() => setEnquiryFileToUpload(null)}
                  fileList={
                    enquiryFileToUpload
                      ? [{
                        uid: enquiryFileToUpload.uid || enquiryFileToUpload.name,
                        name: getDisplayFileName(enquiryFileToUpload.name),
                        status: "done",
                        originFileObj: enquiryFileToUpload,
                      }]
                      : []
                  }
                >
                  <div className="flex flex-col items-center text-center">
                    <InboxOutlined className="text-xl text-blue-500 mb-1" />
                    <p className="text-sm font-medium text-slate-700 mb-0">Upload</p>
                    <p className="text-xs text-slate-400 mb-0">PDF, DOC, DOCX</p>
                  </div>
                </Dragger>
              </div>

              {enquiryAttachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {enquiryAttachments.map((file, index) => (
                    <Tag
                      key={`${file.name}-${index}`}
                      closable
                      onClose={() => handleRemoveEnquiryAttachment(index)}
                    >
                      {getDisplayFileName(file.name, 24)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>


            {/* Proposal Upload */}
            <div className="rounded-lg border border-slate-200 p-3 bg-white w-full overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 mb-0">
                  Proposal Document
                </p>
                <Tooltip title="Add attachments">
                  <label
                    htmlFor="proposal-attachment-input"
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    <PlusOutlined style={{ fontSize: 12 }} />
                  </label>
                </Tooltip>
                <input
                  id="proposal-attachment-input"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleAddProposalAttachments}
                />
              </div>

              <p className="text-xs text-slate-500 mb-2">
                Latest uploaded version: v{latestProposalVersion} | Next: v{latestProposalVersion + 1}
              </p>

              <div className="flex justify-center">
                <Dragger
                  multiple={false}
                  maxCount={1}
                  className="!p-4 !border-dashed !border-blue-300 rounded-lg"
                  style={{ width: "260px" }}
                  beforeUpload={(file) => {
                    setProposalFileToUpload(file)
                    return false
                  }}
                  onRemove={() => setProposalFileToUpload(null)}
                  fileList={
                    proposalFileToUpload
                      ? [{
                        uid: proposalFileToUpload.uid || proposalFileToUpload.name,
                        name: getDisplayFileName(proposalFileToUpload.name),
                        status: "done",
                        originFileObj: proposalFileToUpload,
                      }]
                      : []
                  }
                >
                  <div className="flex flex-col items-center text-center">
                    <InboxOutlined className="text-xl text-blue-500 mb-1" />
                    <p className="text-sm font-medium text-slate-700 mb-0">Upload</p>
                    <p className="text-xs text-slate-400 mb-0">PDF, DOC, DOCX</p>
                  </div>
                </Dragger>
              </div>

              {proposalAttachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {proposalAttachments.map((file, index) => (
                    <Tag
                      key={`${file.name}-${index}`}
                      closable
                      onClose={() => handleRemoveProposalAttachment(index)}
                    >
                      {getDisplayFileName(file.name, 24)}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between w-full">
            <p className="text-xs text-slate-500">
              Version auto-increments by default.
            </p>
            <Button type="link" onClick={() => setShowVersionEditor((prev) => !prev)}>
              {showVersionEditor ? 'Hide Version Change' : 'Change Version'}
            </Button>
          </div>

          {showVersionEditor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Enquiry Version</label>
                <Input
                  value={enquiryVersionInput}
                  onChange={(e) => setEnquiryVersionInput(e.target.value)}
                  placeholder={`Default: ${latestEnquiryVersion + 1}`}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Proposal Version</label>
                <Input
                  value={proposalVersionInput}
                  onChange={(e) => setProposalVersionInput(e.target.value)}
                  placeholder={`Default: ${latestProposalVersion + 1}`}
                />
              </div>
            </div>
          )}

          {/* Bottom Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">

            {/* Description */}
            <div className="md:col-span-2 w-full">
              <label className="text-xs text-slate-500 mb-1 block">
                Description (Optional)
              </label>
              <TextArea
                placeholder="Add a short description about the documents..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Uploaded By */}
            <div className="w-full">
              <label className="text-xs text-slate-500 mb-1 block">
                Uploaded By
              </label>
              <Input
                value={uploadedBy}
                disabled
                className="bg-slate-100 w-full"
              />
            </div>
          </div>

        </div>
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
                                className={`px-3 py-1 text-sm border-b-2 transition-colors ${activeSheetIndex === index
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


      <Modal
        title={
          <div className="flex flex-col gap-2">
            <span className="text-base font-semibold text-slate-800">
              {chatProject?.activity || chatProject?.project_number || 'Conversation'}
            </span>
            {['group head', 'gh'].includes(userRole?.toLowerCase()) ? (
              <span className="text-xs text-slate-400">
                Chat with Admin
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-400">
                  Chat with {chatThread === 'admin' ? 'Admin' : 'Group Head'}
                </span>
                 {(() => {
                  const adminUnseen = chatProject ? getThreadUnseenCount(chatProject, currentUserName, 'admin') : 0
                  const ghUnseen = chatProject ? getThreadUnseenCount(chatProject, currentUserName, 'gh') : 0
                  return (
                    <Segmented
                      value={chatThread}
                      onChange={switchChatThread}
                      options={[
                        {
                          label: (
                            <Badge count={adminUnseen} size="small" offset={[8, -2]}>
                              <span>Admin</span>
                            </Badge>
                          ),
                          value: 'admin'
                        },
                        {
                          label: (
                            <Badge count={ghUnseen} size="small" offset={[8, -2]}>
                              <span>GH{chatProject ? ` (${getGhName(chatProject)})` : ''}</span>
                            </Badge>
                          ),
                          value: 'gh'
                        },
                      ]}
                    />
                  )
                })()}
              </>
            )}
          </div>
        }
        open={chatModalOpen}
        onCancel={closeChatModal}
        footer={null}
        width={600}
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex flex-col" style={{ height: '65vh' }}>
          {/* Message thread */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
            {chatLoading ? (
              <div className="flex items-center justify-center h-full">
                <Spin />
              </div>
            ) : chatEvents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              chatEvents.map((event) => {
                const isOwn = (() => {
                  const fromName = normalizeName(event.from_)
                  const myName = normalizeName(currentUserName)
                  const myGroupName = normalizeName(chatProject?.group || '')

                  let dbRole = ''
                  try {
                    const rawUser = window.localStorage.getItem('ppm_user')
                    if (rawUser) {
                      dbRole = normalizeName(JSON.parse(rawUser).dbRole || '')
                    }
                  } catch {}
                  const isSamePerson = dbRole === 'gh'

                  if (chatThread === 'admin') {
                    if (isSamePerson) {
                      return fromName === myName || fromName === myGroupName || fromName === 'group head'
                    } else {
                      return fromName === myName
                    }
                  } else {
                    return fromName === myName
                  }
                })()
                return (
                  <div key={event.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isOwn
                        ? 'rounded-tr-sm bg-blue-500 text-white'
                        : 'rounded-tl-sm bg-white text-slate-800 border border-slate-200'
                        }`}
                    >
                      <div className="text-sm">{event.content}</div>
                      <div className={`mt-1 text-[10px] ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
                        {event.from_} · {dayjs(event.timestamp).format('DD MMM, HH:mm')}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-200 bg-white p-3 flex gap-2 items-end">
            <TextArea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleSendChatMessage()
                }
              }}
            />
            <Button
              type="primary"
              loading={chatSending}
              disabled={!chatInput.trim()}
              onClick={handleSendChatMessage}
            >
              Send
            </Button>
          </div>
        </div>
      </Modal>




      <CostEstimationModal
        key={selectedProposalForCostEstimation?.id}
        open={costEstimationModalOpen}
        onClose={() => {
          setCostEstimationModalOpen(false);
          setSelectedProposalForCostEstimation(null);
        }}
        title={
          selectedProposalForCostEstimation?.activity ||
          selectedProposalForCostEstimation?.project_number ||
          selectedProposalForCostEstimation?.quote_description ||
          (selectedProposalForCostEstimation?.id ? `Proposal No ${selectedProposalForCostEstimation.id}` : "Cost Estimation")
        }
        createdBy={currentUserName}
        projectId={selectedProposalForCostEstimation?.id}
      />


    </>
  )
}

export default ScientistProposals
