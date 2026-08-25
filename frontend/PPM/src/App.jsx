import { lazy, Suspense } from 'react'
import { Layout, Spin } from 'antd'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CreateLogin from './pages/CreateLogin'
import Sidebar from './components/Sidebar'
import './App.css'

// Lazy-loaded Page Components for Bundle Optimization & Code Splitting
const Proposals = lazy(() => import('./pages/Proposals'))
const Configuration = lazy(() => import('./pages/Configuration'))
const Projects = lazy(() => import('./pages/Projects'))
const MasterProposals = lazy(() => import('./pages/MasterProposals'))
const Allproposals = lazy(() => import('./pages/Allproposals'))
const Analytics = lazy(() => import('./pages/Analytics'))
const ChatsPage = lazy(() => import('./pages/ChatsPage'))
const AdminNotification = lazy(() => import('./pages/AdminNotification'))
const GhMasterProposals = lazy(() => import('./pages/GhMasterProposals'))
const GhNotification = lazy(() => import('./pages/GhNotification'))
const UserAccess = lazy(() => import('./pages/AccessControl'))
const Customers = lazy(() => import('./pages/customers'))
const CustomersPremium = lazy(() => import('./pages/CustomersPremium'))
const DocumentGenerate = lazy(() => import('./pages/Document_genrate'))
const Isogenration = lazy(() => import('./pages/isogenration'))

const { Content } = Layout

// Check if user is logged in
function isAuthenticated() {
  try {
    const raw = window.localStorage.getItem('ppm_user')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return Boolean(parsed && (parsed.user_id || parsed.id))
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
  let normalizedUserRole = userRole
  if (userRole === 'role') normalizedUserRole = 'guest'
  if (userRole === 'centre head' || userRole === 'center head') normalizedUserRole = 'ch'
  if (userRole === 'group head') normalizedUserRole = 'gh'

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
  let ProposalsComponent = Allproposals
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
  } else if (basePath === 'guest') {
    ProposalsComponent = Proposals
    ProjectsComponent = Projects
    AnalyticsComponent = Analytics
  }

  return (
    <Layout className="min-h-screen flex flex-col lg:flex-row">
      <Sidebar />
      <Layout
        className="bg-slate-100 min-h-screen transition-all duration-200 lg:ml-[260px] ml-0 flex-1 w-full max-w-full overflow-x-hidden"
      >
        <Content
          className="p-3 sm:p-4 md:p-6 min-h-screen w-full max-w-full overflow-x-hidden"
        >
          <Suspense fallback={
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Spin size="large" tip="Loading page..." />
            </div>
          }>
            <Routes>
              <Route path="proposals" element={<ProposalsComponent />} />
              {normalizedRole !== 'guest' && normalizedRole !== 'director' && (
                <Route path="chats" element={<ChatsPage />} />
              )}
              {isAdmin && (
                <Route path="master-proposals" element={<MasterProposals />} />
              )}
              <Route path="analytics" element={<AnalyticsComponent />} />
              {normalizedRole !== 'director' && (
                <Route path="projects" element={<ProjectsComponent />} />
              )}

              <Route path='gh-master-proposals' element={<GhMasterProposals />} />
              <Route path='gh-notification' element={<GhNotification />} />
              <Route path='document-generate' element={<DocumentGenerate />} />
              <Route path='documents-generate' element={<DocumentGenerate />} />
              <Route path='iso-generation' element={<Isogenration />} />

              {/* Only admins can access configuration */}
              {isAdmin && (
                <>
                  <Route path="overall-analytics" element={<Analytics />} />
                  <Route path="configuration" element={<Configuration />} />
                  <Route path="notification" element={<AdminNotification />} />
                  <Route path="access-control" element={<UserAccess />} />
                  <Route path="customers" element={<CustomersPremium />} />
                  <Route path="customers-premium" element={<CustomersPremium />} />
                </>
              )}

              {/* Catch-all: redirect to proposals */}
              <Route path="*" element={<Navigate to="proposals" replace />} />
            </Routes>
          </Suspense>
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