import { Layout } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Proposals from './pages/Proposals'
import Configuration from './pages/Configuration'
import Projects from './pages/Projects'
import MasterProposals from './pages/MasterProposals'
import Allproposals from './pages/Allproposals'
import Login from './pages/Login'
import CreateLogin from './pages/CreateLogin'
import Sidebar from './components/Sidebar'
import DirectorProposals from './pages/Directorproposals'
import FinancialAnalytics from './pages/financialanalytics'
import Analytics from './pages/Analytics'




import './App.css'
import AdminNotification from './pages/AdminNotification'
import GhMasterProposals from './pages/GhMasterProposals'
import GhNotification from './pages/GhNotification'
import UserAccess from './pages/AccessControl'
import Customers from './pages/customers'

const { Content } = Layout

// Check if user is logged in
function isAuthenticated() {
  try {
    const raw = window.localStorage.getItem('ppm_user')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return Boolean(parsed && parsed.user_id)
  } catch {
    return false
  }
}

// Get user object from localStorage
function getStoredUser() {
  try {
    const raw = window.localStorage.getItem('ppm_user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Protected layout that enforces correct role and renders correct pages
function RoleProtectedLayout({ basePath }) {
  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  const user = getStoredUser()
  const userRole = (user?.role || '').toLowerCase().trim()
  const normalizedUserRole = userRole === 'role' ? 'guest' : userRole

  // Normalize role: only allow 'admin', 'guest', 'gh', 'ch', 'scientist', 'director' — default to 'gh' if unknown
  const normalizedRole =
    ['admin', 'guest', 'gh', 'ch', 'scientist', 'director'].includes(normalizedUserRole)
      ? normalizedUserRole
      : 'gh'
  // If user is trying to access a base path that doesn't match their role → redirect
  if (normalizedRole !== basePath) {
    return <Navigate to={`/${normalizedRole}/proposals`} replace />
  }

  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'guest'

  // Select correct page components based on the current route base path.
  // This ensures /admin uses the admin Analytics page instead of GH analytics.
  let ProposalsComponent = GHProposals
  let ProjectsComponent = Projects
  let AnalyticsComponent = Analytics

  if (basePath === 'admin') {
    ProposalsComponent = Proposals
    ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  } else if (basePath === 'ch') {
    ProposalsComponent = Allproposals
    ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  } else if (basePath === 'scientist') {
    ProposalsComponent = Allproposals
    ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  } else if (basePath === 'director') {
    ProposalsComponent = DirectorProposals
    // ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  } else if (basePath === 'guest') {
    ProposalsComponent = Proposals
    ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  }
  // 'gh' already set as default above

  return (
    <Layout className="min-h-screen">
      <Sidebar />
      <Layout
        className="bg-slate-100"
        style={{ marginLeft: 260, minHeight: '100vh' }}
      >
        <Content
          className="p-6"
          style={{ height: '100vh', overflowY: 'auto' }}
        >
          <Routes>
            <Route path="proposals" element={<ProposalsComponent />} />
            {isAdmin && (
              <Route path="master-proposals" element={<MasterProposals />} />
            )}
            <Route path="analytics" element={<AnalyticsComponent />} />
            {normalizedRole === 'director' && (
              <Route path="financial-analytics" element={<FinancialAnalytics />} />
            )}
            {normalizedRole !== 'director' && (
              <Route path="projects" element={<ProjectsComponent />} />
            )}

            <Route path='gh-master-proposals' element={<GhMasterProposals />} />
            <Route path='gh-notification' element={<GhNotification />} />

            {/* Only admins can access configuration */}
            {isAdmin && (
              <>
                <Route path="overall-analytics" element={<Analytics />} />
                <Route path="configuration" element={<Configuration />} />
                <Route path="notification" element={<AdminNotification />} />
                <Route path="access-control" element={<UserAccess />} />
                <Route path="customers" element={<Customers />} />
              </>
            )}

            {/* Catch-all: redirect to proposals */}
            <Route path="*" element={<Navigate to="proposals" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100">
        <Routes>
          {/* Public / Auth Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/create-login" element={<CreateLogin />} />

          {/* Protected Role-Based Routes */}
          <Route path="/admin/*" element={<RoleProtectedLayout basePath="admin" />} />
          <Route path="/guest/*" element={<RoleProtectedLayout basePath="guest" />} />
          <Route path="/role/*" element={<Navigate to="/guest/proposals" replace />} />
          <Route path="/gh/*" element={<RoleProtectedLayout basePath="gh" />} />
          <Route path="/ch/*" element={<RoleProtectedLayout basePath="ch" />} />
          <Route path="/scientist/*" element={<RoleProtectedLayout basePath="scientist" />} />
          <Route path="/director/*" element={<RoleProtectedLayout basePath="director" />} />

          {/* Fallback: any unknown route → login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App