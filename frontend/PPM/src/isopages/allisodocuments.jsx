import React, { useState, useEffect, useCallback } from 'react';
import {
    FileTextOutlined,
    EditOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ReloadOutlined,
    PlusOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
} from '@ant-design/icons';
import { Modal, Tag, Button, Spin, Empty, Input, message, Popconfirm } from 'antd';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import { isoSubmissionService } from '../services/isoSubmissionService';
import Fesability from './fesability.jsx';
import ContractReview from './contractreview.jsx';
import ProjectTeam from './projectteam.jsx';
import Mom from './mom.jsx';
import ProjectProposal from './projectpropsal.jsx';

const getDocTypeKey = (doc) => {
    const name = (doc.name || '').toUpperCase();
    const docNo = (doc.document_no || '').trim();

    if (docNo === '049' || name.includes('FEASIBILITY')) return 'FEASIBILITY';
    if (docNo === '051' || name.includes('CONTRACT')) return 'CONTRACT_REVIEW';
    if (docNo === '045' || name.includes('TEAM')) return 'PROJECT_TEAM';
    if (docNo === '037' || name.includes('MINUTES') || name.includes('MOM')) return 'MOM';
    if (docNo === '009' || name.includes('PROPOSAL')) return 'PROJECT_PROPOSAL';
    return name.replace(/\s+/g, '_');
};


const getUserRole = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
        if (!rawUser) return 'scientist';
        const parsed = JSON.parse(rawUser);
        const r = (parsed.role || '').toLowerCase().trim();
        if (r === 'centre head' || r === 'center head') return 'ch';
        if (r === 'group head') return 'gh';
        if (['admin', 'guest', 'gh', 'ch', 'scientist', 'director'].includes(r)) return r;
        return 'scientist';
    } catch (e) {
        return 'scientist';
    }
};

const getStatusBadge = (status) => {
    switch ((status || '').toUpperCase()) {
        case 'SUBMITTED':
            return <Tag color="processing" className="font-bold">SUBMITTED</Tag>;
        case 'APPROVED':
            return <Tag color="success" className="font-bold">APPROVED</Tag>;
        case 'REJECTED':
            return <Tag color="error" className="font-bold">REJECTED</Tag>;
        default:
            return <Tag color="warning" className="font-bold">DRAFT</Tag>;
    }
};

