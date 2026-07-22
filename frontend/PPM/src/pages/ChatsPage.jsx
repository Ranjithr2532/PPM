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
  Card,
  Select,
  Typography,
  message
} from 'antd'
import {
  SearchOutlined,
  SendOutlined,
  MessageOutlined,
  CheckOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { API_BASE_URL } from '../config/api.js'
import { formatDate } from '../config/date.js'

dayjs.extend(relativeTime)
const { Text, Title } = Typography

export default function ChatsPage() {
  // Current user info
  const [currentUser, setCurrentUser] = useState(() => {
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

  // State
  const [proposals, setProposals] = useState([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Chat conversation state
  const [messages, setMessages] = useState([])
  const [rawRemarksList, setRawRemarksList] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [targetRecipient, setTargetRecipient] = useState('')

  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Determine permitted recipients based on logged-in role
  const recipientOptions = useMemo(() => {
    if (userRole === 'scientist') {
      return [
        { label: 'Group Head (GH)', value: 'gh' },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'gh') {
      // GH sends to Project Coordinator (PC/Scientist)
      const pcName = selectedProposal?.project_co_ordinator || selectedProposal?.quotation_given_by_name || 'Project Coordinator'
      return [
        { label: `Project Coordinator (${pcName})`, value: pcName },
        { label: 'Admin', value: 'admin' }
      ]
    } else if (userRole === 'ch') {
      const pcName = selectedProposal?.project_co_ordinator || selectedProposal?.quotation_given_by_name || 'Project Coordinator'
      return [
        { label: `Project Coordinator (${pcName})`, value: pcName }
      ]
    } else {
      // Admin / Director / Guest
      const pcName = selectedProposal?.project_co_ordinator || selectedProposal?.quotation_given_by_name || 'Project Coordinator'
      const groupName = selectedProposal?.group || 'GH'
      return [
        { label: `Project Coordinator (${pcName})`, value: pcName },
        { label: `Group Head (${groupName})`, value: groupName }
      ]
    }
  }, [userRole, selectedProposal])

  // Set default target recipient when selected proposal changes
  useEffect(() => {
    if (recipientOptions.length > 0) {
      setTargetRecipient(recipientOptions[0].value)
    }
  }, [selectedProposal, recipientOptions])

  // Fetch Proposals based on User Role
  const fetchProposals = useCallback(async () => {
    setProposalsLoading(true)
    try {
      let url = `${API_BASE_URL}/proposals/`
      if (userRole === 'scientist') {
        url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(userName)}?user_role=scientist`
      } else if (userRole === 'gh' && userGroup) {
        url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(userGroup)}`
      } else if (userRole === 'ch' && userCenter) {
        url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(userCenter)}`
      }

      let res = await fetch(url, { headers: { accept: 'application/json' } })
      if (!res.ok && url !== `${API_BASE_URL}/proposals/`) {
        res = await fetch(`${API_BASE_URL}/proposals/`, { headers: { accept: 'application/json' } })
      }
      if (!res.ok) throw new Error('Failed to fetch proposals')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []

      // Fetch user-scoped remarks to populate last message preview & unread counts
      let allRemarks = []
      try {
        const userParams = new URLSearchParams()
        if (userName) userParams.append('user_name', userName)
        if (userRole) userParams.append('user_role', userRole)
        if (userGroup) userParams.append('user_group', userGroup)

        const remarksRes = await fetch(`${API_BASE_URL}/Remarkss/chat-history?${userParams.toString()}`, { headers: { accept: 'application/json' } })
        if (remarksRes.ok) {
          allRemarks = await remarksRes.json()
        }
      } catch (e) {
        console.warn('Could not fetch chat remarks history:', e)
      }

      // Map proposals with remark metadata
      const proposalsWithRemarks = list.map(item => {
        const itemRemarks = allRemarks.filter(r => String(r.project_id) === String(item.id))
        const sorted = itemRemarks.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        const lastMsg = sorted[0] || null

        // Count unread messages targeted to current user OR unseen replies to current user's messages
        const unreadCount = itemRemarks.filter(r => {
          const isToMe = (r.to || '').toLowerCase() === userName.toLowerCase() ||
            (r.to || '').toLowerCase() === userRole.toLowerCase() ||
            (userRole === 'gh' && (r.to || '').toLowerCase() === userGroup.toLowerCase())
          const isFromMe = (r.from_ || '').toLowerCase() === userName.toLowerCase() ||
            (r.from_ || '').toLowerCase() === userRole.toLowerCase() ||
            (userRole === 'gh' && (r.from_ || '').toLowerCase() === userGroup.toLowerCase())

          const unseenMsg = isToMe && !r.message_seen
          const unseenReply = isFromMe && r.respond_to_remarks && !r.reply_seen

          return unseenMsg || unseenReply
        }).length

        return {
          ...item,
          lastMessage: lastMsg?.remarks_description || lastMsg?.respond_to_remarks || 'No messages yet',
          lastMessageTime: lastMsg?.updated_at || lastMsg?.created_at || null,
          unreadCount
        }
      })

      setProposals(proposalsWithRemarks)
      if (proposalsWithRemarks.length > 0 && !selectedProposal) {
        setSelectedProposal(proposalsWithRemarks[0])
      }
    } catch (err) {
      console.error('Error fetching proposals:', err)
      message.error('Unable to load proposals')
    } finally {
      setProposalsLoading(false)
    }
  }, [userRole, userName, userGroup, userCenter])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  // Fetch Conversation History for selected proposal & selected target recipient
  const fetchMessages = useCallback(async (proposalId, targetUser) => {
    if (!proposalId) return
    setMessagesLoading(true)
    try {
      const queryParams = new URLSearchParams({ project_id: proposalId })
      const activeUser = userName || userRole.toUpperCase()
      const activeRecipient = targetUser || targetRecipient

      // Send active user identifiers and target recipient for bidirectional matching
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

      // Flatten remarks & replies into chronological event stream
      const events = []
      list.forEach(item => {
        if (item.remarks_description) {
          events.push({
            id: `msg-${item.id}`,
            dbId: item.id,
            text: item.remarks_description,
            sender: item.from_ || 'System',
            recipient: item.to || '',
            timestamp: item.created_at || item.updated_at,
            seen: item.message_seen,
            seenAt: item.message_seen_at,
            isReply: false
          })
        }
        if (item.respond_to_remarks) {
          events.push({
            id: `reply-${item.id}`,
            dbId: item.id,
            text: item.respond_to_remarks,
            sender: item.replyer || item.to || 'System',
            recipient: item.from_ || '',
            timestamp: item.replied_at || item.updated_at,
            seen: item.reply_seen,
            seenAt: item.reply_seen_at,
            isReply: true
          })
        }
      })

      events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      setMessages(events)

      // Automatically mark unseen messages or unseen replies as read
      list.forEach(async item => {
        // Recipient seeing the original message
        const isToMe = (item.to || '').toLowerCase() === userName.toLowerCase() ||
          (item.to || '').toLowerCase() === userRole.toLowerCase() ||
          (userRole === 'gh' && (item.to || '').toLowerCase() === userGroup.toLowerCase())
        if (isToMe && !item.message_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-seen`, { method: 'PATCH' })
        }

        // Original sender seeing the reply
        const isFromMe = (item.from_ || '').toLowerCase() === userName.toLowerCase() ||
          (item.from_ || '').toLowerCase() === userRole.toLowerCase() ||
          (userRole === 'gh' && (item.from_ || '').toLowerCase() === userGroup.toLowerCase())
        if (isFromMe && item.respond_to_remarks && !item.reply_seen) {
          await fetch(`${API_BASE_URL}/Remarkss/${item.id}/mark-reply-seen`, { method: 'PATCH' })
        }
      })
    } catch (err) {
      console.error('Error fetching messages:', err)
      message.error('Unable to load chat messages')
    } finally {
      setMessagesLoading(false)
    }
  }, [userName, userRole, userGroup])

  useEffect(() => {
    if (selectedProposal?.id) {
      fetchMessages(selectedProposal.id, targetRecipient)
    }
  }, [selectedProposal, targetRecipient, fetchMessages])

  // Handle Send Message
  const handleSendMessage = async () => {
    if (!inputText.trim()) return
    if (!selectedProposal?.id) {
      message.error('Please select a proposal to send message')
      return
    }

    setSendLoading(true)
    try {
      // Check if there is an unresponded message sent TO me that we can reply to
      const pendingMessageToReply = rawRemarksList.find(r => {
        const isToMe = (r.to || '').toLowerCase() === userName.toLowerCase() ||
          (r.to || '').toLowerCase() === userRole.toLowerCase() ||
          (userRole === 'gh' && (r.to || '').toLowerCase() === userGroup.toLowerCase())
        return isToMe && !r.respond_to_remarks
      })

      if (pendingMessageToReply) {
        // Reply to existing message via PUT /Remarkss/{id}
        const payload = {
          from_: pendingMessageToReply.from_,
          to: pendingMessageToReply.to,
          project_id: selectedProposal.id,
          remarks_description: pendingMessageToReply.remarks_description,
          respond_to_remarks: inputText.trim(),
          replyer: userName || userRole.toUpperCase()
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
        // Create new message via POST /Remarkss/
        const payload = {
          from_: userName || userRole.toUpperCase(),
          to: targetRecipient,
          project_id: selectedProposal.id,
          remarks_description: inputText.trim(),
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
      message.success('Message sent')
      await fetchMessages(selectedProposal.id)
      await fetchProposals()
    } catch (err) {
      console.error('Send message error:', err)
      message.error(err.message || 'Failed to send message')
    } finally {
      setSendLoading(false)
    }
  }

  // Filter proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter(p => {
      const textMatch = searchQuery === '' ||
        (p.quote_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.quote_reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.project_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.project_co_ordinator || '').toLowerCase().includes(searchQuery.toLowerCase())

      const statusMatch = statusFilter === 'all' || (p.proposal_status || '').toLowerCase() === statusFilter.toLowerCase()

      return textMatch && statusMatch
    })
  }, [proposals, searchQuery, statusFilter])

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-md">

      {/* LEFT PANEL: PROPOSALS LIST */}
      <div className="w-80 md:w-96 border-r border-slate-200 bg-white flex flex-col">
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageOutlined className="text-blue-600 text-xl" />
              <Title level={4} style={{ margin: 0 }} className="text-slate-800 font-bold">
                Proposal Chats
              </Title>
            </div>
            <Tooltip title="Refresh conversations">
              <Button type="text" icon={<ReloadOutlined />} onClick={fetchProposals} loading={proposalsLoading} />
            </Tooltip>
          </div>

          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search quote ref, project #, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="rounded-xl bg-slate-50 border-slate-200"
          />
        </div>

        {/* List of Proposals */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {proposalsLoading ? (
            <div className="p-8 text-center"><Spin /></div>
          ) : filteredProposals.length === 0 ? (
            <Empty description="No proposal conversations found" className="my-12" />
          ) : (
            filteredProposals.map(proposal => {
              const isSelected = selectedProposal?.id === proposal.id
              return (
                <div
                  key={proposal.id}
                  onClick={() => setSelectedProposal(proposal)}
                  className={`p-4 cursor-pointer transition-colors relative ${isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                    }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <Tooltip title={proposal.quote_description || proposal.quote_reference || proposal.project_number || `Proposal #${proposal.id}`} placement="topLeft">
                      <Text className="font-semibold text-slate-800 text-sm truncate max-w-[210px] block">
                        {proposal.quote_description || proposal.quote_reference || proposal.project_number || `Proposal #${proposal.id}`}
                      </Text>
                    </Tooltip>
                    {proposal.lastMessageTime && (
                      <Text className="text-[11px] text-slate-400 shrink-0 ml-1">
                        {dayjs(proposal.lastMessageTime).fromNow(true)}
                      </Text>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 truncate mb-1">
                    {proposal.customer_name || proposal.project_co_ordinator || 'CMTI Proposal'}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-[220px] italic">
                      {proposal.lastMessage}
                    </span>
                    {proposal.unreadCount > 0 && (
                      <Badge count={proposal.unreadCount} className="ml-2" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: CONVERSATION & DETAILS */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedProposal ? (
          <>
            {/* Proposal Detail Header Bar */}
            <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between">
              <div className="space-y-1 max-w-full">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tooltip title={selectedProposal.quote_description || selectedProposal.quote_reference || `Proposal #${selectedProposal.id}`}>
                    <Title level={5} style={{ margin: 0 }} className="text-slate-800 truncate max-w-lg">
                      {selectedProposal.quote_description || selectedProposal.quote_reference || `Proposal #${selectedProposal.id}`}
                    </Title>
                  </Tooltip>
                  {selectedProposal.quote_reference && (
                    <Tag color="purple" className="font-mono rounded-md">
                      {selectedProposal.quote_reference}
                    </Tag>
                  )}
                  {selectedProposal.project_number && (
                    <Tag color="blue" className="font-mono rounded-md">
                      {selectedProposal.project_number}
                    </Tag>
                  )}
                  {selectedProposal.proposal_status && (
                    <Tag color="green" className="rounded-md">
                      {selectedProposal.proposal_status}
                    </Tag>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Customer: <strong className="text-slate-700">{selectedProposal.customer_name || '-'}</strong></span>
                  <span>Coordinator: <strong className="text-slate-700">{selectedProposal.project_co_ordinator || selectedProposal.quotation_given_by_name || '-'}</strong></span>
                  <span>Centre/Group: <strong className="text-slate-700">{selectedProposal.center || '-'}/{selectedProposal.group || '-'}</strong></span>
                </div>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="p-12 text-center"><Spin /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <MessageOutlined className="text-4xl text-slate-300" />
                  <p>No messages in this proposal chat yet.</p>
                  <p className="text-xs text-slate-400">Start the conversation by sending a message below.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = (msg.sender || '').toLowerCase().includes(userName.toLowerCase()) ||
                    (msg.sender || '').toLowerCase() === userRole.toLowerCase()
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                        <span className="font-medium text-slate-600">{msg.sender}</span>
                        <span>•</span>
                        <span>{dayjs(msg.timestamp).format('DD MMM YYYY, hh:mm A')}</span>
                      </div>

                      <div
                        className={`max-w-md px-4 py-3 rounded-2xl shadow-sm text-sm ${isMe
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                          }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      </div>

                      {/* Read receipts */}
                      {isMe && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                          {msg.seen ? (
                            <span className="text-blue-500 font-medium flex items-center gap-0.5">
                              <CheckOutlined /><CheckOutlined /> Read
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <CheckOutlined /> Sent
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input & Send Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Text className="text-xs text-slate-500">Send message to:</Text>
                  <Select
                    size="small"
                    value={targetRecipient}
                    onChange={setTargetRecipient}
                    options={recipientOptions}
                    className="w-56"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Input.TextArea
                    rows={2}
                    placeholder="Type your message here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="rounded-xl border-slate-200 resize-none"
                  />
                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    loading={sendLoading}
                    onClick={handleSendMessage}
                    className="rounded-xl h-12 px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <MessageOutlined className="text-5xl mb-3 text-slate-300" />
            <p className="text-base font-medium">Select a proposal to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}
