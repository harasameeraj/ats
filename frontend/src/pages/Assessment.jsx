import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'

export default function Assessment() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Assessment info
  const [info, setInfo] = useState(null) // { candidate_name, job_title, questions: [] }
  const [answers, setAnswers] = useState(Array(10).fill(''))
  
  // UI states
  const [currentStep, setCurrentStep] = useState(0) // 0 = Welcome, 1-10 = Questions, 11 = Grading/Result
  const [grading, setGrading] = useState(false)
  const [result, setResult] = useState(null) // { score, status, overall_feedback }

  // Anti-cheating states
  const [violations, setViolations] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [copyPasteWarning, setCopyPasteWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(45)
  
  // Camera & Recording states/refs
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [cameraInterrupted, setCameraInterrupted] = useState(false)
  const videoPreviewRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const videoChunksRef = useRef([])
  const recordingStartTimeRef = useRef(null)

  // Create refs to access current state inside event handlers
  const currentStepRef = useRef(currentStep)
  const answersRef = useRef(answers)
  const violationsRef = useRef(violations)
  const isSubmittingRef = useRef(false)
  const timeLeftRef = useRef(45)
  const timerStepRef = useRef(currentStep)

  useEffect(() => {
    currentStepRef.current = currentStep
  }, [currentStep])

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  useEffect(() => {
    violationsRef.current = violations
  }, [violations])

  useEffect(() => {
    fetchInfo()
  }, [token])

  async function fetchInfo() {
    try {
      const data = await api.getAssessmentInfo(token)
      setInfo(data)
    } catch (e) {
      setError(e.message || 'Invalid or expired assessment link.')
    } finally {
      setLoading(false)
    }
  }

  const startCameraPreview = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true })
      streamRef.current = stream
      setCameraActive(true)
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
      }
      
      // Track event listeners to detect camera/microphone interruption
      stream.getVideoTracks().forEach(track => {
        track.onended = () => setCameraInterrupted(true)
        track.onmute = () => setCameraInterrupted(true)
      })
      stream.getAudioTracks().forEach(track => {
        track.onended = () => setCameraInterrupted(true)
        track.onmute = () => setCameraInterrupted(true)
      })
    } catch (err) {
      console.error("Camera access error:", err)
      setCameraError("Webcam access is required to take this assessment.")
      setCameraActive(false)
    }
  }, [])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    videoChunksRef.current = []
    recordingStartTimeRef.current = Date.now()
    try {
      let options = { mimeType: 'video/webm;codecs=vp9' }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8'
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
      }
      
      const recorder = new MediaRecorder(streamRef.current, options)
      mediaRecorderRef.current = recorder
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data)
        }
      }
      
      recorder.start(1000)
      console.log("MediaRecorder started.")
    } catch (e) {
      console.error("Failed to start MediaRecorder:", e)
    }
  }, [])

  const stopAndUploadRecording = useCallback(async () => {
    const cleanupStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log(`Track ${track.kind} stopped.`)
        })
        streamRef.current = null
      }
      setCameraActive(false)
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      cleanupStream()
      return
    }
    
    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        console.log("MediaRecorder stopped. Uploading blob...")
        const rawBlob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        
        cleanupStream()
        
        const duration = recordingStartTimeRef.current ? (Date.now() - recordingStartTimeRef.current) : 0
        console.log(`Recorded duration: ${duration}ms. Fixing WebM seekability...`)
        
        let finalBlob = rawBlob
        if (duration > 0) {
          try {
            const fixWebmDuration = (await import('fix-webm-duration')).default
            finalBlob = await fixWebmDuration(rawBlob, duration)
            console.log("WebM duration metadata fixed successfully.")
          } catch (err) {
            console.error("Failed to fix WebM duration:", err)
          }
        }
        
        try {
          await api.uploadAssessmentRecording(token, finalBlob)
          console.log("Recording uploaded successfully.")
        } catch (err) {
          console.error("Recording upload failed:", err)
        }
        resolve()
      }
      mediaRecorderRef.current.stop()
    })
  }, [token])

  useEffect(() => {
    if (currentStep === 0 && info) {
      startCameraPreview()
    }
  }, [currentStep, info, startCameraPreview])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  function handleAnswerChange(val) {
    const newAnswers = [...answers]
    newAnswers[currentStep - 1] = val
    setAnswers(newAnswers)
  }

  const handleSubmit = useCallback(async (vCount = violationsRef.current) => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setGrading(true)
    setCurrentStep(11) // Move to grading view
    
    // Stop recording and upload
    await stopAndUploadRecording().catch(err => console.error("Upload recording err:", err))
    
    // Exit fullscreen when done/submitting
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }

    try {
      const payload = { 
        answers: answersRef.current, 
        violations: vCount 
      }
      const res = await api.submitAssessment(token, payload)
      setResult(res)
    } catch (e) {
      setError(e.message || 'Failed to submit assessment. Please try again.')
    } finally {
      setGrading(false)
    }
  }, [token, stopAndUploadRecording])

  const handleNextStep = useCallback(() => {
    if (currentStepRef.current < 10) {
      setCurrentStep(prev => prev + 1)
    } else if (currentStepRef.current === 10) {
      handleSubmit()
    }
  }, [handleSubmit])

  useEffect(() => {
    if (currentStep < 1 || currentStep > 10 || showWarning || cameraInterrupted || grading) return

    timerStepRef.current = currentStep
    timeLeftRef.current = 45
    setTimeLeft(45)

    const timer = setInterval(() => {
      // Check if the current step matches the step this interval was created for
      if (currentStepRef.current !== timerStepRef.current) {
        clearInterval(timer)
        return
      }

      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)

      if (timeLeftRef.current <= 0) {
        clearInterval(timer)
        handleNextStep()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [currentStep, showWarning, cameraInterrupted, grading, handleNextStep])

  const handleDownloadCertificate = () => {
    if (!info || !result) return
    
    const canvas = document.createElement('canvas')
    canvas.width = 1000
    canvas.height = 700
    const ctx = canvas.getContext('2d')
    
    // Background color cream/white
    ctx.fillStyle = '#faf9f6'
    ctx.fillRect(0, 0, 1000, 700)
    
    // Outer border
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 8
    ctx.strokeRect(25, 25, 950, 650)
    
    // Gold inner border
    ctx.strokeStyle = '#d4af37'
    ctx.lineWidth = 3
    ctx.strokeRect(38, 38, 924, 624)
    
    // Draw corner flourishes
    const drawCorner = (x, y, rot) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.strokeStyle = '#d4af37'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(0, 30)
      ctx.lineTo(0, 0)
      ctx.lineTo(30, 0)
      ctx.stroke()
      ctx.restore()
    }
    drawCorner(45, 45, 0)
    drawCorner(955, 45, Math.PI / 2)
    drawCorner(955, 655, Math.PI)
    drawCorner(45, 655, -Math.PI / 2)
    
    // Header Text
    ctx.fillStyle = '#0f172a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 28px Georgia, serif'
    ctx.fillText('CERTIFICATE OF ACCOMPLISHMENT', 500, 105)
    
    // Divider line
    ctx.strokeStyle = '#d4af37'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(350, 135)
    ctx.lineTo(650, 135)
    ctx.stroke()
    
    // Presentation line
    ctx.fillStyle = '#475569'
    ctx.font = 'italic 18px Georgia, serif'
    ctx.fillText('This is proudly presented to', 500, 185)
    
    // Candidate Name
    ctx.fillStyle = '#1e3a8a'
    ctx.font = 'bold 44px Georgia, serif'
    ctx.fillText(info.candidate_name, 500, 245)
    
    // Underline
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(250, 280)
    ctx.lineTo(750, 280)
    ctx.stroke()
    
    // Text description
    ctx.fillStyle = '#475569'
    ctx.font = '18px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText('for successfully qualifying the AI-evaluated technical screening assessment for', 500, 335)
    
    // Job Title
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.fillText(info.job_title, 500, 380)
    
    // Score/Date info
    ctx.fillStyle = '#475569'
    ctx.font = '18px "Helvetica Neue", Arial, sans-serif'
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    ctx.fillText(`with a passing score of ${result.score}% on ${dateStr}`, 500, 425)
    
    // Gold ribbons under the seal
    ctx.fillStyle = '#b5922c'
    ctx.beginPath()
    ctx.moveTo(480, 520)
    ctx.lineTo(460, 615)
    ctx.lineTo(485, 600)
    ctx.lineTo(500, 615)
    ctx.lineTo(495, 520)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(500, 520)
    ctx.lineTo(505, 600)
    ctx.lineTo(515, 615)
    ctx.lineTo(540, 615)
    ctx.lineTo(520, 520)
    ctx.closePath()
    ctx.fill()
    
    // Draw Seal Starburst
    const cx = 500
    const cy = 520
    const spikes = 30
    const outerRadius = 45
    const innerRadius = 38
    
    let rot = (Math.PI / 2) * 3
    let x = cx
    let y = cy
    let step = Math.PI / spikes

    ctx.beginPath()
    ctx.moveTo(cx, cy - outerRadius)
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius
      y = cy + Math.sin(rot) * outerRadius
      ctx.lineTo(x, y)
      rot += step

      x = cx + Math.cos(rot) * innerRadius
      y = cy + Math.sin(rot) * innerRadius
      ctx.lineTo(x, y)
      rot += step
    }
    ctx.lineTo(cx, cy - outerRadius)
    ctx.closePath()
    ctx.fillStyle = '#d4af37'
    ctx.fill()
    
    // Inner white circle on seal
    ctx.beginPath()
    ctx.arc(cx, cy, 33, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // Text in seal
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9px "Helvetica Neue", sans-serif'
    ctx.fillText('STITCH', cx, cy - 8)
    ctx.font = 'bold 8px "Helvetica Neue", sans-serif'
    ctx.fillText('AI PASSED', cx, cy + 4)
    ctx.font = 'bold 9px "Helvetica Neue", sans-serif'
    ctx.fillText('★', cx, cy + 15)
    
    // Signatures
    // Left Sign
    ctx.fillStyle = '#0f172a'
    ctx.font = 'italic 20px Georgia, serif'
    ctx.fillText('Stitch ATS', 220, 525)
    
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(100, 545)
    ctx.lineTo(340, 545)
    ctx.stroke()
    
    ctx.fillStyle = '#64748b'
    ctx.font = '11px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText('ISSUING AUTHORITY', 220, 565)
    
    // Right Sign
    ctx.fillStyle = '#0f172a'
    ctx.font = 'italic 20px Georgia, serif'
    ctx.fillText('AI Agent Evaluator v2.5', 780, 525)
    
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(660, 550)
    ctx.lineTo(900, 550)
    ctx.stroke()
    
    ctx.fillStyle = '#64748b'
    ctx.font = '11px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText('VERIFICATION AGENT', 780, 565)
    
    // Download
    const link = document.createElement('a')
    link.download = `${info.candidate_name.replace(/\s+/g, '_')}_Stitch_Assessment_Certificate.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Anti-cheating & copy-paste prevention event handlers
  useEffect(() => {
    const step = currentStepRef.current
    if (step < 1 || step > 10) return

    const triggerViolation = () => {
      // Avoid double-triggering warnings
      if (showWarning || isSubmittingRef.current) return

      const nextViolations = violationsRef.current + 1
      setViolations(nextViolations)

      if (nextViolations >= 3) {
        handleSubmit(nextViolations)
      } else {
        setShowWarning(true)
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        triggerViolation()
      }
    }

    const handleBlur = () => {
      // Small timeout to ignore brief blurs during fullscreen transitions
      setTimeout(() => {
        if (!document.hidden && !document.hasFocus() && !isSubmittingRef.current) {
          triggerViolation()
        }
      }, 100)
    }

    const handleFullscreen = () => {
      if (!document.fullscreenElement && !isSubmittingRef.current) {
        triggerViolation()
      }
    }

    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    // Disable copy command
    const handleCopy = (e) => {
      e.preventDefault()
      setCopyPasteWarning(true)
      setTimeout(() => setCopyPasteWarning(false), 4000)
    }

    // Block keyboard shortcuts (Ctrl/Cmd + C, Ctrl/Cmd + V)
    const handleKeyDown = (e) => {
      const isCopy = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'
      const isPaste = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v'
      if (isCopy || isPaste) {
        e.preventDefault()
        setCopyPasteWarning(true)
        setTimeout(() => setCopyPasteWarning(false), 4000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('fullscreenchange', handleFullscreen)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('fullscreenchange', handleFullscreen)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentStep, showWarning, handleSubmit])

  // Periodic active camera stream verification
  useEffect(() => {
    const step = currentStep
    if (step < 1 || step > 10 || grading || showWarning) return

    const checkCamera = () => {
      const stream = streamRef.current
      if (!stream) {
        setCameraInterrupted(true)
        return
      }
      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()
      if (videoTracks.length === 0 || audioTracks.length === 0) {
        setCameraInterrupted(true)
        return
      }
      const hasActiveVideo = videoTracks.some(track => track.enabled && track.readyState === 'live')
      const hasActiveAudio = audioTracks.some(track => track.enabled && track.readyState === 'live')
      if (!hasActiveVideo || !hasActiveAudio) {
        setCameraInterrupted(true)
      }
    }

    const interval = setInterval(checkCamera, 2000)
    return () => clearInterval(interval)
  }, [currentStep, grading, showWarning])

  const handleStart = () => {
    if (!cameraActive) {
      alert("Webcam access is required to take this assessment. Please allow camera access to continue.")
      return
    }

    // Attempt fullscreen
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.warn("Fullscreen permission not granted or failed:", err)
      })
    }

    // Start recording
    startRecording()

    setCurrentStep(1)
  }

  const handleResume = () => {
    setShowWarning(false)
    // Re-request fullscreen
    const elem = document.documentElement
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.warn("Fullscreen restoration failed:", err)
      })
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
        <div style={{ marginTop: '1rem', color: 'var(--t2)', fontWeight: 600 }}>Loading Assessment details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '2.5rem', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.5rem' }}>Assessment Link Error</h2>
          <p style={{ color: 'var(--t2)', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{error}</p>
          <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>
            If you believe this is an error, please contact the recruitment team at the company you applied for.
          </div>
        </div>
      </div>
    )
  }

  // Anti-cheating Warning Screen
  if (showWarning && currentStep >= 1 && currentStep <= 10) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#fff',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          background: 'linear-gradient(135deg, #1e1b4b, #311042)',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)'
        }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>🚨</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginBottom: '1rem' }}>
            Anti-Cheating Policy Warning
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            You have switched tabs, minimized the window, or exited fullscreen mode. 
            This is a direct violation of the assessment rules.
          </p>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '2rem'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5' }}>
              Warning Status: {violations} of 2 Warnings Used
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            Continuing to switch tabs or lose focus will result in the test being locked and auto-submitted with a violation flag.
          </p>
          <button
            className="btn btn-primary"
            style={{
              padding: '0.85rem 2.5rem',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #ef4444, #b91c1c)',
              borderColor: '#ef4444'
            }}
            onClick={handleResume}
          >
            I Understand, Resume Test
          </button>
        </div>
      </div>
    )
  }

  // Camera Interruption Screen
  if (cameraInterrupted && currentStep >= 1 && currentStep <= 10) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#fff',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          background: 'linear-gradient(135deg, #1e1b4b, #111827)',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.3)'
        }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>📷</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginBottom: '1rem' }}>
            Webcam Feed Interrupted
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Your camera feed was turned off, disconnected, or blocked. Continuous webcam monitoring is strictly required during this assessment.
          </p>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '1rem',
            borderRadius: '10px',
            marginBottom: '2rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            Please ensure your webcam is connected and you have granted permission, then click the button below to resume.
          </div>
          <button
            className="btn btn-primary"
            style={{
              padding: '0.85rem 2.5rem',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
              borderColor: '#6366f1'
            }}
            onClick={async () => {
              try {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(t => t.stop())
                }
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true })
                streamRef.current = stream
                if (videoPreviewRef.current) {
                  videoPreviewRef.current.srcObject = stream
                }
                
                // Re-bind listeners on new stream
                stream.getVideoTracks().forEach(track => {
                  track.onended = () => setCameraInterrupted(true)
                  track.onmute = () => setCameraInterrupted(true)
                })
                stream.getAudioTracks().forEach(track => {
                  track.onended = () => setCameraInterrupted(true)
                  track.onmute = () => setCameraInterrupted(true)
                })

                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                  mediaRecorderRef.current.stop()
                }

                let options = { mimeType: 'video/webm;codecs=vp9' }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                  options.mimeType = 'video/webm;codecs=vp8'
                }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                  options.mimeType = 'video/webm'
                }
                const recorder = new MediaRecorder(stream, options)
                mediaRecorderRef.current = recorder
                recorder.ondataavailable = (event) => {
                  if (event.data && event.data.size > 0) {
                    videoChunksRef.current.push(event.data)
                  }
                }
                recorder.start(1000)
                setCameraActive(true)
                setCameraInterrupted(false)
              } catch (err) {
                alert("Could not access camera. Please check your camera connection and browser permissions.")
              }
            }}
          >
            🔄 Re-enable Camera & Resume
          </button>
        </div>
      </div>
    )
  }

  // Welcome Step
  if (currentStep === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '3rem', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', textAlign: 'center', borderRadius: '16px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <svg viewBox="0 0 32 32" fill="none" width="48" height="48" style={{ margin: '0 auto' }}>
              <rect width="32" height="32" rx="8" fill="url(#alg)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="alg" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.5rem' }}>Stitch AI Assessment</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
            {info.job_title} Position
          </p>
          <p style={{ color: 'var(--t2)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Hello <strong>{info.candidate_name}</strong>, you have been invited to complete this automated screening assessment. 
            There are <strong>10 questions</strong> tailored for this role. Your answers will be analyzed by our AI evaluation engine.
          </p>

          {/* Webcam Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              width: '180px', 
              height: '135px', 
              borderRadius: '12px', 
              background: '#000', 
              overflow: 'hidden', 
              position: 'relative',
              border: '2.5px solid var(--border)',
              boxShadow: 'var(--shadow)',
              marginBottom: '0.5rem'
            }}>
              {cameraActive ? (
                <video 
                  ref={videoPreviewRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', color: '#fff', fontSize: '0.7rem', padding: '10px', textAlign: 'center', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📷</span>
                  <span style={{ lineHeight: 1.3 }}>{cameraError || "Requesting webcam access..."}</span>
                </div>
              )}
            </div>
            {cameraActive && (
              <span style={{ fontSize: '0.72rem', color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                🟢 Webcam & Microphone Active
              </span>
            )}
          </div>

          <div style={{ textAlign: 'left', background: 'var(--bg)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '0.5rem' }}>ℹ️ Assessment Instructions & Policy:</h3>
            <ul style={{ fontSize: '0.8rem', color: 'var(--t2)', paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Write clear, direct answers (typically 2-4 sentences is ideal).</li>
              <li>There is no timer, so feel free to take your time drafting responses.</li>
              <li>You cannot go back to previous questions once submitted.</li>
              <li><strong>Anti-Cheating & Webcam/Microphone Policy:</strong> The assessment is recorded via webcam and microphone. It must be taken in Fullscreen. Tab switches, selection, right-clicks, and screen exiting will trigger alerts. Exceeding 2 warnings will lock the test.</li>
            </ul>
          </div>

          <button 
            className="btn btn-primary btn-full" 
            style={{ 
              padding: '0.9rem', 
              fontSize: '0.95rem', 
              fontWeight: 700,
              opacity: cameraActive ? 1 : 0.6,
              cursor: cameraActive ? 'pointer' : 'not-allowed',
              background: cameraActive ? 'var(--blue)' : '#475569',
              borderColor: cameraActive ? 'var(--blue)' : '#475569'
            }}
            disabled={!cameraActive}
            onClick={handleStart}
          >
            {cameraActive ? "Start Assessment →" : "🔒 Enable Webcam to Start"}
          </button>
        </div>
      </div>
    )
  }

  // Grading/Result Step
  if (currentStep === 11) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '750px', width: '100%', padding: '2.5rem', border: '1px solid var(--border)', textAlign: 'center', borderRadius: '16px', transition: 'max-width 0.3s ease' }}>
          {grading ? (
            <div style={{ padding: '2rem 0' }}>
              <div className="spinner" style={{ width: '45px', height: '45px', margin: '0 auto 1.5rem' }}></div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>
                ✦ AI is Grading Your Responses
              </h2>
              <p style={{ color: 'var(--t2)', fontSize: '0.88rem', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
                Please wait a moment while our recruitment model analyzes your answers. Do not close or refresh this page.
              </p>
            </div>
          ) : (
            <div>
              {violations >= 3 ? (
                <div style={{ animation: 'scaleIn 0.4s ease' }}>
                  <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🚨</span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.5rem' }}>Assessment Terminated</h2>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--t2)', marginBottom: '1.5rem' }}>
                    Status: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Locked due to policy violations</span>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '1.25rem', borderRadius: '12px', textAlign: 'left', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#b91c1c', marginBottom: '0.4rem' }}>Evaluation Summary:</h4>
                    <p style={{ fontSize: '0.82rem', color: '#b91c1c', margin: 0, lineHeight: '1.6' }}>
                      This test was terminated because the window focus was lost 3 times. Your partial answers were submitted automatically. Score: {result?.score}%
                    </p>
                  </div>
                  <p style={{ color: 'var(--t2)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    No further modifications to your answers are permitted. The hiring team has been notified.
                  </p>
                </div>
              ) : result?.status === 'passed' ? (
                <div style={{ animation: 'scaleIn 0.4s ease' }}>
                  <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginBottom: '0.5rem' }}>Assessment Passed!</h2>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--t2)', marginBottom: '1rem' }}>
                    Score: <span style={{ color: '#10b981', fontSize: '1.3rem' }}>{result.score}%</span>
                  </div>

                  {/* Certificate Preview Box */}
                  <div style={{
                    background: '#faf9f6',
                    border: '4px double #d4af37',
                    borderRadius: '12px',
                    padding: '2rem 1.5rem',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
                    margin: '1.5rem auto 1.5rem',
                    maxWidth: '520px',
                    color: '#0f172a',
                    fontFamily: 'Georgia, serif',
                    position: 'relative',
                    textAlign: 'center',
                    borderStyle: 'double'
                  }}>
                    <div style={{ fontSize: '0.7rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      Certificate of Accomplishment
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#1e3a8a', marginTop: '0.5rem' }}>
                      {info?.candidate_name}
                    </div>
                    <div style={{ borderBottom: '1px solid #cbd5e1', width: '50%', margin: '0.75rem auto' }}></div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: '1.6', margin: '0.75rem 0' }}>
                      has successfully qualified the AI-evaluated technical screening assessment for the role of
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0f172a', margin: '0.25rem 0' }}>
                        {info?.job_title}
                      </div>
                      with a passing score of <strong>{result.score}%</strong>.
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#0f172a' }}>Stitch ATS</div>
                        <div style={{ fontSize: '0.52rem', color: '#94a3b8', fontWeight: 'bold' }}>ISSUING AUTHORITY</div>
                      </div>
                      
                      <div style={{
                        width: '42px',
                        height: '42px',
                        background: '#d4af37',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.5rem',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 6px rgba(212, 175, 55, 0.3)',
                        border: '1.5px solid #fff'
                      }}>
                        AI PASSED
                      </div>
                      
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#0f172a' }}>AI Grader</div>
                        <div style={{ fontSize: '0.52rem', color: '#94a3b8', fontWeight: 'bold' }}>VERIFICATION AGENT</div>
                      </div>
                    </div>
                  </div>

                  {/* Download button */}
                  <button 
                    className="btn"
                    onClick={handleDownloadCertificate}
                    style={{ 
                      padding: '0.8rem 2rem', 
                      fontSize: '0.9rem', 
                      fontWeight: 700, 
                      marginBottom: '2rem',
                      background: 'linear-gradient(90deg, #d4af37, #b5922c)',
                      border: '1px solid #b5922c',
                      color: '#ffffff',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)'
                    }}
                  >
                    🏆 Download Official Certificate (PNG)
                  </button>

                  <div style={{ background: '#e6fbf3', border: '1px solid #c1f2e1', padding: '1.25rem', borderRadius: '12px', textAlign: 'left', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669', marginBottom: '0.4rem' }}>Evaluation Summary:</h4>
                    <p style={{ fontSize: '0.82rem', color: '#047857', margin: 0, lineHeight: '1.6' }}>{result.overall_feedback}</p>
                  </div>
                  <p style={{ color: 'var(--t2)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    Great job! You have qualified for this position. The hiring manager has been notified and will be in touch with you shortly to coordinate interviews.
                  </p>
                </div>
              ) : (
                <div style={{ animation: 'scaleIn 0.4s ease' }}>
                  <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>✉️</span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.5rem' }}>Assessment Completed</h2>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--t2)', marginBottom: '1.5rem' }}>
                    Score: <span style={{ color: '#ef4444', fontSize: '1.3rem' }}>{result?.score}%</span> (Requires 60%+ to pass)
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '1.25rem', borderRadius: '12px', textAlign: 'left', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#b91c1c', marginBottom: '0.4rem' }}>Evaluation Summary:</h4>
                    <p style={{ fontSize: '0.82rem', color: '#b91c1c', margin: 0, lineHeight: '1.6' }}>{result?.overall_feedback}</p>
                  </div>

                  {/* Detailed Performance Breakdown for Failed Candidates */}
                  {result?.question_feedback && result.question_feedback.length > 0 && (
                    <div style={{ textAlign: 'left', marginTop: '2rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        Detailed Performance Feedback
                      </h3>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1rem', 
                        maxHeight: '400px', 
                        overflowY: 'auto', 
                        paddingRight: '8px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        padding: '1.25rem', 
                        background: 'var(--bg)',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        {result.question_feedback.map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              paddingBottom: '1rem', 
                              borderBottom: idx === result.question_feedback.length - 1 ? 'none' : '1px solid var(--border)' 
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '12px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--t1)' }}>
                                Q{idx + 1}: {item.question}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: item.score >= 7 ? '#e6fbf3' : item.score >= 4 ? '#fffbeb' : '#fef2f2',
                                color: item.score >= 7 ? '#10b981' : item.score >= 4 ? '#d97706' : '#ef4444',
                                border: item.score >= 7 ? '1px solid #a7f3d0' : item.score >= 4 ? '1px solid #fde68a' : '1px solid #fca5a5',
                                whiteSpace: 'nowrap'
                              }}>
                                Score: {item.score}/10
                              </span>
                            </div>
                            <div style={{ 
                              fontSize: '0.82rem', 
                              color: 'var(--t2)', 
                              fontStyle: 'italic', 
                              marginBottom: '0.5rem', 
                              background: 'var(--white)', 
                              padding: '0.6rem 0.85rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border)',
                              lineHeight: '1.5'
                            }}>
                              "{item.answer || "[No Answer Provided]"}"
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--t2)', lineHeight: '1.5' }}>
                              <strong style={{ color: 'var(--blue)' }}>AI Critique:</strong> {item.feedback}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p style={{ color: 'var(--t2)', fontSize: '0.9rem', lineHeight: '1.6', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    Thank you for your time. Your answers have been successfully submitted and logged. Our hiring team will review your complete application profile.
                  </p>
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--t3)', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                You can now safely close this browser window.
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Question Step (1 to 10)
  const currentQuestionIndex = currentStep - 1
  const currentQuestionText = info.questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestionIndex] || ''
  const wordCount = currentAnswer.trim().split(/\s+/).filter(Boolean).length
  const minWords = 3 // let's enforce a very low limit to make testing easy but prevent empty submissions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: '20px' }}>
      <div className="card" style={{ maxWidth: '700px', width: '100%', padding: '2.5rem', border: '1px solid var(--border)', borderRadius: '16px' }}>
        
        {/* Progress Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 700 }}>
            QUESTION {currentStep} OF 10
          </span>
          <span style={{ 
            fontSize: '0.9rem', 
            fontWeight: 800, 
            color: timeLeft <= 10 ? '#ef4444' : 'var(--blue)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            animation: timeLeft <= 10 ? 'pulse 1s infinite' : 'none'
          }}>
            ⏱️ {timeLeft}s remaining
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 700 }}>
            {Math.round((currentStep / 10) * 100)}% Complete
          </span>
        </div>
        
        {/* Progress Bar */}
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ 
            width: `${(currentStep / 10) * 100}%`, 
            height: '100%', 
            background: `hsl(${((currentStep - 1) / 9) * 120}, 85%, 45%)`, 
            transition: 'width 0.3s ease, background-color 0.3s ease' 
          }}></div>
        </div>

        {/* Question Block (Non-selectable) */}
        <div style={{ marginBottom: '2rem', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--t1)', lineHeight: '1.5', margin: 0 }}>
            {currentQuestionText}
          </h2>
        </div>

        {/* Answer Area */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <textarea
            className="form-input"
            value={currentAnswer}
            onChange={e => handleAnswerChange(e.target.value)}
            onPaste={e => {
              e.preventDefault()
              setCopyPasteWarning(true)
              setTimeout(() => setCopyPasteWarning(false), 4000)
            }}
            placeholder="Type your response here..."
            style={{ 
              minHeight: '160px', 
              fontFamily: 'inherit', 
              fontSize: '0.9rem', 
              lineHeight: '1.6', 
              resize: 'vertical',
              padding: '1rem',
              borderRadius: '10px'
            }}
          />
          {copyPasteWarning && (
            <div style={{
              background: '#fef2f2',
              color: '#ef4444',
              border: '1px solid #fca5a5',
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              marginTop: '0.5rem',
              animation: 'scaleIn 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚠️</span> Copy-pasting is disabled for security reasons. Please type your response directly.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem', fontSize: '0.72rem', color: wordCount < minWords ? '#f87171' : 'var(--t3)' }}>
            {wordCount} words (Minimum {minWords} words required)
          </div>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          {currentStep < 10 ? (
            <button
              className="btn btn-primary"
              disabled={wordCount < minWords}
              onClick={() => setCurrentStep(prev => prev + 1)}
              style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
            >
              Next Question →
            </button>
          ) : (
            <button
              className="btn btn-success"
              disabled={wordCount < minWords}
              onClick={() => handleSubmit()}
              style={{ padding: '0.75rem 2rem', fontWeight: 700, background: 'linear-gradient(90deg, #34d399, #059669)', borderColor: '#10b981' }}
            >
              Submit Assessment 🏁
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
