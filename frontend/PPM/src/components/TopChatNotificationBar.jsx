import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Avatar, Tooltip } from 'antd'
import {
  MessageOutlined,
  CloseOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { API_BASE_URL } from '../config/api.js'
import messagingImg from '../assets/messaging.png'

dayjs.extend(relativeTime)

const norm = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Helper to check if message is addressed to me
const checkIsToMe = (itemTo, userName, userRole, userGroup) => {
  const toVal = norm(itemTo)
  if (!toVal) return false
  const uName = norm(userName)
  const uRole = norm(userRole)
  const uGrp = norm(userGroup)

  if (toVal === uName || toVal === uRole) return true
  if (uName && (toVal.includes(uName) || uName.includes(toVal))) return true
  if (uRole === 'admin' && (toVal === 'admin' || toVal === 'manjunath' || toVal.includes('admin'))) return true
  if (uRole === 'gh' && (toVal === 'gh' || toVal === uGrp || toVal.includes('group head') || toVal.includes('gh'))) return true
  if (uRole === 'ch' && (toVal === 'ch' || toVal.includes('centre head') || toVal.includes('center head') || toVal.includes('ch'))) return true
  if (uRole === 'scientist' && (toVal === uName || toVal.includes('coordinator') || toVal.includes('project'))) return true
  return false
}

// Helper to check if message is sent by me
const checkIsFromMe = (itemFrom, userName, userRole, userGroup) => {
  const fromVal = norm(itemFrom)
  if (!fromVal) return false
  const uName = norm(userName)
  const uRole = norm(userRole)
  const uGrp = norm(userGroup)

  if (fromVal === uName || fromVal === uRole) return true
  if (uName && (fromVal.includes(uName) || uName.includes(fromVal))) return true
  if (uRole === 'admin' && (fromVal === 'admin' || fromVal === 'manjunath' || fromVal.includes('admin'))) return true
  if (uRole === 'gh' && (fromVal === 'gh' || fromVal === uGrp || fromVal.includes('group head') || fromVal.includes('gh'))) return true
  if (uRole === 'ch' && (fromVal === 'ch' || fromVal.includes('centre head') || fromVal.includes('center head') || fromVal.includes('ch'))) return true
  if (uRole === 'scientist' && (fromVal === uName || fromVal.includes('coordinator') || fromVal.includes('project'))) return true
  return false
}

export default function TopChatNotificationBar({ onOpenChat }) {
  const [currentUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ppm_user')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const userName = (currentUser?.name || '').trim()
  const userRole = (currentUser?.role || currentUser?.dbRole || '').toLowerCase().trim()
  const userGroup = (currentUser?.group || '').trim()
  const userCenter = (currentUser?.center || '').trim()

  const [rawUnreadChats, setRawUnreadChats] = useState([])
  const [ignoredMap, setIgnoredMap] = useState({}) // key -> timestamp when ignored

  // Fetch unread proposal conversations
  const fetchUnreadNotifications = useCallback(async () => {
    if (!userName && !userRole) return
    try {
      let url = `${API_BASE_URL}/proposals/`
      if (userRole === 'scientist') {
        url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(userName)}?user_role=scientist`
      } else if (userRole === 'gh' && userGroup) {
        url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(userGroup)}`
      } else if (userRole === 'ch' && userCenter) {
        url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(userCenter)}`
      }


      const userParams = new URLSearchParams()
      if (userName) userParams.append('user_name', userName)
      if (userRole) userParams.append('user_role', userRole)
      if (userGroup) userParams.append('user_group', userGroup)

      const groupParams = new URLSearchParams()
      if (userName) groupParams.append('user_name', userName)

      const [proposalRes, remarksRes, groupRes] = await Promise.all([
        fetch(url, { headers: { accept: 'application/json' } })
          .then(async res => {
            if (!res.ok && url !== `${API_BASE_URL}/proposals/`) {
              const fallbackRes = await fetch(`${API_BASE_URL}/proposals/`, { headers: { accept: 'application/json' } })
              return fallbackRes.ok ? fallbackRes.json() : []
            }
            return res.ok ? res.json() : []
          })
          .catch(() => []),
        fetch(`${API_BASE_URL}/Remarkss/chat-history?${userParams.toString()}`, { headers: { accept: 'application/json' } })
          .then(res => res.ok ? res.json() : [])
          .catch(() => []),
        fetch(`${API_BASE_URL}/group-chats/?${groupParams.toString()}`, { headers: { accept: 'application/json' } })
          .then(res => res.ok ? res.json() : [])
          .catch(() => [])
      ])

      const proposalsList = Array.isArray(proposalRes) ? proposalRes : []
      const allRemarks = Array.isArray(remarksRes) ? remarksRes : []
      const groupList = Array.isArray(groupRes) ? groupRes : []

      const unreadList = []

      proposalsList.forEach(p => {
        const itemRemarks = allRemarks.filter(r => String(r.project_id) === String(p.id))
        let unreadCount = 0
        let lastUnreadMsg = null

        itemRemarks.forEach(r => {
          const isToMe = checkIsToMe(r.to, userName, userRole, userGroup)
          if (isToMe && !r.message_seen) {
            unreadCount++
            if (!lastUnreadMsg || new Date(r.created_at) > new Date(lastUnreadMsg.timestamp)) {
              lastUnreadMsg = {
                text: r.message,
                sender: r.from_ || r.user_name || 'System',
                timestamp: r.created_at || r.updated_at,
                attachmentName: r.attachment_name
              }
            }
          }
          const isReplyToMe = checkIsFromMe(r.from_, userName, userRole, userGroup)
          if (isReplyToMe && r.respond_to_remarks && !r.reply_seen) {
            unreadCount++
            if (!lastUnreadMsg || new Date(r.replied_at || r.updated_at) > new Date(lastUnreadMsg.timestamp)) {
              lastUnreadMsg = {
                text: r.respond_to_remarks,
                sender: r.replyer || r.to || 'System',
                timestamp: r.replied_at || r.updated_at,
                attachmentName: null
              }
            }
          }
        })

        if (unreadCount > 0 && lastUnreadMsg) {
          const displayTitle = p.quote_description || p.quote_reference || p.project_number || `Proposal #${p.id}`
          unreadList.push({
            key: `proposal-${p.id}`,
            id: p.id,
            itemType: 'proposal',
            title: displayTitle,
            subtitle: p.project_number ? `Project #${p.project_number}` : `ID: #${p.id}`,
            sender: lastUnreadMsg.sender,
            lastMessage: lastUnreadMsg.attachmentName ? `📎 [File] ${lastUnreadMsg.attachmentName}` : lastUnreadMsg.text,
            lastMessageTime: lastUnreadMsg.timestamp,
            unreadCount,
            proposalData: p
          })
        }
      })

      groupList.forEach(g => {
        if ((g.unread_count || 0) > 0) {
          const lastMsg = g.last_message ? (g.last_message.attachment_name ? `📎 [File] ${g.last_message.attachment_name}` : g.last_message.message) : 'New group message'
          const lastTime = g.last_message?.created_at || g.created_at || new Date().toISOString()
          const senderName = g.last_message?.sender_name || 'Group Member'
          unreadList.push({
            key: `group-${g.id}`,
            id: g.id,
            itemType: 'group',
            title: g.name,
            subtitle: `Group Chat #${g.id}`,
            sender: senderName,
            lastMessage: lastMsg,
            lastMessageTime: lastTime,
            unreadCount: g.unread_count,
            groupData: g
          })
        }
      })

      // Sort newest unread first
      unreadList.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))
      setRawUnreadChats(unreadList)
    } catch (err) {
      console.error('Error fetching unread notifications:', err)
    }
  }, [userName, userRole, userGroup, userCenter])

  useEffect(() => {
    fetchUnreadNotifications()
    const handleUpdated = () => fetchUnreadNotifications()
    window.addEventListener('ppm-chat-updated', handleUpdated)
    return () => {
      window.removeEventListener('ppm-chat-updated', handleUpdated)
    }
  }, [fetchUnreadNotifications])

  // Filter out ignored items unless a newer message arrived after ignore
  const visibleNotifications = useMemo(() => {
    return rawUnreadChats.filter(item => {
      const ignoredAt = ignoredMap[item.key]
      if (!ignoredAt) return true
      // If a new message arrived after user clicked ignore, re-show it!
      const msgTime = new Date(item.lastMessageTime).getTime()
      return msgTime > ignoredAt
    })
  }, [rawUnreadChats, ignoredMap])

  // Ignore button click handler
  const handleIgnore = (e, itemKey) => {
    e.stopPropagation()
    setIgnoredMap(prev => ({
      ...prev,
      [itemKey]: Date.now()
    }))
  }

  if (visibleNotifications.length === 0) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-[310px] w-full font-sans transition-all duration-300 animate-fadeIn pointer-events-auto">
      <div className="bg-white/85 hover:bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.12)] rounded-2xl p-2 text-slate-900 transition-all">
        {/* Header with PPM Messaging Logo */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/60 mb-1.5">
          <div className="flex items-center gap-1.5">
            <img src={messagingImg} alt="PPM Chat Logo" className="w-4 h-4 object-contain drop-shadow-xs" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-800">
              PPM Chat
            </span>
            <span className="bg-emerald-100 text-emerald-700 font-extrabold text-[9px] px-1.5 py-0.2 rounded-full border border-emerald-300/50">
              {visibleNotifications.length}
            </span>
          </div>
          <span className="text-[8px] text-slate-400 font-medium">
            Click to reply
          </span>
        </div>

        {/* Frosted Toast Cards Stack */}
        <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-0.5 scrollbar-none">
          {visibleNotifications.map((item) => (
            <div
              key={item.key}
              onClick={() => onOpenChat && onOpenChat(item)}
              className="group relative w-full bg-slate-50/90 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-400/60 rounded-xl p-2 cursor-pointer transition-all duration-200 shadow-xs flex flex-col justify-between"
            >
              {/* Top row: Avatar, Sender, Title, Time & Ignore (x) */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar
                    size={22}
                    className="bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-[9px] shrink-0 shadow-xs"
                    icon={<UserOutlined />}
                  >
                    {(item.sender || 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-900 truncate leading-tight group-hover:text-emerald-700 transition-colors">
                      {item.sender}
                    </div>
                    <div className="text-[8px] text-slate-500 truncate">
                      {item.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[8px] text-emerald-700 font-bold">
                    {dayjs(item.lastMessageTime).fromNow()}
                  </span>
                  <Tooltip title="Dismiss">
                    <button
                      onClick={(e) => handleIgnore(e, item.key)}
                      className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200/70 rounded-full transition-colors leading-none ml-0.5"
                    >
                      <CloseOutlined className="text-[8px]" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Message Preview & Badge */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200/60 mt-1">
                <p className="text-[10px] text-slate-700 truncate m-0 flex-1 font-sans">
                  {item.lastMessage}
                </p>
                <span className="px-1.5 py-0.2 text-[8px] font-bold rounded-full bg-emerald-600 text-white shrink-0 shadow-xs">
                  {item.unreadCount} new
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
