import { useState, useEffect } from 'react'
import { api } from '../api/client'
import WorkflowProgressionTracker from './WorkflowProgressionTracker'

export default function RecruitmentDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedStage, setSelectedStage] = useState('all')
  const [toast, setToast] = useState(null)

  // Forms states
  const [activityForm, setActivityForm] = useState({
    date: '',
    activity: 'New candidates sourced',
    role_ids: '',
    detail: '',
    outcome: ''
  })
  const [submittingActivity, setSubmittingActivity] = useState(false)

  const [spendForm, setSpendForm] = useState({
    role_id: '',
    role: '',
    amount: '',
    approver: 'TA Lead'
  })
  const [submittingSpend, setSubmittingSpend] = useState(false)

  // Scanning states
  const [scanningId, setScanningId] = useState(null)
  const [scanningLinkedinId, setScanningLinkedinId] = useState(null)
  const [githubReport, setGithubReport] = useState(null)
  const [linkedinReport, setLinkedinReport] = useState(null)

  const [filterText, setFilterText] = useState('')
  const [viewMode, setViewMode] = useState('board') // 'board' or 'table'
  const [draggedOverCol, setDraggedOverCol] = useState(null)
  
  const [activeRubric, setActiveRubric] = useState(null)
  const [loadingRubricId, setLoadingRubricId] = useState(null)
  const [showRubricModal, setShowRubricModal] = useState(false)

  useEffect(() => {
    loadDashboard()
    // Setup default date for activity form (today's short representation)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const today = new Date()
    setActivityForm(prev => ({
      ...prev,
      date: `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`
    }))
  }, [])

  async function loadDashboard() {
    try {
      const res = await api.getRecruitmentDashboard()
      setData(res)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Failed to load recruitment dashboard data')
      showToast('Failed to load recruitment dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddActivity(e) {
    e.preventDefault()
    if (!activityForm.detail) {
      showToast('Please enter activity details.', 'error')
      return
    }
    setSubmittingActivity(true)
    try {
      await api.addTAActivityLog(activityForm)
      showToast('Outreach activity logged successfully!')
      setActivityForm(prev => ({
        ...prev,
        detail: '',
        outcome: ''
      }))
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to log outreach activity', 'error')
    } finally {
      setSubmittingActivity(false)
    }
  }

  async function handleAddSpend(e) {
    e.preventDefault()
    if (!spendForm.role_id || !spendForm.amount) {
      showToast('Role ID and Amount are required.', 'error')
      return
    }
    setSubmittingSpend(true)
    try {
      const amt = parseFloat(spendForm.amount)
      let level = 'Standard'
      let approver = 'TA Lead'
      if (amt >= 250) {
        level = 'Significant'
        approver = 'Delivery Director'
      } else if (amt >= 100) {
        level = 'Elevated'
        approver = 'Account Lead'
      }

      await api.addSpendRequest({
        role_id: spendForm.role_id,
        role: spendForm.role || 'General Sourcing',
        amount: amt,
        approval_level: level,
        approver: spendForm.approver || approver
      })
      showToast('LinkedIn Sourcing spend request submitted!')
      setSpendForm({
        role_id: '',
        role: '',
        amount: '',
        approver: 'TA Lead'
      })
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to submit spend request', 'error')
    } finally {
      setSubmittingSpend(false)
    }
  }

  async function handleApproveSpend(id) {
    try {
      await api.approveSpendRequest(id)
      showToast('Spend request approved successfully!')
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to approve spend request', 'error')
    }
  }

  async function handleClientFeedbackChange(candidateId, feedback) {
    try {
      await api.updateCandidateVerdict(candidateId, { client_feedback: feedback })
      showToast(`Updated client feedback to ${feedback}`)
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to update feedback', 'error')
    }
  }

  async function handleViewRubric(cand) {
    setLoadingRubricId(cand.id)
    try {
      const rubric = await api.getCandidateRubric(cand.id)
      setActiveRubric(rubric)
      setShowRubricModal(true)
    } catch (e) {
      showToast(e.message || "Failed to load candidate rubric.", "error")
    } finally {
      setLoadingRubricId(null)
    }
  }

  async function handleScanGithub(cand) {
    if (!cand.github_url || !cand.github_url.trim()) {
      showToast("Candidate does not have a GitHub profile URL.", "error")
      return
    }
    setScanningId(cand.id)
    try {
      const report = await api.scanGithub(cand.id, cand.github_url)
      setGithubReport(report)
      setData(prev => {
        const pipeline = prev.pipeline.map(c => c.id === cand.id ? { ...c, github_analysis: JSON.stringify(report) } : c)
        return { ...prev, pipeline }
      })
    } catch (e) {
      showToast(e.message || "Failed to scan GitHub profile.", "error")
    } finally {
      setScanningId(null)
    }
  }

  async function handleScanLinkedin(cand) {
    if (!cand.linkedin_url || !cand.linkedin_url.trim()) {
      showToast("Candidate does not have a LinkedIn profile URL.", "error")
      return
    }
    setScanningLinkedinId(cand.id)
    try {
      const report = await api.scanLinkedin(cand.id, cand.linkedin_url)
      setLinkedinReport(report)
      setData(prev => {
        const pipeline = prev.pipeline.map(c => c.id === cand.id ? { ...c, linkedin_analysis: JSON.stringify(report) } : c)
        return { ...prev, pipeline }
      })
    } catch (e) {
      showToast(e.message || "Failed to scan LinkedIn profile.", "error")
    } finally {
      setScanningLinkedinId(null)
    }
  }

  const handleDownloadInterviews = () => {
    const headers = ["Candidate Name", "Role", "Time", "Duration (mins)", "Interviewer", "Status"];
    const rows = (data?.today_interviews || []).map(iv => {
      const ivTime = new Date(iv.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return [
        iv.candidate_name,
        iv.candidate_role,
        ivTime,
        iv.duration_mins,
        iv.interviewer_name,
        iv.status
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `today_scheduled_interviews_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJoining = () => {
    const headers = ["Candidate Name", "Role", "Start Date", "Status"];
    const rows = (data?.joining_this_week || []).map(c => [
      c.name,
      c.role,
      c.joining_date,
      c.status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `candidates_joining_this_week_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="spinner"></div>
  if (error || !data) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--t2)' }}>{error || 'No data available'}</div>

  const { kpis, handoff_summary, priorities, pipeline, submissions, spend_logs, activity_logs } = data

  function handleDragStart(e, candidateId) {
    e.dataTransfer.setData('text/plain', candidateId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    if (draggedOverCol !== colId) {
      setDraggedOverCol(colId)
    }
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDraggedOverCol(null)
  }

  async function handleDrop(e, targetStatus) {
    e.preventDefault()
    setDraggedOverCol(null)
    const candidateIdStr = e.dataTransfer.getData('text/plain')
    if (!candidateIdStr) return
    const candidateId = parseInt(candidateIdStr, 10)
    
    const cand = pipeline.find(c => c.id === candidateId)
    if (!cand) return

    try {
      await api.updateCandidateStatus(candidateId, targetStatus)
      showToast(`Moved ${cand.name} to ${targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1)}`)
      window.dispatchEvent(new Event('refreshCandidates'))
      loadDashboard()
    } catch (err) {
      showToast(err.message || "Failed to update candidate stage.", "error")
    }
  }

  const totalCands = pipeline.length
  const linkedinCands = pipeline.filter(c => c.source === 'LinkedIn').length
  const githubCands = totalCands - linkedinCands
  const githubPct = totalCands > 0 ? Math.round((githubCands / totalCands) * 100) : 50
  const linkedinPct = totalCands > 0 ? 100 - githubPct : 50

  const colStages = [
    { id: 'uploaded', title: '📥 Applied', desc: 'New resume files', color: '#3b82f6', bg: '#eff6ff' },
    { id: 'screened', title: '🧠 AI Screened', desc: 'Passed resume scan', color: '#10b981', bg: '#ecfdf5' },
    { id: 'shortlisted', title: '💻 Tech Panel', desc: 'Ready for interview', color: '#8b5cf6', bg: '#f5f3ff' },
    { id: 'delivery_review', title: '⚖️ Delivery Review', desc: 'Op. Head Check', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'approved', title: '💼 Client Review', desc: 'Final HR approval', color: '#db2777', bg: '#fdf2f8' },
    { id: 'offered', title: '👥 Onboarding', desc: 'Hired & offer made', color: '#059669', bg: '#ecfdf5' }
  ]

  const getColCandidates = (colId) => {
    return filteredPipeline.filter(c => {
      const stage = (c.ta_stage || '').toLowerCase()
      const verdict = (c.delivery_verdict || '').toUpperCase()
      
      if (['rejected', 'talent_pool'].includes(stage)) return false
      
      // Onboarding & Hired stages
      if (colId === 'offered') return ['offered', 'hired', 'onboarded', 'completed'].includes(stage)
      
      // Client Review relies on Delivery Verdict being APPROVED
      if (colId === 'approved') return verdict === 'APPROVED' && !['offered', 'hired', 'onboarded', 'completed'].includes(stage)
      
      // If they are already approved, they shouldn't show up in earlier columns
      if (verdict === 'APPROVED') return false
      
      // Delivery Review gets candidates who finished interviews
      if (colId === 'delivery_review') return ['interviewed', 'delivery_review'].includes(stage)
      
      if (colId === 'shortlisted') return stage === 'shortlisted'
      if (colId === 'screened') return stage === 'screened'
      if (colId === 'uploaded') return stage === 'uploaded'
      
      return false
    })
  }

  const filteredPipeline = pipeline.filter(c => 
    (c.name || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (c.role || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (c.role_id || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (c.delivery_verdict || '').toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      <div className="page-header">
        <div className="page-label">Dashboard</div>
        <h1 className="page-title">Recruitment Board</h1>
        <p className="page-desc">Track active sourcing roles, candidate submissions, daily recruiter metrics, and LinkedIn budgets.</p>
      </div>

      <WorkflowProgressionTracker 
        selectedStage={selectedStage} 
        onStageSelect={(stage) => {
          setSelectedStage(stage)
          if (stage !== 'all') {
            setActiveTab('pipeline')
          }
        }} 
        activeRole="Recruiting"
      />

      {/* Tabs Navigation */}
      <div className="tabs-header" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '4px' }}>
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>
          📈 Overview & Priorities
        </button>
        <button className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')} style={tabStyle(activeTab === 'pipeline')}>
          👥 Pipeline & Submissions
        </button>
        <button className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')} style={tabStyle(activeTab === 'activity')}>
          📣 Recruiter Daily Logs
        </button>
        <button className={`tab-btn ${activeTab === 'spend' ? 'active' : ''}`} onClick={() => setActiveTab('spend')} style={tabStyle(activeTab === 'spend')}>
          💳 Sourcing Spend Approval
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sourcing KPIs */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--blue-bg)' }}>💼</div>
              <div>
                <div className="metric-label">Active Sourcing Roles</div>
                <div className="metric-value">{kpis.active_roles}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Live Jobs</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--purple-bg)' }}>👥</div>
              <div>
                <div className="metric-label">Total in Sourcing Pipeline</div>
                <div className="metric-value">{kpis.candidates_in_pipeline}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>Sourced</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--cyan-bg)' }}>⚖️</div>
              <div>
                <div className="metric-label">Sent to Quality Gate</div>
                <div className="metric-value">{kpis.sent_to_delivery_gate}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>Handoffs</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--green-bg)' }}>🚀</div>
              <div>
                <div className="metric-label">Client-Ready Submissions</div>
                <div className="metric-value">{kpis.client_ready_submissions}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--green-bg)', color: '#059669' }}>Approved</span>
            </div>
            <div 
              className="metric-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => document.getElementById('todays-interviews-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="metric-icon-wrap" style={{ background: 'var(--orange-bg)' }}>📅</div>
              <div>
                <div className="metric-label">Today's Scheduled Interviews</div>
                <div className="metric-value">{data.today_interviews ? data.today_interviews.length : 0}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--orange-bg)', color: 'var(--orange)' }}>Today</span>
            </div>
            <div 
              className="metric-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => document.getElementById('joining-this-week-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="metric-icon-wrap" style={{ background: 'var(--blue-bg)' }}>🤝</div>
              <div>
                <div className="metric-label">Candidates Joining This Week</div>
                <div className="metric-value">{data.joining_this_week ? data.joining_this_week.length : 0}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>This Week</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--red-bg)' }}>✉️</div>
              <div>
                <div className="metric-label">Offers Pending</div>
                <div className="metric-value">{kpis.offers_pending || 0}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>Offers</span>
            </div>
          </div>

          <div className="two-col" style={{ alignItems: 'flex-start' }}>
            {/* Visual Gauge and Summary */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1.25rem' }}>Channel Sourcing Split</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Horizontal split bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--blue)' }}>GitHub ({githubPct}%)</span>
                    <span style={{ color: '#0a66c2' }}>LinkedIn ({linkedinPct}%)</span>
                  </div>
                  <div style={{ height: '24px', width: '100%', display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ background: 'var(--blue)', width: `${githubPct}%`, display: githubPct > 0 ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.72rem', fontWeight: 'bold', transition: 'width 0.3s ease' }}>GitHub</div>
                    <div style={{ background: '#0a66c2', width: `${linkedinPct}%`, display: linkedinPct > 0 ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.72rem', fontWeight: 'bold', transition: 'width 0.3s ease' }}>LI</div>
                  </div>
                </div>

                {/* Handoff to Delivery Lead Summary */}
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div className="card-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Delivery Handoff Verdicts</div>
                  <div className="bar-chart" style={{ height: '150px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--blue)', marginBottom: '4px' }}>{handoff_summary.sent}</span>
                      <div style={{ background: 'var(--blue)', width: '32px', height: `${Math.min(100, (handoff_summary.sent / 10) * 100)}px`, borderRadius: '4px 4px 0 0' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: '4px', fontWeight: 600 }}>Sent</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>{handoff_summary.approved}</span>
                      <div style={{ background: '#10b981', width: '32px', height: `${Math.min(100, (handoff_summary.approved / 10) * 100)}px`, borderRadius: '4px 4px 0 0' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: '4px', fontWeight: 600 }}>Approved</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444', marginBottom: '4px' }}>{handoff_summary.rejected}</span>
                      <div style={{ background: '#ef4444', width: '32px', height: `${Math.min(100, (handoff_summary.rejected / 10) * 100)}px`, borderRadius: '4px 4px 0 0' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: '4px', fontWeight: 600 }}>Rejected</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>{handoff_summary.awaiting}</span>
                      <div style={{ background: '#f59e0b', width: '32px', height: `${Math.min(100, (handoff_summary.awaiting / 10) * 100)}px`, borderRadius: '4px 4px 0 0' }}></div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: '4px', fontWeight: 600 }}>Awaiting</span>
                    </div>
                  </div>
                </div>

                {/* Pipeline Stage Distribution */}
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div className="card-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Candidate Pipeline Distribution</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {colStages.map(col => {
                      const count = getColCandidates(col.id).length;
                      const max = pipeline.length > 0 ? pipeline.length : 1;
                      const pct = Math.round((count / max) * 100);
                      return (
                        <div key={col.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', fontWeight: 'bold' }}>
                            <span style={{ color: col.color }}>{col.title}</span>
                            <span style={{ color: 'var(--t2)' }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: col.color, width: `${pct}%`, borderRadius: '100px' }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Sourcing Priority roles */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Active Roles by Sourcing Priority</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {priorities.map(p => (
                  <div 
                    key={p.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.85rem 1rem', 
                      borderRadius: '10px', 
                      background: 'var(--bg)', 
                      border: '1px solid var(--border)',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--t1)' }}>{p.title}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>Role ID: {p.role_id}</span>
                        <span style={{ color: 'var(--border)', fontSize: '0.72rem' }}>•</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Ageing: <strong style={{ color: 'var(--t1)' }}>{p.ageing_days ?? 0}d</strong></span>
                        <span style={{ color: 'var(--border)', fontSize: '0.72rem' }}>•</span>
                        <span 
                          style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 'bold', 
                            color: p.sla_color || '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={`Hiring SLA status for ${p.title}`}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.sla_color || '#10b981', display: 'inline-block' }}></span>
                          {p.sla_status || 'On Track'}
                        </span>
                      </div>
                    </div>
                    <span 
                      style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 'bold', 
                        padding: '4px 10px', 
                        borderRadius: '100px',
                        background: p.priority === 'URGENT' ? 'var(--red-bg)' : p.priority === 'HIGH' ? 'var(--orange-bg)' : 'var(--blue-bg)',
                        color: p.priority === 'URGENT' ? '#ef4444' : p.priority === 'HIGH' ? '#d97706' : 'var(--blue)'
                      }}
                    >
                      {p.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: '1.5rem', alignItems: 'flex-start' }}>
            {/* Today's Interviews Card */}
            <div id="todays-interviews-section" className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📅</span> Today's Scheduled Interviews
                  </div>
                  <p className="card-sub" style={{ margin: 0 }}>Review all candidate panel discussions booked for today.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {data.today_interviews && data.today_interviews.length > 5 && (
                    <button 
                      onClick={handleDownloadInterviews}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Download interviews list as Excel/CSV"
                    >
                      📥 Download Excel
                    </button>
                  )}
                  <span className="status-badge status-confirmed" style={{ fontWeight: 'bold' }}>
                    {data.today_interviews ? data.today_interviews.length : 0} Today
                  </span>
                </div>
              </div>

              {!data.today_interviews || data.today_interviews.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', background: 'var(--bg)', borderRadius: '10px' }}>
                  <div className="empty-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☕</div>
                  <div className="empty-text" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--t2)' }}>No interviews scheduled for today</div>
                  <div className="empty-sub" style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Enjoy the quiet day, or schedule new ones from the Interviews page.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {data.today_interviews.map(iv => {
                    const ivTime = new Date(iv.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    return (
                      <div 
                        key={iv.id} 
                        style={{ 
                          background: 'var(--bg)', 
                          border: '1px solid var(--border)', 
                          borderRadius: '10px', 
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div className="cand-name" style={{ fontSize: '0.85rem' }} onClick={() => window.showCandidateTimeline(iv.candidate_id)}>{iv.candidate_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: '2px' }}>{iv.candidate_role}</div>
                          </div>
                          <span className={`status-badge status-${iv.status}`} style={{ fontSize: '0.62rem' }}>
                            {iv.status}
                          </span>
                        </div>
                        
                        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--t2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>⏱️</span> <strong>{ivTime}</strong> ({iv.duration_mins} mins)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🎙️</span> Panel: {iv.interviewer_name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Candidates Joining This Week Card */}
            <div id="joining-this-week-section" className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🤝</span> Candidates Joining This Week
                  </div>
                  <p className="card-sub" style={{ margin: 0 }}>Active offers scheduled to start work this week.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {data.joining_this_week && data.joining_this_week.length > 5 && (
                    <button 
                      onClick={handleDownloadJoining}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="Download joining candidates list as Excel/CSV"
                    >
                      📥 Download Excel
                    </button>
                  )}
                  <span className="status-badge status-onboarded" style={{ fontWeight: 'bold' }}>
                    {data.joining_this_week ? data.joining_this_week.length : 0} New Starts
                  </span>
                </div>
              </div>

              {!data.joining_this_week || data.joining_this_week.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', background: 'var(--bg)', borderRadius: '10px' }}>
                  <div className="empty-icon" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💼</div>
                  <div className="empty-text" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--t2)' }}>No joining scheduled this week</div>
                  <div className="empty-sub" style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Check onboarding pipeline for future start dates.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {data.joining_this_week.map(c => (
                    <div 
                      key={c.id} 
                      style={{ 
                        background: 'var(--bg)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '10px', 
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                      <div>
                        <strong className="cand-name" style={{ fontSize: '0.85rem' }} onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: '2px' }}>{c.role}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--blue)', marginTop: '4px', fontWeight: 600 }}>Start Date: {c.joining_date}</div>
                      </div>
                      <span className="status-badge status-onboarded" style={{ fontSize: '0.62rem' }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>Hiring Stages & Rounds Tracker</h2>
              <p className="card-sub" style={{ margin: 0 }}>Candidates progress sequentially from AI screening through technical evaluation to client review and onboarding.</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--sidebar-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button 
                  onClick={() => setViewMode('board')} 
                  style={{
                    background: viewMode === 'board' ? 'var(--white)' : 'none',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: viewMode === 'board' ? 'var(--blue)' : 'var(--t2)',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'board' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  📋 Board View
                </button>
                <button 
                  onClick={() => setViewMode('table')} 
                  style={{
                    background: viewMode === 'table' ? 'var(--white)' : 'none',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: viewMode === 'table' ? 'var(--blue)' : 'var(--t2)',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'table' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  📊 Table View
                </button>
              </div>

              <input 
                className="form-input" 
                placeholder="🔍 Filter candidates..." 
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ maxWidth: '200px', fontSize: '0.8rem', padding: '0.5rem 0.85rem', borderRadius: '100px' }}
              />
            </div>
          </div>

          {/* Kanban Board View */}
          {viewMode === 'board' && (
            <div className="kanban-board">
              {colStages.map(col => {
                const colCands = getColCandidates(col.id)
                const isOver = draggedOverCol === col.id
                
                return (
                  <div 
                    key={col.id} 
                    className={`kanban-col ${isOver ? 'is-dragging-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    {/* Column Header */}
                    <div className="kanban-col-header">
                      <div className="kanban-col-title-area">
                        <span className="kanban-col-title">{col.title}</span>
                        <span className="kanban-col-desc">{col.desc}</span>
                      </div>
                      <span className="kanban-col-count">
                        {colCands.length}
                      </span>
                    </div>

                    {/* Cards Container */}
                    <div className="kanban-cards-container">
                      {colCands.length === 0 ? (
                        <div className="kanban-empty-placeholder">
                          Drag candidate here
                        </div>
                      ) : (
                        colCands.map(c => (
                          <div 
                            key={c.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, c.id)}
                            className="kanban-card"
                          >
                            {/* Candidate Info */}
                            <div className="kanban-card-header">
                              <span className="kanban-card-name" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</span>
                              <span className="kanban-card-role-id">
                                {c.role_id}
                              </span>
                            </div>
                            
                            <div className="kanban-card-role">{c.role}</div>

                            {/* Sourcing Source Badge */}
                            <div className="kanban-card-meta">

                              <span className={`status-badge status-${(c.ta_stage || '').toLowerCase()}`}>
                                {c.ta_stage}
                              </span>
                            </div>

                            {/* Context-based Actions */}
                            <div className="kanban-card-actions">
                              {col.id === 'uploaded' && c.github_url && c.github_url.trim() !== "" && c.github_url.trim() !== "N/A" && (
                                <button className="btn btn-outline btn-sm btn-full" onClick={() => handleScanGithub(c)} disabled={scanningId === c.id}>
                                  🐙 Scan Github
                                </button>
                              )}
                              {col.id === 'screened' && ((c.github_url && c.github_url.trim() !== "" && c.github_url.trim() !== "N/A") || (c.linkedin_url && c.linkedin_url.trim() !== "" && c.linkedin_url.trim() !== "N/A")) && (
                                <div className="kanban-actions-row">
                                  {c.github_url && c.github_url.trim() !== "" && c.github_url.trim() !== "N/A" && (
                                    <button className="btn btn-outline btn-sm" onClick={() => handleScanGithub(c)} disabled={scanningId === c.id}>
                                      🐙 GH
                                    </button>
                                  )}
                                  {c.linkedin_url && c.linkedin_url.trim() !== "" && c.linkedin_url.trim() !== "N/A" && (
                                    <button className="btn btn-outline btn-sm btn-linkedin" onClick={() => handleScanLinkedin(c)} disabled={scanningLinkedinId === c.id}>
                                      🔗 LI
                                    </button>
                                  )}
                                </div>
                              )}
                              {col.id === 'shortlisted' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                  <button className="btn btn-outline btn-sm btn-full" onClick={() => showToast('Redirecting to My Interviews panel to log verdicts.', 'info')}>
                                    🗓️ Schedule / Evaluate
                                  </button>
                                  <button 
                                    className="btn btn-outline btn-sm btn-full" 
                                    style={{ color: 'var(--brand-green)', borderColor: 'rgba(4, 120, 87, 0.15)' }} 
                                    onClick={() => handleViewRubric(c)}
                                    disabled={loadingRubricId === c.id}
                                  >
                                    {loadingRubricId === c.id ? '🎙️ Generating...' : '🎙️ View Rubric'}
                                  </button>
                                </div>
                              )}
                              {col.id === 'approved' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                  <span className="kanban-badge-success" style={{ marginBottom: '2px' }}>
                                    ✅ Approved by Delivery
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.62rem', color: 'var(--t3)', whiteSpace: 'nowrap' }}>Client:</span>
                                    <select
                                      className="form-input form-select"
                                      style={{ padding: '1px 6px', fontSize: '0.68rem', width: '100%', margin: 0, height: 'auto', cursor: 'pointer' }}
                                      value={c.client_feedback || 'UNDER REVIEW'}
                                      onChange={e => handleClientFeedbackChange(c.id, e.target.value)}
                                    >
                                      <option value="UNDER REVIEW">UNDER REVIEW</option>
                                      <option value="OFFERED">OFFERED</option>
                                      <option value="REJECTED">REJECTED</option>
                                      <option value="HOLD">HOLD</option>
                                    </select>
                                  </div>
                                </div>
                              )}
                              {col.id === 'offered' && (
                                <span className="kanban-badge-pink">
                                  👥 Hired & Onboarding
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Original Table View */}
          {viewMode === 'table' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* 1st Round Section */}
              {(selectedStage === 'all' || selectedStage === 'screening') && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div className="card-title" style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🤖</span> 1st Round: Sourcing & AI Screening
                      </div>
                      <p className="card-sub" style={{ margin: 0 }}>Candidates currently undergoing automated resume parsing, AI screening, and skills tests.</p>
                    </div>
                    <span className="status-badge status-uploaded" style={{ fontWeight: 'bold' }}>
                      {filteredPipeline.filter(c => ['uploaded', 'screened'].includes((c.ta_stage || '').toLowerCase())).length} Active
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Job Code</th>
                          <th>Position Sourced</th>
                          <th>Source</th>
                          <th>Screening Stage</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPipeline.filter(c => ['uploaded', 'screened'].includes((c.ta_stage || '').toLowerCase())).length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--t3)', fontSize: '0.8rem' }}>No candidates currently in 1st Round.</td>
                          </tr>
                        ) : (
                          filteredPipeline.filter(c => ['uploaded', 'screened'].includes((c.ta_stage || '').toLowerCase())).map(c => (
                            <tr key={c.id}>
                              <td><div className="cand-name" onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</div></td>
                              <td>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--t2)', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {c.role_id}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{c.role}</td>
                              <td style={{ fontSize: '0.78rem', color: c.source === 'LinkedIn' ? '#0a66c2' : '#333333', fontWeight: 600 }}>
                                {c.source === 'LinkedIn' ? '🔗 LinkedIn' : '🐙 GitHub'}
                              </td>
                              <td>
                                <span className={`status-badge status-${(c.ta_stage || '').toLowerCase()}`}>{c.ta_stage}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {c.github_url && c.github_url.trim() !== "" && c.github_url.trim() !== "N/A" && (
                                    <button className="btn btn-outline btn-sm" onClick={() => handleScanGithub(c)} disabled={scanningId === c.id} style={{ padding: '3px 6px', fontSize: '0.65rem' }}>
                                      {scanningId === c.id ? '...' : '🐙'} Scan Github
                                    </button>
                                  )}
                                  {c.linkedin_url && c.linkedin_url.trim() !== "" && c.linkedin_url.trim() !== "N/A" && (
                                    <button className="btn btn-outline btn-sm" onClick={() => handleScanLinkedin(c)} disabled={scanningLinkedinId === c.id} style={{ padding: '3px 6px', fontSize: '0.65rem', color: '#0a66c2', borderColor: 'rgba(10,102,194,0.2)' }}>
                                      {scanningLinkedinId === c.id ? '...' : '🔗'} Scan LinkedIn
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2nd Round Section */}
              {(selectedStage === 'all' || selectedStage === 'tech') && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div className="card-title" style={{ color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🎙️</span> 2nd Round: Internal Technical Panel & Quality Gate
                      </div>
                      <p className="card-sub" style={{ margin: 0 }}>Candidates undergoing technical evaluation, coding checks, and Delivery Quality Gate reviews.</p>
                    </div>
                    <span className="status-badge status-pending" style={{ fontWeight: 'bold' }}>
                      {filteredPipeline.filter(c => ['shortlisted', 'interviewed'].includes((c.ta_stage || '').toLowerCase()) && c.delivery_verdict !== 'APPROVED' && c.delivery_verdict !== 'REJECTED').length} Active
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Job Code</th>
                          <th>Position Sourced</th>
                          <th>Interviewer Notes</th>
                          <th>Verdict Log</th>
                          <th>HR Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPipeline.filter(c => ['shortlisted', 'interviewed'].includes((c.ta_stage || '').toLowerCase()) && c.delivery_verdict !== 'APPROVED' && c.delivery_verdict !== 'REJECTED').length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--t3)', fontSize: '0.8rem' }}>No candidates currently in 2nd Round.</td>
                          </tr>
                        ) : (
                          filteredPipeline.filter(c => ['shortlisted', 'interviewed'].includes((c.ta_stage || '').toLowerCase()) && c.delivery_verdict !== 'APPROVED' && c.delivery_verdict !== 'REJECTED').map(c => (
                            <tr key={c.id}>
                              <td><div className="cand-name" onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</div></td>
                              <td>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--t2)', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {c.role_id}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{c.role}</td>
                              <td style={{ fontSize: '0.72rem', color: 'var(--t3)', maxWidth: '220px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {c.interviewer_notes || 'No notes submitted'}
                              </td>
                              <td>
                                <span className={`status-badge status-${(c.delivery_verdict || 'PENDING').toLowerCase()}`}>
                                  {c.delivery_verdict || 'PENDING'}
                                </span>
                              </td>
                              <td style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => showToast('Manage scheduling in Interviews tab.', 'info')}>
                                  Manage Slot
                                </button>
                                <button 
                                  className="btn btn-outline btn-sm" 
                                  style={{ color: 'var(--brand-green)', borderColor: 'rgba(4, 120, 87, 0.15)' }} 
                                  onClick={() => handleViewRubric(c)}
                                  disabled={loadingRubricId === c.id}
                                >
                                  {loadingRubricId === c.id ? 'Generating...' : '🎙️ Rubric'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3rd Round Section */}
              {(selectedStage === 'all' || selectedStage === 'client') && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div className="card-title" style={{ color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💼</span> 3rd Round: Client Feedback Handoffs
                      </div>
                      <p className="card-sub" style={{ margin: 0 }}>Candidates passed by Delivery Head and submitted to Account Managers / Clients.</p>
                    </div>
                    <span className="status-badge status-confirmed" style={{ fontWeight: 'bold' }}>
                      {filteredPipeline.filter(c => c.delivery_verdict === 'APPROVED' && !['offered', 'hired', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).length} Active
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Job Code</th>
                          <th>Role</th>
                          <th>AM Submitted</th>
                          <th>Client Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPipeline.filter(c => c.delivery_verdict === 'APPROVED' && !['offered', 'hired', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--t3)', fontSize: '0.8rem' }}>No candidates currently in 3rd Round.</td>
                          </tr>
                        ) : (
                          filteredPipeline.filter(c => c.delivery_verdict === 'APPROVED' && !['offered', 'hired', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).map(c => (
                            <tr key={c.id}>
                              <td><div className="cand-name" onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</div></td>
                              <td>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--t2)', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {c.role_id}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{c.role}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>29 May</td>
                              <td>
                                <select
                                  className="form-input form-select"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem', width: 'auto', display: 'inline-block', margin: 0, height: 'auto', cursor: 'pointer' }}
                                  value={c.client_feedback || 'UNDER REVIEW'}
                                  onChange={e => handleClientFeedbackChange(c.id, e.target.value)}
                                >
                                  <option value="UNDER REVIEW">UNDER REVIEW</option>
                                  <option value="OFFERED">OFFERED</option>
                                  <option value="REJECTED">REJECTED</option>
                                  <option value="HOLD">HOLD</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4th Round Section */}
              {(selectedStage === 'all' || selectedStage === 'onboarding') && (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div className="card-title" style={{ color: 'var(--pink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🤝</span> 4th Round: HR / Onboarding pipeline
                      </div>
                      <p className="card-sub" style={{ margin: 0 }}>Hired candidates completed through all evaluations, currently in background check or onboarding flow.</p>
                    </div>
                    <span className="status-badge status-hired" style={{ fontWeight: 'bold' }}>
                      {pipeline.filter(c => ['offered', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).length} Hired
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Job Code</th>
                          <th>Role</th>
                          <th>Onboarding Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipeline.filter(c => ['offered', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--t3)', fontSize: '0.8rem' }}>No candidates currently in 4th Round onboarding.</td>
                          </tr>
                        ) : (
                          pipeline.filter(c => ['offered', 'onboarded', 'completed'].includes((c.ta_stage || '').toLowerCase())).map(c => (
                            <tr key={c.id}>
                              <td><div className="cand-name" onClick={() => window.showCandidateTimeline(c.id)}>{c.name}</div></td>
                              <td>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--t2)', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {c.role_id}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{c.role}</td>
                              <td>
                                <span className={`status-badge status-${(c.ta_stage || '').toLowerCase()}`}>{c.ta_stage}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="two-col" style={{ alignItems: 'flex-start' }}>
          {/* Logger outreach log form */}
          <div className="card">
            <div className="card-title">Log Recruiter outreach activity</div>
            <p className="card-sub">Recruiters submit daily sourcing actions to calculate pipeline velocity statistics.</p>

            <form onSubmit={handleAddActivity} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Activity Date</label>
                <input 
                  className="form-input" 
                  value={activityForm.date} 
                  onChange={e => setActivityForm(prev => ({ ...prev, date: e.target.value }))}
                  placeholder="e.g. Mon 2 Jun"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Activity Type</label>
                <select 
                  className="form-input" 
                  value={activityForm.activity} 
                  onChange={e => setActivityForm(prev => ({ ...prev, activity: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="New candidates sourced">New candidates sourced</option>
                  <option value="CVs sent to Delivery">CVs sent to Delivery</option>
                  <option value="Delivery feedback received">Delivery feedback received</option>
                  <option value="LinkedIn outreach">LinkedIn outreach</option>
                  <option value="Interview coordination">Interview coordination</option>
                  <option value="Weekly pipeline review">Weekly pipeline review</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Role IDs (Optional)</label>
                <input 
                  className="form-input" 
                  value={activityForm.role_ids} 
                  onChange={e => setActivityForm(prev => ({ ...prev, role_ids: e.target.value }))}
                  placeholder="e.g. DR-042, DR-043"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Action details</label>
                <textarea 
                  className="form-input" 
                  value={activityForm.detail} 
                  onChange={e => setActivityForm(prev => ({ ...prev, detail: e.target.value }))}
                  placeholder="Describe your outreach actions, search strings used, candidate names, etc."
                  rows="3"
                  required
                  style={{ resize: 'vertical' }}
                ></textarea>
              </div>

              <div className="form-group">
                <label className="form-label">Outcome (Optional)</label>
                <input 
                  className="form-input" 
                  value={activityForm.outcome} 
                  onChange={e => setActivityForm(prev => ({ ...prev, outcome: e.target.value }))}
                  placeholder="e.g. 8 candidates, 3 CVs sent, 15 messages"
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={submittingActivity} style={{ marginTop: '0.5rem' }}>
                {submittingActivity ? 'Logging Action...' : '📣 Log Daily Activity'}
              </button>
            </form>
          </div>

          {/* Activity Logs Timeline */}
          <div className="card">
            <div className="card-title">Outreach Log History</div>
            <p className="card-sub">Daily audit logs for sourcing channels & coordinator tasks.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '6px' }}>
              {activity_logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>No activity logs yet.</div>
              ) : (
                activity_logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
                    <div style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontWeight: 'bold', fontSize: '0.7rem', padding: '6px', borderRadius: '8px', minWidth: '75px', textAlign: 'center', height: 'fit-content' }}>
                      {log.date}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--t1)' }}>{log.activity}</strong>
                        {log.role_ids && (
                          <span style={{ fontSize: '0.68rem', background: 'var(--bg)', color: 'var(--t3)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--mono)' }}>
                            {log.role_ids}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--t2)', marginTop: '4px', lineHeight: '1.4' }}>{log.detail}</p>
                      {log.outcome && (
                        <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                          🎯 Outcome: {log.outcome}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'spend' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Sourcing Spend Policy Matrix */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--white), var(--blue-bg))', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div className="card-title" style={{ color: 'var(--blue)', fontWeight: 800 }}>LinkedIn Candidate Sourcing Spend Rules Matrix</div>
            <p className="card-sub">Defined governance workflow for candidate outreach budget allocations.</p>
            
            <div className="three-col" style={{ marginTop: '1rem' }}>
              <div style={{ background: 'var(--white)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.25rem' }}>🟢</span>
                <strong style={{ display: 'block', fontSize: '0.82rem', margin: '6px 0 2px' }}>Standard</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>Up to £100 Sourcing Spend</span>
                <div style={{ fontSize: '0.76rem', color: 'var(--t2)', marginTop: '8px', fontWeight: 'bold' }}>TA Lead Approval / Self-Approved</div>
              </div>
              <div style={{ background: 'var(--white)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.25rem' }}>🟡</span>
                <strong style={{ display: 'block', fontSize: '0.82rem', margin: '6px 0 2px' }}>Elevated</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>£100 to £250 Sourcing Spend</span>
                <div style={{ fontSize: '0.76rem', color: 'var(--t2)', marginTop: '8px', fontWeight: 'bold' }}>Account Lead Approval Required</div>
              </div>
              <div style={{ background: 'var(--white)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.25rem' }}>🔴</span>
                <strong style={{ display: 'block', fontSize: '0.82rem', margin: '6px 0 2px' }}>Significant</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>Above £250 Sourcing Spend</span>
                <div style={{ fontSize: '0.76rem', color: 'var(--t2)', marginTop: '8px', fontWeight: 'bold' }}>Delivery Director Approval Required</div>
              </div>
            </div>
          </div>

          <div className="two-col">
            {/* Request budget form */}
            <div className="card">
              <div className="card-title">Request Candidate Sourcing Budget</div>
              <p className="card-sub">Request funds to sponsor inMail campaigns or premium developer database access.</p>

              <form onSubmit={handleAddSpend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Role Job ID</label>
                  <input 
                    className="form-input" 
                    value={spendForm.role_id} 
                    onChange={e => setSpendForm(prev => ({ ...prev, role_id: e.target.value }))}
                    placeholder="e.g. DR-041"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Position / Role Title</label>
                  <input 
                    className="form-input" 
                    value={spendForm.role} 
                    onChange={e => setSpendForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. DevOps lead — Banking"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Amount Required (£)</label>
                  <input 
                    className="form-input" 
                    type="number"
                    value={spendForm.amount} 
                    onChange={e => setSpendForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 150"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Designated Approver (Optional)</label>
                  <input 
                    className="form-input" 
                    value={spendForm.approver} 
                    onChange={e => setSpendForm(prev => ({ ...prev, approver: e.target.value }))}
                    placeholder="e.g. Account Lead"
                  />
                </div>

                <button className="btn btn-primary" type="submit" disabled={submittingSpend} style={{ marginTop: '0.5rem' }}>
                  {submittingSpend ? 'Submitting request...' : '💳 Submit Spend Request'}
                </button>
              </form>
            </div>

            {/* Spend approval logs */}
            <div className="card">
              <div className="card-title">Sourcing Budget Approvals Log</div>
              <p className="card-sub">Budget tracking history. Approve pending requests inline.</p>

              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="results-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Role</th>
                      <th>Amount</th>
                      <th>Level</th>
                      <th>Approver</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spend_logs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>No spend requests found.</td>
                      </tr>
                    ) : (
                      spend_logs.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>{s.role_id}</td>
                          <td><strong>{s.role}</strong></td>
                          <td style={{ fontWeight: 'bold' }}>£{s.amount.toFixed(2)}</td>
                          <td>
                            <span 
                              style={{ 
                                fontSize: '0.65rem', 
                                fontWeight: 'bold', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                background: s.approval_level === 'Significant' ? 'var(--red-bg)' : s.approval_level === 'Elevated' ? 'var(--orange-bg)' : 'var(--blue-bg)',
                                color: s.approval_level === 'Significant' ? '#ef4444' : s.approval_level === 'Elevated' ? '#d97706' : 'var(--blue)'
                              }}
                            >
                              {s.approval_level}
                            </span>
                          </td>
                          <td>{s.approver}</td>
                          <td>
                            <span 
                              className="status-badge"
                              style={{ 
                                background: s.status === 'APPROVED' || s.status === 'SELF-APPROVED' ? 'var(--green-bg)' : 'var(--orange-bg)',
                                color: s.status === 'APPROVED' || s.status === 'SELF-APPROVED' ? '#059669' : '#d97706'
                              }}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td>
                            {s.status === 'PENDING' ? (
                              <button className="btn btn-outline btn-sm" onClick={() => handleApproveSpend(s.id)} style={{ padding: '2px 8px', fontSize: '0.65rem' }}>
                                Approve
                              </button>
                            ) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Technical Rubric Modal */}
      {showRubricModal && activeRubric && (
        <div className="modal-overlay" onClick={() => setShowRubricModal(false)}>
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem', background: 'var(--white)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRubricModal(false)}>×</button>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-green)' }}>
                <span style={{ fontSize: '1.5rem' }}>🎙️</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>
                  Technical Interview Rubric
                </h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--t2)', margin: '6px 0 0' }}>
                AI-Generated cheatsheet for <strong>{activeRubric.candidate_name}</strong> (Candidate) applying for <strong>{activeRubric.role}</strong>.
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '8px' }}>
              {activeRubric.rubrics && activeRubric.rubrics.map((rub, idx) => (
                <div key={idx} className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--t1)', margin: 0, flex: 1 }}>
                      Q{idx + 1}: {rub.question}
                    </h3>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {rub.skills_tested.split(',').map((skill, sIdx) => (
                        <span key={sIdx} className="status-badge" style={{ fontSize: '0.62rem', background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--t2)' }}>
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: '4px' }}>Expected Answer</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--t2)', lineHeight: 1.5 }}>{rub.expected_answer}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: '6px' }}>Grading Criteria</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', alignItems: 'center' }}>
                        <span className="status-badge status-pending" style={{ fontSize: '0.58rem', width: '56px', flexShrink: 0 }}>Pass</span>
                        <span style={{ color: 'var(--t2)' }}>{rub.grading_rubric.pass}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', alignItems: 'center' }}>
                        <span className="status-badge status-screened" style={{ fontSize: '0.58rem', width: '56px', flexShrink: 0 }}>Good</span>
                        <span style={{ color: 'var(--t2)' }}>{rub.grading_rubric.good}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', alignItems: 'center' }}>
                        <span className="status-badge status-shortlisted" style={{ fontSize: '0.58rem', width: '56px', flexShrink: 0 }}>Excellent</span>
                        <span style={{ color: 'var(--t2)' }}>{rub.grading_rubric.excellent}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowRubricModal(false)}>Close Rubric</button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Report Modal */}
      {githubReport && (
        <div className="modal-overlay" onClick={() => setGithubReport(null)}>
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2rem', background: 'var(--white)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setGithubReport(null)}>×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <img src={githubReport.user_info.avatar_url} alt={githubReport.user_info.login} style={{ width: '56px', height: '56px', borderRadius: '50%' }} />
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>{githubReport.user_info.name}</h2>
                <a href={githubReport.user_info.html_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                  @{githubReport.user_info.login} ↗
                </a>
                <p style={{ fontSize: '0.8rem', color: 'var(--t2)', margin: '4px 0 0' }}>{githubReport.user_info.bio || 'No biography provided.'}</p>
                {githubReport.user_info.company && <div style={{ fontSize: '0.75rem', color: 'var(--t3)', marginTop: '4px' }}>🏢 {githubReport.user_info.company}</div>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '8px' }}>
              <div className="four-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', background: 'var(--bg)', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Repositories</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--t1)' }}>{githubReport.user_info.public_repos}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Stars</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f59e0b' }}>⭐ {githubReport.stats.total_stars}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Forks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--blue)' }}>🍴 {githubReport.stats.total_forks}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Followers</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--purple)' }}>👥 {githubReport.user_info.followers}</div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--t1)', display: 'block', marginBottom: '6px' }}>Languages Used</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Object.entries(githubReport.stats.languages).map(([lang, pct]) => (
                    <span key={lang} style={{ fontSize: '0.72rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '3px 8px', borderRadius: '100px', fontWeight: 600 }}>
                      {lang}: {pct}%
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--t1)', display: 'block', marginBottom: '8px' }}>🤖 AI Summary Report</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--t2)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{githubReport.ai_summary}</p>
              </div>

              {githubReport.jd_tech_matches && githubReport.jd_tech_matches.length > 0 && (
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--t1)', display: 'block', marginBottom: '8px' }}>💻 Tech Match Cross-Reference</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {githubReport.jd_tech_matches.map((tech, idx) => (
                      <span key={idx} style={{ fontSize: '0.72rem', background: 'var(--green-bg)', color: '#059669', padding: '3px 8px', borderRadius: '100px', fontWeight: 600 }} title={`${tech.project_name || 'Project'}: ${tech.relation || ''}`}>
                        ✓ {tech.technology || tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setGithubReport(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Report Modal */}
      {linkedinReport && (
        <div className="modal-overlay" onClick={() => setLinkedinReport(null)}>
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2.5rem', background: 'var(--white)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLinkedinReport(null)}>×</button>
            
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', lineHeight: 1.4 }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <span><strong>Demo Mode:</strong> LinkedIn profile data is currently being simulated by AI based on the candidate's Resume for demonstration purposes.</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <img src={linkedinReport.user_info.avatar_url} alt={linkedinReport.user_info.name} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #0a66c2' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>{linkedinReport.user_info.name}</h2>
                  <a href={linkedinReport.user_info.html_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#0a66c2', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    LinkedIn Profile ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--t1)', fontWeight: 700, marginTop: '2px' }}>{linkedinReport.user_info.headline}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--t2)', marginTop: '4px', fontStyle: 'italic' }}>{linkedinReport.user_info.summary || "No personal summary provided."}</div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--t3)', marginTop: '6px', fontWeight: 600 }}>
                  <span>📍 {linkedinReport.user_info.location}</span>
                  <span>•</span>
                  <span>🏢 {linkedinReport.user_info.current_company}</span>
                  <span>•</span>
                  <span style={{ color: '#0a66c2' }}>👥 {linkedinReport.user_info.connections} connections</span>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(10,102,194,0.03), rgba(99,102,241,0.03))', border: '1px solid rgba(10,102,194,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0a66c2', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🤖</span> AI Recruiter Tenure & Suitability Assessment
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--t2)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {linkedinReport.ai_summary}
                </div>
              </div>

              {linkedinReport.jd_matches && linkedinReport.jd_matches.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.85rem' }}>💼 Cross-Reference JD Requirements</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    {linkedinReport.jd_matches.map((match, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--t1)' }}>{match.requirement}</strong>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            background: (match.rating || '').toLowerCase().includes('strong') ? '#e6fbf3' : (match.rating || '').toLowerCase().includes('partial') ? '#fffbeb' : '#fef2f2',
                            color: (match.rating || '').toLowerCase().includes('strong') ? '#10b981' : (match.rating || '').toLowerCase().includes('partial') ? '#d97706' : '#ef4444',
                            border: (match.rating || '').toLowerCase().includes('strong') ? '1px solid #a7f3d0' : (match.rating || '').toLowerCase().includes('partial') ? '1px solid #fde68a' : '1px solid #fca5a5'
                          }}>{match.rating}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}><strong>Matched Role:</strong> {match.matches_role}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)', lineHeight: '1.5' }}>{match.reasoning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.85rem' }}>🏢 Work Experience</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {linkedinReport.experience.map((exp, idx) => (
                    <div key={idx} style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #0a66c2', position: 'relative' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0a66c2', position: 'absolute', left: '-5px', top: '5px' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--t1)' }}>{exp.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--t3)', fontWeight: 600 }}>{exp.duration}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#0a66c2', fontWeight: 600 }}>{exp.company}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginTop: '4px', lineHeight: '1.5' }}>{exp.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setLinkedinReport(null)}>Close Analysis</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

function tabStyle(active) {
  return {
    background: active ? 'var(--blue-bg)' : 'transparent',
    border: 'none',
    borderBottom: active ? '3px solid var(--blue)' : '3px solid transparent',
    color: active ? 'var(--blue)' : 'var(--t2)',
    padding: '10px 16px',
    fontSize: '0.82rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
    borderRadius: '6px 6px 0 0'
  }
}
