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
  const [jobSearch, setJobSearch] = useState('')
  const jdRef = useRef(null)
  const cvRef = useRef(null)

  // AI Sourcing states
  const [sourcingLocation, setSourcingLocation] = useState('London')
  const [sourcedCandidates, setSourcedCandidates] = useState([])
  const [sourcingLoading, setSourcingLoading] = useState(false)
  const [importedUsernames, setImportedUsernames] = useState([])
  const [importingSourcedName, setImportingSourcedName] = useState(null)
  const [showSourcingPanel, setShowSourcingPanel] = useState(false)

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
  const [invitingId, setInvitingId] = useState(null)

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
          return prev
        }
        const updated = [imported, ...prev]
        updated.sort((a, b) => b.match_score - a.match_score)
        return updated
      })
      
      showToast(`Imported ${cand.name} to screening!`)
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
      {/* STEP 2: Upload CVs & AI Sourcing */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Sourcing Panel */}
          <div className="card" style={{ borderLeft: '3px solid var(--purple)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
              <div>
                <div className="card-title">🔍 AI Candidate Sourcing</div>
                <p className="card-sub">Automatically scan GitHub and other resources for profiles matching <strong>{selectedJob?.title}</strong></p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                <label className="form-label">Target City / Location</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. San Francisco, London, Berlin" 
                  value={sourcingLocation} 
                  onChange={e => setSourcingLocation(e.target.value)} 
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ alignSelf: 'flex-end', height: '42px', padding: '0 1.5rem' }} 
                onClick={handleSourceCandidates}
                disabled={sourcingLoading || !sourcingLocation}
              >
                {sourcingLoading ? 'Searching...' : '🔍 Find Candidates'}
              </button>
            </div>
            
            {/* Sourced Candidates Loading Skeleton */}
            {sourcingLoading && (
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <div className="skeleton" style={{ height: '80px', width: '100%' }}></div>
                <div className="skeleton" style={{ height: '80px', width: '100%' }}></div>
              </div>
            )}
            
            {/* Sourced Candidates List */}
            {sourcedCandidates.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--t1)' }}>
                    ✨ Found {sourcedCandidates.length} Matching Profiles in {sourcingLocation}
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={handleImportAllSourced}>
                    📥 Import All Sourced ({sourcedCandidates.filter(c => !importedUsernames.includes(c.github_username)).length})
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                  {sourcedCandidates.map(cand => {
                    const isImported = importedUsernames.includes(cand.github_username);
                    return (
                      <div 
                        key={cand.github_username}
                        style={{
                          background: 'var(--card-h)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r)',
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          position: 'relative',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: 'var(--grad)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            flexShrink: 0
                          }}>
                            {cand.name.charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{cand.name}</h4>
                              <span style={{ fontSize: '0.65rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                                Sourced Profile
                              </span>
                              <span style={{ fontSize: '0.65rem', background: '#e6fbf3', color: '#10b981', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                                Match: {cand.match_score}%
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--t3)', fontWeight: 500 }}>
                              📍 {cand.location} • 🏢 {cand.company} • 📁 {cand.public_repos} Repos
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--t2)', lineHeight: 1.4 }}>
                              {cand.bio}
                            </p>
                            <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'var(--purple)', fontWeight: 600, fontStyle: 'italic', background: 'rgba(168,85,247,0.05)', padding: '6px 10px', borderRadius: '6px' }}>
                              💡 <strong>Match Reason:</strong> {cand.match_reason}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {cand.github_url && (
                            <a 
                              href={cand.github_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn btn-sm btn-outline"
                              style={{ fontSize: '0.65rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                            >
                              🐙 GitHub
                            </a>
                          )}
                          {cand.linkedin_url && (
                            <a 
                              href={cand.linkedin_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn btn-sm btn-outline"
                              style={{ fontSize: '0.65rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px', borderColor: '#0a66c2', color: '#0a66c2' }}
                            >
                              💼 LinkedIn
                            </a>
                          )}
                          <button 
                            className={`btn btn-sm ${isImported ? 'btn-success' : 'btn-primary'}`}
                            style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                            onClick={() => handleImportSourcedCandidate(cand)}
                            disabled={isImported || importingSourcedName === cand.github_username}
                          >
                            {isImported ? '✓ Sourced' : importingSourcedName === cand.github_username ? 'Importing...' : '📥 Import'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
              <button 
                className="btn btn-outline btn-sm" 
                style={{ borderColor: 'var(--purple)', color: 'var(--purple)' }}
                onClick={() => setShowSourcingPanel(!showSourcingPanel)}
              >
                {showSourcingPanel ? '✕ Close Sourcing' : '🔍 Source More Candidates'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => { setStep(1); setResults([]); setCvFiles([]); setJdFile(null); setJdTitle(''); setShowSourcingPanel(false); }}>
                New Screening
              </button>
            </div>
          </div>

          {/* Collapsible Sourcing Panel inside Results step */}
          {showSourcingPanel && (
            <div className="card" style={{ borderLeft: '3px solid var(--purple)', marginBottom: '1.5rem', animation: 'scaleIn 0.25s ease', background: 'var(--card-h)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                <div>
                  <div className="card-title">🔍 AI Candidate Sourcing</div>
                  <p className="card-sub">Automatically scan GitHub and other resources for profiles matching <strong>{selectedJob?.title}</strong></p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                  <label className="form-label">Target City / Location</label>
                  <input 
                    className="form-input" 
                    placeholder="e.g. San Francisco, London, Berlin" 
                    value={sourcingLocation} 
                    onChange={e => setSourcingLocation(e.target.value)} 
                    style={{ background: 'var(--white)' }}
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ alignSelf: 'flex-end', height: '42px', padding: '0 1.5rem' }} 
                  onClick={handleSourceCandidates}
                  disabled={sourcingLoading || !sourcingLocation}
                >
                  {sourcingLoading ? 'Searching...' : '🔍 Find Candidates'}
                </button>
              </div>
              
              {/* Sourced Candidates Loading Skeleton */}
              {sourcingLoading && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <div className="skeleton" style={{ height: '80px', width: '100%', background: 'var(--white)' }}></div>
                  <div className="skeleton" style={{ height: '80px', width: '100%', background: 'var(--white)' }}></div>
                </div>
              )}
              
              {/* Sourced Candidates List */}
              {sourcedCandidates.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--t1)' }}>
                      ✨ Found {sourcedCandidates.length} Matching Profiles in {sourcingLocation}
                    </div>
                    <button className="btn btn-sm btn-outline" onClick={handleImportAllSourced}>
                      📥 Import All Sourced ({sourcedCandidates.filter(c => !importedUsernames.includes(c.github_username)).length})
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                    {sourcedCandidates.map(cand => {
                      const isImported = importedUsernames.includes(cand.github_username);
                      return (
                        <div 
                          key={cand.github_username}
                          style={{
                            background: 'var(--white)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--r)',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            position: 'relative',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: 'var(--grad)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.9rem',
                              flexShrink: 0
                            }}>
                              {cand.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{cand.name}</h4>
                                <span style={{ fontSize: '0.65rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                                  Sourced Profile
                                </span>
                                <span style={{ fontSize: '0.65rem', background: '#e6fbf3', color: '#10b981', padding: '2px 8px', borderRadius: '100px', fontWeight: 'bold' }}>
                                  Match: {cand.match_score}%
                                </span>
                              </div>
                              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--t3)', fontWeight: 500 }}>
                                📍 {cand.location} • 🏢 {cand.company} • 📁 {cand.public_repos} Repos
                              </p>
                              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--t2)', lineHeight: 1.4 }}>
                                {cand.bio}
                              </p>
                              <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'var(--purple)', fontWeight: 600, fontStyle: 'italic', background: 'rgba(168,85,247,0.05)', padding: '6px 10px', borderRadius: '6px' }}>
                                💡 <strong>Match Reason:</strong> {cand.match_reason}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            {cand.github_url && (
                              <a 
                                href={cand.github_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.65rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                              >
                                🐙 GitHub
                              </a>
                            )}
                            {cand.linkedin_url && (
                              <a 
                                href={cand.linkedin_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: '0.65rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '2px', borderColor: '#0a66c2', color: '#0a66c2' }}
                              >
                                💼 LinkedIn
                              </a>
                            )}
                            <button 
                              className={`btn btn-sm ${isImported ? 'btn-success' : 'btn-primary'}`}
                              style={{ fontSize: '0.65rem', padding: '4px 10px' }}
                              onClick={() => handleImportSourcedCandidate(cand)}
                              disabled={isImported || importingSourcedName === cand.github_username}
                            >
                              {isImported ? '✓ Sourced' : importingSourcedName === cand.github_username ? 'Importing...' : '📥 Import'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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
                          <div className="cand-name">{r.candidate_name}</div>
                          <div className="cand-role">{r.overall_summary?.slice(0, 65)}...</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div className="score-bar">
                          <div className="score-fill" style={{ width: `${r.match_score}%`, background: getScoreColor(r.match_score) }}></div>
                        </div>
                        <span style={{ fontSize: '.75rem', fontWeight: 800, fontFamily: 'var(--mono)', color: getScoreColor(r.match_score) }}>
                          {r.match_score}%
                        </span>
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
                        {r.match_score >= 60 && r.match_score <= 80 && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleOpenReviewModal(r)}>
                            🔍 Review
                          </button>
                        )}

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
