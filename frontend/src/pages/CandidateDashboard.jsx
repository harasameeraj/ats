import React, { useState, useEffect } from 'react';
import { api, BASE_URL } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'applications'
  const [selectedJob, setSelectedJob] = useState(null);
  
  // Apply Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'jobs') {
        const data = await api.getPublishedJobs();
        setJobs(data);
      } else {
        const data = await api.getMyApplications();
        setApplications(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyClick = (job) => {
    setSelectedJob(job);
    setShowApplyModal(true);
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const submitApplication = async (e) => {
    e.preventDefault();
    if (!resumeFile || !selectedJob) return;

    setApplyLoading(true);
    try {
      await api.applyForJob(selectedJob.id, resumeFile);
      showToast("Application submitted successfully! 🚀");
      setShowApplyModal(false);
      setResumeFile(null);
      setActiveTab('applications');
    } catch (err) {
      showToast(err.message || "Failed to apply", "error");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative' }}>
      
      {/* Custom Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff',
          padding: '1rem 2rem', borderRadius: '50px', fontWeight: 600, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', animation: 'slideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
        }}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.message}
        </div>
      )}

      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '2.5rem', background: 'linear-gradient(135deg, var(--blue), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>Candidate Portal</h1>
        <p className="page-desc" style={{ fontSize: '1.1rem', color: 'var(--t2)' }}>Welcome back! Find your next opportunity or track your applications.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', borderBottom: '2px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('jobs')} 
          style={{ 
            background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer',
            fontWeight: 600, fontSize: '1.05rem', color: activeTab === 'jobs' ? 'var(--blue)' : 'var(--t2)',
            borderBottom: activeTab === 'jobs' ? '3px solid var(--blue)' : '3px solid transparent',
            marginBottom: '-2px', transition: 'all 0.2s ease'
          }}
        >
          🔍 Browse Jobs
        </button>
        <button 
          onClick={() => setActiveTab('applications')} 
          style={{ 
            background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer',
            fontWeight: 600, fontSize: '1.05rem', color: activeTab === 'applications' ? 'var(--blue)' : 'var(--t2)',
            borderBottom: activeTab === 'applications' ? '3px solid var(--blue)' : '3px solid transparent',
            marginBottom: '-2px', transition: 'all 0.2s ease'
          }}
        >
          📂 My Applications
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: '5rem auto' }}></div>
      ) : activeTab === 'jobs' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
          {jobs.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--t2)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <h3 style={{ fontSize: '1.5rem', color: 'var(--t1)', marginBottom: '0.5rem' }}>No open positions right now</h3>
              <p>Please check back later for new opportunities.</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="card hover-lift" style={{ 
                display: 'flex', flexDirection: 'column', padding: '2rem', 
                borderRadius: '20px', border: '1px solid var(--border)',
                background: 'var(--card)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--purple)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {job.company_name}
                  </div>
                  {job.experience_level && <span style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '0.25rem 0.75rem', borderRadius: '50px', fontWeight: 600, color: 'var(--t2)', border: '1px solid var(--border)' }}>{job.experience_level}</span>}
                </div>
                
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--t1)', lineHeight: '1.3' }}>{job.title}</h3>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {job.location && <span style={{ fontSize: '0.85rem', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>📍 {job.location}</span>}
                  {job.work_mode && <span style={{ fontSize: '0.85rem', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🏢 {job.work_mode}</span>}
                  {job.salary_range && <span style={{ fontSize: '0.85rem', color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>💰 {job.salary_range}</span>}
                </div>
                
                <p style={{ 
                  color: 'var(--t2)', fontSize: '0.95rem', lineHeight: '1.6', 
                  flex: 1, overflow: 'hidden', display: '-webkit-box', 
                  WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', 
                  marginBottom: '2rem', textOverflow: 'ellipsis'
                }}>
                  {job.description}
                </p>
                
                <button className="btn btn-primary" onClick={() => handleApplyClick(job)} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, marginTop: 'auto' }}>
                  Apply Now
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1.5rem', textAlign: 'left', color: 'var(--t2)', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '1.5rem', textAlign: 'left', color: 'var(--t2)', fontWeight: 600 }}>Company</th>
                <th style={{ padding: '1.5rem', textAlign: 'left', color: 'var(--t2)', fontWeight: 600 }}>Date Applied</th>
                <th style={{ padding: '1.5rem', textAlign: 'left', color: 'var(--t2)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1.5rem', textAlign: 'left', color: 'var(--t2)', fontWeight: 600 }}>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '4rem', color: 'var(--t3)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📁</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--t2)' }}>You haven't applied to any jobs yet.</div>
                  </td>
                </tr>
              ) : (
                applications.map((app, i) => (
                  <tr key={app.id} style={{ borderBottom: i === applications.length - 1 ? 'none' : '1px solid var(--border)', transition: 'background 0.2s', ':hover': { background: 'var(--bg)' } }}>
                    <td style={{ padding: '1.5rem' }}><strong style={{ color: 'var(--t1)', fontSize: '1.05rem' }}>{app.job_title}</strong></td>
                    <td style={{ padding: '1.5rem', color: 'var(--t2)' }}>{app.company_name}</td>
                    <td style={{ padding: '1.5rem', color: 'var(--t2)' }}>{new Date(app.applied_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td style={{ padding: '1.5rem' }}>
                      <span className="badge" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', padding: '0.4rem 0.8rem', borderRadius: '50px', fontWeight: 600 }}>
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '1.5rem' }}>
                      <span className="badge" style={{ background: 'var(--bg)', color: 'var(--t2)', padding: '0.4rem 0.8rem', borderRadius: '50px', border: '1px solid var(--border)' }}>
                        {app.assessment_status || 'Not Sent'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && selectedJob && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
        }} onClick={() => setShowApplyModal(false)}>
          <div className="modal" style={{ 
            background: 'var(--card)', maxWidth: '500px', width: '90%', 
            padding: '2.5rem', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border)', position: 'relative',
            animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }} onClick={e => e.stopPropagation()}>
            <button style={{ 
              position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--bg)', 
              border: 'none', width: '32px', height: '32px', borderRadius: '50%', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--t2)', fontSize: '1.2rem', transition: 'all 0.2s'
            }} onClick={() => setShowApplyModal(false)}>×</button>
            
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', fontWeight: 800, color: 'var(--t1)' }}>Apply for {selectedJob.title}</h2>
            <p style={{ color: 'var(--t2)', marginBottom: '2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--purple)', fontWeight: 600 }}>@ {selectedJob.company_name}</span>
            </p>
            
            <form onSubmit={submitApplication}>
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.75rem', color: 'var(--t1)' }}>Upload your CV/Resume (PDF)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    required 
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    style={{ 
                      display: 'block', width: '100%', padding: '1rem', 
                      border: '2px dashed var(--blue)', borderRadius: '12px',
                      background: 'var(--blue-bg)', cursor: 'pointer', color: 'var(--t1)',
                      outline: 'none', transition: 'all 0.2s'
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--t3)', marginTop: '0.75rem' }}>Only PDF files are supported. Max file size 5MB.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowApplyModal(false)} style={{ 
                  background: 'none', border: '1px solid var(--border)', padding: '0.85rem 1.5rem', 
                  borderRadius: '12px', fontWeight: 600, color: 'var(--t2)', cursor: 'pointer', transition: 'all 0.2s'
                }}>Cancel</button>
                <button type="submit" disabled={!resumeFile || applyLoading} style={{ 
                  background: 'var(--blue)', border: 'none', padding: '0.85rem 1.5rem', 
                  borderRadius: '12px', fontWeight: 600, color: 'white', cursor: 'pointer', 
                  transition: 'all 0.2s', opacity: (!resumeFile || applyLoading) ? 0.7 : 1
                }}>
                  {applyLoading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideDown {
          from { top: -5rem; opacity: 0; }
          to { top: 2rem; opacity: 1; }
        }
        @keyframes fadeInUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08) !important;
          border-color: var(--blue) !important;
        }
      `}} />
    </div>
  );
}
