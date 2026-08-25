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

const REVIEW_ITEMS_TEMPLATES = [
    { sl_no: 1, checklist: "Correct Company Name", key_q: "q1_val", key_p: "p1_val", key_d: "d1_val" },
    { sl_no: 2, checklist: "Scope of Supply including Qty", key_q: "q2_val", key_p: "p2_val", key_d: "d2_val" },
    { sl_no: 3, checklist: "Any Technical Requirements", key_q: "q3_val", key_p: "p3_val", key_d: "d3_val" },
    { sl_no: 4, checklist: "Billing Address", key_q: "q4_val", key_p: "p4_val", key_d: "d4_val" },
    { sl_no: 5, checklist: "Shipping Address", key_q: "q5_val", key_p: "p5_val", key_d: "d5_val" },
    { sl_no: 6, checklist: "Delivery Time/Date", key_q: "q6_val", key_p: "p6_val", key_d: "d6_val" },
    { sl_no: 7, checklist: "Mode of Delivery", key_q: "q7_val", key_p: "p7_val", key_d: "d7_val" },
    { sl_no: 8, checklist: "Supporting Documentation", key_q: "q8_val", key_p: "p8_val", key_d: "d8_val" },
    { sl_no: 9, checklist: "National & International Standards", key_q: "q9_val", key_p: "p9_val", key_d: "d9_val" },
    { sl_no: 10, checklist: "Payment Terms", key_q: "q10_val", key_p: "p10_val", key_d: "d10_val" },
    { sl_no: 11, checklist: "Any Penalty clause", key_q: "q11_val", key_p: "p11_val", key_d: "d11_val" },
    { sl_no: 12, checklist: "Any Claims", key_q: "q12_val", key_p: "p12_val", key_d: "d12_val" },
    { sl_no: 13, checklist: "Any Specific Legal Requirements", key_q: "q13_val", key_p: "p13_val", key_d: "d13_val" },
    { sl_no: 14, checklist: "Warranty / Guarantee", key_q: "q14_val", key_p: "p14_val", key_d: "d14_val" },
    { sl_no: 15, checklist: "Any Other Requirements(Specify)", key_q: "q15_val", key_p: "p15_val", key_d: "d15_val" }
];

