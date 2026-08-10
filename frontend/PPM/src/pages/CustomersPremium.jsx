import React, { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Table, Modal, Select, Space, Typography, message, Tag, Card, Popover } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ClearOutlined, MailOutlined, PhoneOutlined, HomeOutlined, ContactsOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '../config/api'

const { Title, Text } = Typography
const { Option } = Select

const CUSTOMER_TYPE_OPTIONS = [
  'Govt',
  'Private',
  'MHI',
  'MSME',
  'Research Institute',
  'Educational institute',
]

const getAuthHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem('token')
  return {
    accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

// Custom Form Control to handle multiple inputs compactly and intuitively without delimiters
const MultiValueInput = ({ value = [], onChange, placeholder, icon }) => {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed) {
      // Prevent duplicates
      if (!value.includes(trimmed)) {
        const newValue = [...value, trimmed]
        onChange(newValue)
      }
      setInputValue('')
    }
  }

  const handleRemove = (removedTag) => {
    const newValue = value.filter(tag => tag !== removedTag)
    onChange(newValue)
  }

  const handleEditTag = (tag) => {
    const currentInput = inputValue.trim()
    let newValue = value
    if (currentInput) {
      if (!value.includes(currentInput)) {
        newValue = [...value, currentInput]
      }
    }
    newValue = newValue.filter(item => item !== tag)
    onChange(newValue)
    setInputValue(tag)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) => {
            e.preventDefault()
            handleAdd()
          }}
          style={{ borderRadius: '6px' }}
          prefix={icon}
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAdd}
          style={{ borderRadius: '6px' }}
        >
          Add
        </Button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 24, padding: '4px', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
        {value.map((item, index) => (
          <Popover content="Click text to edit" trigger="hover" key={index} mouseEnterDelay={0.5}>
            <Tag 
              closable 
              onClose={() => handleRemove(item)}
              style={{ 
                borderRadius: '4px', 
                padding: '2px 8px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 4,
                fontSize: '13px',
                margin: 0,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155'
              }}
            >
              <span 
                onClick={() => handleEditTag(item)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click to edit"
              >
                {item}
              </span>
            </Tag>
          </Popover>
        ))}
        {value.length === 0 && <span style={{ color: '#94a3b8', fontSize: '12px', paddingLeft: 4 }}>No items added yet</span>}
      </div>
    </div>
  )
}

