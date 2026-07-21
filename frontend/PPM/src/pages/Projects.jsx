'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Button,
  Space,
  Modal,
  Empty,
  Tag,
  Spin,
  Upload,
  message,
  Input,
  Table,
  Popconfirm,
  Form,
  DatePicker,
  Select,
  Tabs
} from 'antd'
import {
  EyeOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined,
  LinkOutlined,
  UploadOutlined,
  InboxOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons'
import { API_BASE_URL } from '../config/api.js'
import { formatDateTime } from '../config/date.js'
import dayjs from 'dayjs'
import { ExcelRenderer } from 'react-excel-renderer'
import mammoth from 'mammoth'

const { Title, Text } = Typography
const { TextArea } = Input
const { Dragger } = Upload

const formatValue = (value) => (value ? value : 'Not available')
const safeId = (item) => item?.id ?? item?.key ?? ''

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

const getProjectTheme = (projectNumber) => {
  const num = (projectNumber || '').toString().toUpperCase()

  if (num.includes('ISP')) {
    return {
      cardClass: 'border-l-4 border-blue-500 bg-blue-50',
      pillClass: 'bg-blue-500/10 text-blue-700 border border-blue-500/30',
      pillLabel: 'ISP',
    }
  }

  if (num.includes('GSP')) {
    return {
      cardClass: 'border-l-4 border-indigo-500 bg-indigo-50',
      pillClass: 'bg-indigo-500/10 text-indigo-700 border border-indigo-500/30',
      pillLabel: 'GSP',
    }
  }

  if (num.includes('GAP')) {
    return {
      cardClass: 'border-l-4 border-emerald-500 bg-emerald-50',
      pillClass: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30',
      pillLabel: 'GAP',
    }
  }

  if (num.includes('ILP')) {
    return {
      cardClass: 'border-l-4 border-amber-500 bg-amber-50',
      pillClass: 'bg-amber-500/10 text-amber-700 border border-amber-500/30',
      pillLabel: 'ILP',
    }
  }

  if (num.includes('DPP')) {
    return {
      cardClass: 'border-l-4 border-purple-500 bg-purple-50',
      pillClass: 'bg-purple-500/10 text-purple-700 border border-purple-500/30',
      pillLabel: 'DPP',
    }
  }

  if (num.includes('LSP')) {
    return {
      cardClass: 'border-l-4 border-teal-500 bg-teal-50',
      pillClass: 'bg-teal-500/10 text-teal-700 border border-teal-500/30',
      pillLabel: 'LSP',
    }
  }

  if (num.includes('CLP')) {
    return {
      cardClass: 'border-l-4 border-cyan-500 bg-cyan-50',
      pillClass: 'bg-cyan-500/10 text-cyan-700 border border-cyan-500/30',
      pillLabel: 'CLP',
    }
  }

  if (num.includes('SO')) {
    return {
      cardClass: 'border-l-4 border-rose-500 bg-rose-50',
      pillClass: 'bg-rose-500/10 text-rose-700 border border-rose-500/30',
      pillLabel: 'SO',
    }
  }

  return {
    cardClass: 'border-l-4 border-slate-500 bg-slate-50',
    pillClass: 'bg-slate-500/10 text-slate-700 border border-slate-500/30',
    pillLabel: 'Other',
  }
}

function Projects() {
  const apiBase = API_BASE_URL
  console.log('--- RENDERING UNIFIED PROJECTS PAGE ---')

  // Projects list state
  const [projectRows, setProjectRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [stageConfig, setStageConfig] = useState([])

  // Project details state
  const [selectedProject, setSelectedProject] = useState(null)
  const [stageData, setStageData] = useState([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)
  const [excelRendererData, setExcelRendererData] = useState(null)
  const [excelRendererLoading, setExcelRendererLoading] = useState(false)
  const [excelRendererError, setExcelRendererError] = useState(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [wordDocumentContent, setWordDocumentContent] = useState(null)
  const [wordDocumentLoading, setWordDocumentLoading] = useState(false)
  const [wordDocumentError, setWordDocumentError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [allotmentModalVisible, setAllotmentModalVisible] = useState(false)
  const [selectedStageForAllotment, setSelectedStageForAllotment] = useState(null)
  const [allotmentData, setAllotmentData] = useState(null)
  const [loadingAllotment, setLoadingAllotment] = useState(false)

  // Upload
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [selectedStageForUpload, setSelectedStageForUpload] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fileToUpload, setFileToUpload] = useState(null)
  const [documentName, setDocumentName] = useState('')
  const [uploadedBy, setUploadedBy] = useState('')
  const [description, setDescription] = useState('')
  const [existingDocuments, setExistingDocuments] = useState([])
  const [suggestedVersion, setSuggestedVersion] = useState('1')
  const [documentVersion, setDocumentVersion] = useState('')

  const [attachments, setAttachments] = useState([])

  // Edit Document
  const [editDocumentModalVisible, setEditDocumentModalVisible] = useState(false)
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState(null)
  const [editingDocumentVersion, setEditingDocumentVersion] = useState('')
  const [editingDocumentDescription, setEditingDocumentDescription] = useState('')
  const [updatingDocument, setUpdatingDocument] = useState(false)

  // Remarks
  const [remarksModalVisible, setRemarksModalVisible] = useState(false)
  const [selectedStageForRemarks, setSelectedStageForRemarks] = useState(null)
  const [remarksText, setRemarksText] = useState('')
  const [remarksBy, setRemarksBy] = useState('')
  const [submittingRemarks, setSubmittingRemarks] = useState(false)
  const [editingRemark, setEditingRemark] = useState(null)

  // Payment
  const [paymentModalVisible, setPaymentModalVisible] = useState(false)
  const [selectedStageForPayment, setSelectedStageForPayment] = useState(null)
  const [paymentForm] = Form.useForm()
  const [editingPayment, setEditingPayment] = useState(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Stage/payment detail entry
  const [stageDetailModalVisible, setStageDetailModalVisible] = useState(false)
  const [selectedStageForDetail, setSelectedStageForDetail] = useState(null)
  const [editingStageDetail, setEditingStageDetail] = useState(null)
  const [stageDetailForm] = Form.useForm()
  const [submittingStageDetail, setSubmittingStageDetail] = useState(false)
  const [projectPaymentStageRows, setProjectPaymentStageRows] = useState([])
  const [projectStageTitle, setProjectStageTitle] = useState('')

  // Read user details on mount and initialize states
  const [currentUserName, setCurrentUserName] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        return (JSON.parse(rawUser)?.name || '').trim()
      }
    } catch (err) { }
    return ''
  })

  const [currentUserRole, setCurrentUserRole] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        return (JSON.parse(rawUser)?.role || '').toLowerCase().trim()
      }
    } catch (err) { }
    return ''
  })

  const [currentUserCenter, setCurrentUserCenter] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        return (JSON.parse(rawUser)?.center || '').trim()
      }
    } catch (err) { }
    return ''
  })

  const [currentUserGroup, setCurrentUserGroup] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        return (JSON.parse(rawUser)?.group || '').trim()
      }
    } catch (err) { }
    return ''
  })

  useEffect(() => {
    fetchProjects()
    fetchStageConfig()
    fetchProjectPaymentStageRows()
  }, [])

  const isGuest = currentUserRole === 'guest' || currentUserRole === 'role'
  const isReadOnly = isGuest || currentUserRole === 'ch' || currentUserRole === 'center head'

  const fetchProjects = async () => {
    setLoading(true)
    try {
      let url = `${apiBase}/proposals/`
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        console.log('fetchProjects parsedUser:', parsedUser)
        const role = (parsedUser?.role || '')
        const name = parsedUser?.name || ''
        const center = (parsedUser?.center || '').trim()

        const roleLower = role.toLowerCase().trim()
        const group = (parsedUser?.group || '').trim()

        if (roleLower === 'gh' || roleLower === 'group head') {
          if (group) {
            url = `${apiBase}/proposals/projects/by-group/${encodeURIComponent(group)}`
          } else {
            const encodedName = encodeURIComponent(name)
            url = `${apiBase}/proposals/by-name/${encodedName}?user_role=${encodeURIComponent(roleLower)}`
          }
        } else if (roleLower === 'scientist') {
          const encodedName = encodeURIComponent(name)
          const roleQuery = role ? `?user_role=${encodeURIComponent(roleLower)}` : ''
          url = `${apiBase}/proposals/by-name/${encodedName}${roleQuery}`
        } else if (roleLower === 'ch' || roleLower === 'center head') {
          url = `${apiBase}/proposals/by-centre/${encodeURIComponent(center)}`
        }
      }

      console.log('fetchProjects URL:', url)
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.status}`)
      }
      const data = await res.json()
      console.log('Fetched projects:', data)
      setProjectRows(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      message.error('Failed to load projects')
      setProjectRows([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStageConfig = async () => {
    try {
      const res = await fetch(`${apiBase}/stages/`, {
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

  const fetchProjectPaymentStageRows = async () => {
    try {
      const res = await fetch(`${apiBase}/payment-stages/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch payment stage details')
      }
      const data = await res.json()
      setProjectPaymentStageRows(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch payment stage details:', error)
      setProjectPaymentStageRows([])
    }
  }

  const handleOpenStageDetailModal = (stage) => {
    setSelectedStageForDetail(stage)
    setEditingStageDetail(null)
    setStageDetailModalVisible(true)
    stageDetailForm.setFieldsValue({
      name: '',
      project_no: selectedProject?.project_number || '',
      value: '',
      status: 'Pending',
      invoice_details: '',
      invoice_status: 'Pending',
    })
  }

  const handleOpenStageDetailEditModal = (stage, detail) => {
    setSelectedStageForDetail(stage)
    setEditingStageDetail(detail)
    setStageDetailModalVisible(true)
    stageDetailForm.setFieldsValue({
      name: detail.name || stage?.stage_name || '',
      project_no: detail.project_no || selectedProject?.project_number || '',
      value: detail.value || '',
      status: detail.status || 'Pending',
      invoice_details: detail.invoice_details || '',
      invoice_status: detail.invoice_status || 'Pending',
    })
  }

  const handleSubmitStageDetail = async (values) => {
    setSubmittingStageDetail(true)
    try {
      const payload = {
        name: values.name?.trim() || selectedStageForDetail?.stage_name || '',
        project_no: values.project_no?.trim() || selectedProject?.project_number || '',
        value: values.value?.trim() || '',
        status: values.status || 'Pending',
        invoice_details: values.invoice_details?.trim() || '',
        invoice_status: values.invoice_status || 'Pending',
      }

      const url = editingStageDetail
        ? `${apiBase}/payment-stages/${editingStageDetail.id}`
        : `${apiBase}/payment-stages/`
      const method = editingStageDetail ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || 'Failed to add payment stage details')
      }

      message.success(editingStageDetail ? 'Payment stage details updated successfully' : 'Payment stage details saved successfully')
      setStageDetailModalVisible(false)
      setSelectedStageForDetail(null)
      setEditingStageDetail(null)
      stageDetailForm.resetFields()
      fetchProjectPaymentStageRows()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to save payment stage details')
    } finally {
      setSubmittingStageDetail(false)
    }
  }

  const handleEditStageDetail = (detail) => {
    handleOpenStageDetailEditModal(selectedStageForDetail, detail)
  }

  const handleDeleteStageDetail = async (detailId) => {
    try {
      const res = await fetch(`${apiBase}/payment-stages/${detailId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      message.success('Stage detail deleted')
      fetchProjectPaymentStageRows()
    } catch (err) {
      console.error(err)
      message.error('Failed to delete stage detail')
    }
  }

  const cards = useMemo(() => projectRows || [], [projectRows])

  const getStageAccessList = (stage) => {
    if (!stage) return []
    let config = null
    if (Array.isArray(stageConfig)) {
      config = stageConfig.find((s) => s.id === stage.stage_id)
      if (!config) {
        const name = (stage.stage_name || '').trim().toLowerCase()
        if (name) {
          config = stageConfig.find(
            (s) => (s.name || '').trim().toLowerCase() === name
          )
        }
      }
    }

    const raw = config?.access
    if (!raw || typeof raw !== 'string') return []
    return raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  }

  const getStatusColor = (status) => {
    if (!status) return 'default'
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'completed':
        return 'green'
      case 'in progress':
        return 'blue'
      case 'pending':
        return 'orange'
      default:
        return 'default'
    }
  }

  const fetchStageData = async (projectId) => {
    setLoadingStages(true)
    try {
      const config = await fetchStageConfig()

      const res = await fetch(`${apiBase}/proposals/stage_wise/${projectId}`)
      if (!res.ok) {
        const err = await res.text().catch(() => 'Failed')
        throw new Error(err || 'Failed to fetch stage data')
      }
      const data = await res.json()

      const getPosition = (stage) => {
        const matched = config.find((s) => s.id === stage.stage_id)
        const raw = matched?.position ?? stage.position

        const num = typeof raw === 'number' ? raw : Number(raw)
        return Number.isNaN(num) ? null : num
      }

      const sorted = Array.isArray(data)
        ? [...data].sort((a, b) => {
          const pa = getPosition(a)
          const pb = getPosition(b)

          const paValid = pa !== null
          const pbValid = pb !== null

          if (!paValid && !pbValid) return 0
          if (!paValid) return 1
          if (!pbValid) return -1
          return pa - pb
        })
        : []
      setStageData(sorted)
    } catch (error) {
      console.error('Error fetching stages:', error)
      message.error('Failed to load stage data')
      setStageData([])
    } finally {
      setLoadingStages(false)
    }
  }

  const handleViewProject = (project) => {
    setSelectedProject(project)
    const projectId = safeId(project)
    if (projectId) fetchStageData(projectId)
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setStageData([])
  }

  const handleOpenAllotmentModal = (stage) => {
    const projectId = Number(safeId(selectedProject))
    if (!projectId) {
      message.error('Project ID not found')
      return
    }

    setSelectedStageForAllotment(stage)
    setAllotmentModalVisible(true)
    setLoadingAllotment(true)
    setAllotmentData(null)

    fetch(`${apiBase}/proposals/payments/${projectId}`, {
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Failed to load allotment sheet')
          throw new Error(errText || 'Failed to load allotment sheet')
        }
        return res.json()
      })
      .then((data) => {
        setAllotmentData(data)
      })
      .catch((err) => {
        console.error('Allotment sheet fetch error:', err)
        message.error(err.message || 'Failed to load allotment sheet')
      })
      .finally(() => {
        setLoadingAllotment(false)
      })
  }

  const handleCloseAllotmentModal = () => {
    setAllotmentModalVisible(false)
    setSelectedStageForAllotment(null)
    setAllotmentData(null)
    setLoadingAllotment(false)
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

  const handleDownloadAllotment = async (format) => {
    const projectId = Number(safeId(selectedProject))
    if (!projectId) {
      message.error('Project ID not found')
      return
    }

    const normalizedFormat = (format || '').toLowerCase() === 'pdf' ? 'pdf' : 'word'

    try {
      const res = await fetch(`${apiBase}/proposals/payments/${projectId}`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch allotment data')
      }
      const data = await res.json()

      const paymentsRows = Array.isArray(data?.payments) ? data.payments : []

      const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Allotment Sheet</title>
      <style>
        body { font-family: Arial, sans-serif; color: #000; padding: 32px; }
        h2 { text-align: center; margin-bottom: 32px; }
        .label { font-weight: 600; margin-right: 8px; }
        .block { margin-bottom: 6px; }

        table { border-collapse: collapse; width: 100%; margin-top: 16px; }
        th, td { border: 1px solid #000; padding: 4px; font-size: 12px; }
        .copy-to { margin-top: 32px; font-size: 12px; }
        .header-table { width: 100%; border: none; margin-bottom: 8px; }
        .header-table td { border: none; padding: 0; }
        .header-left { text-align: left; }
        .header-right { text-align: right; }
        .copy-to-table { width: 100%; border: none; margin-top: 8px; text-align: center; }
        .copy-to-table td { border: none; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div>
        <h2>PP &amp; BD DEPT</h2>

        <table class="header-table">
          <tr>
            <td class="header-left">
              <span class="label">Released to C -</span>
              <span class="label">${data?.center || ''}</span>
            </td>
            <td class="header-right">
              <span class="label">Date:</span>
              <span class="label">${data?.order_date || ''}</span>
            </td>
          </tr>
        </table>

        <div class="block">
          <span class="label">${data?.activity || 'Project Name'}</span>
        </div>

        <div class="block">
          <span class="label">Customer:</span>
          <span>${(data?.party_name || '') + (data?.address ? ', ' + data.address : '')}</span>
        </div>

        <div class="block">
          <span class="label">Contact Person:</span>
          <span>${data?.email || ''}</span>
        </div>

        <div class="block">
          <span class="label">Project Co-ordinator:</span>
          <span>${data?.project_co_ordinator || ''}</span>
        </div>

        <div class="block">
          <span class="label">Email &amp; Contact details:</span>
          <span></span>
        </div>

        <div class="block">
          <span class="label">Project Number:</span>
          <span class="label">${data?.project_number || ''}</span>
        </div>

        <div class="block">
          <span class="label">Project Name:</span>
          <span class="label">${data?.activity || ''}</span>
        </div>

        <div class="block">
          <span class="label">Order Value:</span>
          <span>${data?.order_value || ''}</span>
        </div>

        <div class="block">
          <span class="label">Purchase order No:</span>
          <span>${data?.order_number || ''}</span>
        </div>

        <div class="block">
          <span class="label">Delivery date:</span>
          <span>${formatDDMMYYYY(data?.delivery_date)}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Full / Stage Payment</th>
              <th>Invoice No and Amount</th>
              <th>Invoice Date</th>
              <th>Payment Received</th>
              <th>Payment Received Date</th>
              <th>Balance amount and remarks</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsRows.length > 0
          ? paymentsRows.map((row) => `
                <tr>
                  <td>${row.description || ''}</td>
                  <td>${row.invoice_no || ''}</td>
                  <td>${row.invoice_date || ''}</td>
                  <td>${row.amount_recieved || ''}</td>
                  <td>${row.recieved_date || ''}</td>
                  <td>${row.bal || ''}</td>
                </tr>`).join('')
          : `
                <tr>
                  <td colspan="6" style="text-align:center;color:#666;">No payment records available</td>
                </tr>
              `}
          </tbody>
        </table>

        <div style="margin-top: 32px;">
        <table style="width: 100%; border: none; margin-top: 32px; margin-bottom: 24px;">
          <tr>
            <td style="border: none; font-weight: 600; text-align: left;">
              Copy to:
            </td>
            <td style="border: none; font-weight: 600; text-align: right;">
              CH (PP&amp;BD)
            </td>
          </tr>
        </table>

        <table style="border: none; margin: 0; width: 100%;">
          <tr>
            <td style="border: none; padding: 4px 50px 4px 10px;">
              GH (P&amp;S)
            </td>
            <td style="border: none; padding: 4px 50px;">
              Sr. CAO
            </td>
            <td style="border: none; padding: 4px 50px;">
              GH (C-${data?.center || ''})
            </td>
            <td style="border: none; padding: 4px 10px 4px 50px;">
              CH (C-${data?.center || ''})
            </td>
          </tr>
        </table>
      </div>

      <div
        style="
          margin-top: 16px;
          font-weight: 600;
          font-size: 12px;
        "
      >
        Director: For kind information
      </div>

    </body>
  </html>`
      if (normalizedFormat === 'word') {
        const blob = new Blob([html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `allotment-${projectId}.doc`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const win = window.open('', '_blank')
        if (!win) {
          message.error('Popup blocked. Please allow popups to download the PDF.')
          return
        }
        win.document.open()
        win.document.write(html + '<script>window.print();</script>')
        win.document.close()
      }
    } catch (err) {
      console.error('Allotment download error:', err)
      message.error(err.message || 'Failed to download allotment sheet')
    }
  }

  // Upload Document handlers
  const handleOpenUploadModal = async (stage) => {
    setSelectedStageForUpload(stage)
    setUploadModalVisible(true)
    setFileToUpload(null)
    setDocumentName((stage.stage_name || 'Document').toString())
    setUploadedBy(currentUserName || '')
    setDescription('')
    setAttachments([])

    try {
      const res = await fetch(`${apiBase}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (res.ok) {
        const allDocuments = await res.json()
        const filteredDocs = allDocuments.filter(doc =>
          doc.project_id === safeId(selectedProject) &&
          doc.stage_id === stage.stage_id &&
          doc.name === (stage.stage_name || 'Document')
        )
        setExistingDocuments(filteredDocs)

        // Calculate suggested version
        if (filteredDocs.length > 0) {
          const versions = filteredDocs.map(doc => parseInt(doc.version) || 0)
          const maxVersion = Math.max(...versions)
          setSuggestedVersion((maxVersion + 1).toString())
        } else {
          setSuggestedVersion('1')
        }
      } else {
        setExistingDocuments([])
        setSuggestedVersion('1')
      }
    } catch (error) {
      console.error('Failed to fetch existing documents:', error)
      setExistingDocuments([])
      setSuggestedVersion('1')
    }

    setDocumentVersion('')
  }

  const handleCloseUploadModal = () => {
    setUploadModalVisible(false)
    setSelectedStageForUpload(null)
    setFileToUpload(null)
    setExistingDocuments([])
    setSuggestedVersion('1')
    setAttachments([])
  }

  const handleAddAttachments = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      setAttachments((prev) => [...prev, ...files])
    }
    e.target.value = ''
  }

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }


  const handleOpenEditDocumentModal = (doc) => {
    setSelectedDocumentForEdit(doc)
    setEditingDocumentVersion(doc.version || '')
    setEditingDocumentDescription(doc.description || '')
    setEditDocumentModalVisible(true)
  }

  const handleCloseEditDocumentModal = () => {
    setEditDocumentModalVisible(false)
    setSelectedDocumentForEdit(null)
    setEditingDocumentVersion('')
    setEditingDocumentDescription('')
  }

  const handleUpdateDocument = async () => {
    if (!selectedDocumentForEdit) return

    setUpdatingDocument(true)
    const formData = new FormData()
    formData.append('version', editingDocumentVersion.trim())
    formData.append('description', editingDocumentDescription.trim())

    try {
      const res = await fetch(`${apiBase}/documents/${selectedDocumentForEdit.id}`, {
        method: 'PUT',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'Update failed')
        throw new Error(err || 'Update failed')
      }
      message.success('Document updated!')
      handleCloseEditDocumentModal()
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error('Update error:', err)
      message.error('Failed to update document')
    } finally {
      setUpdatingDocument(false)
    }
  }

  const handleDeleteDocument = async (documentId) => {
    try {
      const res = await fetch(`${apiBase}/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'Delete failed')
        throw new Error(err || 'Delete failed')
      }
      message.success('Document deleted!')
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error('Delete error:', err)
      message.error('Failed to delete document')
    }
  }

  const handleUpload = async () => {
    if (!fileToUpload) return message.error('Please select a file')
    const uploader = (uploadedBy || currentUserName || '').trim()
    if (!uploader) return message.error('Your name is required')

    setUploading(true)
    const formData = new FormData()
    formData.append('name', documentName.trim())
    formData.append('description', description.trim())
    formData.append('project_id', safeId(selectedProject))
    formData.append('stage_id', selectedStageForUpload.stage_id)
    formData.append('uploaded_by', uploader)
    formData.append('version', documentVersion || suggestedVersion)
    formData.append('file', fileToUpload)
    attachments.forEach((att) => {
      formData.append('attachment', att)
    })

    try {
      const res = await fetch(`${apiBase}/documents/`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.text().catch(() => 'Upload failed')
        throw new Error(err || 'Upload failed')
      }
      message.success('Document uploaded!')
      handleCloseUploadModal()
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error('Upload error:', err)
      message.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Remarks handlers
  const handleOpenRemarksModal = (stage) => {
    setSelectedStageForRemarks(stage)
    setRemarksModalVisible(true)
    setRemarksText('')
    setRemarksBy(currentUserName || '')
    setEditingRemark(null)
  }

  const handleEditRemark = (stage, remark) => {
    setSelectedStageForRemarks(stage)
    setEditingRemark(remark)
    setRemarksText(remark.remarks || '')
    setRemarksBy(currentUserName || '')
    setRemarksModalVisible(true)
  }

  const handleDeleteRemark = async (remarkId) => {
    try {
      const res = await fetch(`${apiBase}/progress/${remarkId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      message.success('Remark deleted')
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error(err)
      message.error('Failed to delete remark')
    }
  }

  const handleSubmitRemarks = async () => {
    if (!remarksText.trim()) return message.error('Remarks required')
    if (!remarksBy.trim()) return message.error('Your name required')

    setSubmittingRemarks(true)
    try {
      if (editingRemark) {
        const res = await fetch(`${apiBase}/progress/${editingRemark.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: safeId(selectedProject),
            stage_id: selectedStageForRemarks.stage_id,
            remarks: remarksText.trim(),
            updated_by: remarksBy.trim(),
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to update remark')
        }
        message.success('Remark updated!')
      } else {
        const res = await fetch(`${apiBase}/progress/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: safeId(selectedProject),
            stage_id: selectedStageForRemarks.stage_id,
            remarks: remarksText.trim(),
            updated_by: remarksBy.trim(),
          }),
        })
        if (!res.ok) throw new Error('Failed to add remark')
        message.success('Remarks added!')
      }

      setRemarksModalVisible(false)
      setEditingRemark(null)
      setRemarksText('')
      setRemarksBy('')
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error(err)
      message.error(err.message || 'Failed to save remark')
    } finally {
      setSubmittingRemarks(false)
    }
  }

  // Payment handlers
  const handleOpenPaymentModal = (stage, payment = null) => {
    setSelectedStageForPayment(stage)
    setEditingPayment(payment)
    setPaymentModalVisible(true)

    if (payment) {
      paymentForm.setFieldsValue({
        description: payment.description || '',
        invoice_no: payment.invoice_no?.toString() || '',
        gross_amount: payment.gross_amount?.toString() || '',
        get_amount: payment.get_amount?.toString() || '',
        amount_claimed: payment.amount_claimed?.toString() || '',
        amount_recieved: payment.amount_recieved?.toString() || '',
        tds: payment.tds?.toString() || '',
        get_tds: payment.get_tds?.toString() || '',
        ld: payment.ld?.toString() || '',
        bal: payment.bal?.toString() || '',
        follow_up_status: payment.follow_up_status || '',
        invoice_date: payment.invoice_date ? dayjs(payment.invoice_date, ['DD/MM/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', dayjs.ISO_8601]) : null,
        recieved_date: payment.recieved_date ? dayjs(payment.recieved_date, ['DD/MM/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', dayjs.ISO_8601]) : null,
      })
    } else {
      paymentForm.resetFields()
    }
  }

  const handleSubmitPayment = async (values) => {
    setSubmittingPayment(true)
    try {
      let username = 'Unknown'
      try {
        const ppmUser = JSON.parse(localStorage.getItem('ppm_user'))
        username = ppmUser?.name || 'Unknown'
      } catch (e) {
        username = 'Unknown'
      }

      const payload = {
        description: values.description || '',
        invoice_no: values.invoice_no || '',
        gross_amount: values.gross_amount || '',
        get_amount: values.get_amount || '',
        amount_claimed: values.amount_claimed || '',
        amount_recieved: values.amount_recieved || '',
        tds: values.tds || '',
        get_tds: values.get_tds || '',
        ld: values.ld || '',
        bal: values.bal || '',
        follow_up_status: values.follow_up_status || '',
        invoice_date: values.invoice_date ? values.invoice_date.format('DD-MM-YYYY') : null,
        recieved_date: values.recieved_date ? values.recieved_date.format('DD-MM-YYYY') : null,
        project_id: Number(safeId(selectedProject)),
        stage_id: Number(selectedStageForPayment.stage_id),
        updated_by: username,
      }

      const url = editingPayment ? `${apiBase}/payments/${editingPayment.id}` : `${apiBase}/payments/`

      const res = await fetch(url, {
        method: editingPayment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to save payment')
      }

      message.success(editingPayment ? 'Payment updated!' : 'Payment added!')
      setPaymentModalVisible(false)
      setEditingPayment(null)
      paymentForm.resetFields()
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error('Payment error:', err)
      message.error(err.message || 'Failed to save payment')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleDeletePayment = async (id) => {
    try {
      const res = await fetch(`${apiBase}/payments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      message.success('Payment deleted')
      fetchStageData(safeId(selectedProject))
    } catch (err) {
      console.error(err)
      message.error('Failed to delete payment')
    }
  }

  const [searchText, setSearchText] = useState('')
  const [selectedCenter, setSelectedCenter] = useState(undefined)
  const [selectedGroup, setSelectedGroup] = useState(undefined)
  const [selectedCoordinator, setSelectedCoordinator] = useState(undefined)
  const [selectedProjectType, setSelectedProjectType] = useState('ALL')

  const isGHOrScientist = currentUserRole === 'scientist' || currentUserRole === 'gh' || currentUserRole === 'group head'
  const isCH = currentUserRole === 'ch' || currentUserRole === 'center head'

  // Extract center options (for Admin)
  const centerOptions = useMemo(() => {
    const centers = [...new Set(projectRows.map(p => p.center?.trim()).filter(Boolean))]
    return centers.sort().map(c => ({ label: c, value: c }))
  }, [projectRows])

  // Extract group options (for CH)
  const groupOptions = useMemo(() => {
    const groups = [...new Set(projectRows.map(p => p.group?.trim()).filter(Boolean))]
    return groups.sort().map(g => ({ label: g, value: g }))
  }, [projectRows])

  // Extract coordinator options (for GH/Scientist)
  const coordinatorOptions = useMemo(() => {
    const coordinators = [...new Set(projectRows.map(p => p.project_co_ordinator?.trim()).filter(Boolean))]
    return coordinators.sort().map(c => ({ label: c, value: c }))
  }, [projectRows])

  // Extract project type options
  const projectTypeOptions = useMemo(() => {
    const types = [...new Set(projectRows.map(p => {
      const num = (p.project_number || '').toString().toUpperCase()
      return num.substring(0, 3)
    }).filter(prefix => prefix && prefix.length >= 3))]
    return types.sort().map(type => ({ label: type, value: type }))
  }, [projectRows])

  // Filtered list based on role
  const filteredCards = useMemo(() => {
    return (projectRows || [])
      .filter(p => p?.project_number)
      .filter(p => {
        // Search filter
        const searchLower = searchText.toLowerCase().trim()
        if (searchLower) {
          const inNumber = p.project_number?.toString().toLowerCase().includes(searchLower)
          const inActivity = p.activity?.toLowerCase().includes(searchLower)
          const inCoord = p.project_co_ordinator?.toLowerCase().includes(searchLower)
          if (!(inNumber || inActivity || inCoord)) return false
        }

        // Role-specific filters
        if (isGHOrScientist) {
          if (selectedCoordinator && p.project_co_ordinator?.trim() !== selectedCoordinator) return false
        } else if (isCH) {
          if (selectedGroup && p.group?.trim() !== selectedGroup) return false
        } else {
          // Admin / Guest
          if (selectedCenter && p.center?.trim() !== selectedCenter) return false
        }

        return true
      })
  }, [projectRows, searchText, selectedCenter, selectedGroup, selectedCoordinator, isGHOrScientist, isCH])

  const handleClearFilters = () => {
    setSearchText('')
    setSelectedCenter(undefined)
    setSelectedGroup(undefined)
    setSelectedCoordinator(undefined)
    setSelectedProjectType('ALL')
  }

  // Helper to get project type from project number
  const getProjectType = (projectNumber) => {
    const num = (projectNumber || '').toString().toUpperCase()
    if (num.includes('ISP')) return 'ISP'
    if (num.includes('GSP')) return 'GSP'
    if (num.includes('GAP')) return 'GAP'
    if (num.includes('ILP')) return 'ILP'
    if (num.includes('DPP')) return 'DPP'
    if (num.includes('LSP')) return 'LSP'
    if (num.includes('CLP')) return 'CLP'
    if (num.includes('SO')) return 'SO'
    return 'Other'
  }

  // Group projects by type
  const groupedProjects = useMemo(() => {
    const groups = {}
    filteredCards.forEach(p => {
      const type = getProjectType(p.project_number)
      if (!groups[type]) groups[type] = []
      groups[type].push(p)
    })
    return groups
  }, [filteredCards])

  // Project type order and labels
  const projectTypeOrder = ['ISP', 'GSP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SO', 'Other']

  const projectTypeConfig = {
    ISP: { color: 'blue', label: 'ISP Projects' },
    GSP: { color: 'indigo', label: 'GSP Projects' },
    GAP: { color: 'emerald', label: 'GAP Projects' },
    ILP: { color: 'amber', label: 'ILP Projects' },
    DPP: { color: 'purple', label: 'DPP Projects' },
    LSP: { color: 'teal', label: 'LSP Projects' },
    CLP: { color: 'cyan', label: 'CLP Projects' },
    SO: { color: 'rose', label: 'SO Projects' },
    Other: { color: 'slate', label: 'Other Projects' }
  }

  const getPaymentColumns = (stage) => [
    { title: 'Description', dataIndex: 'description', width: 200 },
    { title: 'Inv #', dataIndex: 'invoice_no', width: 120 },
    { title: 'Inv Date', dataIndex: 'invoice_date', width: 110 },
    { title: 'Gross', dataIndex: 'gross_amount', width: 110 },
    { title: 'GST Amount', dataIndex: 'get_amount', width: 110 },
    { title: 'Amount Claimed', dataIndex: 'amount_claimed', width: 130 },
    { title: 'Amount Received', dataIndex: 'amount_recieved', width: 130 },
    { title: 'Received Date', dataIndex: 'recieved_date', width: 120 },
    { title: 'TDS', dataIndex: 'tds', width: 90 },
    { title: 'GST TDS', dataIndex: 'get_tds', width: 90 },
    { title: 'LD', dataIndex: 'ld', width: 90 },
    { title: 'Balance', dataIndex: 'bal', width: 90 },
    { title: 'Status', dataIndex: 'follow_up_status', width: 150 },
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

    ...(!isReadOnly ? [{
      title: 'Actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenPaymentModal(stage, record)}>Edit</Button>
          <Popconfirm title="Delete payment?" onConfirm={() => handleDeletePayment(record.id)}>
            <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  const formatDate = (date) => (date ? formatDateTime(date) : 'N/A')

  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return ''
    const d = dayjs(dateStr, ['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY', dayjs.ISO_8601])
    return d.isValid() ? d.format('DD-MM-YYYY') : dateStr
  }

  const uploadProps = {
    multiple: false,
    maxCount: 1,
    beforeUpload: (file) => {
      setFileToUpload(file)
      return false
    },
    onRemove: () => {
      setFileToUpload(null)
    },
    fileList: fileToUpload ? [{
      uid: fileToUpload.uid || fileToUpload.name,
      name: fileToUpload.name,
      status: 'done',
      originFileObj: fileToUpload,
    }] : [],
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Loading projects..." />
      </div>
    )
  }

  // Project details view
  if (selectedProject) {
    const getAllotmentPaymentRow = (index) => {
      if (!allotmentData || !Array.isArray(allotmentData.payments)) return {}
      return allotmentData.payments[index] || {}
    }

    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToProjects}
              size="large"
            >
            </Button>
            <div>
              <Title level={3} className="!mb-0">
                <FileTextOutlined /> Project {formatValue(selectedProject.project_number)}
              </Title>
              <Text type="secondary">{selectedProject.activity}</Text>
            </div>
          </div>
        </div>

        {loadingStages ? (
          <div className="py-20 text-center">
            <Spin size="large" tip="Loading stages..." />
          </div>
        ) : stageData.length === 0 ? (
          <Empty description="No stages found" />
        ) : (
          <div className="space-y-8">
            {stageData
              .filter(stage => (stage.stage_name || '').trim().toLowerCase() !== 'dgdfh')
              .sort((a, b) => {
                const configA = stageConfig.find((s) => s.id === a.stage_id)
                const configB = stageConfig.find((s) => s.id === b.stage_id)
                const posA = configA?.position ?? a.position ?? Infinity
                const posB = configB?.position ?? b.position ?? Infinity
                return posA - posB
              })
              .map((stage) => {
                const rawName = (stage.stage_name || '').trim()
                const stageName = rawName
                const stageNameLower = rawName.toLowerCase()
                const hasDocs = Array.isArray(stage.documents) && stage.documents.length > 0
                const hasProg = Array.isArray(stage.progress) && stage.progress.length > 0
                const hasPay = Array.isArray(stage.payments) && stage.payments.length > 0
                const accessList = getStageAccessList(stage)
                const canUpload = accessList.includes('upload')
                const canAddRemarks = accessList.includes('add remarks')
                const canAddPayments = accessList.includes('add payments')
                const canViewAllotment = accessList.includes('view allotment sheet')
                // Show Add Details button only for Payment stages (position 11)
                const config = stageConfig.find((s) => s.id === stage.stage_id)
                const stagePosition = config?.position ?? stage.position ?? 0
                const canAddStageDetails = stagePosition === 11
                const stageDetails = projectPaymentStageRows.filter((detail) =>
                  String(detail.project_no || '').trim() === String(selectedProject?.project_number || '').trim()
                )

                return (
                  <div key={stage.stage_id ?? stageName} className="border rounded-xl p-6 bg-gray-50">
                    <div className="flex justify-between items-center mb-5">
                      <Title level={4} className="!mb-0">
                        {(() => {
                          const config = stageConfig.find((s) => s.id === stage.stage_id)
                          const position = config?.position ?? stage.position ?? '-'
                          return <Tag color="blue">{position}</Tag>
                        })()} {stageName || 'Stage'}
                      </Title>
                      {!isReadOnly && (
                        <Space>
                          {canUpload && (
                            <Button size="small" type="primary" icon={<UploadOutlined />} onClick={() => handleOpenUploadModal(stage)}>
                              Upload
                            </Button>
                          )}
                          {/* {canAddStageDetails && (
                          // <Button size="small" icon={<PlusOutlined />} onClick={() => handleOpenStageDetailModal(stage)}>
                            
                          // </Button>
                        )} */}
                        </Space>
                      )}
                    </div>

                    {hasDocs && (
                      <div className="mb-6">
                        <Text strong>Documents:</Text>
                        <div className="grid gap-3 mt-3 md:grid-cols-2">
                          {stage.documents.map((doc) => (
                            <Card key={doc.id} size="small" className="border-l-4 border-l-blue-600 relative">
                              <div className="pr-8">
                                <Text strong>
                                  {doc.name ? `${doc.name.substring(0, 30)}${doc.name.length > 30 ? '...' : ''}` : 'Document'} - Version {doc.version || 'N/A'}
                                </Text>
                                {doc.description && <Text type="secondary" className="block text-xs mt-1">{doc.description}</Text>}
                                <div className="text-xs text-gray-500 mt-1">
                                  <UserOutlined /> {doc.uploaded_by || 'Unknown'} • <CalendarOutlined /> {formatDate(doc.updated_at)}
                                </div>
                                {Array.isArray(doc.attachment) && doc.attachment.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {doc.attachment.map((url, idx) => (
                                      <Button
                                        key={idx}
                                        type="link"
                                        size="small"
                                        icon={<LinkOutlined />}
                                        style={{ padding: 0, height: 'auto', fontSize: 12 }}
                                        onClick={() => {
                                          const urlNoQuery = url.split('#')[0].split('?')[0]
                                          const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
                                          if (ext === 'xlsx' || ext === 'xls') {
                                            loadExcelWithRenderer(url)
                                          } else if (ext === 'docx' || ext === 'doc') {
                                            loadWordDocument(url)
                                          }
                                          setViewDocumentUrl(url)
                                        }}
                                      >
                                        Attachment {idx + 1}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                <Text type="secondary" className="text-xs">v{doc.version || 'N/A'}</Text>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleOpenEditDocumentModal(doc)}
                                  className="text-blue-600 hover:text-blue-800"
                                />
                                <Popconfirm
                                  title="Delete document?"
                                  description="This action cannot be undone."
                                  onConfirm={() => handleDeleteDocument(doc.id)}
                                  okText="Delete"
                                  cancelText="Cancel"
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    className="text-red-600 hover:text-red-800"
                                  />
                                </Popconfirm>
                              </div>
                              {doc.url ? (
                                <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => {
                                  const urlNoQuery = doc.url.split('#')[0].split('?')[0]
                                  const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
                                  if (ext === 'xlsx' || ext === 'xls') {
                                    loadExcelWithRenderer(doc.url)
                                  } else if (ext === 'docx' || ext === 'doc') {
                                    loadWordDocument(doc.url)
                                  }
                                  setViewDocumentUrl(doc.url)
                                }}>
                                  View
                                </Button>
                              ) : null}
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {canViewAllotment && (
                      <div className="mb-6">
                        <Card size="small" className="border-l-4 border-l-indigo-600">
                          <div className="flex items-center justify-between">
                            <Text strong>Allotment Sheet</Text>
                            <Space>
                              <Button
                                size="small"
                                type="primary"
                                icon={<EyeOutlined />}
                                onClick={() => handleOpenAllotmentModal(stage)}
                              >
                                View
                              </Button>
                              <Button
                                size="small"
                                onClick={() => handleDownloadAllotment('word')}
                              >
                                Download as Word
                              </Button>
                              <Button
                                size="small"
                                onClick={() => handleDownloadAllotment('pdf')}
                              >
                                Download as PDF
                              </Button>
                            </Space>
                          </div>
                        </Card>
                      </div>
                    )}

                    {/* {canAddStageDetails && (
                      <div className="mb-6">
                        <Text strong>Payment Stages</Text>
                        <div className="mt-3">
                          {stageDetails.length > 0 ? (
                            <table className="min-w-full bg-white border border-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                    Stages
                                  </th>
                                  <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                    Remarks
                                  </th>
                                  <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                    Status
                                  </th>
                                  <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {stageDetails.map((detail, index) => (
                                  <tr key={detail.id} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      Stage {index + 1}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      {detail.value || 'No remarks'}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      <Tag color={getStatusColor(detail.status)}>
                                        {detail.status || 'Pending'}
                                      </Tag>
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      <Button
                                        size="small"
                                        type="primary"
                                        icon={<EditOutlined />}
                                        onClick={() => handleOpenStageDetailEditModal(stage, detail)}
                                      >
                                        Update Invoice
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-6 bg-gray-50 border border-gray-200 rounded">
                              <Text type="secondary">No payment stages added yet. Click "Add Details" to create payment stages.</Text>
                            </div>
                          )}
                        </div>
                      </div>
                    )} */}

                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        {canAddRemarks && (
                          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handleOpenRemarksModal(stage)}>
                            Add Remark
                          </Button>
                        )}
                      </div>
                      {hasProg && stage.progress.map((p) => (
                        <Card key={p.id} size="small" className="mb-3 border-l-4 border-l-green-600">
                          <div className="flex justify-between items-start">
                            <div>
                              <Text>{p.remarks}</Text>
                              <Text type="secondary" className="block text-xs mt-1">
                                {p.updated_by || 'Unknown'} • {formatDate(p.updated_at)}
                              </Text>
                            </div>
                            <div>
                              <Space>
                                <Button size="small" icon={<EditOutlined />} onClick={() => handleEditRemark(stage, p)}>Edit</Button>
                                <Popconfirm title="Delete remark?" onConfirm={() => handleDeleteRemark(p.id)}>
                                  <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
                                </Popconfirm>
                              </Space>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {/* Progress Stages Table for Position 7 */}
                    {stagePosition === 7 && (
                      <div className="mb-6">
                        <Text strong>Progress Stages</Text>
                        <div className="mt-3">
                          <table className="min-w-full bg-white border border-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Stages
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Remarks
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Invoice Details
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Invoice Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {stageDetails.map((detail, index) => (
                                <tr key={detail.id} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    Stage {index + 1}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    {detail.value || 'No remarks'}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    <Tag color={getStatusColor(detail.status)}>
                                      {detail.status || 'Pending'}
                                    </Tag>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    <div className="max-w-xs truncate" title={detail.invoice_details}>
                                      {detail.invoice_details || 'No invoice details'}
                                    </div>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    <Tag color={detail.invoice_status === 'Paid' ? 'green' :
                                      detail.invoice_status === 'Pending' ? 'orange' :
                                        detail.invoice_status === 'Generated' ? 'blue' : 'default'}>
                                      {detail.invoice_status || 'Pending'}
                                    </Tag>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Project Stages Table for Position 11 */}
                    {stagePosition === 11 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          {/* <Input 
                            placeholder="Enter project stage title..."
                            style={{ width: '300px' }}
                            value={projectStageTitle}
                            onChange={(e) => setProjectStageTitle(e.target.value)}
                          /> */}
                          {!isReadOnly && (
                            <Button
                              type="primary"
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => handleOpenStageDetailModal(stage)}
                            >
                              Add Stage
                            </Button>
                          )}
                        </div>
                        <div className="mt-3">
                          <table className="min-w-full bg-white border border-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  SL No
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Stages
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Remarks
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {stageDetails.map((detail, index) => (
                                <tr key={detail.id} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    {index + 1}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    {detail.name || 'No name'}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    {detail.value || 'No remarks'}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    <Tag color={getStatusColor(detail.status)}>
                                      {detail.status || 'Pending'}
                                    </Tag>
                                  </td>
                                  <td className="border border-gray-300 px-4 py-2 text-sm">
                                    <Space>
                                      <Button size="small" icon={<EditOutlined />} onClick={() => handleEditStageDetail(detail)}>Edit</Button>
                                      <Popconfirm title="Delete stage?" onConfirm={() => handleDeleteStageDetail(detail.id)}>
                                        <Button danger size="small" icon={<DeleteOutlined />}>Delete</Button>
                                      </Popconfirm>
                                    </Space>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div>
                      {!isReadOnly && (
                        <div className="flex justify-between items-center mb-3">
                          {canAddPayments && (
                            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenPaymentModal(stage)}>
                              Add Payment
                            </Button>
                          )}
                        </div>
                      )}

                      {hasPay && (
                        <Table
                          dataSource={stage.payments}
                          columns={getPaymentColumns(stage)}
                          pagination={false}
                          size="small"
                          scroll={{ x: 1400 }}
                          rowKey="id"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        <Modal
          title={<>{editingPayment ? 'Edit' : 'Add'} Payment - {selectedStageForPayment?.stage_name}</>}
          open={paymentModalVisible}
          onCancel={() => {
            setPaymentModalVisible(false)
            setEditingPayment(null)
            paymentForm.resetFields()
          }}
          footer={null}
          width={1000}
        >
          <Form form={paymentForm} layout="vertical" onFinish={handleSubmitPayment}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Form.Item label="Description" name="description" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Invoice No" name="invoice_no" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Invoice Date" name="invoice_date">
                <DatePicker format="DD-MM-YYYY" className="w-full" />
              </Form.Item>
              <Form.Item label="Gross Amount" name="gross_amount">
                <Input />
              </Form.Item>
              <Form.Item label="GST Amount" name="get_amount">
                <Input />
              </Form.Item>
              <Form.Item label="Amount Claimed" name="amount_claimed">
                <Input />
              </Form.Item>
              <Form.Item label="Amount Received" name="amount_recieved">
                <Input />
              </Form.Item>
              <Form.Item label="Received Date" name="recieved_date">
                <DatePicker format="DD-MM-YYYY" className="w-full" />
              </Form.Item>
              <Form.Item label="TDS" name="tds">
                <Input />
              </Form.Item>
              <Form.Item label="GST TDS" name="get_tds">
                <Input />
              </Form.Item>
              <Form.Item label="LD" name="ld">
                <Input />
              </Form.Item>
              <Form.Item label="Balance" name="bal">
                <Input />
              </Form.Item>
              <Form.Item label="Follow-up Status" name="follow_up_status">
                <Input />
              </Form.Item>
            </div>

            {/* Updated By - Read Only Field */}
            <div className="mb-4">
              <Form.Item label="Updated By">
                <Input
                  value={(() => {
                    try {
                      const ppmUser = JSON.parse(localStorage.getItem('ppm_user'))
                      return ppmUser?.name || 'Unknown'
                    } catch (e) {
                      return 'Unknown'
                    }
                  })()}
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </Form.Item>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button onClick={() => {
                setPaymentModalVisible(false)
                setEditingPayment(null)
                paymentForm.resetFields()
              }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submittingPayment}>
                {editingPayment ? 'Update' : 'Add'} Payment
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title={editingStageDetail ? `Edit Invoice for ${editingStageDetail.name || selectedStageForDetail?.stage_name}` : selectedStageForDetail ? `Add Details for ${selectedStageForDetail.stage_name}` : 'Add Payment Stage Details'}
          open={stageDetailModalVisible}
          onCancel={() => {
            setStageDetailModalVisible(false)
            setSelectedStageForDetail(null)
            setEditingStageDetail(null)
            stageDetailForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Form form={stageDetailForm} layout="vertical" onFinish={handleSubmitStageDetail}>
            <Form.Item
              label="Stage Name"
              name="name"
              rules={[{ required: true, message: 'Please enter stage name' }]}
            >
              <Input placeholder="Enter stage name..." />
            </Form.Item>
            {!editingStageDetail && (
              <>
                <Form.Item
                  label="Project Number"
                  name="project_no"
                  rules={[{ required: true, message: 'Please enter project number' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Remarks"
                  name="value"
                  rules={[{ required: true, message: 'Please enter value' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="Status"
                  name="status"
                  rules={[{ required: true, message: 'Please select status' }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="Type status..."
                    mode="combobox"
                    options={[
                      { label: 'Pending', value: 'Pending' },
                      { label: 'In Progress', value: 'In Progress' },
                      { label: 'Completed', value: 'Completed' }
                    ]}
                    filterOption={(input, option) =>
                      option?.label?.toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent="Type custom status"
                    tagRender={(props) => {
                      const { label, value, closable, onClose } = props;
                      return (
                        <Tag
                          closable={closable}
                          onClose={onClose}
                          style={{ marginRight: 3 }}
                        >
                          {value || label}
                        </Tag>
                      );
                    }}
                    open={false}
                    defaultActiveFirstOption={false}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item label="Invoice Details" name="invoice_details">
              <Input.TextArea rows={3} placeholder="Enter invoice details or notes" />
            </Form.Item>
            <Form.Item
              label="Invoice Status"
              name="invoice_status"
              rules={[{ required: true, message: 'Please select invoice status' }]}
            >
              <Select options={[
                { label: 'Pending', value: 'Pending' },
                { label: 'Generated', value: 'Generated' },
                { label: 'Submitted', value: 'Submitted' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Paid', value: 'Paid' },
                { label: 'Rejected', value: 'Rejected' }
              ]} />
            </Form.Item>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                onClick={() => {
                  setStageDetailModalVisible(false)
                  setSelectedStageForDetail(null)
                  stageDetailForm.resetFields()
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingStageDetail}>
                Save Details
              </Button>
            </div>
          </Form>
        </Modal>
        <Modal
          title={`Upload Document - ${selectedStageForUpload?.stage_name}`}
          open={uploadModalVisible}
          onCancel={handleCloseUploadModal}
          footer={[
            <Button key="cancel" onClick={handleCloseUploadModal}>Cancel</Button>,
            <Button key="upload" type="primary" loading={uploading} onClick={handleUpload}>Upload</Button>
          ]}
          width={600}
        >
          <Space direction="vertical" size="large" className="w-full">
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Click or drag file to this area</p>
            </Dragger>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm">Attachments (optional)</Text>
                <label
                  htmlFor="project-attachment-input"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  <PlusOutlined style={{ fontSize: 12 }} />
                </label>
                <input
                  id="project-attachment-input"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleAddAttachments}
                />
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attachments.map((file, index) => (
                    <Tag
                      key={`${file.name}-${index}`}
                      closable
                      onClose={() => handleRemoveAttachment(index)}
                    >
                      {file.name.length > 24 ? file.name.slice(0, 21) + '...' : file.name}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            <Input placeholder="Document Name *" value={documentName} disabled />
            <div>
              <Input
                placeholder="Version"
                value={documentVersion || suggestedVersion}
                onChange={(e) => setDocumentVersion(e.target.value)}
                addonBefore="Auto Version"
                addonAfter={suggestedVersion}
              />
              {existingDocuments.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  Existing versions: {existingDocuments.map(doc => `v${doc.version}`).join(', ')}
                </div>
              )}
            </div>
            <TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <Input placeholder="Your Name *" value={uploadedBy} disabled />
          </Space>
        </Modal>

        <Modal
          title={`Edit Document - ${selectedDocumentForEdit?.name || 'Document'}`}
          open={editDocumentModalVisible}
          onCancel={handleCloseEditDocumentModal}
          footer={[
            <Button key="cancel" onClick={handleCloseEditDocumentModal}>Cancel</Button>,
            <Button key="update" type="primary" loading={updatingDocument} onClick={handleUpdateDocument}>Update</Button>
          ]}
          width={500}
        >
          <Space direction="vertical" size="large" className="w-full">
            <Input
              placeholder="Version"
              value={editingDocumentVersion}
              onChange={(e) => setEditingDocumentVersion(e.target.value)}
              addonBefore="Version:"
            />
            <TextArea
              placeholder="Description"
              value={editingDocumentDescription}
              onChange={(e) => setEditingDocumentDescription(e.target.value)}
              rows={3}
            />
          </Space>
        </Modal>

        <Modal
          title={`${editingRemark ? 'Edit' : 'Add'} Remark - ${selectedStageForRemarks?.stage_name}`}
          open={remarksModalVisible}
          onCancel={() => {
            setRemarksModalVisible(false)
            setEditingRemark(null)
            setRemarksText('')
            setRemarksBy('')
          }}
          footer={[
            <Button key="cancel" onClick={() => {
              setRemarksModalVisible(false)
              setEditingRemark(null)
              setRemarksText('')
              setRemarksBy('')
            }}>Cancel</Button>,
            <Button key="submit" type="primary" loading={submittingRemarks} onClick={handleSubmitRemarks}>
              {editingRemark ? 'Update' : 'Submit'}
            </Button>
          ]}
          width={600}
        >
          <Space direction="vertical" size="large" className="w-full">
            <TextArea placeholder="Enter your remarks *" value={remarksText} onChange={(e) => setRemarksText(e.target.value)} rows={4} />
            <Input placeholder="Your Name *" value={remarksBy} disabled />
          </Space>
        </Modal>

        <Modal
          title={
            <div className="flex justify-between items-center w-full">
              <span>Document Viewer</span>
              <div className="space-x-2">
                <Button
                  size="small"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                >
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
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
                >
                  Close Viewer
                </Button>
              </div>
            </div>
          }
          open={!!viewDocumentUrl}
          closable={false}
          maskClosable={false}
          keyboard={false}
          footer={null}
          width={isFullscreen ? '100vw' : 1100}
          style={{
            top: isFullscreen ? 0 : undefined,
            maxWidth: isFullscreen ? '100vw' : undefined,
            margin: isFullscreen ? 0 : undefined,
            paddingBottom: isFullscreen ? 0 : undefined
          }}
          bodyStyle={{
            height: isFullscreen ? 'calc(100vh - 120px)' : 'auto',
            padding: isFullscreen ? 0 : '24px'
          }}
        >
          {(() => {
            const currentUrl = viewDocumentUrl || ''
            const urlNoQuery = currentUrl.split('#')[0].split('?')[0]
            const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
            const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
            const isOffice = officeTypes.includes(ext)
            const directPreviewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt'].includes(ext)

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
                      <div className="text-6xl mb-4"> spreadsheet</div>
                      <h3 className="text-xl font-semibold">Excel Viewer Error</h3>
                      <p className="text-gray-500 text-center max-w-md">{excelRendererError}</p>
                      <div className="space-x-2">
                        <Button
                          type="primary"
                          icon={<LinkOutlined />}
                          onClick={() => window.open(currentUrl, '_blank')}
                        >
                          Download File
                        </Button>
                        <Button
                          onClick={() => loadExcelWithRenderer(currentUrl)}
                        >
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
                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
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
                            onClick={() => window.open(currentUrl, '_blank')}
                            icon={<LinkOutlined />}
                          >
                            Download
                          </Button>
                          <Button
                            size="small"
                            onClick={() => loadExcelWithRenderer(currentUrl)}
                          >
                            Refresh
                          </Button>
                        </div>
                      </div>

                      <div className={`${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[70vh]'} border rounded p-4`}>
                        <style jsx>{`
                          .excel-scroll-container::-webkit-scrollbar {
                            width: 12px;
                            height: 12px;
                          }
                          .excel-scroll-container::-webkit-scrollbar-track {
                            background: #f1f1f1;
                            border-radius: 4px;
                          }
                          .excel-scroll-container::-webkit-scrollbar-thumb {
                            background: #c1c1c1;
                            border-radius: 4px;
                          }
                          .excel-scroll-container::-webkit-scrollbar-thumb:hover {
                            background: #a8a8a8;
                          }
                          .excel-scroll-container {
                            scrollbar-width: thin;
                            scrollbar-color: #c1c1c1 #f1f1f1;
                            overflow: scroll !important;
                          }
                        `}</style>
                        {(() => {
                          // Get current sheet data
                          const currentSheet = excelRendererData.sheets ? excelRendererData.sheets[activeSheetIndex] : excelRendererData
                          const currentRows = currentSheet?.rows || excelRendererData.rows || []
                          const currentCols = currentSheet?.cols || excelRendererData.cols || []

                          return currentRows.length > 0 ? (
                            <div className="excel-scroll-container h-full">
                              <Table
                                dataSource={currentRows.map((row, index) => {
                                  const transformedRow = { key: index }
                                  Object.keys(row).forEach(key => {
                                    const value = row[key]
                                    // Convert objects to strings, handle null/undefined
                                    if (value && typeof value === 'object') {
                                      transformedRow[key] = value.name || value.value || JSON.stringify(value)
                                    } else {
                                      transformedRow[key] = value !== null && value !== undefined ? String(value) : ''
                                    }
                                  })
                                  return transformedRow
                                })}
                                columns={currentCols.map((col, index) => ({
                                  title: typeof col === 'object' ? (col.name || col.value || `Column ${index + 1}`) : String(col),
                                  dataIndex: index.toString(),
                                  key: index.toString(),
                                  ellipsis: true,
                                  width: 180,
                                  render: (text) => {
                                    // Ensure we always render a string or valid React child
                                    if (text === null || text === undefined) return ''
                                    if (typeof text === 'object') return String(text.name || text.value || JSON.stringify(text))
                                    return String(text)
                                  }
                                }))}
                                pagination={false}
                                scroll={{
                                  x: 'max-content',
                                  y: isFullscreen ? 'calc(100vh - 180px)' : 'calc(70vh - 120px)'
                                }}
                                size="small"
                                bordered
                                tableLayout="fixed"
                                className="excel-table"
                              />
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-gray-500">No data found in Excel file</p>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                }

                // Initial state - show loading
                return (
                  <div className="flex items-center justify-center h-[60vh]">
                    <Spin size="large" tip="Loading Excel file..." />
                  </div>
                )
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
                      <div className="text-6xl mb-4"> document</div>
                      <h3 className="text-xl font-semibold">Word Document Error</h3>
                      <p className="text-gray-500 text-center max-w-md">{wordDocumentError}</p>
                      <div className="space-x-2">
                        <Button
                          type="primary"
                          icon={<LinkOutlined />}
                          onClick={() => window.open(currentUrl, '_blank')}
                        >
                          Download Document
                        </Button>
                        <Button
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
                    <div className={`w-full ${isFullscreen ? 'h-full' : 'h-[80vh]'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Word Document Viewer - Mammoth.js</h3>
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

                      <div className={`${isFullscreen ? 'h-[calc(100vh-140px)]' : 'h-[70vh]'} overflow-auto border rounded p-6 bg-white`}>
                        <div
                          className="word-document-content"
                          dangerouslySetInnerHTML={{ __html: wordDocumentContent }}
                          style={{
                            fontFamily: 'Arial, sans-serif',
                            lineHeight: '1.6',
                            color: '#333'
                          }}
                        />
                      </div>
                    </div>
                  )
                }

                // Initial state - show loading
                return (
                  <div className="flex items-center justify-center h-[60vh]">
                    <Spin size="large" tip="Loading Word document..." />
                  </div>
                )
              }

              // For other Office files, show download option
              return (
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                  <div className="text-6xl mb-4">{
                    ext === 'pptx' || ext === 'ppt' ? ' presentation' :
                      ' document'
                  }</div>
                  <h3 className="text-xl font-semibold">
                    {ext ? ext.toUpperCase() : 'Document'}
                  </h3>
                  <p className="text-gray-500 text-center max-w-md">
                    This document type cannot be previewed directly. Please download to view.
                  </p>
                  <Button
                    type="primary"
                    size="large"
                    icon={<LinkOutlined />}
                    onClick={() => window.open(currentUrl, '_blank')}
                    className="mt-4"
                  >
                    Download Document
                  </Button>
                </div>
              )
            }

            // Files that can be previewed directly (PDF, images, text)
            if (directPreviewable) {
              if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
                return (
                  <div className={`w-full ${isFullscreen ? 'h-full' : 'h-[80vh]'} flex items-center justify-center bg-white`}>
                    <img
                      src={currentUrl}
                      alt="Document"
                      className={`max-w-full ${isFullscreen ? 'max-h-[calc(100vh-120px)]' : 'max-h-[80vh]'} object-contain`}
                    />
                  </div>
                )
              }
              return <iframe src={currentUrl} className={`w-full ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[80vh]'}`} title="Document" />
            }

            // Unknown file types - offer download
            return (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="text-6xl mb-4"> attachment</div>
                <h3 className="text-xl font-semibold">Document Preview</h3>
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(currentUrl, '_blank')}
                  className="mt-4"
                >
                  Open / Download
                </Button>
              </div>
            )
          })()}
        </Modal>

        <Modal
          title={`Allotment Sheet - ${selectedStageForAllotment?.stage_name || ''}`}
          open={allotmentModalVisible}
          onCancel={handleCloseAllotmentModal}
          footer={null}
          width={900}
        >
          <div className="bg-white text-black p-8 max-h-[80vh] overflow-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold">PP &amp; BD DEPT</h2>
            </div>

            {loadingAllotment && (
              <div className="py-10 text-center text-slate-500">Loading allotment sheet...</div>
            )}

            {!loadingAllotment && (
              <>

                <div className="flex justify-between mb-2">
                  <div>
                    <span className="mr-2 font-semibold">Released to C -</span>
                    <span className="mr-2 font-semibold">
                      {allotmentData?.center || ''}
                    </span>
                  </div>
                  <div>
                    <span className="mr-2 font-semibold">Date:</span>
                    <span className="mr-2 font-semibold">
                      {allotmentData?.order_date || ''}
                    </span>
                  </div>
                </div>

                <div className="mb-1">
                  <div className=" inline-block px-4 py-1 font-semibold">
                    {allotmentData?.activity || 'Project Name'}
                  </div>
                </div>

                <div className="space-y-2 mb-8 text-sm">
                  <div>
                    <span className="font-semibold mr-2">Customer:</span>
                    <span className="inline-block min-w-[300px] align-middle">
                      {`${allotmentData?.party_name || ''}${allotmentData?.address ? ', ' + allotmentData.address : ''
                        }`}
                    </span>
                  </div>


                  <div>
                    <span className="font-semibold mr-2">Contact Person:</span>
                    <span className="inline-block min-w-[300px]  align-middle"> {allotmentData?.email || ''} </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Project Co-ordinator:</span>
                    <span className="inline-block min-w-[300px]  align-middle">
                      {allotmentData?.project_co_ordinator || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Email &amp; Contact details:</span>
                    <span className="inline-block min-w-[300px]  align-middle">

                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Project Number:</span>
                    <span className="inline-block min-w-[300px] font-semibold align-middle">
                      {allotmentData?.project_number || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Project Name:</span>
                    <span className="inline-block min-w-[300px] font-semibold  align-middle">
                      {allotmentData?.activity || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Order Value:</span>
                    <span className="inline-block min-w-[300px]  align-middle">
                      {allotmentData?.order_value || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Purchase order No:</span>
                    <span className="inline-block min-w-[300px]  align-middle">
                      {allotmentData?.order_number || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold mr-2">Delivery date:</span>
                    <span className="inline-block min-w-[300px]  align-middle">
                      {formatDDMMYYYY(allotmentData?.delivery_date)}
                    </span>
                  </div>
                </div>

                <div className="mb-8">
                  <table className="w-full border border-black text-xs">
                    <thead>
                      <tr>
                        <th className="border border-black px-2 py-1 text-left">Description</th>
                        <th className="border border-black px-2 py-1 text-left">Full / Stage Payment</th>
                        <th className="border border-black px-2 py-1 text-left">Invoice No and Amount</th>
                        <th className="border border-black px-2 py-1 text-left">Invoice Date</th>
                        <th className="border border-black px-2 py-1 text-left">Payment Received</th>
                        <th className="border border-black px-2 py-1 text-left">Payment Received Date</th>
                        <th className="border border-black px-2 py-1 text-left">Balance amount and remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allotmentData?.payments && Array.isArray(allotmentData.payments) && allotmentData.payments.length > 0 ? (
                        allotmentData.payments.map((row, idx) => (
                          <tr key={row.id || idx}>
                            <td className="border border-black px-2 py-1">{row.description || ''}</td>
                            <td className="border border-black px-2 py-1">{row.invoice_no || ''}</td>
                            <td className="border border-black px-2 py-1">{row.invoice_date || ''}</td>
                            <td className="border border-black px-2 py-1">{row.amount_recieved || ''}</td>
                            <td className="border border-black px-2 py-1">{row.recieved_date || ''}</td>
                            <td className="border border-black px-2 py-1">{row.bal || ''}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="border border-black px-2 py-1 text-center text-gray-500">
                            No payment records available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '24px'
                    }}>
                      <div style={{ fontWeight: 600 }}>Copy to:</div>
                      <div style={{ fontWeight: 600, textAlign: 'right', marginLeft: '600px' }}>
                        CH (PP&amp;BD)
                      </div>
                    </div>

                    <table style={{ border: 'none', margin: 0 }}>
                      <tr>
                        <td style={{ border: 'none', padding: '4px 50px 4px 10px' }}>GH (P&S)</td>
                        <td style={{ border: 'none', padding: '4px 50px' }}>Sr. CAO</td>
                        <td style={{ border: 'none', padding: '4px 50px' }}>GH (C-{allotmentData?.center || ''})</td>
                        <td style={{ border: 'none', padding: '4px 10px 4px 50px' }}>CH (C-{allotmentData?.center || ''})</td>
                      </tr>
                    </table>
                  </div>
                </div>

                <div style={{ marginTop: '16px', fontWeight: 600, fontSize: '12px' }}>
                  Director: For kind information
                </div>


              </>
            )}
          </div>
        </Modal>

      </div>
    )
  }

  // Render project card
  const renderProjectCard = (project) => {
    const theme = getProjectTheme(project.project_number)
    return (
      <Card
        key={safeId(project)}
        hoverable
        className={`shadow-sm border ${theme.cardClass}`}
      >
        <Space direction="vertical" size="middle" className="w-full">
          <div className="flex items-center justify-between">
            <div>
              <Text type="secondary">Project No.</Text>
              <Text strong className="block text-lg">{formatValue(project.project_number)}</Text>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${theme.pillClass}`}>
              {theme.pillLabel}
            </span>
          </div>
          <div><Text type="secondary">Activity:</Text> <Text>{formatValue(project.activity)}</Text></div>
          <div><Text type="secondary">Coordinator:</Text> <Text>{formatValue(project.project_co_ordinator)}</Text></div>
          {project.center && (
            <div><Text type="secondary">Centre:</Text> <Text>{formatValue(project.center)}</Text></div>
          )}
          <Button type="primary" icon={<EyeOutlined />} onClick={() => handleViewProject(project)}>
            View Details
          </Button>
        </Space>
      </Card>
    )
  }

  // Projects list view
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <Title level={3}>Projects</Title>

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <Input.Search
          placeholder="Search by project number, activity or coordinator..."
          allowClear
          enterButton
          size="large"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onSearch={value => setSearchText(value)}
          style={{ width: 420, maxWidth: '100%' }}
        />

        {!(isGHOrScientist || isCH) && (
          <Select
            placeholder="Filter by centre"
            allowClear
            size="large"
            style={{ width: 240 }}
            options={centerOptions}
            value={selectedCenter}
            onChange={setSelectedCenter}
          />
        )}

        {isCH && (
          <Select
            placeholder="Filter by group"
            allowClear
            size="large"
            style={{ width: 240 }}
            options={groupOptions}
            value={selectedGroup}
            onChange={setSelectedGroup}
          />
        )}

        {isGHOrScientist && (
          <Select
            placeholder="Filter by coordinator"
            allowClear
            size="large"
            style={{ width: 240 }}
            options={coordinatorOptions}
            value={selectedCoordinator}
            onChange={setSelectedCoordinator}
          />
        )}

        {(searchText || selectedCenter || selectedGroup || selectedCoordinator || selectedProjectType !== 'ALL') && (
          <Button type="default" size="large" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Show count of filtered projects */}
      <Text type="secondary" className="block mb-4">
        {filteredCards.length} {filteredCards.length === 1 ? 'project' : 'projects'} found
        {Object.keys(groupedProjects).length > 1 && (
          <span className="ml-2">
            ({Object.entries(groupedProjects).map(([type, items]) => `${items.length} ${type}`).join(', ')})
          </span>
        )}
      </Text>

      <Tabs
        activeKey={selectedProjectType}
        onChange={setSelectedProjectType}
        className="mb-6"
        items={[
          {
            key: 'ALL',
            label: `All (${filteredCards.length})`,
          },
          ...projectTypeOrder
            .filter((type) => (groupedProjects[type]?.length || 0) > 0)
            .map((type) => {
              const count = groupedProjects[type]?.length || 0
              return {
                key: type,
                label: `${type} (${count})`,
              }
            }),
        ]}
      />

      {filteredCards.length === 0 ? (
        <Empty description="No projects match the current filters" />
      ) : (
        <div className="space-y-8">
          {projectTypeOrder.map((type) => {
            if (selectedProjectType !== 'ALL' && selectedProjectType !== type) return null
            const projects = groupedProjects[type]
            if (!projects || projects.length === 0) return null

            const config = projectTypeConfig[type]
            const colorClasses = {
              blue: 'border-blue-200 text-blue-700 bg-blue-100',
              indigo: 'border-indigo-200 text-indigo-700 bg-indigo-100',
              emerald: 'border-emerald-200 text-emerald-700 bg-emerald-100',
              amber: 'border-amber-200 text-amber-700 bg-amber-100',
              purple: 'border-purple-200 text-purple-700 bg-purple-100',
              teal: 'border-teal-200 text-teal-700 bg-teal-100',
              cyan: 'border-cyan-200 text-cyan-700 bg-cyan-100',
              rose: 'border-rose-200 text-rose-700 bg-rose-100',
              slate: 'border-slate-200 text-slate-700 bg-slate-100'
            }
            const dotColors = {
              blue: 'bg-blue-500',
              indigo: 'bg-indigo-500',
              emerald: 'bg-emerald-500',
              amber: 'bg-amber-500',
              purple: 'bg-purple-500',
              teal: 'bg-teal-500',
              cyan: 'bg-cyan-500',
              rose: 'bg-rose-500',
              slate: 'bg-slate-500'
            }

            return (
              <div key={type}>
                <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${colorClasses[config.color].split(' ')[0]}`}>
                  <div className={`w-3 h-3 rounded-full ${dotColors[config.color]}`}></div>
                  <Title level={4} className={`!mb-0 !${colorClasses[config.color].split(' ')[1]}`}>
                    {config.label}
                  </Title>
                  <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colorClasses[config.color].split(' ')[2]} ${colorClasses[config.color].split(' ')[1]}`}>
                    {projects.length}
                  </span>
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {projects.map((project) => renderProjectCard(project))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Projects