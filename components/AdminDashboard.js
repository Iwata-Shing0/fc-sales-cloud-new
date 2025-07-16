import { useState, useEffect, useRef } from 'react'

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
  const [csvLoading, setCsvLoading] = useState(false)
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreData, setSelectedStoreData] = useState(null)
  const [showStoreDetail, setShowStoreDetail] = useState(false)
  const [storeDetailLoading, setStoreDetailLoading] = useState(false)
  const fileInputRef = useRef(null)

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

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setCsvLoading(true)
    setMessage('')

    try {
      console.log('ファイル名:', file.name)
      console.log('ファイルサイズ:', file.size)
      console.log('ファイルタイプ:', file.type)
      
      const text = await file.text()
      console.log('ファイル内容（最初の500文字）:', text.substring(0, 500))
      
      // BOMを除去
      const cleanText = text.replace(/^\uFEFF/, '')
      
      // 改行で分割（Windows/Mac/Unix形式に対応）
      const lines = cleanText.split(/\r?\n/)
      console.log('行数:', lines.length)
      
      // 各行をカンマで分割
      const rows = lines.map(line => {
        // カンマで分割し、前後の空白とクォートを除去
        return line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''))
      })
      
      console.log('パース後の最初の5行:', rows.slice(0, 5))
      
      // ヘッダー行をスキップし、有効なデータのみフィルタ
      const dataRows = rows.slice(1).filter(row => {
        return row.length >= 3 && 
               row[0] && row[0].trim() !== '' && 
               row[1] && row[1].trim() !== '' && 
               row[2] && row[2].trim() !== ''
      })
      
      console.log('有効なデータ行数:', dataRows.length)
      console.log('有効なデータ（最初の3行）:', dataRows.slice(0, 3))

      if (dataRows.length === 0) {
        setMessage('有効なデータが見つかりません。CSV形式を確認してください。\n形式: 日付,税込売上,客数')
        setCsvLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      const response = await fetch('/api/sales/csv-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          csvData: dataRows,
          store_id: selectedStore
        })
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      let result
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        console.log('Non-JSON response:', text)
        result = { error: 'サーバーから無効なレスポンスを受信しました' }
      }
      
      if (response.ok) {
        setMessage(`CSVアップロード完了: ${result.success}件成功, ${result.errors}件エラー${result.errorDetails && result.errorDetails.length > 0 ? '\n\nエラー詳細:\n' + result.errorDetails.slice(0, 5).join('\n') : ''}`)
      } else {
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

  const handleCsvDownload = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/sales/csv-download?store_id=${selectedStore}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sales_data_store_${selectedStore}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        setMessage('CSVダウンロードに失敗しました')
      }
    } catch (error) {
      setMessage('CSVダウンロード中にエラーが発生しました')
    }
  }

  const fetchStoreDetail = async (storeId) => {
    setStoreDetailLoading(true)
    try {
      const token = localStorage.getItem('token')
      const currentYear = new Date().getFullYear()
      
      const response = await fetch(`/api/sales/monthly-summary?year=${currentYear}&store_id=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedStoreData({
          storeId,
          storeName: stores.find(s => s.id === storeId)?.name || '',
          ...data
        })
        setShowStoreDetail(true)
      } else {
        setMessage('店舗データの取得に失敗しました')
      }
    } catch (error) {
      setMessage('店舗データ取得中にエラーが発生しました')
    } finally {
      setStoreDetailLoading(false)
    }
  }

  const handleDeleteStore = async (storeId, storeName) => {
    // 第1段階確認
    const firstConfirm = window.confirm(`店舗データを削除してよいですか？\n\n店舗名: ${storeName}`)
    if (!firstConfirm) return

    // 第2段階確認
    const secondConfirm = window.confirm(`店舗データの復元はできません。本当に良いですか？\n\n店舗名: ${storeName}\n\n※この操作は取り消せません。`)
    if (!secondConfirm) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setMessage(`店舗「${storeName}」を削除しました`)
        fetchStores() // 店舗一覧を再取得
      } else {
        const result = await response.json()
        setMessage(`削除に失敗しました: ${result.error}`)
      }
    } catch (error) {
      setMessage('店舗削除中にエラーが発生しました')
    }
  }

  const handleRankingCsvDownload = async () => {
    try {
      const token = localStorage.getItem('token')
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      // CSV形式のデータを作成
      const csvHeader = 'ランキング,店舗名,売上金額,客数,客単価,営業日数,日平均売上\n'
      const csvData = salesRanking.map((store, index) => {
        const ranking = index + 1
        const avgCustomerPrice = store.total_customers > 0 ? Math.round(store.total_sales / store.total_customers) : 0
        return `${ranking},${store.store_name},${store.total_sales},${store.total_customers},${avgCustomerPrice},${store.days_count},${Math.round(store.avg_daily_sales)}`
      }).join('\n')
      
      const csvContent = csvHeader + csvData
      
      // BOMを追加してUTF-8で保存
      const bom = '\uFEFF'
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `売上ランキング_${year}年${month}月.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      setMessage('売上ランキングCSVをダウンロードしました')
    } catch (error) {
      setMessage('CSVダウンロード中にエラーが発生しました')
    }
  }

  const handleStoreNameClick = (storeId) => {
    // 新しいタブで店舗画面を開く
    const storeUrl = `/store/${storeId}`
    window.open(storeUrl, '_blank')
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
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr key={store.id}>
                  <td>{store.id}</td>
                  <td>
                    <span 
                      onClick={() => handleStoreNameClick(store.id)}
                      style={{ 
                        cursor: 'pointer', 
                        textDecoration: 'underline',
                        color: '#007bff'
                      }}
                    >
                      {store.name}
                    </span>
                  </td>
                  <td>{store.store_code}</td>
                  <td>{new Date(store.created_at).toLocaleDateString('ja-JP')}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteStore(store.id, store.name)}
                      className="btn btn-danger btn-sm"
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        border: 'none',
                        borderRadius: '3px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px' }}>
            <h4>CSV管理</h4>
            <div style={{ marginBottom: '10px' }}>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                style={{
                  padding: '8px',
                  marginRight: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <option value="">店舗を選択</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={csvLoading || !selectedStore}
                className="btn btn-warning"
                style={{ marginRight: '10px' }}
              >
                {csvLoading ? 'アップロード中...' : 'CSV取込'}
              </button>
              
              <button
                onClick={handleCsvDownload}
                disabled={!selectedStore}
                className="btn btn-secondary"
              >
                CSV出力
              </button>
            </div>
            <small style={{ color: '#666' }}>
              CSV形式: A列=日付, B列=税込売上, C列=客数
            </small>
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>売上ランキング - {new Date().getFullYear()}年{new Date().getMonth() + 1}月</h2>
            {salesRanking.length > 0 && (
              <button 
                className="btn btn-secondary"
                onClick={handleRankingCsvDownload}
                style={{ fontSize: '14px', padding: '8px 16px' }}
              >
                CSV出力
              </button>
            )}
          </div>
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
                            <span 
                              onClick={() => handleStoreNameClick(store.store_id)}
                              style={{ 
                                cursor: 'pointer', 
                                textDecoration: 'underline',
                                color: '#007bff'
                              }}
                            >
                              {store.store_name}
                            </span>
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

      {showStoreDetail && selectedStoreData && (
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
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{selectedStoreData.storeName} - 売上データ（{selectedStoreData.year}年）</h2>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                onClick={() => setShowStoreDetail(false)}
              >
                ×
              </button>
            </div>

            {storeDetailLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>読み込み中...</div>
            ) : (
              <>
                {/* 年間サマリー */}
                <div style={{ 
                  backgroundColor: '#e9ecef', 
                  padding: '15px', 
                  borderRadius: '5px', 
                  marginBottom: '20px' 
                }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>年間サマリー</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>年間売上</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {formatCurrency(selectedStoreData.yearSummary.totalSales)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>年間目標</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {formatCurrency(selectedStoreData.yearSummary.totalTarget)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>達成率</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {selectedStoreData.yearSummary.achievementRate}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>前年比</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                        {selectedStoreData.yearSummary.growthRate > 0 ? '+' : ''}{selectedStoreData.yearSummary.growthRate}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* 月別詳細テーブル */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse', 
                    fontSize: '12px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>月</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>実績</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>目標</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>達成率</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>前年実績</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>前年比</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>客数</th>
                        <th style={{ padding: '8px 4px', border: '1px solid #dee2e6', textAlign: 'center' }}>客単価</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStoreData.monthlyData.map((data, index) => (
                        <tr key={index}>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>
                            {data.month}月
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            ¥{data.sales.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            ¥{data.target.toLocaleString()}
                          </td>
                          <td style={{ 
                            padding: '6px 4px', 
                            border: '1px solid #dee2e6', 
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}>
                            {data.achievementRate}%
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            ¥{data.previousYearSales.toLocaleString()}
                          </td>
                          <td style={{ 
                            padding: '6px 4px', 
                            border: '1px solid #dee2e6', 
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}>
                            {data.growthRate > 0 ? '+' : ''}{data.growthRate}%
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            {data.customers.toLocaleString()}人
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                            ¥{data.avgCustomerPrice.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}