function CustomersPremium() {
  const [form] = Form.useForm()
  const [tableData, setTableData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [customerCount, setCustomerCount] = useState(0)
  const [customerTypeFilter, setCustomerTypeFilter] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState('')

  const fetchCustomers = useCallback(async () => {
    setTableLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/customer1/`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch customers')
      const data = await res.json()
      const mapped = data
        .map((item) => ({ ...item, key: item.id }))
        .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
      setTableData(mapped)
      setFilteredData(mapped)
      setCustomerCount(data.length)
    } catch (error) {
      console.error('Error fetching customers:', error)
      message.error('Failed to fetch customers')
    } finally {
      setTableLoading(false)
    }
  }, [])

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

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const isGuest = currentUserRole?.toLowerCase().trim() === 'guest'

  const handleSearch = (value) => {
    setSearchText(value)
    applyFilters(value, customerTypeFilter)
  }

  const handleCustomerTypeFilter = (value) => {
    setCustomerTypeFilter(value)
    applyFilters(searchText, value)
  }

  const applyFilters = (search, typeFilter) => {
    let filtered = tableData
    if (search.trim()) {
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.customer_type?.toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(item.email) && item.email.some(e => e?.toLowerCase().includes(search.toLowerCase()))) ||
        (Array.isArray(item.phone) && item.phone.some(p => p?.includes(search))) ||
        (Array.isArray(item.address) && item.address.some(a => a?.toLowerCase().includes(search.toLowerCase()))) ||
        (Array.isArray(item.gst) && item.gst.some(g => g?.toLowerCase().includes(search.toLowerCase()))) ||
        (Array.isArray(item.pan) && item.pan.some(p => p?.toLowerCase().includes(search.toLowerCase()))) ||
        (Array.isArray(item.tan) && item.tan.some(t => t?.toLowerCase().includes(search.toLowerCase())))
      )
    }
    if (typeFilter) {
      filtered = filtered.filter((item) => item.customer_type === typeFilter)
    }
    setFilteredData(filtered)
  }

  const handleAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record) => {
    setEditingRecord(record)
    form.setFieldsValue({
      ...record,
      email: Array.isArray(record.email) ? record.email : [],
      phone: Array.isArray(record.phone) ? record.phone : [],
      address: Array.isArray(record.address) ? record.address : [],
      alternate_contact_details: Array.isArray(record.alternate_contact_details) ? record.alternate_contact_details : [],
      gst: Array.isArray(record.gst) ? record.gst : [],
      pan: Array.isArray(record.pan) ? record.pan : [],
      tan: Array.isArray(record.tan) ? record.tan : [],
    })
    setModalOpen(true)
  }

  const handleDelete = async (record) => {
    try {
      const res = await fetch(`${API_BASE_URL}/customer1/${record.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to delete customer')
      message.success('Customer deleted successfully')
      fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      message.error('Failed to delete customer')
    }
  }

  const handleSubmit = async (values) => {
    setSubmitLoading(true)
    try {
      const payload = {
        name: values.name || '',
        customer_type: values.customer_type || '',
        email: values.email || [],
        phone: values.phone || [],
        address: values.address || [],
        alternate_contact_details: values.alternate_contact_details || [],
        gst: values.gst || [],
        pan: values.pan || [],
        tan: values.tan || [],
      }

      if (editingRecord) {
        const res = await fetch(`${API_BASE_URL}/customer1/${editingRecord.id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update customer')
        message.success('Customer updated successfully')
      } else {
        const res = await fetch(`${API_BASE_URL}/customer1/`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create customer')
        message.success('Customer created successfully')
      }

      setModalOpen(false)
      fetchCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      message.error('Failed to save customer')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    form.resetFields()
  }

  const renderTags = (list, icon = null) => {
    if (!Array.isArray(list) || list.length === 0) return '-'
    if (list.length === 1) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#334155' }}>
          {icon} {list[0]}
        </span>
      )
    }
    const content = (
      <Space direction="vertical" size={4} style={{ padding: '4px 0' }}>
        {list.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: '#f1f5f9', borderRadius: '4px', fontSize: 13, color: '#334155' }}>
            {icon} {item}
          </div>
        ))}
      </Space>
    )
    return (
      <Popover content={content} title="Details" trigger="hover">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#1e293b', fontWeight: 550 }}>
          {icon} {list[0]} 
          <Tag style={{ margin: 0, marginLeft: 4, background: '#e2e8f0', border: 'none', color: '#475569', fontSize: '11px' }}>
            +{list.length - 1}
          </Tag>
        </span>
      </Popover>
    )
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, render: (text) => text || '-' },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180, className: 'font-semibold text-slate-800' },
    {
      title: 'Customer Type',
      dataIndex: 'customer_type',
      key: 'customer_type',
      width: 140,
      render: (value) => value ? <Tag color="purple">{value}</Tag> : null
    },
    { title: 'Emails', dataIndex: 'email', key: 'email', width: 220, render: (emails) => renderTags(emails, <MailOutlined />) },
    { title: 'Phones', dataIndex: 'phone', key: 'phone', width: 180, render: (phones) => renderTags(phones, <PhoneOutlined />) },
    { title: 'Addresses', dataIndex: 'address', key: 'address', width: 250, render: (addresses) => renderTags(addresses, <HomeOutlined />) },
    { title: 'Alternate Contacts', dataIndex: 'alternate_contact_details', key: 'alternate_contact_details', width: 200, render: (alt) => renderTags(alt, <ContactsOutlined />) },
    { title: 'GST', dataIndex: 'gst', key: 'gst', width: 180, render: (gst) => renderTags(gst, <FileTextOutlined />) },
    { title: 'PAN', dataIndex: 'pan', key: 'pan', width: 160, render: (pan) => renderTags(pan, <FileTextOutlined />) },
    { title: 'TAN', dataIndex: 'tan', key: 'tan', width: 160, render: (tan) => renderTags(tan, <FileTextOutlined />) },
    ...(!isGuest ? [{
      title: 'Actions',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined className="text-blue-600 hover:text-blue-800" />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          />
        </Space>
      ),
    }] : []),
  ]

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      <Card bordered={false} className="shadow-sm rounded-xl mb-6 bg-white/80 backdrop-blur-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Customer Management</Title>
            <Text type="secondary">Manage customer records with multiple emails, phone numbers, addresses, and contacts.</Text>
          </div>
          <Tag color="blue" style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: 600 }}>
            Total Customers: {customerCount}
          </Tag>
        </div>
      </Card>

      <Card bordered={false} className="shadow-sm rounded-xl mb-6 bg-white/80 backdrop-blur-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="middle">
            <Input
              placeholder="Search by name, email, phone, address..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 340, borderRadius: '8px' }}
              allowClear
            />
            <Select
              placeholder="Filter by Customer Type"
              value={customerTypeFilter}
              onChange={handleCustomerTypeFilter}
              style={{ width: 220 }}
              allowClear
            >
              {CUSTOMER_TYPE_OPTIONS.map((type) => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
            {(searchText || customerTypeFilter) && (
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  setSearchText('')
                  setCustomerTypeFilter(null)
                  applyFilters('', null)
                }}
                style={{ borderRadius: '8px' }}
              >
                Clear
              </Button>
            )}
          </Space>
          {!isGuest && (
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ borderRadius: '8px' }}>
                Add Customer
              </Button>
            </Space>
          )}
        </div>
      </Card>

      <Card bordered={false} className="shadow-sm rounded-xl overflow-hidden bg-white/80 backdrop-blur-md">
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={tableLoading}
          pagination={{
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
          }}
          scroll={{ x: 1800 }}
          className="border-none"
        />
      </Card>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingRecord ? 'Edit Customer' : 'Add Customer'}</span>}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        width={720}
        destroyOnClose
        className="rounded-xl overflow-hidden"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
            <Form.Item
              name="name"
              label={<span className="font-semibold text-slate-700">Customer Name</span>}
              rules={[{ required: true, message: 'Please enter customer name' }]}
            >
              <Input placeholder="Enter customer name" style={{ borderRadius: '6px' }} />
            </Form.Item>

            <Form.Item name="customer_type" label={<span className="font-semibold text-slate-700">Customer Type</span>}>
              <Select placeholder="Select customer type" style={{ borderRadius: '6px' }}>
                {CUSTOMER_TYPE_OPTIONS.map((type) => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="email" label={<span className="font-semibold text-slate-700">Email Address(es)</span>}>
            <MultiValueInput placeholder="Enter email address and click Add" icon={<MailOutlined />} />
          </Form.Item>

          <Form.Item name="phone" label={<span className="font-semibold text-slate-700">Phone Number(s)</span>}>
            <MultiValueInput placeholder="Enter phone number and click Add" icon={<PhoneOutlined />} />
          </Form.Item>

          <Form.Item name="address" label={<span className="font-semibold text-slate-700">Address(es)</span>}>
            <MultiValueInput placeholder="Enter address and click Add" icon={<HomeOutlined />} />
          </Form.Item>

          <Form.Item name="alternate_contact_details" label={<span className="font-semibold text-slate-700">Alternate Contact(s)</span>}>
            <MultiValueInput placeholder="Enter contact details and click Add" icon={<ContactsOutlined />} />
          </Form.Item>

          <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '16px', background: '#f8fafc', marginBottom: 20 }}>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 12, fontSize: '13px' }}>Tax Details</div>
            
            <Form.Item name="gst" label={<span className="font-semibold text-slate-700">GST Number(s)</span>} style={{ marginBottom: 12 }}>
              <MultiValueInput placeholder="Enter GST and click Add" icon={<FileTextOutlined />} />
            </Form.Item>

            <Form.Item name="pan" label={<span className="font-semibold text-slate-700">PAN Number(s)</span>} style={{ marginBottom: 12 }}>
              <MultiValueInput placeholder="Enter PAN and click Add" icon={<FileTextOutlined />} />
            </Form.Item>

            <Form.Item name="tan" label={<span className="font-semibold text-slate-700">TAN Number(s)</span>} style={{ marginBottom: 0 }}>
              <MultiValueInput placeholder="Enter TAN and click Add" icon={<FileTextOutlined />} />
            </Form.Item>
          </div>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel} style={{ borderRadius: '6px' }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitLoading} style={{ borderRadius: '6px' }}>
                {editingRecord ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomersPremium
