import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Onboarding() {
  const [onboarders, setOnboarders] = useState([])
  const [stats, setStats] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // Bot Daemon Console states
  const [showConsole, setShowConsole] = useState(false)
  const [printedLogs, setPrintedLogs] = useState([])
  const [isRunningBot, setIsRunningBot] = useState(false)

  // Email Draft Modal States
  const [emailModal, setEmailModal] = useState({
    isOpen: false,
    loading: false,
    sending: false,
    candidateId: null,
    candidateName: '',
    candidateEmail: '',
    subject: '',
    body: '',
    type: 'offer_letter',
    details: {}
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [ob, st, cands] = await Promise.all([
        api.getOnboarding(),
        api.getOnboardingStats(),
        api.getCandidates()
      ])
      setOnboarders(ob)
      setStats(st)
      // Filter candidates to show ONLY hired ones in the "Move to Onboarding" section
      setCandidates(cands.filter(c => c.status === 'hired' || (c.status === 'shortlisted' && c.client_feedback === 'OFFERED')))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleCompleteOnboarding(candidateId) {
    try {
      await api.completeOnboarding(candidateId)
      showToast('Onboarding completed successfully!')
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleOpenEmailModal(ob) {
    setEmailModal({
      isOpen: true,
      loading: true,
      sending: false,
      candidateId: ob.id,
      candidateName: ob.name,
      candidateEmail: ob.email || `${ob.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      subject: '',
      body: '',
      type: 'offer_letter',
      details: {
        role: ob.role
      }
    })

    try {
      const draft = await api.generateEmail(ob.id, 'offer_letter', {
        role: ob.role
      })
      setEmailModal(prev => ({
        ...prev,
        loading: false,
        subject: draft.subject,
        body: draft.body
      }))
    } catch (e) {
      showToast(e.message, 'error')
      setEmailModal(prev => ({ ...prev, isOpen: false, loading: false }))
    }
  }

  async function handleRegenerateEmail() {
    setEmailModal(prev => ({ ...prev, loading: true }))
    try {
      const draft = await api.generateEmail(emailModal.candidateId, emailModal.type, emailModal.details)
      setEmailModal(prev => ({
        ...prev,
        loading: false,
        subject: draft.subject,
        body: draft.body
      }))
      showToast('Offer letter regenerated!')
    } catch (e) {
      showToast(e.message, 'error')
      setEmailModal(prev => ({ ...prev, loading: false }))
    }
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(emailModal.body)
      showToast('Offer letter body copied to clipboard!')
    } catch (e) {
      showToast('Failed to copy text', 'error')
    }
  }

  async function handleSendEmail() {
    setEmailModal(prev => ({ ...prev, sending: true }))
    try {
      await api.sendEmail(emailModal.candidateEmail, emailModal.subject, emailModal.body)
      setEmailModal(prev => ({ ...prev, isOpen: false, sending: false }))
      showToast(`Offer letter successfully dispatched to ${emailModal.candidateEmail}!`)
    } catch (e) {
      showToast(e.message || 'Failed to send email', 'error')
      setEmailModal(prev => ({ ...prev, sending: false }))
    }
  }

  async function handleAddToOnboarding(candidateId) {
    try {
      await api.addToOnboarding(candidateId)
      showToast('Added to onboarding!')
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleToggleTask(taskId) {
    try {
      await api.toggleTask(taskId)
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Live Terminal Onboarding Bot run script animation
  async function handleRunBot() {
    setShowConsole(true)
    setIsRunningBot(true)
    setPrintedLogs(["[PROCESS] Connecting to local provisioning daemon...", "[PROCESS] Spawning Python virtual shell sandbox..."])
    
    try {
      const res = await api.runOnboardingBot()
      const botLogs = res.logs.map(l => l.text)

      let currentLogs = ["[PROCESS] Connecting to local provisioning daemon...", "[PROCESS] Spawning Python virtual shell sandbox..."]
      
      // Feed logs sequentially to animate console execution
      for (let i = 0; i < botLogs.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 350))
        currentLogs = [...currentLogs, botLogs[i]]
        setPrintedLogs(currentLogs)
      }

      await loadData()
      showToast('Automation script executed successfully!')
    } catch (e) {
      setPrintedLogs(prev => [...prev, `[ERROR] Bot process terminated unexpectedly: ${e.message}`])
      showToast('Automation script failed.', 'error')
    } finally {
      setIsRunningBot(false)
    }
  }

  function getAvatarColor(name) {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#34d399', '#22d3ee', '#1e1b4b']
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  function groupTasks(tasks) {
    const groups = {}
    tasks.forEach(t => {
      if (!groups[t.category]) groups[t.category] = []
      groups[t.category].push(t)
    })
    return groups
  }

  const categoryIcons = { equipment: '🖥', access: '🔑', documentation: '📄' }

  if (loading) return <div className="spinner"></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-label">Onboarding</div>
        <h1 className="page-title">Onboarding Tracker</h1>
        <p className="page-desc">Manage the journey of your newest team members.</p>
      </div>

      {/* Add to onboarding */}
      {candidates.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', animation: 'scaleIn .3s ease' }}>
          <div className="card-title" style={{ color: 'var(--blue)' }}>✦ Move to Onboarding</div>
          <p className="card-sub" style={{ marginBottom: '.75rem' }}>Select hired candidates to configure equipment & credentials</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            {candidates.map(c => (
              <button key={c.id} className="btn btn-outline btn-sm" onClick={() => handleAddToOnboarding(c.id)}>
                + {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="two-col">
        <div>
          {/* Onboarding Cards */}
          {onboarders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-text">No one in onboarding yet</div>
                <div className="empty-sub">Hire candidates from the Interviews tab first.</div>
              </div>
            </div>
          ) : (
            onboarders.map(ob => {
              const groups = groupTasks(ob.tasks)
              return (
                <div className="ob-card" key={ob.id}>
                  <div className="ob-header" style={{ position: 'relative' }}>
                    <div className="ob-avatar" style={{ background: getAvatarColor(ob.name) }}>{ob.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="ob-name" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                        {ob.name}
                        <button 
                          className="btn btn-xs btn-outline" 
                          style={{ padding: '.15rem .45rem', fontSize: '.68rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }} 
                          onClick={() => handleOpenEmailModal(ob)}
                        >
                          ✉ Draft Offer
                        </button>
                      </div>
                      <div className="ob-role">{ob.role || 'New Hire'} • {ob.status}</div>
                    </div>
                    <div className="ob-pct" style={{ color: ob.progress >= 80 ? '#34d399' : ob.progress >= 40 ? '#6366f1' : '#f59e0b' }}>
                      {Math.round(ob.progress)}%
                    </div>
                  </div>

                  <div className="ob-progress">
                    <div className="ob-fill" style={{
                      width: `${ob.progress}%`,
                      background: ob.progress >= 80
                        ? 'linear-gradient(90deg, #34d399, #059669)'
                        : ob.progress >= 40
                          ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                          : 'linear-gradient(90deg, #f59e0b, #f97316)'
                    }}></div>
                  </div>

                  {Object.entries(groups).map(([cat, tasks]) => (
                    <div className="ob-section" key={cat}>
                      <div className="ob-section-title">
                        {categoryIcons[cat] || '📋'} {cat.toUpperCase()}
                      </div>
                      {tasks.map(t => (
                        <div className="ob-task" key={t.id} onClick={() => handleToggleTask(t.id)} title="Click to cycle status: Pending -> Done -> Blocked">
                          <span>{t.task_name}</span>
                          {t.status === 'done' && (
                            <span className="ob-done-badge">✓ Done</span>
                          )}
                          {t.status === 'blocked' && (
                            <span className="status-badge status-rejected" style={{ fontSize: '.65rem', padding: '.15rem .45rem', textTransform: 'uppercase' }}>🛑 Blocked</span>
                          )}
                          {t.status === 'pending' && (
                            <span className="ob-pending-badge">◷ Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {Math.round(ob.progress) === 100 && (
                    <button 
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', 
                        marginTop: '1.25rem', 
                        background: 'linear-gradient(90deg, #34d399, #059669)', 
                        borderColor: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }} 
                      onClick={() => handleCompleteOnboarding(ob.id)}
                    >
                      🚀 Finish & Archive Onboarding
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pipeline Stats & Bot */}
        <div>
          {stats && (
            <div className="card" style={{ background: '#f0f0ff', borderColor: '#ddd8ff', marginBottom: '1.5rem' }}>
              <div className="card-title">✦ Pipeline Status</div>
              <div className="pipe-grid" style={{ marginTop: '.75rem' }}>
                <div className="pipe-stat">
                  <div className="pipe-num">{String(stats.to_do_today).padStart(2, '0')}</div>
                  <div className="pipe-lbl">Pending Tasks</div>
                </div>
                <div className="pipe-stat">
                  <div className="pipe-num" style={{ color: '#34d399' }}>{String(stats.completed).padStart(2, '0')}</div>
                  <div className="pipe-lbl">Completed</div>
                </div>
                <div className="pipe-stat">
                  <div className="pipe-num" style={{ color: '#f87171' }}>{String(stats.blocked).padStart(2, '0')}</div>
                  <div className="pipe-lbl">Blocked</div>
                </div>
                <div className="pipe-stat">
                  <div className="pipe-num" style={{ color: '#a855f7' }}>{stats.avg_time}</div>
                  <div className="pipe-lbl">Avg Time</div>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', border: '1px solid #334155' }}>
            <div style={{ fontSize: '.9rem', fontWeight: 800, marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🤖 Onboarding Bot</span>
              <span className="status-badge status-confirmed" style={{ fontSize: '.55rem', padding: '.1rem .4rem', background: '#38bdf822', color: '#38bdf8' }}>Active</span>
            </div>
            <p style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.5, marginBottom: '.9rem' }}>
              Automatically provisions Slack channels, GitHub & LinkedIn Learning access, and generates hardware equipment purchase orders for new hires.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleRunBot} disabled={onboarders.length === 0} style={{ width: '100%' }}>
              Run Provisioning Script →
            </button>
          </div>
        </div>
      </div>

      {/* TERMINAL CONSOLE DAEMON MODAL */}
      {showConsole && (
        <div className="modal-overlay" onClick={() => { if (!isRunningBot) setShowConsole(false) }}>
          <div className="modal" style={{ background: '#020617', border: '1px solid #1e293b', color: '#38bdf8', maxWidth: '650px', fontFamily: 'var(--mono)', borderRadius: '16px', padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '.75rem', marginBottom: '1rem' }}>
              <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '.85rem' }}>🤖 Provisioning Bot Terminal</span>
              {!isRunningBot && (
                <button className="modal-close" onClick={() => setShowConsole(false)} style={{ color: '#94a3b8', background: 'transparent', height: '24px', width: '24px', fontSize: '1.1rem' }}>×</button>
              )}
            </div>
            
            <div style={{
              height: '320px',
              overflowY: 'auto',
              background: '#090d16',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '.72rem',
              lineHeight: '1.6',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: '1px solid #1e293b',
              textAlign: 'left'
            }}>
              {printedLogs.map((log, idx) => {
                let color = '#38bdf8' // info / process
                if (log.includes('[SUCCESS]')) color = '#4ade80' // success
                if (log.includes('[ERROR]')) color = '#f87171' // error
                if (log.includes('[CONGRATS]')) color = '#a78bfa' // completion congrats
                if (log.includes('  [')) color = '#e2e8f0' // sub actions
                return (
                  <div key={idx} style={{ color }}>
                    {log}
                  </div>
                )
              })}
              {isRunningBot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '.7rem', marginTop: '.25rem' }}>
                  <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #1e293b', borderTopColor: '#38bdf8', margin: 0 }}></div>
                  <span>Automating task entries...</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-outline" onClick={() => setShowConsole(false)} disabled={isRunningBot} style={{ background: '#1e293b', color: '#f8fafc', border: 'none', padding: '.5rem 1rem' }}>
                {isRunningBot ? 'Provisioning...' : 'Close Terminal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {emailModal.isOpen && (
        <div className="modal-overlay" onClick={() => !emailModal.sending && setEmailModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" style={{ maxWidth: '650px', background: 'var(--white)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !emailModal.sending && setEmailModal(prev => ({ ...prev, isOpen: false }))} disabled={emailModal.sending}>×</button>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✉</span> AI Offer Letter Draft Composer
            </div>

            {emailModal.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', gap: '1rem' }}>
                <div className="spinner"></div>
                <div style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                  ✦ AI is crafting the formal offer letter...
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">To (Candidate)</label>
                  <input 
                    className="form-input" 
                    type="email" 
                    value={`${emailModal.candidateName} <${emailModal.candidateEmail}>`} 
                    disabled 
                    style={{ background: 'var(--bg)', cursor: 'not-allowed', fontWeight: 600 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    value={emailModal.subject} 
                    onChange={e => setEmailModal(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Enter email subject"
                    disabled={emailModal.sending}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Offer Letter Body</label>
                  <textarea 
                    className="form-input" 
                    value={emailModal.body} 
                    onChange={e => setEmailModal(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Compose the offer letter here..."
                    style={{ minHeight: '280px', fontFamily: 'inherit', fontSize: '.85rem', lineHeight: '1.6', resize: 'vertical' }}
                    disabled={emailModal.sending}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button 
                      className="btn btn-outline" 
                      onClick={handleCopyEmail}
                      disabled={emailModal.sending}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📋 Copy Body
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={handleRegenerateEmail}
                      disabled={emailModal.sending}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      ✦ Regenerate
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                      disabled={emailModal.sending}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSendEmail}
                      disabled={emailModal.sending}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {emailModal.sending ? (
                        <>
                          <div className="spinner" style={{ width: '14px', height: '14px', margin: '0 4px 0 0', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>
                          Sending...
                        </>
                      ) : (
                        'Send Offer Letter →'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
