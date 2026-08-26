import { useCallback, useEffect, useMemo, useState, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  UploadOutlined,
  MessageOutlined,
  FileOutlined,
  InfoCircleOutlined,
  FileWordOutlined,
  FormOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  FileProtectOutlined,
  PaperClipOutlined,
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
  Alert,
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
import messagingImg from '../assets/messaging.png'
import FloatingChatsWidget from '../components/FloatingChatsWidget'
import TopChatNotificationBar from '../components/TopChatNotificationBar'
import { encryptMessage, decryptMessage } from '../utils/crypto.js'
import DocumentGenerate from './Document_genrate'
import ProjectProposal from '../isopages/projectpropsal.jsx'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const getAuthHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem('token')
  return {
    accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

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
  { name: 'make_in_india', label: 'Make In India', width: 200, input: 'textarea', inForm: false },
  {
    name: 'tender_images',
    label: 'Tender Images',
    width: 220,
    inForm: false,
    render: (value) => {
      if (!value) return '-'
      let urls = []
      try {
        urls = Array.isArray(value) ? value : JSON.parse(value)
      } catch (e) {
        urls = String(value).split(',').map((s) => s.trim()).filter(Boolean)
      }
      if (!Array.isArray(urls) || !urls.length) return '-'
      return (
        <Space wrap>
          {urls.map((url, idx) => (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={`Tender ${idx + 1}`}
                style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
              />
            </a>
          ))}
        </Space>
      )
    },
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

const COORDINATOR_ADD_FIELDS = [
  'enquiry_date',
  'customer_type',
  'customer_name',
  'address',
  'email',
  'phone_no',
  'alternate_contact_details',
  'request_type',
  'make_in_india',
  'email_reference',
  'quotation_given_by_name',
  'quotation_given_by_department',
  'center',
  'group',
  'proposal_status',
]

const API_FIELD_MAP = {
  'revised/negotiated': 'revised_negotiated',
  'revised/negotiated_quote_date': 'revised_negotiated_quote_date',
  'revised/negotiated_quote_amount': 'revised_negotiated_quote_amount',
}

const isProposalConverted = (proposalsConverted) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue === 'yes'
}

const getPiName = (record) =>
  (record?.project_co_ordinator || record?.quotation_given_by_name || '').trim()

const getGhName = (record) => (record?.group || 'Group Head').trim()

const normalizeName = (v) => (v || '').toString().trim().toLowerCase()

const getThreadEvents = (queries, thread, record, currentUserName, isGhRole) => {
  const events = []
  const piName = normalizeName(currentUserName || getPiName(record))
  const ghName = normalizeName(getGhName(record))

    ; (queries || []).forEach((q) => {
      const isToAdmin = normalizeName(q.to) === 'admin'
      const isFromAdmin = normalizeName(q.from_) === 'admin'

      if (thread === 'admin') {
        if (isGhRole) {
          if (isToAdmin) {
            const fromName = normalizeName(q.from_)
            if (fromName !== ghName && fromName !== 'group head' && fromName !== piName) return
          } else if (isFromAdmin) {
            const toName = normalizeName(q.to)
            if (toName !== ghName && toName !== 'group head' && toName !== piName) return
          } else {
            return
          }
        } else {
          if (isToAdmin) {
            const fromName = normalizeName(q.from_)
            if (fromName !== piName) return
          } else if (isFromAdmin) {
            const toName = normalizeName(q.to)
            if (toName !== piName) return
          } else {
            return
          }
        }
      } else {
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


const isProposalNotConverted = (proposalsConverted, ifNotReason) => {
  if (!proposalsConverted) return false
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  const isNo = convertedValue === 'no'
  const reasonIsBlank = !ifNotReason || String(ifNotReason).trim() === ''
  return isNo && reasonIsBlank
}

export default function Allproposals() {
  const navigate = useNavigate()
  const [floatingChatOpen, setFloatingChatOpen] = useState(false)
  const [selectedNotificationTarget, setSelectedNotificationTarget] = useState(null)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [form] = Form.useForm()
  const [coordinatorForm] = Form.useForm()
  const watchedCoordRequestType = Form.useWatch('request_type', coordinatorForm)
  const isCoordTenderSelected = (Array.isArray(watchedCoordRequestType) ? watchedCoordRequestType.join(' ') : String(watchedCoordRequestType || '')).toLowerCase().includes('tender')

  const handleNavigateToChats = () => {
    const currentPath = window.location.pathname.toLowerCase()
    if (currentPath.includes('/admin')) {
      navigate('/admin/chats')
    } else if (currentPath.includes('/scientist')) {
      navigate('/scientist/chats')
    } else if (currentPath.includes('/gh')) {
      navigate('/gh/chats')
    } else if (currentPath.includes('/ch')) {
      navigate('/ch/chats')
    } else {
      navigate('/chats')
    }
  }

  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)

  const [searchText, setSearchText] = useState('')
  const [orderDateRange, setOrderDateRange] = useState(null)
  const [enquiryDateRange, setEnquiryDateRange] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [projectCodePrefix, setProjectCodePrefix] = useState('')
  const [projectNumberFilter, setProjectNumberFilter] = useState(null)
  const [groupFilter, setGroupFilter] = useState(undefined)
  const [quotationGivenByFilter, setQuotationGivenByFilter] = useState(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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
  const [currentUserCenter, setCurrentUserCenter] = useState(() => {
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
  const [userRole, setUserRole] = useState(() => {
    try {
      const path = window.location.pathname.toLowerCase()
      if (path.startsWith('/gh')) return 'gh'
      if (path.startsWith('/ch')) return 'ch'
      if (path.startsWith('/scientist')) return 'scientist'

      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        const role = parsedUser.role || parsedUser.dbRole
        return role?.toLowerCase() || ''
      }
    } catch (e) {
      console.error(e)
    }
    return ''
  })

  const isGhRole = userRole === 'gh'

  const [coordinatorModalOpen, setCoordinatorModalOpen] = useState(false)
  const [proposalCreationMode, setProposalCreationMode] = useState('selection') // 'selection' | 'manual' | 'upload_review' | 'iso_project_proposal' | 'draft'
  const [draftQuoteDescription, setDraftQuoteDescription] = useState('')
  const [convertingDraftRecord, setConvertingDraftRecord] = useState(null)
  const [docxUploading, setDocxUploading] = useState(false)
  const [uploadedDocName, setUploadedDocName] = useState('')
  const [uploadedDocxFile, setUploadedDocxFile] = useState(null)
  const [costEstimationModalOpen, setCostEstimationModalOpen] = useState(false)
  const [selectedProposalForCostEstimation, setSelectedProposalForCostEstimation] = useState(null)

  const [tenderFileList, setTenderFileList] = useState([])
  const [coordinatorSubmitLoading, setCoordinatorSubmitLoading] = useState(false)
  const [customerOptions, setCustomerOptions] = useState([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [allCustomerSuggestions, setAllCustomerSuggestions] = useState([])
  const [addressOptions, setAddressOptions] = useState([])
  const [phoneOptions, setPhoneOptions] = useState([])
  const [emailOptions, setEmailOptions] = useState([])

  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0)
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(false)
  const [originalTableData, setOriginalTableData] = useState([])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const raw = localStorage.getItem('ppm_user')
      const parsed = raw ? JSON.parse(raw) : {}
      const uName = parsed.name || currentUserName
      const uRole = userRole
      const uGrp = parsed.group || currentUserGroup

      if (!uName) return

      const [groupRes, proposalRes] = await Promise.all([
        fetch(`${API_BASE_URL}/group-chats/?user_name=${encodeURIComponent(uName)}`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE_URL}/Remarkss/unread_count?user_name=${encodeURIComponent(uName)}&user_role=${encodeURIComponent(uRole)}&user_group=${encodeURIComponent(uGrp)}`).then(r => r.ok ? r.json() : { unread_count: 0 }).catch(() => ({ unread_count: 0 }))
      ])

      const groupList = Array.isArray(groupRes) ? groupRes : []
      const groupUnread = groupList.reduce((acc, curr) => acc + (curr.unread_count || 0), 0)
      const proposalUnread = proposalRes?.unread_count || 0
      setUnreadChatCount(groupUnread + proposalUnread)
    } catch (e) {
      console.error('Error fetching unread count:', e)
    }
  }, [currentUserName, userRole, currentUserGroup])

  useEffect(() => {
    fetchUnreadCount()
    const handleChatUpdated = () => fetchUnreadCount()
    window.addEventListener('ppm-chat-updated', handleChatUpdated)
    return () => {
      window.removeEventListener('ppm-chat-updated', handleChatUpdated)
    }
  }, [fetchUnreadCount])

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
  const [chatThread, setChatThread] = useState('admin')

  const messagesEndRef = useRef(null)

  const chatEvents = useMemo(
    () => getThreadEvents(chatMessages, chatThread, chatProject, currentUserName, isGhRole),
    [chatMessages, chatThread, chatProject, currentUserName, isGhRole],
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


  const mapApiToUi = (item) => {
    const mapped = { ...item }
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
    let group = ''
    try {
      let role = userRole
      let name = currentUserName
      let group = currentUserGroup

      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        name = (parsedUser.name || '').trim()
        group = (parsedUser.group || '').trim()
        setCurrentUserName(name)
        setCurrentUserCenter(parsedUser.center || '')
        setCurrentUserGroup(group)
        const path = window.location.pathname.toLowerCase()
        if (path.startsWith('/gh')) role = 'gh'
        else if (path.startsWith('/ch')) role = 'ch'
        else if (path.startsWith('/scientist')) role = 'scientist'
        setUserRole(role)
      }

      let url = ''
      if (role === 'gh') {
        if (!group) {
          setTableData([])
          setFilteredData([])
          return
        }
        url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(group)}`
      } else if (role === 'ch' || role === 'centre head' || role === 'center head') {
        if (!currentUserCenter) {
          setTableData([])
          setFilteredData([])
          return
        }
        url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(currentUserCenter.trim().toLowerCase())}`
      } else {
        if (!name) {
          setTableData([])
          setFilteredData([])
          return
        }
        url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(name)}?user_role=scientist`
      }

      const response = await fetch(url, {
        headers: { accept: 'application/json' },
      }).catch(() => null)

      if (!response) {
        setTableData([])
        setFilteredData([])
        return
      }

      if (!response.ok) {
        if (response.status === 404) {
          setTableData([])
          setFilteredData([])
          return
        }
        throw new Error('Unable to fetch proposals')
      }

      const list = await response.json()
      const normalized = (Array.isArray(list) ? list : []).map(mapApiToUi)

      try {
        const stagesRes = await fetch(`${API_BASE_URL}/stages/`, {
          headers: { accept: 'application/json' },
        }).catch(() => null)
        let enquiryStageId = null
        if (stagesRes && stagesRes.ok) {
          const stages = await stagesRes.json()
          const enquiryStage = (Array.isArray(stages) ? stages : []).find(
            (s) => (s.name || '').toString().trim().toLowerCase() === 'enquiry',
          )
          enquiryStageId = enquiryStage?.id
        }

        const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
          headers: { accept: 'application/json' },
        }).catch(() => null)
        if (docsRes && docsRes.ok) {
          const allDocs = await docsRes.json()
          const docsByProject = {};
          (Array.isArray(allDocs) ? allDocs : []).forEach((d) => {
            const pid = d?.project_id ?? d?.project ?? d?.projectId
            if (pid == null) return
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
    } finally {
      setTableLoading(false)
    }
  }, [isGhRole])

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
      const response = await fetch(`${API_BASE_URL}/customer1/`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        throw new Error('Unable to fetch customer suggestions')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload) ? payload.map(customer => {
        const emails = Array.isArray(customer.email) ? customer.email : []
        const phones = Array.isArray(customer.phone) ? customer.phone : []
        const addresses = Array.isArray(customer.address) ? customer.address : []
        const alternate_contacts = Array.isArray(customer.alternate_contact_details) ? customer.alternate_contact_details : []
        
        return {
          id: customer.id,
          name: customer.name,
          customer_type: customer.customer_type,
          email: emails[0] || '',
          phone_no: phones[0] || '',
          alternate_contact_details: alternate_contacts[0] || '',
          addresses: addresses,
          emails: emails,
          phones: phones,
        }
      }).filter(c => c.name && c.name.trim()) : []
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
        let filtered = Array.isArray(data) ? data : []

        if (isGhRole && currentUserGroup) {
          const cleanGroup = currentUserGroup.trim().toLowerCase()
          filtered = filtered.filter(item => (item.group || '').trim().toLowerCase() === cleanGroup)
        } else if (!isGhRole && currentUserName) {
          const cleanCurrentName = currentUserName.trim().toLowerCase()
          filtered = filtered.filter(item => {
            const cleanCoordinatorName = (item.project_co_ordinator || '').trim().toLowerCase()
            const cleanQuotationName = (item.quotation_given_by_name || '').trim().toLowerCase()
            const isProject = Boolean(item.project_number?.trim())
            if (isProject) {
              return cleanCoordinatorName === cleanCurrentName
            } else {
              return cleanCoordinatorName === cleanCurrentName || cleanQuotationName === cleanCurrentName
            }
          })
        }
        setUnacknowledgedCount(filtered.length)
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
      const list = await response.json()
      let normalized = (Array.isArray(list) ? list : []).map(mapApiToUi)

      if (isGhRole && currentUserGroup) {
        const cleanGroup = currentUserGroup.trim().toLowerCase()
        normalized = normalized.filter(item => (item.group || '').trim().toLowerCase() === cleanGroup)
      } else if (!isGhRole && currentUserName) {
        const cleanCurrentName = currentUserName.trim().toLowerCase()
        normalized = normalized.filter(item => {
          const cleanCoordinatorName = (item.project_co_ordinator || '').trim().toLowerCase()
          const cleanQuotationName = (item.quotation_given_by_name || '').trim().toLowerCase()
          const isProject = Boolean(item.project_number?.trim())
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

  const fetchAllQueryCounts = useCallback(async () => {
    try {
      const uName = currentUserName || ''
      const uRole = userRole || ''
      const uGrp = currentUserGroup || ''
      const response = await fetch(`${API_BASE_URL}/Remarkss/?unread_only=true&user_name=${encodeURIComponent(uName)}&user_role=${encodeURIComponent(uRole)}&user_group=${encodeURIComponent(uGrp)}`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) return

      const allQueries = await response.json()
      if (!Array.isArray(allQueries)) return

      const counts = {}
      const queriesByProject = {}

      allQueries.forEach(query => {
        const projectId = String(query.project_id)
        if (!queriesByProject[projectId]) {
          queriesByProject[projectId] = []
        }
        queriesByProject[projectId].push(query)

        if (!query.respond_to_remarks) {
          counts[projectId] = (counts[projectId] || 0) + 1
        }
      })

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
  }, [currentUserName, userRole, currentUserGroup])

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
  }, [])

  const openDocsModal = useCallback(async (projectId) => {
    setDocsModalVisible(true)
    await fetchProjectDocuments(projectId)
  }, [fetchProjectDocuments])

  const openUploadModalForProject = useCallback(async (projectId, defaultProposalFile = null) => {
    setUploadProjectId(projectId)
    setUploadedBy(currentUserName || '')
    setUploadDescription('')
    setEnquiryFileToUpload(null)
    setProposalFileToUpload(defaultProposalFile || null)
    setEnquiryAttachments([])
    setProposalAttachments((prev) => (prev && prev.length ? prev : []))
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
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch Excel file: ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], 'excel.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      ExcelRenderer(file, (err, resp) => {
        if (err) {
          setExcelRendererError(`Failed to parse Excel file: ${err.message || err}`)
          setExcelRendererLoading(false)
        } else {
          setExcelRendererData(resp)
          setActiveSheetIndex(0)
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
      setWordDocumentContent(result.value)
      setWordDocumentLoading(false)
    } catch (error) {
      setWordDocumentError(`Error loading Word document: ${error.message}`)
      setWordDocumentLoading(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await fetchProposals()
      await fetchStageConfig()
      await fetchCustomerSuggestions()
      await fetchAllQueryCounts()
      await fetchUnacknowledgedCount()
    }
    loadData()
  }, [fetchProposals, fetchStageConfig, fetchCustomerSuggestions, fetchAllQueryCounts])

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

  const markSeenForActiveThread = useCallback(async (record, thread) => {
    if (!record) return

    if (isGhRole) {
      const myGroupName = normalizeName(currentUserGroup || 'group head')
      const piName = normalizeName(getPiName(record))
      const sender = thread === 'admin' ? 'admin' : piName

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

      if (unseenMessages.length > 0 || unseenReplies.length > 0) fetchProposals()
    } else {
      const myName = normalizeName(currentUserName || '')
      const myGroupName = normalizeName(record.group || '')
      const sender = thread === 'admin' ? 'admin' : myGroupName

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

      if (unseenMessages.length > 0 || unseenReplies.length > 0) fetchProposals()
    }
  }, [currentUserName, currentUserGroup, isGhRole, fetchProposals])

  const loadChatMessages = useCallback(async (record, thread) => {
    setChatLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/Remarkss/?project_id=${record.id}`, {
        headers: { accept: 'application/json' },
      })
      const projectMessages = response.ok ? await response.json() : []
      const threadKey = `proposal-${record.id}`
      const decryptedMessages = await Promise.all(
        (Array.isArray(projectMessages) ? projectMessages : []).map(async (m) => {
          const decDesc = m.remarks_description ? await decryptMessage(m.remarks_description, threadKey) : m.remarks_description
          const decReply = m.respond_to_remarks ? await decryptMessage(m.respond_to_remarks, threadKey) : m.respond_to_remarks
          return { ...m, remarks_description: decDesc, respond_to_remarks: decReply }
        })
      )
      setChatMessages(decryptedMessages)
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
      const threadKey = `proposal-${chatProject.id}`
      const encryptedText = await encryptMessage(chatInput.trim(), threadKey)

      if (isGhRole) {
        const myGroupName = normalizeName(currentUserGroup || 'group head')
        const piName = getPiName(chatProject) || 'Scientist'
        const recipient = chatThread === 'admin' ? 'admin' : piName

        const unansweredMsg = [...(chatMessages || [])]
          .reverse()
          .find((q) => {
            const isFromRecipient = normalizeName(q.from_) === normalizeName(recipient)
            const isToMe = normalizeName(q.to) === myGroupName || normalizeName(q.to) === 'group head'
            return isFromRecipient && isToMe && !q.respond_to_remarks
          })

        if (unansweredMsg) {
          const payload = {
            respond_to_remarks: encryptedText,
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
          const payload = {
            from_: currentUserGroup || 'Group Head',
            to: recipient,
            project_id: chatProject.id,
            remarks_description: encryptedText,
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
      } else {
        const myName = normalizeName(currentUserName || 'scientist')
        const myGroupName = normalizeName(getGhName(chatProject) || '')
        const recipient = chatThread === 'admin' ? 'admin' : myGroupName

        const unansweredMsg = [...(chatMessages || [])]
          .reverse()
          .find((q) => {
            const isFromRecipient = normalizeName(q.from_) === recipient || (recipient !== 'admin' && normalizeName(q.from_) === 'group head')
            return isFromRecipient && normalizeName(q.to) === myName && !q.respond_to_remarks
          })

        if (unansweredMsg) {
          const payload = {
            respond_to_remarks: encryptedText,
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
          const payload = {
            from_: currentUserName || 'Scientist',
            to: chatThread === 'admin' ? 'admin' : getGhName(chatProject),
            project_id: chatProject.id,
            remarks_description: encryptedText,
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
      }

      setChatInput('')
      await loadChatMessages(chatProject, chatThread)
      await fetchProposals()
    } catch (error) {
      console.error('Error sending message:', error)
      message.error(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }

  // Open/Close Coordinator Add Modal
  const openCoordinatorAddModal = () => {
    setConvertingDraftRecord(null)
    coordinatorForm.resetFields()
    setTenderFileList([])
    setProposalCreationMode('selection')
    setUploadedDocName('')
    setUploadedDocxFile(null)
    setDocxUploading(false)

    coordinatorForm.setFieldsValue({
      proposal_status: ['Submitted'],
      quotation_given_by_name: currentUserName || '',
      quotation_given_by_department: currentUserCenter ? currentUserCenter.toUpperCase() : '',
      center: currentUserCenter || '',
      group: currentUserGroup || '',
    })

    setCoordinatorModalOpen(true)
  }

  const handleConvertDraftToProposal = (record) => {
    setConvertingDraftRecord(record)
    setUploadedDocName('')
    setUploadedDocxFile(null)
    setProposalAttachments([])
    coordinatorForm.resetFields()
    coordinatorForm.setFieldsValue({
      id: record.id,
      quote_description: record.quote_description || '',
      customer_name: record.customer_name || '',
      quotation_given_by_name: record.quotation_given_by_name || currentUserName || '',
      quotation_given_by_department: record.quotation_given_by_department || (currentUserCenter ? currentUserCenter.toUpperCase() : ''),
      center: record.center || currentUserCenter || '',
      group: record.group || currentUserGroup || '',
      proposal_status: ['Submitted'],
    })
    setProposalCreationMode('selection')
    setCoordinatorModalOpen(true)
  }

  const closeCoordinatorModal = () => {
    setCoordinatorModalOpen(false)
    setConvertingDraftRecord(null)
    setTenderFileList([])
    setProposalCreationMode('selection')
    setUploadedDocName('')
    setUploadedDocxFile(null)
    setDocxUploading(false)
    setProposalAttachments([])
    coordinatorForm.resetFields()
    setCustomerOptions([])
  }

  // Handle uploading and parsing proposal docx document
  const handleDocxUpload = async (file) => {
    const isDocx = file.name.toLowerCase().endsWith('.docx')
    if (!isDocx) {
      message.error('Invalid file format. Only Microsoft Word (.docx) files are supported.')
      return false
    }

    setDocxUploading(true)
    setUploadedDocName(file.name)
    setUploadedDocxFile(file)

    const formData = new FormData()
    formData.append('mode', 'upload')
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE_URL}/proposals/add-proposal-coordinator`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to parse proposal document')
      }

      const res = await response.json()
      if (res.success && res.data) {
        const extracted = res.data
        const updatedValues = {}

        const dateVal = extracted.enquiry_date || extracted.quote_date
        if (dateVal) {
          const dateStr = dateVal.trim()
          let parsedDate = dayjs(dateStr, ['DD/MM/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD', 'MM/DD/YYYY'])
          if (!parsedDate.isValid()) {
            parsedDate = dayjs(dateStr)
          }
          if (parsedDate.isValid()) {
            updatedValues.enquiry_date = parsedDate
            updatedValues.quote_date = parsedDate
            updatedValues.revised_negotiated_quote_date = parsedDate
          }
        }
        if (extracted.customer_name) updatedValues.customer_name = extracted.customer_name
        if (extracted.customer_type) {
          updatedValues.customer_type = extracted.customer_type
        } else if (extracted.customer_name) {
          const matchCust = allCustomerSuggestions.find(
            (c) => c.name && c.name.trim().toLowerCase() === extracted.customer_name.trim().toLowerCase()
          )
          if (matchCust && matchCust.customer_type) {
            updatedValues.customer_type = matchCust.customer_type
          }
        }
        if (extracted.address) updatedValues.address = extracted.address
        if (extracted.email) updatedValues.email = extracted.email
        if (extracted.phone_no) updatedValues.phone_no = extracted.phone_no
        if (extracted.alternate_contact_details && extracted.alternate_contact_details !== extracted.kind_attention) {
          updatedValues.alternate_contact_details = extracted.alternate_contact_details
        }
        const emailRefVal = extracted.email_reference || extracted.email || ''
        if (emailRefVal) updatedValues.email_reference = emailRefVal
        if (extracted.quote_reference) updatedValues.quote_reference = extracted.quote_reference
        if (extracted.quote_description) updatedValues.quote_description = extracted.quote_description
        if (extracted.quote_amount) updatedValues.quote_amount = extracted.quote_amount
        if (extracted.center) {
          updatedValues.center = extracted.center
          updatedValues.quotation_given_by_department = extracted.center
        }
        if (!updatedValues.proposal_status) {
          updatedValues.proposal_status = ['Submitted']
        }

        // Populate fields into form
        coordinatorForm.setFieldsValue(updatedValues)

        message.success(`Extracted details from "${file.name}". Please review and edit before submitting.`)
        setProposalCreationMode('upload_review')
      } else {
        throw new Error('Could not extract details from the uploaded document.')
      }
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Error processing document')
    } finally {
      setDocxUploading(false)
    }
    return false
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

      coordinatorForm.setFieldsValue({
        customer_name: option.name,
        customer_type: option.customer_type || '',
      })

      // Set address, phone, and email options for the selected customer
      const addresses = Array.isArray(option.addresses) ? option.addresses : []
      setAddressOptions(addresses.map((a) => ({ value: a, label: a })))

      const phones = Array.isArray(option.phones) ? option.phones : []
      if (option.alternate_contact_details && !phones.includes(option.alternate_contact_details)) {
        phones.push(option.alternate_contact_details)
      }
      setPhoneOptions(Array.from(new Set(phones)).map((p) => ({ value: p, label: p })))

      const emails = Array.isArray(option.emails) ? option.emails : []
      setEmailOptions(Array.from(new Set(emails)).map((e) => ({ value: e, label: e })))
    },
    [coordinatorForm],
  )

  const searchAddresses = useCallback(
    async (searchValue) => {
      if (!searchValue || !searchValue.trim()) {
        setAddressOptions([])
        return
      }

      const currentName = coordinatorForm.getFieldValue('customer_name')?.trim()
      if (!currentName) {
        setAddressOptions([])
        return
      }

      const normalized = searchValue.trim().toLowerCase()
      const selectedCustomer = allCustomerSuggestions.find(
        (customer) => customer.name?.toLowerCase() === currentName.toLowerCase()
      )
      const addresses = selectedCustomer && Array.isArray(selectedCustomer.addresses) ? selectedCustomer.addresses : []
      const matches = addresses
        .filter((a) => a?.toLowerCase().includes(normalized))
        .slice(0, 20)
      setAddressOptions(matches.map((a) => ({ value: a, label: a })))
    },
    [coordinatorForm, allCustomerSuggestions],
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
        .flatMap((customer) => Array.isArray(customer.emails) ? customer.emails : [customer.email])
        .filter(Boolean)
        .filter((e) => e.toLowerCase().includes(normalized))
        .slice(0, 20)

      setEmailOptions(Array.from(new Set(matches)).map((e) => ({ value: e, label: e })))
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
          if (Array.isArray(customer.phones)) phones.push(...customer.phones)
          else if (customer.phone_no) phones.push(customer.phone_no)
          if (customer.alternate_contact_details) phones.push(customer.alternate_contact_details)
          return phones
        })
        .filter(Boolean)
        .filter((p) => p.toLowerCase().includes(normalized))
        .slice(0, 20)

      setPhoneOptions(Array.from(new Set(matches)).map((p) => ({ value: p, label: p })))
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

    if (Array.isArray(payload.proposal_status)) {
      payload.proposal_status = payload.proposal_status.join(', ')
    }
    if (!payload.proposal_status) {
      payload.proposal_status = 'Submitted'
    }

    // Add user information and set project_coordinator
    payload.project_coordinator = values.quotation_given_by_name || currentUserName || ''
    payload.center = currentUserCenter || ''
    payload.group = currentUserGroup || ''

    if (convertingDraftRecord && convertingDraftRecord.id) {
      payload.id = convertingDraftRecord.id
      payload.draft = false
    }

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
      if (newProjectId && (uploadedDocxFile || (proposalAttachments && proposalAttachments.length > 0))) {
        try {
          message.loading({ content: 'Uploading proposal document and attached files...', key: 'coord_upload' })

          const proposalStage = stageConfig.find(
            (s) => (s.name || '').toString().trim().toLowerCase() === 'proposal',
          )
          const stageId = proposalStage ? proposalStage.id : 2

          let mainFile = uploadedDocxFile
          let attachmentsList = [...(proposalAttachments || [])]

          if (!mainFile && attachmentsList.length > 0) {
            mainFile = attachmentsList[0]
            attachmentsList = attachmentsList.slice(1)
          }

          if (mainFile) {
            const formData = new FormData()
            formData.append('project_id', newProjectId)
            formData.append('stage_id', stageId)
            formData.append('uploaded_by', currentUserName || values.quotation_given_by_name || '')
            formData.append('name', 'Proposal')
            formData.append('version', 'v1')
            formData.append('description', 'Proposal document created with attached files')
            formData.append('file', mainFile)

            attachmentsList.forEach((att) => {
              formData.append('attachment', att)
            })

            const docUploadRes = await fetch(`${API_BASE_URL}/documents/`, {
              method: 'POST',
              body: formData,
            })

            if (docUploadRes.ok) {
              message.success({ content: 'Proposal & all attached documents saved successfully!', key: 'coord_upload' })
            } else {
              console.error('Failed uploading document/attachments:', await docUploadRes.text())
            }
          }
        } catch (uploadErr) {
          console.error('Error uploading proposal documents:', uploadErr)
        }
      }

      if (newProjectId && tenderFileList && tenderFileList.length > 0) {
        try {
          const finalImageUrls = []
          for (const item of tenderFileList) {
            if (item.url && !item.originFileObj) {
              finalImageUrls.push(item.url)
            } else if (item.originFileObj || item instanceof File) {
              const fileToUpload = item.originFileObj || item
              const formData = new FormData()
              formData.append('project_id', newProjectId)
              formData.append('uploaded_by', currentUserName || values.quotation_given_by_name || '')
              formData.append('name', `Tender Image: ${fileToUpload.name}`)
              formData.append('description', 'Tender Image')
              formData.append('file', fileToUpload)

              const docUploadRes = await fetch(`${API_BASE_URL}/documents/`, {
                method: 'POST',
                body: formData,
              })
              if (docUploadRes.ok) {
                const docResData = await docUploadRes.json()
                if (docResData?.url) {
                  finalImageUrls.push(docResData.url)
                }
              }
            }
          }

          if (finalImageUrls.length > 0) {
            await fetch(`${API_BASE_URL}/proposals/${newProjectId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tender_images: JSON.stringify(finalImageUrls) }),
            })
          }
        } catch (imgErr) {
          console.error('Error uploading tender images:', imgErr)
        }
      }

      message.success('Proposal created successfully')

      closeCoordinatorModal()
      await fetchProposals()

      if (newProjectId) {
        openUploadModalForProject(newProjectId)
      }
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to create proposal')
    } finally {
      setCoordinatorSubmitLoading(false)
    }
  }

  // Handle saving draft proposal with draft=true
  const handleSaveDraftProposal = async (overrideDescription) => {
    const descToSave = (overrideDescription !== undefined ? overrideDescription : draftQuoteDescription) || ''
    if (!descToSave.trim()) {
      message.error('Please enter a Quote Description to save a draft proposal.')
      return
    }
    setCoordinatorSubmitLoading(true)
    try {
      const payload = {
        quote_description: descToSave.trim(),
        draft: true,
        quotation_given_by_name: currentUserName || '',
        quotation_given_by_department: currentUserCenter || '',
        group: currentUserGroup || ''
      }
      const response = await fetch(`${API_BASE_URL}/proposals/`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || 'Failed to create draft proposal')
      }
      const result = await response.json()
      message.success(`Draft Proposal #${result.id || ''} saved successfully!`)
      setDraftQuoteDescription('')
      closeCoordinatorModal()
      await fetchProposals()
    } catch (err) {
      console.error('Draft creation error:', err)
      message.error(err.message || 'Failed to save draft proposal')
    } finally {
      setCoordinatorSubmitLoading(false)
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

      // Reflect the change locally
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

  const statistics = useMemo(() => {
    const totalProposals = tableData.filter((item) => !item.project_number?.trim()).length
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

    const draftProposalsCount = tableData.filter((item) => item.draft === true).length

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
      draftProposalsCount,
      projectCodeBreakdown,
    }
  }, [tableData])

  const groupOptions = useMemo(() => {
    const groups = [
      ...new Set(
        tableData
          .map((item) => (item.group || '').trim())
          .filter(Boolean),
      ),
    ]
    return groups
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((g) => ({ label: g, value: g }))
  }, [tableData])

  const quotationGivenByOptions = useMemo(() => {
    let sourceItems = tableData
    if (groupFilter) {
      const groupLower = groupFilter.toLowerCase().trim()
      sourceItems = tableData.filter(
        (item) => (item.group || '').toString().toLowerCase().trim() === groupLower
      )
    }

    const names = [
      ...new Set(
        sourceItems
          .flatMap((item) => [
            (item.quotation_given_by_name || '').trim(),
            (item.project_co_ordinator || '').trim(),
          ])
          .filter(Boolean),
      ),
    ]
    return names
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((name) => ({ label: name, value: name }))
  }, [tableData, groupFilter])

  useEffect(() => {
    if (groupFilter && quotationGivenByFilter) {
      const validNames = new Set(quotationGivenByOptions.map((o) => o.value))
      if (!validNames.has(quotationGivenByFilter)) {
        setQuotationGivenByFilter(undefined)
      }
    }
  }, [groupFilter, quotationGivenByOptions, quotationGivenByFilter])

  useEffect(() => {
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

    if (enquiryDateRange && enquiryDateRange.length === 2) {
      const [start, end] = enquiryDateRange
      filtered = filtered.filter((item) => {
        const enqDate = item.enquiry_date ? dayjs(item.enquiry_date) : null
        return enqDate && enqDate.isSameOrAfter(start, 'day') && enqDate.isSameOrBefore(end, 'day')
      })
    }

    if (orderDateRange && orderDateRange.length === 2) {
      const [start, end] = orderDateRange
      filtered = filtered.filter((item) => {
        const orderDate = item.order_date ? dayjs(item.order_date) : null
        return orderDate && orderDate.isSameOrAfter(start, 'day') && orderDate.isSameOrBefore(end, 'day')
      })
    }

    if (statusFilter === 'draftProposals') {
      filtered = filtered.filter((item) => item.draft === true || item.draft === 'true' || item.draft === 1)
    } else {
      filtered = filtered.filter((item) => !item.draft || item.draft === 'false' || item.draft === 0)

      if (statusFilter && statusFilter !== 'totalProjects') {
        if (statusFilter === 'proposals') {
          filtered = filtered.filter((item) => !item.project_number || item.project_number.trim() === '')
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
        } else if (statusFilter === 'convertedNo') {
          filtered = filtered.filter((item) => isProposalNotConverted(item.proposals_converted, item.if_not_reason))
        } else {
          filtered = filtered.filter((item) => {
            const status = (item.status || '').toString().trim()
            return status === statusFilter
          })
        }
      } else if (statusFilter === 'totalProjects') {
        filtered = filtered.filter((item) => item.project_number && item.project_number.trim() !== '')
      }
    }

    if (projectCodePrefix) {
      const searchLower = projectCodePrefix.toLowerCase()
      filtered = filtered.filter((item) => {
        const projectNumber = (item.project_number || '').toString().trim()
        return projectNumber.toLowerCase().startsWith(searchLower)
      })
    }

    if (projectNumberFilter) {
      const searchLower = projectNumberFilter.toLowerCase()
      filtered = filtered.filter((item) => {
        const projectNumber = (item.project_number || '').toString().trim()
        return projectNumber.toLowerCase().includes(searchLower)
      })
    }

    if (groupFilter) {
      const groupLower = groupFilter.toLowerCase().trim()
      filtered = filtered.filter(
        (item) => (item.group || '').toString().toLowerCase().trim() === groupLower
      )
    }

    if (quotationGivenByFilter) {
      const searchLower = quotationGivenByFilter.toLowerCase().trim()
      filtered = filtered.filter((item) => {
        const name1 = (item.quotation_given_by_name || '').toString().toLowerCase().trim()
        const name2 = (item.project_co_ordinator || '').toString().toLowerCase().trim()
        return name1 === searchLower || name2 === searchLower
      })
    }

    setFilteredData(filtered)
  }, [searchText, orderDateRange, enquiryDateRange, statusFilter, projectCodePrefix, projectNumberFilter, groupFilter, quotationGivenByFilter, tableData])

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      message.warning('No data to export')
      return
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proposals')
    XLSX.writeFile(
      workbook,
      `proposals_export_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`,
    )
    message.success('Excel file downloaded successfully')
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

  const parseEnquiryDate = (val) => {
    if (!val || val === '') return Number.MIN_SAFE_INTEGER
    let parsed = dayjs(val)
    if (parsed.isValid()) return parsed.valueOf()
    parsed = dayjs(val, 'DD-MM-YYYY', true)
    if (parsed.isValid()) return parsed.valueOf()
    parsed = dayjs(val, 'DD/MM/YYYY', true)
    if (parsed.isValid()) return parsed.valueOf()
    return Number.MIN_SAFE_INTEGER
  }

  const columns = useMemo(() => {
    const overdueDaysColumn = {
      key: 'overdue_days',
      dataIndex: 'overdue_days',
      title: 'Overdue Days',
      width: 140,
      render: (_, record) => {
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

    const ackColumn = {
      key: 'is_acknowledged',
      dataIndex: 'is_acknowledged',
      title: 'Acknowledgement',
      width: 160,
      render: (value) => {
        if (value === false || String(value).toLowerCase() === 'false') {
          return <Tag color="red" className="font-bold">Rejected</Tag>
        }
        return '-'
      },
    }

    if (statusFilter === 'proposals') {
      const baseCols = [
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
          sorter: (a, b) => parseEnquiryDate(a.enquiry_date) - parseEnquiryDate(b.enquiry_date),
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
      ]

      if (showUnacknowledgedOnly) {
        baseCols.push(ackColumn)
      }

      baseCols.push({
        key: 'actions',
        title: 'Actions',
        width: 120,
        render: (_, record) => (
          <Space size="small">
            <Button
              size="small"
              type="link"
              icon={<InfoCircleOutlined />}
              onClick={(e) => { e.stopPropagation(); openDetailModal(record) }}
              title="More Details"
            />
            {userRole === 'scientist' && (
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
            )}
          </Space>
        ),
      })

      return baseCols
    }

    const defaultCols = [
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
        render: (value) => (value && value.trim() !== '' ? value : 'Not Converted to Project'),
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
        render: (value, record) => (value && value.trim() !== '' ? value : record.quotation_given_by_name || '-'),
      },
    ]

    if (showUnacknowledgedOnly) {
      defaultCols.push(ackColumn)
    }

    defaultCols.push({
      key: 'actions',
      title: 'Actions',
      width: 150,
      render: (_, record) => {
        const isDraft = record.draft === true || statusFilter === 'draftProposals'
        return (
          <Space size="small">
            {isDraft ? (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleConvertDraftToProposal(record)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none text-xs rounded-lg px-2.5 py-1 shadow flex items-center gap-1"
              >
                Add to Proposals
              </Button>
            ) : (
              <>
                <Button
                  size="small"
                  type="link"
                  icon={<InfoCircleOutlined />}
                  onClick={(e) => { e.stopPropagation(); openDetailModal(record) }}
                  title="More Details"
                />
                {userRole === 'scientist' && (
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
                )}
              </>
            )}
          </Space>
        )
      },
    })

    return defaultCols
  }, [openDetailModal, openChatModal, statusFilter, currentUserName, currentUserGroup, isGhRole, userRole, showUnacknowledgedOnly])

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
                @keyframes blinkReasonBtn {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.45; }
                }
                .blink-reason-btn {
                  animation: blinkReasonBtn 1.1s ease-in-out infinite;
                }
              `}</style>
              <TopChatNotificationBar
                onOpenChat={(targetItem) => {
                  setSelectedNotificationTarget(targetItem)
                  setFloatingChatOpen(true)
                }}
              />

              {(() => {
                const handleStatusCardClick = (val) => {
                  setStatusFilter((prev) => (prev === val ? null : val))
                }

                const cards = [
                  {
                    key: null,
                    title: 'Total Proposals Submitted',
                    value: statistics.allCount,
                    bgClass: 'bg-gradient-to-br from-slate-500 to-slate-700',
                  },
                  {
                    key: 'proposals',
                    title: 'Pending',
                    value: statistics.totalProposals,
                    bgClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
                  },
                  {
                    key: 'totalProjects',
                    title: 'Converted to Projects',
                    value: statistics.totalProjects,
                    bgClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
                    extra: Object.keys(statistics.projectCodeBreakdown).length > 0 && (
                      <div className="mt-2 text-xs text-white/80 font-medium">
                        {Object.entries(statistics.projectCodeBreakdown)
                          .filter(([, count]) => count > 0)
                          .map(([code, count], idx, arr) => (
                            <span key={code}>
                              {code}: {count}
                              {idx < arr.length - 1 ? ' | ' : ''}
                            </span>
                          ))}
                      </div>
                    ),
                  },
                  {
                    key: 'technicallyCompleted',
                    title: 'Technically Completed',
                    value: statistics.technicallyCompleted,
                    bgClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
                  },
                  {
                    key: 'financiallyNotCompleted',
                    title: 'Financially Not Completed',
                    value: statistics.financiallyNotCompleted,
                    bgClass: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
                  },
                  {
                    key: 'financiallyCompleted',
                    title: 'Financially Completed',
                    value: statistics.financiallyCompleted,
                    bgClass: 'bg-gradient-to-br from-green-500 to-green-600',
                  },
                  {
                    key: 'pendingProjects',
                    title: 'Ongoing Projects',
                    value: statistics.pendingProjects,
                    bgClass: 'bg-gradient-to-br from-red-500 to-red-600',
                    extra: statistics.onHoldProjects > 0 && (
                      <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8, marginTop: '4px' }}>
                        On hold: {statistics.onHoldProjects}
                      </div>
                    ),
                  },
                ]

                return (
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-1">
                      {cards.map((card) => {
                        const isSelected = statusFilter === card.key
                        const isAnySelected = statusFilter !== null

                        return (
                          <div
                            key={card.key ?? 'all'}
                            onClick={() => handleStatusCardClick(card.key)}
                            style={{
                              borderRadius: '16px',
                              border: isSelected ? '4px solid #ffffff' : '4px solid transparent',
                              boxShadow: isSelected
                                ? '0 20px 25px -5px rgba(0,0,0,0.3), 0 0 15px rgba(255,255,255,0.6)'
                                : undefined,
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            className={`
                              relative cursor-pointer text-white p-5 select-none overflow-hidden ${card.bgClass}
                              transform box-border
                              ${
                                isSelected
                                  ? '-translate-y-2 opacity-100 z-10'
                                  : isAnySelected
                                  ? 'opacity-70 hover:opacity-100 hover:-translate-y-1 shadow-md'
                                  : 'opacity-100 hover:-translate-y-1 shadow-md hover:shadow-lg'
                              }
                            `}
                          >
                            <div className="text-white/90 text-xs font-semibold uppercase tracking-wider mb-1">
                              {card.title}
                            </div>
                            <div className="text-3xl font-extrabold text-white tracking-tight">
                              {card.value}
                            </div>
                            {card.extra}

                            {/* Animated Thick Bottom Indicator Bar (width: 0% -> 100%) */}
                            <div className="absolute bottom-0 left-0 right-0 h-[6px] bg-black/10">
                              <div
                                className="h-full bg-white transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                                style={{ width: isSelected ? '100%' : '0%' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <div className="flex flex-col gap-6 mt-6">
                {/* Search & Filters */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <Title level={4} className="!mb-0">Search & Filters</Title>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button onClick={() => {
                        setSearchText('')
                        setOrderDateRange(null)
                        setEnquiryDateRange(null)
                        setStatusFilter(null)
                        setProjectCodePrefix('')
                        setGroupFilter(undefined)
                        setQuotationGivenByFilter(undefined)
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <Input
                      placeholder="Search proposals..."
                      prefix={<SearchOutlined />}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                    />
                    {(userRole === 'ch' || userRole === 'centre head' || userRole === 'center head' || userRole === 'admin') && (
                      <Select
                        placeholder="Filter by Group"
                        value={groupFilter || undefined}
                        onChange={setGroupFilter}
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={groupOptions}
                        className="w-full"
                      />
                    )}
                    <Select
                      placeholder="Project Code"
                      value={projectCodePrefix || undefined}
                      onChange={setProjectCodePrefix}
                      allowClear
                      className="w-full"
                    >
                      {['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT'].map((code) => (
                        <Select.Option key={code} value={code}>
                          {code}
                        </Select.Option>
                      ))}
                    </Select>
                    {userRole !== 'scientist' && (
                      <Select
                        placeholder="Quotation Given By"
                        value={quotationGivenByFilter || undefined}
                        onChange={setQuotationGivenByFilter}
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={quotationGivenByOptions}
                        className="w-full"
                      />
                    )}
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
                      <Tooltip title="PPM MESSAGING">
                        <Badge count={unreadChatCount} overflowCount={99} offset={[-4, 4]}>
                          <Button
                            type="text"
                            size="large"
                            onClick={() => setFloatingChatOpen(prev => !prev)}
                            style={{ padding: '2px 6px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent', height: 'auto' }}
                            className="hover:bg-slate-100 transition-colors rounded-xl border-none shadow-none group py-1"
                          >
                            <img src={messagingImg} alt="PPM Chat" style={{ width: 42, height: 42, objectFit: 'contain' }} />
                            <span className="text-[10px] font-bold tracking-wide text-slate-700 group-hover:text-emerald-700 transition-colors -mt-0.5">
                              PPM Chat
                            </span>
                          </Button>
                        </Badge>
                      </Tooltip>
                      {statusFilter === 'proposals' && unacknowledgedCount > 0 && (
                        <Button
                          type={showUnacknowledgedOnly ? 'primary' : 'default'}
                          size="small"
                          danger
                          onClick={handleUnacknowledgedToggle}
                        >
                          ⚠️ Unacknowledged ({unacknowledgedCount})
                        </Button>
                      )}
                      {userRole === 'scientist' && statistics.convertedNo > 0 && (
                        <Button
                          danger
                          type="primary"
                          size="small"
                          onClick={openReasonPopup}
                          className="blink-reason-btn"
                        >
                          Reason Required ({statistics.convertedNo})
                        </Button>
                      )}
                      <Button
                        type={statusFilter === 'draftProposals' ? 'primary' : 'default'}
                        size="large"
                        onClick={() => setStatusFilter(statusFilter === 'draftProposals' ? null : 'draftProposals')}
                        className={
                          statusFilter === 'draftProposals'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold border-none shadow-md'
                            : 'border-amber-400 text-amber-700 hover:bg-amber-50 font-semibold'
                        }
                        icon={<EditOutlined />}
                      >
                        Draft Proposals {statistics.draftProposalsCount > 0 ? `(${statistics.draftProposalsCount})` : ''}
                      </Button>

                      {userRole === 'scientist' && (
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'addProposal',
                                icon: <PlusOutlined />,
                                label: 'Add Proposal Form',
                                onClick: openCoordinatorAddModal,
                              },
                              {
                                key: 'createDocument',
                                icon: <FileTextOutlined />,
                                label: 'Create Document',
                                onClick: () => {
                                  openCoordinatorAddModal()
                                  setProposalCreationMode('create_document')
                                },
                              },
                              {
                                key: 'draftProposal',
                                icon: <EditOutlined />,
                                label: 'Draft Proposal',
                                onClick: () => {
                                  openCoordinatorAddModal()
                                  setProposalCreationMode('draft')
                                },
                              },
                            ],
                          }}
                          trigger={['click']}
                        >
                          <Button
                            type="primary"
                            size="large"
                            icon={<PlusOutlined />}
                            className="bg-gradient-to-r from-green-500 to-green-600 border-none shadow-md hover:shadow-lg"
                          >
                            Add Proposal
                          </Button>
                        </Dropdown>
                      )}
                    </div>
                  </div>

                  {statusFilter === 'draftProposals' && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <EditOutlined className="text-amber-600 text-xl" />
                        <div>
                          <span className="font-bold text-amber-900 text-sm">Draft Proposals Table</span>
                          <p className="text-xs text-amber-700 mt-0.5">Showing saved draft proposals containing Quote Description & ID. Click <strong>Edit</strong> on any row to fill missing details and finalize the proposal.</p>
                        </div>
                      </div>
                      <Button size="small" onClick={() => setStatusFilter(null)} className="text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                        View All Proposals
                      </Button>
                    </div>
                  )}

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
                    rowClassName={(record) => {
                      const isRejected = record.is_acknowledged === false || String(record.is_acknowledged).toLowerCase() === 'false'
                      if (isRejected) {
                        return '!bg-red-100/90 font-semibold'
                      }
                      if (record.status === 'On Hold') {
                        return '!bg-orange-50'
                      }
                      return ''
                    }}
                    onRow={(record) => {
                      const isRejected = record.is_acknowledged === false || String(record.is_acknowledged).toLowerCase() === 'false'
                      return {
                        onClick: () => openDetailModal(record),
                        style: {
                          cursor: 'pointer',
                          backgroundColor: isRejected
                            ? '#fee2e2'
                            : record.status === 'On Hold'
                              ? '#fff2e8'
                              : 'transparent',
                        },
                      }
                    }}
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
                    {selectedRecord?.make_in_india && (
                      <Descriptions.Item label="Make In India" span={2}>{selectedRecord.make_in_india}</Descriptions.Item>
                    )}
                    {selectedRecord?.tender_images && (
                      <Descriptions.Item label="Tender Images" span={2}>
                        {(() => {
                          let urls = []
                          try {
                            urls = Array.isArray(selectedRecord.tender_images) ? selectedRecord.tender_images : JSON.parse(selectedRecord.tender_images)
                          } catch (e) {
                            urls = String(selectedRecord.tender_images || '').split(',').map((s) => s.trim()).filter(Boolean)
                          }
                          if (!Array.isArray(urls) || !urls.length) return '-'
                          return (
                            <Space wrap>
                              {urls.map((url, idx) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={url}
                                    alt={`Tender Image ${idx + 1}`}
                                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                                  />
                                </a>
                              ))}
                            </Space>
                          )
                        })()}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                <Card title="Acknowledgement" size="small" className={selectedRecord?.is_acknowledged === false || String(selectedRecord?.is_acknowledged).toLowerCase() === 'false' ? 'bg-red-50 border-red-200' : 'bg-blue-50'}>
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Is Acknowledged">
                      {selectedRecord?.is_acknowledged === true || String(selectedRecord?.is_acknowledged).toLowerCase() === 'true' ? (
                        <Tag color="green">Acknowledged</Tag>
                      ) : selectedRecord?.is_acknowledged === false || String(selectedRecord?.is_acknowledged).toLowerCase() === 'false' ? (
                        <Tag color="red" className="font-bold">Rejected</Tag>
                      ) : (
                        <Tag color="orange">Pending (Unacknowledged)</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            ) : (
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

                <Card title="Acknowledgement" size="small" className={selectedRecord?.is_acknowledged === false || String(selectedRecord?.is_acknowledged).toLowerCase() === 'false' ? 'bg-red-50 border-red-200' : 'bg-blue-50'}>
                  <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Is Acknowledged">
                      {selectedRecord?.is_acknowledged === true || String(selectedRecord?.is_acknowledged).toLowerCase() === 'true' ? (
                        <Tag color="green">Acknowledged</Tag>
                      ) : selectedRecord?.is_acknowledged === false || String(selectedRecord?.is_acknowledged).toLowerCase() === 'false' ? (
                        <Tag color="red" className="font-bold">Rejected</Tag>
                      ) : (
                        <Tag color="orange">Pending (Unacknowledged)</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            )}

            <Card
              title="Enquiry & Proposal Documents"
              size="small"
              className="bg-gray-50"
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => openUploadModalForProject(selectedRecord?.id)}
                >
                  Add Document
                </Button>
              }
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
                    width: 150,
                    render: (value) => (value ? dayjs(value).format(DISPLAY_DATE_FORMAT + ' HH:mm') : '-'),
                  },
                  {
                    title: 'Attachments',
                    key: 'attachments',
                    width: 200,
                    render: (_, record) => {
                      let atts = record?.attachment || record?.attachments || []
                      if (typeof atts === 'string') {
                        try {
                          atts = JSON.parse(atts)
                        } catch {
                          atts = [atts]
                        }
                      }
                      if (!Array.isArray(atts)) atts = atts ? [atts] : []
                      const list = atts.filter((url) => url && typeof url === 'string')
                      if (!list.length) return <span className="text-gray-400 text-xs">-</span>
                      return (
                        <div className="flex flex-wrap gap-1">
                          {list.map((url, idx) => {
                            let fileName = `Attachment ${idx + 1}`
                            try {
                              const parts = url.split('/')
                              const rawName = parts[parts.length - 1].split('?')[0]
                              if (rawName) fileName = decodeURIComponent(rawName)
                            } catch (e) { }
                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded text-xs transition-colors"
                                title={fileName}
                              >
                                <PaperClipOutlined className="text-blue-500 text-xs" />
                                <span className="max-w-[120px] truncate">{fileName}</span>
                              </a>
                            )
                          })}
                        </div>
                      )
                    },
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
          <Button
            key="upload"
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => openUploadModalForProject(docsProjectId || selectedRecord?.id)}
          >
            Add Document
          </Button>,
          <Button key="close" onClick={() => setDocsModalVisible(false)}>Close</Button>,
        ]}
        width={900}
      >
        <Card
          title="Enquiry & Proposal Documents"
          size="small"
          className="bg-gray-50"
          extra={
            <Button
              type="primary"
              size="small"
              icon={<UploadOutlined />}
              onClick={() => openUploadModalForProject(docsProjectId || selectedRecord?.id)}
            >
              Add Document
            </Button>
          }
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
                width: 150,
                render: (value) => (value ? dayjs(value).format(DISPLAY_DATE_FORMAT + ' HH:mm') : '-'),
              },
              {
                title: 'Attachments',
                key: 'attachments',
                width: 200,
                render: (_, record) => {
                  let atts = record?.attachment || record?.attachments || []
                  if (typeof atts === 'string') {
                    try {
                      atts = JSON.parse(atts)
                    } catch {
                      atts = [atts]
                    }
                  }
                  if (!Array.isArray(atts)) atts = atts ? [atts] : []
                  const list = atts.filter((url) => url && typeof url === 'string')
                  if (!list.length) return <span className="text-gray-400 text-xs">-</span>
                  return (
                    <div className="flex flex-wrap gap-1">
                      {list.map((url, idx) => {
                        let fileName = `Attachment ${idx + 1}`
                        try {
                          const parts = url.split('/')
                          const rawName = parts[parts.length - 1].split('?')[0]
                          if (rawName) fileName = decodeURIComponent(rawName)
                        } catch (e) { }
                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded text-xs transition-colors"
                            title={fileName}
                          >
                            <PaperClipOutlined className="text-blue-500 text-xs" />
                            <span className="max-w-[120px] truncate">{fileName}</span>
                          </a>
                        )
                      })}
                    </div>
                  )
                },
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
        </Card>
      </Modal>

      {/* Document Viewer Modal */}
      {viewDocumentUrl && (
        <Modal
          title="Document Viewer"
          open={Boolean(viewDocumentUrl)}
          onCancel={() => {
            setViewDocumentUrl(null)
            setExcelRendererData(null)
            setWordDocumentContent(null)
          }}
          footer={null}
          width="80%"
        >
          <div style={{ height: '70vh', overflow: 'auto' }}>
            {excelRendererLoading || wordDocumentLoading ? (
              <Spin spinning size="large" />
            ) : excelRendererData ? (
              <div>
                <h4>Excel Viewer</h4>
                <Table
                  dataSource={excelRendererData.rows?.slice(1) || []}
                  columns={(excelRendererData.rows?.[0] || []).map((col, idx) => ({
                    title: col || `Col ${idx + 1}`,
                    dataIndex: idx,
                    key: idx,
                  }))}
                  pagination={false}
                />
              </div>
            ) : wordDocumentContent ? (
              <div dangerouslySetInnerHTML={{ __html: wordDocumentContent }} />
            ) : (
              <iframe
                src={viewDocumentUrl}
                title="Document View"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            )}
          </div>
        </Modal>
      )}


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

      {/* Add Proposal Modal (Coordinator) */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <span className="text-lg font-bold text-slate-900">
              {proposalCreationMode === 'selection'
                ? convertingDraftRecord
                  ? `Add Draft Proposal #${convertingDraftRecord.id} to Proposals`
                  : 'Add Proposal'
                : proposalCreationMode === 'draft'
                  ? 'Create Draft Proposal'
                  : proposalCreationMode === 'create_document'
                    ? 'Create Document'
                    : proposalCreationMode === 'iso_project_proposal'
                      ? 'ISO Project Proposal (CMTI-QMS-009)'
                      : proposalCreationMode === 'upload_review'
                        ? 'Add Proposal - Review Extracted Document'
                        : 'Add Proposal (Manual Entry)'}
            </span>
            {proposalCreationMode !== 'selection' && (
              <Button
                type="link"
                size="small"
                onClick={() => setProposalCreationMode('selection')}
                className="text-xs text-blue-600 font-semibold"
              >
                ← Change Mode
              </Button>
            )}
          </div>
        }
        open={coordinatorModalOpen}
        onCancel={closeCoordinatorModal}
        width={proposalCreationMode === 'create_document' || proposalCreationMode === 'iso_project_proposal' ? 1300 : proposalCreationMode === 'draft' ? 750 : 1100}
        maskClosable={false}
        footer={
          proposalCreationMode === 'selection' || proposalCreationMode === 'draft'
            ? [
              <Button key="cancel" onClick={closeCoordinatorModal}>
                Cancel
              </Button>,
            ]
            : proposalCreationMode === 'create_document' || proposalCreationMode === 'iso_project_proposal'
              ? [
                <Button
                  key="back"
                  onClick={() => setProposalCreationMode('selection')}
                >
                  ← Back to Selection
                </Button>,
                <Button key="cancel" onClick={closeCoordinatorModal}>
                  Close
                </Button>,
              ]
              : [
                <Button
                  key="back"
                  onClick={() => setProposalCreationMode('selection')}
                >
                  Back
                </Button>,
                <Button key="cancel" onClick={closeCoordinatorModal}>
                  Cancel
                </Button>,
                <Button
                  key="submit"
                  type="primary"
                  loading={coordinatorSubmitLoading}
                  onClick={() => coordinatorForm.submit()}
                  className="bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  Submit Proposal
                </Button>,
              ]
        }
      >
        {proposalCreationMode === 'selection' ? (
          <div className="py-6 px-2 space-y-6">
            {convertingDraftRecord ? (
              <div className="text-center max-w-lg mx-auto mb-6">
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-2 border border-amber-300">
                  Draft Proposal #{convertingDraftRecord.id}
                </span>
                <h3 className="text-xl font-bold text-slate-800">
                  Choose Method to Complete & Add to Proposals
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select how you would like to complete draft: "{convertingDraftRecord.quote_description || 'Draft'}"
                </p>
              </div>
            ) : (
              <div className="text-center max-w-lg mx-auto mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  Choose Proposal Creation Method
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Select how you would like to create this new proposal:
                </p>
              </div>
            )}

            <Row gutter={[16, 16]} justify="center">
              {/* Option 1: Manual Entry */}
              <Col xs={24} sm={12} md={convertingDraftRecord ? 8 : 6}>
                <Card
                  hoverable
                  onClick={() => setProposalCreationMode('manual')}
                  className="h-full border-2 border-slate-200 hover:border-blue-500 rounded-2xl transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer"
                  styles={{ body: { padding: '20px', textAlign: 'center' } }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <FormOutlined className="text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    Manual Entry
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                    Fill in all proposal details manually using standard inputs.
                  </p>
                  <Button
                    type="primary"
                    block
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setProposalCreationMode('manual')
                    }}
                    className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700"
                  >
                    {convertingDraftRecord ? 'Complete Manually' : 'Create Manually'}
                  </Button>
                </Card>
              </Col>

              {/* Option 2: Create Document */}
              <Col xs={24} sm={12} md={convertingDraftRecord ? 8 : 6}>
                <Card
                  hoverable
                  onClick={() => setProposalCreationMode('create_document')}
                  className="h-full border-2 border-slate-200 hover:border-purple-500 rounded-2xl transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer"
                  styles={{ body: { padding: '20px', textAlign: 'center' } }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <FileTextOutlined className="text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    Create Document
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                    Generate proposal document (.docx) with live preview & auto extraction.
                  </p>
                  <Button
                    type="primary"
                    block
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setProposalCreationMode('create_document')
                    }}
                    className="rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 border-none"
                  >
                    Create Document
                  </Button>
                </Card>
              </Col>

              {/* Option 3: ISO Project Proposal */}
              <Col xs={24} sm={12} md={convertingDraftRecord ? 8 : 6}>
                <Card
                  hoverable
                  onClick={() => setProposalCreationMode('iso_project_proposal')}
                  className="h-full border-2 border-slate-200 hover:border-emerald-500 rounded-2xl transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer"
                  styles={{ body: { padding: '20px', textAlign: 'center' } }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <FileProtectOutlined className="text-xl" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    ISO Project Proposal
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                    Fill official ISO CMTI Project Proposal format (CMTI-QMS-009) with Gantt.
                  </p>
                  <Button
                    type="primary"
                    block
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setProposalCreationMode('iso_project_proposal')
                    }}
                    className="rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 border-none"
                  >
                    ISO Proposal Form
                  </Button>
                </Card>
              </Col>

              {/* Option 4: Draft Proposal (only when NOT converting existing draft) */}
              {!convertingDraftRecord && (
                <Col xs={24} sm={12} md={6}>
                  <Card
                    hoverable
                    onClick={() => setProposalCreationMode('draft')}
                    className="h-full border-2 border-slate-200 hover:border-amber-500 rounded-2xl transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer"
                    styles={{ body: { padding: '20px', textAlign: 'center' } }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <EditOutlined className="text-xl" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">
                      Draft Proposal
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-5 leading-relaxed">
                      Quickly save a draft proposal with only quote description. Sets draft = true.
                    </p>
                    <Button
                      type="primary"
                      block
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setProposalCreationMode('draft')
                      }}
                      className="rounded-xl font-semibold bg-amber-600 hover:bg-amber-700 border-none"
                    >
                      Create Draft
                    </Button>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        ) : proposalCreationMode === 'draft' ? (
          <div className="py-4 px-2 space-y-5 max-w-xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <EditOutlined className="text-amber-600 text-xl mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Draft Proposal Mode</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Enter only the <strong>Quote Description</strong> to save a draft proposal. The system will auto-assign a Proposal ID and mark <code>draft = true</code>.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Quote Description <span className="text-red-500">*</span>
              </label>
              <Input.TextArea
                rows={5}
                value={draftQuoteDescription}
                onChange={(e) => setDraftQuoteDescription(e.target.value)}
                placeholder="Enter quotation description or brief details..."
                className="rounded-xl p-3 text-sm border-slate-300 focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => setProposalCreationMode('selection')} className="rounded-xl">
                ← Back
              </Button>
              <Button
                type="primary"
                loading={coordinatorSubmitLoading}
                onClick={() => handleSaveDraftProposal()}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 border-none font-semibold px-6"
              >
                Save Draft Proposal
              </Button>
            </div>
          </div>
        ) : proposalCreationMode === 'create_document' ? (
          <div className="py-2">
            <DocumentGenerate
              onAddToProposals={(file, extracted, attachments = []) => {
                setUploadedDocName(file.name)
                setUploadedDocxFile(file)
                if (attachments && attachments.length > 0) {
                  setProposalAttachments(attachments)
                }

                const updatedValues = {}
                const dateVal = extracted.enquiry_date || extracted.quote_date
                if (dateVal) {
                  const dateStr = String(dateVal).trim()
                  let parsedDate = dayjs(dateStr, ['DD/MM/YYYY', 'DD.MM.YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD', 'MM/DD/YYYY'])
                  if (!parsedDate.isValid()) {
                    parsedDate = dayjs(dateStr)
                  }
                  if (parsedDate.isValid()) {
                    updatedValues.enquiry_date = parsedDate
                    updatedValues.quote_date = parsedDate
                    updatedValues.revised_negotiated_quote_date = parsedDate
                  }
                }
                if (extracted.customer_name) updatedValues.customer_name = extracted.customer_name
                if (extracted.customer_type) {
                  updatedValues.customer_type = extracted.customer_type
                } else if (extracted.customer_name) {
                  const matchCust = allCustomerSuggestions.find(
                    (c) => c.name && c.name.trim().toLowerCase() === extracted.customer_name.trim().toLowerCase()
                  )
                  if (matchCust && matchCust.customer_type) {
                    updatedValues.customer_type = matchCust.customer_type
                  }
                }
                if (extracted.address) updatedValues.address = extracted.address
                if (extracted.email) updatedValues.email = extracted.email
                if (extracted.phone_no) updatedValues.phone_no = extracted.phone_no
                if (extracted.alternate_contact_details && extracted.alternate_contact_details !== extracted.kind_attention) {
          updatedValues.alternate_contact_details = extracted.alternate_contact_details
        }
                const emailRefVal2 = extracted.email_reference || extracted.email || ''
                if (emailRefVal2) updatedValues.email_reference = emailRefVal2
                if (extracted.quote_reference) updatedValues.quote_reference = extracted.quote_reference
                if (extracted.quote_description) updatedValues.quote_description = extracted.quote_description
                if (extracted.quote_amount) updatedValues.quote_amount = extracted.quote_amount
                if (extracted.center) {
                  updatedValues.center = extracted.center
                  updatedValues.quotation_given_by_department = extracted.center
                }

                if (currentUserName) {
                  updatedValues.quotation_given_by_name = currentUserName
                  if (!updatedValues.center) updatedValues.center = currentUserCenter || ''
                  if (!updatedValues.quotation_given_by_department) updatedValues.quotation_given_by_department = currentUserCenter ? currentUserCenter.toUpperCase() : ''
                  updatedValues.group = currentUserGroup || ''
                }

                if (!updatedValues.proposal_status) {
                  updatedValues.proposal_status = ['Submitted']
                }

                coordinatorForm.setFieldsValue(updatedValues)
                setProposalCreationMode('upload_review')
              }}
            />
          </div>
        ) : proposalCreationMode === 'iso_project_proposal' ? (
          <div className="py-2">
            <ProjectProposal
              proposalId={convertingDraftRecord ? convertingDraftRecord.id : null}
              existingRecord={convertingDraftRecord}
              onBack={() => {
                fetchProposals()
                closeCoordinatorModal()
              }}
              onSuccess={() => {
                fetchProposals()
                closeCoordinatorModal()
              }}
            />
          </div>
        ) : (
          <div>
            {proposalCreationMode === 'upload_review' && (
              <div className="mb-4 p-4 rounded-xl border border-green-200 bg-green-50/80 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined className="text-green-600 text-base" />
                  <span className="font-bold text-slate-800 text-sm">
                    Document Uploaded & Extracted
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  Successfully parsed extracted values from <strong>"{uploadedDocName}"</strong>. Please verify and edit any fields below before saving.
                </div>

                {/* Attachment Chips matching exact design in screenshot */}
                <div className="pt-2 border-t border-green-200/60 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-1">
                    <PaperClipOutlined className="text-slate-500 text-sm" />
                    <span>Attached Documents:</span>
                  </div>

                  {uploadedDocName && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium shadow-xs text-blue-600">
                      <PaperClipOutlined className="text-slate-400 text-xs" />
                      <span className="max-w-[220px] truncate" title={uploadedDocName}>
                        {uploadedDocName}
                      </span>
                    </div>
                  )}

                  {proposalAttachments && proposalAttachments.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium shadow-xs text-blue-600"
                    >
                      <PaperClipOutlined className="text-slate-400 text-xs" />
                      <span className="max-w-[220px] truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span
                        onClick={() => setProposalAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-500 cursor-pointer ml-1 font-bold text-xs"
                      >
                        ✕
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Form
              form={coordinatorForm}
              layout="vertical"
              onFinish={handleCoordinatorSubmit}
            >
              <Row gutter={[16, 16]}>
                {COORDINATOR_ADD_FIELDS.filter((fieldName) => {
                  if (userRole === 'scientist') {
                    return ![
                      'quotation_given_by_department',
                      'center',
                      'group',
                    ].includes(fieldName)
                  }
                  return true
                }).map((fieldName) => {
                  const field = ALL_FIELDS.find((f) => f.name === fieldName)
                  if (!field) return null

                  const isDate = [
                    'enquiry_date',
                    'quote_date',
                    'revised_negotiated_quote_date',
                  ].includes(fieldName)
                  const isTextArea = field.input === 'textarea'
                  const isCustomerType = fieldName === 'customer_type'
                  const isRequestType = fieldName === 'request_type'
                  const isProposalStatus = fieldName === 'proposal_status'
                  const isReadOnlyName = fieldName === 'quotation_given_by_name'
                  const isReadOnlyDept =
                    fieldName === 'quotation_given_by_department'
                  const isReadOnlyCenter = fieldName === 'center'
                  const isReadOnlyGroup = fieldName === 'group'
                  const isCustomerName = fieldName === 'customer_name'
                  const isAddressField = fieldName === 'address'
                  const isEmailField = fieldName === 'email'
                  const isPhoneField = fieldName === 'phone_no'

                  if (isRequestType) {
                    return (
                      <Fragment key={fieldName}>
                        <Col span={12}>
                          <Form.Item
                            name={fieldName}
                            label={field.label}
                            rules={[{ required: true, message: `Please enter ${field.label}` }]}
                          >
                            <Select placeholder="Select Request Type">
                              {REQUEST_TYPE_OPTIONS.map((opt) => (
                                <Select.Option key={opt} value={opt}>
                                  {opt}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>

                        {isCoordTenderSelected && (
                          <Col span={24}>
                            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-4 my-2">
                              <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                                <Tag color="blue">Tender Details</Tag>
                                <span>Make In India & Tender Image Uploads</span>
                              </div>

                              <Form.Item
                                name="make_in_india"
                                label="Make In India"
                                className="mb-3"
                              >
                                <TextArea rows={2} placeholder="Enter Make In India details..." />
                              </Form.Item>

                              <Form.Item
                                label="Tender Images (Upload Multiple Images)"
                                className="mb-0"
                              >
                                <Upload
                                  listType="picture-card"
                                  multiple
                                  accept="image/*"
                                  fileList={tenderFileList}
                                  beforeUpload={() => false}
                                  onChange={({ fileList }) => setTenderFileList(fileList)}
                                  onPreview={(file) => {
                                    const src = file.url || file.thumbUrl || (file.originFileObj ? URL.createObjectURL(file.originFileObj) : '')
                                    if (src) window.open(src, '_blank')
                                  }}
                                >
                                  <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Upload Images</div>
                                  </div>
                                </Upload>
                              </Form.Item>
                            </div>
                          </Col>
                        )}
                      </Fragment>
                    )
                  }

                  const isOptional = ['alternate_contact_details', 'email_reference', 'make_in_india'].includes(fieldName)

                  return (
                    <Col span={12} key={fieldName}>
                      <Form.Item
                        name={fieldName}
                        label={field.label}
                        rules={
                          isOptional
                            ? []
                            : [
                                {
                                  required: true,
                                  message: `Please enter ${field.label}`,
                                },
                              ]
                        }
                      >
                        {isDate ? (
                          <DatePicker
                            style={{ width: '100%' }}
                            format={DISPLAY_DATE_FORMAT}
                          />
                        ) : isCustomerType ? (
                          <Select placeholder="Select Customer Type">
                            {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                              <Select.Option key={opt} value={opt}>
                                {opt}
                              </Select.Option>
                            ))}
                          </Select>
                        ) : isProposalStatus ? (
                          <Select
                            mode="tags"
                            showSearch
                            allowClear
                            placeholder="Select or type Proposal Status"
                          >
                            <Select.Option value="Submitted">
                              Submitted
                            </Select.Option>
                            <Select.Option value="Accepted">
                              Accepted
                            </Select.Option>
                            <Select.Option value="Rejected">
                              Rejected
                            </Select.Option>
                            <Select.Option value="Awaiting">
                              Awaiting
                            </Select.Option>
                          </Select>
                        ) : isReadOnlyName ||
                          isReadOnlyDept ||
                          isReadOnlyCenter ||
                          isReadOnlyGroup ? (
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
                            onSelect={(value) =>
                              coordinatorForm.setFieldsValue({ address: value })
                            }
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
          </div>
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
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length) {
                      setEnquiryAttachments((prev) => [...prev, ...files])
                    }
                    e.target.value = ''
                  }}
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
                      onClose={() => setEnquiryAttachments((prev) => prev.filter((_, i) => i !== index))}
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
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length) {
                      setProposalAttachments((prev) => [...prev, ...files])
                    }
                    e.target.value = ''
                  }}
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
                      onClose={() => setProposalAttachments((prev) => prev.filter((_, i) => i !== index))}
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

      <FloatingChatsWidget
        open={floatingChatOpen}
        onClose={() => {
          setFloatingChatOpen(false)
          setSelectedNotificationTarget(null)
        }}
        onUnreadCountChange={setUnreadChatCount}
        targetChatItem={selectedNotificationTarget}
      />
    </>
  )
}
