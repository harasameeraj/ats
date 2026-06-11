import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [velocity, setVelocity] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [s, a, v] = await Promise.all([
        api.getStats(),
        api.getActivity(),
        api.getVelocity()
      ])
      setStats(s)
      setActivity(a)
      setVelocity(v)
    } catch (e) {
      console.error('Dashboard load error:', e)
      setStats({ total_applications: 0, screened: 0, interviewed: 0, onboarded: 0, shortlisted: 0 })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="spinner"></div>

  const metrics = [
    { label: 'Total Applications', value: stats.total_applications, icon: '📨', bg: '#ede9fe', badge: '+' + stats.total_applications, badgeBg: '#ede9fe', badgeColor: '#6366f1' },
    { label: 'Screened', value: stats.screened, icon: '🤖', bg: '#f3e8ff', badge: 'AI Sorted', badgeBg: '#f3e8ff', badgeColor: '#a855f7' },
    { label: 'Shortlisted', value: stats.shortlisted, icon: '⭐', bg: '#fef3c7', badge: 'Top Picks', badgeBg: '#fef3c7', badgeColor: '#d97706' },
    { label: 'Interviewed', value: stats.interviewed, icon: '🎙', bg: '#d1fae5', badge: 'On Schedule', badgeBg: '#d1fae5', badgeColor: '#059669' },
    { label: 'Onboarded', value: stats.onboarded, icon: '✅', bg: '#cffafe', badge: `Goal: ${stats.onboarded + 8}`, badgeBg: '#cffafe', badgeColor: '#0891b2' },
  ]

  const maxVelocity = Math.max(...Object.values(velocity), 1)

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-label">Dashboard</div>
        <h1 className="page-title">Hiring Overview</h1>
        <p className="page-desc">Real-time funnel performance and activity tracking.</p>
      </div>

      {stats.screened > 0 && (
        <div className="ai-badge" style={{ marginBottom: '1.5rem' }}>
          <span>⚡</span>
          <span>AI screening active — {stats.screened} candidates processed</span>
        </div>
      )}

      <div className="metrics-grid">
        {metrics.map((m, i) => (
          <div className="metric-card" key={i}>
            <div className="metric-icon-wrap" style={{ background: m.bg }}>
              {m.icon}
            </div>
            <div>
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.value.toLocaleString()}</div>
            </div>
            <span className="metric-badge" style={{ background: m.badgeBg, color: m.badgeColor }}>{m.badge}</span>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title">Hiring Funnel</div>
            <span className="card-sub">By Status</span>
          </div>
          <div className="bar-chart">
            {Object.entries(velocity).filter(([k]) => k !== 'rejected').map(([status, count]) => (
              <div
                key={status}
                className="bar-col"
                style={{ height: `${(count / maxVelocity) * 100}%` }}
              >
                <div className="bar-label">{status.slice(0, 6)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
            <div className="card-title">Recent Activity</div>
            <span className="card-sub">View All</span>
          </div>
          <div className="activity-list">
            {activity.length === 0 && (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-icon">📋</div>
                <div className="empty-text">No activity yet</div>
                <div className="empty-sub">Upload some CVs to get started</div>
              </div>
            )}
            {activity.map(a => (
              <div className="activity-item" key={a.id}>
                <div className="activity-dot" style={{ background: a.color }}></div>
                <div>
                  <div className="activity-text">
                    <strong>{a.action}</strong> — {a.description}
                  </div>
                  <div className="activity-meta">{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
