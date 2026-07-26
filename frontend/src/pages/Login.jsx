import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api, BASE_URL } from '../api/client';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // 'login' | 'signup_company' | 'signup_candidate'
  const [authMode, setAuthMode] = useState('login');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Company Signup State
  const [companyName, setCompanyName] = useState('');
  const [recruiters, setRecruiters] = useState(['']);
  const [techPanels, setTechPanels] = useState(['']);
  const [deliveryHeads, setDeliveryHeads] = useState(['']);
  const [signupStatus, setSignupStatus] = useState({ loading: false, error: '', success: '' });

  // Candidate Signup State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      if (user.role === 'candidate') navigate('/candidate-portal');
      else if (user.role === 'recruiter') navigate('/dashboard');
      else if (user.role === 'tech_panel') navigate('/interviews'); 
      else if (user.role === 'delivery_head') navigate('/dashboard'); 
      else navigate('/dashboard');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCompanySignup = async (e) => {
    e.preventDefault();
    setSignupStatus({ loading: true, error: '', success: '' });
    
    const cleanEmails = (list) => list.filter(e => e.trim() !== '');
    
    try {
      const response = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          recruiters: cleanEmails(recruiters),
          tech_panels: cleanEmails(techPanels),
          delivery_heads: cleanEmails(deliveryHeads)
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Signup failed');
      }

      alert("Company successfully registered! Please check your email for the temporary passwords and login instructions.");
      setSignupStatus({ loading: false, error: '', success: 'Company registered! Temporary passwords have been emailed to all team members.' });
      
      setCompanyName('');
      setRecruiters(['']);
      setTechPanels(['']);
      setDeliveryHeads(['']);
    } catch (err) {
      setSignupStatus({ loading: false, error: err.message, success: '' });
    }
  };

  const handleCandidateSignup = async (e) => {
    e.preventDefault();
    setSignupStatus({ loading: true, error: '', success: '' });
    try {
      await api.signupCandidate({
        name: candidateName,
        email: candidateEmail,
        password: candidatePassword
      });
      setSignupStatus({ loading: false, error: '', success: 'Account created! You can now sign in.' });
      setCandidateName('');
      setCandidateEmail('');
      setCandidatePassword('');
      // Switch back to login after 2 seconds
      setTimeout(() => setAuthMode('login'), 2000);
    } catch (err) {
      setSignupStatus({ loading: false, error: err.message || 'Signup failed', success: '' });
    }
  };

  const handleAddField = (setter, list) => setter([...list, '']);
  const handleFieldChange = (setter, list, index, value) => {
    const newList = [...list];
    newList[index] = value;
    setter(newList);
  };
  const handleRemoveField = (setter, list, index) => {
    const newList = list.filter((_, i) => i !== index);
    setter(newList.length ? newList : ['']);
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-logo-wrapper">
            <img src="/derisk_logo.png" alt="Derisk360" />
            <h1>Derisk360</h1>
          </div>
          <h2>The AI-Powered Hiring Platform</h2>
          <p>
            Streamline your enterprise recruitment, technical evaluations, and 
            operational delivery all in one unified ecosystem.
          </p>
        </div>
      </div>

      <div className="auth-form-section">
        <div className="auth-card-modern">
          {authMode === 'login' && (
            <>
              <div className="auth-card-header">
                <h2>Welcome Back</h2>
                <p>Sign in to your account</p>
              </div>

              {loginError && <div className="alert-error">{loginError}</div>}
              {signupStatus.success && <div className="alert-success">{signupStatus.success}</div>}
              
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    required 
                    type="email" 
                    value={loginEmail} 
                    onChange={(e) => setLoginEmail(e.target.value)} 
                    placeholder="you@company.com" 
                  />
                </div>
                
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    required 
                    type="password" 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)} 
                    placeholder="••••••••" 
                  />
                </div>
                
                <button type="submit" className="btn-primary auth-submit" disabled={loginLoading}>
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="auth-toggle" style={{ flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Are you an Employer?</span>
                  <button type="button" onClick={() => { setAuthMode('signup_company'); setSignupStatus({}); }}>Register your company</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Looking for a job?</span>
                  <button type="button" onClick={() => { setAuthMode('signup_candidate'); setSignupStatus({}); }}>Register as Candidate</button>
                </div>
              </div>
            </>
          )}

          {authMode === 'signup_company' && (
            <>
              <div className="auth-card-header">
                <h2>Company Registration</h2>
                <p>Onboard your team to Derisk360</p>
              </div>

              {signupStatus.error && <div className="alert-error">{signupStatus.error}</div>}
              
              <form onSubmit={handleCompanySignup} className="signup-form">
                <div className="form-group">
                  <label>Company Name</label>
                  <input 
                    required 
                    type="text" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="e.g. Acme Corp" 
                  />
                </div>

                <div className="form-group">
                  <label>Recruiter Emails</label>
                  {recruiters.map((email, i) => (
                    <div key={`rec-${i}`} className="dynamic-input">
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => handleFieldChange(setRecruiters, recruiters, i, e.target.value)} 
                        placeholder="recruiter@acme.com" 
                      />
                      <button type="button" onClick={() => handleRemoveField(setRecruiters, recruiters, i)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn-text" onClick={() => handleAddField(setRecruiters, recruiters)}>+ Add Recruiter</button>
                </div>

                <div className="form-group">
                  <label>Tech Panel Emails</label>
                  {techPanels.map((email, i) => (
                    <div key={`tp-${i}`} className="dynamic-input">
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => handleFieldChange(setTechPanels, techPanels, i, e.target.value)} 
                        placeholder="tech@acme.com" 
                      />
                      <button type="button" onClick={() => handleRemoveField(setTechPanels, techPanels, i)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn-text" onClick={() => handleAddField(setTechPanels, techPanels)}>+ Add Tech Panel</button>
                </div>

                <div className="form-group">
                  <label>Delivery Head Emails</label>
                  {deliveryHeads.map((email, i) => (
                    <div key={`dh-${i}`} className="dynamic-input">
                      <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => handleFieldChange(setDeliveryHeads, deliveryHeads, i, e.target.value)} 
                        placeholder="delivery@acme.com" 
                      />
                      <button type="button" onClick={() => handleRemoveField(setDeliveryHeads, deliveryHeads, i)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn-text" onClick={() => handleAddField(setDeliveryHeads, deliveryHeads)}>+ Add Delivery Head</button>
                </div>

                <button type="submit" className="btn-primary auth-submit" disabled={signupStatus.loading}>
                  {signupStatus.loading ? 'Creating...' : 'Register Company'}
                </button>
              </form>

              <div className="auth-toggle">
                <span>Already registered?</span>
                <button type="button" onClick={() => setAuthMode('login')}>Sign in</button>
              </div>
            </>
          )}

          {authMode === 'signup_candidate' && (
            <>
              <div className="auth-card-header">
                <h2>Candidate Registration</h2>
                <p>Create an account to browse and apply for jobs</p>
              </div>

              {signupStatus.error && <div className="alert-error">{signupStatus.error}</div>}
              
              <form onSubmit={handleCandidateSignup} className="signup-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    required 
                    type="text" 
                    value={candidateName} 
                    onChange={(e) => setCandidateName(e.target.value)} 
                    placeholder="John Doe" 
                  />
                </div>
                
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    required 
                    type="email" 
                    value={candidateEmail} 
                    onChange={(e) => setCandidateEmail(e.target.value)} 
                    placeholder="john@example.com" 
                  />
                </div>
                
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    required 
                    type="password" 
                    value={candidatePassword} 
                    onChange={(e) => setCandidatePassword(e.target.value)} 
                    placeholder="••••••••" 
                  />
                </div>

                <button type="submit" className="btn-primary auth-submit" disabled={signupStatus.loading}>
                  {signupStatus.loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <div className="auth-toggle">
                <span>Already have an account?</span>
                <button type="button" onClick={() => setAuthMode('login')}>Sign in</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
