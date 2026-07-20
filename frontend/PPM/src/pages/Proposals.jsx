import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  LinkOutlined,
  FilterOutlined,
  CalendarOutlined,
  MessageOutlined,
  UploadOutlined,
  FileTextOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  DollarCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import {
  AutoComplete,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
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
  Dropdown,
  Segmented,
  Tooltip,
  Badge,
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
import { Checkbox } from 'antd';
import {
  openAcknowledgmentModal,
  closeAcknowledgmentModal,
  handleAcknowledgmentSubmit,
} from '../utils/acknowledgment.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { Title } = Typography
const { TextArea } = Input

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
  { value: 'proposals_converted', label: 'Proposals Converted' },
  { value: 'proposals_not_converted', label: 'Proposals not Converted' },
  { value: 'ongoing_projects', label: 'Ongoing Projects' },
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
  { value: 'project_allotment_date', label: 'Project Allotment Date' },
  { value: 'review_meeting_date', label: 'Review Meeting Date' },
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
  { name: 'center', label: 'Centre', width: 150 },
  { name: 'group', label: 'Group', width: 150 },
  { name: 'quotation_given_by_name', label: 'Quotation Given By', width: 200 },
  { name: 'proposals_converted', label: 'Proposals Converted', width: 180, input: 'select' },
  { name: 'if_not_reason', label: 'If Not Reason', width: 200, input: 'textarea' },

  { name: 'project_number', label: 'Project Number', width: 140 },
  { name: 'small_value_project', label: 'Small Value Project', width: 180, input: 'checkbox' },
  { name: 'project_allotment_date', label: 'Project Allotment Date', width: 180 },



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
  { name: 'review_meeting_date', label: 'Review Meeting Date', width: 180 },
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
    let value = values[field.name] ?? ''

    // Ensure small_value_project is always sent as a string
    if (field.name === 'small_value_project') {
      value = value ? 'true' : 'false'
    }

    payload[apiName] = value
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

const ActionButtons = ({ label, onAdd }) => (
  <Space wrap>
    <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
      Add {label}
    </Button>
  </Space>
)

const FILTER_OPTIONS = [
  { label: 'Project Number', value: 'projectNumber' },
  { label: 'Centre', value: 'centre' },
  { label: 'Date Range', value: 'dateRange' },
  { label: 'Is Acknowledged', value: 'isAcknowledged' },
  { label: 'Small Value Project', value: 'smallValueProject' }
]

const getPiName = (record) =>
  (record?.project_co_ordinator || record?.quotation_given_by_name || '').trim()

const getGhName = (record) => (record?.group || 'Group Head').trim()

const normalizeName = (v) => (v || '').toString().trim().toLowerCase()

const getThreadEvents = (queries, thread, record) => {
  const events = []
  const piName = normalizeName(getPiName(record))
  const ghName = normalizeName(getGhName(record))

    ; (queries || []).forEach((q) => {
      const isToAdmin = normalizeName(q.to) === 'admin'
      const isFromAdmin = normalizeName(q.from_) === 'admin'
      if (!isToAdmin && !isFromAdmin) return

      // Filter by thread
      if (thread === 'pi') {
        const otherIsPi = isToAdmin
          ? normalizeName(q.from_) === piName
          : normalizeName(q.to) === piName
        if (!otherIsPi) return
      } else {
        const otherIsGh = isToAdmin
          ? (normalizeName(q.from_) === ghName || normalizeName(q.from_) === 'group head')
          : (normalizeName(q.to) === ghName || normalizeName(q.to) === 'group head')
        if (!otherIsGh) return
      }

      events.push({
        id: `${q.id}-msg`,
        dbId: q.id,
        content: q.remarks_description,
        from_: q.from_,
        timestamp: q.updated_at,
        message_seen: q.message_seen,
        reply_seen: q.reply_seen,
        replyer: q.replyer,
        respond_to_remarks: q.respond_to_remarks,
      })
      if (q.respond_to_remarks) {
        events.push({
          id: `${q.id}-reply`,
          dbId: q.id,
          content: q.respond_to_remarks,
          from_: q.to,
          timestamp: q.updated_at,
          message_seen: q.message_seen,
          reply_seen: q.reply_seen,
          replyer: q.replyer,
          respond_to_remarks: q.respond_to_remarks,
        })
      }
    })
  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

const getThreadUnseenCount = (record, thread) => {
  if (!record || !record.queries) return 0
  const piName = normalizeName(getPiName(record))
  const ghName = normalizeName(getGhName(record))

  return record.queries.filter((q) => {
    const isToAdmin = normalizeName(q.to) === 'admin'
    const isFromAdmin = normalizeName(q.from_) === 'admin'
    if (!isToAdmin && !isFromAdmin) return false

    // 1. Unseen incoming messages to admin
    if (isToAdmin && q.message_seen === false) {
      if (thread === 'pi' && normalizeName(q.from_) === piName) return true
      if (thread === 'gh' && (normalizeName(q.from_) === ghName || normalizeName(q.from_) === 'group head')) return true
    }

    // 2. Unseen replies to admin's message
    if (isFromAdmin && q.respond_to_remarks && q.reply_seen === false) {
      if (thread === 'pi' && normalizeName(q.to) === piName) return true
      if (thread === 'gh' && (normalizeName(q.to) === ghName || normalizeName(q.to) === 'group head')) return true
    }

    return false
  }).length
}

const countUnseenReplies = (record) => {
  return getThreadUnseenCount(record, 'pi') + getThreadUnseenCount(record, 'gh')
}

const isPendingReply = (record) => {
  const queries = record.queries || []
  return queries.some(
    (q) => normalizeName(q.to) === 'admin' && !q.respond_to_remarks
  )
}

function Proposals() {
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
  const [visibleFilters, setVisibleFilters] = useState([])
  const [deliveryDateMutuallyAgreed, setDeliveryDateMutuallyAgreed] = useState(false)
  const [centreFilter, setCentreFilter] = useState([])
  const [orderDateRange, setOrderDateRange] = useState(null)
  const [enquiryDateRange, setEnquiryDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [projectNumberFilter, setProjectNumberFilter] = useState([])
  const [groupFilter, setGroupFilter] = useState([])
  const [isAcknowledgedFilter, setIsAcknowledgedFilter] = useState(null)
  const [smallValueProjectFilter, setSmallValueProjectFilter] = useState(null)
  const [selectedDateField, setSelectedDateField] = useState('enquiry_date')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const fileInputRef = useRef(null)
  const [bulkImportLoading, setBulkImportLoading] = useState(false)
  const [currentUserName, setCurrentUserName] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState('')
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
  const [pageSize, setPageSize] = useState(10)
  const [proposalsConverted, setProposalsConverted] = useState(null)

  // Document modal state
  const [stageConfig, setStageConfig] = useState([])
  const [docsModalVisible, setDocsModalVisible] = useState(false)
  const [projectDocs, setProjectDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)
  const [viewDocumentBlobUrl, setViewDocumentBlobUrl] = useState(null)
  const [viewDocumentMime, setViewDocumentMime] = useState('')
  const [viewDocumentPreviewLoading, setViewDocumentPreviewLoading] = useState(false)
  const [excelRendererData, setExcelRendererData] = useState(null)
  const [excelRendererLoading, setExcelRendererLoading] = useState(false)
  const [excelRendererError, setExcelRendererError] = useState(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [wordDocumentContent, setWordDocumentContent] = useState(null)
  const [wordDocumentLoading, setWordDocumentLoading] = useState(false)
  const [wordDocumentError, setWordDocumentError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewDocumentPreviewError, setViewDocumentPreviewError] = useState('')

  // Chat modal state
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [chatProject, setChatProject] = useState(null)
  const [chatThread, setChatThread] = useState('pi')
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [showNewMessagesOnly, setShowNewMessagesOnly] = useState(false)
  const [showPendingReplyOnly, setShowPendingReplyOnly] = useState(false)
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

  const unreadChatsCount = useMemo(() => {
    return tableData.filter((item) => countUnseenReplies(item) > 0).length
  }, [tableData])

  const pendingReplyCount = useMemo(() => {
    return tableData.filter(isPendingReply).length
  }, [tableData])

  // Acknowledgment modal state
  const [acknowledgmentModalOpen, setAcknowledgmentModalOpen] = useState(false)
  const [selectedProposalForAcknowledgment, setSelectedProposalForAcknowledgment] = useState(null)
  const [acknowledgmentLoading, setAcknowledgmentLoading] = useState(false)
  const [acknowledgmentForm] = Form.useForm()

  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchProjectDocuments = useCallback(async (projectId) => {
    setDocsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch documents')
      const data = await res.json()
      const docs = Array.isArray(data) ? data : []

      const projectDocsRaw = docs.filter((d) => {
        const docProjectId = d?.project_id ?? d?.project ?? d?.projectId
        if (docProjectId == null || projectId == null) return false
        return String(docProjectId) === String(projectId)
      })

      const sortedByDate = [...projectDocsRaw].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      )

      const withVersions = sortedByDate.map((d, idx) => ({
        ...d,
        version: idx + 1,
        display_name: d.name || `Document v${idx + 1}`,
      }))

      setProjectDocs(withVersions)
    } catch (err) {
      console.error('Error fetching project documents:', err)
      message.error(err.message || 'Unable to load documents')
      setProjectDocs([])
    } finally {
      setDocsLoading(false)
    }
  }, [])

  // Chat functions for admin users
  const loadChatMessages = useCallback(async (record) => {
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
    const piName = normalizeName(getPiName(record))
    const ghName = normalizeName(getGhName(record))
    const sender = thread === 'pi' ? piName : ghName

    // Case 1: Mark incoming messages from sender to admin as seen
    const unseenMessages = (record.queries || []).filter(
      (q) => {
        const isFromSender = normalizeName(q.from_) === sender || (thread === 'gh' && normalizeName(q.from_) === 'group head')
        return isFromSender && normalizeName(q.to) === 'admin' && q.message_seen === false
      }
    )
    unseenMessages.forEach(async (q) => {
      try {
        await fetch(`${API_BASE_URL}/Remarkss/${q.id}/mark-seen`, { method: 'PATCH' })
      } catch (e) {
        console.warn('mark-seen failed for', q.id, e)
      }
    })

    // Case 2: Mark sender's replies to admin's message as seen
    const unseenReplies = (record.queries || []).filter(
      (q) => {
        const isToSender = normalizeName(q.to) === sender || (thread === 'gh' && normalizeName(q.to) === 'group head')
        return normalizeName(q.from_) === 'admin' && isToSender && q.respond_to_remarks && q.reply_seen === false
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
  }, [])

  const openChatModal = useCallback(async (record) => {
    setChatProject(record)
    const piUnseen = getThreadUnseenCount(record, 'pi')
    const ghUnseen = getThreadUnseenCount(record, 'gh')
    const initialThread = ghUnseen > 0 && piUnseen === 0 ? 'gh' : 'pi'
    setChatThread(initialThread)
    setChatModalOpen(true)
    await loadChatMessages(record)
    await markSeenForActiveThread(record, initialThread)
  }, [loadChatMessages, markSeenForActiveThread])

  const switchChatThread = async (thread) => {
    setChatThread(thread)
    if (chatProject) {
      await markSeenForActiveThread(chatProject, thread)
    }
  }

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
      const recipient = chatThread === 'pi' ? getPiName(chatProject) : (chatProject.group || 'Group Head')

      // Find the latest unanswered message from the other party in the current thread
      const unansweredMsg = [...(chatMessages || [])]
        .reverse()
        .find((q) => {
          const isFromRecipient = normalizeName(q.from_) === normalizeName(recipient) || (chatThread === 'gh' && normalizeName(q.from_) === 'group head')
          const isToMe = normalizeName(q.to) === 'admin'
          return isFromRecipient && isToMe && !q.respond_to_remarks
        })

      if (unansweredMsg) {
        // REPLY: Update the existing row with respond_to_remarks
        const payload = {
          respond_to_remarks: chatInput.trim(),
          replyer: 'admin',
          reply_seen: false,  // recipient hasn't seen the reply yet
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
        // NEW MESSAGE: Admin is initiating a new conversation thread
        const payload = {
          from_: 'admin',
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
      await loadChatMessages(chatProject)

      const fetchEvent = new Event('refresh-proposals')
      window.dispatchEvent(fetchEvent)
      fetchProposals()
    } catch (error) {
      console.error('Error sending message:', error)
      message.error(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }

  const openDetailModal = useCallback((record) => {
    setSelectedRecord(record)
    setDetailModalOpen(true)
    // Fetch uploaded documents for this proposal
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
      if (selectedDateField && startDate && endDate) {
        params.append('date_field', selectedDateField)
        params.append('start_date', startDate.format('YYYY-MM-DD'))
        params.append('end_date', endDate.format('YYYY-MM-DD'))
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
  }, [selectedDateField, startDate, endDate])

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
    return () => {
      if (viewDocumentBlobUrl) {
        URL.revokeObjectURL(viewDocumentBlobUrl)
      }
    }
  }, [viewDocumentBlobUrl])

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

  const handleShowDuplicateQuoteRefs = () => {
    const seen = new Map()
    const duplicates = new Set()

    tableData.forEach((item) => {
      const ref = (item.quote_reference || '').trim().toLowerCase()
      if (!ref) return
      if (seen.has(ref)) {
        duplicates.add(ref)
      } else {
        seen.set(ref, true)
      }
    })

    if (duplicates.size === 0) {
      message.info('No duplicate Quote References found')
      setShowDuplicatesOnly(false)
      return
    }

    setShowDuplicatesOnly(true)
    const duplicateRows = tableData.filter((item) => {
      const ref = (item.quote_reference || '').trim().toLowerCase()
      return ref && duplicates.has(ref)
    })
    message.warning(`Found ${duplicateRows.length} proposals with duplicate Quote References`)
  }

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
        if (parsedUser && parsedUser.role) {
          setCurrentUserRole(parsedUser.role)
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
    setSelectedCentreId(null)
    setAvailableCoordinators([])
    setDeliveryDateMutuallyAgreed(false)
    setProposalsConverted(null)
    if (currentUserName) {
      form.setFieldsValue({ updated_by: currentUserName, delivery_date_mutually_agreed: false })
    } else {
      form.setFieldsValue({ delivery_date_mutually_agreed: false })
    }
    setModalOpen(true)
  }, [form, currentUserName])

  const openEditModal = useCallback(
    (record) => {
      setEditingRecord(record)
      const mutuallyAgreed = String(record.delivery_date).trim().toLowerCase() === 'mutually agreed'
      setDeliveryDateMutuallyAgreed(mutuallyAgreed)
      setProposalsConverted(record.proposals_converted || null)
      form.setFieldsValue({
        ...record,
        updated_by: currentUserName || record.updated_by,
        delivery_date_mutually_agreed: mutuallyAgreed,
      })

      const centerCodeFromRecord = (record.center || '').trim()
      if (centerCodeFromRecord) {
        const matchedCentre = centres.find(
          (c) => (c.code || '').trim() === centerCodeFromRecord,
        )
        setSelectedCentreId(matchedCentre ? matchedCentre.id : null)
      } else {
        setSelectedCentreId(null)
      }

      // Initialize available coordinators based on center and group
      const groupCodeFromRecord = (record.group || '').trim()
      if (centerCodeFromRecord && groupCodeFromRecord) {
        if (groupCodeFromRecord === 'Center Head') {
          // Special case for Center Head
          const center = centres.find(c => c.code === centerCodeFromRecord)
          const centerHead = center?.head
          if (centerHead) {
            setAvailableCoordinators([{ name: centerHead, id: `head-${center.id}` }])
          } else {
            setAvailableCoordinators([])
          }
        } else {
          const matchingUsers = users.filter(user =>
            user.center === centerCodeFromRecord && user.group === groupCodeFromRecord
          )

          // Include center head if not already in the list
          const center = centres.find(c => c.code === centerCodeFromRecord)
          const centerHead = center?.head
          if (centerHead && !matchingUsers.some(u => u.name === centerHead)) {
            matchingUsers.push({ name: centerHead, id: `head-${center.id}` })
          }

          setAvailableCoordinators(matchingUsers)
        }
      } else {
        setAvailableCoordinators([])
      }

      setModalOpen(true)
    },
    [form, currentUserName, centres, users],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingRecord(null)
    setSelectedCentreId(null)
    setAvailableCoordinators([])
    setProposalsConverted(null)
    form.resetFields()
  }, [form])

  const handleSubmit = async (values) => {
    setSubmitLoading(true)

    // Extra safety check before hitting the API
    const trimmedRef = (values.quote_reference || '').trim().toLowerCase()
    if (trimmedRef) {
      const duplicate = tableData.find((item) => {
        if (!item.quote_reference) return false
        if (editingRecord && item.id === editingRecord.id) return false
        return item.quote_reference.trim().toLowerCase() === trimmedRef
      })
      if (duplicate) {
        message.error(
          `Quote Reference '${values.quote_reference}' already exists. Please use a unique Quote Reference.`
        )
        setSubmitLoading(false)
        return
      }
    }
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
        let detail = errorText
        try {
          const parsed = JSON.parse(errorText)
          detail = parsed.detail || errorText
        } catch {
        }
        throw new Error(detail || 'Request failed')
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
      filtered = filtered.filter((item) =>
        item.group && groupFilter.includes(item.group),
      )
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
    } else if (statusFilter === 'pendingProjects') {
      filtered = filtered.filter(
        (item) =>
          item.status === 'Ongoing' || item.status === 'On Hold',
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

    if (smallValueProjectFilter !== null) {
      filtered = filtered.filter((item) => {
        const svpValue = item.small_value_project
        if (smallValueProjectFilter) {
          // Show only records with 'true', 'TRUE', or true (boolean)
          return svpValue === 'true' || svpValue === 'TRUE' || svpValue === true
        } else {
          // Show records that are null, empty, or anything except 'true', 'TRUE', or true
          return svpValue !== 'true' && svpValue !== 'TRUE' && svpValue !== true
        }
      })
    }

    // Apply date range filtering or converted status filtering
    if (selectedDateField === 'proposals_converted') {
      filtered = filtered.filter((item) => {
        const value = String(item.proposals_converted || '').toLowerCase().trim()
        return value === 'yes'
      })
    } else if (selectedDateField === 'proposals_not_converted') {
      filtered = filtered.filter((item) => {
        const value = String(item.proposals_converted || '').toLowerCase().trim()
        return value !== 'yes'
      })
    } else if (selectedDateField === 'ongoing_projects') {
      filtered = filtered.filter((item) => {
        const status = String(item.status || '').toLowerCase().trim()
        return status === 'ongoing' || status === 'on hold'
      })
    } else if (selectedDateField && startDate && endDate) {
      const startOfDay = startDate.startOf('day')
      const endOfDay = endDate.endOf('day')

      filtered = filtered.filter((item) => {
        const dateValue = item[selectedDateField]
        if (!dateValue) return false

        try {
          const itemDate = dayjs(dateValue)
          return itemDate.isAfter(startOfDay) && itemDate.isBefore(endOfDay)
        } catch (error) {
          return false
        }
      })
    }

    if (showNewMessagesOnly) {
      filtered = filtered.filter((item) => countUnseenReplies(item) > 0)
    }

    if (showPendingReplyOnly) {
      filtered = filtered.filter(isPendingReply)
    }

    if (showDuplicatesOnly) {
      const seen = new Map()
      const duplicates = new Set()
      tableData.forEach((item) => {
        const ref = (item.quote_reference || '').trim().toLowerCase()
        if (!ref) return
        if (seen.has(ref)) {
          duplicates.add(ref)
        } else {
          seen.set(ref, true)
        }
      })
      filtered = filtered.filter((item) => {
        const ref = (item.quote_reference || '').trim().toLowerCase()
        return ref && duplicates.has(ref)
      })
    }

    setFilteredData(filtered)
  }, [searchText, centreFilter, orderDateRange, statusFilter, projectNumberFilter, isAcknowledgedFilter, smallValueProjectFilter, tableData, selectedDateField, startDate, endDate, showNewMessagesOnly, showPendingReplyOnly, showDuplicatesOnly])

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

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (projectNumberFilter.length > 0) count++
    if (centreFilter.length > 0) count++
    if (groupFilter.length > 0) count++
    if (isAcknowledgedFilter !== null) count++
    if (smallValueProjectFilter !== null) count++
    if (selectedDateField && startDate && endDate) count++
    return count
  }, [projectNumberFilter, centreFilter, groupFilter, isAcknowledgedFilter, smallValueProjectFilter, selectedDateField, startDate, endDate])

  const departmentOptions = useMemo(
    () =>
      groups
        .map((g) => (g.name || '').trim())
        .filter((name) => name)
        .sort(),
    [groups],
  )

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
      'technical_completed_year',
      'financial_completed_year',
      'project_allotment_date',
      'review_meeting_date',
    ])

    const amountFields = new Set([
      'quote_amount',
      'revised_negotiated_quote_amount',
      'order_value',
    ])

    const baseColumns = TABLE_FIELDS.map((field) => {
      const baseColumn = {
        key: field.name,
        dataIndex: field.name,
        title: field.label,
        width: field.width,
        fixed: field.fixed,
      }


      const parseEnquiryDate = (val) => {
        if (!val) return 0

        // Try native/ISO parsing first (covers "2024-06-01", "2024-06-01T00:00:00Z", Date objects, etc.)
        let parsed = dayjs(val)
        if (parsed.isValid()) return parsed.valueOf()

        // Fallback: explicit DD-MM-YYYY strings
        parsed = dayjs(val, 'DD-MM-YYYY', true)
        if (parsed.isValid()) return parsed.valueOf()

        // Fallback: explicit DD/MM/YYYY strings, if that format also shows up
        parsed = dayjs(val, 'DD/MM/YYYY', true)
        if (parsed.isValid()) return parsed.valueOf()

        return 0
      }

      // Sortable Enquiry Date column (use robust parser that handles ISO, DD-MM-YYYY, DD/MM/YYYY and Excel serials)
      if (field.name === 'enquiry_date') {
        return {
          ...baseColumn,
          sorter: {
            compare: (a, b) => {
              const safeVal = (v) => v === null || v === undefined ? '' : v
              return parseEnquiryDate(safeVal(a.enquiry_date)) - parseEnquiryDate(safeVal(b.enquiry_date))
            },
            multiple: 1,
          },
          sortDirections: ['ascend', 'descend'],
          render: (value) => formatDate(value),
        }
      }

      // Custom render for Status field with styled badges
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

      // Custom render for Customer Type field with soft pastel rounded pill badges
      if (field.name === 'customer_type') {
        return {
          ...baseColumn,
          render: (value) => {
            if (!value) return '-'
            const normalized = String(value).toLowerCase().trim()
            let bg = '#F3F4F6'
            let color = '#374151'
            if (normalized.includes('private')) {
              bg = '#DCFCE7'
              color = '#16A34A'
            } else if (normalized.includes('govt') || normalized.includes('government') || normalized.includes('public')) {
              bg = '#E0F2FE'
              color = '#2563EB'
            } else if (normalized.includes('others')) {
              bg = '#FFEDD5'
              color = '#EA580C'
            } else if (normalized.includes('msme')) {
              bg = '#FEF9C3'
              color = '#CA8A04'
            }
            return (
              <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: bg, color: color }}>
                {value}
              </span>
            )
          }
        }
      }
      return {
        ...baseColumn,
        render: field.render ?? (dateFields.has(field.name) ? (value) => formatDate(value) : amountFields.has(field.name) ? (value) => formatIndianNumber(value) : undefined),
      }
    })

    // Find index of extended_delivery_date and insert overdue_days after it
    const extendedDeliveryIndex = baseColumns.findIndex(
      (col) => col.key === 'extended_delivery_date',
    )

    const overdueDaysColumn = {
      key: 'overdue_days',
      dataIndex: 'overdue_days',
      title: 'Overdue Days',
      width: 150,
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

    // Insert overdue_days column after extended_delivery_date
    if (extendedDeliveryIndex !== -1) {
      baseColumns.splice(extendedDeliveryIndex + 1, 0, overdueDaysColumn)
    }

    // Calculate max payments across all proposals for dynamic columns
    // Use 1 as minimum to always show at least Invoice 1 columns
    const maxPayments = Math.max(...tableData.map(p => p.payments?.length || 0), 1)

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

    // Generate payment columns after ppm_remarks
    const paymentColumns = []
    for (let i = 0; i < maxPayments; i++) {
      paymentFields.forEach((field) => {
        paymentColumns.push({
          key: `inv${i + 1}_${field.key}`,
          dataIndex: 'payments',
          title: `Inv ${i + 1} ${field.label}`,
          width: field.width,
          render: (_, record) => record.payments?.[i]?.[field.key] || '-',
        })
      })
    }

    // Find index of ppm_remarks and insert payment columns after it
    const ppmRemarksIndex = baseColumns.findIndex(
      (col) => col.key === 'ppm_remarks',
    )
    if (ppmRemarksIndex !== -1 && paymentColumns.length > 0) {
      baseColumns.splice(ppmRemarksIndex + 1, 0, ...paymentColumns)
    }

    // Add Total Invoice Amount Received column after payment columns
    const totalInvAmtRecdColumn = {
      key: 'total_inv_amt_recd',
      title: 'Total Inv Amt Recd',
      width: 150,
      render: (_, record) => {
        if (!record.payments || record.payments.length === 0) {
          return <span style={{ color: '#999' }}>0</span>
        }

        const total = record.payments.reduce((sum, payment) => {
          const amount = parseFloat(payment.amount_recieved) || 0
          return sum + amount
        }, 0)

        return (
          <span style={{
            fontWeight: 600,
            color: total > 0 ? '#52c41a' : '#999'
          }}>
            {formatIndianNumber(total)}
          </span>
        )
      },
    }

    // Insert total column after payment columns
    if (ppmRemarksIndex !== -1 && paymentColumns.length > 0) {
      const insertIndex = ppmRemarksIndex + 1 + paymentColumns.length
      baseColumns.splice(insertIndex, 0, totalInvAmtRecdColumn)
    } else {
      baseColumns.push(totalInvAmtRecdColumn)
    }

    // Add Enquiry Documents column before Actions
    const enquiryDocumentsColumn = {
      key: 'enquiry_documents',
      title: 'Enquiry Documents',
      width: 130,
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
    }
    baseColumns.push(enquiryDocumentsColumn)

    return [
      ...baseColumns,
      {
        key: 'actions',
        title: 'Actions',
        fixed: 'right',
        width: 110,
        render: (_, record) => {
          const isGuest = ['guest', 'role'].includes(currentUserRole?.toLowerCase().trim())
          const unseenCount = isGuest ? 0 : countUnseenReplies(record)
          const pendingReply = isGuest ? false : isPendingReply(record)
          const hasBadge = unseenCount > 0 || pendingReply

          const menuItems = [
            ...(!isGuest
              ? [
                {
                  key: 'chat',
                  label: (
                    <span title={`Chat${unseenCount > 0 ? ` (${unseenCount} new)` : ''}${pendingReply ? ' - Reply needed' : ''}`} style={{ color: unseenCount > 0 ? '#ff4d4f' : undefined, display: 'flex', justifyContent: 'center', fontSize: '16px' }}>
                      <MessageOutlined />
                    </span>
                  ),
                  onClick: () => openChatModal(record),
                },
              ]
              : []),
            ...(isProposalConverted(record.proposals_converted)
              ? [
                {
                  key: 'generators',
                  label: (
                    <span title="Document Generators" style={{ display: 'flex', justifyContent: 'center', fontSize: '16px' }}>
                      <FileTextOutlined />
                    </span>
                  ),
                  children: [
                    {
                      key: 'acknowledgment',
                      label: 'Acknowledgment Generator',
                      onClick: () =>
                        openAcknowledgmentModal(
                          record,
                          acknowledgmentForm,
                          setSelectedProposalForAcknowledgment,
                          setAcknowledgmentModalOpen
                        ),
                    },
                  ],
                },
              ]
              : []),
            ...(!isGuest
              ? [
                { type: 'divider' },
                {
                  key: 'delete',
                  danger: true,
                  label: 'Delete',
                  onClick: () => {
                    Modal.confirm({
                      title: 'Confirm delete',
                      content: 'This action cannot be undone.',
                      okText: 'Delete',
                      okButtonProps: { danger: true },
                      cancelText: 'Cancel',
                      onOk: () => handleDelete(record),
                    })
                  },
                },
              ]
              : []),
          ]

          return (
            <Space size="small">
              <Button
                size="small"
                type="link"
                icon={<EyeOutlined />}
                onClick={() => openDetailModal(record)}
                title="View"
              />
              {!isGuest && (
                <Button
                  size="small"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                  title="Edit"
                />
              )}
              {menuItems.length > 0 && (
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                  <Badge dot={hasBadge} color="#ff4d4f" offset={[-2, 2]}>
                    <Button
                      size="small"
                      type="link"
                      icon={<MoreOutlined />}
                      title="More actions"
                      style={{ color: hasBadge ? '#ff4d4f' : undefined }}
                    />
                  </Badge>
                </Dropdown>
              )}
            </Space>
          )
        },
      },
    ]
  }, [deletingId, handleDelete, openEditModal, openDetailModal, openDocsModal, openChatModal, tableData])

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
    { title: 'Centre', dataIndex: 'center', key: 'center', render: (value) => formatCenterName(value) },
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

  // Project code prefixes constant
  const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']

  // Total Proposals Submitted breakdown (all items)




  // Technically Completed breakdown
  const technicallyCompletedBreakdown = {}
  tableData.forEach((item) => {
    if (item.technical_completed_year && item.technical_completed_year.trim() !== '') {
      if (item.project_number) {
        const prefix = PROJECT_PREFIXES.find((p) =>
          item.project_number.toUpperCase().startsWith(p),
        )
        if (prefix) {
          technicallyCompletedBreakdown[prefix] = (technicallyCompletedBreakdown[prefix] || 0) + 1
        } else {
          technicallyCompletedBreakdown.Other = (technicallyCompletedBreakdown.Other || 0) + 1
        }
      }
    }
  })

  // Financially Completed breakdown
  const financiallyCompletedBreakdown = {}
  tableData.forEach((item) => {
    if (item.technical_completed_year && item.technical_completed_year.trim() !== '' &&
      item.financial_completed_year && item.financial_completed_year.trim() !== '') {
      if (item.project_number) {
        const prefix = PROJECT_PREFIXES.find((p) =>
          item.project_number.toUpperCase().startsWith(p),
        )
        if (prefix) {
          financiallyCompletedBreakdown[prefix] = (financiallyCompletedBreakdown[prefix] || 0) + 1
        } else {
          financiallyCompletedBreakdown.Other = (financiallyCompletedBreakdown.Other || 0) + 1
        }
      }
    }
  })

  // Ongoing Projects breakdown
  const ongoingProjectsBreakdown = {}
  tableData.forEach((item) => {
    if (item.status === 'Ongoing' || item.status === 'On Hold') {
      if (item.project_number) {
        const prefix = PROJECT_PREFIXES.find((p) =>
          item.project_number.toUpperCase().startsWith(p),
        )
        if (prefix) {
          ongoingProjectsBreakdown[prefix] = (ongoingProjectsBreakdown[prefix] || 0) + 1
        } else {
          ongoingProjectsBreakdown.Other = (ongoingProjectsBreakdown.Other || 0) + 1
        }
      }
    }
  })

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

    const pendingProjects = tableData.filter(
      (item) => item.status === 'Ongoing' || item.status === 'On Hold',
    ).length

    const onHoldProjects = tableData.filter(
      (item) => item.status === 'On Hold',
    ).length

    // Calculate pending breakdown (proposals without project_number)
    const pendingBreakdown = {
      ongoing: tableData.filter(
        (item) => (!item.project_number || item.project_number.trim() === '') &&
          (!item.proposals_converted || item.proposals_converted.trim() === '')
      ).length,
      rejected: tableData.filter(
        (item) => (!item.project_number || item.project_number.trim() === '') &&
          String(item.proposals_converted || '').toLowerCase().trim() === 'no'
      ).length,
    }

    // Calculate project code breakdown
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
      totalProposals,
      totalProjects,
      technicallyCompleted,
      financiallyCompleted,
      pendingProjects,
      onHoldProjects,
      projectCodeBreakdown,
      // totalSubmittedBreakdown,
      // pendingBreakdown,
      technicallyCompletedBreakdown,
      financiallyCompletedBreakdown,
      ongoingProjectsBreakdown,
      pendingBreakdown,
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
                  {(() => {
                    const handleStatusCardClick = (val) => {
                      setStatusFilter(val)
                      setShowNewMessagesOnly(false)
                      setShowPendingReplyOnly(false)
                      setShowDuplicatesOnly(false)
                    }

                    return (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                        {/* Card 1: Total Proposals */}
                        <Card
                          className="bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick(null)}
                        >
                          <FileTextOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Submitted</span>}
                            value={statistics.totalProposals + statistics.totalProjects}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                        </Card>

                        {/* Card 2: Pending Proposals */}
                        <Card
                          className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick('proposals')}
                        >
                          <ClockCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Pending</span>}
                            value={statistics.totalProposals}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                          {statistics.pendingBreakdown && (
                            <div className="mt-2 text-[11px] text-white/80 font-medium">
                              Ongoing: {statistics.pendingBreakdown.ongoing} | Rejected: {statistics.pendingBreakdown.rejected}
                            </div>
                          )}
                        </Card>

                        {/* Card 3: Converted to Projects */}
                        <Card
                          className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick('totalProjects')}
                        >
                          <CheckCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Converted</span>}
                            value={statistics.totalProjects}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                          {Object.keys(statistics.projectCodeBreakdown).length > 0 && (
                            <div className="mt-2 text-[11px] text-white/80 font-medium flex flex-wrap gap-x-1">
                              {Object.entries(statistics.projectCodeBreakdown)
                                .filter(([, count]) => count > 0)
                                .map(([code, count], idx, arr) => (
                                  <span key={code}>
                                    {code}: {count}
                                    {idx < arr.length - 1 ? ' |' : ''}
                                  </span>
                                ))}
                            </div>
                          )}
                        </Card>

                        {/* Card 4: Technically Completed */}
                        <Card
                          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick('technicallyCompleted')}
                        >
                          <AppstoreOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Tech Completed</span>}
                            value={statistics.technicallyCompleted}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                          {Object.keys(statistics.technicallyCompletedBreakdown).length > 0 && (
                            <div className="mt-2 text-[11px] text-white/80 font-medium flex flex-wrap gap-x-1">
                              {Object.entries(statistics.technicallyCompletedBreakdown)
                                .filter(([, count]) => count > 0)
                                .map(([code, count], idx, arr) => (
                                  <span key={code}>
                                    {code}: {count}
                                    {idx < arr.length - 1 ? ' |' : ''}
                                  </span>
                                ))}
                            </div>
                          )}
                        </Card>

                        {/* Card 5: Financially Completed */}
                        <Card
                          className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick('financiallyCompleted')}
                        >
                          <DollarCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Fin Completed</span>}
                            value={statistics.financiallyCompleted}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                          {Object.keys(statistics.financiallyCompletedBreakdown).length > 0 && (
                            <div className="mt-2 text-[11px] text-white/80 font-medium flex flex-wrap gap-x-1">
                              {Object.entries(statistics.financiallyCompletedBreakdown)
                                .filter(([, count]) => count > 0)
                                .map(([code, count], idx, arr) => (
                                  <span key={code}>
                                    {code}: {count}
                                    {idx < arr.length - 1 ? ' |' : ''}
                                  </span>
                                ))}
                            </div>
                          )}
                        </Card>

                        {/* Card 6: Ongoing Projects */}
                        <Card
                          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                          style={{ borderRadius: '16px', border: 'none', minHeight: '135px' }}
                          onClick={() => handleStatusCardClick('pendingProjects')}
                        >
                          <PlayCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                          <Statistic
                            title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Ongoing</span>}
                            value={statistics.pendingProjects}
                            valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                          />
                          {Object.keys(statistics.ongoingProjectsBreakdown).length > 0 && (
                            <div className="mt-2 text-[11px] text-white/80 font-medium flex flex-wrap gap-x-1">
                              {Object.entries(statistics.ongoingProjectsBreakdown)
                                .filter(([, count]) => count > 0)
                                .map(([code, count], idx, arr) => (
                                  <span key={code}>
                                    {code}: {count}
                                    {idx < arr.length - 1 ? ' |' : ''}
                                  </span>
                                ))}
                            </div>
                          )}
                          {statistics.onHoldProjects > 0 && (
                            <div className="mt-1 text-[11px] text-white/80 font-medium">
                              On hold: {statistics.onHoldProjects}
                            </div>
                          )}
                        </Card>
                      </div>
                    )
                  })()}

                  <style>{`
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
                    .admin-proposals-table .ant-table-cell {
                      padding-top: 12px !important;
                      padding-bottom: 12px !important;
                    }
                    .admin-proposals-table .ant-table-row:hover {
                      background-color: #F8FAFC !important;
                    }
                  `}</style>
                  <input
                    id="excel-import-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFileChange}
                    style={{ display: 'none' }}
                  />

                  {importPreview && (
                    <Modal
                      title={
                        importPreview
                          ? `Import Preview – ${importPreview.rows.length} rows (${importPreview.sheetName})`
                          : 'Import Preview'
                      }
                      open={importModalOpen}
                      onCancel={() => {
                        setImportModalOpen(false)
                        setImportPreview(null)
                      }}
                      width={1100}
                      footer={[
                        <Button
                          key="cancel"
                          onClick={() => {
                            setImportModalOpen(false)
                            setImportPreview(null)
                          }}
                        >
                          Cancel
                        </Button>,
                        <Button
                          key="submit"
                          type="primary"
                          loading={bulkImportLoading}
                          onClick={handleBulkImport}
                        >
                          Submit Import ({importPreview.rows.length} rows)
                        </Button>,
                      ]}
                    >
                      <div className="overflow-auto max-h-[60vh]">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr>
                              {importPreview.headers.map((h, idx) => (
                                <th
                                  key={idx}
                                  className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold"
                                >
                                  {h || `Column ${idx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.rows.slice(0, 200).map((row, rIdx) => (
                              <tr key={rIdx}>
                                {importPreview.headers.map((_, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="border border-slate-200 px-2 py-1"
                                  >
                                    {row[cIdx] ?? ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importPreview.rows.length > 200 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Showing first 200 rows of {importPreview.rows.length}.
                          </p>
                        )}
                      </div>
                    </Modal>
                  )}

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
                                <Descriptions.Item label="Small Value Project">
                                  {renderDetailValue(
                                    'small_value_project',
                                    selectedRecord.small_value_project,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Project Number">
                                  {renderDetailValue('project_number', selectedRecord.project_number)}
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
                                <Descriptions.Item label="Project Allotment Date">
                                  {renderDetailValue(
                                    'project_allotment_date',
                                    selectedRecord.project_allotment_date,
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Review Meeting Date">
                                  {renderDetailValue(
                                    'review_meeting_date',
                                    selectedRecord.review_meeting_date,
                                  )}
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
                                  title: 'Inv #',
                                  dataIndex: 'invoice_no',
                                  key: 'invoice_no',
                                  width: 120,
                                  render: (v) => v || '-',
                                },
                                {
                                  title: 'Inv Date',
                                  dataIndex: 'invoice_date',
                                  key: 'invoice_date',
                                  width: 110,
                                  render: (v) => formatDate(v) || '-',
                                },
                                {
                                  title: 'Gross',
                                  dataIndex: 'gross_amount',
                                  key: 'gross_amount',
                                  width: 110,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'GST Amount',
                                  dataIndex: 'get_amount',
                                  key: 'get_amount',
                                  width: 110,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Amount Claimed',
                                  dataIndex: 'amount_claimed',
                                  key: 'amount_claimed',
                                  width: 130,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Amount Received',
                                  dataIndex: 'amount_recieved',
                                  key: 'amount_recieved',
                                  width: 130,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Received Date',
                                  dataIndex: 'recieved_date',
                                  key: 'recieved_date',
                                  width: 120,
                                  render: (v) => formatDate(v) || '-',
                                },
                                {
                                  title: 'TDS',
                                  dataIndex: 'tds',
                                  key: 'tds',
                                  width: 90,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'GST TDS',
                                  dataIndex: 'get_tds',
                                  key: 'get_tds',
                                  width: 90,
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
                                  width: 90,
                                  align: 'right',
                                  render: (v) => (v !== undefined && v !== null && v !== '' ? formatIndianNumber(v) : '-'),
                                },
                                {
                                  title: 'Status',
                                  dataIndex: 'follow_up_status',
                                  key: 'follow_up_status',
                                  width: 150,
                                  render: (v) => v || '-',
                                },
                                {
                                  title: 'Updated At',
                                  width: 150,
                                  render: (_, record) => {
                                    if (!record?.updated_by) return '-'
                                    if (!record?.updated_at) return '-'
                                    const d = dayjs(record.updated_at)
                                    return d.isValid() ? d.format('DD-MM-YYYY') : String(record.updated_at)
                                  },
                                },
                                {
                                  title: 'Updated By',
                                  width: 120,
                                  render: (_, record) => {
                                    if (!record.updated_by) return '-'
                                    return record.updated_by
                                  },
                                },
                                {
                                  title: 'Actions',
                                  width: 120,
                                  fixed: 'right',
                                  render: (_, record) => (
                                    <Space>
                                      <Button size="small" icon={<EditOutlined />}>Edit</Button>
                                      <Popconfirm title="Delete payment?" onConfirm={() => console.log('Delete payment:', record.id)}>
                                        <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
                                      </Popconfirm>
                                    </Space>
                                  ),
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Title level={4} className="!mb-1">
                          Proposal / Projects
                        </Title>
                        <p className="text-slate-500 text-sm">
                          Showing {filteredData.length} proposals/projects
                        </p>
                      </div>

                      {/* Primary Blue CTA Add Button */}
                      {!['guest', 'role'].includes(currentUserRole?.toLowerCase().trim()) && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={openAddModal}
                          className="font-medium rounded-lg h-10 shadow-sm"
                          style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                        >
                          Add Proposal / Project
                        </Button>
                      )}
                    </div>

                    {/* Unified Clean Horizontal Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      {/* Search Bar */}
                      <Input
                        placeholder="Search proposals..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        className="rounded-lg md:max-w-xs h-10"
                      />

                      {/* Filter Toggles */}
                      <Button
                        type="default"
                        icon={<FilterOutlined />}
                        onClick={() => setFiltersOpen((prev) => !prev)}
                        className={`h-10 rounded-lg font-medium`}
                        style={{
                          borderColor: '#2563eb',
                          color: '#2563eb',
                          backgroundColor: filtersOpen ? '#eff6ff' : '#ffffff'
                        }}
                      >
                        Filters
                        {activeFilterCount > 0 && (
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>

                      {/* Clear Filters (Placed next to Filter button) */}
                      <Button
                        onClick={() => {
                          setSearchText('')
                          setCentreFilter([])
                          setOrderDateRange(null)
                          setStatusFilter(null)
                          setProjectNumberFilter([])
                          setGroupFilter([])
                          setIsAcknowledgedFilter(null)
                          setSmallValueProjectFilter(null)
                          setSelectedDateField('enquiry_date')
                          setStartDate(null)
                          setEndDate(null)
                          setShowNewMessagesOnly(false)
                          setShowPendingReplyOnly(false)
                          setShowDuplicatesOnly(false)
                        }}
                        className="h-10 rounded-lg font-medium"
                        style={{ borderColor: '#ef4444', color: '#dc2626' }}
                      >
                        Clear Filters
                      </Button>

                      {!['guest', 'role'].includes(currentUserRole?.toLowerCase().trim()) && (
                        <>
                          <Button
                            type={showNewMessagesOnly ? 'primary' : 'default'}
                            size="small"
                            onClick={() => {
                              setShowNewMessagesOnly(!showNewMessagesOnly)
                              setShowPendingReplyOnly(false)
                            }}
                            className={`h-10 rounded-lg ${showNewMessagesOnly ? 'shadow-md hover:shadow-lg' : (unreadChatsCount > 0 ? 'blink-chat-btn' : '')}`}
                            style={showNewMessagesOnly ? {} : (unreadChatsCount > 0 ? {} : { borderColor: '#1890ff', color: '#1890ff' })}
                          >
                            💬 Unread Chats ({unreadChatsCount})
                          </Button>

                          <Button
                            type={showPendingReplyOnly ? 'primary' : 'default'}
                            size="small"
                            onClick={() => {
                              setShowPendingReplyOnly(!showPendingReplyOnly)
                              setShowNewMessagesOnly(false)
                            }}
                            className={`h-10 rounded-lg ${showPendingReplyOnly ? 'shadow-md hover:shadow-lg' : ''}`}
                            style={showPendingReplyOnly ? {} : { borderColor: '#fa8c16', color: '#fa8c16' }}
                          >
                            ⚠️ Reply Needed ({pendingReplyCount})
                          </Button>
                        </>
                      )}

                      {/* Spacer */}
                      <div className="flex-grow" />

                      {/* Action Controls */}
                      <Space wrap size="small">
                        {!['guest', 'role'].includes(currentUserRole?.toLowerCase().trim()) && (
                          <Button onClick={handleShowDuplicateQuoteRefs} className="h-10 rounded-lg text-slate-600">
                            Duplicate Quote Refs
                          </Button>
                        )}
                        {!['guest', 'role'].includes(currentUserRole?.toLowerCase().trim()) && (
                          <Button
                            icon={<UploadOutlined />}
                            onClick={() => document.getElementById('excel-import-input').click()}
                            className="h-10 rounded-lg text-slate-600"
                          >
                            Import
                          </Button>
                        )}
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={handleExportExcel}
                          className="h-10 rounded-lg text-white font-medium"
                          style={{ backgroundColor: '#2563EB', borderColor: '#2563EB', color: 'white' }}
                        >
                          Export
                        </Button>
                      </Space>
                    </div>

                    {/* Active Filter Chips */}
                    {(centreFilter.length > 0 ||
                      projectNumberFilter.length > 0 ||
                      groupFilter.length > 0 ||
                      isAcknowledgedFilter !== null ||
                      smallValueProjectFilter !== null ||
                      (selectedDateField && startDate && endDate)) && (
                        <div className="flex flex-wrap items-center gap-2 py-1">
                          {projectNumberFilter.map((code) => (
                            <Tag key={`pn-${code}`} closable onClose={() => setProjectNumberFilter(projectNumberFilter.filter((c) => c !== code))}>
                              {code}
                            </Tag>
                          ))}
                          {centreFilter.map((c) => (
                            <Tag key={`c-${c}`} closable onClose={() => setCentreFilter(centreFilter.filter((v) => v !== c))}>
                              {formatCenterName(c)}
                            </Tag>
                          ))}
                          {groupFilter.map((g) => (
                            <Tag key={`g-${g}`} closable onClose={() => setGroupFilter(groupFilter.filter((v) => v !== g))}>
                              {formatGroupName(g)}
                            </Tag>
                          ))}
                          {isAcknowledgedFilter !== null && (
                            <Tag closable onClose={() => setIsAcknowledgedFilter(null)}>
                              Acknowledged: {isAcknowledgedFilter ? 'Yes' : 'No'}
                            </Tag>
                          )}
                          {smallValueProjectFilter !== null && (
                            <Tag closable onClose={() => setSmallValueProjectFilter(null)}>
                              SVP: {smallValueProjectFilter ? 'Yes' : 'No'}
                            </Tag>
                          )}
                          {selectedDateField && startDate && endDate && (
                            <Tag closable onClose={() => { setStartDate(null); setEndDate(null) }}>
                              {DATE_FIELD_OPTIONS.find((o) => o.value === selectedDateField)?.label}:{' '}
                              {startDate.format(DISPLAY_DATE_FORMAT)} → {endDate.format(DISPLAY_DATE_FORMAT)}
                            </Tag>
                          )}
                        </div>
                      )}

                    {/* All filter controls shown together when Filters button is toggled open */}
                    {filtersOpen && (
                      <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                        <Row gutter={[16, 12]}>
                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Project Number</div>
                            <Select
                              mode="multiple"
                              placeholder="Select prefix"
                              value={projectNumberFilter}
                              onChange={setProjectNumberFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT'].map((code) => (
                                <Select.Option key={code} value={code}>{code}</Select.Option>
                              ))}
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Centre</div>
                            <Select
                              mode="multiple"
                              placeholder="Select centre"
                              value={centreFilter}
                              onChange={setCentreFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              {uniqueCentres.map((center) => (
                                <Select.Option key={center} value={center}>{formatCenterName(center)}</Select.Option>
                              ))}
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Is Acknowledged</div>
                            <Select
                              placeholder="Select"
                              value={isAcknowledgedFilter}
                              onChange={setIsAcknowledgedFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              <Select.Option value={true}>Yes</Select.Option>
                              <Select.Option value={false}>No</Select.Option>
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Small Value Project</div>
                            <Select
                              placeholder="Select"
                              value={smallValueProjectFilter}
                              onChange={setSmallValueProjectFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              <Select.Option value={true}>Yes</Select.Option>
                              <Select.Option value={false}>No</Select.Option>
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Date Field</div>
                            <Select
                              value={selectedDateField}
                              onChange={setSelectedDateField}
                              style={{ width: '100%' }}
                              placeholder="Select Date Field"
                            >
                              {DATE_FIELD_OPTIONS.map((option) => (
                                <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
                              ))}
                            </Select>
                          </Col>

                          <Col xs={12} sm={6} md={3}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">Start</div>
                            <DatePicker
                              placeholder="Start"
                              value={startDate}
                              onChange={setStartDate}
                              style={{ width: '100%' }}
                              format={DISPLAY_DATE_FORMAT}
                            />
                          </Col>

                          <Col xs={12} sm={6} md={3}>
                            <div className="mb-1 text-xs font-semibold text-slate-600">End</div>
                            <DatePicker
                              placeholder="End"
                              value={endDate}
                              onChange={setEndDate}
                              style={{ width: '100%' }}
                              format={DISPLAY_DATE_FORMAT}
                            />
                          </Col>
                        </Row>
                      </div>
                    )}
                    <Table
                      className="admin-proposals-table"
                      rowKey="key"
                      columns={columns}
                      dataSource={filteredData}
                      loading={tableLoading}
                      pagination={{
                        pageSize: pageSize,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '100'],
                        onShowSizeChange: (current, size) => {
                          setPageSize(size)
                        },
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
                      }}
                      scroll={{ x: 'max-content' }}
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

      <Modal
        title="Document Viewer"
        open={!!viewDocumentUrl}
        onCancel={() => {
          setViewDocumentUrl(null)
          setViewDocumentPreviewError('')
          setViewDocumentMime('')
          setViewDocumentPreviewLoading(false)
          setExcelRendererData(null)
          setExcelRendererError(null)
          setExcelRendererLoading(false)
          setActiveSheetIndex(0)
          setWordDocumentContent(null)
          setWordDocumentError(null)
          setWordDocumentLoading(false)
          setIsFullscreen(false)
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

          const isWordFile =
            ext === 'docx' ||
            ext === 'doc' ||
            mime.includes('wordprocessingml.document') ||
            mime.includes('msword') ||
            mime.includes('word')

          if (isWordFile) {
            if (wordDocumentLoading) {
              return (
                <div className="flex items-center justify-center h-[60vh]">
                  <Spin />
                </div>
              )
            }

            if (wordDocumentError) {
              return (
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                  <div className="text-6xl mb-4">📎</div>
                  <h3 className="text-xl font-semibold">Word Document Preview</h3>
                  <p className="text-gray-500 text-center max-w-md">{wordDocumentError}</p>
                  <div className="space-x-2">
                    <Button
                      type="primary"
                      size="large"
                      onClick={() => window.open(currentUrl, '_blank')}
                    >
                      Download Document
                    </Button>
                    <Button
                      size="large"
                      onClick={() => loadWordDocument(currentUrl)}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )
            }

            if (wordDocumentContent) {
              return (
                <div className="w-full h-[80vh] overflow-auto bg-white border rounded p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Word Document Viewer</h3>
                    <div className="space-x-2">
                      <Button
                        size="small"
                        onClick={() => window.open(currentUrl, '_blank')}
                        icon={<LinkOutlined />}
                      >
                        Download
                      </Button>
                      <Button
                        size="small"
                        onClick={() => loadWordDocument(currentUrl)}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>
                  <div
                    className="word-document-content"
                    dangerouslySetInnerHTML={{ __html: wordDocumentContent }}
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      lineHeight: '1.6',
                      color: '#333',
                    }}
                  />
                </div>
              )
            }

            return (
              <div className="flex items-center justify-center h-[60vh]">
                <Spin />
              </div>
            )
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

              // Conditional logic based on proposals_converted field
              const fieldsAfterProposalsConverted = [
                'project_number', 'project_allotment_date', 'project_co_ordinator',
                'party_name', 'activity', 'key_deliverables', 'order_number', 'order_date',
                'delivery_date', 'extended_delivery_date', 'date_of_actual_commencement',
                'order_value', 'details_of_external_internal_review_meeting', 'review_meeting_date',
                'closer_report', 'technical_completed_year', 'financial_completed_year',
                'status', 'ppm_remarks', 'dispatch_date', 'small_value_project'
              ]

              // Hide if_not_reason unless proposals_converted is 'No'
              if (field.name === 'if_not_reason' && proposalsConverted !== 'No') {
                return null
              }

              // Hide all fields after proposals_converted unless proposals_converted is 'Yes'
              if (fieldsAfterProposalsConverted.includes(field.name) && proposalsConverted !== 'Yes') {
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
                'technical_completed_year',
                'financial_completed_year',
                'project_allotment_date',
                'review_meeting_date',
              ]
              const isDateField = dateFields.includes(field.name)

              if (isDateField) {
                if (field.name === 'delivery_date') {
                  return (
                    <Form.Item
                      key={field.name}
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
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Form.Item
                          name={field.name}
                          noStyle
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
                          style={{ flex: 1 }}
                        >
                          <DatePicker
                            style={{ width: '100%' }}
                            format={DISPLAY_DATE_FORMAT}
                            placeholder={`Select ${field.label}`}
                            disabled={deliveryDateMutuallyAgreed}
                          />
                        </Form.Item>

                        <Form.Item
                          name="delivery_date_mutually_agreed"
                          valuePropName="checked"
                          noStyle
                        >
                          <Checkbox
                            onChange={(e) => {
                              const checked = e.target.checked
                              setDeliveryDateMutuallyAgreed(checked)
                              if (checked) {
                                form.setFieldsValue({ delivery_date: 'Mutually Agreed' })
                              } else if (form.getFieldValue('delivery_date') === 'Mutually Agreed') {
                                form.setFieldsValue({ delivery_date: '' })
                              }
                            }}
                          >
                            Mutually Agreed
                          </Checkbox>
                        </Form.Item>
                      </div>
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
              const isSmallValueProjectField = field.name === 'small_value_project'

              if (isSmallValueProjectField) {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    valuePropName="checked"
                    getValueFromEvent={(e) => e.target.checked ? 'true' : 'false'}
                    normalize={(value) => {
                      // Convert string 'true'/'false' back to boolean for checkbox
                      if (typeof value === 'string') {
                        return value === 'true'
                      }
                      return Boolean(value)
                    }}
                    getValueProps={(value) => ({
                      // Always show unchecked by default, only allow checking if value is true
                      checked: value === true || value === 'true'
                    })}
                  >
                    <Checkbox>Mark as Small Value Project</Checkbox>
                  </Form.Item>
                )
              }
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

              if (field.name === 'quotation_given_by_name') {
                // Get unique coordinator names for Quotation Given By dropdown
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
                      placeholder="Select Quotation Given By"
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

                        // Reset group when center changes
                        form.setFieldsValue({ center: value, group: undefined, project_co_ordinator: undefined })

                        // Update selected center ID
                        if (value) {
                          const matchedCentre = centres.find(
                            (c) => (c.code || '').trim() === (value || '').trim(),
                          )
                          setSelectedCentreId(matchedCentre ? matchedCentre.id : null)
                          setAvailableCoordinators([])
                        } else {
                          // Center was cleared
                          setSelectedCentreId(null)
                          setAvailableCoordinators([])
                        }
                      }}
                    >
                      {centreCodeOptions.map((code) => (
                        <Select.Option key={code} value={code}>
                          {formatCenterName(code)}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'group') {
                const currentCenterValue = form.getFieldValue('center')
                // Get groups for currently selected center, or all groups if no center selected
                const availableGroups = currentCenterValue
                  ? filteredGroups
                  : groups

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
                      showSearch
                      placeholder="Select Group"
                      onChange={(groupValue) => {
                        // Find the selected center and group
                        const selectedCenterCode = form.getFieldValue('center')
                        const selectedCenter = centres.find(c => c.code === selectedCenterCode)

                        if (groupValue === 'Center Head') {
                          // Special case for Center Head
                          const centerHead = selectedCenter?.head
                          if (centerHead) {
                            setAvailableCoordinators([{ name: centerHead, id: `head-${selectedCenter.id}` }])
                            form.setFieldsValue({ project_co_ordinator: centerHead })
                          } else {
                            setAvailableCoordinators([])
                            form.setFieldsValue({ project_co_ordinator: '' })
                          }
                        } else {
                          const selectedGroup = groups.find(g => g.code === groupValue)

                          if (selectedCenter && selectedGroup) {
                            // Find all users matching the center and group
                            const matchingUsers = users.filter(user =>
                              user.center === selectedCenterCode && user.group === groupValue
                            )

                            // Include center head if not already in the list
                            const centerHead = selectedCenter.head
                            if (centerHead && !matchingUsers.some(u => u.name === centerHead)) {
                              matchingUsers.push({ name: centerHead, id: `head-${selectedCenter.id}` })
                            }

                            // Update available coordinators list
                            setAvailableCoordinators(matchingUsers)

                            // If there's only one coordinator, auto-select them
                            if (matchingUsers.length === 1) {
                              form.setFieldsValue({ project_co_ordinator: matchingUsers[0].name })
                            } else {
                              // Clear if multiple coordinators or none
                              form.setFieldsValue({ project_co_ordinator: '' })
                            }
                          } else if (groupValue && !selectedCenterCode) {
                            // If group is selected but center is not, show warning
                            message.warning('Please select a center first')
                            form.setFieldsValue({ group: undefined })
                          } else {
                            // Clear if center or group not selected
                            setAvailableCoordinators([])
                            form.setFieldsValue({ project_co_ordinator: '' })
                          }
                        }

                        // Re-fetch users to get the updated list for the new center/group
                        setTimeout(() => fetchUsers(), 100) // Small delay to ensure form is updated first
                      }}
                    >
                      {availableGroups.map((group) => (
                        <Select.Option key={group.id} value={group.code}>
                          {formatGroupName(group.code)}
                        </Select.Option>
                      ))}
                      {currentCenterValue && (
                        <Select.Option key="center-head" value="Center Head">
                          Center Head
                        </Select.Option>
                      )}
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

              if (field.name === 'proposals_converted') {
                return (
                  <Form.Item
                    key={field.name}
                    name={field.name}
                    label={field.label}
                  >
                    <Select
                      placeholder="-- Select Option --"
                      allowClear
                      onChange={(value) => setProposalsConverted(value)}
                    >
                      <Select.Option value="Yes">Yes</Select.Option>
                      <Select.Option value="No">No</Select.Option>
                    </Select>
                  </Form.Item>
                )
              }

              if (field.name === 'project_co_ordinator') {
                // Get unique coordinator names
                const uniqueCoordinators = availableCoordinators.filter((user, index, self) =>
                  index === self.findIndex((u) => u.name === user.name)
                )

                if (field.name === 'quote_reference') {
                  return (
                    <Form.Item
                      key={field.name}
                      name={field.name}
                      label={field.label}
                      rules={[
                        ...(field.required
                          ? [{ required: true, message: `Please enter ${field.label}` }]
                          : []),
                        {
                          validator: (_, value) => {
                            if (!value || !value.trim()) return Promise.resolve()
                            const normalized = value.trim().toLowerCase()
                            const duplicate = tableData.find((item) => {
                              if (!item.quote_reference) return false
                              if (editingRecord && item.id === editingRecord.id) return false
                              return item.quote_reference.trim().toLowerCase() === normalized
                            })
                            if (duplicate) {
                              return Promise.reject(
                                new Error(
                                  `Quote Reference '${value}' already exists. Please enter a different Quote Reference.`
                                )
                              )
                            }
                            return Promise.resolve()
                          },
                        },
                      ]}
                    >
                      <Input placeholder="Enter unique Quote Reference" />
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

      {/* Chronological Chat Modal */}
      <Modal
        title={
          <div className="flex flex-col gap-2">
            <span className="text-base font-semibold text-slate-800">
              {chatProject?.activity || chatProject?.project_number || 'Conversation'}
            </span>
            <span className="text-xs text-slate-400">
              Chat with {chatThread === 'pi' ? 'Scientist' : 'Group Head'}
            </span>
            {(() => {
              const piUnseen = chatProject ? getThreadUnseenCount(chatProject, 'pi') : 0
              const ghUnseen = chatProject ? getThreadUnseenCount(chatProject, 'gh') : 0
              return (
                <Segmented
                  value={chatThread}
                  onChange={switchChatThread}
                  options={[
                    {
                      label: (
                        <Badge count={piUnseen} size="small" offset={[8, -2]}>
                          <span>Scientist</span>
                        </Badge>
                      ),
                      value: 'pi'
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
                const isOwn = normalizeName(event.from_) === 'admin'
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

      {/* Acknowledgment Modal */}
      <Modal
        title="Generate Acknowledgment"
        open={acknowledgmentModalOpen}
        onCancel={() => closeAcknowledgmentModal(setAcknowledgmentModalOpen, setSelectedProposalForAcknowledgment, acknowledgmentForm)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => closeAcknowledgmentModal(setAcknowledgmentModalOpen, setSelectedProposalForAcknowledgment, acknowledgmentForm)}>Cancel</Button>,
          <Button key="submit" type="primary" loading={acknowledgmentLoading} onClick={() => acknowledgmentForm.submit()}>
            Generate
          </Button>,
        ]}
      >
        <Form
          form={acknowledgmentForm}
          layout="vertical"
          onFinish={(values) => handleAcknowledgmentSubmit(
            values,
            selectedProposalForAcknowledgment,
            setAcknowledgmentLoading,
            () => closeAcknowledgmentModal(setAcknowledgmentModalOpen, setSelectedProposalForAcknowledgment, acknowledgmentForm)
          )}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
              Kind Attn:
            </label>
            <Form.Item
              name="kind_attn"
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="Enter attention person name" />
            </Form.Item>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
              Purchase Order No:
            </label>
            <Form.Item
              name="purchase_order_no"
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="Enter purchase order number" />
            </Form.Item>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
              Purchase Order Date:
            </label>
            <Form.Item
              name="purchase_order_date"
              style={{ marginBottom: 0 }}
            >
              <DatePicker
                style={{ width: '100%' }}
                format={DISPLAY_DATE_FORMAT}
                placeholder="Select purchase order date"
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  )
}

export default Proposals