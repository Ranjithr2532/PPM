import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Statistic, Row, Col, Select, Typography, message } from 'antd'
import Chart from 'chart.js/auto'
import { API_BASE_URL } from '../config/api.js'

const { Title } = Typography
const BASE_START_YEAR = 2000
const BASE_END_YEAR = 2035
const CURRENT_YEAR = new Date().getFullYear()

function Analytics() {
  const [proposals, setProposals] = useState([])
  const [masterProposals, setMasterProposals] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(null)

  // Default range: from 2018 to 2026
  const [selectedFromYear, setSelectedFromYear] = useState(2018)
  const [selectedToYear, setSelectedToYear] = useState(2026)

  const chartRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const pie1Ref = useRef(null)
  const pie2Ref = useRef(null)
  const pie3Ref = useRef(null)
  const pie4Ref = useRef(null)
  const pie5Ref = useRef(null)
  const pie6Ref = useRef(null)
  const pie1Instance = useRef(null)
  const pie2Instance = useRef(null)
  const pie3Instance = useRef(null)
  const pie4Instance = useRef(null)
  const pie5Instance = useRef(null)
  const pie6Instance = useRef(null)
  const [proposalCount, setProposalCount] = useState(0)
  const [conversionData, setConversionData] = useState(null)
  const [techCompletedByDept, setTechCompletedByDept] = useState(null)
  const [ongoingByDept, setOngoingByDept] = useState(null)

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/proposals/`, {
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error('Unable to fetch proposals')
        const payload = await res.json()
        setProposals(Array.isArray(payload) ? payload : [])
      } catch (err) {
        console.error(err)
        message.error(err.message || 'Unable to fetch proposals')
      } finally {
        setLoading(false)
      }
    }

    const fetchMasterProposals = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/master_proposals/`, {
          headers: { accept: 'application/json' },
        })
        if (!res.ok) throw new Error('Unable to fetch master proposals')
        const payload = await res.json()
        setMasterProposals(Array.isArray(payload) ? payload : [])
      } catch (err) {
        console.error(err)
        message.error(err.message || 'Unable to fetch master proposals')
      }
    }

    const fetchProposalCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/master_proposals/count`, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error('Unable to fetch proposal count')
        }
        const payload = await response.json()
        setProposalCount(payload.count)
      } catch (error) {
        console.error(error)
        message.error(error.message || 'Unable to fetch proposal count')
      }
    }

    const fetchConversionData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/proposals/proposal-vs-project`, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error('Unable to fetch conversion data')
        }
        const payload = await response.json()
        setConversionData(payload)
      } catch (error) {
        console.error(error)
        message.error(error.message || 'Unable to fetch conversion data')
      }
    }

    const fetchTechCompletedByDept = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/proposals/technically-completed-by-dept`, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error('Unable to fetch technically completed by department')
        }
        const payload = await response.json()
        setTechCompletedByDept(payload)
      } catch (error) {
        console.error(error)
        message.error(error.message || 'Unable to fetch technically completed by department')
      }
    }

    const fetchOngoingByDept = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/proposals/ongoing-by-dept`, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error('Unable to fetch ongoing by department')
        }
        const payload = await response.json()
        setOngoingByDept(payload)
      } catch (error) {
        console.error(error)
        message.error(error.message || 'Unable to fetch ongoing by department')
      }
    }

    fetchProposals()
    fetchMasterProposals()
    fetchProposalCount()
    fetchConversionData()
    fetchTechCompletedByDept()
    fetchOngoingByDept()
  }, [])

  const stats = useMemo(() => {
    const tableData = proposals || []
    const totalProposals = tableData.length
    const totalProjects = tableData.filter((item) => item.project_number && item.project_number.toString().trim() !== '').length
    const technicallyCompleted = tableData.filter(
      (item) => item.technical_completed_year && item.technical_completed_year.trim() !== '',
    ).length
    const financiallyCompleted = tableData.filter((item) =>
      item.technical_completed_year && item.technical_completed_year.toString().trim() !== '' &&
      item.financial_completed_year && item.financial_completed_year.toString().trim() !== ''
    ).length
    const pendingProjects = tableData.filter((item) =>
      item.project_number && item.project_number.trim() !== '' &&
      (!item.technical_completed_year || item.technical_completed_year.trim() === '') &&
      (!item.financial_completed_year || item.financial_completed_year.trim() === '')
    ).length

    return { totalProposals, totalProjects, technicallyCompleted, financiallyCompleted, pendingProjects }
  }, [proposals])

  // All available years from 2000 to 2035
  const availableYears = useMemo(() => {
    const years = []
    for (let y = BASE_START_YEAR; y <= BASE_END_YEAR; y++) {
      years.push(y)
    }
    return years
  }, [])

  const chartLabels = useMemo(() => {
    const minY = Math.min(selectedFromYear, selectedToYear)
    const maxY = Math.max(selectedFromYear, selectedToYear)
    return availableYears.filter((y) => y >= minY && y <= maxY)
  }, [availableYears, selectedFromYear, selectedToYear])

  const getProjectYear = (p) => {
    try {
      if (p.order_date) {
        const year = Number(String(p.order_date).slice(0, 4))
        if (!Number.isNaN(year)) return year
      }
    } catch (e) {
      // ignore
    }
    if (p.technical_completed_year) {
      const y = Number(String(p.technical_completed_year).slice(0, 4))
      if (!Number.isNaN(y)) return y
    }
    if (p.financial_completed_year) {
      const y = Number(String(p.financial_completed_year).slice(0, 4))
      if (!Number.isNaN(y)) return y
    }
    if (p.created_at) {
      const y = Number(String(p.created_at).slice(0, 4))
      if (!Number.isNaN(y)) return y
    }
    return null
  }

  const getQuoteYear = (quoteDate) => {
    if (!quoteDate) return null
    try {
      // Handle formats like "6/29/20", "7/2/20", etc.
      const parts = String(quoteDate).split('/')
      if (parts.length >= 3) {
        let year = parseInt(parts[2])
        // If year is 2 digits, convert to 4 digits
        if (year < 100) {
          year += year > 50 ? 1900 : 2000
        }
        if (!isNaN(year)) return year
      }
    } catch (e) {
      console.error('Error parsing quote date:', e)
    }
    return null
  }

  // Count proposals per year from master_proposals
  const proposalsPerYear = useMemo(() => {
    const counts = {}
    chartLabels.forEach(year => counts[year] = 0)

    for (const mp of masterProposals) {
      const year = getQuoteYear(mp.quote_date)
      if (year && chartLabels.includes(year)) {
        counts[year] = (counts[year] || 0) + 1
      }
    }

    return chartLabels.map(year => counts[year] || 0)
  }, [masterProposals, chartLabels])

  // Count projects per year from proposals
  const projectsPerYear = useMemo(() => {
    const counts = chartLabels.map((year) => {
      return proposals.filter((p) => {
        if (!p.project_number) return false
        const py = getProjectYear(p)
        return py === year
      }).length
    })
    return counts
  }, [proposals, chartLabels])

  const PROJECT_PREFIXES = ['GSP', 'ISP', 'GAP', 'ILP', 'DPP', 'LSP', 'CLP', 'SVP', 'TOT', 'SVP', 'TOT']

  const getProjectPrefix = (pn) => {
    if (!pn) return 'OTHER'
    const up = String(pn).toUpperCase().trim()
    for (const pref of PROJECT_PREFIXES) {
      if (up.startsWith(pref)) return pref
    }
    const m = up.match(/^[A-Z]+/)
    return m ? m[0] : 'OTHER'
  }

  const colorPalette = (n) => {
    const colors = []
    for (let i = 0; i < n; i++) {
      const hue = Math.round((i * 360) / n)
      colors.push(`hsl(${hue} 70% 55%)`)
    }
    return colors
  }

  const pie1 = useMemo(() => {
    const counts = {}
    for (const p of proposals) {
      const pref = getProjectPrefix(p.project_number)
      counts[pref] = (counts[pref] || 0) + (p.project_number ? 1 : 0)
    }
    for (const pref of PROJECT_PREFIXES) if (!counts[pref]) counts[pref] = 0
    const labels = Object.keys(counts)
    const data = labels.map((l) => counts[l])
    return { labels, data }
  }, [proposals])

  const pie2 = useMemo(() => {
    const counts = {}
    for (const p of proposals) {
      if (!p.project_number) continue
      const dep = (p.center || 'Unknown').toString() || 'Unknown'
      counts[dep] = (counts[dep] || 0) + 1
    }
    const labels = Object.keys(counts)
    const data = labels.map((l) => counts[l])
    return { labels, data }
  }, [proposals])

  const pie3 = useMemo(() => {
    const counts = {}
    for (const p of proposals) {
      const tech = p.technical_completed_year && String(p.technical_completed_year).trim() !== ''
      const fin = p.financial_completed_year && String(p.financial_completed_year).trim() !== ''
      if (!p.project_number) continue
      if (!(tech && fin)) continue
      const dep = (p.center || 'Unknown').toString() || 'Unknown'
      counts[dep] = (counts[dep] || 0) + 1
    }
    const labels = Object.keys(counts)
    const data = labels.map((l) => counts[l])
    return { labels, data }
  }, [proposals])

  const pie4 = useMemo(() => {
    if (!conversionData) return { labels: [], data: [] }
    return {
      labels: ['Converted to Project', 'Remained as Proposal'],
      data: [conversionData.converted_to_project, conversionData.remained_as_proposal]
    }
  }, [conversionData])

  const pie5 = useMemo(() => {
    if (!techCompletedByDept || techCompletedByDept.length === 0) return { labels: [], data: [] }
    return {
      labels: techCompletedByDept.map(item => item.department),
      data: techCompletedByDept.map(item => item.count)
    }
  }, [techCompletedByDept])

  const pie6 = useMemo(() => {
    if (!ongoingByDept || ongoingByDept.length === 0) return { labels: [], data: [] }
    return {
      labels: ongoingByDept.map(item => item.department),
      data: ongoingByDept.map(item => item.count)
    }
  }, [ongoingByDept])

  useEffect(() => {
    if (!chartRef.current) return
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
      chartInstanceRef.current = null
    }

    const ctx = chartRef.current.getContext('2d')
    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartLabels.map(String),
        datasets: [
          {
            label: 'Proposals',
            data: proposalsPerYear,
            backgroundColor: 'rgba(37,99,235,0.8)',
            borderColor: 'rgba(37,99,235,1)',
            borderWidth: 1,
          },
          {
            label: 'Projects',
            data: projectsPerYear,
            backgroundColor: 'rgb(168, 85, 247))',
            borderColor: 'rgb(168, 85, 247)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: Math.max(
              30,
              Math.max(...proposalsPerYear, ...projectsPerYear)
            ),
            ticks: {
              stepSize: 5,
              color: '#374151',
              font: { size: 14 },
            },
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Year'
            },
            ticks: {
              color: '#374151',
              font: { size: 14 }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 14 },
              padding: 15
            }
          },
          tooltip: {
            bodyFont: { size: 14 },
            titleFont: { size: 14 }
          },
        },
      },
    })

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [chartLabels, proposalsPerYear, projectsPerYear])

  useEffect(() => {
    const renderPie = (ref, instanceRef, dataset, title) => {
      if (!ref?.current) return
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }

      const ctx = ref.current.getContext('2d')
      const colors = colorPalette(dataset.labels.length)
      instanceRef.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: dataset.labels,
          datasets: [
            {
              data: dataset.data,
              backgroundColor: colors,
              borderColor: '#ffffff',
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 14,
                padding: 12,
                font: { size: 14 }
              }
            },
            title: {
              display: !!title,
              text: title,
              font: { size: 16 }
            },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (ctx) => {
                  const label = ctx.label || ''
                  const value = ctx.parsed || 0
                  const sum = ctx.dataset.data.reduce((a, b) => a + b, 0)
                  const pct = sum ? ((value / sum) * 100).toFixed(1) : '0.0'
                  return `${label}: ${value} (${pct}%)`
                }
              }
            },
          },
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            duration: 700,
            easing: 'easeOutQuart'
          },
        },
      })
    }

    renderPie(pie1Ref, pie1Instance, pie1, 'Projects by Project Number')
    renderPie(pie2Ref, pie2Instance, pie2, 'Projects by Department')
    renderPie(pie3Ref, pie3Instance, pie3, 'Financially Completed Projects by Department')
    renderPie(pie5Ref, pie5Instance, pie5, 'Technically Completed Projects by Department')
    renderPie(pie6Ref, pie6Instance, pie6, 'Ongoing Projects by Department')

    // Custom render for pie4 with specific colors
    if (pie4Ref.current && !pie4Instance.current && pie4.labels.length > 0) {
      const ctx4 = pie4Ref.current.getContext('2d')
      pie4Instance.current = new Chart(ctx4, {
        type: 'pie',
        data: {
          labels: pie4.labels,
          datasets: [
            {
              data: pie4.data,
              backgroundColor: ['#4CAF50', '#F44336'],
              borderColor: '#ffffff',
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 14,
                padding: 12,
                font: { size: 14 }
              }
            },
            title: {
              display: true,
              text: 'Proposal vs Project Conversion',
              font: { size: 16 }
            },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (ctx) => {
                  const label = ctx.label || ''
                  const value = ctx.parsed || 0
                  const sum = ctx.dataset.data.reduce((a, b) => a + b, 0)
                  const pct = sum ? ((value / sum) * 100).toFixed(1) : '0.0'
                  return `${label}: ${value} (${pct}%)`
                }
              }
            },
          },
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            duration: 700,
            easing: 'easeOutQuart'
          },
        },
      })
    } else if (pie4Instance.current && pie4.labels.length > 0) {
      pie4Instance.current.data.labels = pie4.labels
      pie4Instance.current.data.datasets[0].data = pie4.data
      pie4Instance.current.update()
    }

    return () => {
      if (pie1Instance.current) {
        pie1Instance.current.destroy()
        pie1Instance.current = null
      }
      if (pie2Instance.current) {
        pie2Instance.current.destroy()
        pie2Instance.current = null
      }
      if (pie3Instance.current) {
        pie3Instance.current.destroy()
        pie3Instance.current = null
      }
      if (pie4Instance.current) {
        pie4Instance.current.destroy()
        pie4Instance.current = null
      }
      if (pie5Instance.current) {
        pie5Instance.current.destroy()
        pie5Instance.current = null
      }
      if (pie6Instance.current) {
        pie6Instance.current.destroy()
        pie6Instance.current = null
      }
    }
  }, [pie1, pie2, pie3, pie4, pie5, pie6])

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>Analytics Dashboard</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <Statistic
              title={<span style={{ color: '#fff' }}>Total Proposals</span>}
              value={proposalCount}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <Statistic
              title={<span style={{ color: '#fff' }}>Total Projects</span>}
              value={stats.totalProjects}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <Statistic
              title={<span style={{ color: '#fff' }}>Technically Completed</span>}
              value={stats.technicallyCompleted}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <Statistic
              title={<span style={{ color: '#fff' }}>Financially Completed</span>}
              value={stats.financiallyCompleted}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            <Statistic
              title={<span style={{ color: '#fff' }}>Ongoing Projects</span>}
              value={stats.pendingProjects}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <Title level={4} style={{ margin: 0 }}>Proposals & Projects per Year</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>From:</span>
            <Select
              value={selectedFromYear}
              onChange={(v) => setSelectedFromYear(Number(v))}
              size="large"
              style={{ width: 120 }}
            >
              {availableYears.map((y) => (
                <Select.Option key={y} value={y}>
                  {y}
                </Select.Option>
              ))}
            </Select>
            <span style={{ fontWeight: 500 }}>To:</span>
            <Select
              value={selectedToYear}
              onChange={(v) => setSelectedToYear(Number(v))}
              size="large"
              style={{ width: 120 }}
            >
              {availableYears.map((y) => (
                <Select.Option key={y} value={y}>
                  {y}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
        <div style={{ height: '400px' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Project Distribution (by Project Number)">
            <div style={{ height: '350px' }}>
              <canvas ref={pie1Ref}></canvas>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Projects by Department">
            <div style={{ height: '350px' }}>
              <canvas ref={pie2Ref}></canvas>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Financially Completed Projects by Department">
            <div style={{ height: '350px' }}>
              <canvas ref={pie3Ref}></canvas>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={8}>
          <Card title="Ongoing Projects by Department">
            <div style={{ height: '350px' }}>
              <canvas ref={pie6Ref}></canvas>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Technically Completed Projects by Department">
            <div style={{ height: '350px' }}>
              <canvas ref={pie5Ref}></canvas>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Proposal vs Project Conversion">
            <div style={{ height: '350px' }}>
              <canvas ref={pie4Ref}></canvas>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#4CAF50', borderRadius: '50%' }}></div>
                <span>Converted: {conversionData?.converted_to_project || 0}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#F44336', borderRadius: '50%' }}></div>
                <span>Remained: {conversionData?.remained_as_proposal || 0}</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Analytics