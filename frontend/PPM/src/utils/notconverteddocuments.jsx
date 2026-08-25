import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  Popconfirm,
  Select,
  Table,
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
import AllISODocuments from '../isopages/allisodocuments.jsx'

const { Title, Text } = Typography

const { TextArea } = Input
const { Dragger } = Upload

const safeId = (item) => item?.id ?? item?.key ?? ''

/**
 * Check if a proposal is NOT converted to a project (proposals_converted !== 'Yes', including 'No', null, or empty).
 */
export const isProposalNotConverted = (proposalsConverted) => {
  if (proposalsConverted === null || proposalsConverted === undefined || String(proposalsConverted).trim() === '') {
    return true // null or empty is treated as not converted
  }
  const convertedValue = String(proposalsConverted).toLowerCase().trim()
  return convertedValue !== 'yes'
}

/**
 * Helper to fetch only NOT CONVERTED proposals/projects based on user role (Scientist, Admin, GH, CH).
 */
export const fetchNotConvertedProposals = async (customUserInfo = null) => {
  try {
    let url = `${API_BASE_URL}/proposals/`
    let user = customUserInfo

    if (!user) {
      try {
        const rawUser = window.localStorage.getItem('ppm_user')
        if (rawUser) user = JSON.parse(rawUser)
      } catch (err) {
        console.error('Error parsing ppm_user from localStorage:', err)
      }
    }

    if (user) {
      const role = user?.role || ''
      const name = user?.name || ''
      const center = (user?.center || '').trim()
      const group = (user?.group || '').trim()
      const roleLower = role.toLowerCase().trim()

      if (roleLower === 'gh' || roleLower === 'group head') {
        if (group) {
          url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(group)}`
        } else {
          url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(name)}?user_role=${encodeURIComponent(roleLower)}`
        }
      } else if (roleLower === 'scientist') {
        const roleQuery = role ? `?user_role=${encodeURIComponent(roleLower)}` : ''
        url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(name)}${roleQuery}`
      } else if (roleLower === 'ch' || roleLower === 'center head') {
        url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(center)}`
      }
    }

    let res = await fetch(url)
    if (!res.ok) {
      console.warn(`Fetch ${url} returned ${res.status}, falling back to all proposals`)
      res = await fetch(`${API_BASE_URL}/proposals/`)
    }
    const data = await res.json()
    const proposalsArray = Array.isArray(data) ? data : []

    // Filter ONLY NOT CONVERTED proposals (proposals_converted !== 'yes')
    const notConvertedList = proposalsArray.filter((item) =>
      isProposalNotConverted(item.proposals_converted)
    )

    return notConvertedList
  } catch (error) {
    console.error('Error in fetchNotConvertedProposals:', error)
    message.error('Failed to load not converted proposals')
    return []
  }
}

/**
 * Helper to fetch stage-wise documents for a non-converted proposal/project.
 */
