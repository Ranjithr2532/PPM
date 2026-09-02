import React, { useState, useEffect } from 'react';
import { 
    FileTextOutlined, 
    ArrowLeftOutlined, 
    AppstoreOutlined,
    FileWordOutlined,
    FileAddOutlined,
    UploadOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import { Tag, Spin } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';

import Fesability from '../isopages/fesability.jsx';
import ContractReview from '../isopages/contractreview.jsx';
import ProjectTeam from '../isopages/projectteam.jsx';
import Mom from '../isopages/mom.jsx';
import ProjectProposal from '../isopages/projectpropsal.jsx';
import ProjectPlan from '../isopages/projectplan.jsx';
import Sqap from '../isopages/sqap.jsx';
import Bom from '../isopages/bom.jsx';
import DrawingRegister from '../isopages/drawingregister.jsx';

function DirectIsoUpload({ proposalId, docInfo, onBack }) {
    const [proposals, setProposals] = useState([]);
    const [selectedProposalId, setSelectedProposalId] = useState(proposalId ? String(proposalId) : '');
    const [fileList, setFileList] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        const fetchProposals = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/proposals/`);
                if (Array.isArray(res.data)) setProposals(res.data);
            } catch (err) {
                console.error('Failed to load proposals:', err);
            }
        };
        fetchProposals();
    }, []);

    const handleUpload = async () => {
        if (!selectedProposalId) {
            alert('Please select a project proposal first.');
            return;
        }
        if (fileList.length === 0) {
            alert('Please select a file to upload.');
            return;
        }

        setUploading(true);
        try {
            const file = fileList[0];
            const rawUser = window.localStorage.getItem('ppm_user');
            const currentUser = rawUser ? JSON.parse(rawUser) : {};
            const userId = currentUser.id || currentUser.user_id || currentUser.userId;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('proposal_id', selectedProposalId);
            formData.append('doc_type', docInfo?.name ? docInfo.name.replace(/\s+/g, '_').toUpperCase() : 'ISO_DOCUMENT');
            formData.append('document_no', docInfo?.document_no || '');
            if (userId) formData.append('created_by', userId);

            await axios.post(`${API_BASE_URL}/iso-submissions/upload-file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage(`File "${file.name}" uploaded successfully for Proposal #${selectedProposalId}!`);
            setFileList([]);
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                        <UploadOutlined />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{docInfo?.name || 'ISO Document'}</h2>
                    <p className="text-xs font-mono text-indigo-600 font-semibold">{docInfo?.code || docInfo?.document_no}</p>
                    <p className="text-xs text-slate-500">Upload your completed ISO document (.docx, .pdf, or .doc).</p>
                </div>

                {successMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold text-center">
                        ✓ {successMessage}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Select Project Proposal *</label>
                        <select
                            value={selectedProposalId}
                            onChange={(e) => setSelectedProposalId(e.target.value)}
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                        >
                            <option value="">-- Choose Proposal --</option>
                            {proposals.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.project_number ? `${p.project_number} - ` : ''}{p.quote_description || p.customer_name || `Proposal #${p.id}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50/50">
                        <input
                            type="file"
                            id="direct-file-input"
                            accept=".docx,.pdf,.doc"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFileList([e.target.files[0]]);
                                }
                            }}
                        />
                        <label htmlFor="direct-file-input" className="cursor-pointer space-y-2 block">
                            <FileWordOutlined className="text-3xl text-indigo-500" />
                            <div className="text-xs font-semibold text-slate-700">
                                {fileList.length > 0 ? (
                                    <span className="text-indigo-600 font-bold">{fileList[0].name}</span>
                                ) : (
                                    'Click to browse or drop file here (.docx, .pdf, .doc)'
                                )}
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={uploading || fileList.length === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                    >
                        {uploading ? <Spin size="small" /> : <UploadOutlined />}
                        <span>{uploading ? 'Uploading...' : 'Upload Document'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Isogenration() {
    const [activeForm, setActiveForm] = useState(null); // string or object { type: 'generic', doc: {...} }
    const [isoDocs, setIsoDocs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${API_BASE_URL}/iso-document-list/?is_active=true`);
                if (Array.isArray(res.data)) {
                    setIsoDocs(res.data);
                }
            } catch (err) {
                console.error('Failed to load ISO document list from DB:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();

        const searchParams = new URLSearchParams(window.location.search);
        const formParam = searchParams.get('form') || searchParams.get('doc_type');
        if (formParam) {
            const normalized = formParam.toLowerCase().replace('_', '');
            if (['feasibility', 'contractreview', 'projectteam', 'projectproposal', 'projectpropsal', 'projectplan', '053', 'sqap', '055', 'bom', '063', 'drawingregister', '064', 'mom', '037'].includes(normalized)) {
                setActiveForm(
                    normalized.includes('propsal') || normalized.includes('proposal') ? 'projectproposal' :
                    normalized.includes('sqap') || normalized.includes('assurance') || normalized.includes('055') ? 'sqap' :
                    normalized.includes('plan') || normalized.includes('053') ? 'projectplan' :
                    normalized.includes('bom') || normalized.includes('063') ? 'bom' :
                    normalized.includes('drawing') || normalized.includes('064') ? 'drawingregister' :
                    normalized.includes('mom') || normalized.includes('037') ? 'mom' :
                    normalized
                );
            }
        }
    }, []);

    const handleOpenForm = (doc) => {
        const name = (doc.name || '').toUpperCase();
        const docNo = (doc.document_no || '').trim();

        if (docNo.startsWith('049') || name.includes('FEASIBILITY')) {
            setActiveForm({ type: 'feasibility', doc });
        } else if (docNo.startsWith('051') || docNo.startsWith('050') || name.includes('CONTRACT')) {
            setActiveForm({ type: 'contractreview', doc });
        } else if (docNo.startsWith('045') || name.includes('TEAM')) {
            setActiveForm({ type: 'projectteam', doc });
        } else if (docNo.startsWith('037') || name.includes('MINUTES') || name.includes('MOM')) {
            setActiveForm({ type: 'mom', doc });
        } else if (docNo.startsWith('009') || name.includes('PROPOSAL')) {
            setActiveForm({ type: 'projectproposal', doc });
        } else if (docNo.startsWith('055') || name.includes('SQAP') || name.includes('ASSURANCE') || name.includes('SOFTWARE QUALITY')) {
            setActiveForm({ type: 'sqap', doc });
        } else if (docNo.startsWith('053') || name.includes('PLAN')) {
            setActiveForm({ type: 'projectplan', doc });
        } else if (docNo.startsWith('063') || name.includes('BOM') || name.includes('BILL OF MATERIALS')) {
            setActiveForm({ type: 'bom', doc });
        } else if (docNo.startsWith('064') || name.includes('DRAWING') || name.includes('ISSUE REGISTER')) {
            setActiveForm({ type: 'drawingregister', doc });
        } else {
            setActiveForm({ type: 'generic', doc });
        }
    };

    // If a form is selected, show that form with a Back Button
    if (activeForm) {
        const formType = typeof activeForm === 'string' ? activeForm : activeForm.type;
        const docData = typeof activeForm === 'object' ? activeForm.doc : null;
        const searchParams = new URLSearchParams(window.location.search);
        const urlProposalId = searchParams.get('proposal_id') || searchParams.get('proposalId') || searchParams.get('id');

        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-screen">
                <div className="mb-4 flex items-center justify-between">
                    <button 
                        onClick={() => setActiveForm(null)}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-colors text-xs bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                        <ArrowLeftOutlined /> Back to ISO Documents Directory
                    </button>
                    {docData && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                                {docData.code || docData.document_no}
                            </span>
                        </div>
                    )}
                </div>
                {formType === 'feasibility' && <Fesability proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'contractreview' && <ContractReview proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'projectteam' && <ProjectTeam proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'mom' && <Mom proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'projectproposal' && <ProjectProposal proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />}
                {formType === 'projectplan' && <ProjectPlan proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />}
                {formType === 'sqap' && <Sqap proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />}
                {formType === 'bom' && <Bom proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />}
                {formType === 'drawingregister' && <DrawingRegister proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'generic' && (
                    <DirectIsoUpload proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />
                )}
            </div>
        );
    }

    // Default: Show the ISO Documents Dashboard List
    return (
        <div className="p-8 bg-slate-900 min-h-screen">
            {/* Header section */}
            <div className="mb-8 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                        <AppstoreOutlined className="text-xl" />
                    </div>
                    <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase font-mono">
                        QMS Quality System Directory
                    </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                    ISO Document Templates Directory
                </h2>
                <p className="text-slate-400 text-[13px]">
                    Access standard forms or upload completed ISO 9001-2015 documents for CMTI order processing.
                </p>
            </div>

            {/* Template Directory Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#6366f1' }} spin />} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isoDocs.map((doc) => {
                        const isSpecific = ['049', '050', '051', '045', '037', '009', '053', '055', '063', '064'].some(d => (doc.document_no || '').startsWith(d));
                        return (
                            <div 
                                key={doc.id}
                                className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[230px]"
                            >
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                            {isSpecific ? <FileWordOutlined className="text-xl" /> : <UploadOutlined className="text-xl text-emerald-600" />}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {doc.initial && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                                                    {doc.initial}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                                                Doc {doc.document_no || '000'}
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="text-base font-bold text-slate-800 mb-1 line-clamp-1" title={doc.name}>
                                        {doc.name}
                                    </h4>
                                    <p className="text-xs text-indigo-600 font-mono font-semibold mb-1 truncate" title={doc.code}>
                                        {doc.code || 'CMTI-QMS/Rev00'}
                                    </p>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {isSpecific
                                            ? `Generate compliant ${doc.name} standard form with live preview and Word (.docx) export.`
                                            : `Upload completed ${doc.name} document file (.docx, .pdf) for project quality records.`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleOpenForm(doc)}
                                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-3"
                                >
                                    {isSpecific ? <span>Open Form</span> : <span>Upload Document</span>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
