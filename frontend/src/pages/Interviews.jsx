import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Interviews() {
  const [interviews, setInterviews] = useState([])
  const [candidates, setCandidates] = useState([])
  const [allCandidates, setAllCandidates] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [suggestions, setSuggestions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

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
    type: 'invitation',
    details: {}
  })

  // Calendar view navigation and selection states
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  // Form state
  const [form, setForm] = useState({
    candidate_id: '', interviewer_name: '', date: '', time: '10:00', duration_mins: 45
  })

  useEffect(() => {
    loadData()
    // Default form date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    setForm(f => ({ ...f, date: `${yyyy}-${mm}-${dd}` }))
  }, [])

  async function loadData() {
    try {
      const [iv, cands] = await Promise.all([api.getInterviews(), api.getCandidates()])
      setInterviews(iv)
      setAllCandidates(cands)
      setCandidates(cands.filter(c => ['shortlisted', 'screened', 'interviewed'].includes(c.status)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleOpenEmailModal(iv) {
    const cand = allCandidates.find(c => c.id === iv.candidate_id)
    const email = cand ? cand.email : `${iv.candidate_name.toLowerCase().replace(/\s+/g, '')}@example.com`
    
    setEmailModal({
      isOpen: true,
      loading: true,
      sending: false,
      candidateId: iv.candidate_id,
      candidateName: iv.candidate_name,
      candidateEmail: email,
      subject: '',
      body: '',
      type: 'invitation',
      details: {
        interviewer_name: iv.interviewer_name,
        date: formatDate(iv.scheduled_at),
        time: formatTime(iv.scheduled_at)
      }
    })

    try {
      const draft = await api.generateEmail(iv.candidate_id, 'invitation', {
        interviewer_name: iv.interviewer_name,
        date: formatDate(iv.scheduled_at),
        time: formatTime(iv.scheduled_at)
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
      showToast('Email regenerated!')
    } catch (e) {
      showToast(e.message, 'error')
      setEmailModal(prev => ({ ...prev, loading: false }))
    }
  }

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(emailModal.body)
      showToast('Email body copied to clipboard!')
    } catch (e) {
      showToast('Failed to copy text', 'error')
    }
  }

  async function handleSendEmail() {
    setEmailModal(prev => ({ ...prev, sending: true }))
    try {
      await new Promise(resolve => setTimeout(resolve, 1200))
      setEmailModal(prev => ({ ...prev, isOpen: false, sending: false }))
      showToast(`Email invitation successfully dispatched to ${emailModal.candidateEmail}!`)
    } catch (e) {
      showToast('Failed to send email', 'error')
      setEmailModal(prev => ({ ...prev, sending: false }))
    }
  }

  async function handleSchedule() {
    if (!form.candidate_id || !form.interviewer_name || !form.date || !form.time) {
      showToast('All fields are required.', 'error')
      return
    }
    try {
      const scheduled_at = `${form.date}T${form.time}:00`
      await api.createInterview({
        candidate_id: parseInt(form.candidate_id),
        interviewer_name: form.interviewer_name,
        scheduled_at,
        duration_mins: parseInt(form.duration_mins)
      })
      showToast('Interview scheduled!')
      setShowModal(false)
      // Reset form keeping default interviewer
      setForm(f => ({
        candidate_id: '',
        interviewer_name: f.interviewer_name,
        date: f.date,
        time: '10:00',
        duration_mins: 45
      }))
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleSuggest() {
    if (!form.candidate_id) {
      showToast('Select a candidate first.', 'error')
      return
    }
    try {
      const res = await api.suggestSlots(form.candidate_id)
      setSuggestions(res.suggestions)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await api.updateInterview(id, { status })
      showToast(`Interview ${status}!`)
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleDecision(id, action) {
    try {
      await api.interviewAction(id, action)
      showToast(`Candidate marked as ${action === 'hire' ? 'Hired' : 'Rejected'}!`)
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
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

  // Month navigation
  function handlePrevMonth() {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setSelectedDate(null)
  }

  function handleNextMonth() {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  // Click on a calendar day
  function handleDayClick(dayObj) {
    if (dayObj.dim) return

    const viewYear = viewDate.getFullYear()
    const viewMonth = viewDate.getMonth()
    const clickedDate = new Date(viewYear, viewMonth, dayObj.day)

    // Toggle selected date
    if (selectedDate &&
        selectedDate.getDate() === dayObj.day &&
        selectedDate.getMonth() === viewMonth &&
        selectedDate.getFullYear() === viewYear) {
      setSelectedDate(null)
    } else {
      setSelectedDate(clickedDate)
      // Autofill date field
      const yyyy = viewYear
      const mm = String(viewMonth + 1).padStart(2, '0')
      const dd = String(dayObj.day).padStart(2, '0')
      setForm(f => ({ ...f, date: `${yyyy}-${mm}-${dd}` }))
    }
  }

  // Open scheduler modal with preset date
  function handleOpenSchedule() {
    let dateStr = form.date
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear()
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const dd = String(selectedDate.getDate()).padStart(2, '0')
      dateStr = `${yyyy}-${mm}-${dd}`
    }
    setForm(f => ({ ...f, date: dateStr }))
    setShowModal(true)
  }

  // Build calendar parameters
  const now = new Date()
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay()
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1 // Start week on Mon

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevDays = new Date(viewYear, viewMonth, 0).getDate()
  const offset = firstDay

  const calDays = []
  // Dim days from previous month
  for (let i = offset; i > 0; i--) {
    calDays.push({ day: prevDays - i + 1, dim: true })
  }
  // Active days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()
    calDays.push({ day: i, dim: false, today: isToday })
  }
  // Dim days from next month
  const remaining = 7 - (calDays.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calDays.push({ day: i, dim: true })
    }
  }

  // Filter interviews shown in the panel and inside cell dots (hide already decided hires/rejections)
  const activeInterviews = interviews.filter(iv => 
    iv.status !== 'cancelled' && 
    iv.candidate_status !== 'hired' && 
    iv.candidate_status !== 'rejected'
  )

  const filteredInterviews = activeInterviews.filter(iv => {
    if (!selectedDate) return true
    const ivDate = new Date(iv.scheduled_at)
    return ivDate.getDate() === selectedDate.getDate() &&
           ivDate.getMonth() === selectedDate.getMonth() &&
           ivDate.getFullYear() === selectedDate.getFullYear()
  })

  if (loading) return <div className="spinner"></div>

  const pending = filteredInterviews.filter(iv => iv.status === 'pending')
  const confirmed = filteredInterviews.filter(iv => iv.status === 'confirmed')
  const completed = filteredInterviews.filter(iv => iv.status === 'completed')

  return (
    <div>
      <div className="page-header">
        <div className="page-label">Interviews</div>
        <h1 className="page-title">Interview Scheduler</h1>
        <p className="page-desc">Intelligent coordination for your hiring pipeline.</p>
      </div>

      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '2rem' }}>
        <button className="btn btn-primary" onClick={handleOpenSchedule}>+ Schedule New</button>
        <button className="btn btn-outline" onClick={() => { if (candidates.length > 0) { setForm(f => ({...f, candidate_id: candidates[0].id})); handleSuggest() } }}>
          ✦ AI Suggest Times
        </button>
      </div>

      <div className="two-col">
        {/* Calendar Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
            <div className="card-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', gap: '.25rem' }}>
              <button className="btn btn-outline btn-sm" onClick={handlePrevMonth} style={{ padding: '.35rem .6rem' }}>←</button>
              <button className="btn btn-outline btn-sm" onClick={handleNextMonth} style={{ padding: '.35rem .6rem' }}>→</button>
            </div>
          </div>
          <div className="cal-grid" style={{ marginTop: '1rem', flex: 1 }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
              <div className="cal-day-head" key={d}>{d}</div>
            ))}
            {calDays.map((d, i) => {
              // Get interviews scheduled on this specific day
              const dayInterviews = activeInterviews.filter(iv => {
                if (d.dim) return false
                const ivDate = new Date(iv.scheduled_at)
                return ivDate.getDate() === d.day &&
                       ivDate.getMonth() === viewMonth &&
                       ivDate.getFullYear() === viewYear
              })

              const isSelected = selectedDate && !d.dim &&
                                 selectedDate.getDate() === d.day &&
                                 selectedDate.getMonth() === viewMonth &&
                                 selectedDate.getFullYear() === viewYear

              // Define hover tooltip contents
              const cellTooltip = dayInterviews.length > 0
                ? dayInterviews.map(iv => `${iv.candidate_name} (${formatTime(iv.scheduled_at)})`).join('\n')
                : undefined

              return (
                <div
                  key={i}
                  title={cellTooltip}
                  onClick={() => handleDayClick(d)}
                  className={`cal-day ${d.dim ? 'dim' : ''} ${d.today ? 'today' : ''}`}
                  style={{
                    position: 'relative',
                    cursor: d.dim ? 'default' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '65px',
                    padding: '.5rem .4rem .3rem',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--blue)' : '1px solid transparent',
                    background: isSelected ? 'var(--blue-bg)' : d.today ? 'var(--blue)' : 'transparent',
                    color: isSelected ? 'var(--blue)' : d.today ? 'white' : d.dim ? 'var(--border2)' : 'var(--t1)',
                    fontWeight: isSelected || d.today ? '700' : '500',
                    transition: 'all .25s ease'
                  }}
                >
                  <span style={{ fontSize: '.78rem', alignSelf: 'flex-start' }}>{d.day}</span>
                  
                  {/* Status Indicator Dots */}
                  {!d.dim && dayInterviews.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', width: '100%', marginTop: 'auto' }}>
                      {dayInterviews.slice(0, 3).map((iv, idx) => {
                        let dotBg = 'var(--orange)'
                        if (iv.status === 'confirmed') dotBg = 'var(--green)'
                        if (iv.status === 'completed') dotBg = 'var(--cyan)'
                        return (
                          <span
                            key={idx}
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: d.today && !isSelected ? 'white' : dotBg,
                              display: 'inline-block'
                            }}
                          />
                        )
                      })}
                      {dayInterviews.length > 3 && (
                        <span style={{ fontSize: '.55rem', fontWeight: 800, color: d.today && !isSelected ? 'white' : 'var(--t3)', lineHeight: 1 }}>+</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Panel */}
        <div>
          {/* AI Suggestions */}
          {suggestions && (
            <div className="card" style={{ marginBottom: '1rem', background: '#f0f0ff', borderColor: '#ddd8ff' }}>
              <div className="card-title">✦ AI Suggestions</div>
              <p className="card-sub" style={{ marginBottom: '.75rem' }}>{suggestions.length} optimal slots found</p>
              {suggestions.map((s, i) => (
                <div key={i} style={{ padding: '.6rem', background: 'white', borderRadius: '10px', border: '1px solid #eee', marginBottom: '.4rem' }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 700 }}>{s.time}</div>
                  <div style={{ fontSize: '.7rem', color: '#8888a0' }}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ minHeight: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="card-title" style={{ fontSize: '.95rem', fontWeight: 800 }}>
                {selectedDate
                  ? `Interviews: ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Upcoming Interviews'
                }
              </div>
              {selectedDate && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedDate(null)}
                  style={{ padding: '.2rem .5rem', fontSize: '.72rem', color: 'var(--blue)' }}
                >
                  ✕ Clear Filter
                </button>
              )}
            </div>

            {[...pending, ...confirmed, ...completed].length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-icon">📅</div>
                <div className="empty-text">No interviews scheduled</div>
                <div className="empty-sub">
                  {selectedDate
                    ? 'No candidates are booked for this date.'
                    : 'Schedule one to get started'
                  }
                </div>
                {selectedDate && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '1rem' }}
                    onClick={handleOpenSchedule}
                  >
                    + Schedule for this Day
                  </button>
                )}
              </div>
            ) : (
              [...pending, ...confirmed, ...completed].map(iv => (
                <div className="interview-card" key={iv.id} style={{ marginTop: '.75rem' }}>
                  <div className="iv-time">{formatTime(iv.scheduled_at).split(' ')[0]}</div>
                  <div className="iv-info">
                    <div className="iv-name">{iv.candidate_name}</div>
                    <div className="iv-role">with {iv.interviewer_name} • {iv.duration_mins}m</div>
                    <div style={{ fontSize: '.65rem', color: '#8888a0' }}>{formatDate(iv.scheduled_at)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                    <span className={`status-badge status-${iv.status}`}>{iv.status}</span>
                    {iv.status === 'pending' && (
                      <>
                        <button className="btn btn-sm btn-outline" onClick={() => handleStatusChange(iv.id, 'confirmed')}>Confirm</button>
                        <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleOpenEmailModal(iv)}>✉ Draft Invite</button>
                        <button className="btn btn-sm btn-outline btn-danger" onClick={() => handleStatusChange(iv.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                    {iv.status === 'confirmed' && (
                      <>
                        <button className="btn btn-sm btn-outline" onClick={() => handleStatusChange(iv.id, 'completed')}>Complete</button>
                        <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleOpenEmailModal(iv)}>✉ Draft Invite</button>
                        <button className="btn btn-sm btn-outline btn-danger" onClick={() => handleStatusChange(iv.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                    {iv.status === 'completed' && (
                      <div style={{ display: 'flex', gap: '.25rem', marginTop: '.25rem' }}>
                        <button className="btn btn-sm btn-success" onClick={() => handleDecision(iv.id, 'hire')} style={{ padding: '.25rem .5rem', fontSize: '.68rem' }}>Hire</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDecision(iv.id, 'reject')} style={{ padding: '.25rem .5rem', fontSize: '.68rem' }}>Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <div className="modal-title">Schedule Interview</div>

            <div className="form-group">
              <label className="form-label">Candidate</label>
              <select className="form-input form-select" value={form.candidate_id} onChange={e => setForm(f => ({ ...f, candidate_id: e.target.value }))}>
                <option value="">Select candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Interviewer</label>
              <input className="form-input" placeholder="e.g. John Smith" value={form.interviewer_name} onChange={e => setForm(f => ({ ...f, interviewer_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="form-input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input className="form-input" type="number" value={form.duration_mins} onChange={e => setForm(f => ({ ...f, duration_mins: e.target.value }))} />
            </div>

            {form.candidate_id && (
              <button className="btn btn-outline btn-full" style={{ marginBottom: '.75rem' }} onClick={handleSuggest}>
                ✦ AI Suggest Times
              </button>
            )}

            {suggestions && (
              <div style={{ marginBottom: '1rem' }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ padding: '.5rem', background: '#f0f0ff', borderRadius: '8px', marginBottom: '.3rem', fontSize: '.75rem', cursor: 'pointer' }}>
                    <strong>{s.time}</strong> — {s.reason}
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={handleSchedule}>
              Schedule Interview
            </button>
          </div>
        </div>
      )}

      {emailModal.isOpen && (
        <div className="modal-overlay" onClick={() => !emailModal.sending && setEmailModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" style={{ maxWidth: '650px', background: 'var(--white)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !emailModal.sending && setEmailModal(prev => ({ ...prev, isOpen: false }))} disabled={emailModal.sending}>×</button>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✉</span> AI Email Draft Composer
            </div>

            {emailModal.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', gap: '1rem' }}>
                <div className="spinner"></div>
                <div style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                  ✦ AI is crafting the perfect draft...
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
                  <label className="form-label">Email Body</label>
                  <textarea 
                    className="form-input" 
                    value={emailModal.body} 
                    onChange={e => setEmailModal(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Compose your email here..."
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
                        'Send Invitation →'
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
