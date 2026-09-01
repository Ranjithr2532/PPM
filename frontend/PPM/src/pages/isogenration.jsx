import React, { useState, useEffect } from 'react';
import { 
    FileTextOutlined, 
    ArrowLeftOutlined, 
    AppstoreOutlined,
    FileWordOutlined,
    FileAddOutlined,
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
import GenericIsoForm from '../isopages/GenericIsoForm.jsx';

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
                {formType === 'projectplan' && <ProjectPlan proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'sqap' && <Sqap proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'bom' && <Bom proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'drawingregister' && <DrawingRegister proposalId={urlProposalId} docInfo={docData} />}
                {formType === 'generic' && (
                    <GenericIsoForm proposalId={urlProposalId} docInfo={docData} onBack={() => setActiveForm(null)} />
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
                    Access and generate fully-compliant ISO 9001-2015 forms for CMTI order processing.
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
                                            {isSpecific ? <FileWordOutlined className="text-xl" /> : <FileAddOutlined className="text-xl text-emerald-600" />}
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
                                            : `Custom ISO quality document template. Open interactive form to edit dynamic tables, checklists, and download Word document.`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleOpenForm(doc)}
                                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-3"
                                >
                                    <span>Open Form</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
