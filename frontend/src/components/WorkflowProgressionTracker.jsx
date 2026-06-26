import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function WorkflowProgressionTracker({ selectedStage, onStageSelect, activeRole }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchCandidates() {
    try {
      const cands = await api.getCandidates()
      setCandidates(cands)
    } catch (e) {
      console.error("Error fetching candidates for progression tracker:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates()

    // Listen to custom refresh events
    window.addEventListener('refreshCandidates', fetchCandidates)
    window.addEventListener('roleChanged', fetchCandidates)

    return () => {
      window.removeEventListener('refreshCandidates', fetchCandidates)
      window.removeEventListener('roleChanged', fetchCandidates)
    }
  }, [])

  // Calculate counts dynamically
  const screeningCount = candidates.filter(c => c.status !== 'rejected' && ['uploaded', 'screened'].includes(c.status.toLowerCase())).length
  const techCount = candidates.filter(c => c.status !== 'rejected' && ['shortlisted', 'interviewed'].includes(c.status.toLowerCase()) && c.delivery_verdict !== 'APPROVED' && c.delivery_verdict !== 'REJECTED').length
  const clientCount = candidates.filter(c => c.status !== 'rejected' && c.delivery_verdict === 'APPROVED' && !['hired', 'offered', 'onboarded', 'completed'].includes(c.status.toLowerCase())).length
  const onboardingCount = candidates.filter(c => c.status !== 'rejected' && ['hired', 'offered', 'onboarded', 'completed'].includes(c.status.toLowerCase())).length

  const stages = [
    {
      id: 'screening',
      title: '🤖 AI Screening',
      role: 'Recruiter',
      count: screeningCount,
      isResponsible: activeRole === 'Recruiting',
    },
    {
      id: 'tech',
      title: '🎙️ Tech Panel & Quality Gate',
      role: 'Evaluator / Delivery Head',
      count: techCount,
      isResponsible: activeRole === 'Recruiting' || activeRole === 'Operational head' || activeRole === 'Technical panel',
    },
    {
      id: 'client',
      title: '💼 Client Review',
      role: 'Recruiter',
      count: clientCount,
      isResponsible: activeRole === 'Recruiting',
    },
    {
      id: 'onboarding',
      title: '🤝 HR Onboarding',
      role: 'HR / Recruiter',
      count: onboardingCount,
      isResponsible: activeRole === 'Recruiting',
    }
  ]

  const handleStageClick = (stageId) => {
    if (onStageSelect) {
      onStageSelect(selectedStage === stageId ? 'all' : stageId)
    }
  }

  return (
    <div className="workflow-tracker-outer">
      <div className="workflow-tracker-container">
        {stages.map((stage, index) => {
          const isSelected = selectedStage === stage.id
          const isResponsibleClass = stage.isResponsible ? 'is-responsible' : ''
          const isSelectedClass = isSelected ? 'is-selected' : ''
          
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flex: index === stages.length - 1 ? 'none' : 1 }}>
              <div 
                className={`workflow-stage-node ${isSelectedClass} ${isResponsibleClass}`}
                onClick={() => handleStageClick(stage.id)}
                title={`Click to filter by ${stage.title}`}
              >
                <div className="workflow-stage-icon-wrap">
                  {stage.id === 'screening' && '🤖'}
                  {stage.id === 'tech' && '🎙️'}
                  {stage.id === 'client' && '💼'}
                  {stage.id === 'onboarding' && '🤝'}
                  <span className="workflow-stage-count-badge">{stage.count}</span>
                </div>
                <div className="workflow-stage-title">{stage.title.split(' ').slice(1).join(' ')}</div>
                <div className="workflow-stage-role">({stage.role})</div>
              </div>
              
              {index < stages.length - 1 && (
                <div className={`workflow-connection-line ${selectedStage === stage.id ? 'is-active' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {selectedStage && selectedStage !== 'all' && (
        <div className="workflow-filter-info">
          <span>
            🔍 Filtering pipeline by stage: <strong>{stages.find(s => s.id === selectedStage)?.title}</strong>
          </span>
          <button className="workflow-clear-btn" onClick={() => onStageSelect('all')}>
            Clear Filter
          </button>
        </div>
      )}
    </div>
  )
}
