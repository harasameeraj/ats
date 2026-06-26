import { useState, useEffect } from 'react'
import { api } from '../api/client'
import WorkflowProgressionTracker from './WorkflowProgressionTracker'

export default function DeliveryDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [toast, setToast] = useState(null)

  // Quality Gate editing state
  const [editingId, setEditingId] = useState(null)
  const [gateForm, setGateForm] = useState({
    tech_fit: 'TBC',
    client_readiness: 'TBC',
    red_flags: '',
    delivery_verdict: 'PENDING'
  })
  const [submittingGate, setSubmittingGate] = useState(false)

  // Scanning states
  const [scanningId, setScanningId] = useState(null)
  const [scanningLinkedinId, setScanningLinkedinId] = useState(null)
  const [githubReport, setGithubReport] = useState(null)
  const [linkedinReport, setLinkedinReport] = useState(null)

  // Panel details state
  const [panelEditingId, setPanelEditingId] = useState(null)
  const [panelForm, setPanelForm] = useState({
    panel_type: 'Client-side tech lead',
    brief_shared: 'No'
  })
  const [submittingPanel, setSubmittingPanel] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const res = await api.getDeliveryDashboard()
      setData(res)
    } catch (e) {
      console.error(e)
      showToast('Failed to load delivery dashboard data', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function startEditGate(cand) {
    setEditingId(cand.id)
    setGateForm({
      tech_fit: cand.tech_fit || 'TBC',
      client_readiness: cand.client_readiness || 'TBC',
      red_flags: cand.red_flags || '',
      delivery_verdict: cand.verdict || 'PENDING'
    })
  }

  async function handleSaveGate(e, candidateId) {
    e.preventDefault()
    setSubmittingGate(true)
    try {
      await api.updateCandidateVerdict(candidateId, gateForm)
      showToast('Quality Gate ratings updated successfully!')
      setEditingId(null)
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to update Quality Gate', 'error')
    } finally {
      setSubmittingGate(false)
    }
  }

  function startEditPanel(iv) {
    setPanelEditingId(iv.id)
    setPanelForm({
      panel_type: iv.panel_type || 'Client-side tech lead',
      brief_shared: iv.brief_shared || 'No'
    })
  }

  async function handleSavePanel(e, interviewId) {
    e.preventDefault()
    setSubmittingPanel(true)
    try {
      await api.updateInterview(interviewId, {
        notes: `Panel: ${panelForm.panel_type} | Brief Shared: ${panelForm.brief_shared}`
      })
      // Trigger a state toggle / database update if the API supports it.
      // Since updateInterview updates standard notes/fields, we can also use our specific endpoint if desired.
      showToast('Interview Panel details updated!')
      setPanelEditingId(null)
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to update interview panel details', 'error')
    } finally {
      setSubmittingPanel(false)
    }
  }

  async function handleToggleBrief(iv) {
    try {
      const nextBrief = iv.brief_shared.startsWith('Yes') ? 'No' : 'Yes — 24 hrs prior'
      await api.updateInterview(iv.id, {
        notes: `Panel: ${iv.panel_type} | Brief Shared: ${nextBrief}`
      })
      showToast(`Updated brief status to: ${nextBrief}`)
      loadDashboard()
    } catch (e) {
      showToast(e.message || 'Failed to toggle brief status', 'error')
    }
  }

  async function handleScanGithub(cand) {
    setScanningId(cand.id)
    try {
      const report = await api.scanGithub(cand.id, cand.github_url)
      setGithubReport(report)
      const updatedUrl = cand.github_url || `https://github.com/${cand.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      setData(prev => {
        const queue = prev.evaluation_queue.map(c => c.id === cand.id ? { ...c, github_url: updatedUrl } : c)
        return { ...prev, evaluation_queue: queue }
      })
    } catch (e) {
      showToast(e.message || "Failed to scan GitHub profile.", "error")
    } finally {
      setScanningId(null)
    }
  }

  async function handleScanLinkedin(cand) {
    setScanningLinkedinId(cand.id)
    try {
      const report = await api.scanLinkedin(cand.id, cand.linkedin_url)
      setLinkedinReport(report)
      const updatedUrl = cand.linkedin_url || `https://linkedin.com/in/${cand.name.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-')}`
      setData(prev => {
        const queue = prev.evaluation_queue.map(c => c.id === cand.id ? { ...c, linkedin_url: updatedUrl } : c)
        return { ...prev, evaluation_queue: queue }
      })
    } catch (e) {
      showToast(e.message || "Failed to scan LinkedIn profile.", "error")
    } finally {
      setScanningLinkedinId(null)
    }
  }

  if (loading) return <div className="spinner"></div>

  const { kpis, funnel, evaluation_queue, interviews, joining_tracker, sla_governance, sla_breach_warning } = data

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      <div className="page-header">
        <div className="page-label">Dashboard</div>
        <h1 className="page-title">Delivery Board</h1>
        <p className="page-desc">Track recruitment SLA metrics, evaluation quality gates, assigned tech panels, and onboarding pipeline.</p>
      </div>

      <WorkflowProgressionTracker 
        selectedStage={
          activeTab === 'queue' || activeTab === 'panel' 
            ? 'tech' 
            : activeTab === 'onboarding' 
              ? 'onboarding' 
              : 'all'
        } 
        onStageSelect={(stage) => {
          if (stage === 'tech') {
            setActiveTab(activeTab === 'queue' ? 'panel' : 'queue')
          } else if (stage === 'onboarding') {
            setActiveTab('onboarding')
          } else {
            setActiveTab('overview')
          }
        }} 
        activeRole="Operational head"
      />

      {/* Tabs Navigation */}
      <div className="tabs-header" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '4px' }}>
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} style={tabStyle(activeTab === 'overview')}>
          📉 Overview & Weekly Funnel
        </button>
        <button className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')} style={tabStyle(activeTab === 'queue')}>
          ⚖️ Quality Gate Review
        </button>
        <button className={`tab-btn ${activeTab === 'panel' ? 'active' : ''}`} onClick={() => setActiveTab('panel')} style={tabStyle(activeTab === 'panel')}>
          🎙️ 2nd Round: Tech Panel Tracker
        </button>
        <button className={`tab-btn ${activeTab === 'onboarding' ? 'active' : ''}`} onClick={() => setActiveTab('onboarding')} style={tabStyle(activeTab === 'onboarding')}>
          🤝 4th Round: Onboarding Tracker
        </button>
      </div>



      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Delivery KPIs */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--blue-bg)' }}>💼</div>
              <div>
                <div className="metric-label">Open Delivery Roles</div>
                <div className="metric-value">{kpis.open_roles}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Demand</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--orange-bg)' }}>⌛</div>
              <div>
                <div className="metric-label">CVs Pending Review</div>
                <div className="metric-value">{kpis.cvs_pending_review}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--orange-bg)', color: '#d97706' }}>Action Needed</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--purple-bg)' }}>📊</div>
              <div>
                <div className="metric-label">Shortlist Rate</div>
                <div className="metric-value">{kpis.shortlist_rate}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>CV approval</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--cyan-bg)' }}>🎤</div>
              <div>
                <div className="metric-label">Interview Conv.</div>
                <div className="metric-value">{kpis.interview_conversion}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>Client Pass</span>
            </div>
            <div className="metric-card">
              <div className="metric-icon-wrap" style={{ background: 'var(--green-bg)' }}>🤝</div>
              <div>
                <div className="metric-label">Offer to Joining</div>
                <div className="metric-value">{kpis.offer_joining}</div>
              </div>
              <span className="metric-badge" style={{ background: 'var(--green-bg)', color: '#059669' }}>Delivery</span>
            </div>
          </div>

          <div className="two-col">
            {/* Visual Conversion Funnel */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1.25rem' }}>Weekly Candidate Conversion Funnel</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <strong>1. Sourced CVs Received</strong>
                    <span>{funnel.received} candidates</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--blue)', width: '100%' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <strong>2. Handoff Approved</strong>
                    <span>{funnel.shortlisted} candidates ({Math.round((funnel.shortlisted/funnel.received)*100)}%)</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--purple)', width: `${(funnel.shortlisted/funnel.received)*100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <strong>3. Client Submissions</strong>
                    <span>{funnel.submitted} candidates ({Math.round((funnel.submitted/funnel.shortlisted)*100)}% of approved)</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--cyan)', width: `${(funnel.submitted/funnel.received)*100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <strong>4. Client Interviews</strong>
                    <span>{funnel.interviewed} candidates ({Math.round((funnel.interviewed/funnel.submitted)*100)}%)</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--orange)', width: `${(funnel.interviewed/funnel.received)*100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <strong>5. Offers Extended</strong>
                    <span>{funnel.offered} candidates ({Math.round((funnel.offered/funnel.interviewed)*100)}%)</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#10b981', width: `${(funnel.offered/funnel.received)*100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Joining Tracker */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Onboarding & Joining Tracker</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {joining_tracker.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--t3)', fontSize: '0.8rem' }}>No offers in onboarding status currently.</div>
                ) : (
                  joining_tracker.map(c => (
                    <div 
                      key={c.id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.85rem 1rem', 
                        borderRadius: '10px', 
                        background: 'var(--bg)', 
                        border: '1px solid var(--border)' 
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--t1)', display: 'block' }}>{c.name}</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>{c.role}</span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: '4px' }}>Offer: {c.offer_date} | Joining: {c.joining_date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="status-badge status-onboarded" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                          {c.status}
                        </span>
                        {c.action_required !== 'None' && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--orange)', fontWeight: 'bold', marginTop: '4px' }}>⚠️ {c.action_required}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quality Gate Review Queue */}
          <div className="card">
            <div className="card-title">Quality Gate Evaluation Queue</div>
            <p className="card-sub">Assess TA candidates, review their GitHub / LinkedIn scan reports, rate quality metrics, and approve/reject handoffs.</p>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Role ID</th>
                    <th>Position Sourced</th>
                    <th>Tech Fit Rating</th>
                    <th>Client Readiness</th>
                    <th>Red Flags</th>
                    <th>Handoff Verdict</th>
                    <th>Scans & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation_queue.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>No candidates awaiting Delivery review in the queue.</td>
                    </tr>
                  ) : (
                    evaluation_queue.map(c => {
                      const isEditing = editingId === c.id
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong style={{ color: 'var(--t1)' }}>{c.name}</strong>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px' }}>
                              {c.role_id}
                            </span>
                          </td>
                          <td><span style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{c.role}</span></td>
                          
                          {/* Tech Fit rating */}
                          <td>
                            {isEditing ? (
                              <select 
                                value={gateForm.tech_fit} 
                                onChange={e => setGateForm(prev => ({ ...prev, tech_fit: e.target.value }))}
                                style={{ padding: '4px', fontSize: '0.75rem', borderRadius: '4px' }}
                              >
                                <option value="Strong">Strong</option>
                                <option value="Good">Good</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Weak">Weak</option>
                                <option value="TBC">TBC</option>
                              </select>
                            ) : (
                              <span style={{ 
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                color: c.tech_fit === 'Strong' ? '#10b981' : c.tech_fit === 'Good' ? '#3b82f6' : c.tech_fit === 'Moderate' ? '#f59e0b' : c.tech_fit === 'Weak' ? '#ef4444' : 'var(--t3)'
                              }}>{c.tech_fit}</span>
                            )}
                          </td>

                          {/* Client Readiness */}
                          <td>
                            {isEditing ? (
                              <select 
                                value={gateForm.client_readiness} 
                                onChange={e => setGateForm(prev => ({ ...prev, client_readiness: e.target.value }))}
                                style={{ padding: '4px', fontSize: '0.75rem', borderRadius: '4px' }}
                              >
                                <option value="High">High</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Low">Low</option>
                                <option value="TBC">TBC</option>
                              </select>
                            ) : (
                              <span style={{ 
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                color: c.client_readiness === 'High' ? '#10b981' : c.client_readiness === 'Moderate' ? '#f59e0b' : c.client_readiness === 'Low' ? '#ef4444' : 'var(--t3)'
                              }}>{c.client_readiness}</span>
                            )}
                          </td>

                          {/* Red Flags */}
                          <td>
                            {isEditing ? (
                              <input 
                                className="form-input"
                                value={gateForm.red_flags} 
                                onChange={e => setGateForm(prev => ({ ...prev, red_flags: e.target.value }))}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', width: '120px' }}
                                placeholder="None"
                              />
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: c.red_flags && c.red_flags !== 'None' ? '#ef4444' : 'var(--t2)' }}>
                                {c.red_flags || 'None'}
                              </span>
                            )}
                          </td>

                          {/* Delivery Verdict */}
                          <td>
                            {isEditing ? (
                              <select 
                                value={gateForm.delivery_verdict} 
                                onChange={e => setGateForm(prev => ({ ...prev, delivery_verdict: e.target.value }))}
                                style={{ padding: '4px', fontSize: '0.75rem', borderRadius: '4px', fontWeight: 'bold' }}
                              >
                                <option value="APPROVED">APPROVED</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="PENDING">PENDING</option>
                                <option value="NOT STARTED">NOT STARTED</option>
                              </select>
                            ) : (
                              <span 
                                className="status-badge"
                                style={{ 
                                  background: c.verdict === 'APPROVED' ? 'var(--green-bg)' : c.verdict === 'REJECTED' ? 'var(--red-bg)' : c.verdict === 'PENDING' ? 'var(--orange-bg)' : 'var(--bg)',
                                  color: c.verdict === 'APPROVED' ? '#059669' : c.verdict === 'REJECTED' ? '#dc2626' : c.verdict === 'PENDING' ? '#d97706' : 'var(--t3)'
                                }}
                              >
                                {c.verdict}
                              </span>
                            )}
                          </td>

                          {/* Scans & Actions */}
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {isEditing ? (
                                <>
                                  <button className="btn btn-primary btn-sm" onClick={e => handleSaveGate(e, c.id)} disabled={submittingGate}>
                                    Save
                                  </button>
                                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                </>
                              ) : (
                                <button className="btn btn-outline btn-sm" onClick={() => startEditGate(c)}>⚙️ Evaluate</button>
                              )}
                              
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => handleScanGithub(c)}
                                disabled={scanningId === c.id}
                                style={{ fontSize: '0.68rem', padding: '4px 8px' }}
                                title="Analyze candidate GitHub coding tenure"
                              >
                                {scanningId === c.id ? '...' : '🐙'} GH
                              </button>
                              
                              <button 
                                className="btn btn-outline btn-sm" 
                                onClick={() => handleScanLinkedin(c)}
                                disabled={scanningLinkedinId === c.id}
                                style={{ fontSize: '0.68rem', padding: '4px 8px', color: '#0a66c2', borderColor: 'rgba(10,102,194,0.2)' }}
                                title="Analyze candidate LinkedIn job stability"
                              >
                                {scanningLinkedinId === c.id ? '...' : '🔗'} LI
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'panel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Tech Panel Tracker */}
          <div className="card">
            <div className="card-title">Technical Panel Interview Tracker</div>
            <p className="card-sub">Track active technical panel schedules, brief document sharing statuses, and interview pass verdicts.</p>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Job Title</th>
                    <th>Interview Panel Type</th>
                    <th>Brief Shared (24h)</th>
                    <th>Date Scheduled</th>
                    <th>Technical Verdict</th>
                    <th>Panel Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>No panel interviews scheduled yet. Book in the Interviews section first.</td>
                    </tr>
                  ) : (
                    interviews.map(iv => {
                      const isPanelEditing = panelEditingId === iv.id
                      return (
                        <tr key={iv.id}>
                          <td><strong>{iv.candidate_name}</strong></td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>{iv.role}</td>
                          
                          {/* Panel Type */}
                          <td>
                            {isPanelEditing ? (
                              <select 
                                value={panelForm.panel_type}
                                onChange={e => setPanelForm(prev => ({ ...prev, panel_type: e.target.value }))}
                                style={{ padding: '4px', fontSize: '0.75rem', borderRadius: '4px' }}
                              >
                                <option value="Client-side tech lead">Client-side tech lead</option>
                                <option value="Infosys SME">Infosys SME</option>
                                <option value="Internal specialist">Internal specialist</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--t2)', fontWeight: 600 }}>{iv.panel_type}</span>
                            )}
                          </td>

                          {/* Brief Shared Toggle */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.78rem', color: iv.brief_shared.startsWith('Yes') ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                                {iv.brief_shared}
                              </span>
                              {!isPanelEditing && (
                                <button 
                                  className="btn btn-outline" 
                                  onClick={() => handleToggleBrief(iv)}
                                  style={{ padding: '2px 6px', fontSize: '0.62rem' }}
                                  title="Toggle Brief status"
                                >
                                  🔄 Toggle
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Date Scheduled */}
                          <td style={{ fontSize: '0.78rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{iv.date}</td>
                          
                          {/* Panel Verdict */}
                          <td>
                            <span 
                              className="status-badge"
                              style={{ 
                                background: iv.verdict === 'PASS' ? 'var(--green-bg)' : iv.verdict === 'REJECTED' || iv.verdict === 'FAIL' ? 'var(--red-bg)' : iv.verdict === 'CONDITIONAL' ? 'var(--orange-bg)' : 'var(--bg)',
                                color: iv.verdict === 'PASS' ? '#059669' : iv.verdict === 'REJECTED' || iv.verdict === 'FAIL' ? '#dc2626' : iv.verdict === 'CONDITIONAL' ? '#d97706' : 'var(--t3)'
                              }}
                            >
                              {iv.verdict}
                            </span>
                          </td>

                          {/* Schedule status */}
                          <td>
                            <span className={`status-badge status-${iv.status.toLowerCase()}`}>{iv.status}</span>
                          </td>

                          {/* Actions */}
                          <td>
                            {isPanelEditing ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn btn-primary btn-sm" onClick={e => handleSavePanel(e, iv.id)} disabled={submittingPanel}>Save</button>
                                <button className="btn btn-outline btn-sm" onClick={() => setPanelEditingId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button className="btn btn-outline btn-sm" onClick={() => startEditPanel(iv)} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                                📋 Assign Panel
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {activeTab === 'onboarding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-title">4th Round: HR & Onboarding Tracker</div>
            <p className="card-sub">Review offered candidates, projected start dates, onboarding access, and background compliance checks.</p>

            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Role Title</th>
                    <th>Offer Extension Date</th>
                    <th>Projected Joining Date</th>
                    <th>HR Hiring Stage</th>
                    <th>Compliance Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {joining_tracker.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>No candidates currently in onboarding.</td>
                    </tr>
                  ) : (
                    joining_tracker.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--t2)' }}>{c.role}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>{c.offer_date}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 'bold' }}>{c.joining_date}</td>
                        <td>
                          <span className="status-badge status-onboarded" style={{ padding: '4px 8px' }}>
                            {c.status}
                          </span>
                        </td>
                        <td>
                          {c.action_required !== 'None' ? (
                            <span style={{ fontSize: '0.74rem', color: 'var(--orange)', fontWeight: 'bold' }}>
                              ⚠️ {c.action_required}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 'bold' }}>
                              ✓ Complete
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                      <span key={idx} style={{ fontSize: '0.72rem', background: 'var(--green-bg)', color: '#059669', padding: '3px 8px', borderRadius: '100px', fontWeight: 600 }}>
                        ✓ {tech}
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
                            background: match.rating.toLowerCase().includes('strong') ? '#e6fbf3' : match.rating.toLowerCase().includes('partial') ? '#fffbeb' : '#fef2f2',
                            color: match.rating.toLowerCase().includes('strong') ? '#10b981' : match.rating.toLowerCase().includes('partial') ? '#d97706' : '#ef4444',
                            border: match.rating.toLowerCase().includes('strong') ? '1px solid #a7f3d0' : match.rating.toLowerCase().includes('partial') ? '1px solid #fde68a' : '1px solid #fca5a5'
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
