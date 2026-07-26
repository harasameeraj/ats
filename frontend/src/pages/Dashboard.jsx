import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import RecruitmentDashboard from '../components/RecruitmentDashboard'
import DeliveryDashboard from '../components/DeliveryDashboard'
import TechPanelDashboard from '../components/TechPanelDashboard'

import { Navigate } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth();
  
  if (user?.role === 'candidate') {
    return <Navigate to="/candidate-portal" replace />
  }

  const activeRole = user?.role === 'recruiter' ? 'Recruiting' : user?.role === 'delivery_head' ? 'Operational head' : 'Technical panel';

  if (activeRole === 'Recruiting') {
    return <RecruitmentDashboard />
  } else if (activeRole === 'Operational head') {
    return <DeliveryDashboard />
  } else if (activeRole === 'Technical panel') {
    return <TechPanelDashboard />
  } else {
    return <RecruitmentDashboard />
  }
}
