import { message } from 'antd'
import { API_BASE_URL } from '../config/api.js'
import dayjs from 'dayjs'

/**
 * Upload and parse Word (.docx) quotation/proposal document using backend parse_cmti_quotation_docx
 */
export const uploadAndParseQuotationDocx = async (file) => {
  const isDocx = file.name.toLowerCase().endsWith('.docx')
  if (!isDocx) {
    message.error('Invalid file format. Only Microsoft Word (.docx) files are supported.')
    return null
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await fetch(`${API_BASE_URL}/quotation/upload-parse`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.detail || 'Failed to parse quotation document')
    }

    const res = await response.json()
    if (res.success && res.data) {
      message.success(`Successfully parsed extracted values from "${file.name}"`)
      return res.data
    }
    return null
  } catch (error) {
    console.error('Error parsing docx quotation:', error)
    message.error(error.message || 'Unable to parse quotation document')
    return null
  }
}

/**
 * Call backend POST /quotation/generate and download the generated Word (.docx) document
 */
export const generateQuotationDocx = async (payload, customFilename = '') => {
  try {
    const response = await fetch(`${API_BASE_URL}/quotation/generate`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.detail || 'Failed to generate quotation document')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const defaultName = customFilename || `Quotation_${(payload.customer_lines?.[0] || 'CMTI').replace(/[^a-zA-Z0-9]/g, '_')}.docx`
    a.download = defaultName.endsWith('.docx') ? defaultName : `${defaultName}.docx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    message.success('Quotation document generated successfully!')
    return true
  } catch (error) {
    console.error('Error generating quotation:', error)
    message.error(error.message || 'Failed to generate quotation document')
    return false
  }
}

/**
 * Open Quotation Modal with pre-filled fields from proposal record
 */
export const openQuotationModal = async (record, form, setSelectedProposal, setModalOpen, setScopeItems) => {
  setSelectedProposal(record)

  if (setScopeItems) {
    setScopeItems([])
  }

  const customerName = record?.customer_name || ''
  const address = record?.address || ''
  const custLines = customerName ? [customerName, address].filter(Boolean) : []

  form.setFieldsValue({
    header_code: 'ISO 9001-2015 CMTI/PPBD/001/Rev-00',
    ref_no: '',
    date: record?.enquiry_date ? dayjs(record.enquiry_date) : dayjs(),
    customer_lines_str: custLines.join('\n'),
    kind_attention: record?.alternate_contact_details || '',
    salutation: 'Dear Sir,',
    subject: record?.quote_description ? `Quotation for “${record.quote_description}”.` : '',
    email_ref: record?.email_reference ? `Your email dated: ${record.email_reference}` : '',
    item_description: record?.quote_description || '',
    quote_amount: record?.quote_amount ? (record.quote_amount.includes('Rs') ? record.quote_amount : `Rs. ${record.quote_amount}/-`) : '',
    validity: '',
    payment_terms: record?.payment_terms || record?.payment_terms_and_condition || record?.payment_terms_and_conditions || '100% after completion of work & submission of report.',
    delivery: '1 Month from the date of acceptance of PO.',
    contact_details: '',
    commercial_contact: '',
    signatory_name: '',
    signatory_designation: ''
  })

  setModalOpen(true)

  // Check if a proposal docx document is already uploaded for this project
  if (record?.id) {
    try {
      const docsRes = await fetch(`${API_BASE_URL}/documents/`, {
        headers: { accept: 'application/json' },
      })
      if (docsRes.ok) {
        const allDocs = await docsRes.json()
        const docsForProject = (Array.isArray(allDocs) ? allDocs : []).filter((doc) => {
          const pid = doc?.project_id ?? doc?.project ?? doc?.projectId
          return pid != null && String(pid) === String(record.id)
        })

        const isDocxDoc = (doc) => {
          const urlPath = (doc?.url || '').split('?')[0].toLowerCase()
          const nameStr = (doc?.name || '').toLowerCase()
          const attStr = (Array.isArray(doc?.attachment) ? doc.attachment.join(' ') : String(doc?.attachment || '')).toLowerCase()
          return urlPath.endsWith('.docx') || nameStr.endsWith('.docx') || attStr.includes('.docx')
        }

        const isPdfDoc = (doc) => {
          const urlPath = (doc?.url || '').split('?')[0].toLowerCase()
          const nameStr = (doc?.name || '').toLowerCase()
          const attStr = (Array.isArray(doc?.attachment) ? doc.attachment.join(' ') : String(doc?.attachment || '')).toLowerCase()
          return urlPath.endsWith('.pdf') || nameStr.endsWith('.pdf') || attStr.includes('.pdf')
        }

        // Find the latest uploaded docx or pdf document
        const docxDoc = docsForProject
          .filter(isDocxDoc)
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]

        const pdfDoc = docsForProject
          .filter(isPdfDoc)
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]

        if (docxDoc && docxDoc.url) {
          const cleanDocName = docxDoc.name
            ? (docxDoc.name.toLowerCase().endsWith('.docx') ? docxDoc.name : `${docxDoc.name}.docx`)
            : 'uploaded_proposal.docx'

          message.loading({ content: `Checking uploaded proposal document (${cleanDocName})...`, key: 'docx_check' })
          const fileRes = await fetch(docxDoc.url)
          if (fileRes.ok) {
            const blob = await fileRes.blob()
            
            // Ensure blob is not a PDF file
            if (blob.type.includes('pdf')) {
              message.info({ content: 'Uploaded proposal document is in PDF format. Pre-filled details from proposal record.', key: 'docx_check' })
            } else {
              const docxFile = new File([blob], cleanDocName, {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              })

              const extracted = await uploadAndParseQuotationDocx(docxFile)
              if (extracted) {
                message.success({ content: `Auto-filled details from uploaded proposal document: "${cleanDocName}"`, key: 'docx_check' })
                if (extracted.scope_of_work && extracted.scope_of_work.length > 0 && setScopeItems) {
                  setScopeItems(extracted.scope_of_work)
                }
                form.setFieldsValue({
                  header_code: extracted.header_code || form.getFieldValue('header_code') || 'ISO 9001-2015 CMTI/PPBD/001/Rev-00',
                  ref_no: '',
                  date: extracted.date ? dayjs(extracted.date, ['DD.MM.YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']) : form.getFieldValue('date'),
                  customer_lines_str: extracted.customer_lines && extracted.customer_lines.length > 0 ? extracted.customer_lines.join('\n') : form.getFieldValue('customer_lines_str'),
                  kind_attention: extracted.kind_attention || form.getFieldValue('kind_attention') || '',
                  salutation: extracted.salutation || 'Dear Sir,',
                  subject: extracted.subject || form.getFieldValue('subject') || '',
                  email_ref: extracted.email_ref || form.getFieldValue('email_ref') || '',
                  item_description: extracted.item_description || form.getFieldValue('item_description') || '',
                  quote_amount: extracted.quote_amount || form.getFieldValue('quote_amount') || '',
                  validity: extracted.validity || form.getFieldValue('validity') || '',
                  payment_terms: extracted.payment_terms || extracted.payment_terms_and_condition || extracted.payment_terms_and_conditions || form.getFieldValue('payment_terms') || '',
                  delivery: extracted.delivery || form.getFieldValue('delivery') || '',
                  contact_details: extracted.contact_details || form.getFieldValue('contact_details') || '',
                  commercial_contact: extracted.commercial_contact || form.getFieldValue('commercial_contact') || '',
                  signatory_name: extracted.signatory_name || form.getFieldValue('signatory_name') || '',
                  signatory_designation: extracted.signatory_designation || form.getFieldValue('signatory_designation') || '',
                })
              } else {
                message.destroy('docx_check')
              }
            }
          } else {
            message.destroy('docx_check')
          }
        } else if (pdfDoc) {
          message.info({ content: `Uploaded document "${pdfDoc.name || 'document.pdf'}" is in PDF format. Pre-filled details from proposal record.`, key: 'docx_check', duration: 4 })
        }
      }
    } catch (err) {
      console.error('Error fetching existing project proposal document:', err)
    }
  }
}

/**
 * Close Quotation Modal and reset form
 */
export const closeQuotationModal = (setModalOpen, setSelectedProposal, form, setScopeItems) => {
  setModalOpen(false)
  setSelectedProposal(null)
  if (form) form.resetFields()
  if (setScopeItems) setScopeItems([])
}

/**
 * Handle Quotation form submit
 */
export const handleQuotationSubmit = async (
  values,
  scopeItems,
  selectedProposal,
  setLoading,
  closeModal
) => {
  setLoading(true)

  try {
    const custLines = values.customer_lines_str
      ? values.customer_lines_str.split('\n').map((l) => l.strip ? l.strip() : l.trim()).filter(Boolean)
      : []

    const sigLines = values.signatory_designation
      ? values.signatory_designation.split('\n').map((l) => l.strip ? l.strip() : l.trim()).filter(Boolean)
      : []

    const payload = {
      header_code: values.header_code || 'ISO 9001-2015 CMTI/PPBD/001/Rev-00',
      ref_no: values.ref_no || '',
      date: values.date ? dayjs(values.date).format('DD.MM.YYYY') : dayjs().format('DD.MM.YYYY'),
      customer_lines: custLines,
      kind_attention: values.kind_attention || '',
      salutation: values.salutation || 'Dear Sir,',
      subject: values.subject || '',
      email_ref: values.email_ref || '',
      item_description: values.item_description || '',
      quote_amount: values.quote_amount || '',
      scope_of_work: scopeItems && scopeItems.length ? scopeItems : [],
      validity: values.validity || '',
      payment_terms: values.payment_terms || '',
      delivery: values.delivery || '',
      contact_details: values.contact_details || '',
      commercial_contact: values.commercial_contact || '',
      signatory_name: values.signatory_name || '',
      signatory_lines: sigLines,
    }

    const success = await generateQuotationDocx(payload)
    if (success) {
      closeModal()
    }
  } catch (error) {
    console.error('Error in handleQuotationSubmit:', error)
    message.error(error.message || 'Failed to generate quotation')
  } finally {
    setLoading(false)
  }
}
