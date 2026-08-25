import React, { useState, useEffect } from 'react';
import { 
    FileTextOutlined, 
    ArrowLeftOutlined, 
    AppstoreOutlined,
    FileWordOutlined
} from '@ant-design/icons';
import Fesability from '../isopages/fesability.jsx';
import ContractReview from '../isopages/contractreview.jsx';
import ProjectTeam from '../isopages/projectteam.jsx';

export default function Isogenration() {
    const [activeForm, setActiveForm] = useState(null); // null | 'feasibility' | 'contractreview' | 'projectteam'

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const formParam = searchParams.get('form') || searchParams.get('doc_type');
        if (formParam) {
            const normalized = formParam.toLowerCase().replace('_', '');
            if (['feasibility', 'contractreview', 'projectteam'].includes(normalized)) {
                setActiveForm(normalized);
            }
        }
    }, []);

    // If a form is selected, show that form with a Back Button

    if (activeForm === 'feasibility') {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-screen">
                <div className="mb-4">
                    <button 
                        onClick={() => setActiveForm(null)}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-colors text-xs bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                        <ArrowLeftOutlined /> Back to ISO Documents List
                    </button>
                </div>
                <Fesability />
            </div>
        );
    }

    if (activeForm === 'contractreview') {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-screen">
                <div className="mb-4">
                    <button 
                        onClick={() => setActiveForm(null)}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-colors text-xs bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                        <ArrowLeftOutlined /> Back to ISO Documents List
                    </button>
                </div>
                <ContractReview />
            </div>
        );
    }

    if (activeForm === 'projectteam') {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-screen">
                <div className="mb-4">
                    <button 
                        onClick={() => setActiveForm(null)}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-colors text-xs bg-slate-50 hover:bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200"
                    >
                        <ArrowLeftOutlined /> Back to ISO Documents List
                    </button>
                </div>
                <ProjectTeam />
            </div>
        );
    }

    // Default: Show the ISO Documents Dashboard List
    return (
        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 min-h-screen">
            {/* Header Dashboard Title */}
            <div className="mb-8 bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col gap-1.5">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                    <AppstoreOutlined className="text-indigo-400" />
                    ISO Document Templates Directory
                </h2>
                <p className="text-slate-400 text-[13px]">
                    Access and generate fully-compliant ISO 9001-2015 forms for CMTI order processing.
                </p>
            </div>

            {/* Template Directory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Feasibility Review Form Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[230px]">
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <FileTextOutlined className="text-xl" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                                ISO 9001-2015
                            </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-800 mb-2">
                            Feasibility Review Form
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Verify technical compliance, operations risk, delivery activity and regulatory checks of enquiries.
                        </p>
                    </div>
                    <button 
                        onClick={() => setActiveForm('feasibility')}
                        className="w-full bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                    >
                        <span>Open Form</span>
                    </button>
                </div>

                {/* 2. Customer Contract Review Checklist Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[230px]">
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                <FileWordOutlined className="text-xl" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                                ISO 9001-2015
                            </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-800 mb-2">
                            Customer Contract Review
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Verify, evaluate, and record purchase order specifications and terms compliance against standard checklists.
                        </p>
                    </div>
                    <button 
                        onClick={() => setActiveForm('contractreview')}
                        className="w-full bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                    >
                        <span>Open Form</span>
                    </button>
                </div>

                {/* 3. Project Team Details Form Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-[230px]">
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
                                <FileWordOutlined className="text-xl" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-100">
                                ISO 9001-2015
                            </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-800 mb-2">
                            Project Team Details Form
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Compile, document, and generate the assigned project team letter specifying member roles and reviews.
                        </p>
                    </div>
                    <button 
                        onClick={() => setActiveForm('projectteam')}
                        className="w-full bg-slate-900 hover:bg-cyan-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                    >
                        <span>Open Form</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
