import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '../../components/Header'
import StoreDashboard from '../../components/StoreDashboard'

export default function StorePage() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  useEffect(() => {
    if (!id) return

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/')
          return
        }

        const response = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (response.ok) {
          const userData = await response.json()
          
          // 管理者の場合は指定された店舗IDでアクセス
          if (userData.role === 'admin') {
            // 店舗情報を取得
            const storeResponse = await fetch('/api/stores', {
              headers: { Authorization: `Bearer ${token}` }
            })
            
            if (storeResponse.ok) {
              const stores = await storeResponse.json()
              const targetStore = stores.find(store => store.id === parseInt(id))
              
              if (targetStore) {
                setUser({
                  ...userData,
                  store_id: parseInt(id),
                  store_name: targetStore.name
                })
              } else {
                router.push('/')
                return
              }
            } else {
              router.push('/')
              return
            }
          } else if (userData.store_id === parseInt(id)) {
            // 店舗ユーザーの場合は自分の店舗のみアクセス可能
            setUser(userData)
          } else {
            // 権限なし
            router.push('/')
            return
          }
        } else {
          router.push('/')
          return
        }
      } catch (error) {
        console.error('認証エラー:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [id, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        読み込み中...
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div>
      <Head>
        <title>LM売上管理 - 店舗画面</title>
      </Head>
      <Header user={user} onLogout={handleLogout} />
      <main style={{ padding: '20px' }}>
        <StoreDashboard user={user} />
      </main>
    </div>
  )
}