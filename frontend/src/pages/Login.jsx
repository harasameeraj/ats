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

  // Inline SVG icons (no icon library needed)
  const MailIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
  const LockIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
  const StitchMark = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4l12 16M6 20L18 4M4 12h16" />
    </svg>
  );

  return (
    <div className="auth-page">
      {/* Ambient network overlay — evokes the "connected agent" motif */}
      <svg className="auth-network" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g stroke="rgba(52,211,153,0.28)" strokeWidth="0.6" fill="none">
          <path d="M120 200 L340 120 L560 260 L780 140 L980 300 L1220 180 L1460 280" />
          <path d="M80 480 L280 380 L520 520 L740 400 L960 540 L1200 460 L1500 560" />
          <path d="M160 720 L360 640 L600 780 L820 660 L1040 800 L1280 700 L1520 780" />
          <path d="M340 120 L280 380 M560 260 L520 520 M780 140 L740 400 M980 300 L960 540 M1220 180 L1200 460" />
          <path d="M280 380 L360 640 M520 520 L600 780 M740 400 L820 660 M960 540 L1040 800 M1200 460 L1280 700" />
        </g>
        <g fill="url(#nodeGlow)">
          {[[120,200],[340,120],[560,260],[780,140],[980,300],[1220,180],[1460,280],
            [80,480],[280,380],[520,520],[740,400],[960,540],[1200,460],[1500,560],
            [160,720],[360,640],[600,780],[820,660],[1040,800],[1280,700],[1520,780]].map((p,i)=>(
            <circle key={i} cx={p[0]} cy={p[1]} r="6" />
          ))}
        </g>
        <g fill="#34d399">
          {[[340,120],[780,140],[520,520],[960,540],[600,780],[1280,700]].map((p,i)=>(
            <circle key={i} cx={p[0]} cy={p[1]} r="1.6" />
          ))}
        </g>
      </svg>

      <div className="auth-form-section">
        <div className="auth-brand-mark">
          <span className="auth-brand-icon"><StitchMark /></span>
          <span>Stitch ATS</span>
        </div>

        <div className="auth-card-modern">
          {authMode === 'login' && (
            <>
              <div className="auth-card-header">
                <h2>Sign in</h2>
                <p>Continue to your Stitch ATS workspace.</p>
              </div>

              {loginError && <div className="alert-error">{loginError}</div>}
              {signupStatus.success && <div className="alert-success">{signupStatus.success}</div>}

              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-wrap">
                    <span className="input-icon"><MailIcon /></span>
                    <input
                      required
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <div className="input-wrap">
                    <span className="input-icon"><LockIcon /></span>
                    <input
                      required
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="password"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary auth-submit" disabled={loginLoading}>
                  {loginLoading ? 'Signing in…' : 'Sign In to your Workspace'}
                </button>
              </form>

              <div className="auth-register-strip">
                <span className="auth-register-label">Register an Account:</span>
                <div className="auth-register-links">
                  <button type="button" onClick={() => { setAuthMode('signup_company'); setSignupStatus({}); }}>Employer</button>
                  <span className="auth-register-sep" aria-hidden="true">|</span>
                  <button type="button" onClick={() => { setAuthMode('signup_candidate'); setSignupStatus({}); }}>Candidate</button>
                </div>
              </div>
            </>
          )}

          {authMode === 'signup_company' && (
            <>
              <div className="auth-card-header">
                <h2>Register your company</h2>
                <p>Set up your team's Stitch ATS workspace.</p>
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
                <h2>Create your account</h2>
                <p>Apply to roles and track your assessments.</p>
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

        <div className="auth-footer">
          <span>Stitch ATS v1.0 <span className="auth-footer-sep">|</span> Autonomous Hiring Agent</span>
        </div>
      </div>

      <span className="auth-sparkle" aria-hidden="true">✦</span>
    </div>
  );
}
