import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, message } from 'antd'
import cmtiLogo from '../assets/waitro-member-cmti.png'
import { API_BASE_URL } from '../config/api.js'

const { Title, Text } = Typography

function parseApiError(error) {
  if (!error) return 'Failed to create user'
  const res = error.response
  if (!res) {
    return error.message || 'Failed to create user'
  }

  const { status, data } = res

  if (typeof data === 'string' && data.trim()) return data
  if (data) {
    if (typeof data === 'object') {
      if (data.detail) return data.detail
      if (data.message) return data.message
      if (data.errors) {
        if (Array.isArray(data.errors)) return data.errors.join(', ')
        return JSON.stringify(data.errors)
      }
    }
  }

  return `Request failed with status ${status}`
}

function CreateLogin() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE_URL}/users/`, values)
      message.success('User created successfully')
      navigate('/')
    } catch (error) {
      console.error(error)
      const detail = parseApiError(error)
      // Show backend error message
      message.error(detail)

      // If backend says email already exists, surface it on the email field too
      if (detail && typeof detail === 'string' && detail.toLowerCase().includes('email already exists')) {
        form.setFields([
          {
            name: 'email',
            errors: [detail],
          },
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-2xl shadow-xl rounded-3xl">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img src={cmtiLogo} alt="CMTI logo" className="h-16 w-auto object-contain" />
          <Title level={3} className="!mb-0 text-center">
            Sign Up
          </Title>
        
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter name" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}
          >
            <Input placeholder="Enter email" />
          </Form.Item>

          <Form.Item
            name="designation"
            label="Designation"
            rules={[{ required: true, message: 'Please enter designation' }]}
          >
            <Input placeholder="Enter designation" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please enter role' }]}
          >
            <Input placeholder="Enter role" />
          </Form.Item>

          <Form.Item
            name="center"
            label="Centre"
            rules={[{ required: true, message: 'Please enter centre' }]}
          >
            <Input placeholder="Enter centre" />
          </Form.Item>

          <Form.Item
            name="group"
            label="Group"
            rules={[{ required: true, message: 'Please enter group' }]}
          >
            <Input placeholder="Enter group" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
            help="Password should be at least 6 characters"
            className="md:col-span-2"
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>

          <div className="md:col-span-2 flex justify-end gap-3 mt-2">
            <Button onClick={() => navigate('/')}>
              Back to SIgn In
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              SIgn up
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default CreateLogin
