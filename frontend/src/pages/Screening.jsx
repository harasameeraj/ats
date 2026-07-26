import { useState, useEffect, useRef } from 'react'
import { api, BASE_URL } from '../api/client'

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
  const [jobSearch, setJobSearch] = useState('')
  const jdRef = useRef(null)
  const cvRef = useRef(null)
  const [jobToDelete, setJobToDelete] = useState(null)

  // AI Sourcing states
  const [sourcingLocation, setSourcingLocation] = useState('London')
  const [sourcedCandidates, setSourcedCandidates] = useState([])
  const [sourcingLoading, setSourcingLoading] = useState(false)
  const [importedUsernames, setImportedUsernames] = useState([])
  const [importingSourcedName, setImportingSourcedName] = useState(null)
  const [showSourcingPanel, setShowSourcingPanel] = useState(false)
  const [showTalentPool, setShowTalentPool] = useState(false)

  // Tiered Scheduling / Review States
  const [selectedIds, setSelectedIds] = useState([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [activeCandidate, setActiveCandidate] = useState(null)
  const [isBulkSchedule, setIsBulkSchedule] = useState(false)

  // Recruiter notes & rejection states
  const [notes, setNotes] = useState([])
  const [newNoteText, setNewNoteText] = useState('')
  const [modalTab, setModalTab] = useState('resume')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [candidateToReject, setCandidateToReject] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('Technical Rejected')
  const [rejectionNotes, setRejectionNotes] = useState('')
  const [talentPool, setTalentPool] = useState([])
  const [talentSearch, setTalentSearch] = useState('')
  const [associatingCandidateId, setAssociatingCandidateId] = useState(null)
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
  const [invitingId, setInvitingId] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    loadJobs()
    loadTalentPool()
    
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

  async function loadTalentPool() {
    try {
      const candidates = await api.getCandidates()
      setTalentPool(candidates.filter(c => c.status === 'talent_pool') || [])
    } catch (e) { console.error(e) }
  }

  async function handleAssociateCandidate(candidateId, jobId) {
    if (!jobId) return
    setLoading(true)
    try {
      await api.associateCandidate(candidateId, jobId)
      showToast('Candidate associated with position and re-screened successfully!')
      setAssociatingCandidateId(null)
      loadTalentPool()
      loadPastResults(jobId)
    } catch (e) {
      showToast(e.message || 'Failed to associate candidate', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSourceCandidates() {
    if (!selectedJob) {
      showToast('Please select or upload a Job Description first.', 'error')
      return
    }
    setSourcingLoading(true)
    setSourcedCandidates([])
    try {
      const res = await api.sourceCandidates(selectedJob.id, sourcingLocation)
      setSourcedCandidates(res)
      showToast(`Successfully sourced ${res.length} candidates!`)
    } catch (e) {
      showToast(e.message || 'Failed to source candidates', 'error')
    } finally {
      setSourcingLoading(false)
    }
  }

  async function handleImportSourcedCandidate(cand) {
    if (!selectedJob) return
    setImportingSourcedName(cand.github_username)
    try {
      const imported = await api.importSourcedCandidate({
        job_id: selectedJob.id,
        name: cand.name,
        email: cand.email,
        github_url: cand.github_url,
        linkedin_url: cand.linkedin_url,
        bio: cand.bio,
        match_score: cand.match_score,
        match_reason: cand.match_reason,
        skills: cand.skills
      })
      setImportedUsernames(prev => [...prev, cand.github_username])
      
      setResults(prev => {
        if (prev.some(r => r.candidate_email === imported.candidate_email)) {
          return prev.map(r => r.candidate_email === imported.candidate_email ? imported : r)
        }
        return [...prev, imported].sort((a, b) => b.match_score - a.match_score)
      })
      
      showToast(`Imported ${cand.name} successfully!`)
    } catch (e) {
      showToast(e.message || 'Failed to import candidate', 'error')
    } finally {
      setImportingSourcedName(null)
    }
  }

  async function handleImportAllSourced() {
    if (sourcedCandidates.length === 0) return
    const toImport = sourcedCandidates.filter(c => !importedUsernames.includes(c.github_username))
    if (toImport.length === 0) {
      showToast('All candidates already imported!', 'info')
      return
    }
    
    setLoading(true)
    let successCount = 0
    try {
      for (const cand of toImport) {
        const imported = await api.importSourcedCandidate({
          job_id: selectedJob.id,
          name: cand.name,
          email: cand.email,
          github_url: cand.github_url,
          linkedin_url: cand.linkedin_url,
          bio: cand.bio,
          match_score: cand.match_score,
          match_reason: cand.match_reason,
          skills: cand.skills
        })
        setImportedUsernames(prev => [...prev, cand.github_username])
        setResults(prev => {
          if (prev.some(r => r.candidate_email === imported.candidate_email)) return prev
          return [imported, ...prev]
        })
        successCount++
      }
      
      setResults(prev => [...prev].sort((a, b) => b.match_score - a.match_score))
      showToast(`Successfully imported ${successCount} candidates!`)
      setStep(4)
    } catch (e) {
      showToast(e.message || 'Error during bulk import', 'error')
    } finally {
      setLoading(false)
    }
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

  function handleDeleteJob(e, jobId) {
    e.stopPropagation(); // prevent opening the results
    setJobToDelete(jobId);
  }

  async function confirmDeleteJob() {
    if (!jobToDelete) return;
    setLoading(true);
    try {
      await api.deleteJob(jobToDelete);
      setJobs(prev => prev.filter(j => j.id !== jobToDelete));
      showToast('Screening deleted successfully!');
      setJobToDelete(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete screening', 'error');
    } finally {
      setLoading(false);
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
      .filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed' && (r.assessment_status === 'passed' || (r.assessment_status === 'failed' && r.assessment_score >= 40)))
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

  async function handleOpenReviewModal(candidate) {
    setActiveCandidate(candidate)
    setModalTab('journey')
    setNotes([])
    setNewNoteText('')
    setTimeline([])
    setShowReviewModal(true)
    
    setTimelineLoading(true)
    try {
      const res = await api.getCandidateTimeline(candidate.candidate_id)
      setTimeline(res || [])
    } catch (e) {
      console.error(e)
    } finally {
      setTimelineLoading(false)
    }

    try {
      const res = await api.getCandidateNotes(candidate.candidate_id)
      setNotes(res || [])
    } catch (e) {
      console.error(e)
    }
  }

  async function handleAddNote() {
    if (!newNoteText.trim() || !activeCandidate) return
    try {
      const newNote = await api.addCandidateNote(activeCandidate.candidate_id, newNoteText)
      setNotes(prev => [newNote, ...prev])
      setNewNoteText('')
      showToast('Note added successfully!')
    } catch (e) {
      showToast(e.message || 'Failed to add note', 'error')
    }
  }

  function handleOpenRejectModal(candidate) {
    setCandidateToReject(candidate)
    setRejectionReason('Technical Rejected')
    setRejectionNotes('')
    setShowRejectModal(true)
  }

  async function handleConfirmReject() {
    if (!candidateToReject) return
    try {
      const candId = candidateToReject.candidate_id || candidateToReject.id
      const fullReason = rejectionNotes.trim()
        ? `${rejectionReason} — ${rejectionNotes.trim()}`
        : rejectionReason
      await api.candidateAction(candId, 'reject', fullReason)
      showToast('Candidate successfully rejected!')
      setShowRejectModal(false)
      setShowReviewModal(false)
      if (selectedJob) {
        loadPastResults(selectedJob.id)
      }
      loadTalentPool()
    } catch (e) {
      showToast(e.message || 'Failed to reject candidate', 'error')
    }
  }

  async function handleMoveToTalentPool() {
    if (!candidateToReject) return
    try {
      const candId = candidateToReject.candidate_id || candidateToReject.id
      const fullReason = rejectionNotes.trim()
        ? `${rejectionReason} — ${rejectionNotes.trim()}`
        : rejectionReason
      await api.candidateAction(candId, 'talent_pool', fullReason)
      showToast('Candidate moved to Talent Pool!')
      setShowRejectModal(false)
      setShowReviewModal(false)
      if (selectedJob) {
        loadPastResults(selectedJob.id)
      }
      loadTalentPool()
    } catch (e) {
      showToast(e.message || 'Failed to move to Talent Pool', 'error')
    }
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

  async function handleSendInvite(candidateId) {
    if (!selectedJob) return
    setInvitingId(candidateId)
    try {
      await api.inviteCandidateToAssessment(candidateId, selectedJob.id)
      showToast('AI Assessment invitation sent successfully!')
      setResults(prev => prev.map(r => {
        if (r.candidate_id === candidateId) {
          return { ...r, assessment_status: 'pending' }
        }
        return r
      }))
    } catch (e) {
      showToast(e.message || 'Failed to send assessment invite', 'error')
    } finally {
      setInvitingId(null)
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
              cursor: i + 1 < step ? 'pointer' : (i === 0 ? 'pointer' : 'default')
            }}
            onClick={() => { 
              if (i + 1 < step) setStep(i + 1) 
              if (i === 0) {
                setTimeout(() => {
                  document.getElementById('jd-section')?.scrollIntoView({ behavior: 'smooth' })
                }, 50)
              }
            }}
          >
            {step > i + 1 ? '✓ ' : ''}{s}
          </div>
        ))}
      </div>

      {/* Past screenings */}
      {step === 1 && jobs.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', animation: 'scaleIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '.25rem' }}>Previous Screenings</div>
              <p className="card-sub">Select a past job description screening to review candidates and schedule interviews</p>
            </div>
            <div className="topbar-search" style={{ minWidth: '260px', background: 'var(--card-h)', margin: 0 }}>
              <span className="topbar-search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Search previous positions..." 
                value={jobSearch} 
                onChange={e => setJobSearch(e.target.value)} 
              />
              {jobSearch && (
                <span 
                  onClick={() => setJobSearch('')} 
                  style={{ cursor: 'pointer', fontSize: '.75rem', color: 'var(--t3)', padding: '0 4px' }}
                >
                  ×
                </span>
              )}
            </div>
          </div>
          
          <div style={{ 
            maxHeight: '260px', 
            overflowY: 'auto', 
            paddingRight: '6px',
            marginTop: '0.75rem'
          }}>
            {jobs.filter(j => j.title.toLowerCase().includes(jobSearch.toLowerCase())).length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--t3)', fontSize: '0.8rem' }}>
                No past screenings match "{jobSearch}"
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
                gap: '1rem' 
              }}>
                {jobs
                  .filter(j => j.title.toLowerCase().includes(jobSearch.toLowerCase()))
                  .map(j => {
                    const formattedDate = new Date(j.created_at).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    });
                    return (
                      <div 
                        key={j.id} 
                        onClick={() => loadPastResults(j.id)}
                        style={{
                          background: 'var(--white)',
                          border: '1.5px solid var(--border)',
                          borderRadius: 'var(--r)',
                          padding: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        className="screening-job-card"
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--grad-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0
                        }}>
                          💼
                        </div>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <h4 style={{ 
                            fontSize: '0.82rem', 
                            fontWeight: 700, 
                            color: 'var(--t1)', 
                            margin: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} title={j.title}>
                            {j.title}
                          </h4>
                          <span style={{ 
                            fontSize: '0.68rem', 
                            color: 'var(--t3)', 
                            display: 'block',
                            marginTop: '2px'
                          }}>
                            Uploaded {formattedDate}
                          </span>
                        </div>
                        <button 
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.25rem 0.5rem', color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent' }}
                          onClick={(e) => handleDeleteJob(e, j.id)}
                          title="Delete Screening"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}


      {/* STEP 1: Upload JD */}
      {step === 1 && (
        <div className="card" id="jd-section">
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
      
      {/* TALENT POOL DATABASE (Moved to bottom of step 1) */}
      {step === 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <button 
            className="btn btn-outline btn-full" 
            style={{ 
              background: 'var(--card-bg)', 
              borderColor: 'var(--border)', 
              color: 'var(--t2)', 
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem'
            }}
            onClick={() => setShowTalentPool(prev => !prev)}
          >
            <span>📁 Talent Pool Database</span>
            <span>{showTalentPool ? '▲' : '▼'}</span>
          </button>
          
          {showTalentPool && (
            <div className="card" style={{ marginTop: '0.5rem', animation: 'scaleIn 0.35s ease', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <p className="card-sub">Candidates kept for future opportunities. Move them back to active screenings inline.</p>
                </div>
                <div className="topbar-search" style={{ minWidth: '260px', background: 'var(--card-h)', margin: 0 }}>
                  <span className="topbar-search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search talent pool candidates..." 
                    value={talentSearch} 
                    onChange={e => setTalentSearch(e.target.value)} 
                  />
                  {talentSearch && (
                    <span 
                      onClick={() => setTalentSearch('')} 
                      style={{ cursor: 'pointer', fontSize: '.75rem', color: 'var(--t3)', padding: '0 4px' }}
                    >
                      ×
                    </span>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {talentPool.filter(c => c.name.toLowerCase().includes(talentSearch.toLowerCase()) || (c.role && c.role.toLowerCase().includes(talentSearch.toLowerCase()))).length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--t3)', fontSize: '0.8rem' }}>
                    No talent pool candidates match "{talentSearch || 'search'}"
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {talentPool
                      .filter(c => c.name.toLowerCase().includes(talentSearch.toLowerCase()) || (c.role && c.role.toLowerCase().includes(talentSearch.toLowerCase())))
                      .map(c => (
                        <div 
                          key={c.id} 
                          style={{
                            background: 'var(--white)',
                            border: '1.5px solid var(--border)',
                            borderRadius: 'var(--r)',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: 'var(--purple-bg)',
                              color: 'var(--purple)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.85rem'
                            }}>
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--t1)' }}>{c.name}</strong>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', fontSize: '0.72rem', color: 'var(--t3)' }}>
                                <span>📁 {c.role || 'General'}</span>
                                <span>•</span>
                                <span style={{ color: 'var(--purple)', fontWeight: 650 }}>{c.match_score}% Match</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {/* Review button: sets activeCandidate and opens review modal */}
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => {
                                const mockActive = {
                                  candidate_id: c.id,
                                  candidate_name: c.name,
                                  candidate_email: c.email,
                                  candidate_role: c.role,
                                  match_score: c.match_score,
                                  strengths: c.strengths ? JSON.parse(c.strengths) : [],
                                  gaps: c.gaps ? JSON.parse(c.gaps) : [],
                                  overall_summary: c.overall_summary || "No summary available.",
                                  score_justification: c.score_justification || "No justification available.",
                                  resume_text: c.resume_text,
                                  resume_filename: c.resume_filename,
                                  status: c.status,
                                  rejection_reason: c.rejection_reason
                                }
                                handleOpenReviewModal(mockActive)
                              }}
                            >
                              🔍 Review Profile
                            </button>

                            {/* Associate with Job dropdown */}
                            {associatingCandidateId === c.id ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select 
                                  className="form-input form-select"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: '32px', margin: 0 }}
                                  onChange={e => handleAssociateCandidate(c.id, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="" disabled>Select active JD...</option>
                                  {jobs.map(j => (
                                    <option key={j.id} value={j.id}>{j.title}</option>
                                  ))}
                                </select>
                                <button className="btn btn-outline btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setAssociatingCandidateId(null)}>×</button>
                              </div>
                            ) : (
                              <button 
                                className="btn btn-primary btn-sm" 
                                style={{ background: 'var(--purple)', borderColor: 'var(--purple)' }}
                                onClick={() => setAssociatingCandidateId(c.id)}
                              >
                                📥 Match to active JD
                              </button>
                            )}
                          </div>

                          {/* Recruiter Notes */}
                          {c.rejection_reason && (
                            <div style={{ 
                              width: '100%', 
                              marginTop: '0.5rem', 
                              borderTop: '1px dashed var(--border)', 
                              paddingTop: '0.5rem' 
                            }}>
                              {(() => {
                                const parts = c.rejection_reason.split(' — ')
                                const reason = parts[0]
                                const notes = parts.slice(1).join(' — ')
                                return (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--t2)', lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, color: 'var(--purple)' }}>📝 {reason}</span>
                                    {notes && (
                                      <span style={{ fontStyle: 'italic', color: 'var(--t3)' }}> — {notes}</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Upload CVs */}
      {/* STEP 2: Upload CVs & AI Sourcing */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Manual CV Upload */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div className="card-title">Screening Results</div>
              <div className="card-sub">{results.length} candidates • {selectedJob?.title}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setStep(1); setResults([]); setCvFiles([]); setJdFile(null); setJdTitle(''); setShowSourcingPanel(false); }}>
                New Screening
              </button>
            </div>
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
                      results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed' && (r.assessment_status === 'passed' || (r.assessment_status === 'failed' && r.assessment_score >= 40))).length > 0 &&
                      selectedIds.length === results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed' && (r.assessment_status === 'passed' || (r.assessment_status === 'failed' && r.assessment_score >= 40))).length
                    }
                    onChange={handleToggleSelectAll}
                    disabled={results.filter(r => getTierInfo(r.match_score).eligible && r.status !== 'interviewed' && (r.assessment_status === 'passed' || (r.assessment_status === 'failed' && r.assessment_score >= 40))).length === 0}
                  />
                </th>
                <th style={{ whiteSpace: 'nowrap' }}>Rank</th>
                <th>Candidate</th>
                <th style={{ whiteSpace: 'nowrap' }}>Match Score</th>
                <th style={{ whiteSpace: 'nowrap' }}>Fit</th>
                <th style={{ whiteSpace: 'nowrap' }}>Tier</th>
                <th style={{ whiteSpace: 'nowrap' }}>AI Test</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
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
                        disabled={!tier.eligible || isInterviewed || (r.assessment_status !== 'passed' && !(r.assessment_status === 'failed' && r.assessment_score >= 40))}
                        checked={selectedIds.includes(r.candidate_id)}
                        onChange={() => handleToggleSelect(r.candidate_id)}
                      />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
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
                          <div className="cand-name" onClick={() => handleOpenReviewModal(r)}>{r.candidate_name}</div>
                          <div className="cand-role">{r.overall_summary?.slice(0, 65)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <div className="score-bar">
                            <div className="score-fill" style={{ width: `${r.match_score}%`, background: getScoreColor(r.match_score) }}></div>
                          </div>
                          <span style={{ fontSize: '.75rem', fontWeight: 800, fontFamily: 'var(--mono)', color: getScoreColor(r.match_score) }}>
                            {r.match_score}%
                          </span>
                        </div>
                        {r.jd_vs_cv_score !== undefined && r.jd_vs_cv_score !== null && (
                          <div style={{ fontSize: '0.62rem', color: 'var(--t3)', letterSpacing: '0.01em', marginTop: '2px' }}>
                            CV: <strong style={{ color: 'var(--blue)' }}>{Math.round(r.jd_vs_cv_score)}%</strong> | LI: <strong style={{ color: 'var(--purple)' }}>{Math.round(r.jd_vs_linkedin_score)}%</strong> | GH: <strong style={{ color: 'var(--green)' }}>{Math.round(r.jd_vs_github_score)}%</strong>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '.72rem', fontWeight: 600, color: '#555570', whiteSpace: 'nowrap' }}>{r.seniority_fit}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`status-badge ${tier.badgeClass}`}>{tier.label}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {!r.assessment_status && tier.eligible && (
                        <span className="status-badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>Not Invited</span>
                      )}
                      {!r.assessment_status && !tier.eligible && (
                        <span style={{ color: 'var(--t3)', fontSize: '0.75rem' }}>—</span>
                      )}
                      {r.assessment_status === 'pending' && (
                        <span className="status-badge" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>⌛ Pending</span>
                      )}
                      {r.assessment_status === 'passed' && (
                        <span className="status-badge" style={{ background: '#e6fbf3', color: '#10b981', border: '1px solid #a7f3d0' }}>Passed ({r.assessment_score}%)</span>
                      )}
                      {r.assessment_status === 'failed' && (
                        <span className="status-badge" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}>Failed ({r.assessment_score}%)</span>
                      )}
                      {r.assessment_violations > 0 && (
                        <span className="status-badge" style={{ 
                          marginLeft: '6px', 
                          background: r.assessment_violations >= 3 ? '#fef2f2' : '#fffbeb', 
                          color: r.assessment_violations >= 3 ? '#ef4444' : '#d97706', 
                          border: r.assessment_violations >= 3 ? '1px solid #fca5a5' : '1px solid #fde68a',
                          fontWeight: 'bold'
                        }} title={`${r.assessment_violations} tab switches / focus losses detected`}>
                          ⚠️ {r.assessment_violations} {r.assessment_violations === 1 ? 'Violation' : 'Violations'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '.4rem', justifyContent: 'flex-end' }}>
                        {/* Detailed Review for match score */}
                        <button className="btn btn-outline btn-sm" onClick={() => handleOpenReviewModal(r)}>
                          🔍 Review
                        </button>

                        {/* Send AI Test Button (If not invited yet) */}
                        {!r.assessment_status && tier.eligible && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            disabled={invitingId === r.candidate_id} 
                            onClick={() => handleSendInvite(r.candidate_id)}
                            style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}
                          >
                            {invitingId === r.candidate_id ? 'Sending...' : '✉ Send AI Test'}
                          </button>
                        )}

                        {/* Invited Pending (Allows Resending) */}
                        {r.assessment_status === 'pending' && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            disabled={invitingId === r.candidate_id} 
                            onClick={() => handleSendInvite(r.candidate_id)}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {invitingId === r.candidate_id ? 'Sending...' : '✉ Resend Test'}
                          </button>
                        )}

                        {/* Passed or failed but eligible AI Test -> Show Schedule Interview Button */}
                        {((r.assessment_status === 'passed') || (r.assessment_status === 'failed' && r.assessment_score >= 40)) && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={isInterviewed ? { opacity: 0.5, cursor: 'not-allowed', background: '#ccc', color: '#666', boxShadow: 'none' } : {}}
                            disabled={isInterviewed}
                            onClick={() => handleOpenSingleSchedule(r)}
                          >
                            {isInterviewed ? '✓ Scheduled' : '📅 Schedule'}
                          </button>
                        )}

                        {/* Failed AI Test & score < 40 -> Mark as rejected */}
                        {r.assessment_status === 'failed' && r.assessment_score < 40 && (
                          <span style={{ fontSize: '.7rem', color: '#ef4444', fontWeight: 600, paddingRight: '.5rem' }}>❌ Rejected</span>
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
                      {activeCandidate.jd_vs_cv_score !== undefined && activeCandidate.jd_vs_cv_score !== null ? `${Math.round(activeCandidate.jd_vs_cv_score)}%` : 'N/A'}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--blue)', width: activeCandidate.jd_vs_cv_score !== undefined && activeCandidate.jd_vs_cv_score !== null ? `${activeCandidate.jd_vs_cv_score}%` : '0%' }}></div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>JD vs LinkedIn</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple)', margin: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px' }}>
                      {activeCandidate.jd_vs_linkedin_score !== undefined && activeCandidate.jd_vs_linkedin_score !== null ? `${Math.round(activeCandidate.jd_vs_linkedin_score)}%` : <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t3)', lineHeight: 1.2 }}>No LinkedIn link in resume</span>}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--purple)', width: activeCandidate.jd_vs_linkedin_score !== undefined && activeCandidate.jd_vs_linkedin_score !== null ? `${activeCandidate.jd_vs_linkedin_score}%` : '0%' }}></div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>JD vs GitHub</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--green)', margin: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px' }}>
                      {activeCandidate.jd_vs_github_score !== undefined && activeCandidate.jd_vs_github_score !== null ? `${Math.round(activeCandidate.jd_vs_github_score)}%` : <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--t3)', lineHeight: 1.2 }}>No GitHub link in resume</span>}
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', width: '80%', margin: '0 auto' }}>
                      <div style={{ height: '100%', background: 'var(--green)', width: activeCandidate.jd_vs_github_score !== undefined && activeCandidate.jd_vs_github_score !== null ? `${activeCandidate.jd_vs_github_score}%` : '0%' }}></div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="cand-expand-title" style={{ fontSize: '.75rem', color: 'var(--blue)', fontWeight: 800 }}>Overall Fit Summary</div>
                  <p style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.5, background: 'var(--card-h)', padding: '.75rem', borderRadius: '8px', marginTop: '.25rem' }}>
                    {activeCandidate.overall_summary}
                  </p>
                </div>

                {(activeCandidate.status === 'rejected' || activeCandidate.status === 'talent_pool') && activeCandidate.rejection_reason && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div className="cand-expand-title" style={{ fontSize: '.75rem', color: activeCandidate.status === 'rejected' ? '#ef4444' : 'var(--purple)', fontWeight: 800 }}>
                      {activeCandidate.status === 'rejected' ? '❌ Rejection Details' : '📂 Talent Pool Notes'}
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
                      {/* Parse the combined "Reason — Notes" format */}
                      {(() => {
                        const parts = activeCandidate.rejection_reason.split(' — ')
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
                    💡 {activeCandidate.score_justification || "No justification available for this candidate's match score."}
                  </div>
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
                    {activeCandidate.resume_filename ? (
                      <>
                        <div style={{ padding: '0.5rem 1rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--t1)' }}>Original Document</span>
                          <a href={`${BASE_URL}/uploads/cv_${activeCandidate.resume_filename}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                            Open in New Tab
                          </a>
                        </div>
                        <iframe
                          src={`${BASE_URL}/uploads/cv_${activeCandidate.resume_filename}`}
                          style={{ flex: 1, width: '100%', border: 'none', borderRadius: '0 0 calc(var(--r) - 2px) calc(var(--r) - 2px)' }}
                          title="Resume Document"
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
                        placeholder="Add recruiter note or update..."
                        style={{ fontSize: '0.8rem', flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add</button>
                    </div>

                    {/* Notes Feed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                      {notes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '0.75rem', marginTop: '2rem' }}>No recruiter notes yet. Add one above!</div>
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
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>Close</button>
              {activeCandidate.status !== 'rejected' && (
                <button className="btn btn-danger" onClick={() => handleOpenRejectModal(activeCandidate)}>
                  ❌ Reject
                </button>
              )}

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

      {/* REJECTION REASON MODAL */}
      {showRejectModal && candidateToReject && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            <div className="modal-title">Reject Candidate</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--t2)', marginBottom: '1.25rem' }}>
              Select a rejection reason for <strong>{candidateToReject.candidate_name || candidateToReject.name}</strong>:
            </p>
            
            <div className="form-group">
              <label className="form-label">Rejection Reason</label>
              <select 
                className="form-input form-select"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--t1)' }}
              >
                <option value="Technical Rejected">Technical Rejected</option>
                <option value="Salary Mismatch">Salary Mismatch</option>
                <option value="Position Closed">Position Closed</option>
                <option value="Keep for Future Opportunities">Keep for Future Opportunities</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Additional Recruiter Notes <span style={{ color: 'var(--t3)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="form-input"
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                placeholder="Add any additional context, feedback, or notes for future reference..."
                rows={3}
                style={{ width: '100%', resize: 'vertical', fontSize: '0.8rem', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: '4px' }}>These notes will be saved alongside the rejection reason and are viewable in the candidate's profile.</div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--purple)', borderColor: 'var(--purple)' }} 
                onClick={handleMoveToTalentPool}
              >
                📂 Move to Talent Pool
              </button>
              <button className="btn btn-danger" onClick={handleConfirmReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Confirmation Modal */}
      {jobToDelete && (
        <div className="modal-overlay" onClick={() => setJobToDelete(null)}>
          <div className="modal" style={{ maxWidth: '450px', textAlign: 'center', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.75rem' }}>Delete AI Screening?</h2>
            <p style={{ color: 'var(--t2)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              Are you sure you want to permanently delete this AI screening pipeline? All candidates and AI metrics associated with it will be removed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setJobToDelete(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }} onClick={confirmDeleteJob}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
