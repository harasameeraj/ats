import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Settings() {
  const [smtpForm, setSmtpForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: 'Stitch ATS'
  })

  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await api.getSMTPSettings()
      setSmtpForm({
        smtp_host: data.smtp_host || 'smtp.gmail.com',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_password: data.smtp_password_masked || '', // holds masked dots initially
        smtp_from_name: data.smtp_from_name || 'Stitch ATS'
      })
    } catch (e) {
      showToast('Failed to load SMTP settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleInputChange(field, val) {
    setSmtpForm(prev => ({
      ...prev,
      [field]: val
    }))
  }

  async function handleTestConnection() {
    if (!smtpForm.smtp_user || !smtpForm.smtp_password) {
      showToast('Email and Password are required to test connection.', 'error')
      return
    }
    setTesting(true)
    try {
      const payload = {
        smtp_host: smtpForm.smtp_host,
        smtp_port: parseInt(smtpForm.smtp_port),
        smtp_user: smtpForm.smtp_user,
        smtp_password: smtpForm.smtp_password,
        smtp_from_name: smtpForm.smtp_from_name
      }
      const res = await api.testSMTPSettings(payload)
      showToast(res.message || 'SMTP Connection test successful!', 'success')
    } catch (e) {
      showToast(e.message || 'SMTP Test Connection Failed', 'error')
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveSettings() {
    if (!smtpForm.smtp_user) {
      showToast('Sender Email Username is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        smtp_host: smtpForm.smtp_host,
        smtp_port: parseInt(smtpForm.smtp_port),
        smtp_user: smtpForm.smtp_user,
        smtp_password: smtpForm.smtp_password,
        smtp_from_name: smtpForm.smtp_from_name
      }
      await api.updateSMTPSettings(payload)
      showToast('SMTP configuration saved successfully!', 'success')
      // reload to refresh masked placeholders
      loadSettings()
    } catch (e) {
      showToast(e.message || 'Failed to save SMTP settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner"></div>

  return (
    <div style={{ animation: 'scaleIn 0.35s ease' }}>
      <div className="page-header">
        <div className="page-label">System Configurations</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-desc">Manage your email dispatcher servers and app custom client integrations.</p>
      </div>

      <div style={{ maxWidth: '750px', margin: '0 auto' }}>
        <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✉️</span>
            <div>
              <div className="card-title" style={{ fontSize: '1.1rem', fontWeight: 800 }}>HR Email Integration</div>
              <p className="card-sub" style={{ margin: 0 }}>Configure the outgoing SMTP email server. Emails will be sent from this account to candidates.</p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '1.25rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SMTP Host Server</label>
              <input 
                className="form-input" 
                value={smtpForm.smtp_host} 
                onChange={e => handleInputChange('smtp_host', e.target.value)} 
                placeholder="e.g. smtp.gmail.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP Port</label>
              <input 
                className="form-input" 
                type="number"
                value={smtpForm.smtp_port} 
                onChange={e => handleInputChange('smtp_port', e.target.value)} 
                placeholder="e.g. 587"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Sender Display Name</label>
            <input 
              className="form-input" 
              value={smtpForm.smtp_from_name} 
              onChange={e => handleInputChange('smtp_from_name', e.target.value)} 
              placeholder="e.g. Stitch Hiring Team"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">HR Email Username (Gmail / Custom)</label>
            <input 
              className="form-input" 
              type="email"
              value={smtpForm.smtp_user} 
              onChange={e => handleInputChange('smtp_user', e.target.value)} 
              placeholder="e.g. hr@company.com"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <label className="form-label">SMTP / App Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                className="form-input" 
                type={showPassword ? 'text' : 'password'}
                value={smtpForm.smtp_password} 
                onChange={e => handleInputChange('smtp_password', e.target.value)} 
                placeholder="Enter App Password"
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-outline" 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ padding: '0.65rem 0.9rem', fontSize: '0.8rem' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--t3)', display: 'block', marginTop: '0.4rem' }}>
              * For Gmail accounts, use a 16-character <strong>App Password</strong> generated in Google Account security.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleTestConnection}
              disabled={testing || saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}
            >
              {testing ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px', margin: 0 }}></div>
                  Testing Connection...
                </>
              ) : (
                '🔌 Test Connection'
              )}
            </button>

            <button 
              className="btn btn-primary" 
              onClick={handleSaveSettings}
              disabled={testing || saving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem' }}
            >
              {saving ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px', margin: 0, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>
                  Saving...
                </>
              ) : (
                '💾 Save Configuration'
              )}
            </button>
          </div>
        </div>
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
