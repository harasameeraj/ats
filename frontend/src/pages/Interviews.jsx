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
  const [githubReport, setGithubReport] = useState(null)
  const [scanningId, setScanningId] = useState(null)
  const [linkedinReport, setLinkedinReport] = useState(null)
  const [scanningLinkedinId, setScanningLinkedinId] = useState(null)

  // Video Playback Modal States
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')

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
      await api.sendEmail(emailModal.candidateEmail, emailModal.subject, emailModal.body)
      setEmailModal(prev => ({ ...prev, isOpen: false, sending: false }))
      showToast(`Email invitation successfully dispatched to ${emailModal.candidateEmail}!`)
    } catch (e) {
      showToast(e.message || 'Failed to send email', 'error')
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

  async function handleCandidateDecision(candidateId, action) {
    try {
      await api.candidateAction(candidateId, action)
      showToast(action === 'hire' ? 'Candidate progressed to next step (Shortlisted)!' : 'Candidate marked as Rejected!')
      loadData()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleScanGithub(cand) {
    setScanningId(cand.id)
    try {
      const report = await api.scanGithub(cand.id, cand.github_url)
      setGithubReport(report)
      const updatedUrl = cand.github_url || `https://github.com/${cand.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      setAllCandidates(prev => prev.map(c => c.id === cand.id ? { ...c, github_url: c.github_url || updatedUrl, github_analysis: JSON.stringify(report) } : c))
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
      setAllCandidates(prev => prev.map(c => c.id === cand.id ? { ...c, linkedin_url: c.linkedin_url || updatedUrl, linkedin_analysis: JSON.stringify(report) } : c))
    } catch (e) {
      showToast(e.message || "Failed to scan LinkedIn profile.", "error")
    } finally {
      setScanningLinkedinId(null)
    }
  }

  function handleWatchVideo(candidateId, candidateName) {
    const backendUrl = 'http://localhost:8000';
    setVideoUrl(`${backendUrl}/uploads/recordings/${candidateId}_recording.webm`);
    setVideoTitle(`Webcam Monitoring: ${candidateName}`);
    setShowVideoModal(true);
  }

  async function handlePurgeFailed() {
    if (!window.confirm("Are you sure you want to permanently delete all candidates who failed (< 60% score) or violated the anti-cheating policy (>= 3 violations)?")) {
      return
    }
    try {
      const res = await api.purgeFailedCandidates()
      showToast(res.message || "Failed and violated candidates cleared successfully!")
      loadData()
    } catch (e) {
      showToast(e.message || "Failed to purge candidates", 'error')
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
    !['hired', 'offered', 'onboarded', 'completed', 'rejected'].includes(iv.candidate_status)
  )

  const testCandidates = allCandidates.filter(c => {
    if (!c.assessment_status) return false
    if (['hired', 'onboarded', 'completed'].includes(c.status)) return false
    const hasActiveInterview = interviews.some(iv => iv.candidate_id === c.id && iv.status !== 'cancelled')
    return !hasActiveInterview
  })

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

      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '2rem', alignItems: 'center', width: '100%' }}>
        <button className="btn btn-primary" onClick={handleOpenSchedule}>+ Schedule New</button>
        <button className="btn btn-outline" onClick={() => { if (candidates.length > 0) { setForm(f => ({...f, candidate_id: candidates[0].id})); handleSuggest() } }}>
          ✦ AI Suggest Times
        </button>
        <button 
          className="btn btn-outline" 
          onClick={handlePurgeFailed}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            marginLeft: 'auto', 
            borderColor: '#f87171', 
            color: '#ef4444', 
            background: '#fef2f2',
            fontWeight: 700 
          }}
        >
          🗑️ Clear Failed & Violated
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

            {([...pending, ...confirmed, ...completed].length === 0 && (!selectedDate ? testCandidates.length === 0 : true)) ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-icon">📅</div>
                <div className="empty-text">No interviews scheduled</div>
                <div className="empty-sub">
                  {selectedDate
                    ? 'No candidates are booked for this date.'
                    : 'Invite candidates to AI tests or schedule one to get started.'
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                {/* 1. Show scheduled interviews first */}
                {[...pending, ...confirmed, ...completed].map(iv => (
                  <div className="interview-card" key={`iv-${iv.id}`}>
                    <div className="iv-time">{formatTime(iv.scheduled_at).split(' ')[0]}</div>
                    <div className="iv-info">
                      <div className="iv-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {iv.candidate_name}
                        {iv.assessment_status === 'passed' && (
                          <span style={{ background: '#e6fbf3', color: '#10b981', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                            Passed ({iv.assessment_score}%)
                          </span>
                        )}
                        {iv.assessment_status === 'failed' && (
                          <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                            Failed ({iv.assessment_score}%)
                          </span>
                        )}
                        {iv.assessment_status && iv.assessment_status !== 'pending' && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleWatchVideo(iv.candidate_id, iv.candidate_name)}
                            style={{
                              borderColor: 'var(--purple)',
                              color: 'var(--purple)',
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              fontWeight: 'bold',
                              borderRadius: '4px',
                              background: '#fcfcfc',
                              lineHeight: 1
                            }}
                          >
                            📹 Video
                          </button>
                        )}
                        {iv.assessment_status === 'pending' && (
                          <span style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                            Pending
                          </span>
                        )}
                        {iv.assessment_violations > 0 && (
                          <span style={{ background: iv.assessment_violations >= 3 ? '#fef2f2' : '#fffbeb', color: iv.assessment_violations >= 3 ? '#ef4444' : '#d97706', border: iv.assessment_violations >= 3 ? '1px solid #fca5a5' : '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold', marginLeft: '4px' }}>
                            ⚠️ {iv.assessment_violations} {iv.assessment_violations === 1 ? 'Violation' : 'Violations'}
                          </span>
                        )}
                      </div>
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
                ))}

                {/* 2. Show active AI assessments (only if no calendar date filter is active) */}
                {!selectedDate && testCandidates.map(cand => (
                  <div className="interview-card" key={`test-${cand.id}`} style={{ borderLeft: '3px solid var(--purple)' }}>
                    <div className="iv-time" style={{ fontSize: '0.82rem', color: 'var(--purple)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2, minWidth: '85px', textAlign: 'center' }}>
                      <span>AI TEST</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>STAGE</span>
                    </div>
                    <div className="iv-info">
                      <div className="iv-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {cand.name}
                        {cand.assessment_violations >= 3 ? (
                          <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                            Violated (⚠️ {cand.assessment_violations} Violations)
                          </span>
                        ) : (
                          <>
                            {cand.assessment_status === 'passed' && cand.assessment_score >= 60 && (
                              <span style={{ background: '#e6fbf3', color: '#10b981', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                                Passed ({cand.assessment_score}%)
                              </span>
                            )}
                            {cand.assessment_status !== 'pending' && cand.assessment_score < 60 && (
                              <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                                Failed ({cand.assessment_score}%)
                              </span>
                            )}
                          </>
                        )}
                        {cand.assessment_status === 'pending' && (
                          <span style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>
                            Pending
                          </span>
                        )}
                        {cand.assessment_violations > 0 && cand.assessment_violations < 3 && (
                          <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold', marginLeft: '4px' }}>
                            ⚠️ {cand.assessment_violations} {cand.assessment_violations === 1 ? 'Violation' : 'Violations'}
                          </span>
                        )}
                      </div>
                      <div className="iv-role">{cand.role || 'General Position'}</div>
                      <div style={{ fontSize: '.65rem', color: 'var(--t3)' }}>
                        {cand.assessment_status === 'pending' 
                          ? 'Awaiting candidate completion...' 
                          : 'Test completed — candidate evaluation saved'
                        }
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleScanGithub(cand)}
                          disabled={scanningId === cand.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderColor: '#333',
                            color: '#333',
                            fontSize: '0.68rem',
                            padding: '3px 8px',
                            fontWeight: 'bold',
                            background: '#f8fafc',
                            width: 'fit-content'
                          }}
                          title="Scan candidate's public GitHub profile"
                        >
                          {scanningId === cand.id ? (
                            <>
                              <div className="spinner" style={{ width: '10px', height: '10px', display: 'inline-block', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: '#333', margin: '0 4px 0 0' }}></div>
                              Scanning...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                              </svg>
                              Scan GitHub
                            </>
                          )}
                        </button>

                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleScanLinkedin(cand)}
                          disabled={scanningLinkedinId === cand.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderColor: '#0a66c2',
                            color: '#0a66c2',
                            fontSize: '0.68rem',
                            padding: '3px 8px',
                            fontWeight: 'bold',
                            background: '#f8fafc',
                            width: 'fit-content'
                          }}
                          title="Scan candidate's LinkedIn profile"
                        >
                          {scanningLinkedinId === cand.id ? (
                            <>
                              <div className="spinner" style={{ width: '10px', height: '10px', display: 'inline-block', border: '2px solid rgba(10,102,194,0.1)', borderTopColor: '#0a66c2', margin: '0 4px 0 0' }}></div>
                              Scanning...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ verticalAlign: 'middle' }}>
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764.784 1.764 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                              Scan LinkedIn
                            </>
                          )}
                        </button>

                        {cand.assessment_status && cand.assessment_status !== 'pending' && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleWatchVideo(cand.id, cand.name)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderColor: 'var(--purple)',
                              color: 'var(--purple)',
                              fontSize: '0.68rem',
                              padding: '3px 8px',
                              fontWeight: 'bold',
                              background: '#fcfcfc',
                              width: 'fit-content'
                            }}
                          >
                            📹 Watch Video
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', minWidth: '110px' }}>
                      {cand.assessment_status === 'pending' && (
                        <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Awaiting Take</span>
                      )}
                      
                      {cand.status === 'shortlisted' && (
                        <>
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => {
                              setForm(f => ({
                                ...f,
                                candidate_id: cand.id.toString(),
                                interviewer_name: 'Hiring Manager'
                              }))
                              setShowModal(true)
                            }}
                          >
                            📅 Schedule
                          </button>
                          <div style={{ display: 'flex', gap: '.2rem', marginTop: '.1rem' }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleCandidateDecision(cand.id, 'reject')} style={{ padding: '.25rem .5rem', fontSize: '.65rem', flex: 1 }}>Reject</button>
                          </div>
                        </>
                      )}
                      
                      {cand.status === 'rejected' && cand.assessment_status !== 'pending' && (
                        <>
                          <span className="status-badge status-rejected" style={{ textAlign: 'center', background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}>
                            {cand.assessment_violations >= 3 ? 'Auto Rejected (Violated)' : 'Auto Rejected (Failed)'}
                          </span>
                          <div style={{ display: 'flex', gap: '.25rem', marginTop: '.1rem' }}>
                            <button className="btn btn-sm btn-success" onClick={() => handleCandidateDecision(cand.id, 'hire')} style={{ padding: '.25rem .5rem', fontSize: '.65rem', flex: 1 }}>Force Hire</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                  <option key={c.id} value={c.id}>
                    {c.name} {c.assessment_status ? `(AI Test: ${c.assessment_status === 'passed' ? `Passed - ${c.assessment_score}%` : c.assessment_status === 'failed' ? `Failed - ${c.assessment_score}%` : 'Pending'})` : '(AI Test: Not Invited)'}
                  </option>
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

      {githubReport && (
        <div className="modal-overlay" onClick={() => setGithubReport(null)}>
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2.5rem', background: 'var(--white)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setGithubReport(null)}>×</button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <img 
                src={githubReport.user_info.avatar_url} 
                alt={githubReport.user_info.login}
                style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--blue)' }} 
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>
                    {githubReport.user_info.name}
                  </h2>
                  <a href={githubReport.user_info.html_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                    @{githubReport.user_info.login} ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--t2)', marginTop: '4px', fontStyle: 'italic' }}>
                  {githubReport.user_info.bio || "No biography provided."}
                </div>
                {githubReport.user_info.company && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--t3)', marginTop: '4px', fontWeight: 600 }}>
                    🏢 {githubReport.user_info.company}
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Grid 1: Basic Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase' }}>Public Repos</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--t1)', marginTop: '0.25rem' }}>{githubReport.user_info.public_repos}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase' }}>Stars Received</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>⭐ {githubReport.stats.total_stars}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase' }}>Total Forks</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)', marginTop: '0.25rem' }}>🍴 {githubReport.stats.total_forks}</div>
                </div>
                <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase' }}>Followers</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--purple)', marginTop: '0.25rem' }}>👥 {githubReport.user_info.followers}</div>
                </div>
              </div>

              {/* Grid 2: Language & Activity Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                
                {/* Programming Languages */}
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    💻 Programming Languages
                  </h3>
                  {Object.keys(githubReport.stats.languages).length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontStyle: 'italic' }}>No languages detected.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {Object.entries(githubReport.stats.languages).map(([lang, pct]) => (
                        <div key={lang}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--t2)', marginBottom: '0.25rem' }}>
                            <span>{lang}</span>
                            <span>{pct}%</span>
                          </div>
                          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    ⏱️ Recent Contribution Activity
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 600 }}>Commits (Pushes)</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--t1)' }}>{githubReport.stats.activity.pushes} pushes</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 600 }}>Pull Requests</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--t1)' }}>{githubReport.stats.activity.pull_requests} PRs</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 600 }}>Issue Events</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--t1)' }}>{githubReport.stats.activity.issues} issues</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', fontWeight: 600 }}>Total Analyzed Events</span>
                      <strong style={{ fontSize: '1rem', color: 'var(--t1)' }}>{githubReport.stats.activity.total_recent_events} events</strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* AI Projects Section */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  🤖 Detected AI / Machine Learning Projects
                </h3>
                {githubReport.ai_projects.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontStyle: 'italic' }}>
                    No specialized AI/ML repositories detected.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {githubReport.ai_projects.map((repo, idx) => (
                      <div key={idx} style={{ background: 'var(--white)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--blue)' }}>{repo.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginTop: '2px' }}>
                            {repo.description || "No description provided."}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--t3)' }}>
                          <span>⭐ {repo.stars}</span>
                          <span style={{ color: 'var(--purple)' }}>{repo.language}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* JD Technologies Match Section */}
              {githubReport.jd_tech_matches && githubReport.jd_tech_matches.length > 0 && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎯 Job Description Tech Matches
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {githubReport.jd_tech_matches.map((match, idx) => (
                      <div key={idx} style={{ background: 'var(--white)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ 
                            background: 'rgba(99, 102, 241, 0.08)', 
                            color: 'var(--blue)', 
                            border: '1px solid rgba(99, 102, 241, 0.15)', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.68rem', 
                            fontWeight: 'bold' 
                          }}>
                            {match.technology}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--t3)', fontWeight: 600 }}>
                            📁 Project: <strong style={{ color: 'var(--t1)' }}>{match.project_name}</strong>
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)', lineHeight: '1.45', marginTop: '6px' }}>
                          {match.relation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary Section */}
              <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '14px', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--blue)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✦</span> AI Candidate Developer Profile Summary
                </h3>
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--t2)', 
                  lineHeight: '1.6', 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit'
                }}>
                  {githubReport.ai_summary}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Video Playback Modal */}
      {showVideoModal && (
        <div className="modal-overlay" onClick={() => setShowVideoModal(false)}>
          <div className="modal" style={{ maxWidth: '640px', width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowVideoModal(false)}>×</button>
            <div className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem' }}>
              📹 {videoTitle}
            </div>
            <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid var(--border)' }}>
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                style={{ width: '100%', display: 'block' }}
                onError={(e) => {
                  console.error("Video load error:", e);
                  alert("Could not load webcam video. The candidate might not have granted camera permissions, or the video file is not available.");
                  setShowVideoModal(false);
                }}
              />
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowVideoModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Profile Analysis Modal */}
      {linkedinReport && (
        <div className="modal-overlay" onClick={() => setLinkedinReport(null)}>
          <div className="modal" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '2.5rem', background: 'var(--white)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLinkedinReport(null)}>×</button>
            
            {/* Header: User Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <img 
                src={linkedinReport.user_info.avatar_url} 
                alt={linkedinReport.user_info.name}
                style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #0a66c2' }} 
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--t1)' }}>
                    {linkedinReport.user_info.name}
                  </h2>
                  <a href={linkedinReport.user_info.html_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#0a66c2', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    LinkedIn Profile ↗
                  </a>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--t1)', fontWeight: 700, marginTop: '2px' }}>
                  {linkedinReport.user_info.headline}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--t2)', marginTop: '4px', fontStyle: 'italic' }}>
                  {linkedinReport.user_info.summary || "No personal summary provided."}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--t3)', marginTop: '6px', fontWeight: 600 }}>
                  <span>📍 {linkedinReport.user_info.location}</span>
                  <span>•</span>
                  <span>🏢 {linkedinReport.user_info.current_company}</span>
                  <span>•</span>
                  <span style={{ color: '#0a66c2' }}>👥 {linkedinReport.user_info.connections} connections</span>
                </div>
              </div>
            </div>

            {/* Scrollable Body Container */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* AI Recruitment tenure Suitability Analysis */}
              <div style={{ background: 'linear-gradient(135deg, rgba(10,102,194,0.03), rgba(99,102,241,0.03))', border: '1px solid rgba(10,102,194,0.15)', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0a66c2', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🤖</span> AI Recruiter Tenure & Suitability Assessment
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--t2)', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {linkedinReport.ai_summary}
                </div>
              </div>

              {/* JD Match Requirements */}
              {linkedinReport.jd_matches && linkedinReport.jd_matches.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.85rem' }}>
                    💼 Cross-Reference JD Requirements
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    {linkedinReport.jd_matches.map((match, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          border: '1px solid var(--border)', 
                          borderRadius: '10px', 
                          padding: '1rem', 
                          background: 'var(--bg)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '6px' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--t1)' }}>
                            {match.requirement}
                          </strong>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            background: match.rating.toLowerCase().includes('strong') ? '#e6fbf3' : match.rating.toLowerCase().includes('partial') ? '#fffbeb' : '#fef2f2',
                            color: match.rating.toLowerCase().includes('strong') ? '#10b981' : match.rating.toLowerCase().includes('partial') ? '#d97706' : '#ef4444',
                            border: match.rating.toLowerCase().includes('strong') ? '1px solid #a7f3d0' : match.rating.toLowerCase().includes('partial') ? '1px solid #fde68a' : '1px solid #fca5a5'
                          }}>
                            {match.rating}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
                          <strong>Matched Role:</strong> {match.matches_role}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)', lineHeight: '1.5' }}>
                          {match.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Work Experience */}
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.85rem' }}>
                  🏢 Work Experience
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {linkedinReport.experience.map((exp, idx) => (
                    <div key={idx} style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #0a66c2', position: 'relative' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0a66c2', position: 'absolute', left: '-5px', top: '5px' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--t1)' }}>{exp.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--t3)', fontWeight: 600 }}>{exp.duration}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#0a66c2', fontWeight: 600 }}>
                        {exp.company}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginTop: '4px', lineHeight: '1.5' }}>
                        {exp.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              {linkedinReport.education && linkedinReport.education.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.85rem' }}>
                    🎓 Education
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {linkedinReport.education.map((edu, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem', background: 'var(--bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--t1)' }}>{edu.school}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--t3)', fontWeight: 600 }}>{edu.duration}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--t2)', marginTop: '2px' }}>
                          {edu.degree} in {edu.field_of_study}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