export const fetchNotConvertedStageDocuments = async (projectId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/proposals/stage_wise/${projectId}`)
    if (!res.ok) {
      throw new Error('Failed to fetch stage data')
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error fetching stage documents:', error)
    message.error('Failed to load stage document data')
    return []
  }
}

/**
 * Upload stage document for non-converted proposal/project.
 */
export const uploadNotConvertedDocument = async (formData) => {
  const res = await fetch(`${API_BASE_URL}/documents/`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Upload failed')
    throw new Error(err || 'Upload failed')
  }
  return await res.json()
}

/**
 * Update stage document details.
 */
export const updateNotConvertedDocument = async (documentId, formData) => {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'PUT',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Update failed')
    throw new Error(err || 'Update failed')
  }
  return await res.json()
}

/**
 * Delete stage document.
 */
export const deleteNotConvertedDocument = async (documentId) => {
  const res = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Delete failed')
    throw new Error(err || 'Delete failed')
  }
  return true
}

/**
 * Parse & Load Excel document for preview.
 */
export const loadExcelFile = async (url, setExcelLoading, setExcelData, setExcelError) => {
  setExcelLoading(true)
  setExcelError(null)
  setExcelData(null)
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
    const blob = await response.blob()
    const file = new File([blob], 'excel.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    ExcelRenderer(file, (err, resp) => {
      if (err) {
        setExcelError(`Failed to parse Excel file: ${err.message || err}`)
      } else {
        setExcelData(resp)
      }
      setExcelLoading(false)
    })
  } catch (error) {
    setExcelError(`Error loading Excel file: ${error.message}`)
    setExcelLoading(false)
  }
}

/**
 * Convert & Load Word document for preview.
 */
export const loadWordFile = async (url, setWordLoading, setWordContent, setWordError) => {
  setWordLoading(true)
  setWordError(null)
  setWordContent(null)
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    setWordContent(result.value)
  } catch (error) {
    setWordError(`Error loading Word document: ${error.message}`)
  } finally {
    setWordLoading(false)
  }
}

/**
 * Main React Component to show and manage documents for NOT CONVERTED proposals/projects
 * across Scientist, Admin, GH, and CH roles (built exactly like Projects.jsx).
 */
export const NotConvertedDocumentsView = () => {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  // Current logged in user info
  const [currentUserName] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      return rawUser ? (JSON.parse(rawUser)?.name || '').trim() : ''
    } catch (e) {
      return ''
    }
  })

  const [currentUserRole] = useState(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      return rawUser ? (JSON.parse(rawUser)?.role || '').toLowerCase().trim() : ''
    } catch (e) {
      return ''
    }
  })

  // Selected non-converted proposal & stage details
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [stageData, setStageData] = useState([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [stageConfig, setStageConfig] = useState([])

  // Document preview states
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null)
  const [excelRendererData, setExcelRendererData] = useState(null)
  const [excelRendererLoading, setExcelRendererLoading] = useState(false)
  const [excelRendererError, setExcelRendererError] = useState(null)
  const [activeSheetIndex, setActiveSheetIndex] = useState(0)
  const [wordDocumentContent, setWordDocumentContent] = useState(null)
  const [wordDocumentLoading, setWordDocumentLoading] = useState(false)
  const [wordDocumentError, setWordDocumentError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // ISO Documents Full Page View state
  const [selectedIsoProposal, setSelectedIsoProposal] = useState(null)



  // Upload modal states
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

  // Edit document modal states
  const [editDocumentModalVisible, setEditDocumentModalVisible] = useState(false)
  const [selectedDocumentForEdit, setSelectedDocumentForEdit] = useState(null)
  const [editingDocumentVersion, setEditingDocumentVersion] = useState('')
  const [editingDocumentDescription, setEditingDocumentDescription] = useState('')
  const [updatingDocument, setUpdatingDocument] = useState(false)

  // Filter states
  const [searchText, setSearchText] = useState('')
  const [selectedCenter, setSelectedCenter] = useState(undefined)
  const [selectedGroup, setSelectedGroup] = useState(undefined)
  const [selectedCoordinator, setSelectedCoordinator] = useState(undefined)

  const isGuest = currentUserRole === 'guest' || currentUserRole === 'role'
  const isReadOnly =
    isGuest ||
    currentUserRole === 'ch' ||
    currentUserRole === 'center head' ||
    currentUserRole === 'gh' ||
    currentUserRole === 'group head'
  const isGHOrScientist =
    currentUserRole === 'scientist' ||
    currentUserRole === 'gh' ||
    currentUserRole === 'group head'
  const isCH = currentUserRole === 'ch' || currentUserRole === 'center head'

  // Extract center options (for Admin)
  const centerOptions = useMemo(() => {
    const centers = [...new Set(proposals.map((p) => p.center?.trim()).filter(Boolean))]
    return centers.sort().map((c) => ({ label: c, value: c }))
  }, [proposals])

  // Extract group options (for CH)
  const groupOptions = useMemo(() => {
    const groups = [...new Set(proposals.map((p) => p.group?.trim()).filter(Boolean))]
    return groups.sort().map((g) => ({ label: g, value: g }))
  }, [proposals])

  // Extract coordinator options (for GH/Scientist)
  const coordinatorOptions = useMemo(() => {
    const coordinators = [
      ...new Set(
        proposals
          .flatMap((p) => [p.quotation_given_by_name?.trim(), p.project_co_ordinator?.trim()])
          .filter(Boolean)
      ),
    ]
    return coordinators.sort().map((c) => ({ label: c, value: c }))
  }, [proposals])

  const handleClearFilters = () => {
    setSearchText('')
    setSelectedCenter(undefined)
    setSelectedGroup(undefined)
    setSelectedCoordinator(undefined)
  }

  // Fetch stage configurations
  const fetchStageConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stages/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) return []
      const data = await res.json()
      const normalized = Array.isArray(data)
        ? data.map((item) => ({ ...item, key: item.id }))
        : []
      setStageConfig(normalized)
      return normalized
    } catch (err) {
      console.error('Error fetching stage config:', err)
      return []
    }
  }, [])

  // Load Not Converted proposals on mount
  const loadNotConvertedData = useCallback(async () => {
    setLoading(true)
    try {
      await fetchStageConfig()
      const notConvertedList = await fetchNotConvertedProposals()
      setProposals(notConvertedList)
    } finally {
      setLoading(false)
    }
  }, [fetchStageConfig])

  useEffect(() => {
    loadNotConvertedData()
  }, [loadNotConvertedData])

  // Load stage data for selected non-converted proposal
  const handleViewProposal = async (proposal) => {
    setSelectedProposal(proposal)
    const pid = safeId(proposal)
    if (!pid) return

    setLoadingStages(true)
    try {
      const stages = await fetchNotConvertedStageDocuments(pid)
      setStageData(stages)
    } finally {
      setLoadingStages(false)
    }
  }

  const handleBackToList = () => {
    setSelectedProposal(null)
    setStageData([])
  }

  // Document Upload Handlers
  const handleOpenUploadModal = async (stage) => {
    setSelectedStageForUpload(stage)
    setUploadModalVisible(true)
    setFileToUpload(null)
    setDocumentName((stage.stage_name || 'Document').toString())
    setUploadedBy(currentUserName || '')
    setDescription('')
    setAttachments([])

    try {
      const res = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (res.ok) {
        const allDocuments = await res.json()
        const filteredDocs = (Array.isArray(allDocuments) ? allDocuments : []).filter(
          (doc) =>
            doc.project_id === safeId(selectedProposal) &&
            doc.stage_id === stage.stage_id &&
            doc.name === (stage.stage_name || 'Document')
        )
        setExistingDocuments(filteredDocs)

        if (filteredDocs.length > 0) {
          const versions = filteredDocs.map((doc) => parseInt(doc.version) || 0)
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

  const handleUploadSubmit = async () => {
    if (!fileToUpload) return message.error('Please select a file')
    const uploader = (uploadedBy || currentUserName || '').trim()
    if (!uploader) return message.error('Your name is required')

    setUploading(true)
    const formData = new FormData()
    formData.append('name', documentName.trim())
    formData.append('description', description.trim())
    formData.append('project_id', safeId(selectedProposal))
    formData.append('stage_id', selectedStageForUpload.stage_id)
    formData.append('uploaded_by', uploader)
    formData.append('version', documentVersion || suggestedVersion)
    formData.append('file', fileToUpload)
    attachments.forEach((att) => {
      formData.append('attachment', att)
    })

    try {
      await uploadNotConvertedDocument(formData)
      message.success('Document uploaded successfully!')
      handleCloseUploadModal()
      const updatedStages = await fetchNotConvertedStageDocuments(safeId(selectedProposal))
      setStageData(updatedStages)
    } catch (err) {
      console.error('Upload error:', err)
      message.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Document Edit Handlers
  const handleOpenEditModal = (doc) => {
    setSelectedDocumentForEdit(doc)
    setEditingDocumentVersion(doc.version || '')
    setEditingDocumentDescription(doc.description || '')
    setEditDocumentModalVisible(true)
  }

  const handleCloseEditModal = () => {
    setEditDocumentModalVisible(false)
    setSelectedDocumentForEdit(null)
    setEditingDocumentVersion('')
    setEditingDocumentDescription('')
  }

  const handleUpdateSubmit = async () => {
    if (!selectedDocumentForEdit) return
    setUpdatingDocument(true)
    const formData = new FormData()
    formData.append('version', editingDocumentVersion.trim())
    formData.append('description', editingDocumentDescription.trim())

    try {
      await updateNotConvertedDocument(selectedDocumentForEdit.id, formData)
      message.success('Document updated successfully!')
      handleCloseEditModal()
      const updatedStages = await fetchNotConvertedStageDocuments(safeId(selectedProposal))
      setStageData(updatedStages)
    } catch (err) {
      console.error('Update error:', err)
      message.error('Failed to update document')
    } finally {
      setUpdatingDocument(false)
    }
  }

  // Document Delete Handler
  const handleDeleteDoc = async (docId) => {
    try {
      await deleteNotConvertedDocument(docId)
      message.success('Document deleted successfully!')
      const updatedStages = await fetchNotConvertedStageDocuments(safeId(selectedProposal))
      setStageData(updatedStages)
    } catch (err) {
      console.error('Delete error:', err)
      message.error('Failed to delete document')
    }
  }

  // Document View Handler
  const handleOpenViewDoc = (url) => {
    setViewDocumentUrl(url)
    const urlNoQuery = url.split('#')[0].split('?')[0]
    const ext = (urlNoQuery.split('.').pop() || '').toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      loadExcelFile(url, setExcelRendererLoading, setExcelRendererData, setExcelRendererError)
    } else if (ext === 'docx' || ext === 'doc') {
      loadWordFile(url, setWordDocumentLoading, setWordDocumentContent, setWordDocumentError)
    }
  }

  // Filtered Non-Converted Proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const searchLower = searchText.toLowerCase().trim()
      if (searchLower) {
        const inNum = p.project_number?.toString().toLowerCase().includes(searchLower)
        const inAct = p.activity?.toLowerCase().includes(searchLower)
        const inQuote = p.quote_description?.toLowerCase().includes(searchLower)
        const inCoord = (p.quotation_given_by_name || p.project_co_ordinator)?.toLowerCase().includes(searchLower)
        const inCust = p.customer_name?.toLowerCase().includes(searchLower)
        if (!(inNum || inAct || inQuote || inCoord || inCust)) return false
      }

      if (isGHOrScientist) {
        if (
          selectedCoordinator &&
          p.quotation_given_by_name?.trim() !== selectedCoordinator &&
          p.project_co_ordinator?.trim() !== selectedCoordinator
        )
          return false
      } else if (isCH) {
        if (selectedGroup && p.group?.trim() !== selectedGroup) return false
      } else {
        if (selectedCenter && p.center?.trim() !== selectedCenter) return false
      }
      return true
    })
  }, [proposals, searchText, selectedCenter, selectedGroup, selectedCoordinator, isGHOrScientist, isCH])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" tip="Loading Not Converted Documents..." />
      </div>
    )
  }

  // Selected non-converted proposal detailed view
  if (selectedProposal) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToList}
              size="large"
            />
            <div>
              <Title level={3} className="!mb-0">
                <FileTextOutlined /> Not Converted Proposal: {selectedProposal.quote_description || selectedProposal.activity || selectedProposal.project_number || selectedProposal.id}
              </Title>
              <Text type="secondary">{selectedProposal.customer_name || selectedProposal.activity}</Text>
              <Tag color="red" className="ml-3">Not Converted</Tag>
            </div>
          </div>
        </div>

        {(() => {
          const filteredNotConvertedStages = stageData
            .filter((stage) => {
              const config = stageConfig.find((s) => s.id === stage.stage_id)
              const pos = config?.position ?? stage.position ?? 999
              return typeof pos === 'number' && pos <= 3
            })
            .sort((a, b) => {
              const configA = stageConfig.find((s) => s.id === a.stage_id)
              const configB = stageConfig.find((s) => s.id === b.stage_id)
              const posA = configA?.position ?? a.position ?? 999
              const posB = configB?.position ?? b.position ?? 999
              return posA - posB
            })

          if (loadingStages) {
            return (
              <div className="py-20 text-center">
                <Spin size="large" tip="Loading stage documents..." />
              </div>
            )
          }

          if (filteredNotConvertedStages.length === 0) {
            return <Empty description="No stage documents found (Positions 1 to 3)" />
          }

          return (
            <div className="space-y-6">
              {filteredNotConvertedStages.map((stage) => {
                const stageName = (stage.stage_name || 'Stage').trim()
                const hasDocs = Array.isArray(stage.documents) && stage.documents.length > 0

              return (
                <div key={stage.stage_id ?? stageName} className="border rounded-xl p-6 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <Title level={4} className="!mb-0">
                      {(() => {
                        const config = stageConfig.find((s) => s.id === stage.stage_id)
                        const position = config?.position ?? stage.position ?? '-'
                        return <Tag color="orange">{position}</Tag>
                      })()}{' '}
                      {stageName}
                    </Title>
                    {!isReadOnly && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={() => handleOpenUploadModal(stage)}
                      >
                        Upload Document
                      </Button>
                    )}
                  </div>

                  {hasDocs ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {stage.documents.map((doc) => (
                        <Card key={doc.id} size="small" className="border-l-4 border-l-orange-500 relative">
                          <div className="pr-8">
                            <Text strong>
                              {doc.name ? `${doc.name.substring(0, 30)}${doc.name.length > 30 ? '...' : ''}` : 'Document'} - Version {doc.version || 'N/A'}
                            </Text>
                            {doc.description && (
                              <Text type="secondary" className="block text-xs mt-1">
                                {doc.description}
                              </Text>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              <UserOutlined /> {doc.uploaded_by || 'Unknown'} • <CalendarOutlined /> {formatDateTime(doc.updated_at)}
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
                                    onClick={() => handleOpenViewDoc(url)}
                                  >
                                    Attachment {idx + 1}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            <Text type="secondary" className="text-xs">v{doc.version || 'N/A'}</Text>
                            {!isReadOnly && (
                              <>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleOpenEditModal(doc)}
                                  className="text-blue-600 hover:text-blue-800"
                                />
                                <Popconfirm
                                  title="Delete document?"
                                  onConfirm={() => handleDeleteDoc(doc.id)}
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
                              </>
                            )}
                          </div>

                          {doc.url ? (
                            <Button
                              type="link"
                              size="small"
                              icon={<LinkOutlined />}
                              onClick={() => handleOpenViewDoc(doc.url)}
                            >
                              View Document
                            </Button>
                          ) : null}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary" className="text-xs italic">
                      No documents uploaded for this stage yet.
                    </Text>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

        {/* Upload Modal */}
        <Modal
          title={`Upload Document - ${selectedStageForUpload?.stage_name}`}
          open={uploadModalVisible}
          onCancel={handleCloseUploadModal}
          footer={[
            <Button key="cancel" onClick={handleCloseUploadModal}>Cancel</Button>,
            <Button key="upload" type="primary" loading={uploading} onClick={handleUploadSubmit}>Upload</Button>
          ]}
          width={600}
        >
          <Space direction="vertical" size="large" className="w-full">
            <Dragger
              multiple={false}
              maxCount={1}
              beforeUpload={(file) => {
                setFileToUpload(file)
                return false
              }}
              onRemove={() => setFileToUpload(null)}
              fileList={fileToUpload ? [{ uid: fileToUpload.name, name: fileToUpload.name }] : []}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Click or drag file to this area</p>
            </Dragger>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm">Attachments (optional)</Text>
                <label
                  htmlFor="notconverted-attachment-input"
                  className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
                >
                  <PlusOutlined style={{ fontSize: 12 }} />
                </label>
                <input
                  id="notconverted-attachment-input"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleAddAttachments}
                />
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attachments.map((file, index) => (
                    <Tag key={`${file.name}-${index}`} closable onClose={() => handleRemoveAttachment(index)}>
                      {file.name}
                    </Tag>
                  ))}
                </div>
              )}
            </div>

            <Input placeholder="Document Name *" value={documentName} disabled />
            <Input
              placeholder="Version"
              value={documentVersion || suggestedVersion}
              onChange={(e) => setDocumentVersion(e.target.value)}
              addonBefore="Auto Version"
              addonAfter={suggestedVersion}
            />
            <TextArea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <Input placeholder="Your Name *" value={uploadedBy} disabled />
          </Space>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title={`Edit Document - ${selectedDocumentForEdit?.name || 'Document'}`}
          open={editDocumentModalVisible}
          onCancel={handleCloseEditModal}
          footer={[
            <Button key="cancel" onClick={handleCloseEditModal}>Cancel</Button>,
            <Button key="update" type="primary" loading={updatingDocument} onClick={handleUpdateSubmit}>Update</Button>
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

        {/* Document Preview Modal */}
        <Modal
          title="Not Converted Document Preview"
          open={!!viewDocumentUrl}
          onCancel={() => {
            setViewDocumentUrl(null)
            setExcelRendererData(null)
            setWordDocumentContent(null)
          }}
          footer={null}
          width={isFullscreen ? '100vw' : '85vw'}
          style={isFullscreen ? { top: 0, margin: 0, maxWidth: '100vw' } : { top: 20 }}
        >
          <div className="flex justify-end mb-2">
            <Button
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
          {excelRendererLoading || wordDocumentLoading ? (
            <div className="py-20 text-center"><Spin size="large" /></div>
          ) : excelRendererData ? (
            <div className="max-h-[70vh] overflow-auto border p-4 bg-white">
              <Table
                dataSource={excelRendererData.rows?.slice(1).map((row, idx) => ({ key: idx, ...row }))}
                columns={excelRendererData.rows?.[0]?.map((colHeader, index) => ({
                  title: colHeader || `Column ${index + 1}`,
                  dataIndex: index,
                  key: index,
                }))}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : wordDocumentContent ? (
            <div
              className="max-h-[70vh] overflow-auto border p-6 bg-white prose max-w-none"
              dangerouslySetInnerHTML={{ __html: wordDocumentContent }}
            />
          ) : (
            <iframe src={viewDocumentUrl} className="w-full h-[70vh] border-0" title="Document Preview" />
          )}
        </Modal>
      </div>
    )
  }

  // Full page view for ISO Documents of selected proposal
  if (selectedIsoProposal) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-4">
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedIsoProposal(null)}
            className="font-medium text-slate-700 hover:text-blue-600 border-slate-300"
          >
            Back to Not Converted Proposals List
          </Button>
        </div>
        <AllISODocuments
          proposalId={selectedIsoProposal.id}
          proposalNumber={selectedIsoProposal.project_number || selectedIsoProposal.id}
          onClose={() => setSelectedIsoProposal(null)}
        />
      </div>
    )
  }

  // Non-converted proposals list view

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <Title level={3} className="!mb-1">Not Converted Proposals Documents</Title>
          <Text type="secondary">View and manage stage documents specifically for non-converted proposals.</Text>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="Search proposal, customer, activity..."
            className="w-full sm:w-72"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          {!(isGHOrScientist || isCH) && (
            <Select
              placeholder="Filter by centre"
              allowClear
              style={{ width: 200 }}
              options={centerOptions}
              value={selectedCenter}
              onChange={setSelectedCenter}
            />
          )}

          {isCH && (
            <Select
              placeholder="Filter by group"
              allowClear
              style={{ width: 200 }}
              options={groupOptions}
              value={selectedGroup}
              onChange={setSelectedGroup}
            />
          )}

          {isGHOrScientist && (
            <Select
              placeholder="Filter by quotation given by"
              allowClear
              style={{ width: 220 }}
              options={coordinatorOptions}
              value={selectedCoordinator}
              onChange={setSelectedCoordinator}
            />
          )}

          {(searchText || selectedCenter || selectedGroup || selectedCoordinator) && (
            <Button type="default" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {filteredProposals.length === 0 ? (
        <Empty description="No Not Converted proposals found" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProposals.map((p) => (
            <Card
              key={p.id}
              hoverable
              className="border-l-4 border-l-red-500 rounded-xl shadow-sm"
              actions={[
                <Button key="stage-docs" type="link" icon={<EyeOutlined />} onClick={() => handleViewProposal(p)}>
                  Stage Docs
                </Button>,
                <Button
                  key="iso-docs"
                  type="link"
                  icon={<FileTextOutlined className="text-blue-600" />}
                  onClick={() => setSelectedIsoProposal(p)}
                >
                  ISO Docs
                </Button>,
              ]}
            >
              <Tag color="red" className="mb-2">Not Converted</Tag>
              <Title level={4} className="!mb-1 font-semibold">
                {p.quote_description || p.activity || p.project_number || `Proposal #${p.id}`}
              </Title>
              <Text strong className="block text-gray-700 mb-2">{p.customer_name || 'No Customer Name'}</Text>
              {p.project_number ? (
                <Text type="secondary" className="block text-xs mb-3">Project No: {p.project_number}</Text>
              ) : p.activity && p.activity !== p.quote_description ? (
                <Text type="secondary" className="block text-xs truncate mb-3">{p.activity}</Text>
              ) : null}
              <div className="text-xs text-gray-500 space-y-1">
                <div><strong>Quotation Given By:</strong> {p.quotation_given_by_name || p.project_co_ordinator || 'N/A'}</div>
                <div><strong>Center:</strong> {p.center || 'N/A'}</div>
                {p.if_not_reason && <div><strong>Reason:</strong> {p.if_not_reason}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

    </div>
  )
}

export default NotConvertedDocumentsView
