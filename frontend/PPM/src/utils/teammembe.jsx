import React, { useState, useEffect } from 'react'
import { Modal, Select, List, Button, message, Spin, Space, Popconfirm, Avatar } from 'antd'
import { UsergroupAddOutlined, UserOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { API_BASE_URL } from '../config/api.js'

const getAuthHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem('token')
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

export const TeamMemberModal = ({ isOpen, onClose, proposalId }) => {
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scientists, setScientists] = useState([])
  const [currentMembers, setCurrentMembers] = useState([])
  const [selectedScientistId, setSelectedScientistId] = useState(null)

  // Fetch all scientists and existing team members when modal opens
  useEffect(() => {
    if (isOpen && proposalId) {
      fetchData()
    }
  }, [isOpen, proposalId])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch all users to filter scientists
      const usersRes = await fetch(`${API_BASE_URL}/users/`, {
        headers: getAuthHeaders(),
      })
      if (!usersRes.ok) throw new Error('Failed to fetch users list')
      const allUsers = await usersRes.json()
      
      // Filter users who can be team members (scientist, gh, ch)
      const eligibleRoles = ['scientist', 'gh', 'group head', 'ch', 'center head']
      const filteredScientists = allUsers.filter((u) => {
        if (!u.role) return false
        const roleClean = u.role.trim().toLowerCase()
        return eligibleRoles.includes(roleClean)
      })
      setScientists(filteredScientists)

      // 2. Fetch existing team members for the proposal
      const membersRes = await fetch(`${API_BASE_URL}/team-members/proposal/${proposalId}`, {
        headers: getAuthHeaders(),
      })
      if (!membersRes.ok) throw new Error('Failed to fetch existing team members')
      const existingMembers = await membersRes.json()
      setCurrentMembers(existingMembers)
    } catch (error) {
      console.error('Error fetching data:', error)
      message.error(error.message || 'Error loading team member details')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedScientistId) {
      message.warning('Please select a scientist to add')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/team-members/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          proposal_id: proposalId,
          team_member_id: selectedScientistId,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to add team member')
      }

      message.success('Team member added successfully')
      setSelectedScientistId(null)
      fetchData() // Refresh list
    } catch (error) {
      console.error('Error adding member:', error)
      message.error(error.message || 'Error adding team member')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveMember = async (mappingId) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/team-members/${mappingId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to remove team member')
      }

      message.success('Team member removed successfully')
      fetchData() // Refresh list
    } catch (error) {
      console.error('Error removing member:', error)
      message.error(error.message || 'Error removing team member')
    } finally {
      setActionLoading(false)
    }
  }

  // Filter out scientists who are already team members
  const availableScientists = scientists.filter(
    (s) => !currentMembers.some((m) => m.team_member_id === s.name)
  )

  return (
    <Modal
      title={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '18px',
          fontWeight: 600,
          color: '#1f1f1f'
        }}>
          <UsergroupAddOutlined style={{ color: '#1890ff', fontSize: '22px' }} />
          <span>Manage Team Members</span>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ borderRadius: '6px' }}>
          Done
        </Button>
      ]}
      width={500}
      destroyOnClose
      style={{ top: 100 }}
      styles={{
        body: {
          padding: '20px 24px'
        }
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading team details..." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Add Team Member Section */}
          <div style={{
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#475569', fontWeight: 600 }}>Assign New Member</h4>
            <Space style={{ width: '100%' }} size="middle">
              <Select
                placeholder="Select a member"
                style={{ width: '270px' }}
                value={selectedScientistId}
                onChange={(value) => setSelectedScientistId(value)}
                showSearch
                optionFilterProp="children"
                loading={actionLoading}
                dropdownStyle={{ borderRadius: '8px' }}
              >
                {availableScientists.map((s) => (
                  <Select.Option key={s.id} value={s.name}>
                    {s.name} ({s.email})
                  </Select.Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddMember}
                loading={actionLoading}
                style={{
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600
                }}
              >
                Add
              </Button>
            </Space>
          </div>

          {/* Current Team Members List */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b', fontWeight: 600 }}>
              Current Team Members ({currentMembers.length})
            </h4>
            <List
              dataSource={currentMembers}
              locale={{ emptyText: 'No team members assigned yet.' }}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                  }}
                  actions={[
                    <Popconfirm
                      title="Remove from team?"
                      onConfirm={() => handleRemoveMember(item.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={actionLoading}
                        style={{ borderRadius: '4px' }}
                      />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                    }
                    title={<span style={{ fontWeight: 500, color: '#334155' }}>{item.team_member_id}</span>}
                    description={<span style={{ fontSize: '12px', color: '#64748b' }}>Project Team Member</span>}
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
