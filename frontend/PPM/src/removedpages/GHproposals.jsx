import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  EditOutlined,
  InboxOutlined,
  UploadOutlined,
  EyeOutlined,
  MessageOutlined,
  InfoCircleOutlined,
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
  Upload,
  Radio,
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

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

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

const getPiName = (record) =>
  (record?.project_co_ordinator || record?.quotation_given_by_name || '').trim()

const getGhName = (record) => (record?.group || 'Group Head').trim()

const getLastSeenMap = () => {
  try {
    return JSON.parse(window.localStorage.getItem('gh_chat_last_seen') || '{}')
  } catch {
    return {}
  }
}

const markThreadAsSeen = (projectId, thread) => {
  const map = getLastSeenMap()
  map[`${projectId}_${thread}`] = new Date().toISOString()
  window.localStorage.setItem('gh_chat_last_seen', JSON.stringify(map))
}

const normalizeName = (v) => (v || '').toString().trim().toLowerCase()

const getThreadEvents = (queries, thread, record) => {
  const events = []
  const piName = normalizeName(getPiName(record))
  const ghName = normalizeName(getGhName(record))

  let curName = ''
  try {
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      curName = normalizeName(JSON.parse(rawUser).name || '')
    }
  } catch {}

  const isSamePerson = curName && piName && (curName === piName || curName.includes(piName) || piName.includes(curName))

  ;(queries || []).forEach((q) => {
    const isToAdmin = normalizeName(q.to) === 'admin'
    const isFromAdmin = normalizeName(q.from_) === 'admin'

    if (thread === 'admin') {
      // Chat with Admin
      if (isToAdmin) {
        const fromName = normalizeName(q.from_)
        if (isSamePerson) {
          if (fromName !== ghName && fromName !== 'group head' && fromName !== piName) return
        } else {
          if (fromName !== ghName && fromName !== 'group head') return
        }
      } else if (isFromAdmin) {
        const toName = normalizeName(q.to)
        if (isSamePerson) {
          if (toName !== ghName && toName !== 'group head' && toName !== piName) return
        } else {
          if (toName !== ghName && toName !== 'group head') return
        }
      } else {
        return
      }
    } else {
      // Chat between Group Head and Scientist (PI)
      if (isToAdmin || isFromAdmin) return

      const isToPi = normalizeName(q.to) === piName
      const isFromPi = normalizeName(q.from_) === piName
      const isToGh = normalizeName(q.to) === ghName || normalizeName(q.to) === 'group head'
      const isFromGh = normalizeName(q.from_) === ghName || normalizeName(q.from_) === 'group head'

      const isGhToPi = isFromGh && isToPi
      const isPiToGh = isFromPi && isToGh

      if (!isGhToPi && !isPiToGh) return
    }

    events.push({
      id: `${q.id}-msg`,
      content: q.remarks_description,
      from_: q.from_,
      timestamp: q.updated_at,
    })
    if (q.respond_to_remarks) {
      events.push({
        id: `${q.id}-reply`,
        content: q.respond_to_remarks,
        from_: q.to,
        timestamp: q.updated_at,
      })
    }
  })
  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

