import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Header from '../../../components/Header'

export default function EditStorePage() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [storeData, setStoreData] = useState({
    name: '',
    store_code: '',
    username: '',
    password: ''
  })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const fileInputRef = useRef(null)

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
            setUser(userData)
            fetchStoreData()
          } else {
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

  const fetchStoreData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/stores/${id}?edit=true`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setStoreData({
          name: data.store?.name || '',
          store_code: data.store?.store_code || '',
          username: data.user?.username || '',
          password: '' // パスワードは空にして新しいパスワードを入力してもらう
        })
      } else {
        setMessage('店舗データの取得に失敗しました')
      }
    } catch (error) {
      console.error('店舗データ取得エラー:', error)
      setMessage('店舗データの取得中にエラーが発生しました')
    }
  }

  const handleInputChange = (field, value) => {
    setStoreData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    // パスワードが空の場合は警告
    if (!storeData.password || storeData.password.trim() === '') {
      setMessage('新しいパスワードを入力してください')
      setSaving(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/stores/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(storeData)
      })

      if (response.ok) {
        setMessage('店舗情報を更新しました')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const result = await response.json()
        setMessage(`更新に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error('保存エラー:', error)
      setMessage('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    // 第1段階確認
    const firstConfirm = window.confirm(`店舗データを削除してよいですか？\n\n店舗名: ${storeData.name}`)
    if (!firstConfirm) return

    // 第2段階確認
    const secondConfirm = window.confirm(`店舗データの復元はできません。本当に良いですか？\n\n店舗名: ${storeData.name}\n\n※この操作は取り消せません。`)
    if (!secondConfirm) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/stores/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setMessage(`店舗「${storeData.name}」を削除しました`)
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        const result = await response.json()
        setMessage(`削除に失敗しました: ${result.error}`)
      }
    } catch (error) {
      setMessage('店舗削除中にエラーが発生しました')
    }
  }

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setCsvLoading(true)
    setMessage('')

    try {
      const text = await file.text()
      const cleanText = text.replace(/^\uFEFF/, '')
      const lines = cleanText.split(/\r?\n/)
      const rows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, '')))
      
      // ヘッダー行をスキップし、有効なデータのみフィルタ
      const dataRows = rows.slice(1).filter(row => row.length >= 4 && row[0] && row[1] && row[2] && row[3])

      if (dataRows.length === 0) {
        setMessage('有効なデータが見つかりません。CSV形式を確認してください。\n形式: 店舗名,店舗コード,ユーザー名,パスワード')
        setCsvLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      const response = await fetch('/api/stores/csv-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ csvData: dataRows })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`CSV更新完了: ${result.success}件成功, ${result.errors}件エラー`)
        fetchStoreData() // データを再取得
      } else {
        const result = await response.json()
        setMessage(`エラー: ${result.error}`)
      }
    } catch (error) {
      console.error('CSV処理エラー:', error)
      setMessage(`CSVファイルの処理中にエラーが発生しました: ${error.message}`)
    } finally {
      setCsvLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    handleInputChange('password', password)
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
        <title>LM売上管理 - 店舗編集</title>
      </Head>
      <Header user={user} onLogout={handleLogout} />

      <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← 管理画面に戻る
          </button>
        </div>

        <div className="card">
          <h2>店舗情報編集</h2>

          {message && (
            <div className={`alert ${message.includes('失敗') || message.includes('エラー') ? 'alert-danger' : 'alert-success'}`} style={{
              padding: '10px',
              marginBottom: '20px',
              borderRadius: '4px',
              backgroundColor: message.includes('失敗') || message.includes('エラー') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${message.includes('失敗') || message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
              color: message.includes('失敗') || message.includes('エラー') ? '#721c24' : '#155724'
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'grid', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">店舗名</label>
              <input
                type="text"
                className="form-control"
                value={storeData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">店舗コード</label>
              <input
                type="text"
                className="form-control"
                value={storeData.store_code}
                onChange={(e) => handleInputChange('store_code', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ログインユーザー名</label>
              <input
                type="text"
                className="form-control"
                value={storeData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">パスワード</label>
              <div style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>
                新しいパスワードを入力してください（現在のパスワードは暗号化されています）
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  value={storeData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="新しいパスワードを入力"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  自動生成
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: saving ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {saving ? '保存中...' : '保存'}
              </button>

              <button
                onClick={handleDelete}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                店舗データ削除
              </button>
            </div>
          </div>
        </div>

        {/* CSV一括更新機能 */}
        <div className="card" style={{ marginTop: '30px' }}>
          <h3>CSV一括更新</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            CSV形式: 店舗名,店舗コード,ユーザー名,パスワード
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            style={{ display: 'none' }}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={csvLoading}
            style={{
              backgroundColor: csvLoading ? '#ccc' : '#ffc107',
              color: 'black',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: csvLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {csvLoading ? 'アップロード中...' : 'CSVファイル選択'}
          </button>
        </div>
      </div>
    </div>
  )
}