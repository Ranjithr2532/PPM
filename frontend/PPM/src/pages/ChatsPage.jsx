import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Input,
  Button,
  Tag,
  Spin,
  Badge,
  Tooltip,
  Avatar,
  Empty,
  Select,
  Typography,
  message,
  Modal,
  Popconfirm,
  Drawer,
  List
} from 'antd'
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
  DownOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  CloseOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { API_BASE_URL } from '../config/api.js'
import { groupApi } from '../utils/groupApi.js'

dayjs.extend(relativeTime)
const { Text, Title } = Typography

const PAGE_SIZE = 15

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

// String normalization helper to eliminate space/case mismatches
const norm = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim()

// Check if a message is addressed to the current logged in user
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
  if (uRole === 'scientist' && (toVal === uName || toVal.includes('coordinator') || toVal.includes('project'))) return true
  return false
}

// Check if a message was sent by the current logged in user
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
  if (uRole === 'scientist' && (fromVal === uName || fromVal.includes('coordinator') || fromVal.includes('project'))) return true
  return false
}

export default function ChatsPage() {
  // Current user info
  const [currentUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem('ppm_user')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  // Role normalization: 'admin', 'scientist', 'gh', 'ch', 'guest', 'director'
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

  // State for Proposal Chats & Group Chats
  const [proposals, setProposals] = useState([])
  const [groupChats, setGroupChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatFilter, setChatFilter] = useState('all') // 'all' | 'proposals' | 'groups' | 'unread'
  const [allRemarksList, setAllRemarksList] = useState([])
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)

  // Selected chat item state: { itemType: 'proposal' | 'group', rawId: number|string, key: string }
  const [selectedChatItem, setSelectedChatItem] = useState(null)

  // Group Chats details state
  const [groupMessages, setGroupMessages] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [allSystemUsers, setAllSystemUsers] = useState([])

  // Group Modals & Drawer State
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [createGroupSubmitting, setCreateGroupSubmitting] = useState(false)

  const [groupSettingsDrawerOpen, setGroupSettingsDrawerOpen] = useState(false)
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false)
  const [newAddMemberUserIds, setNewAddMemberUserIds] = useState([])
  const [addMemberSubmitting, setAddMemberSubmitting] = useState(false)

  // Chat conversation state
  const [messages, setMessages] = useState([])
  const [rawRemarksList, setRawRemarksList] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [sendLoading, setSendLoading] = useState(false)
  const [targetRecipient, setTargetRecipient] = useState('')
  const [msgSearchText, setMsgSearchText] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [mediaModalOpen, setMediaModalOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // System User ID resolver
  const currentUserId = useMemo(() => {
    if (currentUser?.id) return currentUser.id
    const matched = allSystemUsers.find(u => norm(u.name) === norm(userName))
    return matched?.id || 408
  }, [currentUser, allSystemUsers, userName])

  // Fetch all system users for member assignment
  const fetchSystemUsers = useCallback(async () => {
    try {
      const users = await groupApi.getAllUsers()
      if (Array.isArray(users)) setAllSystemUsers(users)
    } catch (e) {
      console.warn('Could not fetch system users:', e)
    }
  }, [])

  useEffect(() => {
    fetchSystemUsers()
  }, [fetchSystemUsers])

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
      message.error('Could not load group details')
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
      // 1. Fetch Proposals & Remarks
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

      // 2. Fetch Group Chats
      const groupsPromise = groupApi.getGroups(currentUserId, userName)
        .catch(err => {
          console.warn('Group chats fetch error:', err)
          return []
        })

      const [proposalData, allRemarks, groupData] = await Promise.all([
        proposalPromise,
        remarksPromise,
        groupsPromise
      ])

      setAllRemarksList(allRemarks)

      // Map proposals with last message & unread count
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
      message.error('Unable to load conversations')
    } finally {
      setChatsLoading(false)
    }
  }, [userRole, userName, userGroup, userCenter, currentUserId])

  useEffect(() => {
    fetchAllChats()
  }, [fetchAllChats])

  // Combine Proposals and Group Chats into one WhatsApp-style unified list
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

    // Chronological sorting: newest messages first
    combined.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0
      if (timeA !== timeB) return timeB - timeA
      return String(b.rawId).localeCompare(String(a.rawId))
    })

    return combined
  }, [proposals, groupChats])

  // Filtered Chats based on chips & search
  const filteredChats = useMemo(() => {
    return combinedChats.filter(item => {
      if (chatFilter === 'proposals' && item.itemType !== 'proposal') return false
      if (chatFilter === 'groups' && item.itemType !== 'group') return false
      if (chatFilter === 'unread' && item.unreadCount <= 0) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const title = (item.title || '').toLowerCase()
      const subtitle = (item.subtitle || '').toLowerCase()
      const lastMsg = (item.lastMessage || '').toLowerCase()
      return title.includes(q) || subtitle.includes(q) || lastMsg.includes(q)
    })
  }, [combinedChats, chatFilter, searchQuery])

  // Set initial selected item automatically if none is selected
  useEffect(() => {
    if (!selectedChatItem && combinedChats.length > 0) {
      setSelectedChatItem({
        itemType: combinedChats[0].itemType,
        rawId: combinedChats[0].rawId,
        key: combinedChats[0].key
      })
    }
  }, [combinedChats, selectedChatItem])

  // Unread badge counters
  const proposalUnreadTotal = useMemo(() => proposals.reduce((acc, p) => acc + (p.unreadCount || 0), 0), [proposals])
  const groupUnreadTotal = useMemo(() => groupChats.reduce((acc, g) => acc + (g.unread_count || 0), 0), [groupChats])
  const totalUnreadCount = proposalUnreadTotal + groupUnreadTotal

  // Paginated chat list
  const paginatedChats = useMemo(() => {
    return filteredChats.slice(0, pageLimit)
  }, [filteredChats, pageLimit])

  const hasMoreChats = paginatedChats.length < filteredChats.length

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

      list.forEach(async item => {
        const isToMe = checkIsToMe(item.to, userName, userRole, userGroup)
        if (isToMe && !item.message_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-seen`, { method: 'PATCH' })
        }

        const isReplyToMe = checkIsFromMe(item.from_, userName, userRole, userGroup)
        if (isReplyToMe && item.respond_to_remarks && !item.reply_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-reply-seen`, { method: 'PATCH' })
        }
      })
    } catch (err) {
      console.error('Error fetching messages:', err)
      message.error('Unable to load chat messages')
    } finally {
      setMessagesLoading(false)
    }
  }, [userName, userRole, userGroup, targetRecipient])

  useEffect(() => {
    if (selectedProposal?.id) {
      fetchMessages(selectedProposal.id, targetRecipient)
    }
  }, [selectedProposal, targetRecipient, fetchMessages])

  // Recipient options for proposal chats
  const recipientOptions = useMemo(() => {
    if (!selectedProposal) return []

    const pcName = (selectedProposal.project_co_ordinator || selectedProposal.quotation_given_by_name || '').trim()
    const uNameNorm = norm(userName)
    const pcNameNorm = norm(pcName)

    // Check if current logged-in user is the Project Coordinator for this proposal
    const isMePC = uNameNorm && pcNameNorm && (
      uNameNorm === pcNameNorm ||
      uNameNorm.includes(pcNameNorm) ||
      pcNameNorm.includes(uNameNorm)
    )

    if (userRole === 'scientist') {
      return [
        { label: 'Group Head (GH)', value: 'gh' },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'gh') {
      // If GH is ALSO the Project Coordinator for this project, messaging PC means messaging themselves!
      // Therefore, they can only send message to Admin.
      if (isMePC) {
        return [
          { label: 'Admin', value: 'admin' }
        ]
      }
      return [
        { label: `Project Coordinator (${pcName || 'PC'})`, value: pcName || 'PC' },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'ch') {
      if (isMePC) {
        return [
          { label: 'Admin', value: 'admin' }
        ]
      }
      return [
        { label: `Project Coordinator (${pcName || 'PC'})`, value: pcName || 'PC' },
        { label: 'Admin', value: 'admin' }
      ]
    } else {
      // Admin role
      const gName = selectedProposal.group || 'GH'
      const opts = []
      if (!isMePC && pcName) {
        opts.push({ label: `Project Coordinator (${pcName})`, value: pcName })
      }
      opts.push({ label: `Group Head (${gName})`, value: 'gh' })
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
                 (optVal === 'gh' && (fromVal === 'gh' || toVal === 'gh' || fromVal === userGroup.toLowerCase()))
        })

        if (matchedOption) {
          setTargetRecipient(matchedOption.value)
          return
        }
      }
    }

    setTargetRecipient(recipientOptions[0].value)
  }, [selectedProposal, recipientOptions, allRemarksList, userName, userRole, userGroup])

  // Active conversation media & documents computation
  const activeMediaList = useMemo(() => {
    let rawList = []
    if (selectedChatItem?.itemType === 'proposal') {
      rawList = messages
        .filter(m => m.attachmentUrl || m.attachment_url)
        .map(m => ({
          url: m.attachmentUrl || m.attachment_url,
          name: m.attachmentName || m.attachment_name || 'Attachment',
          type: m.attachmentType || m.attachment_type || '',
          sender: m.sender || m.from_ || 'User',
          date: m.timestamp || m.created_at
        }))
    } else if (selectedChatItem?.itemType === 'group') {
      rawList = groupMessages
        .filter(m => m.attachment_url || m.attachmentUrl)
        .map(m => ({
          url: m.attachment_url || m.attachmentUrl,
          name: m.attachment_name || m.attachmentName || 'Attachment',
          type: m.attachment_type || m.attachmentType || '',
          sender: m.sender_name || m.sender || 'User',
          date: m.created_at
        }))
    }
    return rawList
  }, [selectedChatItem, messages, groupMessages])

  const activeMediaImages = useMemo(() => {
    return activeMediaList.filter(m => isImageAttachment(m.url, m.type))
  }, [activeMediaList])

  const activeMediaDocs = useMemo(() => {
    return activeMediaList.filter(m => !isImageAttachment(m.url, m.type))
  }, [activeMediaList])

  // Handle Group Creation
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      message.warning('Please enter a group name')
      return
    }
    setCreateGroupSubmitting(true)
    try {
      const memberSet = new Set(selectedMemberIds)
      if (currentUserId) memberSet.add(currentUserId)

      const created = await groupApi.createGroup(newGroupName.trim(), Array.from(memberSet))
      message.success(`Group "${created.name}" created successfully!`)
      setCreateGroupModalOpen(false)
      setNewGroupName('')
      setSelectedMemberIds([])
      await fetchAllChats()
      setSelectedChatItem({
        itemType: 'group',
        rawId: created.id,
        key: `group-${created.id}`
      })
    } catch (err) {
      console.error('Error creating group:', err)
      message.error('Failed to create group')
    } finally {
      setCreateGroupSubmitting(false)
    }
  }

  // Handle Group Deletion
  const handleDeleteGroup = async (groupId) => {
    try {
      await groupApi.deleteGroup(groupId)
      message.success('Group chat deleted')
      setGroupSettingsDrawerOpen(false)
      setSelectedChatItem(null)
      fetchAllChats()
    } catch (err) {
      console.error('Error deleting group:', err)
      message.error('Failed to delete group chat')
    }
  }

  // Handle Adding Members to Group
  const handleAddMembers = async () => {
    if (!selectedGroup?.id || newAddMemberUserIds.length === 0) return
    setAddMemberSubmitting(true)
    try {
      for (const uid of newAddMemberUserIds) {
        await groupApi.addMember(selectedGroup.id, uid)
      }
      message.success('Members added successfully!')
      setAddMemberModalOpen(false)
      setNewAddMemberUserIds([])
      fetchGroupDetails(selectedGroup.id)
    } catch (err) {
      console.error('Error adding members:', err)
      message.error('Failed to add members')
    } finally {
      setAddMemberSubmitting(false)
    }
  }

  // Handle Removing Member from Group
  const handleRemoveMember = async (userId) => {
    if (!selectedGroup?.id) return
    try {
      await groupApi.removeMember(selectedGroup.id, userId)
      message.success('Member removed from group')
      fetchGroupDetails(selectedGroup.id)
    } catch (err) {
      console.error('Error removing member:', err)
      message.error('Failed to remove member')
    }
  }

  // Check if current user is admin of group
  const isGroupAdmin = useMemo(() => {
    if (userRole === 'admin') return true
    if (!selectedGroup || groupMembers.length === 0) return false
    const firstMember = [...groupMembers].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at))[0]
    return firstMember?.user_id === currentUserId
  }, [userRole, selectedGroup, groupMembers, currentUserId])

  // Handle Exit Group
  const handleExitGroup = async () => {
    if (!selectedGroup?.id || !currentUserId) return
    try {
      await groupApi.removeMember(selectedGroup.id, currentUserId)
      message.success('You have exited the group')
      setGroupSettingsDrawerOpen(false)
      setSelectedChatItem(null)
      fetchAllChats()
    } catch (err) {
      console.error('Error exiting group:', err)
      message.error('Failed to exit group')
    }
  }

  // Handle Sending Group Message
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
      message.error('Failed to send message or attachment')
    } finally {
      setSendLoading(false)
    }
  }

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

  // File selection handler
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

  // Quick Emoji helper
  const handleAddEmoji = (emoji) => {
    setInputText(prev => prev + emoji)
  }

  // Handle Send Proposal Message
  const handleSendProposalMessage = async () => {
    if (!inputText.trim() && !selectedFile) return
    if (!selectedProposal?.id) {
      message.error('Please select a proposal to send message')
      return
    }

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
      message.error(err.message || 'Failed to send message')
    } finally {
      setSendLoading(false)
    }
  }

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, groupMessages])

  // Reset pagination on search or filter change
  useEffect(() => {
    setPageLimit(PAGE_SIZE)
  }, [searchQuery, chatFilter])

  // Group messages by date for date header banners
  const groupedMessages = useMemo(() => {
    const groups = []
    let currentGroup = null

    const listToRender = msgSearchText.trim()
      ? messages.filter(m => {
          const q = msgSearchText.toLowerCase().trim()
          const text = (m.text || '').toLowerCase()
          const sender = (m.sender || '').toLowerCase()
          const att = (m.attachmentName || m.attachment_name || '').toLowerCase()
          return text.includes(q) || sender.includes(q) || att.includes(q)
        })
      : messages

    listToRender.forEach(msg => {
      const dateKey = dayjs(msg.timestamp).format('YYYY-MM-DD')
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = { dateKey, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push(msg)
    })

    return groups
  }, [messages, msgSearchText])

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-xl font-sans">

      {/* LEFT PANEL: WHATSAPP-STYLE UNIFIED CHAT LIST */}
      <div className="w-80 md:w-[380px] border-r border-slate-200 bg-white flex flex-col shrink-0">
        
        {/* Top User Header & Action Controls */}
        <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="bg-emerald-600 text-white font-bold" size={40}>
                {(userName || userRole || 'U').charAt(0).toUpperCase()}
              </Avatar>
              <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-sm" title="Online"></span>
            </div>
            <div>
              <Text className="font-bold text-slate-800 text-base block leading-tight">
                Chats
              </Text>
              <Text className="text-xs text-slate-500 capitalize">
                {userRole} {userGroup ? `• ${userGroup}` : ''}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip title="Create new group chat">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setCreateGroupModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-lg text-xs flex items-center"
              >
                New Group
              </Button>
            </Tooltip>

            <Tooltip title="Refresh all chats">
              <Button
                type="text"
                icon={<ReloadOutlined className="text-slate-600" />}
                onClick={fetchAllChats}
                loading={chatsLoading}
              />
            </Tooltip>
          </div>
        </div>

        {/* SEARCH & WHATSAPP-STYLE FILTER CHIPS */}
        <div className="p-3 bg-white border-b border-slate-100 space-y-2">
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search proposals, groups, messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="rounded-xl bg-slate-100 border-none px-3 py-2 text-sm focus:bg-white transition-colors"
          />

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setChatFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1 shrink-0 ${
                chatFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatFilter === 'all' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {combinedChats.length}
              </span>
            </button>

            <button
              onClick={() => setChatFilter('proposals')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1 shrink-0 ${
                chatFilter === 'proposals'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Proposals</span>
              {proposalUnreadTotal > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {proposalUnreadTotal}
                </span>
              )}
            </button>

            <button
              onClick={() => setChatFilter('groups')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1 shrink-0 ${
                chatFilter === 'groups'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Groups</span>
              {groupUnreadTotal > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {groupUnreadTotal}
                </span>
              )}
            </button>

            <button
              onClick={() => setChatFilter('unread')}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1 shrink-0 ${
                chatFilter === 'unread'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Unread</span>
              {totalUnreadCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                  chatFilter === 'unread' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                }`}>
                  {totalUnreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* UNIFIED CONVERSATION LIST */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {chatsLoading ? (
            <div className="p-12 text-center"><Spin /></div>
          ) : filteredChats.length === 0 ? (
            <Empty description="No chats match your search/filter" className="my-12" />
          ) : (
            <>
              {paginatedChats.map(item => {
                const isSelected = selectedChatItem?.key === item.key
                const isProposal = item.itemType === 'proposal'

                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      setSelectedChatItem({
                        itemType: item.itemType,
                        rawId: item.rawId,
                        key: item.key
                      })
                      // Clear unread count locally on click
                      if (isProposal) {
                        setProposals(prev => prev.map(p => p.id === item.rawId ? { ...p, unreadCount: 0 } : p))
                      } else {
                        setGroupChats(prev => prev.map(g => g.id === item.rawId ? { ...g, unread_count: 0 } : g))
                      }
                    }}
                    className={`p-3.5 cursor-pointer transition-all flex items-center gap-3.5 relative ${
                      isSelected ? 'bg-emerald-50/90 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Avatar with Badge Indicator */}
                    <div className="relative shrink-0">
                      {isProposal ? (
                        <Avatar className="bg-slate-200 text-slate-700 font-bold shadow-sm" size={44}>
                          {(item.subtitle || item.title).charAt(0).toUpperCase()}
                        </Avatar>
                      ) : (
                        <Avatar className="bg-emerald-700 text-white font-bold shadow-sm" size={44}>
                          <TeamOutlined />
                        </Avatar>
                      )}

                      {item.unreadCount > 0 && (
                        <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white absolute top-0 right-0"></span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <Text className="font-semibold text-slate-900 text-sm truncate block">
                            {item.title}
                          </Text>
                          <Tag
                            color={isProposal ? 'blue' : 'green'}
                            className="text-[9px] px-1 py-0 rounded m-0 font-bold uppercase shrink-0"
                          >
                            {isProposal ? 'Proposal' : 'Group'}
                          </Tag>
                        </div>
                        {item.lastMessageTime && (
                          <Text className={`text-[11px] shrink-0 ${item.unreadCount > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            {formatWhatsAppTime(item.lastMessageTime)}
                          </Text>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 truncate mb-1 font-medium">
                        {item.subtitle}
                      </p>

                      <div className="flex items-center justify-between text-xs">
                        <span className={`truncate text-xs ${item.unreadCount > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                          {item.lastMessage}
                        </span>
                        {item.unreadCount > 0 && (
                          <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shrink-0 ml-2 shadow-sm">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Load More Pagination */}
              {hasMoreChats && (
                <div className="p-3 text-center bg-slate-50 border-t border-slate-100">
                  <Button
                    type="default"
                    size="small"
                    icon={<DownOutlined />}
                    onClick={() => setPageLimit(prev => prev + PAGE_SIZE)}
                    className="rounded-full text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                  >
                    Load More ({filteredChats.length - paginatedChats.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: DYNAMIC CONVERSATION STREAM */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative">
        {selectedChatItem?.itemType === 'proposal' && selectedProposal ? (
          /* PROPOSAL CONVERSATION PANEL */
          <>
            <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex flex-col gap-3 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="bg-emerald-700 text-white font-bold" size={42}>
                      {(selectedProposal.project_co_ordinator || selectedProposal.quote_description || 'P').charAt(0).toUpperCase()}
                    </Avatar>
                    <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-sm" title="Active"></span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Title level={5} style={{ margin: 0 }} className="text-slate-800 truncate max-w-md">
                        {selectedProposal.quote_description || selectedProposal.quote_reference || `Proposal #${selectedProposal.id}`}
                      </Title>
                      {selectedProposal.proposal_status && (
                        <Tag color="green" className="rounded-md text-[11px] font-semibold">
                          {selectedProposal.proposal_status}
                        </Tag>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Coordinator: <strong className="text-slate-700">{selectedProposal.project_co_ordinator || selectedProposal.quotation_given_by_name || '-'}</strong></span>
                      <span>Customer: <strong className="text-slate-700">{selectedProposal.customer_name || '-'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {showMsgSearch ? (
                    <Input
                      placeholder="Search messages..."
                      value={msgSearchText}
                      onChange={(e) => setMsgSearchText(e.target.value)}
                      prefix={<SearchOutlined className="text-slate-400" />}
                      suffix={
                        <CloseOutlined
                          className="text-slate-400 cursor-pointer hover:text-slate-600"
                          onClick={() => {
                            setShowMsgSearch(false)
                            setMsgSearchText('')
                          }}
                        />
                      }
                      className="w-48 rounded-full text-xs"
                      autoFocus
                    />
                  ) : (
                    <Tooltip title="Search messages in this chat">
                      <Button
                        type="text"
                        shape="circle"
                        icon={<SearchOutlined className="text-slate-600 text-base" />}
                        onClick={() => setShowMsgSearch(true)}
                      />
                    </Tooltip>
                  )}

                  <Button
                    icon={<PictureOutlined />}
                    onClick={() => setMediaModalOpen(true)}
                    className="rounded-full border-slate-300 text-slate-700 hover:text-emerald-700 font-medium text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    Media {activeMediaList.length > 0 && `(${activeMediaList.length})`}
                  </Button>
                </div>
              </div>

              {/* Recipient Thread Switcher Tabs */}
              {recipientOptions.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 shrink-0 uppercase tracking-wider">Chat Threads:</span>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {recipientOptions.map((opt) => {
                      const isActive = targetRecipient === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setTargetRecipient(opt.value)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                            isActive
                              ? 'bg-emerald-700 text-white shadow-emerald-200 border border-emerald-800'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <UserOutlined />
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5]/30">
              {messagesLoading ? (
                <div className="p-12 text-center"><Spin /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <MessageOutlined className="text-4xl text-slate-400" />
                  <p className="font-medium">No messages in this proposal chat thread yet.</p>
                  <p className="text-xs text-slate-400">Start the conversation by sending a message below.</p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.dateKey} className="space-y-3">
                    <div className="flex justify-center my-2">
                      <span className="bg-white/80 backdrop-blur-sm text-slate-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm border border-slate-200/60 uppercase tracking-wider">
                        {formatDateBanner(group.dateKey)}
                      </span>
                    </div>

                    {group.items.map(msg => {
                      const isMe = (msg.sender || '').toLowerCase() === getSenderIdentifier().toLowerCase() ||
                        (msg.sender || '').toLowerCase().includes(userName.toLowerCase()) ||
                        (msg.sender || '').toLowerCase() === userRole.toLowerCase()
                      const isImg = isImageAttachment(msg.attachmentUrl, msg.attachmentType)

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-md px-4 py-2.5 rounded-2xl shadow-sm text-sm relative transition-all ${
                              isMe
                                ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                                : 'bg-white text-slate-900 rounded-tl-none'
                            }`}
                          >
                            <span className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              {msg.sender}
                            </span>

                            {msg.attachmentUrl && (
                              isImg ? (
                                <div className="my-2">
                                  <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={msg.attachmentUrl}
                                      alt={msg.attachmentName || 'Attachment photo'}
                                      className="max-w-xs max-h-60 rounded-xl object-cover shadow-sm border border-slate-200 hover:opacity-95 transition-opacity cursor-pointer"
                                    />
                                  </a>
                                </div>
                              ) : (
                                <a
                                  href={msg.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2.5 p-2.5 my-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-slate-800 text-xs font-semibold"
                                >
                                  <FileTextOutlined className="text-emerald-700 text-xl" />
                                  <span className="truncate max-w-[200px]">{msg.attachmentName || 'Document Attachment'}</span>
                                  <DownloadOutlined className="text-slate-400 ml-auto text-sm" />
                                </a>
                              )
                            )}

                            {msg.text && (
                              <p className="whitespace-pre-wrap leading-relaxed mb-1 text-sm">{msg.text}</p>
                            )}

                            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                              <span>{dayjs(msg.timestamp).format('hh:mm A')}</span>
                              {isMe && (
                                <span className="ml-0.5">
                                  {msg.seen ? (
                                    <span className="text-sky-600 font-bold flex items-center">
                                      <CheckOutlined /><CheckOutlined className="-ml-1" />
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 flex items-center">
                                      <CheckOutlined />
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input & Send Area */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex flex-col gap-2">
                {selectedFile && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl w-fit text-xs font-medium text-emerald-800">
                    {selectedFile.type.startsWith('image/') ? <PictureOutlined className="text-emerald-600" /> : <FileTextOutlined className="text-emerald-600" />}
                    <span className="truncate max-w-[220px]">{selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="text-emerald-600 hover:text-emerald-900 ml-1">
                      <CloseCircleFilled />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Text className="text-xs text-slate-500 font-medium">
                    Messaging: <strong className="text-emerald-700">{recipientOptions.find(o => o.value === targetRecipient)?.label || targetRecipient}</strong>
                  </Text>

                  <div className="flex items-center gap-1">
                    {['👍', '🙏', '✅', '😊'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddEmoji(emoji)}
                        className="hover:bg-slate-100 p-1 rounded-md text-sm transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip title="Attach photo or document">
                    <Button
                      icon={<PaperClipOutlined className="text-lg text-slate-600" />}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-12 w-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border-none shrink-0"
                    />
                  </Tooltip>

                  <Input.TextArea
                    rows={2}
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault()
                        handleSendProposalMessage()
                      }
                    }}
                    className="rounded-xl border-slate-200 resize-none bg-slate-50 focus:bg-white text-sm flex-1"
                  />

                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    loading={sendLoading}
                    onClick={handleSendProposalMessage}
                    className="rounded-xl h-12 px-6 bg-emerald-600 hover:bg-emerald-700 border-none shadow-md shrink-0"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : selectedChatItem?.itemType === 'group' && selectedGroup ? (
          /* GROUP CHAT STREAM PANEL */
          <>
            <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Avatar className="bg-emerald-700 text-white font-bold" size={44}>
                  <TeamOutlined />
                </Avatar>
                <div>
                  <Title level={5} style={{ margin: 0 }} className="text-slate-800">
                    {selectedGroup.name}
                  </Title>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Tag color="emerald" className="m-0 text-[11px] rounded-full px-2 font-semibold">
                      👥 {groupMembers.length} Members
                    </Tag>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showMsgSearch ? (
                  <Input
                    placeholder="Search messages..."
                    value={msgSearchText}
                    onChange={(e) => setMsgSearchText(e.target.value)}
                    prefix={<SearchOutlined className="text-slate-400" />}
                    suffix={
                      <CloseOutlined
                        className="text-slate-400 cursor-pointer hover:text-slate-600"
                        onClick={() => {
                          setShowMsgSearch(false)
                          setMsgSearchText('')
                        }}
                      />
                    }
                    className="w-48 rounded-full text-xs"
                    autoFocus
                  />
                ) : (
                  <Tooltip title="Search messages in this group">
                    <Button
                      type="text"
                      shape="circle"
                      icon={<SearchOutlined className="text-slate-600 text-base" />}
                      onClick={() => setShowMsgSearch(true)}
                    />
                  </Tooltip>
                )}

                <Button
                  icon={<PictureOutlined />}
                  onClick={() => setMediaModalOpen(true)}
                  className="rounded-full border-slate-300 text-slate-700 hover:text-emerald-700 font-medium text-xs flex items-center gap-1.5 shadow-sm"
                >
                  Media {activeMediaList.length > 0 && `(${activeMediaList.length})`}
                </Button>

                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setGroupSettingsDrawerOpen(true)}
                  className="rounded-full border-slate-300 text-slate-700 hover:text-emerald-700 font-medium text-xs flex items-center gap-1.5 shadow-sm"
                >
                  Group Info
                </Button>
              </div>
            </div>

            {/* Group Messages Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5]/30">
              {messagesLoading ? (
                <div className="p-12 text-center"><Spin /></div>
              ) : groupMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <TeamOutlined className="text-5xl text-slate-300" />
                  <p className="font-medium text-slate-600">No group messages yet.</p>
                  <p className="text-xs text-slate-400">Start the conversation by sending a message below!</p>
                </div>
              ) : (
                groupMessages
                  .filter(msg => {
                    if (!msgSearchText.trim()) return true
                    const q = msgSearchText.toLowerCase().trim()
                    const content = (msg.message || '').toLowerCase()
                    const sender = (msg.sender_name || '').toLowerCase()
                    const att = (msg.attachment_name || '').toLowerCase()
                    return content.includes(q) || sender.includes(q) || att.includes(q)
                  })
                  .map(msg => {
                    const isMe = msg.sender_id === currentUserId || norm(msg.sender_name) === norm(userName)
                    const seenUsers = msg.seen_by || []
                    const hasBeenSeen = seenUsers.length > 0
                    const isImg = msg.attachment_url && (
                      msg.attachment_type?.startsWith('image/') ||
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_url)
                    )

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-md px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                          isMe ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none'
                        }`}>
                          <span className="block text-[11px] font-bold text-emerald-800 mb-0.5">
                            {msg.sender_name} {msg.sender_role ? `(${msg.sender_role})` : ''}
                          </span>

                          {msg.attachment_url && isImg && (
                            <div className="my-1.5 overflow-hidden rounded-xl border border-emerald-900/10">
                              <img
                                src={msg.attachment_url}
                                alt={msg.attachment_name || 'Attached Photo'}
                                className="max-h-60 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => setPreviewImage(msg.attachment_url)}
                              />
                            </div>
                          )}

                          {msg.attachment_url && !isImg && (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2.5 p-2.5 my-1.5 bg-emerald-900/5 hover:bg-emerald-900/10 border border-emerald-900/10 rounded-xl text-emerald-900 font-medium text-xs transition-colors"
                            >
                              <FileTextOutlined className="text-base text-emerald-700" />
                              <span className="truncate flex-1">{msg.attachment_name || 'Attached Document'}</span>
                              <DownloadOutlined className="text-emerald-700" />
                            </a>
                          )}

                          {msg.message && <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>}

                          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                            <span>{formatWhatsAppTime(msg.created_at)}</span>
                            {isMe && (
                              <Tooltip title={hasBeenSeen ? `Seen by: ${seenUsers.map(u => u.user_name.trim()).join(', ')}` : 'Sent'}>
                                <span className="ml-0.5 cursor-pointer">
                                  {hasBeenSeen ? (
                                    <span className="text-sky-600 font-bold flex items-center">
                                      <CheckOutlined /><CheckOutlined className="-ml-1" />
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 flex items-center">
                                      <CheckOutlined />
                                    </span>
                                  )}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Group Message Input */}
            <div className="p-3 bg-white border-t border-slate-200">
              {selectedFile && (
                <div className="mb-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <span className="flex items-center gap-1.5 truncate">
                    <PaperClipOutlined className="text-emerald-600" />
                    <strong className="truncate">{selectedFile.name}</strong>
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setSelectedFile(null)}
                    className="text-emerald-700 hover:text-red-500"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="text"
                  shape="circle"
                  icon={<PaperClipOutlined className="text-lg text-slate-500 hover:text-emerald-600" />}
                  onClick={() => fileInputRef.current?.click()}
                />
                <Input.TextArea
                  rows={2}
                  placeholder={`Message #${selectedGroup.name}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendGroupMessage()
                    }
                  }}
                  className="rounded-xl border-slate-200 resize-none bg-slate-50 focus:bg-white text-sm flex-1"
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<SendOutlined />}
                  loading={sendLoading}
                  onClick={handleSendGroupMessage}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 border-none shadow-md shrink-0"
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageOutlined className="text-6xl mb-3 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">Select a proposal or group conversation to start messaging</p>
          </div>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <TeamOutlined />
            <span>Create New Group Chat</span>
          </div>
        }
        open={createGroupModalOpen}
        onCancel={() => setCreateGroupModalOpen(false)}
        onOk={handleCreateGroup}
        confirmLoading={createGroupSubmitting}
        okText="Create Group"
        okButtonProps={{ className: 'bg-emerald-600 hover:bg-emerald-700 border-none rounded-lg font-semibold' }}
      >
        <div className="space-y-4 py-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Group Name *</label>
            <Input
              placeholder="e.g. Project Team, Metrology Committee..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="rounded-lg py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Group Members</label>
            <Select
              mode="multiple"
              placeholder="Search and select users to add..."
              value={selectedMemberIds}
              onChange={(vals) => setSelectedMemberIds(vals)}
              options={allSystemUsers.map(u => ({
                label: `${u.name} (${u.role || 'User'})`,
                value: u.id
              }))}
              className="w-full rounded-lg"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
        </div>
      </Modal>

      {/* GROUP SETTINGS DRAWER */}
      <Drawer
        title={
          <div className="flex items-center justify-between w-full pr-4">
            <span className="font-bold text-slate-800">{selectedGroup?.name || 'Group Settings'}</span>
          </div>
        }
        placement="right"
        onClose={() => setGroupSettingsDrawerOpen(false)}
        open={groupSettingsDrawerOpen}
        width={360}
      >
        {selectedGroup && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <Avatar className="bg-emerald-700 text-white font-bold mb-2 shadow-md" size={64}>
                <TeamOutlined className="text-2xl" />
              </Avatar>
              <Title level={4} style={{ margin: 0 }} className="text-slate-800 text-center">
                {selectedGroup.name}
              </Title>
              <Text className="text-xs text-slate-400">
                {groupMembers.length} Members
              </Text>
            </div>

            {/* Members Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Text className="font-bold text-slate-800 text-sm">
                  Group Members ({groupMembers.length})
                </Text>
                {isGroupAdmin && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<UserAddOutlined />}
                    onClick={() => setAddMemberModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-lg font-semibold"
                  >
                    Add Member
                  </Button>
                )}
              </div>

              <List
                itemLayout="horizontal"
                dataSource={groupMembers}
                renderItem={(m) => (
                  <List.Item
                    actions={
                      isGroupAdmin && m.user_id !== currentUserId ? [
                        <Popconfirm
                          key="remove"
                          title="Remove member?"
                          description={`Remove ${m.user_name} from group?`}
                          onConfirm={() => handleRemoveMember(m.user_id)}
                          okText="Remove"
                          okButtonProps={{ danger: true }}
                        >
                          <Button type="text" danger icon={<UserDeleteOutlined />} size="small" />
                        </Popconfirm>
                      ] : []
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar className="bg-emerald-100 text-emerald-800 font-bold">
                          {(m.user_name || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={<span className="text-xs font-semibold text-slate-800">{m.user_name}</span>}
                      description={<span className="text-[11px] text-slate-400 capitalize">{m.user_role || 'Member'}</span>}
                    />
                  </List.Item>
                )}
              />
            </div>

            {/* Action Zone: Exit Group (Member) vs Delete Group (Admin) */}
            <div className="pt-4 border-t border-slate-200">
              {isGroupAdmin ? (
                <Popconfirm
                  title="Delete Group Chat?"
                  description="Are you sure you want to delete this group chat and all its messages?"
                  onConfirm={() => handleDeleteGroup(selectedGroup.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger block icon={<DeleteOutlined />} className="rounded-xl font-semibold">
                    Delete Group Chat
                  </Button>
                </Popconfirm>
              ) : (
                <Popconfirm
                  title="Exit Group Chat?"
                  description="Are you sure you want to exit this group chat?"
                  onConfirm={handleExitGroup}
                  okText="Exit Group"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger block icon={<LogoutOutlined />} className="rounded-xl font-semibold">
                    Exit Group
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ADD MEMBER MODAL */}
      <Modal
        title="Add Group Members"
        open={addMemberModalOpen}
        onCancel={() => setAddMemberModalOpen(false)}
        onOk={handleAddMembers}
        confirmLoading={addMemberSubmitting}
        okText="Add Members"
        okButtonProps={{ className: 'bg-emerald-600 hover:bg-emerald-700 border-none rounded-lg font-semibold' }}
      >
        <div className="py-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">Select Users to Add</label>
          <Select
            mode="multiple"
            placeholder="Search users..."
            value={newAddMemberUserIds}
            onChange={(vals) => setNewAddMemberUserIds(vals)}
            options={allSystemUsers
              .filter(u => !groupMembers.some(m => m.user_id === u.id))
              .map(u => ({
                label: `${u.name} (${u.role || 'User'})`,
                value: u.id
              }))}
            className="w-full rounded-lg"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
      </Modal>

      {/* SHARED MEDIA & ATTACHMENTS MODAL */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <PictureOutlined className="text-emerald-600" />
            <span>Shared Media & Documents ({activeMediaList.length})</span>
          </div>
        }
        open={mediaModalOpen}
        onCancel={() => setMediaModalOpen(false)}
        footer={null}
        width={600}
        centered
        className="rounded-2xl overflow-hidden"
      >
        {activeMediaList.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <PictureOutlined className="text-5xl text-slate-300 mb-1" />
            <Text className="text-slate-600 font-semibold text-base">No media shared in this chat yet</Text>
            <Text className="text-xs text-slate-400">Photos and documents attached to messages will appear here.</Text>
          </div>
        ) : (
          <div className="space-y-6 py-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Photos Section */}
            {activeMediaImages.length > 0 && (
              <div>
                <Text className="block font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                  📷 Shared Photos ({activeMediaImages.length})
                </Text>
                <div className="grid grid-cols-3 gap-3">
                  {activeMediaImages.map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => setPreviewImage(m.url)}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-sm hover:shadow-md transition-all"
                    >
                      <img
                        src={m.url}
                        alt={m.name || 'Photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents Section */}
            {activeMediaDocs.length > 0 && (
              <div>
                <Text className="block font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                  📄 Shared Documents ({activeMediaDocs.length})
                </Text>
                <div className="space-y-2">
                  {activeMediaDocs.map((m, idx) => (
                    <a
                      key={idx}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-slate-800 text-xs font-semibold transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <FileTextOutlined className="text-base text-emerald-700" />
                        </div>
                        <div className="truncate">
                          <span className="block truncate font-bold text-slate-800 group-hover:text-emerald-700">{m.name || 'Shared Document'}</span>
                          <span className="text-[11px] text-slate-400 block">{m.sender ? `Shared by ${m.sender}` : 'Attachment'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-100/70 group-hover:bg-emerald-600 group-hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ml-2">
                        <DownloadOutlined />
                        <span>Download</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Image Zoom Modal */}
      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)} centered width={700}>
        {previewImage && (
          <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg max-h-[80vh] object-contain" />
        )}
      </Modal>

      {/* Global Hidden File Input Picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
    </div>
  )
}
