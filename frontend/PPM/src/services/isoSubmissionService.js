import axios from 'axios';
import { API_BASE_URL } from '../config/api';

/**
 * Service layer for ISO Document Submissions (/iso-submissions/)
 * Supports Feasibility, Contract Review, and Project Team documents.
 */
export const isoSubmissionService = {
  /**
   * Fetch list of ISO submissions with optional filters
   * params: { doc_type, status, created_by, proposal_id }
   */
  async getSubmissions(params = {}) {
    const response = await axios.get(`${API_BASE_URL}/iso-submissions/`, { params });
    return response.data;
  },

  /**
   * Fetch single ISO submission record by ID
   */
  async getSubmissionById(id) {
    const response = await axios.get(`${API_BASE_URL}/iso-submissions/${id}`);
    return response.data;
  },

  /**
   * Create new ISO submission (Draft or Submitted)
   */
  async createSubmission(payload) {
    const response = await axios.post(`${API_BASE_URL}/iso-submissions/`, payload);
    return response.data;
  },

  /**
   * Update existing ISO submission draft or form
   */
  async updateSubmission(id, payload) {
    const response = await axios.put(`${API_BASE_URL}/iso-submissions/${id}`, payload);
    return response.data;
  },

  /**
   * Update ISO submission status (e.g. DRAFT -> SUBMITTED / APPROVED / REJECTED)
   */
  async updateStatus(id, status, rejectionComment = null, approvedBy = null) {
    const response = await axios.patch(`${API_BASE_URL}/iso-submissions/${id}/status`, {
      status,
      rejection_comment: rejectionComment,
      approved_by: approvedBy,
    });
    return response.data;
  },

  /**
   * Delete ISO submission record
   */
  async deleteSubmission(id) {
    const response = await axios.delete(`${API_BASE_URL}/iso-submissions/${id}`);
    return response.data;
  },

  /**
   * Download generated Microsoft Word (.docx) document
   */
  async exportWord(id, filename = 'ISO_Document.docx') {
    const response = await axios.get(`${API_BASE_URL}/iso-submissions/${id}/export-word`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename.endsWith('.docx') ? filename : `${filename}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

/**
 * Get current logged in user's full name
 */
export const getLoggedUserName = () => {
  try {
    const rawUser = window.localStorage.getItem('ppm_user') || window.localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      return (u.full_name || u.name || u.username || u.user || '').trim();
    }
    return (window.localStorage.getItem('loggedInUser') || '').trim();
  } catch (e) {
    return (window.localStorage.getItem('loggedInUser') || '').trim();
  }
};

/**
 * Get current logged in user's Centre/Dept string
 */
export const getLoggedUserCentreDept = () => {
  try {
    const rawUser = window.localStorage.getItem('ppm_user') || window.localStorage.getItem('user');
    if (!rawUser) return '';
    const parsedUser = JSON.parse(rawUser);
    const center = (parsedUser.center || parsedUser.centre || '').trim();
    const group = (parsedUser.group || '').trim();
    let combined = '';
    if (group && center) {
      combined = `${center}/${group}`;
    } else {
      combined = group || center || '';
    }
    const upper = combined.toUpperCase();
    return upper.startsWith('C-') ? upper : (upper ? `C-${upper}` : '');
  } catch (e) {
    return '';
  }
};

