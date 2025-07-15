import { useState, useEffect } from 'react'

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('stores')
  const [stores, setStores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [newStore, setNewStore] = useState({
    name: '',
    storeCode: '',
    username: '',
    password: ''
  })
  const [message, setMessage] = useState('')
  const [salesRanking, setSalesRanking] = useState([])
  const [loadingRanking, setLoadingRanking] = useState(false)

  useEffect(() => {
    fetchStores()
    if (activeTab === 'ranking') {
      fetchSalesRanking()
    }
  }, [activeTab])

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/stores', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setStores(data)
      }
    } catch (error) {
      console.error('店舗一覧取得エラー:', error)
    }
  }

  const fetchSalesRanking = async () => {
    setLoadingRanking(true)
    try {
      const token = localStorage.getItem('token')
      const currentDate = new Date()
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      
      const response = await fetch(`/api/sales/monthly/${currentDate.getFullYear()}/${currentDate.getMonth() + 1}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSalesRanking(data)
      }
    } catch (error) {
      console.error('売上ランキング取得エラー:', error)
    } finally {
      setLoadingRanking(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newStore)
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage('店舗とユーザーが作成されました')
        setNewStore({ name: '', storeCode: '', username: '', password: '' })
        setShowModal(false)
        fetchStores()
      } else {
        setMessage(data.message)
      }
    } catch (error) {
      setMessage('作成に失敗しました')
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewStore({ ...newStore, password })
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'stores' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('stores')}
        >
          店舗管理
        </button>
        <button
          className={`btn ${activeTab === 'ranking' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ranking')}
        >
          売上ランキング
        </button>
        <button
          className={`btn ${activeTab === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('demo')}
        >
          デモ機能
        </button>
      </div>

      {activeTab === 'stores' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>店舗管理</h2>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              新規店舗作成
            </button>
          </div>

          {message && (
            <div className={`alert ${message.includes('失敗') ? 'alert-danger' : 'alert-success'}`}>
              {message}
            </div>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>店舗ID</th>
                <th>店舗名</th>
                <th>店舗コード</th>
                <th>作成日</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr key={store.id}>
                  <td>{store.id}</td>
                  <td>{store.name}</td>
                  <td>{store.store_code}</td>
                  <td>{new Date(store.created_at).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="card">
          <h2>売上ランキング - {new Date().getFullYear()}年{new Date().getMonth() + 1}月</h2>
          {loadingRanking ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>読み込み中...</div>
          ) : (
            <>
              {salesRanking.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>順位</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>店舗名</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>売上金額</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>客数</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>客単価</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>営業日数</th>
                        <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>日平均売上</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesRanking.map((store, index) => (
                        <tr key={store.store_id} style={{ backgroundColor: index < 3 ? '#fff3cd' : 'transparent' }}>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>
                            {index + 1}
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                            {store.store_name}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                            {formatCurrency(store.total_sales)}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {store.total_customers}人
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {store.total_customers > 0 ? formatCurrency(Math.round(store.total_sales / store.total_customers)) : '¥0'}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {store.days_count}日
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {formatCurrency(Math.round(store.avg_daily_sales))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>売上データがありません。</p>
                  <p>店舗から売上データを入力してください。</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'demo' && (
        <div className="card">
          <h2>デモ機能</h2>
          <p>クラウド版FC売上管理システムが正常に動作しています！</p>
          <ul style={{ margin: '20px 0', paddingLeft: '20px' }}>
            <li>✅ Next.js + Vercel でのホスティング</li>
            <li>✅ Supabase PostgreSQL データベース</li>
            <li>✅ JWT認証システム</li>
            <li>✅ 店舗・ユーザー管理機能</li>
            <li>✅ 売上データ管理機能</li>
            <li>✅ 売上ランキング機能</li>
          </ul>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>新規店舗作成</h2>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">店舗名</label>
                <input
                  type="text"
                  className="form-control"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">店舗コード</label>
                <input
                  type="text"
                  className="form-control"
                  value={newStore.storeCode}
                  onChange={(e) => setNewStore({ ...newStore, storeCode: e.target.value })}
                  placeholder="例: ST001"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">ログインユーザー名</label>
                <input
                  type="text"
                  className="form-control"
                  value={newStore.username}
                  onChange={(e) => setNewStore({ ...newStore, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">パスワード</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="form-control"
                    value={newStore.password}
                    onChange={(e) => setNewStore({ ...newStore, password: e.target.value })}
                    required
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={generatePassword}
                  >
                    自動生成
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  キャンセル
                </button>
                <button type="submit" className="btn btn-primary">
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}