export default function AllISODocuments({ proposalId, proposalNumber, onClose }) {
    const [docList, setDocList] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [activeFormState, setActiveFormState] = useState(null); // null | { docTypeKey, id }

    const userRole = getUserRole();
    const isAdmin = userRole === 'admin' || userRole === 'director';
    const isApprover = userRole === 'ch' || userRole === 'admin' || userRole === 'gh';

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const docRes = await axios.get(`${API_BASE_URL}/iso-document-list/`);
            setDocList(Array.isArray(docRes.data) ? docRes.data : []);

            if (proposalId) {
                const subData = await isoSubmissionService.getSubmissions({ proposal_id: proposalId });
                setSubmissions(Array.isArray(subData) ? subData : []);
            }
        } catch (err) {
            console.error('Error loading ISO documents & submissions:', err);
            message.error('Failed to load ISO document list');
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateForm = (docTypeKey) => {
        setActiveFormState({ docTypeKey, id: null });
    };

    const handleEditForm = (docTypeKey, subId) => {
        setActiveFormState({ docTypeKey, id: subId });
    };


    const handleDownload = async (sub) => {
        try {
            message.loading({ content: 'Generating Word document...', key: 'docxDownload' });
            await isoSubmissionService.exportWord(sub.id, `ISO_${sub.doc_type}_${sub.document_no || sub.id}.docx`);
            message.success({ content: 'Word document downloaded successfully!', key: 'docxDownload' });
        } catch (err) {
            console.error('Download error:', err);
            message.error({ content: 'Failed to download Word document', key: 'docxDownload' });
        }
    };

    const handleApprove = async (id) => {
        setActionLoading(true);
        try {
            const rawUser = window.localStorage.getItem('ppm_user');
            const userId = rawUser ? JSON.parse(rawUser)?.id : null;
            await isoSubmissionService.updateStatus(id, 'APPROVED', null, userId);
            message.success('ISO Document Approved successfully!');
            fetchData();
        } catch (err) {
            console.error('Approve error:', err);
            message.error('Failed to approve document');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectConfirm = async (id) => {
        if (!rejectComment.trim()) {
            message.warning('Please enter a rejection reason');
            return;
        }
        setActionLoading(true);
        try {
            await isoSubmissionService.updateStatus(id, 'REJECTED', rejectComment.trim());
            message.success('ISO Document marked as Rejected');
            setRejectComment('');
            fetchData();
        } catch (err) {
            console.error('Reject error:', err);
            message.error('Failed to reject document');
        } finally {
            setActionLoading(false);
        }
    };

    // If a form is selected for editing or creation, render that form in full view
    if (activeFormState) {
        return (
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 min-h-screen w-full">
                <div className="mb-4">
                    <Button
                        type="default"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                        className="font-medium text-xs text-slate-600 hover:text-indigo-600"
                    >
                        Back to ISO Documents Directory
                    </Button>
                </div>
                {activeFormState.docTypeKey === 'FEASIBILITY' && (
                    <Fesability
                        proposalId={proposalId}
                        submissionId={activeFormState.id}
                        onBack={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                    />
                )}
                {activeFormState.docTypeKey === 'CONTRACT_REVIEW' && (
                    <ContractReview
                        proposalId={proposalId}
                        submissionId={activeFormState.id}
                        onBack={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                    />
                )}
                {activeFormState.docTypeKey === 'PROJECT_TEAM' && (
                    <ProjectTeam
                        proposalId={proposalId}
                        submissionId={activeFormState.id}
                        onBack={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                    />
                )}
                {activeFormState.docTypeKey === 'MOM' && (
                    <Mom
                        proposalId={proposalId}
                        submissionId={activeFormState.id}
                        onBack={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                    />
                )}
                {activeFormState.docTypeKey === 'PROJECT_PROPOSAL' && (
                    <ProjectProposal
                        proposalId={proposalId}
                        submissionId={activeFormState.id}
                        onBack={() => {
                            setActiveFormState(null);
                            fetchData();
                        }}
                    />
                )}

            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50 rounded-2xl">

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <FileWordOutlined className="text-blue-600" />
                        ISO Documents Directory {proposalNumber ? `(Proposal #${proposalNumber})` : ''}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Create, edit, approve, or download official ISO 9001-2015 forms.
                    </p>
                </div>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="py-12 text-center">
                    <Spin size="large" />
                    <p className="text-xs text-slate-400 mt-2">Loading ISO documents...</p>
                </div>
            ) : docList.length === 0 ? (
                <Empty description="No ISO document templates found in directory." />
            ) : (
                <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
                    {docList.map((doc) => {
                        const docTypeKey = getDocTypeKey(doc);
                        const sub = submissions.find(
                            (s) =>
                                (s.doc_type || '').toUpperCase() === docTypeKey ||
                                (s.document_no || '').trim() === (doc.document_no || '').trim()
                        );

                        return (
                            <div
                                key={doc.id}
                                className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="space-y-1.5 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 uppercase font-mono">
                                            {doc.initial || 'ISO'}
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                                            {doc.name}
                                        </h4>
                                        <span className="text-xs font-medium text-slate-500 font-mono">
                                            (Doc #{doc.document_no || 'N/A'})
                                        </span>
                                        {sub ? getStatusBadge(sub.status) : <Tag color="default" className="font-medium">NOT CREATED</Tag>}
                                    </div>

                                    <div className="text-[11px] text-slate-500 font-mono">
                                        <span>Code: {doc.code || 'N/A'}</span>
                                        {sub && (
                                            <span className="ml-4">
                                                Last Updated: {new Date(sub.updated_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>

                                    {sub?.rejection_comment && (
                                        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-1">
                                            <strong>Rejection Comment:</strong> {sub.rejection_comment}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 justify-end flex-wrap">
                                    {sub ? (
                                        <>
                                            {/* View / Edit Form */}
                                            <Button
                                                size="small"
                                                icon={sub.status === 'APPROVED' && !isAdmin ? <FileTextOutlined /> : <EditOutlined />}
                                                onClick={() => handleEditForm(docTypeKey, sub.id)}
                                                className="text-xs font-medium border-slate-300 text-slate-800"
                                            >
                                                {isAdmin
                                                    ? 'Edit Form'
                                                    : sub.status === 'APPROVED'
                                                        ? 'View Form'
                                                        : sub.status === 'SUBMITTED'
                                                            ? isApprover
                                                                ? 'Review Form'
                                                                : 'View Form (Pending)'
                                                            : 'Edit Form'}
                                            </Button>

                                            {/* Download Word (.docx) */}
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<DownloadOutlined />}
                                                onClick={() => handleDownload(sub)}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold"
                                            >
                                                Word (.docx)
                                            </Button>

                                            {/* Approver Actions (CH / DH / GH / Admin) */}
                                            {isApprover && sub.status === 'SUBMITTED' && (
                                                <>
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        icon={<CheckCircleOutlined />}
                                                        onClick={() => handleApprove(sub.id)}
                                                        loading={actionLoading}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                                                    >
                                                        Approve
                                                    </Button>

                                                    <Popconfirm
                                                        title="Reject ISO Document"
                                                        description={
                                                            <div className="pt-2">
                                                                <Input.TextArea
                                                                    rows={2}
                                                                    placeholder="Reason for rejection..."
                                                                    value={rejectComment}
                                                                    onChange={(e) => setRejectComment(e.target.value)}
                                                                    className="text-xs"
                                                                />
                                                            </div>
                                                        }
                                                        onConfirm={() => handleRejectConfirm(sub.id)}
                                                        okText="Reject"
                                                        cancelText="Cancel"
                                                        okButtonProps={{ danger: true, loading: actionLoading }}
                                                    >
                                                        <Button
                                                            size="small"
                                                            danger
                                                            icon={<CloseCircleOutlined />}
                                                            className="text-xs font-semibold"
                                                        >
                                                            Reject
                                                        </Button>
                                                    </Popconfirm>
                                                </>
                                            )}
                                        </>
                                    ) : (

                                        /* Create Form Button if form not created yet */
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => handleCreateForm(docTypeKey)}
                                            className="bg-slate-900 hover:bg-indigo-600 text-xs font-bold"
                                        >
                                            Create Form
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

