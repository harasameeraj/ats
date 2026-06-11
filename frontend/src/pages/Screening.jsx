import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

export default function Screening() {
  const [step, setStep] = useState(1) // 1: upload JD, 2: upload CVs, 3: running, 4: results
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [jdTitle, setJdTitle] = useState('')
  const [jdFile, setJdFile] = useState(null)
  const [cvFiles, setCvFiles] = useState([])
  const [toast, setToast] = useState(null)
  const jdRef = useRef(null)
  const cvRef = useRef(null)

  // Tiered Scheduling / Review States
  const [selectedIds, setSelectedIds] = useState([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [isBulkSchedule, setIsBulkSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    interviewer_name: 'Hiring Manager',
    date: '',
    time: '10:00',
    duration_mins: 45,
    notes: ''
  })
  const [suggestions, setSuggestions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [submittingSchedule, setSubmittingSchedule] = useState(false)

  useEffect(() => {
    loadJobs()
    
    // Default form date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    setScheduleForm(f => ({ ...f, date: `${year}-${month}-${day}` }))
  }, [])

  async function loadJobs() {
    try {
      const j = await api.getJobs()
      setJobs(j)
    } catch (e) { console.error(e) }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleUploadJD() {
    if (!jdFile) return
    setLoading(true)
    try {
      const job = await api.uploadJD(jdFile, jdTitle || 'Untitled Position')
      setSelectedJob(job)
      setJobs(prev => [job, ...prev])
      showToast('JD uploaded successfully!')
      setStep(2)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUploadCVs() {
    if (cvFiles.length === 0) return
    setLoading(true)
    try {
      const cands = await api.uploadCVs(cvFiles)
      setCandidates(cands)
      showToast(`${cands.length} CVs uploaded!`)
      setStep(3)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRunScreening() {
    if (!selectedJob || candidates.length === 0) return
    setLoading(true)
    try {
      const res = await api.runScreening(selectedJob.id, candidates.map(c => c.id))
      setResults(res)
      showToast(`Screened ${res.length} candidates!`)
      setStep(4)
      setSelectedIds([])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadPastResults(jobId) {
    setLoading(true)
    try {
      const res = await api.getResults(jobId)
      setResults(res)
      setSelectedJob(jobs.find(j => j.id === jobId))
      setStep(4)
      setSelectedIds([])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return '#34d399'
    if (score >= 60) return '#fb923c'
    return '#f87171'
  }

  function getStatusClass(status) {
    return `status-badge status-${status}`
  }

  function getAvatarColor(name) {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#34d399', '#22d3ee', '#1e1b4b']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  // Tiered logic mapping
  function getTierInfo(score) {
    if (score >= 80) {
      return {
        label: 'Shortlisted',
        badgeClass: 'status-shortlisted',
        eligible: true
      }
    } else if (score >= 60) {
      return {
        label: 'Review Needed',
        badgeClass: 'status-pending', // maps to orange in App.css
        eligible: true
      }
    } else {
      return {
        label: 'Rejected',
        badgeClass: 'status-rejected', // red
        eligible: false
      }
    }
  }

  // Selection handlers
  function handleToggleSelect(candId) {
    setSelectedIds(prev =>
      prev.includes(candId) ? prev.filter(id => id !== candId) : [...prev, candId]
    )
  }

  function handleToggleSelectAll() {
    const eligibleIds = results
      .filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed')
      .map(r => r.candidate_id)

    if (selectedIds.length === eligibleIds.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(eligibleIds)
    }
  }

  // Open scheduling modals
  function handleOpenSingleSchedule(candidate) {
    setActiveCandidate(candidate)
    setIsBulkSchedule(false)
    setSuggestions([])
    setShowScheduleModal(true)
    handleLoadSuggestions(candidate.candidate_id)
  }

  function handleOpenBulkSchedule() {
    setIsBulkSchedule(true)
    setSuggestions([])
    setShowScheduleModal(true)
  }

  function handleOpenReviewModal(candidate) {
    setActiveCandidate(candidate)
    setShowReviewModal(true)
  }

  async function handleLoadSuggestions(candidateId) {
    setSuggestLoading(true)
    try {
      const res = await api.suggestSlots(candidateId)
      setSuggestions(res.suggestions || [])
    } catch (e) {
      console.error(e)
    } finally {
      setSuggestLoading(false)
    }
  }

  // Smart suggestion parsing to autofill form fields
  function parseSuggestedSlot(slotText) {
    const now = new Date()
    const targetDate = new Date()
    const lower = slotText.toLowerCase()

    if (lower.includes('tomorrow')) {
      targetDate.setDate(now.getDate() + 1)
    } else if (lower.includes('day after')) {
      targetDate.setDate(now.getDate() + 2)
    } else {
      targetDate.setDate(now.getDate() + 1) // default tomorrow
    }

    const timeMatch = slotText.match(/(\d+):?(\d+)?\s*(AM|PM)/i)
    let hour = 10
    let min = 0

    if (timeMatch) {
      hour = parseInt(timeMatch[1])
      min = timeMatch[2] ? parseInt(timeMatch[2]) : 0
      const ampm = timeMatch[3].toUpperCase()
      if (ampm === 'PM' && hour < 12) hour += 12
      if (ampm === 'AM' && hour === 12) hour = 0
    }

    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`

    setScheduleForm(f => ({ ...f, date: dateStr, time: timeStr }))
    showToast(`Time set to ${slotText}!`)
  }

  async function handleConfirmSchedule() {
    if (!scheduleForm.interviewer_name || !scheduleForm.date) {
      showToast('Interviewer name and date are required.', 'error')
      return
    }

    setSubmittingSchedule(true)
    try {
      if (isBulkSchedule) {
        await api.bulkSchedule({
          candidate_ids: selectedIds,
          interviewer_name: scheduleForm.interviewer_name,
          start_date: scheduleForm.date,
          duration_mins: parseInt(scheduleForm.duration_mins),
          notes: scheduleForm.notes
        })
        showToast(`Bulk scheduled ${selectedIds.length} interviews successfully!`)

        // Update local results statuses
        setResults(prev => prev.map(r => {
          if (selectedIds.includes(r.candidate_id)) {
            return { ...r, status: 'interviewed' }
          }
          return r
        }))
        setSelectedIds([])
      } else {
        const scheduled_at = `${scheduleForm.date}T${scheduleForm.time}:00`
        await api.createInterview({
          candidate_id: activeCandidate.candidate_id,
          interviewer_name: scheduleForm.interviewer_name,
          scheduled_at,
          duration_mins: parseInt(scheduleForm.duration_mins),
          notes: scheduleForm.notes
        })
        showToast(`Scheduled interview for ${activeCandidate.candidate_name}!`)

        // Update local candidate status
        setResults(prev => prev.map(r => {
          if (r.candidate_id === activeCandidate.candidate_id) {
            return { ...r, status: 'interviewed' }
          }
          return r
        }))
      }
      setShowScheduleModal(false)
      setShowReviewModal(false)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSubmittingSchedule(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-label">AI Screening</div>
        <h1 className="page-title">AI Screening Hub</h1>
        <p className="page-desc">Upload JDs and bulk CVs — the AI engine ranks candidates by semantic match score.</p>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {['Upload JD', 'Upload CVs', 'Run Screening', 'Results'].map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1, padding: '.6rem', textAlign: 'center', borderRadius: '10px',
              fontSize: '.72rem', fontWeight: 700,
              background: step > i + 1 ? '#d1fae5' : step === i + 1 ? '#ede9fe' : '#f4f4f8',
              color: step > i + 1 ? '#059669' : step === i + 1 ? '#6366f1' : '#8888a0',
              border: step === i + 1 ? '2px solid #6366f1' : '1px solid #e8e8f0',
              cursor: i + 1 < step ? 'pointer' : 'default'
            }}
            onClick={() => { if (i + 1 < step) setStep(i + 1) }}
          >
            {step > i + 1 ? '✓ ' : ''}{s}
          </div>
        ))}
      </div>

      {/* Past screenings */}
      {step === 1 && jobs.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Previous Screenings</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '.75rem' }}>
            {jobs.map(j => (
              <button key={j.id} className="btn btn-outline btn-sm" onClick={() => loadPastResults(j.id)}>
                {j.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 1: Upload JD */}
      {step === 1 && (
        <div className="card">
          <div className="card-title">📝 Job Description</div>
          <p className="card-sub" style={{ marginBottom: '1rem' }}>Define your ideal candidate profile</p>

          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input className="form-input" placeholder="e.g. Senior Product Designer" value={jdTitle} onChange={e => setJdTitle(e.target.value)} />
          </div>

          <div className="upload-zone" onClick={() => jdRef.current?.click()}>
            <input ref={jdRef} type="file" accept=".pdf,.docx,.doc,.txt" hidden onChange={e => {
              const file = e.target.files[0]
              setJdFile(file)
              if (file && !jdTitle) {
                const cleaned = file.name
                  .replace(/\.[^/.]+$/, "")
                  .replace(/[_-]/g, " ")
                  .split(' ')
                  .filter(w => w.length > 0)
                  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')
                setJdTitle(cleaned)
              }
            }} />
            <div className="upload-icon">☁️</div>
            <div className="upload-text">
              {jdFile ? jdFile.name : <>Drag JD here or <span className="link">Browse</span></>}
            </div>
            <div className="upload-hint">PDF, DOCX, TXT up to 5MB</div>
          </div>

          <button className="btn btn-primary btn-full" style={{ marginTop: '1.25rem' }} onClick={handleUploadJD} disabled={!jdFile || loading}>
            {loading ? 'Uploading...' : 'Upload JD & Continue →'}
          </button>
        </div>
      )}

      {/* STEP 2: Upload CVs */}
      {step === 2 && (
        <div className="card">
          <div className="card-title">📄 CV Batch Upload</div>
          <p className="card-sub" style={{ marginBottom: '1rem' }}>Screen up to 20 candidates simultaneously</p>

          <div className="upload-zone" onClick={() => cvRef.current?.click()}>
            <input ref={cvRef} type="file" accept=".pdf,.docx,.doc,.txt" multiple hidden
              onChange={e => setCvFiles(prev => [...prev, ...Array.from(e.target.files)])} />
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              Drop CVs here or <span className="link">Browse</span>
            </div>
            <div className="upload-hint">PDF, DOCX, TXT • Max 20 files</div>
          </div>

          {cvFiles.length > 0 && (
            <div className="file-list">
              {cvFiles.map((f, i) => (
                <div className="file-chip" key={i}>
                  📄 {f.name}
                  <span className="remove" onClick={() => setCvFiles(prev => prev.filter((_, j) => j !== i))}>×</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUploadCVs} disabled={cvFiles.length === 0 || loading}>
              {loading ? 'Uploading...' : `Upload ${cvFiles.length} CV${cvFiles.length !== 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Run Screening */}
      {step === 3 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          {loading ? (
            <>
              <div className="spinner"></div>
              <h3 style={{ marginTop: '1rem', fontWeight: 800 }}>🤖 AI is screening candidates...</h3>
              <p className="card-sub" style={{ marginTop: '.5rem' }}>GPT-4o is analyzing {candidates.length} resumes against your JD</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
              <h3 style={{ fontWeight: 800, marginBottom: '.5rem' }}>Ready to Screen</h3>
              <p className="card-sub" style={{ marginBottom: '1.5rem' }}>
                {candidates.length} candidates loaded for <strong>{selectedJob?.title}</strong>
              </p>
              <button className="btn btn-primary" onClick={handleRunScreening}>
                ▶ Run AI Screening
              </button>
            </>
          )}
        </div>
      )}

      {/* STEP 4: Results */}
      {step === 4 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <div className="card-title">Screening Results</div>
              <div className="card-sub">{results.length} candidates • {selectedJob?.title}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => { setStep(1); setResults([]); setCvFiles([]); setJdFile(null); setJdTitle(''); }}>
              New Screening
            </button>
          </div>

          {/* Bulk Action Panel */}
          {selectedIds.length > 0 && (
            <div style={{
              background: 'var(--grad-subtle)',
              border: '1.5px solid var(--blue)',
              borderRadius: 'var(--r)',
              padding: '.85rem 1.25rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: 'scaleIn .25s ease'
            }}>
              <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--t1)' }}>
                📅 <strong>{selectedIds.length}</strong> candidate{selectedIds.length !== 1 ? 's' : ''} selected for scheduling
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleOpenBulkSchedule}>
                Bulk Schedule Selected
              </button>
            </div>
          )}

          <table className="results-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={
                      results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed').length > 0 &&
                      selectedIds.length === results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed').length
                    }
                    onChange={handleToggleSelectAll}
                    disabled={results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed').length === 0}
                  />
                </th>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Match Score</th>
                <th>Fit</th>
                <th>Tier</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const tier = getTierInfo(r.match_score)
                const isInterviewed = r.status === 'interviewed'
                return (
                  <tr key={r.candidate_id}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={!tier.eligible || isInterviewed}
                        checked={selectedIds.includes(r.candidate_id)}
                        onChange={() => handleToggleSelect(r.candidate_id)}
                      />
                    </td>
                    <td>
                      <span className={`rank-num ${i < 3 ? `rank-${i + 1}` : ''}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <div className="cand-cell">
                        <div className="cand-avatar" style={{ background: getAvatarColor(r.candidate_name) + '22', color: getAvatarColor(r.candidate_name) }}>
                          {r.candidate_name.charAt(0)}
                        </div>
                        <div>
                          <div className="cand-name">{r.candidate_name}</div>
                          <div className="cand-role">{r.overall_summary?.slice(0, 65)}...</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div className="score-bar">
                          <div className="score-fill" style={{ width: `${r.match_score}%`, background: getScoreColor(r.match_score) }}></div>
                        </div>
                        <span style={{ fontSize: '.75rem', fontWeight: 800, fontFamily: 'var(--mono)', color: getScoreColor(r.match_score) }}>
                          {r.match_score}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '.72rem', fontWeight: 600, color: '#555570' }}>{r.seniority_fit}</td>
                    <td>
                      <span className={`status-badge ${tier.badgeClass}`}>{tier.label}</span>
                    </td>
                    <td>
                      <span className={getStatusClass(r.status)}>{r.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'flex-end' }}>
                        {/* 60%-80% match offers detailed resume review */}
                        {r.match_score >= 60 && r.match_score <= 80 && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleOpenReviewModal(r)}>
                            🔍 Review
                          </button>
                        )}
                        {/* Eligible candidates (>=60%) get schedule option unless already scheduled */}
                        {tier.eligible && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={isInterviewed ? { opacity: 0.5, cursor: 'not-allowed', background: '#ccc', color: '#666', boxShadow: 'none' } : {}}
                            disabled={isInterviewed}
                            onClick={() => handleOpenSingleSchedule(r)}
                          >
                            {isInterviewed ? '✓ Scheduled' : '📅 Schedule'}
                          </button>
                        )}
                        {!tier.eligible && (
                          <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontStyle: 'italic', paddingRight: '.5rem' }}>No Actions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAILED RESUME REVIEW MODAL */}
      {showReviewModal && activeCandidate && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowReviewModal(false)}>×</button>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <span>🔍 Review: {activeCandidate.candidate_name}</span>
              <span className={`status-badge ${getTierInfo(activeCandidate.match_score).badgeClass}`}>
                {activeCandidate.match_score}% Match
              </span>
            </div>

            <div className="two-col" style={{ marginTop: '.5rem', flex: 1, maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Left Column: AI analysis */}
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--blue)', fontWeight: 800 }}>Overall Fit Summary</div>
                  <p style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.5, background: 'var(--card-h)', padding: '.75rem', borderRadius: '8px', marginTop: '.25rem' }}>
                    {activeCandidate.overall_summary}
                  </p>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--green)', fontWeight: 800 }}>Strengths</div>
                  <ul className="cand-expand-list" style={{ marginTop: '.25rem' }}>
                    {activeCandidate.strengths?.map((s, idx) => (
                      <li key={idx} className="strength-item" style={{ fontSize: '.8rem' }}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--orange)', fontWeight: 800 }}>Areas of Concern / Gaps</div>
                  <ul className="cand-expand-list" style={{ marginTop: '.25rem' }}>
                    {activeCandidate.gaps?.map((g, idx) => (
                      <li key={idx} className="gap-item" style={{ fontSize: '.8rem' }}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right Column: Full resume text */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="cand-expand-title" style={{ fontSize: '.75rem', fontWeight: 800 }}>Full Resume Contents</div>
                <div style={{
                  flex: 1,
                  background: 'var(--card-h)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r)',
                  padding: '1rem',
                  fontSize: '.75rem',
                  fontFamily: 'var(--mono)',
                  color: 'var(--t2)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  marginTop: '.25rem'
                }}>
                  {activeCandidate.resume_text || "No resume text extracted."}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>Close</button>
              <button
                className="btn btn-primary"
                disabled={activeCandidate.status === 'interviewed'}
                onClick={() => handleOpenSingleSchedule(activeCandidate)}
              >
                {activeCandidate.status === 'interviewed' ? '✓ Already Scheduled' : '📅 Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULING MODAL (SINGLE & BULK) */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
            <div className="modal-title">
              {isBulkSchedule ? `Bulk Schedule Interviews (${selectedIds.length} candidates)` : `Schedule Interview`}
            </div>

            {!isBulkSchedule && activeCandidate && (
              <div style={{
                background: 'var(--blue-bg)',
                color: 'var(--blue)',
                padding: '.65rem .85rem',
                borderRadius: '8px',
                fontSize: '.75rem',
                fontWeight: 700,
                marginBottom: '1rem'
              }}>
                Candidate: {activeCandidate.candidate_name} • Fit: {activeCandidate.seniority_fit}
              </div>
            )}

            {isBulkSchedule && (
              <div style={{
                background: 'var(--grad-subtle)',
                color: 'var(--blue)',
                padding: '.65rem .85rem',
                borderRadius: '8px',
                fontSize: '.75rem',
                fontWeight: 700,
                marginBottom: '1rem',
                lineHeight: 1.4
              }}>
                💡 <strong>AI Smart Scheduling</strong> will auto-allocate separate, non-overlapping weekday time slots starting from your selected date at 10:00 AM (45 mins + 15 min buffer per slot).
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Interviewer</label>
              <input
                className="form-input"
                placeholder="e.g. John Smith"
                value={scheduleForm.interviewer_name}
                onChange={e => setScheduleForm(f => ({ ...f, interviewer_name: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="form-group">
                <label className="form-label">{isBulkSchedule ? 'Start Date' : 'Date'}</label>
                <input
                  className="form-input"
                  type="date"
                  value={scheduleForm.date}
                  onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              {!isBulkSchedule && (
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    className="form-input"
                    type="time"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                className="form-input"
                type="number"
                value={scheduleForm.duration_mins}
                onChange={e => setScheduleForm(f => ({ ...f, duration_mins: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Interview notes..."
                value={scheduleForm.notes}
                onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'none' }}
              />
            </div>

            {/* AI suggestions (only for single scheduler) */}
            {!isBulkSchedule && activeCandidate && (
              <div style={{ marginBottom: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div className="cand-expand-title" style={{ fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: '.25rem' }}>
                  <span>✦ AI Suggested Time Slots</span>
                  {suggestLoading && <span style={{ fontSize: '.6rem', opacity: .7 }}>(loading...)</span>}
                </div>
                {suggestLoading ? (
                  <div style={{ padding: '.5rem 0', display: 'flex', gap: '.5rem' }}>
                    <div className="skeleton" style={{ height: '30px', flex: 1 }}></div>
                    <div className="skeleton" style={{ height: '30px', flex: 1 }}></div>
                    <div className="skeleton" style={{ height: '30px', flex: 1 }}></div>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div style={{ fontSize: '.65rem', color: 'var(--t3)', fontStyle: 'italic', marginTop: '.25rem' }}>
                    No suggestions loaded. Click suggestions manually below.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.4rem' }}>
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => parseSuggestedSlot(s.time)}
                        style={{
                          background: 'var(--purple-bg)',
                          color: 'var(--purple)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '.4rem .6rem',
                          fontSize: '.65rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all .2s'
                        }}
                        title={s.reason}
                        className="file-chip"
                      >
                        ⏱️ {s.time}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={handleConfirmSchedule}
              disabled={submittingSchedule}
              style={{ marginTop: '.5rem' }}
            >
              {submittingSchedule ? 'Scheduling...' : isBulkSchedule ? '📅 Bulk Schedule Selected' : '📅 Confirm Interview'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
