import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  CalendarOutlined,
  FullscreenOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  DollarCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  AutoComplete,
  Button,
  Descriptions,
  Divider,
  Dropdown,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
  DatePicker,
  Select,
  Segmented,
  Card,
  Row,
  Col,
  Statistic,
  Switch,
} from 'antd'
import {
  ResponsiveContainer,
  BarChart as ReChartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReChartsTooltip,
  Legend,
  AreaChart as ReChartsAreaChart,
  Area,
  LineChart as ReChartsLineChart,
  Line,
  PieChart as ReChartsPieChart,
  Pie,
  Cell,
  Treemap as ReChartsTreemap
} from 'recharts'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import '../App.css'
import { API_BASE_URL } from '../config/api.js'
import { DISPLAY_DATE_FORMAT, formatDate, formatIndianNumber } from '../config/date.js'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

// Helper function to format value in Crores
const formatInCrore = (value) => {
  const num = Number(value) || 0
  const crore = num / 1e7
  if (!Number.isFinite(crore)) return '0 cr'
  return `${crore.toFixed(crore % 1 === 0 ? 0 : 2)} cr`
}

const COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#22c55e', // green-500
  '#ef4444', // red-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
]



const CustomTooltip = ({ active, payload, isAmount }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value
    const total = data.totalVal || 1
    const pct = total > 0 ? (value / total) * 100 : 0
    const displayValue = isAmount ? formatInCrore(value) : value

    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-sm">
        <p className="font-semibold text-sm max-w-xs break-words">{data.fullName}</p>
        <p className="text-xs text-slate-300 mt-1">
          Value: <span className="font-bold text-white">{displayValue}</span>
        </p>
        <p className="text-xs text-slate-300">
          Percentage: <span className="font-bold text-white">{pct.toFixed(1)}%</span>
        </p>
      </div>
    )
  }
  return null
}

const InteractiveChart = ({ data, chartType, chartMetric, onElementClick }) => {
  const isAmount = chartMetric === 'amount'
  if (!data || !data.labels || !data.labels.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        No data available for chart
      </div>
    )
  }

  const totalVal = data.values.reduce((acc, v) => acc + Number(v || 0), 0)
  const chartItems = data.labels.map((label, idx) => ({
    name: getFirstTwoWords(label),
    fullName: label,
    value: Number(data.values[idx] ?? 0),
    totalVal,
  }))

  if (chartType === 'treemap') {
    const treemapData = chartItems.map((item, index) => ({
      ...item,
      size: item.value,
      index,
    })).filter((item) => item.size > 0)

    const CustomizedContent = (props) => {
      const { root, depth, x, y, width, height, index, name, value } = props
      if (depth !== 1) return null

      const pct = totalVal > 0 ? (value / totalVal) * 100 : 0
      const labelValue = isAmount ? formatInCrore(value) : value

      return (
        <g
          onClick={() => {
            const item = treemapData[index]
            if (item && onElementClick) {
              onElementClick(item.fullName)
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            style={{
              fill: COLORS[index % COLORS.length],
              stroke: '#fff',
              strokeWidth: 1,
            }}
          />
          {width > 60 && height > 30 && (
            <text
              x={x + width / 2}
              y={y + height / 2 - 4}
              textAnchor="middle"
              fill="#fff"
              fontSize={11}
              fontWeight="bold"
            >
              {name}
            </text>
          )}
          {width > 90 && height > 45 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#fff"
              fontSize={10}
              fontWeight="500"
            >
              {`${labelValue} (${pct.toFixed(1)}%)`}
            </text>
          )}
        </g>
      )
    }

    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ReChartsTreemap
          data={treemapData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="#8884d8"
          content={<CustomizedContent />}
        >
          <ReChartsTooltip content={<CustomTooltip isAmount={isAmount} />} />
        </ReChartsTreemap>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'pie' || chartType === 'donut') {
    const pieData = chartItems.filter((item) => item.value > 0)
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ReChartsPieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={chartType === 'donut' ? '60%' : '0%'}
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            onClick={(item) => {
              if (item && item.value > 0 && onElementClick) {
                onElementClick(item.fullName || item.name)
              }
            }}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={true}
          >
            {pieData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                cursor={entry.value > 0 ? 'pointer' : 'default'}
              />
            ))}
          </Pie>
          <ReChartsTooltip content={<CustomTooltip isAmount={isAmount} />} />
          <Legend verticalAlign="bottom" height={36} />
        </ReChartsPieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line' || chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {chartType === 'area' ? (
          <ReChartsAreaChart
            data={chartItems}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length) {
                const clickedData = state.activePayload[0].payload
                if (clickedData && clickedData.value > 0 && onElementClick) {
                  onElementClick(clickedData.fullName)
                }
              }
            }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" tickFormatter={(v) => (isAmount ? formatInCrore(v) : v)} />
            <ReChartsTooltip content={<CustomTooltip isAmount={isAmount} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={(props) => {
                const { payload } = props
                const hasData = payload && payload.value > 0
                return <circle {...props} cursor={hasData ? 'pointer' : 'default'} />
              }}
            />
          </ReChartsAreaChart>
        ) : (
          <ReChartsLineChart
            data={chartItems}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length) {
                const clickedData = state.activePayload[0].payload
                if (clickedData && clickedData.value > 0 && onElementClick) {
                  onElementClick(clickedData.fullName)
                }
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" tickFormatter={(v) => (isAmount ? formatInCrore(v) : v)} />
            <ReChartsTooltip content={<CustomTooltip isAmount={isAmount} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={3}
              activeDot={(props) => {
                const { payload } = props
                const hasData = payload && payload.value > 0
                return <circle {...props} cursor={hasData ? 'pointer' : 'default'} />
              }}
            />
          </ReChartsLineChart>
        )}
      </ResponsiveContainer>
    )
  }

  // Bar, Funnel, Box
  const isHorizontal = chartType === 'funnel'
  const isBox = chartType === 'box'
  const barData = [...chartItems]
  if (isHorizontal) {
    barData.sort((a, b) => b.value - a.value)
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <ReChartsBarChart
        data={barData}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis type="number" stroke="#64748b" tickFormatter={(v) => (isAmount ? formatInCrore(v) : v)} />
            <YAxis type="category" dataKey="name" stroke="#64748b" width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" tickFormatter={(v) => (isAmount ? formatInCrore(v) : v)} />
          </>
        )}
        <ReChartsTooltip content={<CustomTooltip isAmount={isAmount} />} />
        <Bar
          dataKey="value"
          radius={isBox ? [8, 8, 0, 0] : [4, 4, 0, 0]}
          maxBarSize={isBox ? 50 : 35}
          onClick={(item) => {
            if (item && item.value > 0 && onElementClick) {
              onElementClick(item.fullName)
            }
          }}
        >
          {barData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              cursor={entry.value > 0 ? 'pointer' : 'default'}
            />
          ))}
        </Bar>
      </ReChartsBarChart>
    </ResponsiveContainer>
  )
}

