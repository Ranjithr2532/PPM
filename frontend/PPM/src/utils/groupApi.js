import { API_BASE_URL } from '../config/api.js'

/**
 * Group Chat API Utilities for managing group chats, group members, and group messages.
 */
export const groupApi = {
  /**
   * Get group chats visible for a user
   */
  async getGroups(userId, userName) {
    const queryParams = new URLSearchParams()
    if (userId) queryParams.append('user_id', userId)
    if (userName) queryParams.append('user_name', userName)

    const url = `${API_BASE_URL}/group-chats/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const res = await fetch(url, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to fetch group chats')
    return res.json()
  },

  /**
   * Create a new group chat and optionally add initial members
   */
  async createGroup(name, memberUserIds = []) {
    const res = await fetch(`${API_BASE_URL}/group-chats/`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    })
    if (!res.ok) throw new Error('Failed to create group')
    const group = await res.json()

    if (Array.isArray(memberUserIds) && memberUserIds.length > 0 && group.id) {
      for (const userId of memberUserIds) {
        try {
          await this.addMember(group.id, userId)
        } catch (e) {
          console.warn(`Could not add user ${userId} to group ${group.id}:`, e)
        }
      }
    }
    return group
  },

  /**
   * Delete a group chat by ID
   */
  async deleteGroup(groupId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}`, {
      method: 'DELETE',
      headers: { accept: 'application/json' }
    })
    if (!res.ok && res.status !== 204) {
      throw new Error('Failed to delete group chat')
    }
    return true
  },

  /**
   * Get members of a group
   */
  async getMembers(groupId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}/members`, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to fetch group members')
    return res.json()
  },

  /**
   * Add a member to a group
   */
  async addMember(groupId, userId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}/members?user_id=${userId}`, {
      method: 'POST',
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to add group member')
    return res.json()
  },

  /**
   * Remove a member from a group
   */
  async removeMember(groupId, userId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: { accept: 'application/json' }
    })
    if (!res.ok && res.status !== 204) {
      throw new Error('Failed to remove group member')
    }
    return true
  },

  /**
   * Fetch messages of a group
   */
  async getMessages(groupId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}/messages`, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to fetch group messages')
    return res.json()
  },

  /**
   * Upload attachment (document or photo) for group message
   */
  async uploadAttachment(file) {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE_URL}/group-chats/upload-attachment`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) throw new Error('Failed to upload group attachment')
    return res.json()
  },

  /**
   * Send a message (with optional attachment) to a group
   */
  async sendMessage(groupId, senderId, messageText, attachmentData = null) {
    const payload = {
      group_id: groupId,
      sender_id: senderId,
      message: messageText || null
    }

    if (attachmentData) {
      payload.attachment_url = attachmentData.attachment_url
      payload.attachment_name = attachmentData.attachment_name
      payload.attachment_type = attachmentData.attachment_type
    }

    const res = await fetch(`${API_BASE_URL}/group-chats/${groupId}/messages`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to send group message')
    return res.json()
  },

  /**
   * Fetch all users list to populate member selection dropdowns
   */
  async getAllUsers() {
    const res = await fetch(`${API_BASE_URL}/users/`, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to fetch users list')
    return res.json()
  },

  /**
   * Mark a group message as seen by a specific user (id, message_id, user_id, seen_at)
   */
  async markMessageSeen(messageId, userId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/messages/${messageId}/mark-seen?user_id=${userId}`, {
      method: 'POST',
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to mark group message as seen')
    return res.json()
  },

  /**
   * Get list of all users who have seen a group message
   */
  async getMessageSeenBy(messageId) {
    const res = await fetch(`${API_BASE_URL}/group-chats/messages/${messageId}/seen-by`, {
      headers: { accept: 'application/json' }
    })
    if (!res.ok) throw new Error('Failed to fetch group message read receipts')
    return res.json()
  }
}
