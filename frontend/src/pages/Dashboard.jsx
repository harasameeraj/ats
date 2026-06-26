import { useState, useEffect } from 'react'
import RecruitmentDashboard from '../components/RecruitmentDashboard'
import DeliveryDashboard from '../components/DeliveryDashboard'
import TechPanelDashboard from '../components/TechPanelDashboard'

export default function Dashboard() {
  const [activeRole, setActiveRole] = useState(localStorage.getItem('activeRole') || 'Recruiting')

  useEffect(() => {
    function handleRoleChange() {
      const role = localStorage.getItem('activeRole') || 'Recruiting'
      setActiveRole(role)
    }

    // Listen to custom role selection change events from the Sidebar
    window.addEventListener('roleChanged', handleRoleChange)
    return () => {
      window.removeEventListener('roleChanged', handleRoleChange)
    }
  }, [])

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