export default function ContractReview() {
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState('');

    // Details state
    const [quoteNo, setQuoteNo] = useState('');
    const [quoteDate, setQuoteDate] = useState('');
    const [poNumber, setPoNumber] = useState('');
    const [poDate, setPoDate] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectType, setSelectType] = useState('Quotation'); // 'Quotation' | 'Tender' | 'Proposal'
    const [filename, setFilename] = useState('Customer_Contract_Review_Checklist.docx');
    const loggedCentreDept = getLoggedUserCentreDept();
    const [revisionCode, setRevisionCode] = useState(getDefaultRevisionCode('051'));
    const [docNo, setDocNo] = useState('');
    const [docDate, setDocDate] = useState(getTodayDateString());
    const [preparedBy, setPreparedBy] = useState('');
    const [approvedBy, setApprovedBy] = useState('');

    // Checklist values (defaulting to completely empty as requested)
    const [reviewValues, setReviewValues] = useState({});

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
            setQuoteNo(prop.quote_reference || '');

            // Format proposal date safely (YYYY-MM-DD to DD.MM.YYYY)
            if (prop.quote_date) {
                const parts = prop.quote_date.split('-');
                if (parts.length === 3) {
                    setQuoteDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
                } else {
                    setQuoteDate(prop.quote_date);
                }
            } else {
                setQuoteDate('');
            }

            setPoNumber(prop.order_number || '');

            // Format order date safely (YYYY-MM-DD to DD-MM-YYYY)
            if (prop.order_date) {
                const parts = prop.order_date.split('-');
                if (parts.length === 3) {
                    setPoDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    setPoDate(prop.order_date);
                }
            } else {
                setPoDate('');
            }

            setCustomerName(prop.customer_name || '');

            // Auto-detect selectType based on request type
            const reqType = (prop.request_type || '').toLowerCase();
            if (reqType.includes('tender')) {
                setSelectType('Tender');
            } else if (reqType.includes('proposal')) {
                setSelectType('Proposal');
            } else {
                setSelectType('Quotation');
            }
        } else {
            setQuoteNo('');
            setQuoteDate('');
            setPoNumber('');
            setPoDate('');
            setCustomerName('');
            setSelectType('Quotation');
        }
    };

    const handleReset = () => {
        setSelectedProposalId('');
        setQuoteNo('');
        setQuoteDate('');
        setPoNumber('');
        setPoDate('');
        setCustomerName('');
        setSelectType('Quotation');
        setFilename('Customer_Contract_Review_Checklist.docx');
        setRevisionCode(getDefaultRevisionCode('051'));
        setDocNo('');
        setDocDate(getTodayDateString());
        setPreparedBy('');
        setApprovedBy('');
        setReviewValues({});
    };

    // Handle value changes in the checklist table cells
    const handleValueChange = (key, val) => {
        setReviewValues(prev => ({
            ...prev,
            [key]: val
        }));
    };

    // Generate and download Word Document
    const handleGenerate = async () => {
        if (!quoteNo || !customerName) {
            alert('Please fill at least the Quotation Number and Customer Name details.');
            return;
        }

        setGenerating(true);
        try {
            const params = new URLSearchParams();
            if (selectedProposalId) {
                params.append('project_id', selectedProposalId);
            }
            params.append('quote_no', quoteNo);
            params.append('quote_date', quoteDate);
            params.append('po_number', poNumber);
            params.append('po_date', poDate);
            params.append('customer_name', customerName);
            params.append('select_type', selectType);
            params.append('group_name', revisionCode);

            // Read user centre fresh from localStorage at generate time
            const freshCentreDept = getLoggedUserCentreDept();
            params.append('centre_dept', freshCentreDept);
            params.append('doc_no', docNo);
            params.append('doc_date', docDate);
            params.append('prepared_by', preparedBy);
            params.append('approved_by', approvedBy);
            params.append('filename', filename);

            // Populate checklist overrides (only non-empty values are sent, else backend generates empty cells)
            REVIEW_ITEMS_TEMPLATES.forEach(pt => {
                if (reviewValues[pt.key_q]) params.append(pt.key_q, reviewValues[pt.key_q]);
                if (reviewValues[pt.key_p]) params.append(pt.key_p, reviewValues[pt.key_p]);
                if (reviewValues[pt.key_d]) params.append(pt.key_d, reviewValues[pt.key_d]);
            });

            const downloadUrl = `${API_BASE_URL}/iso/contract-review/generate?${params.toString()}`;

            const response = await axios.get(downloadUrl, { responseType: 'blob' });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename || 'Customer_Contract_Review_Checklist.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating document:', err);
            alert('Failed to generate Customer Contract Review Checklist.');
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

                {/* 1. DOCUMENT HEADER TABLE */}
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
                                CENTRE / DEPT: <span className="font-normal text-indigo-600">{loggedCentreDept || '--'}</span>
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
                                Customer Contract Review Checklist
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

                {/* 2. TOP DETAILS TABLE WITH TYPE SELECTION CLICK ACTION */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-6 text-center">
                    <tbody>
                        <tr className="bg-slate-50 font-bold">
                            <td className="border border-slate-800 p-2 w-[22%] select-none">
                                <div className="flex flex-col gap-0.5 justify-center items-center font-bold">
                                    <span
                                        onClick={() => setSelectType('Quotation')}
                                        className={`cursor-pointer hover:text-indigo-600 transition-all ${selectType === 'Quotation' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Quotation No
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">/</span>
                                    <span
                                        onClick={() => setSelectType('Tender')}
                                        className={`cursor-pointer hover:text-indigo-600 transition-all ${selectType === 'Tender' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Tender
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">/</span>
                                    <span
                                        onClick={() => setSelectType('Proposal')}
                                        className={`cursor-pointer hover:text-indigo-600 transition-all ${selectType === 'Proposal' ? 'text-slate-900 border-b border-indigo-500' : 'line-through opacity-30'}`}
                                    >
                                        Proposal
                                    </span>
                                </div>
                            </td>
                            <td className="border border-slate-800 p-2 w-[18%]">Quotation<br />Date / Tender</td>
                            <td className="border border-slate-800 p-2 w-[26%]">Purchase Order<br />No</td>
                            <td className="border border-slate-800 p-2 w-[18%]">Purchase Order<br />Date</td>
                            <td className="border border-slate-800 p-2 w-[16%]">Customer Name</td>
                        </tr>
                        <tr>
                            <td className="border border-slate-800 p-1">
                                <input
                                    type="text"
                                    value={quoteNo}
                                    onChange={(e) => setQuoteNo(e.target.value)}
                                    placeholder="Enter reference..."
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                />
                            </td>
                            <td className="border border-slate-800 p-1">
                                <input
                                    type="text"
                                    value={quoteDate}
                                    onChange={(e) => setQuoteDate(e.target.value)}
                                    placeholder="09.10.2024"
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800"
                                />
                            </td>
                            <td className="border border-slate-800 p-1">
                                <input
                                    type="text"
                                    value={poNumber}
                                    onChange={(e) => setPoNumber(e.target.value)}
                                    placeholder="GEMC-511..."
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800 font-semibold"
                                />
                            </td>
                            <td className="border border-slate-800 p-1">
                                <input
                                    type="text"
                                    value={poDate}
                                    onChange={(e) => setPoDate(e.target.value)}
                                    placeholder="19-11-2024"
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800"
                                />
                            </td>
                            <td className="border border-slate-800 p-1">
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Enter client name..."
                                    className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded text-center border-0 text-slate-800"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Spacing Title */}
                <div className="font-bold text-center text-[11px] mb-4 text-slate-900 tracking-wide uppercase">
                    Customer Order Review Checklist
                </div>

                {/* 3. FEASIBILITY CHECKLIST ITEMS TABLE */}
                <table className="w-full border-collapse border border-slate-800 text-xs mb-8">
                    <thead>
                        <tr className="bg-slate-900 text-white font-bold text-center">
                            <th className="border border-slate-800 p-2.5 w-[7%]">Sl No</th>
                            <th className="border border-slate-800 p-2.5 w-[25%]">Checklist</th>
                            <th className="border border-slate-800 p-2.5 w-[30%]">As Per Quotation / Tender/Proposal</th>
                            <th className="border border-slate-800 p-2.5 w-[30%]">As Per PO</th>
                            <th className="border border-slate-800 p-2.5 w-[8%]">Decision</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REVIEW_ITEMS_TEMPLATES.map((item) => (
                            <tr key={item.sl_no} className="hover:bg-slate-50/30 transition-colors">
                                <td className="border border-slate-800 p-2.5 text-center font-semibold text-slate-600">{item.sl_no}.</td>
                                <td className="border border-slate-800 p-2.5 text-left font-medium text-slate-700">{item.checklist}</td>
                                <td className="border border-slate-800 p-1">
                                    <textarea
                                        value={reviewValues[item.key_q] || ''}
                                        onChange={(e) => handleValueChange(item.key_q, e.target.value)}
                                        placeholder="..."
                                        rows={2}
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 resize-none text-slate-700 text-[11px] leading-relaxed"
                                    />
                                </td>
                                <td className="border border-slate-800 p-1">
                                    <textarea
                                        value={reviewValues[item.key_p] || ''}
                                        onChange={(e) => handleValueChange(item.key_p, e.target.value)}
                                        placeholder="..."
                                        rows={2}
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 resize-none text-slate-700 text-[11px] leading-relaxed"
                                    />
                                </td>
                                <td className="border border-slate-800 p-1 align-middle">
                                    <input
                                        type="text"
                                        value={reviewValues[item.key_d] || ''}
                                        onChange={(e) => handleValueChange(item.key_d, e.target.value)}
                                        placeholder=""
                                        className="w-full bg-transparent outline-none focus:bg-slate-50 p-1 rounded border-0 text-center text-slate-800 font-bold"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 4. APPROVED SIGNATORY FOOTER TABLE */}
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
