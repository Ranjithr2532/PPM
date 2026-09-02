import { Layout, Menu, Button, Typography, message, Select, Drawer, Modal, Form, Input, Avatar } from 'antd'
import {
  ProfileOutlined,
  SettingOutlined,
  ProjectOutlined,
  BarChartOutlined,
  BellOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
  MessageOutlined,
  FileWordOutlined,
  MenuOutlined,
  FilePdfOutlined,
  RobotOutlined,
  UserOutlined,
  EditOutlined
} from '@ant-design/icons'
import cmtiLogo from '../assets/waitro-member-cmti.png'
import { useLocation, useNavigate } from 'react-router-dom'
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

const { Sider } = Layout
const { Text } = Typography

function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const segments = location.pathname.split('/').filter(Boolean)
  const basePath = (segments[0] || 'admin').toLowerCase()
  const normalizedBasePath = basePath
  const section = segments[1] || 'proposals'

  const selectedKey =
    section === 'configuration'
      ? 'configuration'
      : section === 'projects'
        ? 'projects'
        : section === 'analytics'
          ? 'analytics'
          : section === 'overall-analytics'
            ? 'overall-analytics'
            // : section === 'financial-analytics'
            // ? 'financial-analytics'
            : section === 'master-proposals'
              ? 'master-proposals'
              : section === 'notification'
                ? 'notification'
                : section === 'gh-master-proposals'
                  ? 'gh-master-proposals'
                  : section === 'gh-notification'
                    ? 'gh-notification'
                    : section === 'access-control'
                      ? 'access-control'
                      : section === 'customers'
                        ? 'customers'
                        : section === 'chats'
                          ? 'chats'
                          : section === 'document-generate' || section === 'documents-generate'
                            ? 'document-generate'
                            : section === 'iso-generation'
                              ? 'iso-generation'
                              : section === 'team-members'
                                ? 'team-members'
                                : section === 'ai-proposal' || section === 'create-proposal'
                                  ? 'ai-proposal'
                                  : 'proposals'

  let userName = ''
  let userRole = ''
  try {
    const rawUser = window.localStorage.getItem('ppm_user')
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser)
      if (parsedUser && parsedUser.name) {
        userName = parsedUser.name
      }
      if (parsedUser && parsedUser.role) {
        const r = (parsedUser.role || '').toLowerCase().trim()
        userRole = (r === 'group head' || r === 'group_head') ? 'gh' : (r === 'centre head' || r === 'center head') ? 'ch' : r
      }
    }
  } catch (error) {
    console.error('Failed to read user from localStorage', error)
  }

  const [notificationCount, setNotificationCount] = useState(0);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [selectedRole, setSelectedRole] = useState('');

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [profileLoading, setProfileLoading] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);

  const handleOpenProfile = () => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        setUserProfileData(parsed)
        profileForm.setFieldsValue({
          designation: parsed.designation || '',
          type: parsed.type || ''
        })
        setIsProfileModalOpen(true)
      }
    } catch (err) {
      console.error('Error opening profile:', err)
    }
  }

  const handleSaveProfile = async (values) => {
    const userId = userProfileData?.id || userProfileData?.user_id;
    if (!userId) {
      message.error('User ID not found');
      return;
    }
    setProfileLoading(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/users/${userId}`, {
        designation: (values.designation || '').trim(),
        type: (values.type || '').trim()
      });

      const updatedUser = {
        ...userProfileData,
        ...response.data,
        designation: (values.designation || '').trim(),
        type: (values.type || '').trim()
      };

      window.localStorage.setItem('ppm_user', JSON.stringify(updatedUser));
      setUserProfileData(updatedUser);
      message.success('Profile updated successfully!');
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      message.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const isDirector = basePath === 'director'
  const isCH = basePath === 'ch' || userRole === 'ch'
  const isGuest = basePath === 'guest'
  // Treat Scientist as same as GH
  const isGHOrScientist = basePath === 'gh' || basePath === 'scientist'
  const isScientistOrCoordinator = basePath === 'scientist' || userRole === 'scientist' || userRole === 'coordinator' || userRole === 'project coordinator' || userRole === 'project_coordinator' || userRole === 'pi'

  // Determine role-specific User Manual PDF URL
  const activeRole = (basePath || userRole || '').toLowerCase()
  let manualPdfUrl = null
  if (activeRole === 'scientist') {
    manualPdfUrl = '/Sci_manual.pdf'
  } else if (activeRole === 'gh') {
    manualPdfUrl = '/GH_manual.pdf'
  } else if (activeRole === 'ch') {
    manualPdfUrl = '/CH_manual.pdf'
  } else if (activeRole === 'admin') {
    manualPdfUrl = '/Admin_manual.pdf'
  }

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const fetchUnreadChatCount = () => {
      if (userName && !isGuest && !isDirector) {
        let userGroup = ''
        try {
          const raw = localStorage.getItem('ppm_user')
          if (raw) userGroup = JSON.parse(raw).group || ''
        } catch (e) { }

        Promise.all([
          axios.get(`${API_BASE_URL}/group-chats/?user_name=${encodeURIComponent(userName)}`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/Remarkss/unread_count?user_name=${encodeURIComponent(userName)}&user_role=${encodeURIComponent(userRole)}&user_group=${encodeURIComponent(userGroup)}`).catch(() => ({ data: { unread_count: 0 } }))
        ]).then(([groupRes, proposalRes]) => {
          const groupList = Array.isArray(groupRes.data) ? groupRes.data : []
          const groupUnread = groupList.reduce((acc, curr) => acc + (curr.unread_count || 0), 0)
          const proposalUnread = proposalRes.data?.unread_count || 0
          setUnreadChatCount(groupUnread + proposalUnread)
        })
      }
    }

    // Fetch on mount
    fetchUnreadChatCount()

    // Re-fetch whenever a chat is sent/read from any page
    const handleChatUpdated = () => fetchUnreadChatCount()
    window.addEventListener('ppm-chat-updated', handleChatUpdated)
    return () => window.removeEventListener('ppm-chat-updated', handleChatUpdated)
  }, [userName, userRole, isGuest, isDirector]);

  useEffect(() => {
    // Set initial role from localStorage
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        if (parsedUser && parsedUser.role) {
          setSelectedRole(parsedUser.role)
        }
      }
    } catch (error) {
      console.error('Failed to read user role from localStorage', error)
    }

    const fetchNotifications = () => {
      if (isGHOrScientist) {
        return axios.get(
          `${API_BASE_URL}/notifications/by-quotation-user/?name=${encodeURIComponent(userName || '')}`,
        )
      }
      return axios.get(
        `${API_BASE_URL}/notifications/?user_name=${encodeURIComponent(userName || '')}&role=${encodeURIComponent(userRole || '')}`
      )
    }

    const filterUnread = (items) => {
      const list = Array.isArray(items) ? items : []
      if (isGHOrScientist) {
        return list.filter(
          (notification) => notification.trigerred_by !== 'Coordinator' && notification.is_read !== 1,
        )
      }
      return list.filter(
        (notification) => notification.trigerred_by !== 'admin' && notification.is_read !== 1,
      )
    }

    fetchNotifications()
      .then((notificationsRes) => {
        const unreadCount = filterUnread(notificationsRes.data).length
        setNotificationCount(unreadCount)
      })
      .catch((error) => console.error('Error fetching notifications:', error));

    // Fetch unacknowledged proposals count for admin-equivalent users
    if (normalizedBasePath === 'admin' || normalizedBasePath === 'guest') {
      axios.get(`${API_BASE_URL}/proposals/false`)
        .then((response) => {
          const list = Array.isArray(response.data) ? response.data : []
          setUnacknowledgedCount(list.length)
        })
        .catch((error) => console.error('Error fetching unacknowledged count:', error));
    }
  }, [normalizedBasePath, userName, userRole, isGHOrScientist]);

  const handleRoleSwitch = (newRole) => {
    try {
      const rawUser = window.localStorage.getItem('ppm_user')
      if (rawUser) {
        const parsedUser = JSON.parse(rawUser)
        parsedUser.role = newRole
        window.localStorage.setItem('ppm_user', JSON.stringify(parsedUser))
        setSelectedRole(newRole)
        message.success(`Switched to ${newRole} role`)
      }
    } catch (error) {
      console.error('Failed to switch role:', error)
      message.error('Failed to switch role')
    }
  }

  const handleLogout = () => {
    try {
      window.localStorage.removeItem('ppm_user')
      window.localStorage.removeItem('token')
    } catch (error) {
      console.error('Failed to clear user from localStorage', error)
    }
    message.success('Logged out')
    navigate('/')
  }

  const renderSidebarContent = () => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Logo Section */}
        <div className="flex items-center justify-center px-6 py-6 border-b border-slate-100">
          <img
            src={cmtiLogo}
            alt="CMTI logo"
            className="h-14 w-auto object-contain transition-transform duration-300 hover:scale-105"
          />
        </div>

        {/* Welcome User Profile Card */}
        {userName && (
          <div className="px-4 py-4">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col items-center">
              <Text style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Welcome Back</Text>
              <Text className="mt-1 text-slate-800 font-semibold" style={{ fontSize: '15px' }}>{userName}</Text>
              <div className="mt-1.5 px-2.5 py-0.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {userRole || 'User'}
              </div>
            </div>
          </div>
        )}

        {/* Menu Links */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderRight: 'none', padding: '0 8px' }}
          onClick={(info) => {
            setMobileOpen(false)
            const prefix = `/${basePath}`

            if (info.key === 'configuration') navigate(`${prefix}/configuration`)
            else if (info.key === 'projects') navigate(`${prefix}/projects`)
            else if (info.key === 'analytics') navigate(`${prefix}/analytics`)
            else if (info.key === 'master-proposals') navigate(`${prefix}/master-proposals`)
            else if (info.key === 'gh-master-proposals') navigate(`${prefix}/gh-master-proposals`)
            else if (info.key === 'notification') navigate(`${prefix}/notification`)
            else if (info.key === 'gh-notification') navigate(`${prefix}/gh-notification`)
            else if (info.key === 'access-control') navigate(`${prefix}/access-control`)
            else if (info.key === 'customers') navigate(`${prefix}/customers`)
            else if (info.key === 'overall-analytics') navigate(`${prefix}/overall-analytics`)
            else if (info.key === 'chats') navigate(`${prefix}/chats`)
            else if (info.key === 'document-generate') navigate(`${prefix}/document-generate`)
            else if (info.key === 'iso-generation') navigate(`${prefix}/iso-generation`)
            else if (info.key === 'team-members') navigate(`${prefix}/team-members`)
            else if (info.key === 'ai-proposal') navigate(`${prefix}/ai-proposal`)

            else navigate(`${prefix}/proposals`)
          }}
          items={[
            { key: 'proposals', icon: <ProfileOutlined />, label: 'Proposals / Projects' },
            { key: 'ai-proposal', icon: <RobotOutlined />, label: 'AI Proposal' },
            ...(!isGuest && !isDirector ? [{
              key: 'chats',
              icon: <MessageOutlined />,
              label: (
                <span>
                  Chats
                  {unreadChatCount > 0 && (
                    <span
                      style={{
                        backgroundColor: '#ff4d4f',
                        borderRadius: '50%',
                        color: 'white',
                        padding: '0 6px',
                        marginLeft: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {unreadChatCount}
                    </span>
                  )}
                </span>
              )
            }] : []),
            ...(!isDirector ? [{ key: 'projects', icon: <ProjectOutlined />, label: 'Projects Documents' }] : []),
            { key: 'iso-generation', icon: <FileWordOutlined />, label: 'ISO Generation' },
            ...(isScientistOrCoordinator ? [{ key: 'team-members', icon: <TeamOutlined />, label: 'Team Members' }] : []),

            ...(isGHOrScientist
              ? [
                {
                  key: 'gh-notification',
                  icon: <ProfileOutlined />,
                  label: (
                    <span>
                      Notification
                      {notificationCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#ff4d4f',
                            borderRadius: '10px',
                            color: 'white',
                            padding: '0 6px',
                            marginLeft: '8px',
                            fontSize: '10px',
                            lineHeight: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '16px',
                            height: '16px',
                            fontWeight: 'bold',
                            verticalAlign: 'middle',
                          }}
                        >
                          {notificationCount}
                        </span>
                      )}
                    </span>
                  ),
                },
              ]
              : []),

            ...((normalizedBasePath === 'admin' || normalizedBasePath === 'guest')
              ? [
                {
                  key: 'master-proposals',
                  icon: <ProfileOutlined />,
                  label: (
                    <span style={{ fontSize: '13.5px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
                      Acknowledge Proposals
                      {unacknowledgedCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#ff4d4f',
                            borderRadius: '10px',
                            color: 'white',
                            padding: '0 6px',
                            marginLeft: '8px',
                            fontSize: '10px',
                            lineHeight: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '16px',
                            height: '16px',
                            fontWeight: 'bold',
                            verticalAlign: 'middle',
                          }}
                        >
                          {unacknowledgedCount}
                        </span>
                      )}
                    </span>
                  ),
                },
              ]
              : []),

            ...((isDirector || isCH || isGHOrScientist) ? [{
              key: 'analytics',
              icon: <BarChartOutlined />,
              label: isCH ? 'CH Analytics' : isDirector ? 'Project Analytics' : basePath === 'scientist' ? 'Scientist Analytics' : 'Analytics',
            }] : []),

            ...((normalizedBasePath === 'admin' || normalizedBasePath === 'guest')
              ? [
                {
                  key: 'overall-analytics',
                  icon: <BarChartOutlined />,
                  label: 'Overall Analytics',
                },
                {
                  key: 'configuration',
                  icon: <SettingOutlined />,
                  label: 'Configuration',
                },
              ]
              : []),

            ...((normalizedBasePath === 'admin')
              ? [
                {
                  key: 'notification',
                  icon: <BellOutlined />,
                  label: (
                    <span>
                      Notification
                      {notificationCount > 0 && (
                        <span style={{
                          backgroundColor: '#ff4d4f',
                          borderRadius: '10px',
                          color: 'white',
                          padding: '0 6px',
                          marginLeft: '8px',
                          fontSize: '10px',
                          lineHeight: '14px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '16px',
                          height: '16px',
                          fontWeight: 'bold',
                          verticalAlign: 'middle',
                        }}>
                          {notificationCount}
                        </span>
                      )}
                    </span>
                  ),
                },
              ]
              : []),

            ...((normalizedBasePath === 'admin' || normalizedBasePath === 'guest')
              ? [
                {
                  key: 'access-control',
                  icon: <UsergroupAddOutlined />,
                  label: 'Access Control'
                },
              ]
              : []),
            ...((normalizedBasePath === 'admin' || normalizedBasePath === 'guest')
              ? [
                {
                  key: 'customers',
                  icon: <TeamOutlined />,
                  label: 'Customers'
                }
              ]
              : [])
          ]}
          className="text-base"
        />
      </div>

      {/* Footer & Logout */}
      <div className="px-4 pb-6 border-t border-slate-100 pt-4 bg-slate-50/50 flex flex-col gap-2.5">
        {/* Profile Icon Trigger */}
        <div className="flex justify-end py-1">
          <Button
            type="default"
            shape="circle"
            size="large"
            icon={<UserOutlined className="text-white text-lg" />}
            onClick={() => {
              setMobileOpen(false);
              handleOpenProfile();
            }}
            title="View/Edit Profile"
            style={{
              backgroundColor: "#2563eb",
              borderColor: "#2563eb",
            }}
            className="shadow-sm transition-all flex items-center justify-center hover:!bg-blue-700 hover:!border-blue-700"
          />
        </div>

        {manualPdfUrl && (
          <Button
            block
            size="large"
            type="default"
            icon={<FilePdfOutlined className="text-slate-500" />}
            onClick={() => {
              setMobileOpen(false)
              window.open(manualPdfUrl, '_blank')
            }}
            style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="text-slate-700 hover:text-blue-600 font-medium"
          >
            User Manual
          </Button>
        )}
        <Button
          danger
          block
          size="large"
          type="primary"
          onClick={() => {
            setMobileOpen(false)
            handleLogout()
          }}
          style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Logout
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Top Header (Visible under 1024px) */}
      <div className="lg:hidden sticky top-0 z-[110] bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: '20px' }} />}
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center p-2 text-slate-700 hover:text-blue-600"
          />
          <img src={cmtiLogo} alt="CMTI logo" className="h-8 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          {manualPdfUrl && (
            <Button
              size="small"
              type="default"
              icon={<FilePdfOutlined className="text-slate-500" />}
              onClick={() => window.open(manualPdfUrl, '_blank')}
              className="text-xs font-medium text-slate-700 flex items-center rounded-md"
            >
              Manual
            </Button>
          )}
          {userName && (
            <div
              onClick={handleOpenProfile}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Avatar size={24} icon={<UserOutlined />} className="bg-blue-600" />
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{userName}</span>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-bold uppercase">
                {userRole || 'User'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Drawer (Visible under 1024px when open) */}
      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
        className="lg:hidden"
      >
        {renderSidebarContent()}
      </Drawer>

      {/* Desktop Fixed Sider (Visible from 1024px and above) */}
      <Sider
        width={260}
        className="hidden lg:block"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 100,
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '4px 0 24px rgba(148, 163, 184, 0.08)'
        }}
      >
        {renderSidebarContent()}
      </Sider>
      {/* User Profile Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg border-b pb-2">
            <UserOutlined className="text-blue-600" />
            <span>User Profile Details</span>
          </div>
        }
        open={isProfileModalOpen}
        onCancel={() => setIsProfileModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
        className="rounded-2xl"
      >
        {userProfileData && (
          <div className="py-2 space-y-4">
            {/* Readonly Info Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Name</span>
                <span className="font-semibold text-slate-800">{userProfileData.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Email</span>
                <span className="font-semibold text-slate-800 truncate block">{userProfileData.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Role</span>
                <span className="font-semibold text-slate-800 capitalize">{userProfileData.role || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Centre</span>
                <span className="font-semibold text-slate-800">{userProfileData.center || userProfileData.centre || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 font-medium block">Group</span>
                <span className="font-semibold text-slate-800">{userProfileData.group || 'N/A'}</span>
              </div>
            </div>

            {/* Form for Editing Designation & Type */}
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleSaveProfile}
              requiredMark={false}
            >
              <Form.Item
                name="designation"
                label={
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">Designation</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">
                      e.g. SCIENTIST-C, SCIENTIST-D, SCIENTIST-E, GH SMC, CH SMPM
                    </span>
                  </div>
                }
              >
                <Input
                  placeholder="Enter designation..."
                  size="large"
                  className="rounded-xl w-full"
                />
              </Form.Item>

              <Form.Item
                name="type"
                label={
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-700">Field / Domain Type</span>
                    <span className="text-xs text-slate-500 font-normal mt-0.5">
                      e.g. Computer Science, Mechanical, Electrical & Communication
                    </span>
                  </div>
                }
              >
                <Input
                  placeholder="Enter field/domain type..."
                  size="large"
                  className="rounded-xl w-full"
                />
              </Form.Item>

              <div className="flex items-center justify-end gap-3 pt-3 border-t mt-4">
                <Button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-xl"
                  size="large"
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={profileLoading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                  size="large"
                >
                  Save Changes
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </>
  )
}

export default Sidebar