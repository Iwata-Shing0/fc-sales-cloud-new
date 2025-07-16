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
    console.log('StorePage useEffect - id:', id)
    if (!id) return

    const checkAuth = async () => {
      try {
        console.log('Store page - checkAuth starting for id:', id)
        const token = localStorage.getItem('token')
        if (!token) {
          console.log('Store page - no token, redirecting')
          router.push('/')
          return
        }

        console.log('Store page - fetching auth verify')
        const response = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        })

        console.log('Store page - auth verify response:', response.status)
        if (response.ok) {
          const userData = await response.json()
          console.log('Store page - userData:', userData)
          
          // 管理者の場合は指定された店舗IDでアクセス
          if (userData.role === 'admin') {
            console.log('Store page - admin access, fetching stores')
            // 店舗情報を取得
            const storeResponse = await fetch('/api/stores', {
              headers: { Authorization: `Bearer ${token}` }
            })
            
            console.log('Store page - stores response:', storeResponse.status)
            if (storeResponse.ok) {
              const stores = await storeResponse.json()
              console.log('Store page - stores data:', stores)
              const targetStore = stores.find(store => store.id === parseInt(id))
              console.log('Store page - target store:', targetStore, 'for id:', parseInt(id))
              
              if (targetStore) {
                const finalUser = {
                  ...userData,
                  store_id: parseInt(id),
                  store_name: targetStore.name
                }
                console.log('Store page - setting user:', finalUser)
                setUser(finalUser)
              } else {
                console.log('Store page - target store not found, redirecting')
                router.push('/')
                return
              }
            } else {
              console.log('Store page - stores fetch failed, redirecting')
              router.push('/')
              return
            }
          } else if (userData.store_id === parseInt(id)) {
            console.log('Store page - store user access')
            // 店舗ユーザーの場合は自分の店舗のみアクセス可能
            setUser(userData)
          } else {
            console.log('Store page - no permission, redirecting')
            // 権限なし
            router.push('/')
            return
          }
        } else {
          console.log('Store page - auth verify failed, redirecting')
          router.push('/')
          return
        }
      } catch (error) {
        console.error('Store page - 認証エラー:', error)
        router.push('/')
      } finally {
        console.log('Store page - setting loading false')
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