import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function ClientReview() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Rejection modal states
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [candidateToReject, setCandidateToReject] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('Client Rejected')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const allCands = await api.getCandidates()
      // "approved" status means they passed Tech Panel and are waiting for Client Review
      const reviewCandidates = allCands.filter(c => c.status === 'approved')
      setCandidates(reviewCandidates)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleOffer(candidate) {
    try {
      // The 'offer' action sets status to 'hired' (moving them to onboarding)
      await api.candidateAction(candidate.id, 'offer')
      showToast(`${candidate.name} has been offered and moved to Onboarding!`)
      loadData()
    } catch (e) {
      showToast(e.message || 'Failed to offer candidate', 'error')
    }
  }

  function handleTriggerReject(cand) {
    setCandidateToReject(cand)
    setRejectionReason('Client Rejected')
    setShowRejectModal(true)
  }

  async function confirmReject(isTalentPool) {
    const action = isTalentPool ? 'talent_pool' : 'reject'
    try {
      await api.candidateAction(candidateToReject.id, action, rejectionReason)
      showToast(`Candidate marked as ${isTalentPool ? 'Talent Pool' : 'Rejected'}!`)
      setShowRejectModal(false)
      setCandidateToReject(null)
      loadData()
    } catch (e) {
      showToast(e.message || 'Failed to reject candidate', 'error')
    }
  }

  function getAvatarColor(name) {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#34d399', '#22d3ee', '#1e1b4b']
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) return <div className="spinner"></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-label">Client Review</div>
        <h1 className="page-title">Client Approvals</h1>
        <p className="page-desc">Final review of candidates who successfully passed the technical panel.</p>
      </div>

      <div className="two-col">
        <div style={{ gridColumn: 'span 2' }}>
          {candidates.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">💼</div>
                <div className="empty-text">No Candidates Pending Review</div>
                <div className="empty-sub">Candidates will appear here after they pass the Technical Panel.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {candidates.map(cand => (
                <div className="card" key={cand.id} style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="ob-avatar" style={{ background: getAvatarColor(cand.name), width: '48px', height: '48px', fontSize: '1.25rem' }}>
                      {cand.name.charAt(0)}
                    </div>
                    <div>
                      <div className="cand-name" style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }} onClick={() => window.showCandidateTimeline(cand.id)}>{cand.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--t2)' }}>{cand.role || 'General Position'}</div>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Current Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
                      <span>✓</span> Passed Technical Panel
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--t2)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                      Waiting for final client decision to proceed with official offer generation and onboarding process.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#db2777', borderColor: '#db2777' }}
                      onClick={() => handleOffer(cand)}
                    >
                      Client Accepted
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ flex: 1, display: 'flex', justifyContent: 'center', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                      onClick={() => handleTriggerReject(cand)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span> Reject Candidate
            </div>
            
            <div className="form-group">
              <label className="form-label">Rejection Reason / Notes</label>
              <textarea 
                className="form-input" 
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Client decided to go with another candidate..."
                style={{ minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t1)', marginBottom: '.25rem' }}>Send to Talent Pool?</div>
              <div style={{ fontSize: '.75rem', color: 'var(--t2)', lineHeight: 1.4 }}>
                Did this candidate perform well enough to be considered for future roles, or should they be permanently rejected?
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', borderColor: '#a855f7', color: '#a855f7', background: '#faf5ff', display: 'flex', justifyContent: 'center', gap: '6px' }}
                onClick={() => confirmReject(true)}
              >
                <span>📂</span> Retain in Talent Pool
              </button>
              
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', borderColor: '#fca5a5', color: '#ef4444', background: '#fef2f2', display: 'flex', justifyContent: 'center', gap: '6px' }}
                onClick={() => confirmReject(false)}
              >
                <span>❌</span> Reject Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
