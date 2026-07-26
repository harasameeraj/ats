import React, { useState, useEffect } from 'react'
import { api, BASE_URL } from '../api/client'

export default function GlobalCandidateTimelineModal({ candidateId, onClose }) {
  const [candidate, setCandidate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [notes, setNotes] = useState([])
  const [newNoteText, setNewNoteText] = useState('')
  const [modalTab, setModalTab] = useState('journey')

  useEffect(() => {
    if (!candidateId) return
    loadCandidateData()
  }, [candidateId])

  async function loadCandidateData() {
    setLoading(true)
    setTimeline([])
    setNotes([])
    try {
      // 1. Fetch Candidate details
      const candData = await api.getCandidateDetails(candidateId)
      setCandidate(candData)
      
      // 2. Fetch Timeline
      setTimelineLoading(true)
      try {
        const timelineData = await api.getCandidateTimeline(candidateId)
        setTimeline(timelineData || [])
      } catch (err) {
        console.error('Failed to load timeline', err)
      } finally {
        setTimelineLoading(false)
      }

      // 3. Fetch Notes
      try {
        const notesData = await api.getCandidateNotes(candidateId)
        setNotes(notesData || [])
      } catch (err) {
        console.error('Failed to load notes', err)
      }
    } catch (e) {
      console.error('Failed to load candidate details', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim() || !candidate) return
    try {
      const newNote = await api.addCandidateNote(candidate.candidate_id, newNoteText)
      setNotes(prev => [newNote, ...prev])
      setNewNoteText('')
    } catch (e) {
      alert(e.message || 'Failed to add note')
    }
  }

  function getTierInfo(score) {
    if (score >= 80) {
      return { label: 'Shortlisted', badgeClass: 'status-shortlisted' }
    } else if (score >= 60) {
      return { label: 'Review Needed', badgeClass: 'status-pending' }
    } else {
      return { label: 'Rejected', badgeClass: 'status-rejected' }
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return 'var(--green)'
    if (score >= 60) return 'var(--orange)'
    return 'var(--red)'
  }

  if (!candidateId) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal" 
        style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', animation: 'scaleIn 0.25s ease' }} 
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>×</button>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--t3)', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>Loading candidate journey details...</span>
          </div>
        ) : !candidate ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--red)' }}>
            <span>Candidate profile could not be loaded.</span>
          </div>
        ) : (
          <>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <span>🔍 Review: {candidate.candidate_name}</span>
              <span className={`status-badge ${getTierInfo(candidate.match_score).badgeClass}`}>
                {Math.round(candidate.match_score)}% Match
              </span>
            </div>

            <div className="two-col" style={{ marginTop: '.5rem', flex: 1, maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Left Column: AI analysis */}
              <div>
                {/* Detailed Score Breakdown */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  background: 'var(--card-h)',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>JD vs CV</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--blue)', margin: '0.2rem 0' }}>
                      {candidate.jd_vs_cv_score !== undefined && candidate.jd_vs_cv_score !== null ? `${Math.round(candidate.jd_vs_cv_score)}%` : 'N/A'}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--blue)', width: candidate.jd_vs_cv_score !== undefined && candidate.jd_vs_cv_score !== null ? `${candidate.jd_vs_cv_score}%` : '0%' }}></div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>JD vs LinkedIn</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple)', margin: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px' }}>
                      {candidate.jd_vs_linkedin_score !== undefined && candidate.jd_vs_linkedin_score !== null ? `${Math.round(candidate.jd_vs_linkedin_score)}%` : <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t3)', lineHeight: 1.2 }}>No LinkedIn link in resume</span>}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--purple)', width: candidate.jd_vs_linkedin_score !== undefined && candidate.jd_vs_linkedin_score !== null ? `${candidate.jd_vs_linkedin_score}%` : '0%' }}></div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>JD vs GitHub</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', margin: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px' }}>
                      {candidate.jd_vs_github_score !== undefined && candidate.jd_vs_github_score !== null ? `${Math.round(candidate.jd_vs_github_score)}%` : <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t3)', lineHeight: 1.2 }}>No GitHub link in resume</span>}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--green)', width: candidate.jd_vs_github_score !== undefined && candidate.jd_vs_github_score !== null ? `${candidate.jd_vs_github_score}%` : '0%' }}></div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--blue)', fontWeight: 800 }}>Overall Fit Summary</div>
                  <p style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.5, background: 'var(--card-h)', padding: '.75rem', borderRadius: '8px', marginTop: '.25rem' }}>
                    {candidate.overall_summary}
                  </p>
                </div>

                {(candidate.status === 'rejected' || candidate.status === 'talent_pool') && candidate.rejection_reason && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div className="cand-expand-title" style={{ fontSize: '.75rem', color: candidate.status === 'rejected' ? '#ef4444' : 'var(--purple)', fontWeight: 800 }}>
                      {candidate.status === 'rejected' ? '❌ Rejection Details' : '📂 Talent Pool Notes'}
                    </div>
                    <div style={{
                      fontSize: '.8rem',
                      color: 'var(--t1)',
                      lineHeight: 1.6,
                      background: 'rgba(239,68,68,0.07)',
                      border: '1.5px solid rgba(239,68,68,0.25)',
                      padding: '.85rem 1rem',
                      borderRadius: '8px',
                      marginTop: '.25rem'
                    }}>
                      {(() => {
                        const parts = candidate.rejection_reason.split(' — ')
                        const reason = parts[0]
                        const notes = parts.slice(1).join(' — ')
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: notes ? '0.5rem' : 0 }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444' }}>Reason:</span>
                              <span style={{ fontWeight: 700 }}>{reason}</span>
                            </div>
                            {notes && (
                              <div style={{ borderTop: '1px dashed rgba(239,68,68,0.3)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444', marginBottom: '4px' }}>Recruiter Notes:</div>
                                <div style={{ color: 'var(--t2)', fontStyle: 'italic' }}>{notes}</div>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {candidate.score_justification && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--purple)', fontWeight: 800 }}>AI Match Score Justification</div>
                    <div style={{ 
                      fontSize: '.8rem', 
                      color: 'var(--t2)', 
                      lineHeight: 1.5, 
                      background: 'var(--grad-subtle)', 
                      border: '1px solid rgba(4, 120, 87, 0.15)',
                      padding: '.75rem', 
                      borderRadius: '8px', 
                      marginTop: '.25rem',
                      fontStyle: 'italic'
                    }}>
                      💡 {candidate.score_justification}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--green)', fontWeight: 800 }}>Strengths</div>
                  <ul className="cand-expand-list" style={{ marginTop: '.25rem' }}>
                    {candidate.strengths && candidate.strengths.length > 0 ? (
                      candidate.strengths.map((s, idx) => (
                        <li key={idx} className="strength-item" style={{ fontSize: '.8rem' }}>{s}</li>
                      ))
                    ) : (
                      <li style={{ fontSize: '.8rem', color: 'var(--t3)', listStyle: 'none' }}>No specific strengths highlighted.</li>
                    )}
                  </ul>
                </div>

                <div>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--orange)', fontWeight: 800 }}>Areas of Concern / Gaps</div>
                  <ul className="cand-expand-list" style={{ marginTop: '.25rem' }}>
                    {candidate.gaps && candidate.gaps.length > 0 ? (
                      candidate.gaps.map((g, idx) => (
                        <li key={idx} className="gap-item" style={{ fontSize: '.8rem' }}>{g}</li>
                      ))
                    ) : (
                      <li style={{ fontSize: '.8rem', color: 'var(--t3)', listStyle: 'none' }}>No specific gaps identified.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Right Column: Tabbed Resume & Notes */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '.5rem', paddingBottom: '4px' }}>
                  <button 
                    className={`tab-btn ${modalTab === 'journey' ? 'active' : ''}`} 
                    onClick={() => setModalTab('journey')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 650, color: modalTab === 'journey' ? 'var(--blue)' : 'var(--t3)' }}
                  >
                    📅 Journey
                  </button>
                  <button 
                    className={`tab-btn ${modalTab === 'resume' ? 'active' : ''}`} 
                    onClick={() => setModalTab('resume')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 650, color: modalTab === 'resume' ? 'var(--blue)' : 'var(--t3)' }}
                  >
                    📄 Resume
                  </button>
                  <button 
                    className={`tab-btn ${modalTab === 'notes' ? 'active' : ''}`} 
                    onClick={() => setModalTab('notes')}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 650, color: modalTab === 'notes' ? 'var(--blue)' : 'var(--t3)' }}
                  >
                    💬 Notes ({notes.length})
                  </button>
                </div>

                {modalTab === 'journey' ? (
                  <div style={{
                    flex: 1,
                    background: 'var(--card-h)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r)',
                    padding: '1.25rem',
                    maxHeight: '350px',
                    overflowY: 'auto'
                  }}>
                    {timelineLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', color: 'var(--t3)', fontSize: '0.8rem' }}>
                        <span>⏳ Loading journey timeline...</span>
                      </div>
                    ) : timeline.length === 0 ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', color: 'var(--t3)', fontSize: '0.8rem' }}>
                        <span>No timeline events recorded yet.</span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border)', marginLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingY: '0.5rem' }}>
                        {timeline.map((evt, idx) => {
                          let icon = '📋'
                          let color = 'var(--blue)'
                          if (evt.status === 'upcoming') {
                            icon = '⚪'
                            color = '#94a3b8'
                          } else {
                            if (evt.stage === 'uploaded') { icon = '📄'; color = '#60a5fa' }
                            else if (evt.stage === 'screening') { icon = '🤖'; color = '#10b981' }
                            else if (evt.stage === 'assessment_invited') { icon = '✉️'; color = '#f59e0b' }
                            else if (evt.stage === 'assessment_completed') { icon = '📝'; color = '#34d399' }
                            else if (evt.stage === 'interview') { icon = '🎙️'; color = '#8b5cf6' }
                            else if (evt.stage === 'offer') { icon = '🎉'; color = '#ec4899' }
                            else if (evt.stage === 'joining') { icon = '🏁'; color = '#f43f5e' }
                          }

                          const formattedTime = evt.date 
                            ? new Date(evt.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Upcoming'

                          return (
                            <div key={idx} style={{ position: 'relative', opacity: evt.status === 'upcoming' ? 0.65 : 1 }}>
                              {/* Dot Icon */}
                              <div style={{
                                position: 'absolute',
                                left: '-2.15rem',
                                top: '0.1rem',
                                background: color,
                                width: '1.25rem',
                                height: '1.25rem',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                zIndex: 1
                              }}>
                                <span style={{ color: '#fff' }}>{icon}</span>
                              </div>

                              {/* Content */}
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 750, color: 'var(--t1)' }}>{evt.title}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--t3)', fontWeight: 600 }}>{formattedTime}</span>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--t2)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                                  {evt.description}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : modalTab === 'resume' ? (
                  <div style={{
                    flex: 1,
                    background: 'var(--card-h)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r)',
                    padding: '0',
                    fontSize: '.75rem',
                    fontFamily: 'var(--mono)',
                    color: 'var(--t2)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '450px',
                    height: '450px',
                    overflow: 'hidden'
                  }}>
                    {candidate.resume_filename ? (
                      <>
                        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--t1)' }}>Original Document</span>
                          <a href={`${BASE_URL}/uploads/cv_${candidate.resume_filename}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                            Open in New Tab
                          </a>
                        </div>
                        <iframe
                          src={`${BASE_URL}/uploads/cv_${candidate.resume_filename}`}
                          style={{ flex: 1, width: '100%', height: '100%', border: 'none', borderRadius: '0 0 calc(var(--r) - 2px) calc(var(--r) - 2px)' }}
                          title="Resume PDF"
                        />
                      </>
                    ) : (
                      <div style={{ padding: '1rem' }}>Original file not available.</div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '350px', overflowY: 'auto', background: 'var(--card-h)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '1rem' }}>
                    {/* Add note input */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        className="form-input" 
                        value={newNoteText}
                        onChange={e => setNewNoteText(e.target.value)}
                        placeholder="Add recruiter note..."
                        style={{ fontSize: '0.8rem', flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add</button>
                    </div>

                    {/* Notes Feed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                      {notes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '0.75rem', marginTop: '2rem' }}>No recruiter notes yet.</div>
                      ) : (
                        notes.map(n => (
                          <div key={n.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--t3)' }}>
                              <strong>✍️ {n.author}</strong>
                              <span>{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--t1)' }}>{n.content}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="btn btn-outline" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
