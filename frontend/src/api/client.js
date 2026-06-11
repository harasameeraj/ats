const BASE = 'http://localhost:8000';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Screening
  uploadJD: (file, title) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    return request('/api/screening/upload-jd', { method: 'POST', body: fd });
  },
  uploadCVs: (files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return request('/api/screening/upload-cvs', { method: 'POST', body: fd });
  },
  runScreening: (jobId, candidateIds) => {
    const fd = new FormData();
    fd.append('job_id', jobId);
    fd.append('candidate_ids', candidateIds.join(','));
    return request('/api/screening/run', { method: 'POST', body: fd });
  },
  getJobs: () => request('/api/screening/jobs'),
  getCandidates: () => request('/api/screening/candidates'),
  getResults: (jobId) => request(`/api/screening/results/${jobId}`),

  // Dashboard
  getStats: () => request('/api/dashboard/stats'),
  getActivity: () => request('/api/dashboard/activity'),
  getVelocity: () => request('/api/dashboard/velocity'),

  // Interviews
  getInterviews: () => request('/api/interviews/'),
  createInterview: (data) => request('/api/interviews/', { method: 'POST', body: JSON.stringify(data) }),
  updateInterview: (id, data) => request(`/api/interviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  suggestSlots: (candidateId) => request(`/api/interviews/suggest?candidate_id=${candidateId}`, { method: 'POST' }),
  bulkSchedule: (data) => request('/api/interviews/bulk-schedule', { method: 'POST', body: JSON.stringify(data) }),
  interviewAction: (id, action) => request(`/api/interviews/${id}/action?action=${action}`, { method: 'POST' }),
  generateEmail: (candidateId, emailType, details) => request('/api/interviews/generate-email', { method: 'POST', body: JSON.stringify({ candidate_id: candidateId, email_type: emailType, details }) }),

  // Onboarding
  getOnboarding: () => request('/api/onboarding/'),
  addToOnboarding: (candidateId) => request(`/api/onboarding/?candidate_id=${candidateId}`, { method: 'POST' }),
  toggleTask: (taskId) => request(`/api/onboarding/task/${taskId}`, { method: 'PUT' }),
  getOnboardingStats: () => request('/api/onboarding/stats'),
  runOnboardingBot: () => request('/api/onboarding/bot/run', { method: 'POST' }),
  completeOnboarding: (candidateId) => request(`/api/onboarding/${candidateId}/complete`, { method: 'POST' }),

};
