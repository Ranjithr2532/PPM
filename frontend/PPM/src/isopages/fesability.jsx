import React, { useState, useEffect, useCallback } from 'react';
import {
    DownloadOutlined,
    ReloadOutlined,
    FileWordOutlined,
    ArrowLeftOutlined,
    CheckOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.js';
import cmtiLogo from '../assets/waitro-member-cmti.png';

const normalizeCentreDept = (centre) => {
    if (!centre) return '';
    const raw = String(centre).trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    return upper.startsWith('C-') ? upper : `C-${raw}`.toUpperCase();
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

const REVIEW_POINTS_TEMPLATES = [
    {
        sl_no: 1,
        point: "Compliance of all technical requirements?",
        key_resp: "r1_response",
        key_det: "r1_details",
    },
    {
        sl_no: 2,
        point: "Delivery and Post Delivery activity compliance",
        key_resp: "r2_response",
        key_det: "r2_details",
    },
    {
        sl_no: 3,
        point: "Any other requirements not stated in the enquiry, but necessary in the intended use. Eg : Item has be flame proof, Item has to be used in different sites etc. Please mention in details",
        key_resp: "r3_response",
        key_det: "r3_details",
    },
    {
        sl_no: 4,
        point: "Any Critical / Special Characteristic identified in drawing /specifications?",
        key_resp: "r4_response",
        key_det: "r4_details",
    },
    {
        sl_no: 5,
        point: "All Statutory & Regulatory requirement applicable? eg : Fire safety certification, etc",
        key_resp: "r5_response",
        key_det: "r5_details",
    },
    {
        sl_no: 6,
        point: "Any Operation Risk related to following is identified (if yes give details) 1. New Technology 2. Ability and capacity to provide product or service 3. Short delivery time frame",
        key_resp: "r6_response",
        key_det: "r6_details",
    },
];

export default function Fesability() {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState('');
    // User centre is read fresh from localStorage at generate time (see handleGenerate)

    // Document state (replaces Ant Design form state)
    const [partyDetails, setPartyDetails] = useState('');
    const [enquiryRef, setEnquiryRef] = useState('');
    const [description, setDescription] = useState('');
    const [conclusion, setConclusion] = useState('Feasible'); // 'Feasible' | 'Not Feasible'
    const [filename, setFilename] = useState('CMTI_Feasibility_Report.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('049'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState('');
    const [approvedBy, setApprovedBy] = useState('');

    // Review points responses and details
    const [responses, setResponses] = useState({
        r1_response: '', r2_response: '', r3_response: '', r4_response: '', r5_response: '', r6_response: '',
        r1_details: '', r2_details: '', r3_details: '', r4_details: '', r5_details: '', r6_details: '',
    });

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
            setPartyDetails(prop.customer_name || prop.customerName || '');
            setEnquiryRef(prop.email_reference || prop.emailReference || '');
            setDescription(prop.quote_description || prop.quoteDescription || '');
        } else {
            setPartyDetails('');
            setEnquiryRef('');
            setDescription('');
        }
    };

    const handleReset = () => {
        setSelectedProposalId('');
        setPartyDetails('');
        setEnquiryRef('');
        setDescription('');
        setConclusion('Feasible');
        setFilename('CMTI_Feasibility_Report.docx');
        setRevisionCode(getDefaultRevisionCode('049'));
        setDocNo('');
        setDocDate(getTodayDateString());
        setPreparedBy('');
        setApprovedBy('');
        setResponses({
            r1_response: '', r2_response: '', r3_response: '', r4_response: '', r5_response: '', r6_response: '',
            r1_details: '', r2_details: '', r3_details: '', r4_details: '', r5_details: '', r6_details: '',
        });
    };

    // Handle generating & downloading Document
    const handleGenerate = async () => {
        if (!partyDetails || !enquiryRef || !description) {
            alert('Please fill Party Details, Enquiry Ref, and Description.');
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams();
            if (selectedProposalId) {
                params.append('project_id', selectedProposalId);
            }
            // Read user centre fresh from localStorage at generate time
            let freshCentreDept = getLoggedUserCentreDept();

            params.append('party_details', partyDetails);
            params.append('enquiry_ref', enquiryRef);
            params.append('description', description);
            params.append('conclusion', conclusion);
            params.append('centre_dept', freshCentreDept);
            params.append('group_name', revisionCode);
            params.append('doc_no', docNo);
            params.append('doc_date', docDate);
            params.append('prepared_by', preparedBy);
            params.append('approved_by', approvedBy);
            params.append('filename', filename);

            // Map all review points responses and details
            REVIEW_POINTS_TEMPLATES.forEach(pt => {
                params.append(pt.key_resp, responses[pt.key_resp] || '');
                params.append(pt.key_det, responses[pt.key_det] || '');
            });

            const downloadUrl = `${API_BASE_URL}/iso/feasibility/generate?${params.toString()}`;

            const response = await axios.get(downloadUrl, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename || 'CMTI_Feasibility_Report.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating document:', err);
            alert('Failed to generate document. Please try again.');
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

            {/* Simulated Word A4 Document Canvas */}
            <div className="w-full max-w-[21cm] bg-white shadow-2xl border border-slate-200 p-[1.5cm] flex flex-col font-sans text-slate-800 text-xs leading-relaxed min-h-[29.7cm]">

                {/* 1. DOCUMENT HEADER TABLE (3x3 matching header.docx) */}
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
                                FEASIBILITY REVIEW FORM
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

                {/* 2. DETAILS TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <tbody>
                        <tr>
                            <td className="border border-slate-800 p-2.5 w-[20%] font-bold bg-slate-50/50">Party details:</td>
                            <td className="border border-slate-800 p-1 w-[30%]">
                                <input
                                    type="text"
                                    value={partyDetails}
                                    onChange={(e) => setPartyDetails(e.target.value)}
                                    placeholder="Click to enter Party name..."
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium placeholder-slate-300"
                                />
                            </td>
                            <td className="border border-slate-800 p-2.5 w-[20%] font-bold bg-slate-50/50">Enquiry ref. No.:<br /><span className="text-[10px] font-normal text-slate-500">(Mail dated)</span></td>
                            <td className="border border-slate-800 p-1 w-[30%]">
                                <input
                                    type="text"
                                    value={enquiryRef}
                                    onChange={(e) => setEnquiryRef(e.target.value)}
                                    placeholder="Click to enter Enquiry ref..."
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-800 font-medium placeholder-slate-300"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 p-2.5 font-bold bg-slate-50/50">Description of the enquiry:</td>
                            <td className="border border-slate-800 p-1" colSpan={3}>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Click to enter Description of the enquiry..."
                                    rows={3}
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 resize-none text-slate-800 font-medium placeholder-slate-300"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* 3. FEASIBILITY CHECKLIST ITEMS TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6">
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold text-center">
                            <th className="border border-slate-800 p-2.5 w-[8%]">Sl. No.</th>
                            <th className="border border-slate-800 p-2.5 w-[50%]">Review Point</th>
                            <th className="border border-slate-800 p-2.5 w-[14%]">Response<br /><span className="text-[9px] font-light">(Yes / No / Na)</span></th>
                            <th className="border border-slate-800 p-2.5 w-[28%]">Details / Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REVIEW_POINTS_TEMPLATES.map((pt) => (
                            <tr key={pt.sl_no} className="hover:bg-slate-50/30 transition-colors">
                                <td className="border border-slate-800 p-2 text-center font-semibold text-slate-600">{pt.sl_no}.</td>
                                <td className="border border-slate-800 p-2 text-left text-[11px] leading-relaxed text-slate-700">{pt.point}</td>
                                <td className="border border-slate-800 p-1 text-center align-middle">
                                    <select
                                        value={responses[pt.key_resp]}
                                        onChange={(e) => setResponses({ ...responses, [pt.key_resp]: e.target.value })}
                                        className="bg-transparent border-0 outline-none w-full text-center font-semibold text-indigo-600 cursor-pointer"
                                    >
                                        <option value="">-</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                        <option value="Na">Na</option>
                                    </select>
                                </td>
                                <td className="border border-slate-800 p-1">
                                    <input
                                        type="text"
                                        value={responses[pt.key_det]}
                                        onChange={(e) => setResponses({ ...responses, [pt.key_det]: e.target.value })}
                                        placeholder="Enter details..."
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-slate-700 placeholder-slate-300"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 4. CONCLUSION BLOCK */}
                <div className="border border-slate-800 p-4 rounded-lg bg-slate-50/20 mb-8">
                    <div className="font-bold text-xs underline mb-3 text-slate-900 uppercase tracking-wide">Conclusion</div>
                    <div className="flex gap-8 mb-3">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="radio"
                                name="conclusion"
                                checked={conclusion === 'Feasible'}
                                onChange={() => setConclusion('Feasible')}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">Feasible</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="radio"
                                name="conclusion"
                                checked={conclusion === 'Not Feasible'}
                                onChange={() => setConclusion('Not Feasible')}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">Not Feasible</span>
                        </label>
                    </div>
                    <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200/50 p-3 rounded-lg leading-relaxed">
                        <span className="font-bold">Note: </span>
                        If not feasible, a negotiation for the terms to be made and feasibility form to be refilled for the same.
                    </div>
                </div>

                {/* 5. APPROVED SIGNATORY FOOTER TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs text-center mt-auto">
                    <thead>
                        <tr className="bg-slate-50 font-bold">
                            <th className="border border-slate-800 p-2 w-[50%]">Prepared By</th>
                            <th className="border border-slate-800 p-2 w-[50%]">Approved By</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="h-16">
                            <td className="border border-slate-800 p-2 align-bottom">
                                <div className="text-slate-400 text-[10px] italic mb-1">Click to sign / type name</div>
                                <input
                                    type="text"
                                    placeholder="Name & Designation"
                                    value={preparedBy}
                                    onChange={(e) => setPreparedBy(e.target.value)}
                                    className="w-full bg-transparent outline-none text-center font-medium border-0 border-b border-transparent focus:border-slate-300 text-slate-700"
                                />
                            </td>
                            <td className="border border-slate-800 p-2 align-bottom">
                                <div className="text-slate-400 text-[10px] italic mb-1">Click to sign / type name</div>
                                <input
                                    type="text"
                                    placeholder="Name & Designation"
                                    value={approvedBy}
                                    onChange={(e) => setApprovedBy(e.target.value)}
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
    );
}
