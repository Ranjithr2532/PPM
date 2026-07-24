import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Input,
  Button,
  Tag,
  Spin,
  Tooltip,
  Avatar,
  Empty,
  Typography,
  message,
  Modal,
  Select
} from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  SendOutlined,
  MessageOutlined,
  CheckOutlined,
  UserOutlined,
  ReloadOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CloseCircleFilled,
  PictureOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  DragOutlined,
  ExpandOutlined,
  CompressOutlined,
  FullscreenOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { API_BASE_URL } from '../config/api.js'
import { groupApi } from '../utils/groupApi.js'

dayjs.extend(relativeTime)
const { Text, Title } = Typography

// Helper to format WhatsApp-style timestamps
const formatWhatsAppTime = (timestamp) => {
  if (!timestamp) return ''
  const date = dayjs(timestamp)
  const now = dayjs()
  if (date.isSame(now, 'day')) {
    return date.format('hh:mm A')
  }
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Yesterday'
  }
  if (date.isSame(now, 'year')) {
    return date.format('DD MMM')
  }
  return date.format('DD/MM/YYYY')
}

// Helper to format Date Header Banners
const formatDateBanner = (dateKey) => {
  if (!dateKey) return ''
  const date = dayjs(dateKey)
  const now = dayjs()
  if (date.isSame(now, 'day')) return 'Today'
  if (date.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday'
  return date.format('MMMM DD, YYYY')
}

// Helper to check if URL/type is an image
const isImageAttachment = (url, type) => {
  if (type && type.toLowerCase().startsWith('image/')) return true
  if (url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return true
  return false
}

// String normalization helper
const norm = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Check if message is to me
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

// Check if message is from me
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

export default function FloatingChatsWidget({ open, onClose, onUnreadCountChange, targetChatItem }) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(false)
  const [highlightUnread, setHighlightUnread] = useState(false)

  // Create Group state
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [createGroupLoading, setCreateGroupLoading] = useState(false)

  // Current user info
  const [currentUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ppm_user')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const userRole = useMemo(() => {
    const rawRole = (currentUser?.role || currentUser?.dbRole || '').toLowerCase().trim()
    if (rawRole === 'group head') return 'gh'
    if (rawRole === 'center head' || rawRole === 'centre head') return 'ch'
    if (rawRole === 'project coordinator' || rawRole === 'scientist') return 'scientist'
    return rawRole || 'admin'
  }, [currentUser])

  const userName = (currentUser?.name || '').trim()
  const userGroup = (currentUser?.group || '').trim()
  const userCenter = (currentUser?.center || '').trim()

  const handleOpenFullPage = () => {
    onClose()
    const currentPath = window.location.pathname.toLowerCase()
    if (currentPath.includes('/admin')) navigate('/admin/chats')
    else if (currentPath.includes('/scientist')) navigate('/scientist/chats')
    else if (currentPath.includes('/gh')) navigate('/gh/chats')
    else if (currentPath.includes('/ch')) navigate('/ch/chats')
    else navigate('/chats')
  }

  // Handle Create New Group
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      message.error('Please enter a group name')
      return
    }
    setCreateGroupLoading(true)
    try {
      const memberIds = Array.from(new Set([...selectedMemberIds, currentUserId]))
      const newGroup = await groupApi.createGroup(newGroupName.trim(), memberIds)
      message.success(`Group "${newGroup.name}" created!`)
      setCreateGroupModalOpen(false)
      setNewGroupName('')
      setSelectedMemberIds([])
      await fetchAllChats()

      setSelectedChatItem({
        itemType: 'group',
        rawId: newGroup.id,
        key: `group-${newGroup.id}`,
        title: newGroup.name,
        subtitle: `Group Chat #${newGroup.id}`
      })
      setViewMode('chat')
    } catch (err) {
      console.error('Error creating group:', err)
      message.error('Failed to create group')
    } finally {
      setCreateGroupLoading(false)
    }
  }

  // Draggable position state
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const posRef = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const animFrame = useRef(null)

  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return
    isDragging.current = true
    dragStart.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return
      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      posRef.current = { x: newX, y: newY }

      if (!animFrame.current) {
        animFrame.current = requestAnimationFrame(() => {
          setPos({ x: posRef.current.x, y: posRef.current.y })
          animFrame.current = null
        })
      }
    }
    const handleMouseUp = () => {
      isDragging.current = false
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [])

  // Navigation mode: 'list' | 'chat'
  const [viewMode, setViewMode] = useState('list')

  // State for Proposal Chats & Group Chats
  const [proposals, setProposals] = useState([])
  const [groupChats, setGroupChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatFilter, setChatFilter] = useState('all') // 'all' | 'proposals' | 'groups'
  const [allRemarksList, setAllRemarksList] = useState([])

  // Selected chat item state: { itemType: 'proposal' | 'group', rawId: number|string, key: string }
  const [selectedChatItem, setSelectedChatItem] = useState(null)

  useEffect(() => {
    if (open && targetChatItem) {
      setSelectedChatItem({
        itemType: targetChatItem.itemType || 'proposal',
        rawId: targetChatItem.id || targetChatItem.rawId,
        key: targetChatItem.key || `proposal-${targetChatItem.id}`,
        title: targetChatItem.title,
        subtitle: targetChatItem.subtitle,
        proposalData: targetChatItem.proposalData
      })
      setViewMode('chat')
      setHighlightUnread(true)
      const timer = setTimeout(() => setHighlightUnread(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [open, targetChatItem])

  // Group Details state
  const [groupMessages, setGroupMessages] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [allSystemUsers, setAllSystemUsers] = useState([])

  // Conversation Messages state
  const [messages, setMessages] = useState([])
  const [rawRemarksList, setRawRemarksList] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [sendLoading, setSendLoading] = useState(false)
  const [targetRecipient, setTargetRecipient] = useState('')
  const [previewImage, setPreviewImage] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // System User ID resolver
  const currentUserId = useMemo(() => {
    if (currentUser?.id) return currentUser.id
    const matched = allSystemUsers.find(u => norm(u.name) === norm(userName))
    return matched?.id || 408
  }, [currentUser, allSystemUsers, userName])

  useEffect(() => {
    groupApi.getAllUsers().then(users => {
      if (Array.isArray(users)) setAllSystemUsers(users)
    }).catch(() => {})
  }, [])

  // Active Proposal object if selected item is a proposal
  const selectedProposal = useMemo(() => {
    if (selectedChatItem?.itemType === 'proposal') {
      return proposals.find(p => String(p.id) === String(selectedChatItem.rawId)) || null
    }
    return null
  }, [selectedChatItem, proposals])

  // Active Group object if selected item is a group
  const selectedGroup = useMemo(() => {
    if (selectedChatItem?.itemType === 'group') {
      return groupChats.find(g => String(g.id) === String(selectedChatItem.rawId)) || null
    }
    return null
  }, [selectedChatItem, groupChats])

  // Fetch Group Messages & Members
  const fetchGroupDetails = useCallback(async (groupId) => {
    if (!groupId) return
    setMessagesLoading(true)
    try {
      const [msgs, mbrs] = await Promise.all([
        groupApi.getMessages(groupId),
        groupApi.getMembers(groupId)
      ])
      const msgList = Array.isArray(msgs) ? msgs : []
      setGroupMessages(msgList)
      setGroupMembers(Array.isArray(mbrs) ? mbrs : [])

      if (currentUserId) {
        msgList.forEach(m => {
          const alreadySeen = (m.seen_by || []).some(s => s.user_id === currentUserId)
          if (!alreadySeen && m.sender_id !== currentUserId) {
            groupApi.markMessageSeen(m.id, currentUserId).catch(() => {})
          }
        })
      }
    } catch (err) {
      console.error('Error fetching group details:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    if (selectedChatItem?.itemType === 'group' && selectedChatItem?.rawId) {
      fetchGroupDetails(selectedChatItem.rawId)
    }
  }, [selectedChatItem, fetchGroupDetails])

  // Fetch Proposals & Groups together into unified list
  const fetchAllChats = useCallback(async () => {
    setChatsLoading(true)
    try {
      let url = `${API_BASE_URL}/proposals/`
      if (userRole === 'scientist') {
        url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(userName)}?user_role=scientist`
      } else if (userRole === 'gh' && userGroup) {
        url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(userGroup)}`
      } else if (userRole === 'ch' && userCenter) {
        url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(userCenter)}`
      }

      const proposalPromise = fetch(url, { headers: { accept: 'application/json' } })
        .then(async res => {
          if (!res.ok && url !== `${API_BASE_URL}/proposals/`) {
            const fallbackRes = await fetch(`${API_BASE_URL}/proposals/`, { headers: { accept: 'application/json' } })
            return fallbackRes.ok ? fallbackRes.json() : []
          }
          return res.ok ? res.json() : []
        })
        .catch(() => [])

      const userParams = new URLSearchParams()
      if (userName) userParams.append('user_name', userName)
      if (userRole) userParams.append('user_role', userRole)
      if (userGroup) userParams.append('user_group', userGroup)

      const remarksPromise = fetch(`${API_BASE_URL}/Remarkss/chat-history?${userParams.toString()}`, { headers: { accept: 'application/json' } })
        .then(res => res.ok ? res.json() : [])
        .catch(() => [])

      const groupsPromise = groupApi.getGroups(currentUserId, userName)
        .catch(() => [])

      const [proposalData, allRemarks, groupData] = await Promise.all([
        proposalPromise,
        remarksPromise,
        groupsPromise
      ])

      setAllRemarksList(allRemarks)

      const pList = Array.isArray(proposalData) ? proposalData : []
      const proposalsWithRemarks = pList.map(item => {
        const itemRemarks = allRemarks.filter(r => String(r.project_id) === String(item.id))
        const sorted = itemRemarks.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        const lastMsg = sorted[0] || null

        const unreadCount = itemRemarks.filter(r => {
          const isToMe = checkIsToMe(r.to, userName, userRole, userGroup)
          const isFromMe = checkIsFromMe(r.from_, userName, userRole, userGroup)
          const unseenMsg = isToMe && !r.message_seen
          const unseenReply = isFromMe && r.respond_to_remarks && !r.reply_seen
          return unseenMsg || unseenReply
        }).length

        const displayMsgText = lastMsg?.attachment_url ? `📎 [File] ${lastMsg?.attachment_name || 'Attachment'}` : (lastMsg?.remarks_description || lastMsg?.respond_to_remarks || 'No messages yet')

        return {
          ...item,
          lastMessage: displayMsgText,
          lastMessageTime: lastMsg?.updated_at || lastMsg?.created_at || null,
          unreadCount
        }
      })

      setProposals(proposalsWithRemarks)
      setGroupChats(Array.isArray(groupData) ? groupData : [])
    } catch (err) {
      console.error('Error fetching chats:', err)
    } finally {
      setChatsLoading(false)
    }
  }, [userRole, userName, userGroup, userCenter, currentUserId])

  useEffect(() => {
    if (open) {
      fetchAllChats()
      const handleChatUpdated = () => fetchAllChats()
      window.addEventListener('ppm-chat-updated', handleChatUpdated)
      return () => {
        window.removeEventListener('ppm-chat-updated', handleChatUpdated)
      }
    }
  }, [open, fetchAllChats])

  // Combine Proposals and Group Chats
  const combinedChats = useMemo(() => {
    const proposalItems = proposals.map(p => {
      const displayTitle = p.quote_description || p.quote_reference || p.project_number || `Proposal #${p.id}`
      const displayUser = p.project_co_ordinator || p.customer_name || p.quotation_given_by_name || 'CMTI Project'
      return {
        key: `proposal-${p.id}`,
        itemType: 'proposal',
        rawId: p.id,
        title: displayTitle,
        subtitle: displayUser,
        lastMessage: p.lastMessage || 'No messages yet',
        lastMessageTime: p.lastMessageTime,
        unreadCount: p.unreadCount || 0,
        data: p
      }
    })

    const groupItems = groupChats.map(g => {
      const lastMsg = g.last_message ? (g.last_message.attachment_name ? `📎 [File] ${g.last_message.attachment_name}` : g.last_message.message) : 'Group chat created'
      const lastTime = g.last_message?.created_at || g.created_at || null
      return {
        key: `group-${g.id}`,
        itemType: 'group',
        rawId: g.id,
        title: g.name,
        subtitle: `Group Chat #${g.id}`,
        lastMessage: lastMsg,
        lastMessageTime: lastTime,
        unreadCount: g.unread_count || 0,
        data: g
      }
    })

    const combined = [...proposalItems, ...groupItems]
    combined.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0
      if (timeA !== timeB) return timeB - timeA
      return String(b.rawId).localeCompare(String(a.rawId))
    })

    return combined
  }, [proposals, groupChats])

  const totalUnreadCount = useMemo(() => {
    return combinedChats.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0)
  }, [combinedChats])

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(totalUnreadCount)
    }
  }, [totalUnreadCount, onUnreadCountChange])

  // Filtered Chats based on search & pills
  const filteredChats = useMemo(() => {
    return combinedChats.filter(item => {
      if (chatFilter === 'proposals' && item.itemType !== 'proposal') return false
      if (chatFilter === 'groups' && item.itemType !== 'group') return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const title = (item.title || '').toLowerCase()
      const subtitle = (item.subtitle || '').toLowerCase()
      const lastMsg = (item.lastMessage || '').toLowerCase()
      return title.includes(q) || subtitle.includes(q) || lastMsg.includes(q)
    })
  }, [combinedChats, chatFilter, searchQuery])

  // Recipient options for proposal chats (with GH, CH, PC, Admin options)
  const recipientOptions = useMemo(() => {
    if (!selectedProposal) return []

    const pcName = (selectedProposal.project_co_ordinator || selectedProposal.quotation_given_by_name || '').trim()
    const uNameNorm = norm(userName)
    const pcNameNorm = norm(pcName)

    const isMePC = uNameNorm && pcNameNorm && (
      uNameNorm === pcNameNorm ||
      uNameNorm.includes(pcNameNorm) ||
      pcNameNorm.includes(uNameNorm)
    )

    const centreName = selectedProposal.center || selectedProposal.centre || 'CH'
    const groupName = selectedProposal.group || 'GH'

    if (userRole === 'scientist') {
      return [
        { label: `Group Head (${groupName})`, value: 'gh' },
        { label: `Centre Head (${centreName})`, value: 'ch' },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'gh') {
      if (isMePC) {
        return [
          { label: `Centre Head (${centreName})`, value: 'ch' },
          { label: 'Admin', value: 'admin' }
        ]
      }
      return [
        { label: `Project Coordinator (${pcName || 'PC'})`, value: pcName || 'PC' },
        { label: `Centre Head (${centreName})`, value: 'ch' },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'ch') {
      if (isMePC) {
        return [
          { label: `Group Head (${groupName})`, value: 'gh' },
          { label: 'Admin', value: 'admin' }
        ]
      }
      return [
        { label: `Project Coordinator (${pcName || 'PC'})`, value: pcName || 'PC' },
        { label: `Group Head (${groupName})`, value: 'gh' },
        { label: 'Admin', value: 'admin' }
      ]
    } else {
      const opts = []
      if (!isMePC && pcName) {
        opts.push({ label: `Project Coordinator (${pcName})`, value: pcName })
      }
      opts.push({ label: `Group Head (${groupName})`, value: 'gh' })
      opts.push({ label: `Centre Head (${centreName})`, value: 'ch' })
      return opts
    }
  }, [userRole, userName, selectedProposal])

  // Auto target recipient thread
  useEffect(() => {
    if (!selectedProposal || recipientOptions.length === 0) return
    const itemRemarks = allRemarksList.filter(r => String(r.project_id) === String(selectedProposal.id))
    if (itemRemarks.length > 0) {
      const sorted = [...itemRemarks].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
      const unreadRemark = sorted.find(r => {
        const isToMe = (r.to || '').toLowerCase() === userName.toLowerCase() ||
          (r.to || '').toLowerCase() === userRole.toLowerCase() ||
          (userRole === 'gh' && ((r.to || '').toLowerCase() === 'gh' || (r.to || '').toLowerCase() === userGroup.toLowerCase()))
        return isToMe && !r.message_seen
      })
      const targetRemark = unreadRemark || sorted[0]
      if (targetRemark) {
        const fromVal = (targetRemark.from_ || '').toLowerCase().trim()
        const toVal = (targetRemark.to || '').toLowerCase().trim()
        const matchedOption = recipientOptions.find(opt => {
          const optVal = opt.value.toLowerCase().trim()
          return fromVal.includes(optVal) || optVal.includes(fromVal) ||
                 toVal.includes(optVal) || optVal.includes(toVal) ||
                 (optVal === 'admin' && (fromVal === 'manjunath' || toVal === 'admin')) ||
                 (optVal === 'gh' && (fromVal === 'gh' || toVal === 'gh' || fromVal === userGroup.toLowerCase())) ||
                 (optVal === 'ch' && (fromVal === 'ch' || toVal === 'ch'))
        })
        if (matchedOption) {
          setTargetRecipient(matchedOption.value)
          return
        }
      }
    }
    setTargetRecipient(recipientOptions[0].value)
  }, [selectedProposal, recipientOptions, allRemarksList, userName, userRole, userGroup])

  // Fetch Proposal Messages Stream
  const fetchMessages = useCallback(async (proposalId, targetUser) => {
    if (!proposalId) return
    setMessagesLoading(true)
    try {
      const queryParams = new URLSearchParams({ project_id: proposalId })
      const activeUser = userName || userRole.toUpperCase()
      const activeRecipient = targetUser || targetRecipient

      if (activeUser && activeRecipient) {
        queryParams.append('user1', activeUser)
        queryParams.append('user2', activeRecipient)
      }
      if (userName) queryParams.append('user_name', userName)
      if (userRole) queryParams.append('user_role', userRole)
      if (userGroup) queryParams.append('user_group', userGroup)

      const res = await fetch(`${API_BASE_URL}/Remarkss/chat-history?${queryParams.toString()}`, {
        headers: { accept: 'application/json' }
      })
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setRawRemarksList(list)

      const events = []
      list.forEach(item => {
        if (item.remarks_description || item.attachment_url) {
          events.push({
            id: `msg-${item.id}`,
            text: item.remarks_description,
            sender: item.from_ || 'System',
            timestamp: item.created_at || item.updated_at,
            seen: item.message_seen,
            attachmentUrl: item.attachment_url,
            attachmentName: item.attachment_name,
            attachmentType: item.attachment_type,
            isReply: false
          })
        }
        if (item.respond_to_remarks) {
          events.push({
            id: `reply-${item.id}`,
            text: item.respond_to_remarks,
            sender: item.replyer || item.to || 'System',
            timestamp: item.replied_at || item.updated_at,
            seen: item.reply_seen,
            isReply: true
          })
        }
      })

      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      setMessages(events)

      let needBroadcast = false
      for (const item of list) {
        const isToMe = checkIsToMe(item.to, userName, userRole, userGroup)
        if (isToMe && !item.message_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-seen`, { method: 'PATCH' })
          needBroadcast = true
        }
        const isReplyToMe = checkIsFromMe(item.from_, userName, userRole, userGroup)
        if (isReplyToMe && item.respond_to_remarks && !item.reply_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-reply-seen`, { method: 'PATCH' })
          needBroadcast = true
        }
      }
      if (needBroadcast) {
        window.dispatchEvent(new CustomEvent('ppm-chat-updated'))
        fetchAllChats()
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [userName, userRole, userGroup, targetRecipient])

  useEffect(() => {
    if (selectedProposal?.id) {
      fetchMessages(selectedProposal.id, targetRecipient)
    }
  }, [selectedProposal, targetRecipient, fetchMessages])

  const getSenderIdentifier = useCallback(() => {
    if (userRole === 'scientist') {
      return selectedProposal?.project_co_ordinator || selectedProposal?.quotation_given_by_name || 'Project Coordinator'
    } else if (userRole === 'gh') {
      return 'gh'
    } else if (userRole === 'ch') {
      return 'ch'
    } else {
      return 'admin'
    }
  }, [userRole, selectedProposal])

  // File selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        message.error('File size exceeds 25MB limit')
        return
      }
      setSelectedFile(file)
    }
    e.target.value = ''
  }

  // Handle Send Proposal Message
  const handleSendProposalMessage = async () => {
    if (!inputText.trim() && !selectedFile) return
    if (!selectedProposal?.id) return

    setSendLoading(true)
    const msgText = inputText.trim()
    try {
      const senderVal = getSenderIdentifier()
      let attachmentInfo = {}

      if (selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)
        const uploadRes = await fetch(`${API_BASE_URL}/Remarkss/upload-attachment`, {
          method: 'POST',
          body: formData
        })
        if (!uploadRes.ok) throw new Error('Failed to upload file attachment')
        attachmentInfo = await uploadRes.json()
      }

      const pendingMessageToReply = rawRemarksList.find(r => {
        if (r.respond_to_remarks) return false
        const isToMe = checkIsToMe(r.to, userName, userRole, userGroup)
        const fromTarget = norm(r.from_)
        const activeTarget = norm(targetRecipient)
        const matchesThread = fromTarget.includes(activeTarget) || activeTarget.includes(fromTarget) ||
          (activeTarget === 'admin' && (fromTarget === 'admin' || fromTarget === 'manjunath')) ||
          (activeTarget === 'gh' && (fromTarget === 'gh' || fromTarget === norm(userGroup)))

        return isToMe && matchesThread
      })

      if (pendingMessageToReply && !selectedFile) {
        const payload = {
          from_: pendingMessageToReply.from_,
          to: pendingMessageToReply.to,
          project_id: selectedProposal.id,
          remarks_description: pendingMessageToReply.remarks_description,
          respond_to_remarks: msgText,
          replyer: senderVal
        }

        const res = await fetch(`${API_BASE_URL}/Remarkss/${pendingMessageToReply.id}`, {
          method: 'PUT',
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('Failed to send reply')
      } else {
        const payload = {
          from_: senderVal,
          to: targetRecipient,
          project_id: selectedProposal.id,
          remarks_description: msgText,
          attachment_url: attachmentInfo.attachment_url || null,
          attachment_name: attachmentInfo.attachment_name || null,
          attachment_type: attachmentInfo.attachment_type || null,
          message_seen: false
        }

        const res = await fetch(`${API_BASE_URL}/Remarkss/`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (!res.ok) throw new Error('Failed to send message')
      }

      setInputText('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      message.success('Message sent')

      await fetchMessages(selectedProposal.id)
      fetchAllChats()
    } catch (err) {
      console.error('Send message error:', err)
      message.error('Failed to send message')
    } finally {
      setSendLoading(false)
    }
  }

  // Handle Send Group Message
  const handleSendGroupMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !selectedGroup?.id) return
    setSendLoading(true)
    try {
      let attachmentInfo = null
      if (selectedFile) {
        attachmentInfo = await groupApi.uploadAttachment(selectedFile)
      }
      await groupApi.sendMessage(selectedGroup.id, currentUserId, inputText.trim(), attachmentInfo)
      setInputText('')
      setSelectedFile(null)
      fetchGroupDetails(selectedGroup.id)
      fetchAllChats()
    } catch (err) {
      console.error('Error sending group message:', err)
      message.error('Failed to send group message')
    } finally {
      setSendLoading(false)
    }
  }

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (viewMode === 'chat') {
      scrollToBottom()
    }
  }, [messages, groupMessages, viewMode])

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = []
    let currentGroup = null

    messages.forEach(msg => {
      const dateKey = dayjs(msg.timestamp).format('YYYY-MM-DD')
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = { dateKey, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push(msg)
    })

    return groups
  }, [messages])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: 9999,
        width: isExpanded ? 640 : 380,
        height: isExpanded ? 680 : 540,
        boxShadow: '0 20px 40px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.12)',
        transition: 'width 0.25s ease, height 0.25s ease',
      }}
      className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col font-sans transition-shadow"
    >
      {/* DRAGGABLE HEADER */}
      <div
        onMouseDown={handleMouseDown}
        className="px-4 py-3 bg-emerald-700 text-white flex items-center justify-between cursor-move select-none shadow-md shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {viewMode === 'chat' ? (
            <button
              onClick={() => {
                setViewMode('list')
                setSelectedChatItem(null)
              }}
              className="no-drag p-1 hover:bg-emerald-800 rounded-full text-white transition-colors"
            >
              <ArrowLeftOutlined className="text-base" />
            </button>
          ) : (
            <MessageOutlined className="text-lg text-emerald-200" />
          )}

          <div className="truncate">
            <Text className="font-bold text-white text-sm block truncate leading-tight">
              {viewMode === 'chat'
                ? (selectedChatItem?.itemType === 'proposal' ? selectedChatItem.title : selectedGroup?.name)
                : 'PPM Messaging'}
            </Text>
            <Text className="text-[10px] text-emerald-200 block truncate">
              {viewMode === 'chat'
                ? (selectedChatItem?.itemType === 'proposal' ? selectedChatItem.subtitle : `${groupMembers.length} members`)
                : `${combinedChats.length} conversations`}
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-1 no-drag shrink-0">
          <Tooltip title="Create New Group">
            <button
              onClick={() => setCreateGroupModalOpen(true)}
              className="p-1 hover:bg-emerald-800 rounded-full text-white/90 transition-colors"
            >
              <UsergroupAddOutlined className="text-xs" />
            </button>
          </Tooltip>
          <Tooltip title={isExpanded ? "Collapse window size" : "Expand window size"}>
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1 hover:bg-emerald-800 rounded-full text-white/90 transition-colors"
            >
              {isExpanded ? <CompressOutlined className="text-xs" /> : <ExpandOutlined className="text-xs" />}
            </button>
          </Tooltip>

          <Tooltip title="Open Fullscreen Chat Page">
            <button
              onClick={handleOpenFullPage}
              className="p-1 hover:bg-emerald-800 rounded-full text-white/90 transition-colors"
            >
              <FullscreenOutlined className="text-xs" />
            </button>
          </Tooltip>

          <Tooltip title="Refresh chats">
            <button
              onClick={fetchAllChats}
              className="p-1 hover:bg-emerald-800 rounded-full text-white/90 transition-colors"
            >
              <ReloadOutlined className={`text-xs ${chatsLoading ? 'animate-spin' : ''}`} />
            </button>
          </Tooltip>

          <Tooltip title="Drag window">
            <DragOutlined className="text-emerald-300 text-sm cursor-move mx-0.5" />
          </Tooltip>

          <button
            onClick={onClose}
            className="p-1 hover:bg-emerald-800 rounded-full text-white/90 transition-colors"
          >
            <CloseOutlined className="text-sm" />
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: CHAT NAMES LIST VIEW */}
      {viewMode === 'list' && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {/* Search Bar & Filter Chips */}
          <div className="p-3 bg-white border-b border-slate-100 space-y-2">
            <Input
              prefix={<SearchOutlined className="text-slate-400 text-xs" />}
              placeholder="Search chat names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="small"
              className="rounded-xl bg-slate-100 border-none px-3 py-1.5 text-xs"
            />

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1.5">
                {['all', 'proposals', 'groups'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setChatFilter(filter)}
                    className={`px-3 py-0.5 text-[11px] font-semibold rounded-full capitalize transition-all ${
                      chatFilter === filter
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCreateGroupModalOpen(true)}
                className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1 border border-emerald-200"
              >
                <UsergroupAddOutlined />
                <span>+ Group</span>
              </button>
            </div>
          </div>

          {/* Chronological Conversations Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
            {chatsLoading ? (
              <div className="p-8 text-center"><Spin /></div>
            ) : filteredChats.length === 0 ? (
              <Empty description="No chats found" className="my-8" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              filteredChats.map(item => {
                const isProposal = item.itemType === 'proposal'

                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      setSelectedChatItem({
                        itemType: item.itemType,
                        rawId: item.rawId,
                        key: item.key,
                        title: item.title,
                        subtitle: item.subtitle
                      })
                      setViewMode('chat')
                    }}
                    className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 relative"
                  >
                    <div className="relative shrink-0">
                      {isProposal ? (
                        <Avatar className="bg-slate-200 text-slate-700 font-bold text-xs" size={38}>
                          {(item.subtitle || item.title).charAt(0).toUpperCase()}
                        </Avatar>
                      ) : (
                        <Avatar className="bg-emerald-700 text-white font-bold text-xs" size={38}>
                          <TeamOutlined />
                        </Avatar>
                      )}
                      {item.unreadCount > 0 && (
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white absolute top-0 right-0"></span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <Text className="font-semibold text-slate-900 text-xs truncate block pr-1">
                          {item.title}
                        </Text>
                        {item.lastMessageTime && (
                          <Text className="text-[10px] text-slate-400 shrink-0">
                            {formatWhatsAppTime(item.lastMessageTime)}
                          </Text>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="truncate text-slate-500 max-w-[200px]">
                          {item.lastMessage}
                        </span>
                        {item.unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center shrink-0">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CONVERSATION MESSAGES VIEW */}
      {viewMode === 'chat' && (
        <div className="flex-1 flex flex-col bg-[#efeae2]/30 overflow-hidden">
          {/* Thread Switcher if Proposal */}
          {selectedChatItem?.itemType === 'proposal' && recipientOptions.length > 0 && (
            <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              {recipientOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTargetRecipient(opt.value)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    targetRecipient === opt.value
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30">
            {messagesLoading ? (
              <div className="p-8 text-center"><Spin /></div>
            ) : selectedChatItem?.itemType === 'proposal' ? (
              messages.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-xs">
                  No messages yet. Send a message to start conversation!
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.dateKey} className="space-y-2">
                    <div className="flex justify-center my-1">
                      <span className="bg-white/90 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-xs">
                        {formatDateBanner(group.dateKey)}
                      </span>
                    </div>

                    {group.items.map(msg => {
                      const isMe = (msg.sender || '').toLowerCase() === getSenderIdentifier().toLowerCase() ||
                        (msg.sender || '').toLowerCase().includes(userName.toLowerCase()) ||
                        (msg.sender || '').toLowerCase() === userRole.toLowerCase()
                      const isImg = isImageAttachment(msg.attachmentUrl, msg.attachmentType)

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[260px] px-3 py-1.5 rounded-xl shadow-xs text-xs transition-all duration-500 ${
                            isMe ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-[#ffffff] text-slate-900 rounded-tl-none'
                          } ${highlightUnread && !isMe && !msg.seen ? 'ring-2 ring-emerald-500 bg-emerald-50/90 shadow-md animate-pulse' : ''}`}>
                            <span className="block text-[10px] font-bold text-emerald-800 mb-0.5">{msg.sender}</span>
                            {msg.attachmentUrl && (
                              isImg ? (
                                <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.attachmentUrl} alt="Photo" className="max-h-40 rounded-lg my-1 object-cover" />
                                </a>
                              ) : (
                                <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 p-1 bg-slate-50 rounded text-[11px] my-1">
                                  <FileTextOutlined className="text-emerald-700" />
                                  <span className="truncate max-w-[140px]">{msg.attachmentName || 'Document'}</span>
                                </a>
                              )
                            )}
                            {msg.text && <p className="whitespace-pre-wrap leading-tight">{msg.text}</p>}
                            <div className="text-[9px] text-slate-400 text-right mt-0.5">
                              {dayjs(msg.timestamp).format('hh:mm A')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )
            ) : (
              groupMessages.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-xs">
                  No group messages yet.
                </div>
              ) : (
                groupMessages.map(msg => {
                  const isMe = msg.sender_id === currentUserId || norm(msg.sender_name) === norm(userName)
                  const isImg = msg.attachment_url && (
                    msg.attachment_type?.startsWith('image/') ||
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_url)
                  )

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[260px] px-3 py-1.5 rounded-xl shadow-xs text-xs ${
                        isMe ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'
                      }`}>
                        <span className="block text-[10px] font-bold text-emerald-800 mb-0.5">{msg.sender_name}</span>
                        {msg.attachment_url && (
                          isImg ? (
                            <img src={msg.attachment_url} alt="Photo" className="max-h-40 rounded-lg my-1 object-cover cursor-pointer" onClick={() => setPreviewImage(msg.attachment_url)} />
                          ) : (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 p-1 bg-slate-50 rounded text-[11px] my-1">
                              <FileTextOutlined className="text-emerald-700" />
                              <span className="truncate max-w-[140px]">{msg.attachment_name || 'Document'}</span>
                            </a>
                          )
                        )}
                        {msg.message && <p className="whitespace-pre-wrap leading-tight">{msg.message}</p>}
                        <div className="text-[9px] text-slate-400 text-right mt-0.5">
                          {formatWhatsAppTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Send Input Bar */}
          <div className="p-2 bg-white border-t border-slate-200 shrink-0">
            {selectedFile && (
              <div className="mb-1 px-2 py-1 bg-emerald-50 rounded flex items-center justify-between text-[11px] text-emerald-800">
                <span className="truncate max-w-[180px]">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="text-emerald-700 hover:text-red-500">
                  <CloseOutlined />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                type="text"
                size="small"
                icon={<PaperClipOutlined className="text-slate-500" />}
                onClick={() => fileInputRef.current?.click()}
              />
              <Input.TextArea
                rows={1}
                autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    if (selectedChatItem?.itemType === 'proposal') {
                      handleSendProposalMessage()
                    } else {
                      handleSendGroupMessage()
                    }
                  }
                }}
                className="rounded-xl border-slate-200 resize-none text-xs flex-1"
              />
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                loading={sendLoading}
                onClick={selectedChatItem?.itemType === 'proposal' ? handleSendProposalMessage : handleSendGroupMessage}
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
      />

      {/* Image Preview Modal */}
      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)} centered width={500}>
        {previewImage && (
          <img src={previewImage} alt="Preview" className="w-full h-auto rounded object-contain max-h-[70vh]" />
        )}
      </Modal>

      {/* Create Group Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <UsergroupAddOutlined />
            <span>Create New Group Chat</span>
          </div>
        }
        open={createGroupModalOpen}
        onCancel={() => setCreateGroupModalOpen(false)}
        onOk={handleCreateGroup}
        confirmLoading={createGroupLoading}
        okText="Create Group"
        okButtonProps={{ className: 'bg-emerald-600 hover:bg-emerald-700 border-none' }}
        centered
        width={420}
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Group Name *</label>
            <Input
              placeholder="e.g. Project Alpha Team"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Select Group Members</label>
            <Select
              mode="multiple"
              placeholder="Select members..."
              value={selectedMemberIds}
              onChange={(vals) => setSelectedMemberIds(vals)}
              style={{ width: '100%' }}
              className="rounded-xl"
              optionFilterProp="children"
            >
              {allSystemUsers.map(user => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name} ({user.role || 'Member'})
                </Select.Option>
              ))}
            </Select>
            <span className="text-[10px] text-slate-400 block mt-1">
              You ({userName || 'Current User'}) will be automatically included as a member.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
