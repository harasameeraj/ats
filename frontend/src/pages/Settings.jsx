import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Settings() {
  const [smtpForm, setSmtpForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: 'Derisk360'
  })

  const [outlookForm, setOutlookForm] = useState({
    smtp_host: 'smtp-mail.outlook.com',
    smtp_port: 587,
    smtp_user: 'sameeraj@qcerebrum.com',
    smtp_password: '',
    smtp_from_name: 'Derisk360'
  })

  const [activeProvider, setActiveProvider] = useState('smtp')

  const [gcalForm, setGcalForm] = useState({
    gcal_organizer_email: 'harasameeraj.7@gmail.com',
    gcal_calendar_id: '',
    gcal_credentials_json: ''
  })
  const [hasApiCreds, setHasApiCreds] = useState(false)

  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingGcal, setTestingGcal] = useState(false)
  const [savingGcal, setSavingGcal] = useState(false)
  const [toast, setToast] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [helpModal, setHelpModal] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const [smtpData, outlookData, providerData, gcalData] = await Promise.all([
        api.getSMTPSettings(),
        api.getOutlookSettings(),
        api.getActiveEmailProvider(),
        api.getGCalSettings()
      ])
      setActiveProvider(providerData.provider || 'smtp')
      setSmtpForm({
        smtp_host: smtpData.smtp_host || 'smtp.gmail.com',
        smtp_port: smtpData.smtp_port || 587,
        smtp_user: smtpData.smtp_user || '',
        smtp_password: smtpData.smtp_password_masked || '',
        smtp_from_name: smtpData.smtp_from_name || 'Derisk360'
      })
      setOutlookForm({
        smtp_host: outlookData.smtp_host || 'smtp-mail.outlook.com',
        smtp_port: outlookData.smtp_port || 587,
        smtp_user: outlookData.smtp_user || 'sameeraj@qcerebrum.com',
        smtp_password: outlookData.smtp_password_masked || '',
        smtp_from_name: outlookData.smtp_from_name || 'Derisk360'
      })
      setGcalForm({
        gcal_organizer_email: gcalData.gcal_organizer_email || 'harasameeraj.7@gmail.com',
        gcal_calendar_id: gcalData.gcal_calendar_id || '',
        gcal_credentials_json: gcalData.gcal_credentials_json_masked || ''
      })
      setHasApiCreds(gcalData.has_api_credentials || false)
    } catch (e) {
      showToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function handleInputChange(field, val) {
    setSmtpForm(prev => ({ ...prev, [field]: val }))
  }

  function handleOutlookChange(field, val) {
    setOutlookForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleToggleProvider(provider) {
    try {
      await api.setActiveEmailProvider(provider)
      setActiveProvider(provider)
      showToast(`Active email provider set to ${provider === 'smtp' ? 'Gmail / Custom SMTP' : 'Outlook'}`, 'success')
    } catch (e) {
      showToast('Failed to change active provider', 'error')
    }
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
      loadSettings()
    } catch (e) {
      showToast(e.message || 'Failed to save SMTP settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestOutlook() {
    if (!outlookForm.smtp_user || !outlookForm.smtp_password) {
      showToast('Email and Password are required to test connection.', 'error')
      return
    }
    setTesting(true)
    try {
      const payload = {
        smtp_host: outlookForm.smtp_host,
        smtp_port: parseInt(outlookForm.smtp_port),
        smtp_user: outlookForm.smtp_user,
        smtp_password: outlookForm.smtp_password,
        smtp_from_name: outlookForm.smtp_from_name
      }
      const res = await api.testOutlookSettings(payload)
      showToast(res.message || 'Outlook Connection test successful!', 'success')
    } catch (e) {
      showToast(e.message || 'Outlook Test Connection Failed', 'error')
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveOutlook() {
    if (!outlookForm.smtp_user) {
      showToast('Sender Email Username is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        smtp_host: outlookForm.smtp_host,
        smtp_port: parseInt(outlookForm.smtp_port),
        smtp_user: outlookForm.smtp_user,
        smtp_password: outlookForm.smtp_password,
        smtp_from_name: outlookForm.smtp_from_name
      }
      await api.updateOutlookSettings(payload)
      showToast('Outlook configuration saved successfully!', 'success')
      loadSettings()
    } catch (e) {
      showToast(e.message || 'Failed to save Outlook settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestGcal() {
    setTestingGcal(true)
    try {
      const res = await api.testGCalConnection()
      showToast(res.message || 'Google Calendar API test successful!', 'success')
    } catch (e) {
      showToast(e.message || 'Google Calendar API test failed', 'error')
    } finally {
      setTestingGcal(false)
    }
  }

  async function handleSaveGcal() {
    if (!gcalForm.gcal_organizer_email) {
      showToast('Organizer email is required.', 'error')
      return
    }
    setSavingGcal(true)
    try {
      await api.updateGCalSettings(gcalForm)
      showToast('Google Calendar settings saved successfully!', 'success')
      loadSettings()
    } catch (e) {
      showToast(e.message || 'Failed to save Google Calendar settings', 'error')
    } finally {
      setSavingGcal(false)
    }
  }

  if (loading) return <div className="spinner"></div>

  return (
    <div style={{ animation: 'scaleIn 0.35s ease' }}>
      <div className="page-header">
        <div className="page-label">System Configurations</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-desc">Manage your email dispatcher servers, calendar integration, and app custom client integrations.</p>
      </div>

      <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SMTP EMAIL CARD */}
        <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✉️</span>
            <div>
              <div className="card-title" style={{ fontSize: '1.1rem', fontWeight: 800 }}>HR Email Integration</div>
              <p className="card-sub" style={{ margin: 0 }}>Configure the outgoing SMTP email server. Emails will be sent from this account to candidates.</p>
            </div>
            <button 
              style={{ 
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem',
                padding: '6px 12px', borderRadius: '100px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                color: '#166534', border: '1px solid #bbf7d0', cursor: 'pointer', fontWeight: 600,
                boxShadow: '0 2px 4px rgba(22, 101, 52, 0.05)', transition: 'all 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              onClick={() => setHelpModal('gmail')}
            >
              <span style={{ fontSize: '0.9rem' }}>📘</span> Setup Guide
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '1.25rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SMTP Host Server</label>
              <input className="form-input" value={smtpForm.smtp_host} onChange={e => handleInputChange('smtp_host', e.target.value)} placeholder="e.g. smtp.gmail.com" />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP Port</label>
              <input className="form-input" type="number" value={smtpForm.smtp_port} onChange={e => handleInputChange('smtp_port', e.target.value)} placeholder="e.g. 587" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Sender Display Name</label>
            <input className="form-input" value={smtpForm.smtp_from_name} onChange={e => handleInputChange('smtp_from_name', e.target.value)} placeholder="e.g. Derisk360 Hiring Team" />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">HR Email Username (Gmail / Custom)</label>
            <input className="form-input" type="email" autoComplete="off" value={smtpForm.smtp_user} onChange={e => handleInputChange('smtp_user', e.target.value)} placeholder="e.g. hr@company.com" />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <label className="form-label">SMTP / App Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="form-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={smtpForm.smtp_password} onChange={e => handleInputChange('smtp_password', e.target.value)} placeholder="Enter App Password" style={{ flex: 1 }} />
              <button className="btn btn-outline" type="button" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0.65rem 0.9rem', fontSize: '0.8rem' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--t3)', display: 'block', marginTop: '0.4rem' }}>
              * For Gmail accounts, use a 16-character <strong>App Password</strong> generated in Google Account security.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-outline" onClick={handleTestConnection} disabled={testing || saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
              {testing ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0 }}></div>Testing Connection...</>) : '🔌 Test Connection'}
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className={`btn ${activeProvider === 'smtp' ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => handleToggleProvider('smtp')} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}
              >
                {activeProvider === 'smtp' ? '✓ Active Provider' : 'Set as Active'}
              </button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={testing || saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem', background: '#4ade80', borderColor: '#4ade80', color: '#14532d' }}>
                {saving ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#14532d' }}></div>Saving...</>) : '💾 Save'}
              </button>
            </div>
          </div>
        </div>

        {/* OUTLOOK EMAIL CARD */}
        <div className="card" style={{ padding: '2rem', border: activeProvider === 'outlook' ? '2px solid #0078d4' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📧</span>
            <div>
              <div className="card-title" style={{ fontSize: '1.1rem', fontWeight: 800 }}>Outlook Email Integration</div>
              <p className="card-sub" style={{ margin: 0 }}>Configure Microsoft Outlook / Office365 for sending emails to candidates.</p>
            </div>
            <button 
              style={{ 
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem',
                padding: '6px 12px', borderRadius: '100px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                color: '#1e40af', border: '1px solid #bfdbfe', cursor: 'pointer', fontWeight: 600,
                boxShadow: '0 2px 4px rgba(30, 64, 175, 0.05)', transition: 'all 0.2s ease'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              onClick={() => setHelpModal('outlook')}
            >
              <span style={{ fontSize: '0.9rem' }}>📘</span> Setup Guide
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '1.25rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">SMTP Host Server</label>
              <input className="form-input" value={outlookForm.smtp_host} onChange={e => handleOutlookChange('smtp_host', e.target.value)} placeholder="e.g. smtp-mail.outlook.com" />
            </div>
            <div className="form-group">
              <label className="form-label">SMTP Port</label>
              <input className="form-input" type="number" value={outlookForm.smtp_port} onChange={e => handleOutlookChange('smtp_port', e.target.value)} placeholder="e.g. 587" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Sender Display Name</label>
            <input className="form-input" value={outlookForm.smtp_from_name} onChange={e => handleOutlookChange('smtp_from_name', e.target.value)} placeholder="e.g. Derisk360 Hiring Team" />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Outlook Username (Email)</label>
            <input className="form-input" type="email" autoComplete="off" value={outlookForm.smtp_user} onChange={e => handleOutlookChange('smtp_user', e.target.value)} placeholder="e.g. hr@company.com" />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <label className="form-label">Outlook Password / App Password</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="form-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={outlookForm.smtp_password} onChange={e => handleOutlookChange('smtp_password', e.target.value)} placeholder="Enter Password" style={{ flex: 1 }} />
              <button className="btn btn-outline" type="button" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0.65rem 0.9rem', fontSize: '0.8rem' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--t3)', display: 'block', marginTop: '0.4rem' }}>
              * If 2FA is enabled, use an <strong>App Password</strong> generated in your Microsoft account security settings.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-outline" onClick={handleTestOutlook} disabled={testing || saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
              {testing ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0 }}></div>Testing Connection...</>) : '🔌 Test Connection'}
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className={`btn ${activeProvider === 'outlook' ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => handleToggleProvider('outlook')} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem', background: activeProvider === 'outlook' ? '#0078d4' : 'transparent', borderColor: activeProvider === 'outlook' ? '#0078d4' : 'var(--border)' }}
              >
                {activeProvider === 'outlook' ? '✓ Active Provider' : 'Set as Active'}
              </button>
              <button className="btn btn-primary" onClick={handleSaveOutlook} disabled={testing || saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem', background: '#0078d4', borderColor: '#0078d4' }}>
                {saving ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>Saving...</>) : '💾 Save'}
              </button>
            </div>
          </div>
        </div>

        {/* GOOGLE CALENDAR CARD */}
        <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📅</span>
            <div>
              <div className="card-title" style={{ fontSize: '1.1rem', fontWeight: 800 }}>Google Calendar Integration</div>
              <p className="card-sub" style={{ margin: 0 }}>Sync interviews with Google Calendar. Events are automatically created with meeting details.</p>
            </div>
            {hasApiCreds && (
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '100px', background: '#dcfce7', color: '#16a34a' }}>
                API Connected
              </span>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '1.25rem 0' }} />

          {/* Info banner */}
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)', border: '1px solid #bfdbfe', borderRadius: 'var(--r)', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.78rem', color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <div>
              <strong>How it works:</strong> When you schedule an interview, a Google Calendar link is automatically generated.
              Click "📅 Add to Calendar" on any interview card to add it to your Google Calendar.
              For full API sync with auto-created events and Google Meet links, add service account credentials below.
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Organizer Email</label>
            <input className="form-input" type="email" value={gcalForm.gcal_organizer_email} onChange={e => setGcalForm(f => ({ ...f, gcal_organizer_email: e.target.value }))} placeholder="e.g. hr@company.com" />
            <span style={{ fontSize: '0.72rem', color: 'var(--t3)', display: 'block', marginTop: '0.4rem' }}>
              This email will be added as an attendee to all calendar events.
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Google Calendar ID <span style={{ color: 'var(--t3)', fontSize: '0.72rem' }}>(optional — for API sync)</span></label>
            <input className="form-input" value={gcalForm.gcal_calendar_id} onChange={e => setGcalForm(f => ({ ...f, gcal_calendar_id: e.target.value }))} placeholder="e.g. primary or your-calendar-id@group.calendar.google.com" />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Service Account Credentials JSON <span style={{ color: 'var(--t3)', fontSize: '0.72rem' }}>(optional — for API sync)</span></label>
            <textarea className="form-input" rows={4} value={gcalForm.gcal_credentials_json} onChange={e => setGcalForm(f => ({ ...f, gcal_credentials_json: e.target.value }))} placeholder='Paste the full JSON key file contents here...' style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', resize: 'vertical' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--t3)', display: 'block', marginTop: '0.4rem' }}>
              * Create a service account in Google Cloud Console, download the JSON key, and share your calendar with the service account email.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-outline" onClick={handleTestGcal} disabled={testingGcal || savingGcal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.25rem' }}>
              {testingGcal ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0 }}></div>Testing API...</>) : '🔌 Test API Connection'}
            </button>
            <button className="btn btn-primary" onClick={handleSaveGcal} disabled={testingGcal || savingGcal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1.5rem', background: '#4285f4', borderColor: '#4285f4' }}>
              {savingGcal ? (<><div className="spinner" style={{ width: '14px', height: '14px', margin: 0, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>Saving...</>) : '💾 Save Calendar Settings'}
            </button>
          </div>
        </div>
      </div>

      {helpModal && (
        <div className="modal-overlay" onClick={() => setHelpModal(null)}>
          <div className="modal" style={{ maxWidth: '600px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setHelpModal(null)}>×</button>
            <div className="modal-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {helpModal === 'gmail' ? '✉️ Gmail Setup Guide' : '📧 Outlook Setup Guide'}
            </div>
            
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {helpModal === 'gmail' ? (
                <>
                  <p>To use Gmail as your SMTP server, you need to generate a 16-character App Password because of Google's security policies.</p>
                  <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>Google Account Security</a> page.</li>
                    <li>Under "How you sign in to Google", ensure <strong>2-Step Verification</strong> is turned <strong>ON</strong>.</li>
                    <li>Click on <strong>2-Step Verification</strong>, scroll to the bottom, and click <strong>App passwords</strong>.</li>
                    <li>Type a name for the app (e.g. "Stitch ATS") and click <strong>Create</strong>.</li>
                    <li>Google will display a 16-character password. Copy it and paste it into the "App Password" field (no spaces needed).</li>
                  </ol>
                  <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '8px', color: '#92400e', marginTop: '0.5rem', border: '1px solid #fde68a' }}>
                    <strong>Note:</strong> Make sure SMTP Host is <code>smtp.gmail.com</code> and Port is <code>587</code>.
                  </div>
                </>
              ) : (
                <>
                  <p>To use Outlook/Office 365, you need to generate an App Password. Note: If your organization has disabled Basic Authentication, this may not work without Admin approval.</p>
                  <ol style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <li>Go to your <a href="https://account.microsoft.com/security" target="_blank" rel="noreferrer" style={{ color: '#0078d4', fontWeight: 600 }}>Microsoft Account Security</a> page.</li>
                    <li>Click on <strong>Advanced security options</strong>.</li>
                    <li>Ensure that <strong>Two-step verification</strong> is turned <strong>ON</strong>.</li>
                    <li>Scroll down to the <strong>App passwords</strong> section and click <strong>Create a new app password</strong>.</li>
                    <li>Copy the generated password and paste it into the "Outlook Password" field.</li>
                  </ol>
                  <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', color: '#1e40af', marginTop: '0.5rem', border: '1px solid #bfdbfe' }}>
                    <strong>Note:</strong> Make sure SMTP Host is <code>smtp-mail.outlook.com</code> and Port is <code>587</code>. If you are on an organizational account (Entra ID) and do not see the "App passwords" option, your IT admin has disabled it.
                  </div>
                </>
              )}
            </div>
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setHelpModal(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
