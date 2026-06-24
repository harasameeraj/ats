import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Screening from './pages/Screening'
import Interviews from './pages/Interviews'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Assessment from './pages/Assessment'
import { api } from './api/client'
import './App.css'

const pageNames = {
  '/dashboard': 'Dashboard',
  '/screening': 'AI Screening',
  '/interviews': 'Interviews',
  '/onboarding': 'Onboarding',
  '/settings': 'Settings',
}

function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPage = pageNames[location.pathname] || 'Dashboard'

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  // Notifications states
  const [notifOpen, setNotifOpen] = useState(false)
  const [activities, setActivities] = useState([])
  const [hasNewNotif, setHasNewNotif] = useState(true)

  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  // Fetch activities
  async function fetchActivities() {
    try {
      const data = await api.getActivity()
      setActivities(data)
    } catch (e) {
      console.error(e)
    }
  }

  // Handle bell click
  function handleBellClick() {
    setNotifOpen(!notifOpen)
    setHasNewNotif(false)
    if (!notifOpen) {
      fetchActivities()
    }
  }

  // Fetch all candidates on search focus
  async function handleSearchFocus() {
    try {
      const cands = await api.getCandidates()
      setCandidates(cands)
      setShowSearchDropdown(true)
    } catch (e) {
      console.error(e)
    }
  }

  // Real-time search filter
  function handleSearchChange(e) {
    const val = e.target.value
    setSearchQuery(val)
    if (!val.trim()) {
      setSearchResults([])
      return
    }
    const filtered = candidates.filter(c => 
      c.name.toLowerCase().includes(val.toLowerCase()) ||
      (c.role && c.role.toLowerCase().includes(val.toLowerCase())) ||
      c.status.toLowerCase().includes(val.toLowerCase())
    )
    setSearchResults(filtered)
  }

  // Routing candidate selection
  function handleSelectCandidate(cand) {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchDropdown(false)

    // Route based on status
    if (['uploaded', 'screened', 'shortlisted'].includes(cand.status)) {
      navigate('/screening')
    } else if (cand.status === 'interviewed') {
      navigate('/interviews')
    } else if (['offered', 'onboarded', 'completed'].includes(cand.status)) {
      navigate('/onboarding')
    } else {
      navigate('/screening')
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          Stitch ATS / <span>{currentPage}</span>
        </div>
      </div>
      
      {/* Search Input Container */}
      <div className="topbar-search" style={{ position: 'relative' }}>
        <span className="topbar-search-icon">🔍</span>
        <input 
          placeholder="Search candidates, jobs..." 
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleSearchFocus}
          onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
        />
        <span className="topbar-search-kbd">⌘K</span>

        {/* Search Autocomplete Dropdown */}
        {showSearchDropdown && searchQuery.trim() && (
          <div className="search-dropdown-panel" onMouseDown={e => e.preventDefault()}>
            {searchResults.length === 0 ? (
              <div className="search-dropdown-empty">No candidates found matching "{searchQuery}"</div>
            ) : (
              searchResults.map(c => (
                <div 
                  key={c.id} 
                  className="search-dropdown-item" 
                  onClick={() => handleSelectCandidate(c)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="search-cand-name">{c.name}</span>
                    <span className={`status-badge status-${c.status}`} style={{ fontSize: '.6rem', padding: '.15rem .45rem', textTransform: 'uppercase' }}>
                      {c.status}
                    </span>
                  </div>
                  <div className="search-cand-role">{c.role || 'General Position'}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="topbar-right" style={{ position: 'relative' }}>
        <div className="topbar-btn" onClick={toggleTheme} title="Toggle Light/Dark Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </div>
        <div className="topbar-btn" onClick={handleBellClick}>
          🔔
          {hasNewNotif && <div className="notif-dot"></div>}
        </div>
        <div className="topbar-avatar">S</div>

        {/* Notifications Dropdown */}
        {notifOpen && (
          <div className="notif-dropdown-panel" onMouseDown={e => e.preventDefault()}>
            <div className="notif-dropdown-header">
              <span>Notifications</span>
              <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: '.75rem', cursor: 'pointer' }}>Close</button>
            </div>
            <div className="notif-dropdown-list">
              {activities.length === 0 ? (
                <div className="notif-dropdown-empty">No recent activity logs</div>
              ) : (
                activities.slice(0, 8).map(act => (
                  <div key={act.id} className="notif-dropdown-item">
                    <div className="notif-item-icon" style={{ background: `${act.color}15`, color: act.color }}>
                      {act.icon}
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-title">{act.action}</div>
                      <div className="notif-item-desc">{act.description}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const isAssessmentPage = location.pathname.startsWith('/assessment/')

  if (isAssessmentPage) {
    return (
      <Routes>
        <Route path="/assessment/:token" element={<Assessment />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 32 32" fill="none" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="url(#slg)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="slg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs>
            </svg>
            {sidebarOpen && <span className="sidebar-title">Stitch ATS</span>}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◁' : '▷'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/screening" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🤖</span>
            {sidebarOpen && <span>AI Screening</span>}
          </NavLink>
          <NavLink to="/interviews" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📅</span>
            {sidebarOpen && <span>Interviews</span>}
          </NavLink>
          <NavLink to="/onboarding" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">✅</span>
            {sidebarOpen && <span>Onboarding</span>}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </NavLink>
        </nav>

        {sidebarOpen && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">S</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Sameeraj</div>
              <div className="sidebar-user-role">HR Admin</div>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          {sidebarOpen && <span className="sidebar-version">v1.0.0</span>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Topbar />
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/screening" element={<Screening />} />
            <Route path="/interviews" element={<Interviews />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
