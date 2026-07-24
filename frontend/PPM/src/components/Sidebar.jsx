import { Layout, Menu, Button, Typography, message, Select } from 'antd'
import {
  ProfileOutlined,
  SettingOutlined,
  ProjectOutlined,
  BarChartOutlined,
  BellOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
  MessageOutlined
} from '@ant-design/icons'
import cmtiLogo from '../assets/waitro-member-cmti.png'
import { useLocation, useNavigate } from 'react-router-dom'
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

const { Sider } = Layout
const { Text } = Typography

function Sidebar() {
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
        userRole = parsedUser.role
      }
    }
  } catch (error) {
    console.error('Failed to read user from localStorage', error)
  }

  const [notificationCount, setNotificationCount] = useState(0);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [selectedRole, setSelectedRole] = useState('');
  const isDirector = basePath === 'director'
  const isCH = basePath === 'ch'
  const isGuest = basePath === 'guest'
  // Treat Scientist as same as GH
  const isGHOrScientist = basePath === 'gh' || basePath === 'scientist'

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    // Fetch unread proposal chats + unread group chats for the active user
    if (userName && !isGuest && !isCH && !isDirector) {
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
  }, [userName, userRole, isGuest, isCH, isDirector]);

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

  return (
    <Sider
      width={260}
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

              else navigate(`${prefix}/proposals`)
            }}
            items={[
              { key: 'proposals', icon: <ProfileOutlined />, label: 'Proposals / Projects' },
              ...(!isGuest && !isCH && !isDirector ? [{
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
        <div className="px-4 pb-6 border-t border-slate-100 pt-4 bg-slate-50/50">
          <Button
            danger
            block
            size="large"
            type="primary"
            onClick={handleLogout}
            style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Logout
          </Button>
        </div>
      </div>
    </Sider>
  )
}

export default Sidebar