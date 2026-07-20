import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Checkbox, message, Modal, Steps } from 'antd'
import cmtiLogo from '../assets/waitro-member-cmti.png'
import { API_BASE_URL } from '../config/api.js'

const { Title } = Typography
const { Step } = Steps

function parseApiError(error) {
  if (!error) return 'Unknown error'
  const res = error.response
  if (!res) {
    return error.message || 'Network error'
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

function Login() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  // Forgot Password Modal State
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('')
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  // GH Role Selection Modal State
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [pendingUserData, setPendingUserData] = useState(null)

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/login`, {
        email: values.email,
        password: values.password,
      })

      console.log('Login response:', response.data)

      const userData = response.data
      
      let token = userData.access_token || userData.token
      if (!token) {
        const authHeader = response.headers?.authorization || response.headers?.Authorization
        if (authHeader) {
          token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader
        }
      }

      if (token) {
        localStorage.setItem('token', token)
        console.log('Token saved to localStorage')
      } else {
        console.warn('No token found in login response! Continuing without token.')
      }

      const userPayload = {
        user_id: userData.id,
        name: userData.name,
        email: userData.email || values.email,
        role: userData.role.toLowerCase(),
        dbRole: userData.role.toLowerCase(),
        center: userData.center,
        designation: userData.designation,
        group: userData.group,
      }

      // Show role selection modal for GH users
      if (userData.role.toLowerCase() === 'gh') {
        setPendingUserData(userPayload)
        setShowRoleSelection(true)
      } else {
        // For non-GH users, proceed normally
        try {
          localStorage.setItem('ppm_user', JSON.stringify(userPayload))
          console.log('User saved to localStorage:', userPayload)
        } catch (err) {
          console.error('Failed to save user to localStorage', err)
        }

        message.success(userData.message || 'Login successful')
        const routeRole = userPayload.role.toLowerCase()
        navigate(`/${routeRole}/proposals`)
      }

    } catch (error) {
      console.error('Login error:', error)
      const detail = parseApiError(error)
      message.error(detail)
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password Functions
  const openForgotPasswordModal = () => {
    setForgotPasswordOpen(true)
    setForgotPasswordStep(0)
    setForgotPasswordEmail('')
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
  }

  const closeForgotPasswordModal = () => {
    setForgotPasswordOpen(false)
    setForgotPasswordStep(0)
    setForgotPasswordEmail('')
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
  }

  const handleRequestOtp = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      message.error('Please enter a valid email address')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/request-otp`, {
        email: forgotPasswordEmail,
      })

      message.success(response.data.message || 'OTP sent successfully to your email')
      setForgotPasswordStep(1)
    } catch (error) {
      console.error('Request OTP error:', error)
      const detail = parseApiError(error)
      message.error(detail)
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!forgotPasswordOtp || forgotPasswordOtp.length < 4) {
      message.error('Please enter a valid OTP')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/verify-otp`, {
        email: forgotPasswordEmail,
        otp: forgotPasswordOtp,
      })

      message.success(response.data.message || 'OTP verified successfully')
      setForgotPasswordStep(2)
    } catch (error) {
      console.error('Verify OTP error:', error)
      const detail = parseApiError(error)
      message.error(detail)
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!forgotPasswordNewPassword || forgotPasswordNewPassword.length < 6) {
      message.error('Password must be at least 6 characters long')
      return
    }

    if (forgotPasswordNewPassword !== forgotPasswordConfirmPassword) {
      message.error('Passwords do not match')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/update-password`, {
        email: forgotPasswordEmail,
        new_password: forgotPasswordNewPassword,
      })

      message.success(response.data.message || 'Password updated successfully')
      closeForgotPasswordModal()
    } catch (error) {
      console.error('Reset password error:', error)
      const detail = parseApiError(error)
      message.error(detail)
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  // GH Role Selection Handlers
  const handleRoleSelection = (role) => {
    if (!pendingUserData) return
    
    setSelectedRole(role)
    
    // Update user payload with selected role
    const updatedUserPayload = {
      ...pendingUserData,
      role: role.toLowerCase()
    }
    
    try {
      localStorage.setItem('ppm_user', JSON.stringify(updatedUserPayload))
      console.log('User saved to localStorage with role:', updatedUserPayload)
    } catch (err) {
      console.error('Failed to save user to localStorage', err)
    }
    
    message.success(`Logged in as ${role}`)
    setShowRoleSelection(false)
    setPendingUserData(null)
    setSelectedRole('')
    
    // Navigate based on selected role
    if (role === 'Group Head') {
      navigate('/gh/proposals')
    } else if (role === 'Scientist') {
      navigate('/scientist/proposals')
    }
  }

  const closeRoleSelectionModal = () => {
    setShowRoleSelection(false)
    setPendingUserData(null)
    setSelectedRole('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-md shadow-xl rounded-3xl">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img src={cmtiLogo} alt="CMTI logo" className="h-16 w-auto object-contain" />
          <Title level={3} className="!mb-0 text-center">
            Sign In
          </Title>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="Enter email" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input
              placeholder="Enter password"
              size="large"
              type={showPassword ? 'text' : 'password'}
            />
          </Form.Item>

          <div className="flex items-center justify-between mb-4">
            <Checkbox
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            >
              Show password
            </Checkbox>
            <Button type="link" onClick={openForgotPasswordModal} className="p-0">
              Forgot / Reset Password?
            </Button>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Sign In
          </Button>
        </Form>
      </Card>

      {/* Forgot Password Modal */}
      <Modal
        title="Reset Password"
        open={forgotPasswordOpen}
        onCancel={closeForgotPasswordModal}
        footer={null}
        width={500}
        maskClosable={false}
        keyboard={false}
      >
        <Steps current={forgotPasswordStep} className="mb-6">
          <Step title="Email" />
          <Step title="Verify OTP" />
          <Step title="New Password" />
        </Steps>

        {/* Step 0: Enter Email */}
        {forgotPasswordStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Email Address</label>
              <Input
                placeholder="Enter your email"
                size="large"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                onPressEnter={handleRequestOtp}
              />
            </div>
            <Button
              type="primary"
              size="large"
              loading={forgotPasswordLoading}
              onClick={handleRequestOtp}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Get OTP
            </Button>
          </div>
        )}

        {/* Step 1: Verify OTP */}
        {forgotPasswordStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Enter OTP</label>
              <p className="text-sm text-gray-600 mb-3">
                We've sent a 6-digit OTP to {forgotPasswordEmail}
              </p>
              <Input
                placeholder="Enter 6-digit OTP"
                size="large"
                value={forgotPasswordOtp}
                onChange={(e) => setForgotPasswordOtp(e.target.value)}
                onPressEnter={handleVerifyOtp}
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="large"
                onClick={() => setForgotPasswordStep(0)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="primary"
                size="large"
                loading={forgotPasswordLoading}
                onClick={handleVerifyOtp}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Verify OTP
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Reset Password */}
        {forgotPasswordStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">New Password</label>
              <Input
                placeholder="Enter new password"
                size="large"
                type={showNewPassword ? 'text' : 'password'}
                value={forgotPasswordNewPassword}
                onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Confirm Password</label>
              <Input
                placeholder="Confirm new password"
                size="large"
                type={showNewPassword ? 'text' : 'password'}
                value={forgotPasswordConfirmPassword}
                onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                onPressEnter={handleResetPassword}
              />
            </div>
            <Checkbox
              checked={showNewPassword}
              onChange={(e) => setShowNewPassword(e.target.checked)}
            >
              Show password
            </Checkbox>
            <Button
              type="primary"
              size="large"
              loading={forgotPasswordLoading}
              onClick={handleResetPassword}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Reset Password
            </Button>
          </div>
        )}
      </Modal>

      {/* GH Role Selection Modal */}
      <Modal
        title="Select Your Role"
        open={showRoleSelection}
        onCancel={closeRoleSelectionModal}
        footer={null}
        width={450}
        maskClosable={false}
        keyboard={false}
        centered
      >
        <div className="space-y-6">
          <div>
            <p className="text-lg font-medium mb-4">
              Welcome, {pendingUserData?.name}! Please select how you want to proceed:
            </p>
          </div>
          
          <div className="space-y-3">
            <Button
              type="primary"
              size="large"
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
              onClick={() => handleRoleSelection('Group Head')}
            >
              <div className="flex items-center justify-center">
                <span>Login as Group Head</span>
              </div>
            </Button>
            
            <Button
              size="large"
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleRoleSelection('Scientist')}
            >
              <div className="flex items-center justify-center">
                <span>Login as Scientist</span>
              </div>
            </Button>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <Button
              type="link"
              onClick={closeRoleSelectionModal}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Login