import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const AdminDashboard = forwardRef(({ user }, ref) => {
  const [stores, setStores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [newStore, setNewStore] = useState({
    name: '',
    storeCode: '',
    username: '',
    password: ''
  })
  const [adminSettings, setAdminSettings] = useState({
    username: '',
    password: ''
  })
  const [message, setMessage] = useState('')
  const [csvLoading, setCsvLoading] = useState(false)
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreData, setSelectedStoreData] = useState(null)
  const [showStoreDetail, setShowStoreDetail] = useState(false)
  const [storeDetailLoading, setStoreDetailLoading] = useState(false)
  const [storesWithSales, setStoresWithSales] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [statistics, setStatistics] = useState({
    totalSales: 0,
    totalCustomers: 0,
    avgCustomerPrice: 0,
    avgSales: 0,
    avgCustomers: 0
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const fileInputRef = useRef(null)

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  useImperativeHandle(ref, () => ({
    handleSettings
  }))

  useEffect(() => {
    fetchStores()
    fetchStatistics()
  }, [currentDate])


  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/stores', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (response.ok) {
        setStores(data)
        fetchStoresWithSales(data)
      }
    } catch (error) {
      console.error('店舗一覧取得エラー:', error)
    }
  }

  const fetchStoresWithSales = async (storesList = stores) => {
    try {
      const token = localStorage.getItem('token')
      
      const storesWithSalesData = await Promise.all(
        storesList.map(async (store) => {
          try {
            const response = await fetch(`/api/sales?year=${currentYear}&month=${currentMonth}&store_id=${store.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            
            if (response.ok) {
              const salesData = await response.json()
              const totalSales = salesData.reduce((sum, item) => sum + item.sales_amount, 0)
              const totalCustomers = salesData.reduce((sum, item) => sum + item.customer_count, 0)
              
              return {
                ...store,
                totalSales,
                totalCustomers,
                avgCustomerPrice: totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0
              }
            } else {
              return {
                ...store,
                totalSales: 0,
                totalCustomers: 0,
                avgCustomerPrice: 0
              }
            }
          } catch (error) {
            console.error(`店舗${store.id}の売上データ取得エラー:`, error)
            return {
              ...store,
              totalSales: 0,
              totalCustomers: 0,
              avgCustomerPrice: 0
            }
          }
        })
      )
      
      setStoresWithSales(storesWithSalesData)
    } catch (error) {
      console.error('売上データ付き店舗一覧取得エラー:', error)
    }
  }

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admin/statistics?year=${currentYear}&month=${currentMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setStatistics(data)
      }
    } catch (error) {
      console.error('統計情報取得エラー:', error)
    }
  }

  const handleSettings = () => {
    setShowSettingsModal(true)
    setAdminSettings({
      username: user.username,
      password: ''
    })
  }

  const handleSettingsSave = async () => {
    setSettingsSaving(true)
    setMessage('')

    if (!adminSettings.username || !adminSettings.password) {
      setMessage('ユーザー名とパスワードを入力してください')
      setSettingsSaving(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adminSettings)
      })

      if (response.ok) {
        setMessage('管理者設定を更新しました')
        setShowSettingsModal(false)
        setTimeout(() => setMessage(''), 3000)
      } else {
        const result = await response.json()
        setMessage(`更新に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error('設定保存エラー:', error)
      setMessage('設定保存中にエラーが発生しました')
    } finally {
      setSettingsSaving(false)
    }
  }

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
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

  const handleStoreCsvDownload = async () => {
    try {
      // CSV形式のデータを作成
      const csvHeader = '店舗名,店舗コード,売上(税込),客数,客単価\n'
      const csvData = storesWithSales.map((store) => {
        const storeName = store.name
        const storeCode = store.store_code
        const sales = store.totalSales || 0
        const customers = store.totalCustomers || 0
        const avgPrice = store.avgCustomerPrice || 0
        
        return `${storeName},${storeCode},${sales},${customers},${avgPrice}`
      }).join('\n')
      
      const csvContent = csvHeader + csvData
      
      // BOMを追加してUTF-8で保存
      const bom = '\uFEFF'
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `店舗売上データ_${currentYear}年${currentMonth}月.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      setMessage('店舗売上データCSVをダウンロードしました')
    } catch (error) {
      setMessage('CSVダウンロード中にエラーが発生しました')
    }
  }

  const handleStoreNameClick = (storeId) => {
    // 管理者用店舗編集画面を開く（同じタブ）
    const storeUrl = `/admin/store/${storeId}`
    window.location.href = storeUrl
  }

  const handleStoreEdit = (storeId) => {
    // 店舗編集ページに遷移
    const editUrl = `/admin/edit-store/${storeId}`
    window.location.href = editUrl
  }

  const handleStoresCsvUpload = async (event) => {
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
        setMessage(`店舗データCSV更新完了: ${result.success}件成功, ${result.errors}件エラー`)
        fetchStores() // 店舗一覧と売上データを再取得
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

  const handleStoresCsvDownload = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/stores/csv-download', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `店舗データ_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        setMessage('店舗データCSVをダウンロードしました')
      } else {
        setMessage('CSVダウンロードに失敗しました')
      }
    } catch (error) {
      setMessage('CSVダウンロード中にエラーが発生しました')
    }
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  const getSortedStores = () => {
    const sortableStores = [...storesWithSales]
    if (sortConfig.key) {
      sortableStores.sort((a, b) => {
        let aValue = a[sortConfig.key]
        let bValue = b[sortConfig.key]
        
        // 数値の場合
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
        }
        
        // 文字列の場合
        aValue = aValue.toString().toLowerCase()
        bValue = bValue.toString().toLowerCase()
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableStores
  }

  const getSortIcon = (columnKey) => {
    if (sortConfig.key === columnKey) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
    }
    return ''
  }

  return (
    <div className="container">
      {/* 月切り替えと統計情報 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => changeMonth(-1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← 前月
          </button>
          
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            {currentYear}年{currentMonth}月
          </h3>
          
          <button 
            onClick={() => changeMonth(1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            次月 →
          </button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(5, 1fr)', 
          gap: '15px', 
          fontSize: '14px',
          minWidth: '500px'
        }}>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>売上合計</div>
            <div style={{ fontWeight: 'bold', color: '#007bff', fontSize: '16px' }}>
              {formatCurrency(statistics.totalSales)}
            </div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>客数合計</div>
            <div style={{ fontWeight: 'bold', color: '#28a745', fontSize: '16px' }}>
              {statistics.totalCustomers.toLocaleString()}人
            </div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>平均客単価</div>
            <div style={{ fontWeight: 'bold', color: '#ffc107', fontSize: '16px' }}>
              {formatCurrency(statistics.avgCustomerPrice)}
            </div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>平均売上</div>
            <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '16px' }}>
              {formatCurrency(statistics.avgSales)}
            </div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#666', marginBottom: '4px', fontSize: '12px' }}>平均客数</div>
            <div style={{ fontWeight: 'bold', color: '#6f42c1', fontSize: '16px' }}>
              {statistics.avgCustomers.toLocaleString()}人
            </div>
          </div>
        </div>
      </div>

      <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>店舗管理</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleStoreCsvDownload}
                style={{ fontSize: '14px', padding: '8px 16px' }}
              >
                CSV出力
              </button>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                新規店舗作成
              </button>
            </div>
          </div>

          {message && (
            <div className={`alert ${message.includes('失敗') ? 'alert-danger' : 'alert-success'}`}>
              {message}
            </div>
          )}

          <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
            現在の月：{new Date().getFullYear()}年{new Date().getMonth() + 1}月の売上データ
          </div>

          <table className="table" style={{ fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th 
                  style={{ cursor: 'pointer', padding: '8px', border: '1px solid #dee2e6' }}
                  onClick={() => handleSort('name')}
                >
                  店舗名{getSortIcon('name')}
                </th>
                <th 
                  style={{ cursor: 'pointer', padding: '8px', border: '1px solid #dee2e6' }}
                  onClick={() => handleSort('store_code')}
                >
                  店舗コード{getSortIcon('store_code')}
                </th>
                <th 
                  style={{ cursor: 'pointer', padding: '8px', border: '1px solid #dee2e6' }}
                  onClick={() => handleSort('totalSales')}
                >
                  売上(税込){getSortIcon('totalSales')}
                </th>
                <th 
                  style={{ cursor: 'pointer', padding: '8px', border: '1px solid #dee2e6' }}
                  onClick={() => handleSort('totalCustomers')}
                >
                  客数{getSortIcon('totalCustomers')}
                </th>
                <th 
                  style={{ cursor: 'pointer', padding: '8px', border: '1px solid #dee2e6' }}
                  onClick={() => handleSort('avgCustomerPrice')}
                >
                  客単価{getSortIcon('avgCustomerPrice')}
                </th>
                <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {getSortedStores().map(store => (
                <tr key={store.id}>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
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
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    {store.store_code}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(store.totalSales || 0)}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    {(store.totalCustomers || 0).toLocaleString()}人
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    {formatCurrency(store.avgCustomerPrice || 0)}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                    <button
                      onClick={() => handleStoreEdit(store.id)}
                      className="btn btn-primary btn-sm"
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        backgroundColor: '#007bff',
                        border: 'none',
                        borderRadius: '3px',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px' }}>
            <h4>店舗データCSV管理</h4>
            <div style={{ marginBottom: '10px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleStoresCsvUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={csvLoading}
                className="btn btn-warning"
                style={{ marginRight: '10px' }}
              >
                {csvLoading ? 'アップロード中...' : '店舗データCSV取込'}
              </button>
              
              <button
                onClick={handleStoresCsvDownload}
                className="btn btn-secondary"
              >
                店舗データCSV出力
              </button>
            </div>
            <small style={{ color: '#666' }}>
              CSV形式: 店舗名,店舗コード,ユーザー名,パスワード<br/>
              ※ 既存の店舗コードがある場合は上書き更新、新しい店舗コードは新規作成されます
            </small>
          </div>
        </div>


      {/* 設定モーダル */}
      {showSettingsModal && (
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
            maxWidth: '400px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>管理者設定</h2>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                onClick={() => setShowSettingsModal(false)}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                ユーザー名
              </label>
              <input
                type="text"
                value={adminSettings.username}
                onChange={(e) => setAdminSettings({...adminSettings, username: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                新しいパスワード
              </label>
              <input
                type="password"
                value={adminSettings.password}
                onChange={(e) => setAdminSettings({...adminSettings, password: e.target.value})}
                placeholder="新しいパスワードを入力"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
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
                キャンセル
              </button>
              <button 
                onClick={handleSettingsSave}
                disabled={settingsSaving}
                style={{
                  backgroundColor: settingsSaving ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: settingsSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {settingsSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
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
})

AdminDashboard.displayName = 'AdminDashboard'

export default AdminDashboard