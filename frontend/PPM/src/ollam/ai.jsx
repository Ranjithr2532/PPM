import React, { useState } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Mail,
  Building2,
  UserCheck,
  MapPin,
  FileText,
  Bookmark,
  Target,
  Wrench,
  DollarSign,
  Clock,
  PlusCircle,
  Trash2,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Loader2,
  X,
  Send,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';

import { API_BASE_URL } from '../config/api.js';

const BACKEND_API_URL = `${API_BASE_URL}/ai/extract-email`;

const initialProposalState = {
  email_to: [],
  email_cc: [],
  customer_name: '',
  kind_attention: '',
  customer_address: '',
  reference: '',
  proposal_subject: '',
  introductory_paragraph: '',
  scope_of_work: [],
  objectives: [],
  technical_requirements: [],
  commercial_requirements: [],
  implementation_timeline: '',
  additional_requirements: [],
  attachments: [],
  missing_information: []
};

export default function CreateProposalAI() {
  // Section 1: Email Extraction States
  const [emailText, setEmailText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [showOriginalEmail, setShowOriginalEmail] = useState(false);
  const [originalPastedEmail, setOriginalPastedEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Section 2: Proposal Details States (Independent for editing)
  const [proposalData, setProposalData] = useState(initialProposalState);
  const [hasExtractedOnce, setHasExtractedOnce] = useState(false);

  // Chip input temporary states
  const [newEmailTo, setNewEmailTo] = useState('');
  const [newEmailCc, setNewEmailCc] = useState('');
  const [newAttachment, setNewAttachment] = useState('');

  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // ==========================================
  // API Call: Extract Proposal Details
  // ==========================================
  const handleExtractEmail = async () => {
    if (!emailText.trim()) {
      setExtractError('Please paste a customer email before extracting.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(false);
    setSaveSuccessMsg(null);

    try {
      const response = await axios.post(
        BACKEND_API_URL,
        { email_text: emailText },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 130000
        }
      );

      const data = response.data || {};

      // Populate proposal data independently
      setProposalData({
        email_to: Array.isArray(data.email_to) ? [...data.email_to] : [],
        email_cc: Array.isArray(data.email_cc) ? [...data.email_cc] : [],
        customer_name: data.customer_name || '',
        kind_attention: data.kind_attention || '',
        customer_address: data.customer_address || '',
        reference: data.reference || '',
        proposal_subject: data.proposal_subject || '',
        introductory_paragraph: data.introductory_paragraph || '',
        scope_of_work: Array.isArray(data.scope_of_work) ? [...data.scope_of_work] : [],
        objectives: Array.isArray(data.objectives) ? [...data.objectives] : [],
        technical_requirements: Array.isArray(data.technical_requirements) ? [...data.technical_requirements] : [],
        commercial_requirements: Array.isArray(data.commercial_requirements) ? [...data.commercial_requirements] : [],
        implementation_timeline: data.implementation_timeline || '',
        additional_requirements: Array.isArray(data.additional_requirements) ? [...data.additional_requirements] : [],
        attachments: Array.isArray(data.attachments) ? [...data.attachments] : [],
        missing_information: Array.isArray(data.missing_information) ? [...data.missing_information] : []
      });

      setOriginalPastedEmail(emailText);
      setHasExtractedOnce(true);
      setExtractSuccess(true);
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        if (status === 503) {
          setExtractError('AI service is unavailable. Please make sure Ollama/FastAPI is running.');
        } else if (status === 504) {
          setExtractError('AI processing timed out. Please try again.');
        } else if (status === 422) {
          setExtractError('Invalid email data format provided.');
        } else if (status === 500) {
          setExtractError('Unable to extract proposal information from the email.');
        } else {
          setExtractError(`Extraction error (${status}). Please check backend status.`);
        }
      } else if (err.request) {
        setExtractError('Unable to connect to the backend server. Please verify network/API connectivity.');
      } else {
        setExtractError('An unexpected error occurred during extraction.');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // ==========================================
  // Field Change Handlers
  // ==========================================
  const handleFieldChange = (field, value) => {
    setProposalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Array Item Helpers (Scope, Objectives, etc.)
  const handleArrayItemChange = (field, index, newValue) => {
    setProposalData(prev => {
      const updated = [...prev[field]];
      updated[index] = newValue;
      return { ...prev, [field]: updated };
    });
  };

  const handleAddArrayItem = (field, defaultValue = '') => {
    setProposalData(prev => ({
      ...prev,
      [field]: [...prev[field], defaultValue]
    }));
  };

  const handleRemoveArrayItem = (field, index) => {
    setProposalData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Tag Helpers for Email & Attachments
  const handleAddEmailTag = (field, emailVal, clearInputFn) => {
    const trimmed = emailVal.trim();
    if (trimmed && !proposalData[field].includes(trimmed)) {
      setProposalData(prev => ({
        ...prev,
        [field]: [...prev[field], trimmed]
      }));
      clearInputFn('');
    }
  };

  const handleRemoveEmailTag = (field, emailToRemove) => {
    setProposalData(prev => ({
      ...prev,
      [field]: prev[field].filter(e => e !== emailToRemove)
    }));
  };

  const handleAddAttachment = () => {
    const trimmed = newAttachment.trim();
    if (trimmed && !proposalData.attachments.includes(trimmed)) {
      setProposalData(prev => ({
        ...prev,
        attachments: [...prev.attachments, trimmed]
      }));
      setNewAttachment('');
    }
  };

  const handleRemoveAttachment = (attToRemove) => {
    setProposalData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a !== attToRemove)
    }));
  };

  // ==========================================
  // Save Proposal Handler
  // ==========================================
  const handleSaveProposal = () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);

    // Validation
    if (!proposalData.proposal_subject.trim() && !proposalData.customer_name.trim()) {
      alert('Please fill in at least Customer Name or Proposal Subject before saving.');
      setIsSaving(false);
      return;
    }

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccessMsg('Proposal draft saved successfully in frontend state!');
      // Scroll to notification
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 600);
  };

  const handleCopyOriginalEmail = () => {
    if (originalPastedEmail) {
      navigator.clipboard.writeText(originalPastedEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ========================================================== */}
        {/* HEADER SECTION */}
        {/* ========================================================== */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200 text-white">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Create Proposal
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/60">
                  AI-Powered
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Extract requirements, customer info, and scope directly from raw customer email threads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all extracted fields and email input?')) {
                  setEmailText('');
                  setProposalData(initialProposalState);
                  setHasExtractedOnce(false);
                  setExtractSuccess(false);
                  setExtractError(null);
                  setOriginalPastedEmail('');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition duration-150"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/* SECTION 1: CUSTOMER EMAIL EXTRACTION */}
        {/* ========================================================== */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Customer Email</h2>
                <p className="text-xs text-slate-500">
                  Paste complete raw email thread including headers, replies, and signatures.
                </p>
              </div>
            </div>
            {emailText.length > 0 && (
              <span className="text-xs font-medium text-slate-400">
                {emailText.length.toLocaleString()} characters
              </span>
            )}
          </div>

          <div className="space-y-3">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the complete customer email here... (e.g. forwarded emails, replies, signatures, technical specifications)"
              rows={12}
              className="w-full min-h-[350px] p-4 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 transition resize-y"
            />
          </div>

          {/* Action and Status Banners */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={handleExtractEmail}
              disabled={isExtracting || !emailText.trim()}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm shadow-md transition duration-200 ${
                isExtracting || !emailText.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-200 hover:shadow-lg'
              }`}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Analyzing customer email...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Extract Proposal Details</span>
                </>
              )}
            </button>

            {extractSuccess && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 text-sm font-medium animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Email extracted successfully. Review and edit fields below.</span>
              </div>
            )}
          </div>

          {extractError && (
            <div className="flex items-start gap-3 bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 text-sm animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Extraction Notice</p>
                <p className="mt-0.5 text-red-700">{extractError}</p>
              </div>
            </div>
          )}

          {/* Collapsible View Original Email */}
          {originalPastedEmail && (
            <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
              <button
                type="button"
                onClick={() => setShowOriginalEmail(!showOriginalEmail)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left text-sm font-medium text-slate-700 transition"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  View Original Email
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {showOriginalEmail ? 'Click to collapse' : 'Click to expand'}
                  </span>
                  {showOriginalEmail ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>

              {showOriginalEmail && (
                <div className="p-4 bg-white border-t border-slate-200">
                  <div className="flex justify-end mb-2">
                    <button
                      type="button"
                      onClick={handleCopyOriginalEmail}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2.5 py-1 rounded transition"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Raw Text</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                    {originalPastedEmail}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================== */}
        {/* SECTION 2: PROPOSAL DETAILS FORM */}
        {/* ========================================================== */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Proposal Details</h2>
              <p className="text-sm text-slate-500">
                All fields are fully editable. Refine AI suggestions before saving the proposal.
              </p>
            </div>
            {!hasExtractedOnce && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium">
                Draft Mode (Manual entry or paste email above)
              </span>
            )}
          </div>

          {/* Missing Information Banner */}
          {hasExtractedOnce && (
            <div>
              {proposalData.missing_information && proposalData.missing_information.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-emerald-900">✓ All important information extracted.</span>
                    <span className="text-xs text-emerald-700 block sm:inline sm:ml-2">
                      Customer, scope, objectives, and commercial terms were successfully parsed.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-900">Information Missing in Customer Email</p>
                    <p className="text-xs text-amber-700">
                      The following key details were not explicitly stated in the email. You may fill them in manually:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {proposalData.missing_information.map((item, idx) => (
                        <span
                          key={idx}
                          className="bg-white/80 border border-amber-300 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-md shadow-xs"
                        >
                          • {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid Layout: Customer & Communication + Proposal Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ---------------------------------------------------- */}
            {/* CARD 1: CUSTOMER & COMMUNICATION */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">Customer & Communication</h3>
              </div>

              {/* Email - To */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Email - To
                </label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl items-center">
                  {proposalData.email_to.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium px-2.5 py-1 rounded-lg"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailTag('email_to', email)}
                        className="hover:bg-indigo-200/60 rounded-full p-0.5 transition"
                      >
                        <X className="w-3.5 h-3.5 text-indigo-600" />
                      </button>
                    </span>
                  ))}
                  <div className="flex-1 flex items-center gap-1 min-w-[200px]">
                    <input
                      type="email"
                      value={newEmailTo}
                      onChange={(e) => setNewEmailTo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmailTag('email_to', newEmailTo, setNewEmailTo);
                        }
                      }}
                      placeholder="Add email address..."
                      className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEmailTag('email_to', newEmailTo, setNewEmailTo)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md font-medium transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Email - CC */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Email - CC
                </label>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl items-center">
                  {proposalData.email_cc.map((email, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-slate-200 border border-slate-300 text-slate-800 text-xs font-medium px-2.5 py-1 rounded-lg"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmailTag('email_cc', email)}
                        className="hover:bg-slate-300 rounded-full p-0.5 transition"
                      >
                        <X className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </span>
                  ))}
                  <div className="flex-1 flex items-center gap-1 min-w-[200px]">
                    <input
                      type="email"
                      value={newEmailCc}
                      onChange={(e) => setNewEmailCc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmailTag('email_cc', newEmailCc, setNewEmailCc);
                        }
                      }}
                      placeholder="Add CC email address..."
                      className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddEmailTag('email_cc', newEmailCc, setNewEmailCc)}
                      className="text-xs bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded-md font-medium transition"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Customer Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={proposalData.customer_name}
                    onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                    placeholder="e.g. KSRM College of Engineering (Autonomous)"
                    className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Kind Attention */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Kind Attention
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={proposalData.kind_attention}
                    onChange={(e) => handleFieldChange('kind_attention', e.target.value)}
                    placeholder="e.g. Dr M Venkatanarayana, Professor & Dean of CRI"
                    className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Customer Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Customer Address
                </label>
                <textarea
                  value={proposalData.customer_address}
                  onChange={(e) => handleFieldChange('customer_address', e.target.value)}
                  placeholder="e.g. Kadapa, Andhra Pradesh - 516003"
                  rows={3}
                  className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                />
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* CARD 2: PROPOSAL INFORMATION */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5 flex flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Bookmark className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">Proposal Information</h3>
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Reference
                </label>
                <input
                  type="text"
                  value={proposalData.reference}
                  onChange={(e) => handleFieldChange('reference', e.target.value)}
                  placeholder="e.g. Request to send techno - commercial for milk detection project"
                  className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Proposal Subject */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Proposal Subject
                </label>
                <input
                  type="text"
                  value={proposalData.proposal_subject}
                  onChange={(e) => handleFieldChange('proposal_subject', e.target.value)}
                  placeholder="e.g. Techno-Commercial Proposal for Milk Detection Project"
                  className="w-full text-sm font-semibold text-slate-900 p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Implementation Timeline */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Implementation Timeline
                </label>
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={proposalData.implementation_timeline}
                    onChange={(e) => handleFieldChange('implementation_timeline', e.target.value)}
                    placeholder="e.g. 4 months / During the summer"
                    className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100 flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Attachments ({proposalData.attachments.length})
                </label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Paperclip className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={newAttachment}
                        onChange={(e) => setNewAttachment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAttachment();
                          }
                        }}
                        placeholder="Add attachment filename..."
                        className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-medium transition shrink-0"
                    >
                      Add
                    </button>
                  </div>

                  {proposalData.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
                      {proposalData.attachments.map((att, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-lg"
                        >
                          <Paperclip className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[200px]">{att}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att)}
                            className="hover:bg-slate-300/80 rounded-full p-0.5 transition"
                          >
                            <X className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic pt-1">No attachments detected.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* INTRODUCTORY PARAGRAPH */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">Introductory Paragraph</h3>
            </div>
            <textarea
              value={proposalData.introductory_paragraph}
              onChange={(e) => handleFieldChange('introductory_paragraph', e.target.value)}
              placeholder="Describe the background problem statement, need, and context provided by the customer..."
              rows={4}
              className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
            />
          </div>

          {/* ---------------------------------------------------- */}
          {/* SCOPE OF WORK & OBJECTIVES */}
          {/* ---------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Scope of Work */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-base">
                    Scope of Work ({proposalData.scope_of_work.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddArrayItem('scope_of_work', '')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Scope
                </button>
              </div>

              {proposalData.scope_of_work.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No scope items added yet.</p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {proposalData.scope_of_work.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-xs font-bold text-slate-400 w-5 pt-2 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => handleArrayItemChange('scope_of_work', idx, e.target.value)}
                        placeholder="Define work activity / deliverable..."
                        className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('scope_of_work', idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 mt-1"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Objectives */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-base">
                    Objectives ({proposalData.objectives.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddArrayItem('objectives', '')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Objective
                </button>
              </div>

              {proposalData.objectives.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No explicit objectives added.</p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {proposalData.objectives.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-xs font-bold text-slate-400 w-5 pt-2 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => handleArrayItemChange('objectives', idx, e.target.value)}
                        placeholder="State project objective..."
                        className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('objectives', idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 mt-1"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* TECHNICAL & COMMERCIAL REQUIREMENTS */}
          {/* ---------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Technical Requirements */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-base">
                    Technical Requirements ({proposalData.technical_requirements.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddArrayItem('technical_requirements', '')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Technical Requirement
                </button>
              </div>

              {proposalData.technical_requirements.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No technical requirements specified.</p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {proposalData.technical_requirements.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <div className="pt-2 text-slate-400">
                        <div className="w-3.5 h-3.5 border border-slate-300 rounded bg-slate-50" />
                      </div>
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => handleArrayItemChange('technical_requirements', idx, e.target.value)}
                        placeholder="Technical specification / constraint..."
                        className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('technical_requirements', idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 mt-1"
                        title="Delete requirement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commercial Requirements */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-base">
                    Commercial Requirements ({proposalData.commercial_requirements.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddArrayItem('commercial_requirements', '')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Commercial Requirement
                </button>
              </div>

              {proposalData.commercial_requirements.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No commercial requirements specified.</p>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {proposalData.commercial_requirements.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-xs font-bold text-slate-400 w-5 pt-2 text-right shrink-0">
                        •
                      </span>
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => handleArrayItemChange('commercial_requirements', idx, e.target.value)}
                        placeholder="Commercial pricing, quotation, payment terms..."
                        className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-y"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveArrayItem('commercial_requirements', idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 mt-1"
                        title="Delete commercial item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* ADDITIONAL REQUIREMENTS */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  Additional Requirements ({proposalData.additional_requirements.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleAddArrayItem('additional_requirements', '')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Requirement
              </button>
            </div>

            {proposalData.additional_requirements.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">No additional requirements added.</p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {proposalData.additional_requirements.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 group">
                    <span className="text-xs font-bold text-slate-400 w-5 pt-2 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayItemChange('additional_requirements', idx, e.target.value)}
                      placeholder="e.g. Student intern participation during summer..."
                      className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('additional_requirements', idx)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                      title="Delete requirement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* SAVE PROPOSAL FOOTER */}
          {/* ========================================================== */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-base">Ready to Save Proposal?</h4>
              <p className="text-xs text-slate-500">
                Ensure all technical, commercial, and customer parameters are accurate.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveProposal}
                disabled={isSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-200 hover:shadow-lg transition duration-200 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Proposal...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-emerald-100" />
                    <span>Save Proposal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{saveSuccessMsg}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Subject: {proposalData.proposal_subject || 'N/A'} | Customer: {proposalData.customer_name || 'N/A'}
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