// Function to extract project code from project number
const getProjectCode = (projectNumber) => {
  if (!projectNumber || typeof projectNumber !== 'string') return ''
  const trimmed = projectNumber.trim()
  // Extract prefix before the first digit or dash, case-insensitive
  const match = trimmed.match(/^([A-Z]+)(?:-|\d|$)/i)
  return match ? match[1].toUpperCase() : trimmed
}

// Helper function to get first two words of a project name
const getFirstTwoWords = (text) => {
  if (!text || typeof text !== 'string') return text || ''
  const words = text.trim().split(/\s+/)
  return words.slice(0, 2).join(' ')
}

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
  { name: 'small_value_project', label: 'Small Value Project', width: 150 },
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

function Analytics() {
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
  const [smallValueProjectFilter, setSmallValueProjectFilter] = useState(null)
  const [selectedDateField, setSelectedDateField] = useState('enquiry_date')
  const [dateRange, setDateRange] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const graphCardRef = useRef(null)
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement
      const nowFullscreen = Boolean(graphCardRef.current && fsEl === graphCardRef.current)
      setIsGraphFullscreen(nowFullscreen)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const handleToggleGraphFullscreen = async () => {
    try {
      const el = graphCardRef.current
      if (!el) return
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch (e) {
      console.error('Fullscreen error:', e)
      message.error('Unable to open full screen in this browser.')
    }
  }

  const handleDownloadGraph = () => {
    try {
      const container = graphCardRef.current
      if (!container) return

      const svgEl = container.querySelector('svg')
      if (!svgEl) {
        message.warning('Chart is not ready yet.')
        return
      }

      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgEl)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const URL = window.URL || window.webkitURL || window
      const blobURL = URL.createObjectURL(svgBlob)

      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = svgEl.clientWidth || svgEl.getBoundingClientRect().width || 800
        canvas.height = svgEl.clientHeight || svgEl.getBoundingClientRect().height || 420
        const context = canvas.getContext('2d')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0)

        const png = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = png
        a.download = `director-analytics_${chartType || 'chart'}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(blobURL)
      }
      image.src = blobURL
    } catch (e) {
      console.error('Download error:', e)
      message.error('Unable to download chart image.')
    }
  }
  const [drillLevel, setDrillLevel] = useState('top')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCenter, setSelectedCenter] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedProjectCode, setSelectedProjectCode] = useState('')
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [notConvertedModalVisible, setNotConvertedModalVisible] = useState(false)
  const [chartType, setChartType] = useState('bar')
  const [chartMetric, setChartMetric] = useState('count')
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(null)
  const [trendCategory, setTrendCategory] = useState(null)
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

      // Dynamically fetch proposals based on logged-in user role
      let userRole = 'admin'
      let userName = ''
      let userCenter = ''
      try {
        const rawUser = window.localStorage.getItem('ppm_user')
        if (rawUser) {
          const parsed = JSON.parse(rawUser)
          userRole = (parsed?.role || 'admin').toLowerCase().trim()
          userName = parsed?.name || ''
          userCenter = (parsed?.center || '').trim()
        }
      } catch (e) { }

      let userId = ''
      try {
        const rawUser2 = window.localStorage.getItem('ppm_user')
        if (rawUser2) userId = JSON.parse(rawUser2)?.user_id || ''
      } catch (e) { }

      let baseUrl = `${API_BASE_URL}/proposals/`
      if (userRole === 'gh' || userRole === 'group head') {
        // Same approach as the working Proposals page: use the group stored
        // at login directly, skip the by-name lookup entirely (name lookups
        // can resolve to the wrong user if names collide).
        let userGroup = ''
        try {
          const rawUser2 = window.localStorage.getItem('ppm_user')
          if (rawUser2) userGroup = (JSON.parse(rawUser2)?.group || '').trim()
        } catch (e) { }
        if (userGroup) {
          baseUrl = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(userGroup)}`
        }
      } else if (userRole === 'scientist') {
        const encodedName = encodeURIComponent(userName)
        const roleQuery = `?user_role=${encodeURIComponent(userRole)}`
        baseUrl = `${API_BASE_URL}/proposals/by-name/${encodedName}${roleQuery}`
      } else if (userRole === 'ch' || userRole === 'center head') {
        baseUrl = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(userCenter)}`
      }

      const queryString = params.toString()
      const sep = baseUrl.includes('?') ? '&' : '?'
      const url = `${baseUrl}${queryString ? sep + queryString : ''}`
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
  }, []) // Fetch all data once, let client-side filtering handle date ranges

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
  }, [fetchProposalCount, fetchCentres, fetchGroups, fetchUsers, fetchStageConfig])

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

    // Apply date range filtering for financial year
    if (selectedDateField && dateRange && dateRange.length === 2) {
      filtered = filtered.filter((item) => {
        const dateValue = item[selectedDateField]
        if (!dateValue) return false

        const itemDate = dayjs(dateValue)
        if (!itemDate.isValid()) return false

        const start = dateRange[0].startOf('day')
        const end = dateRange[1].endOf('day')

        return itemDate.isSameOrAfter(start) && itemDate.isSameOrBefore(end)
      })
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

    if (smallValueProjectFilter !== null) {
      filtered = filtered.filter((item) => {
        const svpValue = item.small_value_project
        if (smallValueProjectFilter) {
          // Show only records with 'true' or 'TRUE' (string values only)
          return svpValue === 'true' || svpValue === 'TRUE'
        } else {
          // Show records that are null, empty, or anything except 'true' or 'TRUE'
          return svpValue !== 'true' && svpValue !== 'TRUE'
        }
      })
    }

    setFilteredData(filtered)
  }, [searchText, centreFilter, orderDateRange, statusFilter, projectNumberFilter, groupFilter, projectCoordinatorFilter, isAcknowledgedFilter, smallValueProjectFilter, tableData, selectedDateField, dateRange])

  const CATEGORIES = useMemo(
    () => [
      { key: 'all', label: 'Total Proposals Submitted' },
      { key: 'proposals', label: 'Pending' },
      { key: 'projects', label: 'Converted to Projects' },
      { key: 'technicallyCompleted', label: 'Technically Completed' },
      { key: 'financiallyNotCompleted', label: 'Financially Not Completed' },
      { key: 'financiallyCompleted', label: 'Financially Completed' },
      { key: 'pendingProjects', label: 'Ongoing Projects' },
    ],
    [],
  )

  const matchCategory = useCallback((item, category) => {
    if (!category || category === 'all') return true
    if (category === 'proposals') return !item.project_number || item.project_number.trim() === ''
    if (category === 'projects') return item.project_number && item.project_number.trim() !== ''
    if (category === 'technicallyCompleted')
      return item.technical_completed_year && item.technical_completed_year.trim() !== ''
    if (category === 'financiallyCompleted')
      return (
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        item.financial_completed_year &&
        item.financial_completed_year.trim() !== ''
      )
    if (category === 'financiallyNotCompleted')
      return (
        item.technical_completed_year &&
        item.technical_completed_year.trim() !== '' &&
        (!item.financial_completed_year || item.financial_completed_year.trim() === '')
      )
    if (category === 'pendingProjects') return item.status === 'Ongoing'
    return true
  }, [])

  const getCoordinator = useCallback((item) => {
    const c = (item.project_co_ordinator || '').trim()
    if (c) return c
    return (item.quotation_given_by_name || '').trim() || 'Pending'
  }, [])

  const filterForDrill = useCallback(
    (items) =>
      items.filter((item) => {
        if (!matchCategory(item, selectedCategory)) return false
        if (drillLevel === 'group' || drillLevel === 'coordinator' || drillLevel === 'project_code' || drillLevel === 'project_name') {
          if (selectedCenter && item.center !== selectedCenter) return false
        }
        if (drillLevel === 'coordinator' || drillLevel === 'project_code' || drillLevel === 'project_name') {
          if (selectedGroup && item.group !== selectedGroup) return false
        }
        if (drillLevel === 'coordinator' || drillLevel === 'category' || drillLevel === 'project_code' || drillLevel === 'project_name') {
          if (selectedProjectName && normalizeValue(getCoordinator(item)) !== normalizeValue(selectedProjectName)) return false
        }
        if (drillLevel === 'project_code' || drillLevel === 'project_name') {
          if (selectedProjectCode && getProjectCode(item.project_number) !== getProjectCode(selectedProjectCode)) return false
        }
        if (drillLevel === 'project_name') {
          if (selectedProjectCode && getProjectCode(item.project_number) !== getProjectCode(selectedProjectCode)) return false
        }
        return true
      }),
    [drillLevel, matchCategory, selectedCategory, selectedCenter, selectedGroup, selectedProjectName, selectedProjectCode, getCoordinator],
  )

  const getFinancialValue = useCallback((item) => {
    const isProject = item.project_number && String(item.project_number).trim() !== ''
    const rawValue = isProject
      ? item.order_value ?? item.orderValue ?? item.orderValue
      : item.quote_amount ?? item.quoteAmount ?? item.quote_amount
    const normalized = String(rawValue || '').replace(/,/g, '').trim()
    return Number(normalized) || 0
  }, [])

  const formatInCrore = useCallback((value) => {
    const num = Number(value) || 0
    const crore = num / 1e7
    if (!Number.isFinite(crore)) return '0 cr'
    return `${crore.toFixed(crore % 1 === 0 ? 0 : 2)} cr`
  }, [])


  const buildBreakdown = useCallback((items, dimension) => {
    const totals = {}
    items.forEach((item) => {
      // For coordinator dimension, use the effective coordinator (with fallback)
      const key = dimension === 'project_co_ordinator'
        ? (getCoordinator(item) || 'Pending')
        : String(item[dimension] || 'Pending').trim() || 'Pending'
      totals[key] = (totals[key] || 0) + (chartMetric === 'amount' ? getFinancialValue(item) : 1)
    })
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
    return {
      labels: entries.map(([key]) => key),
      values: entries.map(([, value]) => value),
    }
  }, [chartMetric, getFinancialValue, getCoordinator])

  const chartData = useMemo(() => {
    const items = filterForDrill(filteredData)

    // Handle trend mode
    if (trendCategory) {
      const years = {}
      const currentYear = dayjs().year()

      // Get all years from 2010 to current year + 1
      for (let year = 2010; year <= currentYear + 1; year++) {
        years[year] = 0
      }

      // Filter data based on trend category
      const trendItems = filteredData.filter((item) => matchCategory(item, trendCategory))

      // Aggregate by year
      trendItems.forEach((item) => {
        let year = null

        if (trendCategory === 'all') {
          if (item.order_date) {
            year = dayjs(item.order_date).year()
          } else if (item.enquiry_date) {
            year = dayjs(item.enquiry_date).year()
          }
        } else if (trendCategory === 'projects') {
          if (item.order_date) {
            year = dayjs(item.order_date).year()
          }
        } else if (trendCategory === 'proposals') {
          if (item.enquiry_date) {
            year = dayjs(item.enquiry_date).year()
          }
        } else if (trendCategory === 'technicallyCompleted') {
          if (item.technical_completed_year) {
            year = parseInt(item.technical_completed_year)
          }
        } else if (trendCategory === 'financiallyCompleted' || trendCategory === 'financiallyNotCompleted') {
          if (item.financial_completed_year) {
            year = parseInt(item.financial_completed_year)
          } else if (trendCategory === 'financiallyNotCompleted' && item.technical_completed_year) {
            year = parseInt(item.technical_completed_year)
          }
        }

        if (year && years.hasOwnProperty(year)) {
          years[year] += chartMetric === 'amount' ? getFinancialValue(item) : 1
        }
      })

      const sortedYears = Object.keys(years).sort((a, b) => parseInt(a) - parseInt(b))
      const labels = sortedYears
      const values = sortedYears.map(year => years[year])

      const categoryLabel = CATEGORIES.find(c => c.key === trendCategory)?.label || trendCategory
      const metricLabel = chartMetric === 'amount' ? 'Amount' : 'Count'

      console.log('Trend calculation:', {
        trendCategory,
        chartMetric,
        filteredDataLength: filteredData.length,
        trendItemsLength: trendItems.length,
        yearCounts: years,
        labels,
        values,
      })

      return {
        labels,
        values,
        title: `${categoryLabel} Trend by Year (${metricLabel})`,
        dimension: 'trend',
      }
    }

    if (drillLevel === 'top') {
      if (chartMetric === 'amount') {
        const totals = CATEGORIES.map((category) =>
          filteredData
            .filter((item) => matchCategory(item, category.key))
            .reduce((sum, item) => sum + getFinancialValue(item), 0),
        )
        return {
          labels: CATEGORIES.map((category) => category.label),
          values: totals,
          title: 'Overall Financial Analytics',
          dimension: 'category',
        }
      }
      const counts = CATEGORIES.map((category) =>
        filteredData.filter((item) => matchCategory(item, category.key)).length,
      )
      return {
        labels: CATEGORIES.map((category) => category.label),
        values: counts,
        title: 'Overall Analytics',
        dimension: 'category',
      }
    }

    if (drillLevel === 'center') {
      return {
        ...buildBreakdown(items, 'center'),
        title: `${CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'All'} by Centre`,
        dimension: 'center',
      }
    }

    if (drillLevel === 'group') {
      return {
        ...buildBreakdown(items, 'group'),
        title: `${formatCenterName(selectedCenter)} - ${CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'All'} by Group`,
        dimension: 'group',
      }
    }

    if (drillLevel === 'coordinator') {
      const totals = {}
      items.forEach((item) => {
        // For proposals (no project_number), use quotation_given_by_name
        // For projects (has project_number), use project_co_ordinator
        const isProject = item.project_number && String(item.project_number).trim() !== ''
        const coordinatorField = isProject ? 'project_co_ordinator' : 'quotation_given_by_name'
        const key = String(item[coordinatorField] || 'Pending').trim() || 'UnPendingknown'
        totals[key] = (totals[key] || 0) + (chartMetric === 'amount' ? getFinancialValue(item) : 1)
      })
      const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
      return {
        labels: entries.map(([key]) => key),
        values: entries.map(([, value]) => value),
        title: `${CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'All'}${selectedGroup ? ` for ${formatGroupName(selectedGroup)}` : ''}${selectedCenter ? ` in ${formatCenterName(selectedCenter)}` : ''} by Coordinator`,
        dimension: 'project_co_ordinator',
      }
    }

    if (drillLevel === 'category') {
      const filteredItems = filteredData.filter((item) => {
        const coordinator = item.project_co_ordinator || item.quotation_given_by_name || ''
        return normalizeValue(coordinator) === normalizeValue(selectedProjectName)
      })
      const totals = CATEGORIES.map((category) =>
        filteredItems.reduce(
          (sum, item) => (matchCategory(item, category.key) ? sum + (chartMetric === 'amount' ? getFinancialValue(item) : 1) : sum),
          0,
        ),
      )
      return {
        labels: CATEGORIES.map((category) => category.label),
        values: totals,
        title: `${selectedProjectName} — Breakdown by Category`,
        dimension: 'category',
      }
    }

    if (drillLevel === 'project_code') {
      // If selectedProjectName is set (GH/CH/Admin), filter by coordinator. For Scientist it's empty so use all items.
      const filteredItems = selectedProjectName
        ? items.filter((item) => normalizeValue(getCoordinator(item)) === normalizeValue(selectedProjectName))
        : items
      const projectCodes = {}
      filteredItems.forEach((item) => {
        const code = getProjectCode(item.project_number)
        const key = code || 'Pending'
        projectCodes[key] = (projectCodes[key] || 0) + (chartMetric === 'amount' ? getFinancialValue(item) : 1)
      })
      const entries = Object.entries(projectCodes).sort((a, b) => b[1] - a[1])
      return {
        labels: entries.map(([key]) => key),
        values: entries.map(([, value]) => value),
        title: selectedProjectName ? `${selectedProjectName} by Project Code` : `${CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'All'} by Project Code`,
        dimension: 'project_code',
      }
    }

    if (drillLevel === 'project_name') {
      // Filter by coordinator if set, then by project code
      const filteredItems = items.filter((item) => {
        if (selectedProjectName && normalizeValue(getCoordinator(item)) !== normalizeValue(selectedProjectName)) return false
        if (selectedProjectCode && getProjectCode(item.project_number) !== getProjectCode(selectedProjectCode)) return false
        return true
      })
      return {
        ...buildBreakdown(filteredItems, 'activity'),
        title: `${selectedProjectCode} Projects by Activity`,
        dimension: 'activity',
      }
    }

    return {
      ...buildBreakdown(items, 'project_co_ordinator'),
      title: `${CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'All'} for ${'Group: ' + formatGroupName(selectedGroup)} in ${'Center: ' + formatCenterName(selectedCenter)} by Coordinator`,
      dimension: 'project_co_ordinator',
    }
  }, [buildBreakdown, CATEGORIES, chartMetric, drillLevel, filterForDrill, filteredData, getFinancialValue, matchCategory, selectedCategory, selectedCenter, selectedGroup, selectedProjectCode, selectedProjectName, trendCategory])

  // Generate available financial years from data
  const availableFinancialYears = useMemo(() => {
    const years = new Set()
    const currentYear = dayjs().year()

    // Always use tableData to show all available years, regardless of filters
    tableData.forEach((item) => {
      // Use order_date for financial year calculation
      if (item.order_date) {
        const date = dayjs(item.order_date)
        if (date.isValid()) {
          // Financial year: April 1 to March 31
          const month = date.month() + 1 // dayjs months are 0-based
          const year = date.year()
          const financialYear = month >= 4 ? year : year - 1
          years.add(financialYear)
        }
      }
      // Also check financial_completed_year (only if it's a valid 4-digit year)
      if (item.financial_completed_year) {
        const year = parseInt(item.financial_completed_year)
        if (!isNaN(year) && year >= 1900 && year <= currentYear + 10) {
          years.add(year)
        }
      }
    })
    return Array.from(years).sort((a, b) => b - a) // Most recent first
  }, [tableData])

  // Set date range when financial year is selected for both amount and count charts
  useEffect(() => {
    if (selectedFinancialYear) {
      // Financial year: April 1 to March 31
      const startDate = dayjs(`${selectedFinancialYear}-04-01`)
      const endDate = dayjs(`${selectedFinancialYear + 1}-03-31`)
      setDateRange([startDate, endDate])
      setSelectedDateField('order_date') // Use order_date for financial filtering
    } else {
      // Clear date range when financial year is cleared to show all data
      setDateRange(null)
      setSelectedDateField(null)
    }
  }, [selectedFinancialYear])

  useEffect(() => {
    if (trendCategory) {
      setSelectedFinancialYear(null)
      setDateRange(null)
      setSelectedDateField(null)
    }
  }, [trendCategory])

  const userRole = useMemo(() => {
    try {
      const raw = window.localStorage.getItem('ppm_user')
      if (!raw) return 'admin'
      const parsed = JSON.parse(raw)
      const role = (parsed?.role || '').toLowerCase().trim()
      // Normalize role aliases so all checks use short form
      if (role === 'group head') return 'gh'
      if (role === 'center head' || role === 'centre head') return 'ch'
      if (role === 'scientist') return 'scientist'
      return role === 'role' ? 'guest' : (role || 'admin')
    } catch {
      return 'admin'
    }
  }, [])

  const handleDrillBack = useCallback(() => {
    if (drillLevel === 'project_name') {
      setDrillLevel('project_code')
      setSelectedProjectCode('')
    } else if (drillLevel === 'project_code') {
      if (userRole === 'scientist') {
        // Scientist goes straight back to top (no coordinator level)
        setDrillLevel('top')
        setSelectedCategory('all')
        setSelectedCenter('')
        setSelectedGroup('')
        setSelectedProjectName('')
      } else {
        // GH, CH, Admin etc go back to coordinator
        setDrillLevel('coordinator')
      }
      setSelectedProjectCode('')
    } else if (drillLevel === 'category') {
      setDrillLevel('coordinator')
      setSelectedCategory('all')
      setSelectedProjectName('')
    } else if (drillLevel === 'coordinator') {
      if (userRole === 'gh' || userRole === 'scientist') {
        setDrillLevel('top')
        setSelectedCategory('all')
        setSelectedCenter('')
        setSelectedGroup('')
      } else {
        setDrillLevel('group')
        setSelectedGroup('')
      }
    } else if (drillLevel === 'group') {
      if (userRole === 'ch') {
        setDrillLevel('top')
        setSelectedCategory('all')
        setSelectedCenter('')
        setSelectedGroup('')
      } else {
        setDrillLevel('center')
        setSelectedGroup('')
      }
    } else if (drillLevel === 'center') {
      setDrillLevel('top')
      setSelectedCategory('all')
      setSelectedCenter('')
      setSelectedGroup('')
    }
  }, [drillLevel, userRole])

  const categoryKeyFromLabel = useCallback(
    (label) => {
      const found = CATEGORIES.find((category) => category.label === label)
      return found ? found.key : label
    },
    [CATEGORIES],
  )

  const getModalData = useCallback(() => {
    let proposals = tableData.filter((item) => !item.project_number || item.project_number.toString().trim() === '')
    if (selectedProjectName) {
      proposals = proposals.filter((item) => {
        const coordinator = item.quotation_given_by_name || item.project_co_ordinator || ''
        return normalizeValue(coordinator) === normalizeValue(selectedProjectName)
      })
    }
    return proposals
  }, [tableData, selectedProjectName])

  const handleChartClick = useCallback(
    (label) => {
      // Prevent drilling down if the clicked item has 0 value
      if (chartData && chartData.labels && chartData.values) {
        const idx = chartData.labels.indexOf(label)
        if (idx !== -1) {
          const val = chartData.values[idx]
          if (!val || Number(val) === 0) {
            return
          }
        }
      }

      const dimension = chartData.dimension

      // universal guard: Pending bucket always opens the modal, no matter which
      // dimension/drill-level we're currently on
      if (label === 'Pending') {
        setSelectedProjectName(selectedProjectName || '')
        setNotConvertedModalVisible(true)
        return
      }

      if (dimension === 'trend') {
        return
      }

      if (dimension === 'category') {
        const categoryKey = categoryKeyFromLabel(label)

        if (categoryKey === 'proposals') {
          setNotConvertedModalVisible(true)
          return
        }

        if (selectedProjectName && drillLevel === 'category') {
          setSelectedCategory(categoryKey)
          setDrillLevel('project_code')
          setSelectedProjectCode('')
          return
        }

        setSelectedCategory(categoryKey)
        if (userRole === 'scientist') {
          setDrillLevel('project_code')
        } else if (userRole === 'gh') {
          setDrillLevel('coordinator')
        } else if (userRole === 'ch') {
          setDrillLevel('group')
        } else {
          setDrillLevel('center')
        }
        setSelectedCenter('')
        setSelectedGroup('')
        setSelectedProjectName('')
        setSelectedProjectCode('')
        return
      }

      if (dimension === 'center') {
        setSelectedCenter(label)
        setDrillLevel('group')
        setSelectedGroup('')
        setSelectedProjectName('')
        setSelectedProjectCode('')
        return
      }

      if (dimension === 'group') {
        setSelectedGroup(label)
        setDrillLevel('coordinator')
        setSelectedProjectName('')
        setSelectedProjectCode('')
        return
      }

      if (dimension === 'project_co_ordinator') {
        if (!selectedCategory || selectedCategory === 'all') {
          setSelectedProjectName(label)
          setSelectedProjectCode('')
          setDrillLevel('category')
          return
        }
        if (selectedCategory === 'proposals') {
          setSelectedProjectName(label)
          setNotConvertedModalVisible(true)
          return
        }
        setSelectedProjectName(label)
        setSelectedProjectCode('')
        setDrillLevel('project_code')
        return
      }

      if (dimension === 'project_code') {
        setSelectedProjectCode(label)
        setDrillLevel('project_name')
        return
      }
    },
    [categoryKeyFromLabel, chartData, selectedCategory, selectedProjectName, drillLevel, userRole],
  )

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

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (projectNumberFilter.length > 0) count++
    if (centreFilter.length > 0) count++
    if (groupFilter.length > 0) count++
    if (projectCoordinatorFilter.length > 0) count++
    if (smallValueProjectFilter !== null) count++
    if (selectedDateField && dateRange && dateRange.length === 2) count++
    return count
  }, [projectNumberFilter, centreFilter, groupFilter, projectCoordinatorFilter, smallValueProjectFilter, selectedDateField, dateRange])

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
        width: 170,
        render: (value) => value || '-',
      },
      {
        key: 'activity',
        dataIndex: 'activity',
        title: 'Project Name',
        width: 260,
        render: (value) => value || '-',
      },
      {
        key: 'customer_name',
        dataIndex: 'customer_name',
        title: 'Customer Name',
        width: 220,
        render: (value) => value || '-',
      },
      {
        key: 'overdue_days',
        title: 'Overdue Days',
        width: 150,
        render: (_, record) => {
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
        width: 220,
        render: (value) => value ? value.toUpperCase() : '-',
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

  // Project code prefixes constant
  const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT']

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
      (item) => item.status === 'Ongoing',
    ).length

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

    // Financially Not Completed breakdown
    const financiallyNotCompletedBreakdown = {}
    tableData.forEach((item) => {
      if (item.technical_completed_year && item.technical_completed_year.trim() !== '' &&
        (!item.financial_completed_year || item.financial_completed_year.trim() === '')) {
        if (item.project_number) {
          const prefix = PROJECT_PREFIXES.find((p) =>
            item.project_number.toUpperCase().startsWith(p),
          )
          if (prefix) {
            financiallyNotCompletedBreakdown[prefix] = (financiallyNotCompletedBreakdown[prefix] || 0) + 1
          } else {
            financiallyNotCompletedBreakdown.Other = (financiallyNotCompletedBreakdown.Other || 0) + 1
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
      if (item.status === 'Ongoing') {
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

    return {
      allCount: totalProposals + totalProjects,
      totalProposals,
      totalProjects,
      technicallyCompleted,
      financiallyCompleted,
      financiallyNotCompleted,
      pendingProjects,
      projectCodeBreakdown,
      technicallyCompletedBreakdown,
      financiallyNotCompletedBreakdown,
      financiallyCompletedBreakdown,
      ongoingProjectsBreakdown,
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
                      className="bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === null ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter(null)}
                    >
                      <FileTextOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                      <Statistic
                        title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Submitted</span>}
                        value={statistics.allCount}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'proposals' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => {
                        setStatusFilter('proposals')
                        setProjectNumberFilter([])
                      }}
                    >
                      <ClockCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                      <Statistic
                        title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Pending</span>}
                        value={statistics.totalProposals}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'totalProjects' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter('totalProjects')}
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
                                {idx < arr.length - 1 ? ' | ' : ''}
                              </span>
                            ))}
                        </div>
                      )}
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'technicallyCompleted' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter('technicallyCompleted')}
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
                                {idx < arr.length - 1 ? ' | ' : ''}
                              </span>
                            ))}
                        </div>
                      )}
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'financiallyNotCompleted' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter('financiallyNotCompleted')}
                    >
                      <StopOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                      <Statistic
                        title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Fin. Not Completed</span>}
                        value={statistics.financiallyNotCompleted}
                        valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
                      />
                      {Object.keys(statistics.financiallyNotCompletedBreakdown).length > 0 && (
                        <div className="mt-2 text-[11px] text-white/80 font-medium flex flex-wrap gap-x-1">
                          {Object.entries(statistics.financiallyNotCompletedBreakdown)
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
                      className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'financiallyCompleted' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter('financiallyCompleted')}
                    >
                      <DollarCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                      <Statistic
                        title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Financially Completed</span>}
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
                                {idx < arr.length - 1 ? ' | ' : ''}
                              </span>
                            ))}
                        </div>
                      )}
                    </Card>
                    <Card
                      className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
                      style={{
                        borderRadius: '16px',
                        border: statusFilter === 'pendingProjects' ? '7px solid #06b6d4' : '7px solid transparent'
                      }}
                      onClick={() => setStatusFilter('pendingProjects')}
                    >
                      <PlayCircleOutlined className="absolute right-4 top-4 text-white opacity-25 text-3xl" />
                      <Statistic
                        title={<span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Ongoing Projects</span>}
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
                                {idx < arr.length - 1 ? ' | ' : ''}
                              </span>
                            ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Search and Filters Section */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Header bar */}
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 md:flex-row md:items-center md:justify-between">
                      <Title level={5} className="!mb-0 !text-slate-700">
                        Search & Filters
                      </Title>
                    </div>

                    {/* Search + single Filters toggle */}
                    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                      <Input
                        placeholder="Search proposals... (type ID to search by PK)"
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        className="rounded-full md:max-w-xs"
                      />

                      <Button
                        icon={<FilterOutlined />}
                        onClick={() => setFiltersOpen((prev) => !prev)}
                        className={filtersOpen ? 'border-blue-500 text-blue-600' : ''}
                      >
                        Filters
                        {activeFilterCount > 0 && (
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>

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
                          setSmallValueProjectFilter(null)
                          setSelectedDateField('enquiry_date')
                          setDateRange(null)
                        }}
                      >
                        Clear Filters
                      </Button>
                    </div>

                    {/* Active filter value chips */}
                    {(centreFilter.length > 0 ||
                      projectNumberFilter.length > 0 ||
                      groupFilter.length > 0 ||
                      projectCoordinatorFilter.length > 0 ||
                      smallValueProjectFilter !== null ||
                      (selectedDateField && dateRange && dateRange.length === 2)) && (
                        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
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
                          {projectCoordinatorFilter.map((p) => (
                            <Tag key={`p-${p}`} closable onClose={() => setProjectCoordinatorFilter(projectCoordinatorFilter.filter((v) => v !== p))}>
                              {p}
                            </Tag>
                          ))}
                          {smallValueProjectFilter !== null && (
                            <Tag closable onClose={() => setSmallValueProjectFilter(null)}>
                              SVP: {smallValueProjectFilter ? 'Yes' : 'No'}
                            </Tag>
                          )}
                          {selectedDateField && dateRange && dateRange.length === 2 && (
                            <Tag closable onClose={() => setDateRange(null)}>
                              {DATE_FIELD_OPTIONS.find((o) => o.value === selectedDateField)?.label}:{' '}
                              {dateRange[0].format(DISPLAY_DATE_FORMAT)} → {dateRange[1].format(DISPLAY_DATE_FORMAT)}
                            </Tag>
                          )}
                        </div>
                      )}

                    {/* Expanded filter panel */}
                    {filtersOpen && (
                      <div className="mx-5 mb-5 rounded-xl bg-slate-50 p-4">
                        <Row gutter={[16, 12]}>
                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-medium text-slate-500">Project Number</div>
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
                            <div className="mb-1 text-xs font-medium text-slate-500">Centre</div>
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
                            <div className="mb-1 text-xs font-medium text-slate-500">Group</div>
                            <Select
                              mode="multiple"
                              placeholder="Select group"
                              value={groupFilter}
                              onChange={setGroupFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              {departmentOptions.map((name) => (
                                <Select.Option key={name} value={name}>{formatGroupName(name)}</Select.Option>
                              ))}
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-medium text-slate-500">Project Co-ordinator</div>
                            <Select
                              mode="multiple"
                              placeholder="Select coordinator"
                              value={projectCoordinatorFilter}
                              onChange={setProjectCoordinatorFilter}
                              allowClear
                              style={{ width: '100%' }}
                            >
                              {(projectCoordinatorOptions || []).map((name) => (
                                <Select.Option key={name} value={name}>{name}</Select.Option>
                              ))}
                            </Select>
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-medium text-slate-500">Date Field</div>
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

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-medium text-slate-500">Date Range</div>
                            <RangePicker
                              placeholder={['Start Date', 'End Date']}
                              value={dateRange}
                              onChange={setDateRange}
                              style={{ width: '100%' }}
                              format={DISPLAY_DATE_FORMAT}
                            />
                          </Col>

                          <Col xs={24} sm={12} md={6}>
                            <div className="mb-1 text-xs font-medium text-slate-500">Small Value Project</div>
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
                        </Row>
                      </div>
                    )}
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
                              {renderDetailValue('center', selectedRecord.center)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Group">
                              {renderDetailValue('group', selectedRecord.group)}
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

                  <Modal
                    title={selectedProjectName ? `Proposals for ${selectedProjectName}` : 'Not Converted to Projects'}
                    open={notConvertedModalVisible}
                    onCancel={() => setNotConvertedModalVisible(false)}
                    width={1200}
                    zIndex={9999}
                    footer={[
                      <Button key="close" onClick={() => setNotConvertedModalVisible(false)}>
                        Close
                      </Button>,
                    ]}
                  >
                    <Table
                      dataSource={getModalData()}
                      loading={tableLoading}
                      rowKey="id"
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} proposals`,
                      }}
                      columns={[
                        {
                          title: 'SL NO',
                          dataIndex: 'id',
                          key: 'id',
                          width: 60,
                          render: (_, __, index) => index + 1,
                        },
                        {
                          title: 'Enquiry Date',
                          dataIndex: 'enquiry_date',
                          key: 'enquiry_date',
                          width: 100,
                          render: (value) => formatDate(value),
                        },
                        {
                          title: 'Customer Type',
                          dataIndex: 'customer_type',
                          key: 'customer_type',
                          width: 120,
                        },
                        {
                          title: 'Customer Name',
                          dataIndex: 'customer_name',
                          key: 'customer_name',
                          width: 150,
                          ellipsis: true,
                        },
                        {
                          title: 'Project Name',
                          key: 'project_name',
                          width: 180,
                          render: (_, record) => {
                            const projectName = record.activity && record.activity.trim() !== ''
                              ? record.activity
                              : (record.quote_description && record.quote_description.trim() !== ''
                                ? record.quote_description
                                : '-')
                            return (
                              <Tooltip title={projectName} placement="topLeft">
                                <span>{projectName.length > 20 ? `${projectName.substring(0, 20)}...` : projectName}</span>
                              </Tooltip>
                            )
                          },
                        },
                        {
                          title: 'Proposal Given By',
                          dataIndex: 'quotation_given_by_name',
                          key: 'quotation_given_by_name',
                          width: 150,
                          ellipsis: true,
                        },
                        {
                          title: 'Project Co-ordinator',
                          key: 'project_coordinator',
                          width: 150,
                          render: (_, record) => {
                            const coordinator = record.project_co_ordinator && record.project_co_ordinator.trim() !== ''
                              ? record.project_co_ordinator
                              : (record.quotation_given_by_name && record.quotation_given_by_name.trim() !== ''
                                ? record.quotation_given_by_name
                                : '-')
                            return (
                              <Tooltip title={coordinator} placement="topLeft">
                                <span>{coordinator.length > 15 ? `${coordinator.substring(0, 15)}...` : coordinator}</span>
                              </Tooltip>
                            )
                          },
                        },
                        {
                          title: 'Quote Amount',
                          dataIndex: 'quote_amount',
                          key: 'quote_amount',
                          width: 120,
                          render: (value) => value ? formatIndianNumber(value) : '-',
                        },
                        {
                          title: 'Proposal Status',
                          dataIndex: 'proposal_status',
                          key: 'proposal_status',
                          width: 130,
                          render: (value) => value ? <Tag color="blue">{value}</Tag> : '-',
                        },
                        {
                          title: 'Actions',
                          key: 'actions',
                          width: 90,
                          fixed: 'right',
                          render: (_, record) => (
                            <Space size="small">
                              <Button
                                size="small"
                                type="link"
                                onClick={() => {
                                  setSelectedRecord(record)
                                  setDetailModalOpen(true)
                                  setNotConvertedModalVisible(false)
                                }}
                              >
                                View
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </Modal>

                  {/* Analytics Graph */}
                  <div
                    ref={graphCardRef}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${isGraphFullscreen ? 'fixed inset-0 z-50 flex flex-col' : ''}`}
                    style={isGraphFullscreen ? { background: 'white' } : {}}
                  >
                    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Title level={4} className="!mb-1">
                          {chartData.title || 'Proposal / Projects Analytics'}
                        </Title>
                        <p className="text-slate-500 text-sm">
                          Showing {filteredData.length} records in graph form
                        </p>
                        <div className="mt-2">
                          <Segmented
                            size="small"
                            value={chartType}
                            onChange={setChartType}
                            options={[
                              { value: 'bar', label: 'Bar' },
                              { value: 'pie', label: 'Pie' },
                              { value: 'donut', label: 'Donut' },
                              { value: 'line', label: 'Line' },
                              { value: 'area', label: 'Area' },
                              { value: 'funnel', label: 'Funnel' },
                              { value: 'box', label: 'Box' },
                              { value: 'treemap', label: 'Treemap' },
                            ]}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2" style={isGraphFullscreen ? { zIndex: 100 } : {}}>
                        {drillLevel !== 'top' && !trendCategory && (
                          <Button size="small" onClick={handleDrillBack}>
                            Back
                          </Button>
                        )}
                        <Button
                          size="small"
                          onClick={() => {
                            setDrillLevel('top')
                            setSelectedCategory('all')
                            setSelectedCenter('')
                            setSelectedGroup('')
                            setSelectedProjectName('')
                            setSelectedProjectCode('')
                            setTrendCategory(null)
                          }}
                        >
                          Reset
                        </Button>
                        <Button
                          size="small"
                          icon={<FullscreenOutlined />}
                          onClick={handleToggleGraphFullscreen}
                        >
                          {isGraphFullscreen ? 'Exit Full' : 'Full screen'}
                        </Button>
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadGraph}
                        >
                          Download
                        </Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>Project</span>
                          <Switch
                            size="small"
                            checked={chartMetric === 'amount'}
                            onChange={(checked) => setChartMetric(checked ? 'amount' : 'count')}
                          />
                          <span style={{ fontSize: '12px', color: '#666' }}>Amount</span>
                        </div>
                        <Select
                          size="small"
                          placeholder="Financial Year"
                          value={selectedFinancialYear}
                          onChange={setSelectedFinancialYear}
                          allowClear
                          disabled={Boolean(trendCategory)}
                          style={{ minWidth: 120 }}
                          popupMatchSelectWidth={false}
                          getPopupContainer={(triggerNode) => triggerNode.parentElement}
                          dropdownStyle={{ zIndex: 9999 }}
                          options={availableFinancialYears.map(year => ({
                            value: year,
                            label: `${year}-${year + 1}`,
                          }))}
                        />
                        <Dropdown
                          menu={{
                            items: [
                              { key: 'all', label: 'All (Projects + Proposals)' },
                              { key: 'proposals', label: 'Proposed Projects' },
                              { key: 'projects', label: 'Projects' },
                              { key: 'technicallyCompleted', label: 'Technically Completed' },
                              { key: 'financiallyCompleted', label: 'Financially Completed' },
                              { key: 'financiallyNotCompleted', label: 'Financially Not Completed' },
                            ],
                            onClick: ({ key }) => {
                              setTrendCategory(key)
                              if (key) {
                                setChartType('bar')
                                setDrillLevel('top')
                                setSelectedCategory('all')
                                setSelectedCenter('')
                                setSelectedGroup('')
                                setSelectedProjectName('')
                                setSelectedProjectCode('')
                                setSelectedFinancialYear(null)
                                setDateRange(null)
                                setSelectedDateField(null)
                              }
                            },
                          }}
                          trigger={['click']}
                          getPopupContainer={(triggerNode) => triggerNode.parentElement}
                          overlayStyle={{ zIndex: 9999 }}
                        >
                          <Button size="small">
                            Trend {trendCategory ? `: ${CATEGORIES.find((c) => c.key === trendCategory)?.label || trendCategory}` : ''}
                          </Button>
                        </Dropdown>
                        {trendCategory && (
                          <Button
                            size="small"
                            onClick={() => {
                              setTrendCategory(null)
                              setSelectedFinancialYear(null)
                              setDateRange(null)
                              setSelectedDateField(null)
                            }}
                          >
                            Clear Trend
                          </Button>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        height: isGraphFullscreen ? '90vh' : '420px',
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      <InteractiveChart
                        key={`${chartType}-${chartMetric}-${isGraphFullscreen}-${chartData.title}`}
                        data={chartData}
                        chartType={chartType}
                        chartMetric={chartMetric}
                        onElementClick={handleChartClick}
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

export default Analytics