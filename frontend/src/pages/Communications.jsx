import React, { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Communications() {
  const [query, setQuery] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [debounceTimeout, setDebounceTimeout] = useState(null)

  useEffect(() => {
    // Start with empty state. Do not fetch logs initially.
  }, [])

  async function fetchLogs(searchQuery) {
    if (!searchQuery.trim()) {
      setLogs([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const results = await api.searchCommunications(searchQuery)
      setLogs(results || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function handleSearchChange(e) {
    const value = e.target.value
    setQuery(value)

    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    const timeout = setTimeout(() => {
      fetchLogs(value)
    }, 300)

    setDebounceTimeout(timeout)
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const localDateStr = dateStr.replace(/Z$|[+-]\d{2}:\d{2}$/, '');
    const d = new Date(localDateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{ animation: 'scaleIn 0.3s ease' }}>
      <div className="page-header">
        <div className="page-label">Recruiter Portal</div>
        <h1 className="page-title">Communications Hub</h1>
        <p className="page-desc">Track and search all email and interview communication history in one unified location.</p>
      </div>

      {/* Premium Search Container */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: '0.9rem' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search by candidate name or mobile number..."
            style={{
              paddingLeft: '36px',
              fontSize: '0.85rem',
              width: '100%',
              borderRadius: '8px',
              border: '1.5px solid var(--border)'
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setLogs([]); }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--t3)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Logs View Container */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span>Communication History</span>
          {query.trim() && (
            <span style={{ fontSize: '0.7rem', background: 'var(--blue-bg)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
              {logs.length} entries
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '250px', color: 'var(--t3)', gap: '1rem' }}>
            <div className="spinner"></div>
            <span style={{ fontSize: '0.78rem' }}>Searching communication records...</span>
          </div>
        ) : !query.trim() ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
            <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
            <div className="empty-text">Search for a Candidate</div>
            <div className="empty-sub">
              Enter a candidate's name or mobile number to view their complete email and interview history.
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
            <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✉️</div>
            <div className="empty-text">No communication logs found</div>
            <div className="empty-sub">
              No candidate matches or logs found for "{query}".
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {logs.map(log => {
              const isEmail = log.type === 'email'
              return (
                <div 
                  key={log.id} 
                  style={{
                    background: 'var(--card-h)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'transform 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  {/* Log Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Candidate Link Trigger */}
                        <strong 
                          className="cand-name" 
                          style={{ fontSize: '0.9rem' }}
                          onClick={() => window.showCandidateTimeline(log.candidate_id)}
                        >
                          👤 {log.candidate_name}
                        </strong>

                        {/* Extracted Phone number badge */}
                        <span 
                          style={{ 
                            fontSize: '0.68rem', 
                            background: 'var(--bg)', 
                            border: '1.5px solid var(--border)', 
                            color: 'var(--t2)', 
                            padding: '2px 8px', 
                            borderRadius: '6px',
                            fontWeight: 600
                          }}
                          title="Mobile number extracted from candidate's uploaded CV"
                        >
                          📱 Phone: {log.candidate_phone}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: '2px' }}>
                        <span>From: <strong>{log.sender}</strong></span>
                        <span style={{ margin: '0 6px' }}>•</span>
                        <span>To: <strong>{log.recipient}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      <span 
                        className="status-badge"
                        style={{
                          background: isEmail ? 'var(--blue-bg)' : 'var(--purple-bg)',
                          color: isEmail ? 'var(--blue)' : 'var(--purple)',
                          fontWeight: 700,
                          fontSize: '0.62rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {isEmail ? '✉️ Email Sent' : '🎙️ Interview Log'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--t3)', fontWeight: 650 }}>{formatTime(log.created_at)}</span>
                    </div>
                  </div>

                  {/* Log Body */}
                  <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    {log.subject && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.4rem' }}>
                        Subject: {log.subject}
                      </div>
                    )}
                    <div 
                      style={{ 
                        fontSize: '0.78rem', 
                        color: 'var(--t2)', 
                        background: 'var(--bg)', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        whiteSpace: 'pre-wrap', 
                        lineHeight: 1.5,
                        fontFamily: 'var(--mono)',
                        border: '1px solid var(--border)',
                        maxHeight: '220px',
                        overflowY: 'auto'
                      }}
                    >
                      {log.body}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
