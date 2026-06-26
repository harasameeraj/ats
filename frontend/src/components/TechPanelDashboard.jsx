import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function TechPanelDashboard() {
  const [interviews, setInterviews] = useState([])
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Verdict logger form states
  const [selectedIv, setSelectedIv] = useState(null)
  const [verdictForm, setVerdictForm] = useState({
    verdict: 'PASS',
    verdict_notes: ''
  })
  const [submittingVerdict, setSubmittingVerdict] = useState(false)

  // Drawer / View state
  const [viewingCand, setViewingCand] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [ivs, cands, jbs] = await Promise.all([
        api.getInterviews(),
        api.getCandidates(),
        api.getJobs()
      ])
      
      // Let's filter out interviews or format them nicely
      // Get detailed candidate associations
      const formatted = ivs.map(iv => {
        const cand = cands.find(c => c.id === iv.candidate_id)
        const job = jbs.find(j => j.title.split(' — ')[0].toLowerCase() === (cand?.role || '').toLowerCase())
        return {
          ...iv,
          resume_filename: cand?.resume_filename,
          resume_text: cand?.resume_text,
          jd_filename: job?.jd_filename,
          jd_description: job?.description,
          linkedin_url: cand?.linkedin_url,
          github_url: cand?.github_url,
          assessment_score: cand?.assessment_score,
          assessment_violations: cand?.assessment_violations
        }
      })
      
      setInterviews(formatted)
      setCandidates(cands)
      setJobs(jbs)
    } catch (e) {
      console.error(e)
      showToast('Failed to load technical panel interviews', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openVerdictModal(iv) {
    setSelectedIv(iv)
    setVerdictForm({
      verdict: iv.verdict || 'PASS',
      verdict_notes: iv.notes || ''
    })
  }

  async function handleSubmitVerdict(e) {
    e.preventDefault()
    setSubmittingVerdict(true)
    try {
      await api.updateInterviewVerdict(selectedIv.id, {
        verdict: verdictForm.verdict,
        verdict_notes: verdictForm.verdict_notes
      })
      showToast('Technical panel verdict logged successfully!')
      setSelectedIv(null)
      loadData()
    } catch (e) {
      showToast(e.message || 'Failed to submit panel verdict', 'error')
    } finally {
      setSubmittingVerdict(false)
    }
  }

  async function handleDeleteInterview(interviewId) {
    if (!window.confirm("Are you sure you want to delete this interview?")) return
    try {
      await api.deleteInterview(interviewId)
      showToast('Interview deleted successfully!')
      loadData()
    } catch (e) {
      showToast(e.message || 'Failed to delete interview', 'error')
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  if (loading) return <div className="spinner"></div>

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      <div className="page-header">
        <div className="page-label">Technical Evaluator Portal</div>
        <h1 className="page-title">My Scheduled Interviews</h1>
        <p className="page-desc">Download candidate CV / JD briefs 24 hours prior, review screening scores, and submit panel pass/conditional/fail verdicts.</p>
      </div>

      <div className="card">
        <div className="card-title">Assigned Interview Backlog</div>
        <p className="card-sub">Submit structured notes and final hiring recommendations for candidate assessments.</p>

        <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
          <table className="results-table">
            <thead>
              <tr>
                <th>Candidate Details</th>
                <th>Assigned Interviewer</th>
                <th>Schedule Date & Time</th>
                <th>SLA Document Briefs (24h)</th>
                <th>Assessment & Viols</th>
                <th>Current Tech Verdict</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--t3)' }}>No technical interviews scheduled or assigned to your panel.</td>
                </tr>
              ) : (
                interviews.map(iv => (
                  <tr key={iv.id}>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--t1)', cursor: 'pointer' }} onClick={() => setViewingCand(iv)}>
                          {iv.candidate_name} 🔍
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: '2px' }}>{iv.candidate_role || 'General Position'}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{iv.interviewer_name}</span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '0.78rem', color: 'var(--blue)' }}>{formatDate(iv.scheduled_at)}</strong>
                        <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: '2px' }}>⏱️ {formatTime(iv.scheduled_at)} ({iv.duration_mins} mins)</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {iv.resume_filename ? (
                          <a 
                            href={`http://localhost:8000/uploads/cv_${iv.resume_filename}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ fontSize: '0.74rem', color: 'var(--blue)', fontWeight: 'bold', textDecoration: 'none' }}
                          >
                            📄 Download CV ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--t3)' }}>No CV file</span>
                        )}
                        {iv.jd_filename ? (
                          <a 
                            href={`http://localhost:8000/uploads/jd_${iv.jd_filename}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ fontSize: '0.74rem', color: 'var(--purple)', fontWeight: 'bold', textDecoration: 'none' }}
                          >
                            💼 Download JD ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--t3)' }}>No JD file</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '0.78rem' }}>
                          {iv.assessment_score !== null ? `${iv.assessment_score}%` : 'N/A'}
                        </strong>
                        {iv.assessment_violations > 0 && (
                          <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 'bold', marginTop: '2px' }}>
                            ⚠️ {iv.assessment_violations} Tab Switches
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ 
                          background: iv.verdict === 'PASS' ? 'var(--green-bg)' : iv.verdict === 'REJECTED' || iv.verdict === 'FAIL' ? 'var(--red-bg)' : iv.verdict === 'CONDITIONAL' ? 'var(--orange-bg)' : 'var(--bg)',
                          color: iv.verdict === 'PASS' ? '#059669' : iv.verdict === 'REJECTED' || iv.verdict === 'FAIL' ? '#dc2626' : iv.verdict === 'CONDITIONAL' ? '#d97706' : 'var(--t3)'
                        }}
                      >
                        {iv.verdict || 'PENDING'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${iv.status.toLowerCase()}`}>{iv.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => openVerdictModal(iv)}>
                          ⚖️ Log Verdict
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setViewingCand(iv)} style={{ fontSize: '0.65rem' }}>
                          🔍 Inspect
                        </button>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={() => handleDeleteInterview(iv.id)} 
                          style={{ fontSize: '0.65rem', borderColor: '#ef4444', color: '#ef4444' }}
                          title="Delete Interview"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Inspection Drawer/Modal */}
      {viewingCand && (
        <div className="modal-overlay" onClick={() => setViewingCand(null)}>
          <div className="modal" style={{ maxWidth: '700px', padding: '2rem', background: 'var(--white)' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setViewingCand(null)}>×</button>
            
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>{viewingCand.candidate_name}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 600 }}>{viewingCand.candidate_role}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Social profiles</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.8rem' }}>
                    {viewingCand.github_url ? <a href={viewingCand.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 'bold' }}>GitHub ↗</a> : 'No GitHub link'}
                    <span>•</span>
                    {viewingCand.linkedin_url ? <a href={viewingCand.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#0a66c2', fontWeight: 'bold' }}>LinkedIn ↗</a> : 'No LinkedIn link'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--t3)', textTransform: 'uppercase', fontWeight: 'bold' }}>Interviewer Assignee</span>
                  <div style={{ fontSize: '0.82rem', fontWeight: 'bold', marginTop: '6px', color: 'var(--t1)' }}>{viewingCand.interviewer_name}</div>
                </div>
              </div>

              {viewingCand.resume_text && (
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--t1)', display: 'block', marginBottom: '6px' }}>Resume Text Snapshot</strong>
                  <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '8px', fontSize: '0.74rem', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', fontFamily: 'var(--mono)', border: '1px solid var(--border)' }}>
                    {viewingCand.resume_text}
                  </div>
                </div>
              )}

              {viewingCand.notes && (
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--t1)', display: 'block', marginBottom: '4px' }}>Interview Verdict Notes</strong>
                  <p style={{ fontSize: '0.78rem', color: 'var(--t2)', background: 'var(--orange-bg)', padding: '0.75rem', borderRadius: '8px', margin: 0 }}>
                    {viewingCand.notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setViewingCand(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Verdict Modal */}
      {selectedIv && (
        <div className="modal-overlay" onClick={() => setSelectedIv(null)}>
          <div className="modal" style={{ maxWidth: '550px', padding: '2rem', background: 'var(--white)' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedIv(null)}>×</button>
            <div className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>
              ⚖️ Log Tech Panel Verdict: {selectedIv.candidate_name}
            </div>

            <form onSubmit={handleSubmitVerdict} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Hiring Verdict</label>
                <select 
                  className="form-input" 
                  value={verdictForm.verdict} 
                  onChange={e => setVerdictForm(prev => ({ ...prev, verdict: e.target.value }))}
                  style={{ cursor: 'pointer', fontWeight: 'bold' }}
                >
                  <option value="PASS">🟢 PASS (Candidate meets all technical requirements)</option>
                  <option value="CONDITIONAL">🟡 CONDITIONAL PASS (Approved with training/tenure gaps)</option>
                  <option value="FAIL">🔴 FAIL (Does not meet required baseline)</option>
                  <option value="PENDING">⚪ PENDING (Further evaluation required)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Verdict Feedback Notes</label>
                <textarea 
                  className="form-input" 
                  value={verdictForm.verdict_notes} 
                  onChange={e => setVerdictForm(prev => ({ ...prev, verdict_notes: e.target.value }))}
                  placeholder="Summarize candidate technical fit, strengths, weaknesses, and rationale for verdict."
                  rows="5"
                  required
                  style={{ resize: 'vertical' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button className="btn btn-outline" type="button" onClick={() => setSelectedIv(null)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={submittingVerdict}>
                  {submittingVerdict ? 'Submitting...' : '💾 Save Panel Verdict'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
