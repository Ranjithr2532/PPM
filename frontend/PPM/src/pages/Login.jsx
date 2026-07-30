import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Checkbox, message, Modal, Steps } from 'antd'
import { MailOutlined, LockOutlined, ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import cmtiLogo from '../assets/waitro-member-cmti.png'
import { API_BASE_URL, setAccessToken, setCurrentUser } from '../config/api.js'

const { Title, Text } = Typography
const { Step } = Steps

function parseApiError(error) {
  if (!error) return 'Unknown error'
  const res = error.response
  if (!res) {
    return error.message || 'Network error'
  }

  const { status, data } = res

  if (typeof data === 'string' && data.trim()) return data
  if (data) {
    if (typeof data === 'object') {
      if (data.detail) return data.detail
      if (data.message) return data.message
      if (data.errors) {
        if (Array.isArray(data.errors)) return data.errors.join(', ')
        return JSON.stringify(data.errors)
      }
    }
  }

  return `Request failed with status ${status}`
}

/* ---------- 3D File-Opening Analytics Reveal Left Panel ---------- */
function LoginVisualPanel() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [glowPos, setGlowPos] = useState({ x: 0, y: 0 })
  const [metricIndex, setMetricIndex] = useState(0)
  const [statCount, setStatCount] = useState(0)
  const [liveStats, setLiveStats] = useState({
    total: 1090,
    remained_as_proposal: 841,
    converted_to_project: 249,
    ongoing_projects: 144,
    technically_completed: 105,
    financially_completed: 69,
  })
  const [yearlyData, setYearlyData] = useState([])
  const containerRef = useRef(null)

  // Fetch live count & yearly statistics on mount
  useEffect(() => {
    async function fetchLiveCounts() {
      try {
        const res = await axios.get(`${API_BASE_URL}/count/`)
        if (res.data) {
          setLiveStats({
            total: res.data.total_proposals ?? 0,
            remained_as_proposal: res.data.pending_proposals ?? 0,
            converted_to_project: res.data.converted_projects ?? 0,
            ongoing_projects: res.data.ongoing_projects ?? 0,
            technically_completed: res.data.technically_completed ?? 0,
            financially_completed: res.data.financially_completed ?? 0,
          })
        }
      } catch (err) {
        console.warn('Could not fetch counts for login visual:', err)
      }
    }

    async function fetchYearlyCounts() {
      try {
        const res = await axios.get(`${API_BASE_URL}/count/yearly`)
        if (res.data && Array.isArray(res.data.yearly_counts)) {
          setYearlyData(res.data.yearly_counts)
        }
      } catch (err) {
        console.warn('Could not fetch yearly counts for login visual:', err)
      }
    }

    fetchLiveCounts()
    fetchYearlyCounts()
  }, [])

  const conversionRate = liveStats.total > 0
    ? ((liveStats.converted_to_project / liveStats.total) * 100).toFixed(1)
    : '0'

  const metrics = [
    {
      title: 'Total Proposals',
      target: liveStats.total,
      badge: 'Live DB Record',
      badgeColor: 'text-teal-600',
      pingColor: 'bg-teal-400',
      dotColor: 'bg-teal-600',
    },
    {
      title: 'Pending Proposals',
      target: liveStats.remained_as_proposal,
      badge: 'Under Review',
      badgeColor: 'text-amber-600',
      pingColor: 'bg-amber-400',
      dotColor: 'bg-amber-500',
    },
    {
      title: 'Converted to Projects',
      target: liveStats.converted_to_project,
      badge: `${conversionRate}% Conversion Rate`,
      badgeColor: 'text-emerald-600',
      pingColor: 'bg-emerald-400',
      dotColor: 'bg-emerald-600',
    },
    {
      title: 'Ongoing Projects',
      target: liveStats.ongoing_projects,
      badge: 'In Execution',
      badgeColor: 'text-sky-600',
      pingColor: 'bg-sky-400',
      dotColor: 'bg-sky-600',
    },
    {
      title: 'Technically Completed',
      target: liveStats.technically_completed,
      badge: 'Milestone Met',
      badgeColor: 'text-indigo-600',
      pingColor: 'bg-indigo-400',
      dotColor: 'bg-indigo-600',
    },
    {
      title: 'Financially Completed',
      target: liveStats.financially_completed,
      badge: 'Settlement Complete',
      badgeColor: 'text-purple-600',
      pingColor: 'bg-purple-400',
      dotColor: 'bg-purple-600',
    },
  ]

  // Interval to rotate metrics every 2 seconds after initial folder reveal
  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setMetricIndex((prev) => (prev + 1) % metrics.length)
      }, 2000)
      return () => clearInterval(interval)
    }, 600)

    return () => clearTimeout(timer)
  }, [metrics.length])

  // Set metric count directly without running/counting animation
  useEffect(() => {
    setStatCount(metrics[metricIndex].target || 0)
  }, [metricIndex, liveStats])

  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY

    // Max 5-6 deg tilt
    const rotateY = (mouseX / (rect.width / 2)) * 5.5
    const rotateX = -(mouseY / (rect.height / 2)) * 5.5

    setTilt({ x: rotateX, y: rotateY })
    setGlowPos({ x: mouseX * 0.12, y: mouseY * 0.12 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
    setGlowPos({ x: 0, y: 0 })
  }

  const barHeights = ['45%', '82%', '60%', '95%', '72%']

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="folder-reveal-hero-panel"
    >
      <style>{`
        .folder-reveal-hero-panel {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 650px;
          background: #F1F5F9;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
          user-select: none;
        }

        /* Subtle animated background pattern */
        .frh-bg-grid {
          position: absolute;
          inset: -40px;
          background-image: 
            radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.08) 1px, transparent 0);
          background-size: 32px 32px;
          animation: frh-grid-drift 30s linear infinite;
        }

        @keyframes frh-grid-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(32px, 32px); }
        }

        /* Ambient glowing light source */
        .frh-ambient-glow {
          position: absolute;
          width: 550px;
          height: 550px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 150, 255, 0.25) 0%, rgba(0, 150, 255, 0.12) 50%, transparent 70%);
          filter: blur(70px);
          transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
          pointer-events: none;
        }

        /* 3D Folder & Document Assembly */
        .frh-assembly {
          position: relative;
          width: 440px;
          height: 480px;
          transform-style: preserve-3d;
          transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
          animation: frh-idle-float 6s ease-in-out 1.5s infinite;
        }

        @keyframes frh-idle-float {
          0%, 100% { transform: translateY(0px) rotateX(0deg); }
          50% { transform: translateY(-10px) rotateX(1deg); }
        }

        /* Floor Drop Shadow */
        .frh-floor-shadow {
          position: absolute;
          bottom: -35px;
          left: 50%;
          width: 380px;
          height: 35px;
          transform: translateX(-50%) rotateX(90deg);
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.35);
          filter: blur(18px);
          opacity: 0.4;
          animation: frh-shadow-grow 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
        }

        @keyframes frh-shadow-grow {
          0% { opacity: 0.3; transform: translateX(-50%) rotateX(90deg) scale(0.7); }
          100% { opacity: 0.65; transform: translateX(-50%) rotateX(90deg) scale(1.25); filter: blur(25px); }
        }

        /* --- 3D FOLDER BACK COVER --- */
        .frh-folder-back {
          position: absolute;
          bottom: 20px;
          left: 30px;
          width: 380px;
          height: 260px;
          background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.05);
          transform: translateZ(-15px);
        }

        /* Folder tab */
        .frh-folder-back::before {
          content: '';
          position: absolute;
          top: -18px;
          left: 24px;
          width: 120px;
          height: 20px;
          background: #1E293B;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px 10px 0 0;
        }

        /* --- 3D FRONT COVER --- */
        .frh-folder-cover {
          position: absolute;
          bottom: 20px;
          left: 30px;
          width: 380px;
          height: 260px;
          transform-origin: left center;
          transform-style: preserve-3d;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
          animation: frh-cover-open 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
          z-index: 10;
        }

        @keyframes frh-cover-open {
          0% { transform: rotateY(0deg); }
          70% { transform: rotateY(-130deg); }
          100% { transform: rotateY(-122deg); }
        }

        .frh-cover-face {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          backface-visibility: hidden;
        }

        .frh-cover-front {
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          border: 1px solid rgba(0, 150, 255, 0.4);
        }

        .frh-cover-inside {
          background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
          border: 1px solid rgba(0, 150, 255, 0.3);
          transform: rotateY(180deg);
        }

        .frh-cover-badge {
          position: absolute;
          top: 28px;
          left: 28px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(0, 150, 255, 0.15);
          border: 1px solid rgba(0, 150, 255, 0.3);
          border-radius: 24px;
          color: #0096FF;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* --- REVEALED DASHBOARD PAPER SHEETS (White Cards) --- */
        .frh-paper-sheet {
          position: absolute;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-radius: 20px;
          padding: 22px 24px;
          box-shadow: 0 25px 45px -12px rgba(15, 23, 42, 0.18);
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Sheet 1 (Top Stat Card) */
        .frh-sheet-stat {
          bottom: 40px;
          left: 45px;
          width: 350px;
          z-index: 5;
          opacity: 0;
          animation: frh-paper-slide-1 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards;
        }

        @keyframes frh-paper-slide-1 {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, -10px) rotateX(0deg);
          }
          100% {
            opacity: 1;
            transform: translate3d(15px, -180px, 75px) rotateY(-2deg) rotateX(4deg);
            box-shadow: -12px 30px 45px -12px rgba(15, 23, 42, 0.22), 0 0 25px rgba(0, 150, 255, 0.25);
          }
        }

        /* Sheet 2 (Bottom Yearly Proposals Bar Chart Card) */
        .frh-sheet-bar {
          bottom: 25px;
          left: 40px;
          width: 360px;
          z-index: 3;
          opacity: 0;
          animation: frh-paper-slide-2 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.75s forwards;
        }

        @keyframes frh-paper-slide-2 {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, -10px) rotateX(0deg);
          }
          100% {
            opacity: 1;
            transform: translate3d(-10px, 15px, 20px) rotateY(1deg) rotateX(3deg);
            box-shadow: 0 30px 50px -15px rgba(15, 23, 42, 0.2);
          }
        }

        /* SVG Animated Line Stroke Draw */
        .frh-line-draw {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: frh-stroke-draw 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards;
        }

        @keyframes frh-stroke-draw {
          0% { stroke-dashoffset: 500; }
          100% { stroke-dashoffset: 0; }
        }

        @keyframes frh-fade-in {
          to { opacity: 1; }
        }

        @media (max-width: 768px) {
          .folder-reveal-hero-panel { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .frh-bg-grid, .frh-assembly, .frh-folder-cover, .frh-paper-sheet {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Background drift grid */}
      <div className="frh-bg-grid" />

      {/* Radial glow background */}
      <div
        className="frh-ambient-glow"
        style={{
          transform: `translate(${glowPos.x}px, ${glowPos.y}px)`,
        }}
      />

      {/* 3D Assembly Stage */}
      <div
        className="frh-assembly"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        {/* Floor shadow */}
        <div className="frh-floor-shadow" />

        {/* Folder Back Cover */}
        <div className="frh-folder-back" />

        {/* --- SHEET 1: STAT CARD (Positioned at top) --- */}
        <div className="frh-paper-sheet frh-sheet-stat">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase transition-all duration-300">
              {metrics[metricIndex].title}
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${metrics[metricIndex].pingColor}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${metrics[metricIndex].dotColor}`}></span>
            </span>
          </div>
          <div className="text-4xl font-extrabold text-slate-900 tracking-tight my-1 transition-all duration-300">
            {statCount.toLocaleString()}
          </div>
          <div className={`mt-1 flex items-center gap-1.5 text-xs font-bold transition-all duration-300 ${metrics[metricIndex].badgeColor}`}>
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12 7a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 11-2 0V9.414l-4.293 4.293a1 1 0 01-1.414 0L7 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L10 11.586 13.586 8H13a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span>{metrics[metricIndex].badge}</span>
          </div>

          {/* Mini Rotation Indicator Dots */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {metrics.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full transition-all duration-400 ${idx === metricIndex ? 'w-5 bg-[#0096FF]' : 'w-2 bg-slate-200'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* --- SHEET 2: YEARLY PROPOSALS ANIMATED LINE GRAPH CARD --- */}
        <div className="frh-paper-sheet frh-sheet-bar">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
              Yearly Proposals Trend
            </span>
            <span className="text-xs text-[#0096FF] font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0096FF] animate-pulse"></span>
              Live DB
            </span>
          </div>

          {(() => {
            const dataPoints = (yearlyData.length > 0
              ? yearlyData.slice(-5)
              : [
                { year: '2022', count: 45 },
                { year: '2023', count: 80 },
                { year: '2024', count: 120 },
                { year: '2025', count: 160 },
                { year: '2026', count: 90 },
              ]
            )

            const maxCount = Math.max(...dataPoints.map(d => d.count), 1)
            const width = 310
            const height = 75
            const padding = 14

            const points = dataPoints.map((item, idx) => {
              const x = padding + (idx * (width - 2 * padding)) / Math.max(dataPoints.length - 1, 1)
              const y = height - padding - ((item.count / maxCount) * (height - 2 * padding))
              return { x, y, year: item.year, count: item.count }
            })

            // Generate smooth cubic bezier SVG path
            let dPath = `M ${points[0].x} ${points[0].y}`
            for (let i = 0; i < points.length - 1; i++) {
              const current = points[i]
              const next = points[i + 1]
              const controlX = (current.x + next.x) / 2
              dPath += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
            }

            const fillPath = `${dPath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

            return (
              <div className="relative">
                <svg className="w-full h-20 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#0096FF" />
                    </linearGradient>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0096FF" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0096FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area under line */}
                  <path d={fillPath} fill="url(#areaGrad)" />

                  {/* Animated Line Stroke */}
                  <path
                    d={dPath}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="frh-line-draw"
                  />

                  {/* Glowing Data Dots */}
                  {points.map((pt, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5"
                        fill="#FFFFFF"
                        stroke="#0096FF"
                        strokeWidth="2.5"
                        className="transition-transform duration-300 group-hover:scale-150 shadow-md"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="2.5"
                        fill="#0096FF"
                      />
                    </g>
                  ))}
                </svg>

                {/* Year Labels */}
                <div className="flex justify-between items-center px-1 text-xs font-bold text-slate-600 mt-2">
                  {points.map((pt, idx) => (
                    <div key={idx} className="text-center">
                      <span className="block text-[10px] text-slate-400 font-medium">{pt.count}</span>
                      <span>{pt.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Front Cover of Folder */}
        <div className="frh-folder-cover">
          {/* Front Face (Visible when closed) */}
          <div className="frh-cover-face frh-cover-front">
            <div className="frh-cover-badge">
              <SafetyCertificateOutlined />
              <span>PPM Records</span>
            </div>
          </div>

          {/* Inside Face (Visible on left side when open) */}
          <div className="frh-cover-face frh-cover-inside">
            <div className="frh-cover-badge">
              <SafetyCertificateOutlined />
              <span>PPM Records</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Login() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('')
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [pendingUserData, setPendingUserData] = useState(null)
  const [selectedRole, setSelectedRole] = useState('')

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/login`, {
        email: values.email,
        password: values.password,
      })

      const data = response.data
      const token = data.access_token || data.token
      const rawUser = data.user || data

      const userId = rawUser.id || rawUser.user_id || data.id || data.user_id
      const roleRaw = (rawUser.role || data.role || '').toString().toLowerCase().trim()

      const userPayload = {
        ...rawUser,
        user_id: userId,
        id: userId,
        name: rawUser.name || data.name || '',
        email: rawUser.email || data.email || values.email,
        role: roleRaw,
        dbRole: roleRaw,
        center: rawUser.center || data.center || '',
        group: rawUser.group || data.group || '',
      }

      setAccessToken(token)
      setCurrentUser(userPayload)

      message.success('Login successful!')

      // Determine routing path based on normalized role
      let routeRole = roleRaw
      if (routeRole === 'admin' || routeRole === 'administrator') routeRole = 'admin'
      else if (routeRole === 'group head' || routeRole === 'gh') routeRole = 'gh'
      else if (routeRole === 'centre head' || routeRole === 'center head' || routeRole === 'ch') routeRole = 'ch'
      else if (routeRole === 'scientist') routeRole = 'scientist'
      else if (routeRole === 'director') routeRole = 'director'
      else if (routeRole === 'guest' || routeRole === 'role') routeRole = 'guest'
      else routeRole = 'admin'

      if (roleRaw === 'gh' || roleRaw === 'group head') {
        setPendingUserData(userPayload)
        setShowRoleSelection(true)
      } else {
        navigate(`/${routeRole}/proposals`)
      }
    } catch (err) {
      console.error('Login error:', err)
      const errorMsg = parseApiError(err)
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const openForgotPasswordModal = () => {
    setForgotPasswordStep(0)
    setForgotPasswordEmail('')
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
    setShowNewPassword(false)
    setForgotPasswordOpen(true)
  }

  const closeForgotPasswordModal = () => {
    setForgotPasswordOpen(false)
    setForgotPasswordStep(0)
    setForgotPasswordEmail('')
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
    setShowNewPassword(false)
  }

  const handleRequestOtp = async () => {
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      message.error('Please enter a valid email address')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/request-otp`, {
        email: forgotPasswordEmail,
      })
      message.success(response.data.message || 'OTP sent successfully to your email!')
      setForgotPasswordStep(1)
    } catch (err) {
      console.error(err)
      message.error(parseApiError(err))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!forgotPasswordOtp || forgotPasswordOtp.length !== 6) {
      message.error('Please enter a 6-digit OTP')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/verify-otp`, {
        email: forgotPasswordEmail,
        otp: forgotPasswordOtp,
      })
      message.success(response.data.message || 'OTP verified successfully!')
      setForgotPasswordStep(2)
    } catch (err) {
      console.error(err)
      message.error(parseApiError(err))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!forgotPasswordNewPassword || forgotPasswordNewPassword.length < 6) {
      message.error('Password must be at least 6 characters long')
      return
    }

    if (forgotPasswordNewPassword !== forgotPasswordConfirmPassword) {
      message.error('New password and confirm password do not match')
      return
    }

    setForgotPasswordLoading(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/users/update-password`, {
        email: forgotPasswordEmail,
        new_password: forgotPasswordNewPassword,
      })
      message.success(response.data.message || 'Password reset successfully! Please login.')
      closeForgotPasswordModal()
    } catch (err) {
      console.error(err)
      message.error(parseApiError(err))
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const handleRoleSelection = (role) => {
    if (!pendingUserData) return

    const normalizedRole = (role || '').toString().toLowerCase().trim()
    const updatedUserPayload = {
      ...pendingUserData,
      role: normalizedRole,
      dbRole: normalizedRole,
      user_id: pendingUserData.user_id || pendingUserData.id,
      id: pendingUserData.id || pendingUserData.user_id,
    }

    setCurrentUser(updatedUserPayload)

    message.success(`Logged in as ${role}`)
    setShowRoleSelection(false)
    setPendingUserData(null)

    if (normalizedRole === 'group head' || normalizedRole === 'gh') {
      navigate('/gh/proposals')
    } else if (normalizedRole === 'scientist') {
      navigate('/scientist/proposals')
    } else {
      navigate('/gh/proposals')
    }
  }

  const handleConfirmRoleSelection = () => {
    if (!selectedRole) {
      message.error('Please select a role')
      return
    }
    handleRoleSelection(selectedRole)
  }

  const closeRoleSelectionModal = () => {
    setShowRoleSelection(false)
    setPendingUserData(null)
    setSelectedRole('')
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F9] text-slate-800 selection:bg-[#0096FF] selection:text-white">
      {/* Left: 3D Animated File-Opening Visual Hero Panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5">
        <LoginVisualPanel />
      </div>

      {/* Right: Redesigned Cohesive Form Panel */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 md:p-12 lg:p-16 relative z-10">
        <style>{`
          .vhp-form-entrance {
            opacity: 0;
            transform: translateY(24px);
            animation: vhp-slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          }
          @keyframes vhp-slide-up {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        <div className="w-full max-w-md vhp-form-entrance bg-white/95 backdrop-blur-xl border border-slate-200/90 p-8 md:p-10 rounded-3xl shadow-2xl shadow-slate-300/40 relative overflow-hidden">
          {/* Subtle top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0096FF] via-[#0077CC] to-[#0055AA]" />

          {/* Header Area */}
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            {/* Pure white logo container so the white logo image blends 100% seamlessly */}
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm mb-1 flex items-center justify-center">
              <img src={cmtiLogo} alt="CMTI logo" className="h-14 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                PPM
              </h1>
              <p className="text-sm text-slate-500">
                Sign in to manage proposals, analytics & orders
              </p>
            </div>
          </div>

          {/* Form Area */}
          <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
            <Form.Item
              name="email"
              label={<span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Email Address</span>}
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-[#0096FF] mr-2" />}
                placeholder="name@cmti.res.in"
                size="large"
                className="bg-slate-50/90 border-slate-300 text-slate-900 placeholder-slate-400 rounded-xl hover:border-[#0096FF] focus:border-[#0096FF] h-12 text-sm"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</span>}
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input
                prefix={<LockOutlined className="text-[#0096FF] mr-2" />}
                placeholder="Enter password"
                size="large"
                type={showPassword ? 'text' : 'password'}
                className="bg-slate-50/90 border-slate-300 text-slate-900 placeholder-slate-400 rounded-xl hover:border-[#0096FF] focus:border-[#0096FF] h-12 text-sm"
              />
            </Form.Item>

            <div className="flex items-center justify-between mb-6">
              <Checkbox
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="text-xs text-slate-600 hover:text-slate-800"
              >
                Show password
              </Checkbox>
              <Button
                type="link"
                onClick={openForgotPasswordModal}
                className="p-0 text-xs text-[#0096FF] hover:text-[#0077CC] font-semibold"
              >
                Forgot Password?
              </Button>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              style={{ backgroundColor: '#0096FF', borderColor: '#0096FF' }}
              className="w-full h-12 text-white font-bold rounded-xl border-0 shadow-lg shadow-[#0096FF]/25 flex items-center justify-center gap-2 text-base transition-all duration-200 hover:brightness-105"
            >
              <span>Sign In</span>
              <ArrowRightOutlined className="text-sm" />
            </Button>
          </Form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              CMTI Order & Project Performance Management System
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        title="Reset Password"
        open={forgotPasswordOpen}
        onCancel={closeForgotPasswordModal}
        footer={null}
        width={500}
        maskClosable={false}
        keyboard={false}
      >
        <Steps current={forgotPasswordStep} className="mb-6">
          <Step title="Email" />
          <Step title="Verify OTP" />
          <Step title="New Password" />
        </Steps>

        {/* Step 0: Enter Email */}
        {forgotPasswordStep === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Email Address</label>
              <Input
                placeholder="Enter your email"
                size="large"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                onPressEnter={handleRequestOtp}
              />
            </div>
            <Button
              type="primary"
              size="large"
              loading={forgotPasswordLoading}
              onClick={handleRequestOtp}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Get OTP
            </Button>
          </div>
        )}

        {/* Step 1: Verify OTP */}
        {forgotPasswordStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Enter OTP</label>
              <p className="text-sm text-gray-600 mb-3">
                We've sent a 6-digit OTP to {forgotPasswordEmail}
              </p>
              <Input
                placeholder="Enter 6-digit OTP"
                size="large"
                value={forgotPasswordOtp}
                onChange={(e) => setForgotPasswordOtp(e.target.value)}
                onPressEnter={handleVerifyOtp}
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="large"
                onClick={() => setForgotPasswordStep(0)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="primary"
                size="large"
                loading={forgotPasswordLoading}
                onClick={handleVerifyOtp}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Verify OTP
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Reset Password */}
        {forgotPasswordStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">New Password</label>
              <Input
                placeholder="Enter new password"
                size="large"
                type={showNewPassword ? 'text' : 'password'}
                value={forgotPasswordNewPassword}
                onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Confirm Password</label>
              <Input
                placeholder="Confirm new password"
                size="large"
                type={showNewPassword ? 'text' : 'password'}
                value={forgotPasswordConfirmPassword}
                onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                onPressEnter={handleResetPassword}
              />
            </div>
            <Checkbox
              checked={showNewPassword}
              onChange={(e) => setShowNewPassword(e.target.checked)}
            >
              Show password
            </Checkbox>
            <Button
              type="primary"
              size="large"
              loading={forgotPasswordLoading}
              onClick={handleResetPassword}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Reset Password
            </Button>
          </div>
        )}
      </Modal>

      {/* GH Role Selection Modal */}
      <Modal
        title="Select Your Role"
        open={showRoleSelection}
        onCancel={closeRoleSelectionModal}
        footer={null}
        width={450}
        maskClosable={false}
        keyboard={false}
        centered
      >
        <div className="space-y-6">
          <div>
            <p className="text-lg font-medium mb-4">
              Welcome, {pendingUserData?.name}! Please select how you want to proceed:
            </p>
          </div>

          <div className="space-y-3">
            <Button
              type="primary"
              size="large"
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
              onClick={() => handleRoleSelection('Group Head')}
            >
              <div className="flex items-center justify-center">
                <span>Login as Group Head</span>
              </div>
            </Button>

            <Button
              size="large"
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleRoleSelection('Scientist')}
            >
              <div className="flex items-center justify-center">
                <span>Login as Scientist</span>
              </div>
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button
              type="link"
              onClick={closeRoleSelectionModal}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Login