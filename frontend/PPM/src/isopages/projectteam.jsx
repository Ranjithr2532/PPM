import React, { useState, useEffect, useCallback } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const normalizeCentreDept = (centre) => {
    if (!centre) return '';
    const raw = String(centre).trim();
    if (!raw) return '';
    return raw.toUpperCase().startsWith('C-') ? raw.toUpperCase() : `C-${raw}`.toUpperCase();
};

const getLoggedUserCentreDept = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
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
        return normalizeCentreDept(combined);
    } catch (e) {
        return '';
    }
};

const getTodayDateString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};

const getLoggedUserGroup = () => {
    try {
        const rawUser = window.localStorage.getItem('ppm_user');
        if (!rawUser) return '';
        const parsedUser = JSON.parse(rawUser);
        return (parsedUser.group || '').trim().toUpperCase();
    } catch (e) {
        return '';
    }
};

const getDefaultRevisionCode = (docCode) => {
    const group = getLoggedUserGroup();
    const groupStr = group ? group : '      ';
    return `CMTI-QMS-${groupStr}-${docCode}/Rev00`;
};

export default function ProjectTeam() {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState('');

    // Document state
    const [projectNo, setProjectNo] = useState('');
    const [poReference, setPoReference] = useState('');
    const [proposalRef, setProposalRef] = useState('');
    const [subject, setSubject] = useState('Concerning formation of team for the project ""');
    const [preparedBy, setPreparedBy] = useState('');
    const [approvedBy, setApprovedBy] = useState('');
    const [filename, setFilename] = useState('CMTI_Project_Team_Letter.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('045'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());

    // Lists of team and review members (empty by default as requested)
    const [teamMembers, setTeamMembers] = useState([]);
    const [reviewMembers, setReviewMembers] = useState([]);

    // Fetch user details and load proposals
    const fetchProposals = useCallback(async () => {
        setProposalsLoading(true);
        try {
            let name = '';
            let group = '';
            let center = '';
            let role = 'scientist';

            const rawUser = window.localStorage.getItem('ppm_user');
            if (rawUser) {
                const parsedUser = JSON.parse(rawUser);
                name = (parsedUser.name || '').trim();
                group = (parsedUser.group || '').trim();
                center = (parsedUser.center || '').trim();
                const path = window.location.pathname.toLowerCase();
                if (path.includes('/gh')) role = 'gh';
                else if (path.includes('/ch')) role = 'ch';
            }

            if (!name) return;

            let url = '';
            if (role === 'gh') {
                url = `${API_BASE_URL}/proposals/by-group/${encodeURIComponent(group)}`;
            } else if (role === 'ch') {
                url = `${API_BASE_URL}/proposals/by-centre/${encodeURIComponent(center)}`;
            } else {
                url = `${API_BASE_URL}/proposals/by-name/${encodeURIComponent(name)}?user_role=scientist`;
            }

            const res = await axios.get(url);
            if (res.data && Array.isArray(res.data)) {
                setProposals(res.data);
            }
        } catch (err) {
            console.error('Error fetching proposals:', err);
        } finally {
            setProposalsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProposals();
    }, [fetchProposals]);

    // Handle proposal selection
    const handleProposalChange = (e) => {
        const value = e.target.value;
        setSelectedProposalId(value);
        const prop = proposals.find(p => String(p.id) === String(value));
        if (prop) {
            setProjectNo(prop.project_number || '');

            // Format Customer PO reference with date
            let poDetails = prop.order_number || '';
            if (prop.order_date) {
                const parts = prop.order_date.split('-');
                const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : prop.order_date;
                if (poDetails) poDetails += `, ${formattedDate}`;
                else poDetails = formattedDate;
            }
            setPoReference(poDetails);

            // proposal_ref should be empty as requested
            setProposalRef('');

            // Set Subject from proposal activity
            const activityName = prop.activity || prop.quote_description || '';
            setSubject(`Concerning formation of team for the project "${activityName}"`);
        } else {
            setProjectNo('');
            setPoReference('');
            setProposalRef('');
            setSubject('Concerning formation of team for the project ""');
        }
    };

    const handleReset = () => {
        setSelectedProposalId('');
        setProjectNo('');
        setPoReference('');
        setProposalRef('');
        setSubject('Concerning formation of team for the project ""');
        setPreparedBy('');
        setApprovedBy('');
        setFilename('CMTI_Project_Team_Letter.docx');
        setRevisionCode(getDefaultRevisionCode('045'));
        setDocNo('');
        setDocDate(getTodayDateString());
        setTeamMembers([]);
        setReviewMembers([]);
    };

    // Helper to edit Project Team members state
    const handleTeamMemberChange = (index, field, value) => {
        setTeamMembers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Helper to edit Review Team members state
    const handleReviewMemberChange = (index, field, value) => {
        setReviewMembers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Add and Remove row actions for Project Team table
    const addTeamRow = () => {
        setTeamMembers(prev => [
            ...prev,
            { sl_no: prev.length + 1, name: "", designation: "", member_type: "", roles: "", signature: "" }
        ]);
    };

    const removeTeamRow = (index) => {
        setTeamMembers(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            // Re-index sl_no
            return filtered.map((item, idx) => ({ ...item, sl_no: idx + 1 }));
        });
    };

    // Add and Remove row actions for Review Team table
    const addReviewRow = () => {
        setReviewMembers(prev => [
            ...prev,
            { sl_no: prev.length + 1, name: "", designation: "", member_type: "", roles: "", signature: "" }
        ]);
    };

    const removeReviewRow = (index) => {
        setReviewMembers(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            // Re-index sl_no
            return filtered.map((item, idx) => ({ ...item, sl_no: idx + 1 }));
        });
    };

    // Handle document generation & download
    const handleGenerate = async () => {
        if (!projectNo || !poReference) {
            alert('Please fill the Project Number and PO Reference details.');
            return;
        }

        setGenerating(true);
        try {
            // Read user group and centre fresh from localStorage at generate time
            let freshGroup = '';
            let freshCentre = getLoggedUserCentreDept();
            try {
                const rawU = window.localStorage.getItem('ppm_user');
                if (rawU) {
                    const pu = JSON.parse(rawU);
                    const grp = (pu.group || '').trim();
                    if (grp) freshGroup = grp;
                }
            } catch (e) { /* ignore */ }

            const response = await axios.post(`${API_BASE_URL}/iso/project-team/generate`, {
                project_id: selectedProposalId ? parseInt(selectedProposalId) : null,
                project_no: projectNo,
                po_reference: poReference,
                proposal_ref: proposalRef,
                subject: subject,
                prepared_by: preparedBy,
                approved_by: approvedBy,
                group_name: revisionCode,
                centre_dept: freshCentre,
                doc_no: docNo,
                doc_date: docDate,
                team_members: teamMembers,
                review_members: reviewMembers,
                filename: filename
            }, { responseType: 'blob' });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename || 'CMTI_Project_Team_Letter.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating Project Team letter:', err);
            alert('Failed to generate Project Team Letter document.');
        } finally {
            setGenerating(false);
        }
    };



    return (
        <div className="bg-slate-100 min-h-screen py-8 px-4 flex flex-col items-center font-sans">
            {/* Top Toolbar Control Bar */}
            <div className="w-full max-w-4xl bg-white border border-slate-200 p-4 rounded-2xl mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Load Proposal:</span>
                    <select
                        value={selectedProposalId}
                        onChange={handleProposalChange}
                        disabled={proposalsLoading}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full md:w-64 p-2.5 font-medium"
                    >
                        <option value="">-- Choose proposal to auto-fill --</option>
                        {proposals.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.project_number || `SL No ${p.id}`} - {p.customer_name || 'No Client'}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <input
                        type="text"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="filename.docx"
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2.5 w-44 font-medium"
                    />
                    <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
                    >
                        <ReloadOutlined /> Reset
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10"
                    >
                        {generating ? 'Generating...' : <><DownloadOutlined /> Download Word Doc</>}
                    </button>
                </div>
            </div>

            {/* A4 simulated page */}
            <div className="w-full max-w-[21cm] bg-white shadow-2xl border border-slate-200 p-[1.5cm] flex flex-col font-sans text-slate-800 text-xs leading-relaxed min-h-[29.7cm]">

                {/* 1. Header Table */}
                <table className="w-full border-collapse border border-slate-800 text-center mb-6">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2 w-[18%] align-middle" rowSpan={3}>
                                <img src={cmtiLogo} alt="CMTI Logo" className="h-12 mx-auto object-contain" />
                            </td>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-xs uppercase" rowSpan={2}>
                                Central Manufacturing Technology Institute<br />
                                <span className="text-[10px] font-medium tracking-normal text-slate-600">Tumkur Road, Bengaluru - 560022</span>
                            </td>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] w-[28%] font-semibold">
                                CENTRE / DEPT:: <span className="font-normal text-indigo-600">{loggedCentreDept || '--'}</span>
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] font-semibold">
                                Doc. No: <input
                                    type="text"
                                    value={docNo}
                                    onChange={(e) => setDocNo(e.target.value)}
                                    placeholder="--"
                                    className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-28 px-1 py-0 text-[9px] font-normal text-slate-800"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 px-3 py-2 text-center w-[54%] font-bold text-sm bg-slate-50 uppercase tracking-wider text-slate-900 border-t border-slate-800">
                                Project Team Letter
                            </td>
                            <td className="border border-slate-800 px-2 py-1 text-left text-[9px] font-semibold">
                                Date: <input
                                    type="text"
                                    value={docDate}
                                    onChange={(e) => setDocDate(e.target.value)}
                                    className="bg-transparent border-0 border-b border-transparent focus:border-slate-300 outline-none w-20 px-1 py-0 text-[9px] font-normal text-slate-800"
                                /><br />
                                Page: <span className="font-normal text-slate-600">1 of 1</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 2. Metadata details (borderless input box lines) */}
                <div className="flex flex-col gap-2.5 mb-6 text-slate-800 leading-relaxed font-semibold">
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 font-bold whitespace-nowrap">Project No :</span>
                        <input
                            type="text"
                            value={projectNo}
                            onChange={(e) => setProjectNo(e.target.value)}
                            placeholder="GST..."
                            className="bg-transparent border-b border-transparent focus:border-slate-300 hover:border-slate-200 outline-none flex-1 font-semibold text-slate-800 p-0.5"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 font-bold whitespace-nowrap">Customer PO Reference with date:</span>
                        <input
                            type="text"
                            value={poReference}
                            onChange={(e) => setPoReference(e.target.value)}
                            placeholder="PO details..."
                            className="bg-transparent border-b border-transparent focus:border-slate-300 hover:border-slate-200 outline-none flex-1 font-normal text-slate-800 p-0.5"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-900 font-bold whitespace-nowrap">Ref Proposal / Quotation:</span>
                        <input
                            type="text"
                            value={proposalRef}
                            onChange={(e) => setProposalRef(e.target.value)}
                            placeholder=""
                            className="bg-transparent border-b border-transparent focus:border-slate-300 hover:border-slate-200 outline-none flex-1 font-normal text-slate-800 p-0.5"
                        />
                    </div>
                    <div className="flex items-start gap-1.5">
                        <span className="text-slate-900 font-bold whitespace-nowrap mt-0.5">Subject:</span>
                        <textarea
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Concerning formation of team..."
                            rows={2}
                            className="bg-transparent border-b border-transparent focus:border-slate-300 hover:border-slate-200 outline-none flex-1 font-normal text-slate-800 p-0.5 resize-none leading-relaxed"
                        />
                    </div>
                </div>

                {/* 3. Letter description text */}
                <div className="text-slate-700 text-justify mb-6">
                    With reference to the above subject and project title, following representations have been identified for assistance and timely execution of the project.
                </div>

                {/* 4. Table 0 (Project Team list) */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Project Team Members</span>
                        <button
                            onClick={addTeamRow}
                            className="flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 font-semibold px-2.5 py-1 rounded-lg transition-all border border-slate-200"
                        >
                            <PlusOutlined /> Add Member
                        </button>
                    </div>

                    <table className="w-full border-collapse border border-slate-800 text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-white font-bold text-center">
                                <th className="border border-slate-800 p-2.5 w-[7%]">Sl No</th>
                                <th className="border border-slate-800 p-2.5 w-[24%]">Name</th>
                                <th className="border border-slate-800 p-2.5 w-[18%]">Designation</th>
                                <th className="border border-slate-800 p-2.5 w-[19%]">Type (Mech/Elect/software)</th>
                                <th className="border border-slate-800 p-2.5 w-[19%]">Roles</th>
                                <th className="border border-slate-800 p-2.5 w-[13%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teamMembers.map((member, index) => (
                                <tr key={index} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="border border-slate-800 p-2 text-center font-semibold text-slate-500">
                                        {member.sl_no}.
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.name}
                                            onChange={(e) => handleTeamMemberChange(index, 'name', e.target.value)}
                                            placeholder="Enter name..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.designation}
                                            onChange={(e) => handleTeamMemberChange(index, 'designation', e.target.value)}
                                            placeholder="Designation..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.member_type}
                                            onChange={(e) => handleTeamMemberChange(index, 'member_type', e.target.value)}
                                            placeholder="Type..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.roles}
                                            onChange={(e) => handleTeamMemberChange(index, 'roles', e.target.value)}
                                            placeholder="Roles..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1 text-center">
                                        <button
                                            onClick={() => removeTeamRow(index)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                            title="Delete row"
                                        >
                                            <DeleteOutlined />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 5. Table 1 (Review Team list) */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Review Team</span>
                        <button
                            onClick={addReviewRow}
                            className="flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 font-semibold px-2.5 py-1 rounded-lg transition-all border border-slate-200"
                        >
                            <PlusOutlined /> Add Reviewer
                        </button>
                    </div>

                    <table className="w-full border-collapse border border-slate-800 text-xs">
                        <thead>
                            <tr className="bg-slate-900 text-white font-bold text-center">
                                <th className="border border-slate-800 p-2.5 w-[7%]">Sl No</th>
                                <th className="border border-slate-800 p-2.5 w-[24%]">Name</th>
                                <th className="border border-slate-800 p-2.5 w-[18%]">Designation</th>
                                <th className="border border-slate-800 p-2.5 w-[19%]">Type (Mech/Elect/software)</th>
                                <th className="border border-slate-800 p-2.5 w-[19%]">Roles</th>
                                <th className="border border-slate-800 p-2.5 w-[13%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviewMembers.map((member, index) => (
                                <tr key={index} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="border border-slate-800 p-2 text-center font-semibold text-slate-500">
                                        {member.sl_no}.
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.name}
                                            onChange={(e) => handleReviewMemberChange(index, 'name', e.target.value)}
                                            placeholder="Enter name..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.designation}
                                            onChange={(e) => handleReviewMemberChange(index, 'designation', e.target.value)}
                                            placeholder="Designation..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.member_type}
                                            onChange={(e) => handleReviewMemberChange(index, 'member_type', e.target.value)}
                                            placeholder="Type..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1">
                                        <input
                                            type="text"
                                            value={member.roles}
                                            onChange={(e) => handleReviewMemberChange(index, 'roles', e.target.value)}
                                            placeholder="Roles..."
                                            className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700"
                                        />
                                    </td>
                                    <td className="border border-slate-800 p-1 text-center">
                                        <button
                                            onClick={() => removeReviewRow(index)}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                            title="Delete row"
                                        >
                                            <DeleteOutlined />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 6. Footer signatories */}
                <div className="mt-auto flex flex-col gap-3">
                    <table className="w-full border-collapse border border-slate-800 text-xs text-center">
                        <thead>
                            <tr className="bg-slate-50 font-bold">
                                <th className="border border-slate-800 p-2 w-[50%]">Prepared By</th>
                                <th className="border border-slate-800 p-2 w-[50%]">Approved By</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="h-16">
                                <td className="border border-slate-800 p-2 align-bottom">
                                    <input
                                        type="text"
                                        value={preparedBy}
                                        onChange={(e) => setPreparedBy(e.target.value)}
                                        placeholder="Name & Designation"
                                        className="w-full bg-transparent outline-none text-center font-medium border-0 border-b border-transparent focus:border-slate-300 text-slate-700"
                                    />
                                </td>
                                <td className="border border-slate-800 p-2 align-bottom">
                                    <input
                                        type="text"
                                        value={approvedBy}
                                        onChange={(e) => setApprovedBy(e.target.value)}
                                        placeholder="Name & Designation"
                                        className="w-full bg-transparent outline-none text-center font-medium border-0 border-b border-transparent focus:border-slate-300 text-slate-700"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="text-[10px] text-slate-600 font-bold italic flex items-center gap-1.5 mt-3 self-start w-full">
                        <span className="whitespace-nowrap">Document Code:</span>
                        <input
                            type="text"
                            value={revisionCode}
                            onChange={(e) => setRevisionCode(e.target.value)}
                            className="w-64 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[10px] font-bold text-slate-800 focus:bg-white outline-none"
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
