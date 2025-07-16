import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '../../../components/Header'
import StoreDashboard from '../../../components/StoreDashboard'

export default function AdminStoreEditPage() {
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
          
          // 管理者のみアクセス可能
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
                  store_name: targetStore.name,
                  isAdminMode: true // 管理者モードのフラグ
                })
              } else {
                router.push('/admin')
                return
              }
            } else {
              router.push('/admin')
              return
            }
          } else {
            // 管理者以外はアクセス不可
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

  const handleBackToAdmin = () => {
    router.push('/')
  }

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
        <title>LM売上管理 - {user.store_name} データ編集</title>
      </Head>
      <Header user={user} onLogout={handleLogout} />
      
      {/* 管理者モード表示 */}
      <div style={{ 
        backgroundColor: '#ffeaa7', 
        padding: '10px 20px', 
        borderBottom: '2px solid #fdcb6e',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <strong>🛠️ 管理者モード: {user.store_name} のデータを編集中</strong>
          <div style={{ fontSize: '12px', color: '#636e72', marginTop: '2px' }}>
            ここで行った変更は直接データベースに反映されます
          </div>
        </div>
        <button 
          onClick={handleBackToAdmin}
          style={{
            backgroundColor: '#6c5ce7',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          管理画面に戻る
        </button>
      </div>

      <main style={{ padding: '20px' }}>
        <StoreDashboard user={user} />
      </main>
    </div>
  )
}