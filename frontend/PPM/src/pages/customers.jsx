import React, { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, Table, Modal, Select, Space, Typography, message, Upload, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined, ClearOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import * as XLSX from 'xlsx'
import { API_BASE_URL } from '../config/api'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select
const { Text } = Typography

const CUSTOMER_TYPE_OPTIONS = [
  'Govt',
  'Private',
  'MHI',
  'MSME',
  'Research Institute',
  'Educational institute',
]

const CUSTOMER_FIELDS = [
  { name: 'id', label: 'ID', width: 80, render: (text) => text || '-' },
  { name: 'name', label: 'Name', width: 200 },
  { name: 'customer_type', label: 'Customer Type', width: 150, render: (value) => value ? <Tag color="blue">{value}</Tag> : null },
  { name: 'gst', label: 'GST', width: 150 },
  { name: 'pan', label: 'PAN', width: 120 },
  { name: 'tan', label: 'TAN', width: 120 },
  { name: 'address', label: 'Address', width: 250 },
  { name: 'email', label: 'Email', width: 200 },
  { name: 'phone_no', label: 'Phone No.', width: 150 },
  { name: 'alternate_contact_details', label: 'Alternate Contact', width: 200 },
  { name: 'created_at', label: 'Created At', width: 180, render: (text) => text ? dayjs(text).format('DD-MM-YYYY HH:mm') : '-' },
  { name: 'updated_at', label: 'Updated At', width: 180, render: (text) => text ? dayjs(text).format('DD-MM-YYYY HH:mm') : '-' },
]

function Customers() {
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
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('')

  const fetchCustomers = useCallback(async () => {
    setTableLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/customers/`, {
        headers: { accept: 'application/json' },
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

  const isGuest = currentUserRole?.toLowerCase().trim() === 'guest'

  const fetchCustomerCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to fetch customer count')
      const data = await res.json()
      setCustomerCount(data.length)
    } catch (error) {
      console.error('Error fetching customer count:', error)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

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
        item.address?.toLowerCase().includes(search.toLowerCase()) ||
        item.email?.toLowerCase().includes(search.toLowerCase())
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
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDelete = async (record) => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${record.id}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
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
        gst: values.gst?.trim() || null,
        pan: values.pan?.trim() || null,
        tan: values.tan?.trim() || null,
        address: values.address || '',
        email: values.email || '',
        phone_no: values.phone_no || '',
        alternate_contact_details: values.alternate_contact_details || '',
      }

      if (editingRecord) {
        const res = await fetch(`${API_BASE_URL}/customers/${editingRecord.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update customer')
        message.success('Customer updated successfully')
      } else {
        const res = await fetch(`${API_BASE_URL}/customers/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
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

  const handleUploadExcel = () => {
    setUploadModalVisible(true)
  }

  const handleUploadCancel = () => {
    setUploadModalVisible(false)
  }

  const handleFileUpload = async (file) => {
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Assuming columns: name, customer_type, address, email, phone_no, alternate_contact_details
        const customers = jsonData.map((row) => ({
          name: row.name || '',
          customer_type: row.customer_type || '',
          gst: row.gst || null,
          pan: row.pan || null,
          tan: row.tan || null,
          address: row.address || '',
          email: row.email || '',
          phone_no: row.phone_no || '',
          alternate_contact_details: row.alternate_contact_details || '',
        }))

        for (const customer of customers) {
          try {
            const res = await fetch(`${API_BASE_URL}/customers/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                accept: 'application/json',
              },
              body: JSON.stringify(customer),
            })
            if (!res.ok) throw new Error('Failed to create customer')
          } catch (error) {
            console.error('Error creating customer:', error)
            message.error(`Failed to import customer: ${customer.name}`)
          }
        }

        message.success('Excel import completed')
        setUploadModalVisible(false)
        fetchCustomers()
      }
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error uploading file:', error)
      message.error('Failed to upload file')
    } finally {
      setUploading(false)
    }
    return false // Prevent default upload
  }

  const columns = [
    ...CUSTOMER_FIELDS.map((field) => ({
      title: field.label,
      dataIndex: field.name,
      key: field.name,
      width: field.width,
      render: field.render,
    })),
    ...(!isGuest ? [{
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          >
            Delete
          </Button>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Customer Management</Title>
      <div style={{ marginBottom: '16px' }}>
        <Text strong>Total Customers: {customerCount}</Text>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Input
            placeholder="Search customers..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="Filter by Customer Type"
            value={customerTypeFilter}
            onChange={handleCustomerTypeFilter}
            style={{ width: 200 }}
            allowClear
          >
            {CUSTOMER_TYPE_OPTIONS.map((type) => (
              <Option key={type} value={type}>
                {type}
              </Option>
            ))}
          </Select>
          {searchText || customerTypeFilter ? (
            <Button
              icon={<ClearOutlined />}
              onClick={() => {
                setSearchText('')
                setCustomerTypeFilter(null)
                applyFilters('', null)
              }}
            >
              Clear Filters
            </Button>
          ) : null}
        </Space>
        {!isGuest && (
        <Space>
          <Button icon={<UploadOutlined />} onClick={handleUploadExcel}>
            Upload Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add Customer
          </Button>
        </Space>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        loading={tableLoading}
        pagination={{
          total: filteredData.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} customers`,
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingRecord ? 'Edit Customer' : 'Add Customer'}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter customer name' }]}
          >
            <Input placeholder="Enter customer name" />
          </Form.Item>

          <Form.Item name="customer_type" label="Customer Type">
            <Select placeholder="Select customer type">
              {CUSTOMER_TYPE_OPTIONS.map((type) => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="gst" label="GST">
            <Input placeholder="Enter GST number" />
          </Form.Item>

          <Form.Item name="pan" label="PAN">
            <Input placeholder="Enter PAN number" />
          </Form.Item>

          <Form.Item name="tan" label="TAN">
            <Input placeholder="Enter TAN number" />
          </Form.Item>

          <Form.Item name="address" label="Address">
            <TextArea placeholder="Enter address" rows={2} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Enter email address" />
          </Form.Item>

          <Form.Item name="phone_no" label="Phone Number">
            <Input placeholder="Enter phone number" />
          </Form.Item>

          <Form.Item name="alternate_contact_details" label="Alternate Contact">
            <Input placeholder="Enter alternate contact details" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                {editingRecord ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Upload Excel File"
        open={uploadModalVisible}
        onCancel={handleUploadCancel}
        footer={null}
      >
        <Upload
          accept=".xlsx,.xls"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} loading={uploading}>
            {uploading ? 'Uploading...' : 'Select Excel File'}
          </Button>
        </Upload>
        <div style={{ marginTop: '16px' }}>
          <Text type="secondary">
            Upload an Excel file with columns: name, customer_type, gst, pan, tan, address, email, phone_no, alternate_contact_details
          </Text>
        </div>
      </Modal>
    </div>
  )
}

export default Customers