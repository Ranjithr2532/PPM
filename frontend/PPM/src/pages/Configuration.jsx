import { useCallback, useEffect, useState } from 'react'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  Button,
  Table,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Popconfirm,
  Checkbox,
} from 'antd'
import dayjs from 'dayjs'
import { API_BASE_URL } from '../config/api.js'
import { formatDate } from '../config/date.js'

const { Title } = Typography


function Configuration({ projectRows = [] }) {
  const [stageData, setStageData] = useState([])
  const [stageLoading, setStageLoading] = useState(false)
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [stageSubmitLoading, setStageSubmitLoading] = useState(false)
  const [editingStage, setEditingStage] = useState(null)
  const [stageForm] = Form.useForm()
  const [centreData, setCentreData] = useState([])
  const [centreLoading, setCentreLoading] = useState(false)
  const [centreModalOpen, setCentreModalOpen] = useState(false)
  const [centreSubmitLoading, setCentreSubmitLoading] = useState(false)
  const [editingCentre, setEditingCentre] = useState(null)
  const [centreForm] = Form.useForm()
  const [groupData, setGroupData] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [groupSubmitLoading, setGroupSubmitLoading] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [selectedCentre, setSelectedCentre] = useState(null)
  const [groupForm] = Form.useForm()
  const [currentUserRole, setCurrentUserRole] = useState('')

  const fetchStages = useCallback(async () => {
    setStageLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/stages/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch stages')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload)
        ? payload.map((item) => ({ ...item, key: item.id }))
        : []
      setStageData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch stages')
    } finally {
      setStageLoading(false)
    }
  }, [])

  const isGuest = currentUserRole?.toLowerCase().trim() === 'guest'

  useEffect(() => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        if (parsedUser?.role) {
          setCurrentUserRole(parsedUser.role)
        }
      }
    } catch (error) {
      console.error('Failed to read user from localStorage', error)
    }
  }, [])

  const fetchCentres = useCallback(async () => {
    setCentreLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/centres/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch centres')
      }
      const payload = await response.json()
      const normalized = Array.isArray(payload)
        ? payload.map((item, index) => ({
          ...item,
          key: item.id ?? index,
          slNo: index + 1,
        }))
        : []
      setCentreData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch centres')
    } finally {
      setCentreLoading(false)
    }
  }, [])

  const fetchGroupsForCentre = useCallback(async (centre) => {
    if (!centre?.id) {
      setSelectedCentre(null)
      setGroupData([])
      return
    }
    setSelectedCentre(centre)
    setGroupLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/groups/`, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error('Unable to fetch groups')
      }
      const payload = await response.json()
      const filtered = Array.isArray(payload)
        ? payload.filter((item) => item.centre_id === centre.id)
        : []
      const normalized = filtered.map((item, index) => ({
        ...item,
        key: item.id ?? index,
        slNo: index + 1,
      }))
      setGroupData(normalized)
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to fetch groups')
    } finally {
      setGroupLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStages()
    fetchCentres()
  }, [fetchStages, fetchCentres])

  const openStageModal = (stage = null) => {
    setEditingStage(stage)
    stageForm.setFieldsValue({
      name: stage?.name ?? '',
      position: stage?.position ?? undefined,
      access:
        typeof stage?.access === 'string' && stage.access
          ? stage.access
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
          : [],
    })
    setStageModalOpen(true)
  }

  const closeStageModal = () => {
    setStageModalOpen(false)
    setEditingStage(null)
    stageForm.resetFields()
  }

  const handleStageSubmit = async () => {
    try {
      const values = await stageForm.validateFields()
      setStageSubmitLoading(true)
      const isEditing = Boolean(editingStage)
      const url = isEditing
        ? `${API_BASE_URL}/stages/${editingStage.id}`
        : `${API_BASE_URL}/stages/`
      const method = isEditing ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          position:
            typeof values.position === 'number'
              ? values.position
              : editingStage?.position ?? null,
          access:
            Array.isArray(values.access) && values.access.length > 0
              ? values.access.join(',')
              : null,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to save stage')
      }
      message.success(isEditing ? 'Stage updated' : 'Stage created')
      closeStageModal()
      fetchStages()
    } catch (error) {
      if (error.errorFields) {
        // validation error from form, ignore
        return
      }
      console.error(error)
      message.error(error.message || 'Unable to save stage')
    } finally {
      setStageSubmitLoading(false)
    }
  }

  const handleDeleteStage = async (stage) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stages/${stage.id}`, {
        method: 'DELETE',
        headers: { accept: '*/*' },
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to delete stage')
      }
      message.success('Stage deleted')
      fetchStages()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to delete stage')
    }
  }

  const openCentreModal = (centre = null) => {
    setEditingCentre(centre)
    centreForm.setFieldsValue({
      name: centre?.name ?? '',
      head: centre?.head ?? '',
      code: centre?.code ?? '',
    })
    setCentreModalOpen(true)
  }

  const closeCentreModal = () => {
    setCentreModalOpen(false)
    setEditingCentre(null)
    centreForm.resetFields()
  }

  const handleCentreSubmit = async () => {
    try {
      const values = await centreForm.validateFields()
      setCentreSubmitLoading(true)
      const isEditing = Boolean(editingCentre)
      const url = isEditing
        ? `${API_BASE_URL}/centres/${editingCentre.id}`
        : `${API_BASE_URL}/centres/`
      const method = isEditing ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          head: values.head,
          code: values.code,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to save center')
      }
      message.success(isEditing ? 'Center updated' : 'Center created')
      closeCentreModal()
      fetchCentres()
    } catch (error) {
      if (error.errorFields) {
        return
      }
      console.error(error)
      message.error(error.message || 'Unable to save center')
    } finally {
      setCentreSubmitLoading(false)
    }
  }

  const handleDeleteCentre = async (centre) => {
    try {
      const response = await fetch(`${API_BASE_URL}/centres/${centre.id}`, {
        method: 'DELETE',
        headers: { accept: '*/*' },
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to delete center')
      }
      message.success('Center deleted')
      fetchCentres()
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to delete center')
    }
  }

  const openGroupModal = (group = null) => {
    if (!selectedCentre?.id) {
      message.warning('Please select a center first')
      return
    }
    setEditingGroup(group)
    groupForm.setFieldsValue({
      name: group?.name ?? '',
      head: group?.head ?? '',
      code: group?.code ?? '',
    })
    setGroupModalOpen(true)
  }

  const closeGroupModal = () => {
    setGroupModalOpen(false)
    setEditingGroup(null)
    groupForm.resetFields()
  }

  const handleGroupSubmit = async () => {
    if (!selectedCentre?.id) {
      message.warning('Please select a center first')
      return
    }
    try {
      const values = await groupForm.validateFields()
      setGroupSubmitLoading(true)
      const isEditing = Boolean(editingGroup)
      const url = isEditing
        ? `${API_BASE_URL}/groups/${editingGroup.id}`
        : `${API_BASE_URL}/groups/`
      const method = isEditing ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          head: values.head,
          code: values.code,
          centre_id: selectedCentre.id,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to save group')
      }
      message.success(isEditing ? 'Group updated' : 'Group created')
      closeGroupModal()
      fetchGroupsForCentre(selectedCentre)
    } catch (error) {
      if (error.errorFields) {
        return
      }
      console.error(error)
      message.error(error.message || 'Unable to save group')
    } finally {
      setGroupSubmitLoading(false)
    }
  }

  const handleDeleteGroup = async (group) => {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${group.id}`, {
        method: 'DELETE',
        headers: { accept: '*/*' },
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Unable to delete group')
      }
      message.success('Group deleted')
      if (selectedCentre?.id) {
        fetchGroupsForCentre(selectedCentre)
      }
    } catch (error) {
      console.error(error)
      message.error(error.message || 'Unable to delete group')
    }
  }

  const handleBackToCentres = () => {
    setSelectedCentre(null)
    setGroupData([])
  }

  const stageColumns = [
    { title: 'Sl no', key: 'slNo', render: (_, __, index) => index + 1 },
    { title: 'Stage Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Access', dataIndex: 'access', key: 'access', render: (value) => {
        if (!value) return '-'
        if (Array.isArray(value)) return value.join(', ')
        return value
      }
    },
    { title: 'Created At', dataIndex: 'created_at', key: 'created_at', render: (value) => (value ? formatDate(value) : '-') },
    ...(!isGuest ? [{
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => openStageModal(record)}>Edit</Button>
          <Popconfirm title="Delete stage" description="This action cannot be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteStage(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  const groupColumns = [
    { title: 'Sl no', dataIndex: 'slNo', key: 'slNo' },
    { title: 'Group Name', dataIndex: 'name', key: 'name' },
    { title: 'Head', dataIndex: 'head', key: 'head' },
    { title: 'Code', dataIndex: 'code', key: 'code' },
    ...(!isGuest ? [{
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => openGroupModal(record)}>Edit</Button>
          <Popconfirm title="Delete group" description="This action cannot be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteGroup(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  const centreColumns = [
    { title: 'Sl no', dataIndex: 'slNo', key: 'slNo' },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Button type="link" onClick={() => fetchGroupsForCentre(record)}>
          {value}
        </Button>
      ),
    },
    { title: 'Head', dataIndex: 'head', key: 'head' },
    { title: 'Code', dataIndex: 'code', key: 'code' },
    ...(!isGuest ? [{
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => openCentreModal(record)}>Edit</Button>
          <Popconfirm title="Delete centre" description="This action cannot be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDeleteCentre(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div className="space-y-6">
      {/* Stages Section */}
      <div className="rounded-3xl bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div></div>
           {!isGuest && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openStageModal()}>
            Add Stage
          </Button>
           )}
        </div>

        <Table
          rowKey="key"
          columns={stageColumns}
          dataSource={stageData}
          loading={stageLoading}
          pagination={{ pageSize: 10 }}
          bordered
          title={() => 'Stages'}
        />
      </div>

      {/* Centers Section - visible only when no center is selected */}
      {!selectedCentre && (
        <div className="rounded-3xl bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div></div>
            {!isGuest && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCentreModal()}
            >
              Add Center
            </Button>
            )}
          </div>

          <Table
            rowKey="key"
            columns={centreColumns}
            dataSource={centreData}
            loading={centreLoading}
            pagination={{ pageSize: 10 }}
            bordered
            title={() => 'Centre'}
          />
        </div>
      )}

      {/* Groups Section - visible only when a center is selected */}
      {selectedCentre && (
        <div className="rounded-3xl bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Title level={5} className="!mb-0">
                Groups for: {selectedCentre.name}
              </Title>
            </div>
            <Space>
              <Button onClick={handleBackToCentres}>
                Go Back
              </Button>
               {!isGuest && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openGroupModal()}
              >
                Add Group
              </Button>
               )}
            </Space>
          </div>

          <Table
            rowKey="key"
            columns={groupColumns}
            dataSource={groupData}
            loading={groupLoading}
            pagination={{ pageSize: 10 }}
            bordered
          />
        </div>
      )}

      <Modal
        title={editingStage ? 'Edit Stage' : 'Add Stage'}
        open={stageModalOpen}
        onCancel={closeStageModal}
        onOk={handleStageSubmit}
        confirmLoading={stageSubmitLoading}
        okText={editingStage ? 'Update' : 'Create'}
        maskClosable={false}
      >
        <Form form={stageForm} layout="vertical">
          <Form.Item
            name="name"
            label="Stage Name"
            rules={[{ required: true, message: 'Please enter stage name' }]}
          >
            <Input placeholder="Enter stage name" />
          </Form.Item>
          <Form.Item
            name="position"
            label="Position"
            tooltip="Enter the stage number where this stage should appear (e.g. 6 to place it between 5 and 7)"
            rules={[
              {
                type: 'number',
                transform: (value) => (value === '' ? undefined : value),
              },
            ]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="Leave empty to add at the end"
            />
          </Form.Item>
          <Form.Item name="access" label="Access">
            <Checkbox.Group
              options={['Upload', 'Add Remarks', 'Add Payments', 'View Allotment Sheet']}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCentre ? 'Edit Center' : 'Add Center'}
        open={centreModalOpen}
        onCancel={closeCentreModal}
        onOk={handleCentreSubmit}
        confirmLoading={centreSubmitLoading}
        okText={editingCentre ? 'Update' : 'Create'}
        maskClosable={false}
      >
        <Form form={centreForm} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter center name' }]}
          >
            <Input placeholder="Enter center name" />
          </Form.Item>
          <Form.Item
            name="head"
            label="Head"
            rules={[{ required: true, message: 'Please enter head name' }]}
          >
            <Input placeholder="Enter head name" />
          </Form.Item>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Please enter center code' }]}
          >
            <Input placeholder="Enter center code" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingGroup ? 'Edit Group' : 'Add Group'}
        open={groupModalOpen}
        onCancel={closeGroupModal}
        onOk={handleGroupSubmit}
        confirmLoading={groupSubmitLoading}
        okText={editingGroup ? 'Update' : 'Create'}
        maskClosable={false}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input placeholder="Enter group name" />
          </Form.Item>
          <Form.Item
            name="head"
            label="Head"
            rules={[{ required: true, message: 'Please enter head name' }]}
          >
            <Input placeholder="Enter head name" />
          </Form.Item>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Please enter group code' }]}
          >
            <Input placeholder="Enter group code" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Configuration

