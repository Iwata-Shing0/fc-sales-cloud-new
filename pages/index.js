import { useState, useEffect } from 'react'
import Login from '../components/Login'
import AdminDashboard from '../components/AdminDashboard'
import StoreDashboard from '../components/StoreDashboard'
import Header from '../components/Header'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        読み込み中...
      </div>
    )
  }

  return (
    <div>
      {user && <Header user={user} onLogout={handleLogout} />}
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : user.role === 'admin' ? (
        <AdminDashboard user={user} />
      ) : (
        <StoreDashboard user={user} />
      )}
    </div>
  )
}