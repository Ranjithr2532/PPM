import { message } from 'antd'
import { API_BASE_URL } from '../config/api.js'
import dayjs from 'dayjs'

/**
 * Open acknowledgment modal with pre-filled data from proposal
 */
export const openAcknowledgmentModal = (record, form, setSelectedProposal, setModalOpen) => {
  setSelectedProposal(record)
  form.setFieldsValue({
    kind_attn: '',
    purchase_order_no: '',
    purchase_order_date: null,
  })
  setModalOpen(true)
}

/**
 * Close acknowledgment modal and reset form
 */
export const closeAcknowledgmentModal = (setModalOpen, setSelectedProposal, form) => {
  setModalOpen(false)
  setSelectedProposal(null)
  form.resetFields()
}

/**
 * Handle acknowledgment submission and generate document
 */
export const handleAcknowledgmentSubmit = async (
  values,
  selectedProposal,
  setLoading,
  closeModal
) => {
  if (!selectedProposal?.id) {
    message.error('No proposal selected')
    return
  }

  setLoading(true)

  try {
    const payload = {
      proposal_id: selectedProposal.id,
      kind_attn: values.kind_attn || '',
      purchase_order_no: values.purchase_order_no || '',
      purchase_order_date: values.purchase_order_date ? values.purchase_order_date.format('YYYY-MM-DD') : '',
    }

    const response = await fetch(`${API_BASE_URL}/acknowledgment/generate`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to generate acknowledgment')
    }

    // Get the file blob from response
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Sanitize company name for filename
    const safeCompanyName = (selectedProposal.customer_name || 'company')
      .replace(/ /g, '_')
      .replace(/\//g, '_')
      .replace(/\\/g, '_')
    a.download = `acknowledgment_${safeCompanyName}_${selectedProposal.id}.docx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    message.success('Acknowledgment generated successfully')
    closeModal()
  } catch (error) {
    console.error('Error generating acknowledgment:', error)
    message.error(error.message || 'Failed to generate acknowledgment')
  } finally {
    setLoading(false)
  }
}