const getThreadUnseenCount = (record, currentUserGroup, thread) => {
  if (!record || !record.queries) return 0
  const myGroupName = normalizeName(currentUserGroup || 'group head')
  const piName = normalizeName(getPiName(record))
  
  let curName = ''
  try {
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      curName = normalizeName(JSON.parse(rawUser).name || '')
    }
  } catch {}

  const isSamePerson = curName && piName && (curName === piName || curName.includes(piName) || piName.includes(curName))
  const sender = thread === 'admin' ? 'admin' : piName

  return record.queries.filter((q) => {
    // Case 1: Incoming message from sender to me
    const isFromSender = normalizeName(q.from_) === normalizeName(sender)
    const isToMe = thread === 'admin'
      ? (isSamePerson
          ? (normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head' || normalizeName(q.to) === piName)
          : (normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head'))
      : (normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head')

    if (isFromSender && isToMe && q.message_seen === false) {
      return true
    }

    // Case 2: Reply from sender to my message
    const isToSender = normalizeName(q.to) === normalizeName(sender)
    const isFromMe = thread === 'admin'
      ? (isSamePerson
          ? (normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head' || normalizeName(q.from_) === piName)
          : (normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head'))
      : (normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head')

    if (isFromMe && isToSender && q.respond_to_remarks && q.reply_seen === false) {
      return true
    }
    return false
  }).length
}

const countUnseenReplies = (record, currentUserGroup) => {
  return getThreadUnseenCount(record, currentUserGroup, 'admin') + getThreadUnseenCount(record, currentUserGroup, 'pi')
}

const isPendingReply = (record, currentUserName, currentUserGroup) => {
  const queries = record.queries || []
  const myGroupName = normalizeName(currentUserGroup || 'group head')

  return queries.some((q) => {
    const isToMe = normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head'
    return isToMe && !q.respond_to_remarks
  })
}



const { Title } = Typography
const { TextArea } = Input
const { RangePicker } = DatePicker
const { Dragger } = Upload

const PROPOSAL_FIELDS = [
  { name: 'id', label: 'SL NO', width: 120, inForm: false, render: (text, record, index) => index + 1 },
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
  { name: 'revised_negotiated', label: 'Revised / Negotiated', width: 190, apiName: 'revised/negotiated' },
  { name: 'revised_negotiated_quote_date', label: 'Revised Quote Date', width: 190, apiName: 'revised/negotiated_quote_date' },
  { name: 'revised_negotiated_quote_amount', label: 'Revised Quote Amount', width: 210, apiName: 'revised/negotiated_quote_amount' },
  { name: 'quotation_given_by_department', label: 'Department', width: 180 },
  { name: 'quotation_given_by_name', label: 'Propsal Given By', width: 200 },
  { name: 'project_number', label: 'Project Number', width: 140 },
  { name: 'party_name', label: 'Party Name', width: 200 },
  { name: 'activity', label: 'Project Name', width: 160 },
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
  { name: 'co_ordinator_remarks', label: 'Co-ordinator Remarks', width: 220, input: 'textarea' },
  { name: 'closer_report', label: 'Closure Report', width: 200, input: 'textarea' },
  { name: 'technical_completed_year', label: 'Technical Completion Year', width: 220 },
  { name: 'financial_completed_year', label: 'Financial Completion Year', width: 220 },
  { name: 'status', label: 'Status', width: 150, input: 'select' },
  { name: 'proposal_status', label: 'Proposal Status', width: 160, input: 'select' },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 160 },
  { name: 'ppm_remarks', label: 'PPM Remarks', width: 200, input: 'textarea' },
  { name: 'created_at', label: 'Created At', width: 190, inForm: false },
  { name: 'updated_at', label: 'Updated At', width: 190, inForm: false },
  { name: 'updated_by', label: 'Updated By', width: 150, required: true },
  { name: 'group', label: 'Group', width: 150 },
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
  { name: 'co_ordinator_remarks', label: 'Co-ordinator Remarks', width: 220, input: 'textarea' },
  { name: 'closer_report', label: 'Closure Report', width: 200, input: 'textarea' },
  { name: 'technical_completed_year', label: 'Technical Completion Year', width: 220 },
  { name: 'financial_completed_year', label: 'Financial Completion Year', width: 220 },
  { name: 'status', label: 'Status', width: 150, input: 'select' },
  { name: 'proposal_status', label: 'Proposal Status', width: 160, input: 'select' },
  { name: 'dispatch_date', label: 'Dispatch Date', width: 160 },
  { name: 'ppm_remarks', label: 'PPM Remarks', width: 200, input: 'textarea' },
  { name: 'created_at', label: 'Created At', width: 190, inForm: false },
  { name: 'updated_at', label: 'Updated At', width: 190, inForm: false },
  { name: 'updated_by', label: 'Updated By', width: 150, required: true },
  { name: 'group', label: 'Group', width: 150 },
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

const getDocumentVersionNumber = (name, baseName) => {
  const n = (name || '').toString().trim()
  const b = (baseName || '').toString().trim()
  if (!n || !b) return null
  const lower = n.toLowerCase()
  const baseLower = b.toLowerCase()
  if (!lower.startsWith(baseLower)) return null
  const match = lower.match(/\bv\s*(\d+)\b/)
  if (!match) return null
  const num = Number(match[1])
  return Number.isFinite(num) ? num : null
}

const getNextDocumentVersion = (docs, baseName) => {
  const list = Array.isArray(docs) ? docs : []
  const versions = list
    .map((d) => getDocumentVersionNumber(d?.name, baseName))
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
  const max = versions.length ? Math.max(...versions) : 0
  return max + 1
}

// Helper function to check if proposals_converted is Yes
const isProposalConverted = (proposalsConverted) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue === 'yes'
}

function Proposals() {
  const [form] = Form.useForm() // For existing edit modal (if any)

  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)


  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatProject, setChatProject] = useState(null)
  const [chatThread, setChatThread] = useState('admin') // 'admin' | 'pi'
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)

  const messagesEndRef = useRef(null)

  const chatEvents = useMemo(
    () => getThreadEvents(chatMessages, chatThread, chatProject),
    [chatMessages, chatThread, chatProject]
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


  // Move TABLE_FIELDS inside component to access state and functions
  const TABLE_FIELDS = [
    { name: 'id', label: 'SL NO', width: 80, render: (text, record, index) => index + 1 },
    { name: 'project_number', label: 'Project Number', width: 140 },
    { name: 'activity', label: 'Project Name', width: 160 },
    { name: 'customer_name', label: 'Customer Name', width: 180 },
    { name: 'order_date', label: 'Order Date', width: 130 },
    { name: 'delivery_date', label: 'Delivery Date', width: 140 },
    { name: 'extended_delivery_date', label: 'Extended Delivery', width: 150 },
    { name: 'date_of_actual_commencement', label: 'Actual Commencement', width: 170 },
    { name: 'dispatch_date', label: 'Dispatch Date', width: 130 },
    { name: 'key_deliverables', label: 'Key Deliverables', width: 220, input: 'textarea' },
    { name: 'project_co_ordinator', label: 'Project Co-ordinator', width: 180 },
    { name: 'center', label: 'Centre', width: 120 },
    { name: 'group', label: 'Group', width: 120 },
    { name: 'status', label: 'Status', width: 130, input: 'select' },
    { name: 'technical_completed_year', label: 'Technical Completion', width: 160 },
    { name: 'financial_completed_year', label: 'Financial Completion', width: 160 },
    { name: 'proposal_status', label: 'Proposal Status', width: 160, input: 'select' },
    { name: 'co_ordinator_remarks', label: 'Co-ordinator Remarks', width: 220, input: 'textarea' },
    { name: 'closer_report', label: 'Closure Report', width: 180, input: 'textarea' },
  ]

  const [searchText, setSearchText] = useState('')
  const [coordinatorFilter, setCoordinatorFilter] = useState(null)
  const [orderDateRange, setOrderDateRange] = useState(null)
  const [enquiryDateRange, setEnquiryDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [projectCodePrefix, setProjectCodePrefix] = useState('')
  const [currentUserName, setCurrentUserName] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return (parsed.name || '').trim()
      }
    } catch { }
    return ''
  })
  const [currentUserCentre, setCurrentUserCentre] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return parsed.center || ''
      }
    } catch { }
    return ''
  })
  const [currentUserGroup, setCurrentUserGroup] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        return parsed.group || ''
      }
    } catch { }
    return ''
  })
  const [proposalCount, setProposalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Unacknowledged proposals state
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false)
  const [showNewMessagesOnly, setShowNewMessagesOnly] = useState(false)
  const [showPendingReplyOnly, setShowPendingReplyOnly] = useState(false)
  const [originalTableData, setOriginalTableData] = useState([])
  const [trueOriginalData, setTrueOriginalData] = useState([]) // Store the complete original dataset
  const [activeTab, setActiveTab] = useState('proposals') // Track active tab

  const unreadChatsCount = useMemo(() => {
    return tableData.filter((item) => countUnseenReplies(item, currentUserGroup) > 0).length
  }, [tableData, currentUserGroup])

  const pendingReplyCount = useMemo(() => {
    return tableData.filter((item) => isPendingReply(item, currentUserName, currentUserGroup)).length
  }, [tableData, currentUserName, currentUserGroup])

  // Upload documents immediately after proposal creation (needs project_id)
  const [stageConfig, setStageConfig] = useState([])
  const [createdProjectId, setCreatedProjectId] = useState(null)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadStageId, setUploadStageId] = useState(1) // default Enquiry
  const [selectedStageForUpload, setSelectedStageForUpload] = useState(null)
  const [fileToUpload, setFileToUpload] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [documentName, setDocumentName] = useState('Enquiry v1')
  const [description, setDescription] = useState('')
  const [uploadedBy, setUploadedBy] = useState('')
  const [documentVersion, setDocumentVersion] = useState('1')
  const [uploadDocType, setUploadDocType] = useState('enquiry')
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
      if (!record) return
      setEditingRecord(record)
      form.resetFields()
      form.setFieldsValue({
        ...record,
        updated_by: currentUserName || record.updated_by,
      })
      setModalOpen(true)
    },
    [form, currentUserName],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    form.resetFields()
  }, [form])

  const loadChatMessages = useCallback(async (record, thread) => {
    setChatLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/`, {
        headers: { accept: 'application/json' },
      })
      const allQueries = response.ok ? await response.json() : []
      const projectMessages = Array.isArray(allQueries)
        ? allQueries.filter((q) => String(q.project_id) === String(record.id))
        : []
      setChatMessages(projectMessages)
    } catch (error) {
      console.error('Error loading chat:', error)
      message.error('Unable to load conversation')
    } finally {
      setChatLoading(false)
    }
  }, [])

  const openChatModal = useCallback(async (record, thread = 'admin') => {
    setChatProject(record)
    setChatThread(thread)
    setChatModalOpen(true)
    await loadChatMessages(record, thread)

    const myGroupName = normalizeName(currentUserGroup || 'group head')

    // Mark incoming messages as seen
    const unseenMessages = (record.queries || []).filter(
      (q) => (normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head') && q.message_seen === false
    )
    unseenMessages.forEach(async (q) => {
      try {
        await fetch(`${API_BASE_URL}/Remarkss/${q.id}/mark-seen`, { method: 'PATCH' })
      } catch (e) {
        console.warn('mark-seen failed for', q.id, e)
      }
    })

    // Mark replies as seen
    const unseenReplies = (record.queries || []).filter(
      (q) => (normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head') && q.respond_to_remarks && q.reply_seen === false
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
  }, [loadChatMessages, currentUserGroup])

  const switchChatThread = useCallback(async (thread) => {
    setChatThread(thread)
    if (chatProject) {
      await loadChatMessages(chatProject, thread)

      const myGroupName = normalizeName(currentUserGroup || 'group head')

      // Mark incoming messages as seen
      const unseenMessages = (chatProject.queries || []).filter(
        (q) => (normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head') && q.message_seen === false
      )
      unseenMessages.forEach(async (q) => {
        try {
          await fetch(`${API_BASE_URL}/Remarkss/${q.id}/mark-seen`, { method: 'PATCH' })
        } catch (e) {
          console.warn('mark-seen failed for', q.id, e)
        }
      })

      // Mark replies as seen
      const unseenReplies = (chatProject.queries || []).filter(
        (q) => (normalizeName(q.from_) === myGroupName || normalizeName(q.from_) === 'group head') && q.respond_to_remarks && q.reply_seen === false
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
    }
  }, [chatProject, loadChatMessages, currentUserGroup])

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
      const myGroupName = normalizeName(currentUserGroup || 'group head')
      const piName = getPiName(chatProject) || 'Scientist'

      // Determine who we are communicating with in this thread
      const recipient = chatThread === 'admin' ? 'admin' : piName

      // Check if we are replying to an unanswered message from that recipient
      const unansweredMsg = [...(chatMessages || [])]
        .reverse()
        .find((q) => {
          const isFromRecipient = normalizeName(q.from_) === normalizeName(recipient)
          const isToMe = normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head'
          return isFromRecipient && isToMe && !q.respond_to_remarks
        })

      if (unansweredMsg) {
        // REPLY: Update the existing row with respond_to_remarks
        const payload = {
          respond_to_remarks: chatInput.trim(),
          replyer: currentUserGroup || 'Group Head',
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
        // NEW MESSAGE: initiate a new thread row
        const payload = {
          from_: currentUserGroup || 'Group Head',
          to: recipient,
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
      await fetchProposals() // refresh badge counts across the table
    } catch (error) {
      console.error('Error sending message:', error)
      message.error(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }
  const handleCloseUploadModal = () => {
    setUploadModalVisible(false)
    setFileToUpload(null)
  }

  const handleUpload = async () => {
    if (!fileToUpload) return message.error('Please select a file')
    const uploader = (uploadedBy || currentUserName || '').trim()
    if (!uploader) return message.error('Your name is required')
    if (!createdProjectId) return message.error('Project ID not available. Please create a proposal first.')

    setUploading(true)
    const formData = new FormData()
    formData.append('name', documentName.trim())
    formData.append('description', description.trim())
    formData.append('project_id', createdProjectId)
    formData.append('stage_id', selectedStageForUpload?.stage_id || uploadStageId)
    formData.append('uploaded_by', uploader)
    formData.append('version', documentVersion || '1')
    formData.append('file', fileToUpload)

    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'Upload failed')
        throw new Error(err || 'Upload failed')
      }
      message.success('Document uploaded!')

      // Update uploaded docs list
      setFileToUpload(null)
      await fetchProjectDocuments(createdProjectId)
    } catch (err) {
      console.error('Upload error:', err)
      message.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (values) => {
    if (!editingRecord?.id) {
      message.error('No record selected for editing')
      return
    }

    setSubmitLoading(true)

    // Build payload for coordinator-update endpoint (only allowed fields)
    const payload = {
      project_id: editingRecord.id,
      extended_delivery_date: values.extended_delivery_date || '',
      co_ordinator_remarks: values.co_ordinator_remarks || '',
      technical_completed_year: values.technical_completed_year || null,
      // `updated_by` is not part of the restricted GH edit form fields, so fall back
      // to record value in addition to current user.
      updated_by: values.updated_by || currentUserName || editingRecord?.updated_by || '',
      proposal_status: values.proposal_status || '',
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

  const fetchProposals = useCallback(async () => {
    setTableLoading(true)
    try {
      let url = `${API_BASE_URL}/proposals/`
      let coordinatorName = ''

      try {
        const rawUser = window.localStorage.getItem('ppm_user')
        if (rawUser) {
          const parsedUser = JSON.parse(rawUser)
          if (parsedUser && parsedUser.name) {
            coordinatorName = parsedUser.name
            setCurrentUserName(parsedUser.name)
            setCurrentUserCentre(parsedUser.center || '')
            setCurrentUserGroup(parsedUser.group || '')
            const encodedName = encodeURIComponent(parsedUser.name)
            url = `${API_BASE_URL}/proposals/by-name/${encodedName}`
          }
        }
      } catch (storageError) {
        console.error('Failed to read user from localStorage', storageError)
      }

      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error('Unable to fetch proposals')
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload.map(mapApiToUi) : []

      // Fetch and attach queries data to each proposal
      const proposalsWithQueries = await Promise.all(
        normalized.map(async (proposal) => {
          try {
            const queriesResponse = await fetch(`${API_BASE_URL}/Remarkss/`, {
              headers: { accept: 'application/json' },
            })
            if (queriesResponse.ok) {
              const allQueries = await queriesResponse.json()
              const projectQueries = Array.isArray(allQueries)
                ? allQueries.filter(query => String(query.project_id) === String(proposal.id))
                : []
              console.log(`Proposal ${proposal.id}: Found ${projectQueries.length} queries`)
              return { ...proposal, queries: projectQueries }
            }
          } catch (error) {
            console.error(`Failed to fetch queries for proposal ${proposal.id}:`, error)
          }
          return { ...proposal, queries: [] }
        })
      )

      console.log('Proposals with queries loaded:', proposalsWithQueries.map(p => ({
        id: p.id,
        project_number: p.project_number,
        queriesCount: p.queries?.length || 0,
        ghQueries: p.queries?.filter(q => q.from_ === (currentUserGroup || 'Group Head')).length || 0
      })))

      setOriginalTableData(proposalsWithQueries)
      setTrueOriginalData(proposalsWithQueries) // Store the complete original dataset

      setTableData(proposalsWithQueries)
      setFilteredData(proposalsWithQueries)
      setCurrentPage(1)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch proposals')
    } finally {
      setTableLoading(false)
    }
  }, [])

  const fetchProposalsCount = async () => {
    try {
      let count = 0
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        const name = (parsedUser?.name || '').toString().trim()
        if (name) {
          const encodedName = encodeURIComponent(name)
          const url = `${API_BASE_URL}/proposals/by-name/${encodedName}`
          const response = await fetch(url, { headers: { accept: 'application/json' } })
          if (response.ok) {
            const payload = await response.json()
            const proposals = Array.isArray(payload) ? payload : []
            // Count only proposals without project numbers
            count = proposals.filter(item => !item.project_number || item.project_number.trim() === '').length
          }
        }
      }
      setProposalCount(count)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchUnacknowledgedCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/proposals/unacknowledged`, {
        headers: { accept: 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Raw unacknowledged data from API:', data)
        console.log('Current user group:', currentUserGroup)

        let filteredData = Array.isArray(data) ? data : []

        // Filter by current user's group for Group Heads
        if (currentUserGroup) {
          const cleanCurrentGroup = currentUserGroup.trim().toLowerCase()
          console.log('Fetching unacknowledged count for group:', cleanCurrentGroup)

          filteredData = filteredData.filter(item => {
            const cleanItemGroup = (item.group || '').trim().toLowerCase()
            const matches = cleanItemGroup === cleanCurrentGroup
            console.log('Checking item:', {
              id: item.id,
              itemGroup: cleanItemGroup,
              currentGroup: cleanCurrentGroup,
              matches: matches
            })
            return matches
          })
        }

        const count = filteredData.length
        setUnacknowledgedCount(count)
        console.log('Final unacknowledged count for group:', count)
        console.log('Filtered items:', filteredData.map(item => ({ id: item.id, group: item.group })))
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
      let normalized = Array.isArray(payload) ? payload.map(mapApiToUi) : []

      // Filter by current user's group for Group Heads
      if (currentUserGroup) {
        const cleanCurrentGroup = currentUserGroup.trim().toLowerCase()
        console.log('Fetching unacknowledged proposals for group:', cleanCurrentGroup)

        normalized = normalized.filter(item => {
          const cleanItemGroup = (item.group || '').trim().toLowerCase()
          const matches = cleanItemGroup === cleanCurrentGroup
          if (matches) {
            console.log('Proposal group match found:', {
              currentGroup: cleanCurrentGroup,
              itemGroup: cleanItemGroup,
              itemId: item.id
            })
          }
          return matches
        })
      }

      setTableData(normalized)
      setFilteredData(normalized)
      setOriginalTableData(normalized) // Update original data to maintain consistency
      setCurrentPage(1)
      console.log('Unacknowledged proposals loaded for group:', normalized.length)
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
      setCurrentPage(1)
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

  const fetchStageConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stages/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch stage configuration')
      }
      const data = await res.json()
      const normalized = Array.isArray(data)
        ? data.map((item) => ({ ...item, key: item.id }))
        : []
      setStageConfig(normalized)
      return normalized
    } catch (error) {
      console.error('Error fetching stage configuration:', error)
      return []
    }
  }

  const openUploadModalForNewProposal = (projectId, defaultType = 'enquiry') => {
    const stages = Array.isArray(stageConfig) ? stageConfig : []
    const enquiryStage = stages.find((s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry')
    const proposalStage = stages.find((s) => (s.name || '').toString().trim().toLowerCase() === 'proposal')

    const isProposal = defaultType === 'proposal'
    const stage = isProposal
      ? (proposalStage || enquiryStage || stages[0] || { id: uploadStageId, name: 'Proposal' })
      : (enquiryStage || stages[0] || { id: uploadStageId, name: 'Enquiry' })

    setUploadDocType(defaultType)
    setSelectedStageForUpload({ stage_id: stage.id, stage_name: stage.name || (isProposal ? 'Proposal' : 'Enquiry') })
    setUploadStageId(stage.id)

    const baseName = (stage.name || (isProposal ? 'Proposal' : 'Enquiry')).toString().trim() || (isProposal ? 'Proposal' : 'Enquiry')
    setDocumentName(baseName)
    setDocumentVersion('')
    setUploadedBy(currentUserName || '')
    setDescription('')

    setCreatedProjectId(projectId)
    setUploadModalVisible(true)
  }

  const handleDocTypeChange = (e) => {
    const newType = e.target.value
    setUploadDocType(newType)

    const stages = Array.isArray(stageConfig) ? stageConfig : []
    const enquiryStage = stages.find((s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry')
    const proposalStage = stages.find((s) => (s.name || '').toString().trim().toLowerCase() === 'proposal')

    const stage = newType === 'proposal'
      ? (proposalStage || { id: uploadStageId, name: 'Proposal' })
      : (enquiryStage || { id: uploadStageId, name: 'Enquiry' })

    setSelectedStageForUpload({ stage_id: stage.id, stage_name: stage.name || (newType === 'proposal' ? 'Proposal' : 'Enquiry') })
    setUploadStageId(stage.id)
    setDocumentName(stage.name || (newType === 'proposal' ? 'Proposal' : 'Enquiry'))
  }

  const fetchProjectDocuments = async (projectId) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch documents')
      }
      const data = await res.json()
      const docs = Array.isArray(data) ? data : []

      // Show all documents for this project, not just enquiry
      const filtered = docs.filter((d) => d.project_id === projectId)

      // Sort by uploaded time (oldest first)
      const sortedByDate = [...filtered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      )

      // Use version from database, not auto-generated
      const withVersions = sortedByDate.map((d, idx) => ({
        ...d,
        display_name: d.name || 'Document',
        version: d.version || idx + 1,
      }))

      setProjectDocs(withVersions)
      return withVersions
    } catch (err) {
      console.error('Error fetching project documents:', err)
      message.error(err.message || 'Unable to load documents')
      setProjectDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const openDocsModal = async (projectId) => {
    setDocsModalVisible(true)
    await fetchProjectDocuments(projectId)
  }

  const handleShowDuplicateQuoteRefs = useCallback(() => {
    // Count occurrences of each quote_reference (ignore empty/null)
    const refCounts = {}
    tableData.forEach((item) => {
      const ref = (item.quote_reference || '').trim()
      if (ref) {
        refCounts[ref] = (refCounts[ref] || 0) + 1
      }
    })

    // Keep only refs that appear more than once
    const duplicateRefs = new Set(
      Object.entries(refCounts)
        .filter(([, count]) => count > 1)
        .map(([ref]) => ref)
    )

    if (duplicateRefs.size === 0) {
      message.info('No duplicate Quote References found')
      setFilteredData(tableData)
      return
    }

    const duplicates = tableData.filter((item) =>
      duplicateRefs.has((item.quote_reference || '').trim())
    )

    setFilteredData(duplicates)
    message.info(`Showing ${duplicates.length} records with duplicate Quote References (${duplicateRefs.size} unique refs)`)
  }, [tableData])

  const viewDocument = (doc) => {
    if (!doc?.url) {
      return message.error('Document URL is not available')
    }

    setViewDocumentUrl(doc.url)
  }

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
    // Trigger delivery notification check on every page load
    fetch(`${API_BASE_URL}/proposals/check-delivery-notifications`, {
      method: 'POST',
      headers: { accept: 'application/json' },
    }).catch(err => console.log('Notification check error:', err))

    fetchProposals()
    fetchProposalsCount()
    fetchStageConfig()
    fetchUnacknowledgedCount()
  }, []) // Remove fetchProposals dependency to prevent refresh loops

  useEffect(() => {
    if (!detailModalOpen) return
    if (!selectedRecord?.id) return
    fetchProjectDocuments(selectedRecord.id)
  }, [detailModalOpen, selectedRecord])

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

  // Statistics
  const statistics = useMemo(() => {
    // Always use true original data to show normal counts regardless of filters
    const dataSource = trueOriginalData.length > 0 ? trueOriginalData : tableData

    const totalProposals = dataSource.filter((item) => !item.project_number || item.project_number.trim() === '').length
    const totalProjects = dataSource.filter((item) => item.project_number && item.project_number.trim() !== '').length
    const technicallyCompleted = dataSource.filter(
      (item) =>
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '',
    ).length
    const financiallyCompleted = dataSource.filter(
      (item) => item.technical_completed_year?.trim() && item.financial_completed_year?.trim()
    ).length
    const financiallyNotCompleted = dataSource.filter(
      (item) => item.technical_completed_year?.trim() && !item.financial_completed_year?.trim()
    ).length
    const pendingProjects = dataSource.filter(
      (item) =>
        item.status === 'Ongoing' || item.status === 'On Hold',
    ).length

    const onHoldProjects = dataSource.filter(
      (item) => item.status === 'On Hold',
    ).length

    const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']
    const projectCodeBreakdown = {}
    dataSource.forEach((item) => {
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
  }, [tableData, trueOriginalData])

  // Filter data based on search and filters
  useEffect(() => {
    let filtered = tableData

    if (searchText) {
      const s = searchText.trim()
      if (/^\d+$/.test(s)) {
        filtered = filtered.filter((item) => String(item.id) === s)
      } else {
        const lower = s.toLowerCase()
        filtered = filtered.filter((item) =>
          Object.values(item).some((val) => String(val).toLowerCase().includes(lower))
        )
      }
    }

    if (coordinatorFilter) filtered = filtered.filter((item) => {
      const itemCoordinator = (item.project_co_ordinator || '').toString().trim().toLowerCase()
      const itemProposalGivenBy = (item.quotation_given_by_name || '').toString().trim().toLowerCase()
      const filterCoordinator = coordinatorFilter.toString().trim().toLowerCase()
      return itemCoordinator === filterCoordinator || itemProposalGivenBy === filterCoordinator
    })

    if (projectCodePrefix) {
      const prefix = projectCodePrefix.trim().slice(0, 3).toLowerCase()
      filtered = filtered.filter(
        (item) => item.project_number && String(item.project_number).slice(0, 3).toLowerCase() === prefix
      )
    }

    if (orderDateRange?.length === 2) {
      filtered = filtered.filter((item) => {
        if (!item.order_date) return false
        const date = dayjs(item.order_date)
        return date.isSameOrAfter(orderDateRange[0].startOf('day')) && date.isSameOrBefore(orderDateRange[1].endOf('day'))
      })
    }

    if (enquiryDateRange?.length === 2) {
      filtered = filtered.filter((item) => {
        if (!item.enquiry_date) return false
        const date = dayjs(item.enquiry_date)
        return date.isSameOrAfter(enquiryDateRange[0].startOf('day')) && date.isSameOrBefore(enquiryDateRange[1].endOf('day'))
      })
    }

    if (statusFilter && statusFilter !== 'totalProjects') {
      if (statusFilter === 'proposals') {
        // For proposals, filter by NOT having a project number
        filtered = filtered.filter((item) => !item.project_number || item.project_number.trim() === '')
      } else if (statusFilter === 'technicallyCompleted') {
        filtered = filtered.filter(
          (item) =>
            item.technical_completed_year &&
            item.technical_completed_year.trim() !== '',
        )
      } else if (statusFilter === 'financiallyCompleted') {
        filtered = filtered.filter(
          (item) => item.technical_completed_year?.trim() && item.financial_completed_year?.trim()
        )
      } else if (statusFilter === 'financiallyNotCompleted') {
        filtered = filtered.filter(
          (item) => item.technical_completed_year?.trim() && !item.financial_completed_year?.trim()
        )
      } else if (statusFilter === 'pendingProjects') {
        filtered = filtered.filter(
          (item) =>
            item.status === 'Ongoing' || item.status === 'On Hold',
        )
      } else {
        // For other status filters, filter by status
        filtered = filtered.filter((item) => {
          const status = (item.status || '').toString().trim()
          return status === statusFilter
        })
      }
    } else if (statusFilter === 'totalProjects') {
      // For total projects, filter by HAVING a project number
      filtered = filtered.filter((item) => item.project_number && item.project_number.trim() !== '')
    }

    if (showNewMessagesOnly) {
      filtered = filtered.filter((item) => countUnseenReplies(item, currentUserGroup) > 0)
    }

    if (showPendingReplyOnly) {
      filtered = filtered.filter((item) => isPendingReply(item, currentUserName))
    }

    setFilteredData(filtered)
    setCurrentPage(1)
  }, [searchText, coordinatorFilter, orderDateRange, enquiryDateRange, statusFilter, projectCodePrefix, tableData, showNewMessagesOnly, currentUserGroup, showPendingReplyOnly, currentUserName])

  const uniqueCoordinators = useMemo(() => {
    const seen = new Set()
    const result = []

    tableData.forEach((item) => {
      const coordinator = item.project_co_ordinator
      if (coordinator) {
        const normalized = coordinator.toString().trim().toLowerCase()
        if (!seen.has(normalized)) {
          seen.add(normalized)
          // Store the original case version for display
          result.push(coordinator)
        }
      }
    })

    // Sort case-insensitively
    return result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  }, [tableData])
  const uniqueProjectPrefixes = useMemo(() => {
    const prefixes = tableData
      .map((i) => i.project_number)
      .filter(Boolean)
      .map((code) => String(code).slice(0, 3).toUpperCase())
    return [...new Set(prefixes)].sort()
  }, [tableData])

  const handleExportExcel = () => {
    if (!filteredData.length) return message.warning('No data to export')
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((item) => {
        const row = {}
        TABLE_FIELDS.forEach((f) => (row[f.label] = item[f.name] || ''))
        return row
      })
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proposals')
    XLSX.writeFile(workbook, `proposals_export_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`)
    message.success('Excel downloaded')
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
    const parseEnquiryDate = (val) => {
      if (!val || val === '') return Number.MIN_SAFE_INTEGER // Empty dates go to end

      // Try native/ISO parsing first (covers "2024-06-01", "2024-06-01T00:00:00Z", etc.)
      let parsed = dayjs(val)
      if (parsed.isValid()) return parsed.valueOf()

      // Fallback: explicit DD-MM-YYYY strings
      parsed = dayjs(val, 'DD-MM-YYYY', true)
      if (parsed.isValid()) return parsed.valueOf()

      // Fallback: explicit DD/MM/YYYY strings
      parsed = dayjs(val, 'DD/MM/YYYY', true)
      if (parsed.isValid()) return parsed.valueOf()

      return Number.MIN_SAFE_INTEGER // Invalid dates treated as empty
    }

    if (statusFilter === 'proposals') {
      return [
        {
          key: 'id',
          dataIndex: 'id',
          title: 'SL NO',
          width: 80,
          render: (text, record, index) => index + 1,
        },
        {
          key: 'enquiry_date',
          dataIndex: 'enquiry_date',
          title: 'Enquiry Date',
          width: 150,
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
          width: 170,
        },
        {
          key: 'activity',
          dataIndex: 'activity',
          title: 'Project Name',
          width: 220,
          render: (value, record) => {
            const projectValue = value || record.quote_description || 'No Project Name'
            return wrapWithTooltip(projectValue, 25)
          },
        },
        {
          key: 'customer_name',
          dataIndex: 'customer_name',
          title: 'Customer Name',
          width: 170,
        },
        {
          key: 'address',
          dataIndex: 'address',
          title: 'Address',
          width: 140,
          ellipsis: true,
        },
        {
          key: 'quotation_given_by_name',
          dataIndex: 'quotation_given_by_name',
          title: 'Proposal Given By',
          width: 180,
          ellipsis: true,
        },
        {
          key: 'actions',
          title: 'Actions',
          width: 100,
          render: (_, record) => (
            <Space size="small">
              <Button
                size="small"
                type="link"
                icon={<InfoCircleOutlined />}
                onClick={(e) => { e.stopPropagation(); openDetailModal(record) }}
                title="More Details"
              />
              <Space size={4}>
                <Badge count={countUnseenReplies(record, currentUserGroup)} size="small" offset={[-2, 2]}>
                  <Button
                    size="small"
                    type="link"
                    icon={<MessageOutlined />}
                    onClick={(e) => { e.stopPropagation(); openChatModal(record, 'admin') }}
                    style={{ color: countUnseenReplies(record, currentUserGroup) > 0 ? '#ff4d4f' : '#1890ff' }}
                    title="Chat"
                  />
                </Badge>
                {isPendingReply(record, currentUserName, currentUserGroup) && (
                  <span title="Reply Needed" style={{ cursor: 'pointer', fontSize: '14px' }} onClick={(e) => {
                    e.stopPropagation()
                    openChatModal(record, 'admin')
                  }}>
                    ⚠️
                  </span>
                )}
              </Space>
            </Space>
          ),
        },
      ]
    }

    const isFullViewUser =
      ['ppbd'].includes(currentUserCentre?.toLowerCase()) ||
      ['ppm'].includes(currentUserGroup?.toLowerCase())

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

    // If the user is not in the allowed center/group, show a slim table with a "More" button
    if (!isFullViewUser) {
      return [
        {
          key: 'id',
          dataIndex: 'id',
          title: 'SL NO',
          width: 80,
          render: (text, record, index) => index + 1,
        },
        {
          key: 'project_number',
          dataIndex: 'project_number',
          title: 'Project Number',
          width: 140,
          render: (value) => {
            if (value && value.trim() !== '') {
              return value
            }
            return 'Not Converted to Project'
          },
        },
        {
          key: 'activity',
          dataIndex: 'activity',
          title: 'Project Name',
          width: 200,
          render: (value, record) => {
            const projectValue = value || record.quote_description || 'No Project Name'
            return wrapWithTooltip(projectValue, 25)
          },
        },
        {
          key: 'customer_name',
          dataIndex: 'customer_name',
          title: 'Customer Name',
          width: 180,
        },
        overdueDaysColumn,
        {
          key: 'dispatch_date',
          dataIndex: 'dispatch_date',
          title: 'Dispatch Date',
          width: 130,
          render: (value) => formatDate(value),
        },
        {
          key: 'project_co_ordinator',
          dataIndex: 'project_co_ordinator',
          title: 'Project Co-ordinator',
          width: 180,
          render: (value, record) => {
            // Show project coordinator if available, otherwise show proposal given by
            if (value && value.trim() !== '') {
              return value
            }
            return record.quotation_given_by_name || '-'
          },
        },
        {
          key: 'actions',
          title: 'Actions',
          width: 100,
          render: (_, record) => (
            <Space size="small">
              <Button
                size="small"
                type="link"
                icon={<InfoCircleOutlined />}
                onClick={(e) => { e.stopPropagation(); openDetailModal(record) }}
                title="More Details"
              />
              <Space size={4}>
                <Badge count={countUnseenReplies(record, currentUserGroup)} size="small" offset={[-2, 2]}>
                  <Button
                    size="small"
                    type="link"
                    icon={<MessageOutlined />}
                    onClick={(e) => { e.stopPropagation(); openChatModal(record, 'admin') }}
                    style={{ color: countUnseenReplies(record, currentUserGroup) > 0 ? '#ff4d4f' : '#1890ff' }}
                    title="Chat"
                  />
                </Badge>
                {isPendingReply(record, currentUserName, currentUserGroup) && (
                  <span title="Reply Needed" style={{ cursor: 'pointer', fontSize: '14px' }} onClick={(e) => {
                    e.stopPropagation()
                    openChatModal(record, 'admin')
                  }}>
                    ⚠️
                  </span>
                )}
              </Space>
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

    const base = TABLE_FIELDS.map((f) => {
      const baseColumn = {
        key: f.name,
        dataIndex: f.name,
        title: f.label,
        width: f.width,
      }

      // Custom render for Status field with styled badges
      if (f.name === 'status') {
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
      if (f.name === 'enquiry_date') {
        return {
          ...baseColumn,
          sorter: (a, b) => {
            return parseEnquiryDate(a.enquiry_date) - parseEnquiryDate(b.enquiry_date)
          },
          sortDirections: ['ascend', 'descend'],
          render: f.render ?? (dateFields.has(f.name)
            ? (value) => formatDate(value)
            : (value) => wrapWithTooltip(value, f.width ? Math.floor(f.width / 8) : 30)),
        }
      }

      return {
        ...baseColumn,
        render: f.render ?? (dateFields.has(f.name)
          ? (value) => formatDate(value)
          : (value) => wrapWithTooltip(value, f.width ? Math.floor(f.width / 8) : 30)),
      }
    })

    // Find index of extended_delivery_date and insert overdue_days after it
    const extendedDeliveryIndex = base.findIndex(
      (col) => col.key === 'extended_delivery_date',
    )

    if (extendedDeliveryIndex !== -1) {
      base.splice(extendedDeliveryIndex + 1, 0, overdueDaysColumn)
    }

    return [
      ...base,
      {
        key: 'actions',
        title: 'Actions',
        width: 100,
        render: (_, record) => (
          <Space size="small">
            <Button
              size="small"
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={(e) => { e.stopPropagation(); openDetailModal(record) }}
              title="More Details"
            />
            <Space size={4}>
              <Badge count={countUnseenReplies(record, currentUserGroup)} size="small" offset={[-2, 2]}>
                <Button
                  size="small"
                  type="link"
                  icon={<MessageOutlined />}
                  onClick={(e) => { e.stopPropagation(); openChatModal(record, 'admin') }}
                  style={{ color: countUnseenReplies(record, currentUserGroup) > 0 ? '#ff4d4f' : '#1890ff' }}
                  title="Chat"
                />
              </Badge>
              {isPendingReply(record, currentUserName, currentUserGroup) && (
                <span title="Reply Needed" style={{ cursor: 'pointer', fontSize: '14px' }} onClick={(e) => {
                  e.stopPropagation()
                  openChatModal(record, 'admin')
                }}>
                  ⚠️
                </span>
              )}
            </Space>
          </Space>
        ),
      },
    ]
  }, [openDetailModal, openChatModal, currentUserCentre, currentUserGroup, statusFilter, currentUserName])

  return (
    <>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <Tabs defaultActiveKey="proposals">
          <Tabs.TabPane tab="Proposals" key="proposals">
            <div className="space-y-6">
              <style>{`
                @keyframes blinkChatBtn {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.65; transform: scale(0.97); }
                }
                .blink-chat-btn {
                }
              `}</style>
              {(() => {
                const handleStatusCardClick = (val) => {
                  setStatusFilter(val)
                  setShowNewMessagesOnly(false)
                  setShowPendingReplyOnly(false)
                }
                return (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                      <Card className="bg-gradient-to-br from-slate-500 to-slate-700 text-white cursor-pointer" onClick={() => handleStatusCardClick(null)}>
                        <Statistic title={<span className="text-white/90">Total Proposals Submitted</span>} value={statistics.allCount} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer" onClick={() => handleStatusCardClick('proposals')}>
                        <Statistic title={<span className="text-white/90">Pending</span>} value={statistics.totalProposals} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white cursor-pointer" onClick={() => handleStatusCardClick('totalProjects')}>
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
                      <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white cursor-pointer" onClick={() => handleStatusCardClick('technicallyCompleted')}>
                        <Statistic title={<span className="text-white/90">Technically Completed</span>} value={statistics.technicallyCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white cursor-pointer" onClick={() => handleStatusCardClick('financiallyNotCompleted')}>
                        <Statistic title={<span className="text-white/90">Financially Not Completed</span>} value={statistics.financiallyNotCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                      </Card>
                      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white cursor-pointer" onClick={() => handleStatusCardClick('financiallyCompleted')}>
                        <Statistic title={<span className="text-white/90">Financially Completed</span>} value={statistics.financiallyCompleted} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                      </Card>
                      <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white cursor-pointer" onClick={() => handleStatusCardClick('pendingProjects')}>
                        <Statistic title={<span className="text-white/90">Ongoing Projects</span>} value={statistics.pendingProjects} valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }} />
                        {statistics.onHoldProjects > 0 && (
                          <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8, marginTop: '4px' }}>
                            On hold: {statistics.onHoldProjects}
                          </div>
                        )}
                      </Card>
                    </div>
                  </div>
                )
              })()}

              <div className="flex flex-col gap-6 mt-6">
                {/* Search & Filters */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <Title level={4} className="!mb-0">Search & Filters</Title>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Input
                      placeholder="Search proposals..."
                      prefix={<SearchOutlined />}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                    <Select
                      placeholder="Filter by Project Number"
                      value={projectCodePrefix}
                      onChange={setProjectCodePrefix}
                      allowClear
                    >
                      {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT'].map((code) => (
                        <Select.Option key={code} value={code}>
                          {code}
                        </Select.Option>
                      ))}
                    </Select>
                    <RangePicker
                      placeholder={['Enquiry Start', 'Enquiry End']}
                      value={enquiryDateRange}
                      onChange={setEnquiryDateRange}
                      format={DISPLAY_DATE_FORMAT}
                    />
                    <RangePicker
                      placeholder={['Order Start', 'Order End']}
                      value={orderDateRange}
                      onChange={setOrderDateRange}
                      format={DISPLAY_DATE_FORMAT}
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => {
                        setSearchText('')
                        setOrderDateRange(null)
                        setEnquiryDateRange(null)
                        setStatusFilter(null)
                        setProjectCodePrefix('')
                        setShowNewMessagesOnly(false)
                        setShowPendingReplyOnly(false)
                      }}>
                        Clear Filters
                      </Button>
                      <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                        Export to Excel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <Title level={4} className="!mb-1">Proposal / Projects</Title>
                      <p className="text-slate-500 text-sm">Showing {filteredData.length} records</p>
                    </div>
                    <div className="flex gap-2">
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
                    </div>
                  </div>
                  <Table
                    className="role-proposals-table"
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredData}
                    loading={tableLoading}
                    pagination={{
                      current: currentPage,
                      pageSize: pageSize,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50', '100'],
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                      onChange: (page, size) => {
                        setCurrentPage(page)
                        setPageSize(size)
                      },
                      onShowSizeChange: (current, size) => {
                        setCurrentPage(1)
                        setPageSize(size)
                      },
                    }}
                    tableLayout="fixed"
                    sticky
                    bordered
                    onRow={(record) => ({
                      onClick: () => openDetailModal(record),
                      style: {
                        cursor: 'pointer',
                        backgroundColor: record.status === 'On Hold' ? '#fff2e8' : 'transparent',
                      },
                    })}
                  />
                </div>
              </div>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </div>

      {/* Detail View Modal */}
      <Modal
        title="Proposal Details"
        open={detailModalOpen}
        onCancel={closeDetailModal}
        width={900}
        footer={[
          <Button key="close" onClick={closeDetailModal}>Close</Button>,
          <Button
            key="view-docs"
            type="default"
            disabled={!selectedRecord?.id}
            onClick={() => {
              if (selectedRecord?.id) {
                openDocsModal(selectedRecord.id)
              }
            }}
          >
            View Uploads
          </Button>,
          // <Button
          //   key="upload"
          //   type="default"
          //   disabled={!selectedRecord?.id}
          //   onClick={() => {
          //     if (selectedRecord?.id) {
          //       closeDetailModal()
          //       openUploadModalForNewProposal(selectedRecord.id)
          //     }
          //   }}
          // >
          //   {/* Upload */}
          // </Button>,
          <Button key="chat" type="primary" onClick={() => {
            closeDetailModal()
            openChatModal(selectedRecord, 'admin')
          }}>Chat</Button>,
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

            <Card title="Enquiry Documents" size="small" className="bg-gray-50">
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
                    render: (v) => (v ? v : '-'),
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
                <div className="text-center text-gray-500 mt-4">No enquiry documents uploaded</div>
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* Documents Modal */}
      <Modal
        title="Documents"
        open={docsModalVisible}
        onCancel={() => setDocsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDocsModalVisible(false)}>Close</Button>,
        ]}
        width={800}
      >
        <Card title="Enquiry Documents" size="small" className="bg-gray-50">
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
                render: (v) => (v ? v : '-'),
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
            <div className="text-center text-gray-500 mt-4">No enquiry documents uploaded</div>
          )}
        </Card>
      </Modal>

      {/* Upload Document Modal */}
      <Modal
        title={`Upload Document - ${selectedStageForUpload?.stage_name || 'Enquiry'}`}
        open={uploadModalVisible}
        onCancel={handleCloseUploadModal}
        footer={[
          <Button key="cancel" onClick={handleCloseUploadModal}>Cancel</Button>,
          <Button key="upload" type="primary" loading={uploading} onClick={handleUpload}>Upload</Button>,
        ]}
        width={600}
      >
        <Space direction="vertical" size="large" className="w-full">
          <Radio.Group
            value={uploadDocType}
            onChange={handleDocTypeChange}
            buttonStyle="solid"
            className="w-full"
          >
            <Radio.Button value="enquiry" className="w-1/2 text-center">Upload as Enquiry</Radio.Button>
            <Radio.Button value="proposal" className="w-1/2 text-center">Upload as Proposal</Radio.Button>
          </Radio.Group>

          <Dragger {...{
            multiple: false,
            maxCount: 1,
            beforeUpload: (file) => {
              setFileToUpload(file)
              return false
            },
            onRemove: () => setFileToUpload(null),
            fileList: fileToUpload
              ? [{
                uid: fileToUpload.uid || fileToUpload.name,
                name: fileToUpload.name,
                status: 'done',
                originFileObj: fileToUpload,
              }]
              : [],
          }}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Click or drag file to this area</p>
          </Dragger>

          <Input placeholder="Document Name *" value={documentName} disabled />
          <Input placeholder="Version" value={documentVersion} onChange={(e) => setDocumentVersion(e.target.value)} />
          <TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <Input placeholder="Your Name *" value={uploadedBy} disabled />
        </Space>
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

      {/* Edit Proposal Modal */}
      <Modal
        title={editingRecord ? `Edit Proposal / Project` : 'Edit Proposal / Project'}
        open={modalOpen}
        onCancel={closeModal}
        width={1100}
        okText="Update"
        confirmLoading={submitLoading}
        onOk={() => form.submit()}
        maskClosable={false}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={[16, 16]}>
            {TABLE_FIELDS.map((field) => {
              const allowedEditFields = [
                'extended_delivery_date',
                'co_ordinator_remarks',
                'technical_completed_year',
                'updated_by',
                'proposal_status',
              ]

              // When editing, only show the allowed edit fields
              if (editingRecord && !allowedEditFields.includes(field.name)) {
                return null
              }

              const isTextArea = field.input === 'textarea'
              const isUpdatedByField = field.name === 'updated_by'
              const isProposalStatusField = field.name === 'proposal_status'

              // Date fields that should use DatePicker
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

              return (
                <Col span={12} key={field.name}>
                  <Form.Item
                    name={field.name}
                    label={field.label}
                    rules={field.required ? [{ required: true, message: `${field.label} is required` }] : []}
                    getValueProps={(value) => {
                      // AntD `Select` with `mode="tags"` expects an array value.
                      if (isProposalStatusField) {
                        if (!value) return { value: [] }
                        if (Array.isArray(value)) {
                          // Flatten one level just in case API returns nested arrays.
                          const flattened = []
                          value.forEach((v) => {
                            if (Array.isArray(v)) {
                              v.forEach((inner) => flattened.push(inner))
                            } else {
                              flattened.push(v)
                            }
                          })
                          return { value: flattened.filter(Boolean).map((v) => String(v)) }
                        }
                        return { value: [String(value)] }
                      }

                      return {
                        value: value && isDateField
                          ? dayjs(value).isValid()
                            ? dayjs(value)
                            : null
                          : value,
                      }
                    }}
                    normalize={(value) => {
                      if (isProposalStatusField) {
                        if (!value) return ''
                        if (Array.isArray(value)) {
                          // Select returns array; we only need the last tag.
                          let last = value[value.length - 1]
                          while (Array.isArray(last)) {
                            last = last[last.length - 1]
                          }
                          return last || ''
                        }
                        return String(value || '')
                      }

                      if (!value) return ''
                      if (isDateField && dayjs.isDayjs(value)) {
                        return value.format('YYYY-MM-DD')
                      }
                      return value
                    }}
                  >
                    {isProposalStatusField ? (
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
                    ) : isTextArea ? (
                      <TextArea rows={3} placeholder={`Enter ${field.label}`} disabled={isUpdatedByField && editingRecord} />
                    ) : isDateField ? (
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD.MM.YYYY"
                        placeholder={`Select ${field.label}`}
                      />
                    ) : (
                      <Input placeholder={`Enter ${field.label}`} disabled={isUpdatedByField && editingRecord} />
                    )}
                  </Form.Item>
                </Col>
              )
            })}
          </Row>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex flex-col gap-2">
            <span className="text-base font-semibold text-slate-800">
              {chatProject?.activity || chatProject?.project_number || 'Conversation'}
            </span>
            {(() => {
              const pi = normalizeName(chatProject?.project_co_ordinator || chatProject?.quotation_given_by_name)
              const cur = normalizeName(currentUserName)
              return pi && cur && (pi.includes(cur) || cur.includes(pi))
            })() ? (
              <span className="text-xs text-slate-400">Chat with Admin</span>
            ) : (
              (() => {
                const adminUnseen = chatProject ? getThreadUnseenCount(chatProject, currentUserGroup, 'admin') : 0
                const piUnseen = chatProject ? getThreadUnseenCount(chatProject, currentUserGroup, 'pi') : 0
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
                          <Badge count={piUnseen} size="small" offset={[8, -2]}>
                            <span>PI{chatProject ? ` (${getPiName(chatProject) || 'Unassigned'})` : ''}</span>
                          </Badge>
                        ),
                        value: 'pi'
                      },
                    ]}
                  />
                )
              })()
            )}
          </div>
        }
        open={chatModalOpen}
        onCancel={closeChatModal}
        footer={null}
        width={600}
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex flex-col" style={{ height: '60vh' }}>
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
                const isOwn = chatThread === 'admin'
                  ? normalizeName(event.from_) !== 'admin'
                  : normalizeName(event.from_) !== normalizeName(getPiName(chatProject) || '')
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
    </>
  )
}

export default Proposals