import { useState, useEffect, useRef } from 'react'
import SalesAnalytics from './SalesAnalytics'

export default function StoreDashboard({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [salesData, setSalesData] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [csvLoading, setCsvLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('daily')
  const [monthlyTarget, setMonthlyTarget] = useState(0)
  const [targetEditing, setTargetEditing] = useState(false)
  const [tempTarget, setTempTarget] = useState('')
  const [selectedDays, setSelectedDays] = useState(new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)
  const fileInputRef = useRef(null)

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

  const TAX_RATE = 0.1

  useEffect(() => {
    fetchMonthlySalesData()
    fetchMonthlyTarget()
  }, [currentDate])

  const fetchMonthlySalesData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/sales?year=${currentYear}&month=${currentMonth}&store_id=${user.store_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        const salesByDate = {}
        data.forEach(item => {
          // 日付の解析を修正してタイムゾーンの問題を解決
          const date = new Date(item.date + 'T00:00:00')
          const day = date.getDate()
          salesByDate[day] = {
            sales_amount: item.sales_amount,
            customer_count: item.customer_count
          }
        })
        setSalesData(salesByDate)
        console.log('fetchSalesData 結果:', {
          取得データ件数: data.length,
          salesByDate,
          データのある日: Object.keys(salesByDate).map(day => parseInt(day)).sort((a, b) => a - b)
        })
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
    }
  }

  const fetchMonthlyTarget = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/targets?year=${currentYear}&month=${currentMonth}&store_id=${user.store_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setMonthlyTarget(data.target_amount || 0)
      }
    } catch (error) {
      console.error('目標取得エラー:', error)
    }
  }

  const saveMonthlyTarget = async (targetAmount) => {
    try {
      const token = localStorage.getItem('token')
      const requestData = {
        store_id: user.store_id,
        year: currentYear,
        month: currentMonth,
        target_amount: parseInt(targetAmount)
      }
      
      console.log('Saving target with data:', requestData)
      
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      })
      
      console.log('Save target response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('Save target result:', result)
        setMonthlyTarget(parseInt(targetAmount))
        setMessage('目標売上を保存しました')
        setTimeout(() => setMessage(''), 3000)
        // 目標を再取得して最新の状態を確認
        fetchMonthlyTarget()
      } else {
        const errorResult = await response.json()
        console.error('Save target error response:', errorResult)
        setMessage(`保存エラー: ${errorResult.error}`)
      }
    } catch (error) {
      console.error('目標保存エラー:', error)
      setMessage('目標売上の保存に失敗しました')
    }
  }

  const handleTargetEdit = () => {
    setTargetEditing(true)
    setTempTarget(monthlyTarget.toString())
  }

  const handleTargetSave = () => {
    if (tempTarget && !isNaN(tempTarget)) {
      saveMonthlyTarget(tempTarget)
      setTargetEditing(false)
    }
  }

  const handleTargetCancel = () => {
    setTargetEditing(false)
    setTempTarget('')
  }

  const handleInputChange = (day, field, value) => {
    setSalesData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value === '' ? undefined : (parseFloat(value) || 0)
      }
    }))
  }

  const handleCheckboxChange = (day, checked) => {
    const newSelectedDays = new Set(selectedDays)
    if (checked) {
      newSelectedDays.add(day)
    } else {
      newSelectedDays.delete(day)
    }
    setSelectedDays(newSelectedDays)
  }

  const handleDeleteSelected = async () => {
    if (selectedDays.size === 0) {
      setMessage('削除する日付を選択してください')
      return
    }

    const confirmDelete = window.confirm(`選択した${selectedDays.size}日分のデータを削除してもよろしいですか？`)
    if (!confirmDelete) return

    setDeleteLoading(true)
    setMessage('')

    try {
      const token = localStorage.getItem('token')
      const deleteRequests = Array.from(selectedDays).map(day => {
        const dateString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        return {
          date: dateString,
          store_id: user.store_id,
          delete: true
        }
      })

      const response = await fetch('/api/sales/monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates: deleteRequests })
      })

      if (response.ok) {
        setMessage(`${selectedDays.size}日分のデータを削除しました`)
        setSelectedDays(new Set())
        fetchSalesData()
      } else {
        setMessage('削除に失敗しました')
      }
    } catch (error) {
      console.error('削除エラー:', error)
      setMessage('削除中にエラーが発生しました')
    } finally {
      setDeleteLoading(false)
    }
  }

  const calculateExTax = (taxIncAmount) => {
    return Math.round(taxIncAmount / (1 + TAX_RATE))
  }

  const calculateAvgCustomerPrice = (sales, customers) => {
    if (customers === 0) return 0
    return Math.round(sales / customers)
  }

  const getMonthlyTotals = () => {
    let totalSales = 0
    let totalCustomers = 0
    let totalExTaxSales = 0

    Object.keys(salesData).forEach(day => {
      const dayData = salesData[day]
      if (dayData.sales_amount > 0) {
        totalSales += dayData.sales_amount
        totalCustomers += dayData.customer_count
        totalExTaxSales += calculateExTax(dayData.sales_amount)
      }
    })

    return {
      totalSales,
      totalCustomers,
      totalExTaxSales,
      avgCustomerPrice: calculateAvgCustomerPrice(totalSales, totalCustomers)
    }
  }

  const calculateProgress = () => {
    const today = new Date()
    const currentDay = today.getDate()
    const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth
    
    // データが入力されている最後の日付を取得（0も含む、undefinedと空文字列は除外）
    const daysWithData = Object.keys(salesData).map(day => parseInt(day)).filter(day => {
      const dayData = salesData[day]
      if (!dayData) return false
      
      // 売上も客数も空文字列またはundefinedの場合は除外
      const hasSales = dayData.sales_amount !== undefined && dayData.sales_amount !== ''
      const hasCustomers = dayData.customer_count !== undefined && dayData.customer_count !== ''
      
      return hasSales || hasCustomers
    }).sort((a, b) => b - a) // 降順ソート
    
    const lastDataDay = daysWithData.length > 0 ? daysWithData[0] : 0
    
    // 計画進捗率の基準日数: データのある最後の日付（15日まで入力したら15日として計算）
    const targetDay = lastDataDay > 0 ? lastDataDay : (isCurrentMonth ? currentDay : daysInMonth)
    
    // 計画進捗率 = 基準日数 / 月の総日数 * 100
    const planProgress = (targetDay / daysInMonth) * 100
    
    // 実績売上
    const actualSales = getMonthlyTotals().totalSales
    
    // 達成率 = 実績売上 / 目標売上 * 100
    const achievementRate = monthlyTarget > 0 ? (actualSales / monthlyTarget) * 100 : 0
    
    // 計画比進捗率 = 達成率 / 計画進捗率 * 100
    const progressRatio = planProgress > 0 ? (achievementRate / planProgress) * 100 : 0
    
    // 実績客数
    const actualCustomers = getMonthlyTotals().totalCustomers
    
    // 営業日数（データが入力されている日数）
    const businessDays = daysWithData.length
    
    // デバッグ情報
    console.log('calculateProgress デバッグ情報:', {
      currentYear,
      currentMonth,
      today: today.toDateString(),
      currentDay,
      isCurrentMonth,
      daysWithData,
      lastDataDay,
      targetDay,
      businessDays,
      daysInMonth,
      planProgress,
      salesDataKeys: Object.keys(salesData),
      salesDataSample: Object.keys(salesData).slice(0, 5).map(day => ({
        day,
        data: salesData[day]
      }))
    })
    
    return {
      planProgress: Math.round(planProgress * 10) / 10,
      achievementRate: Math.round(achievementRate * 10) / 10,
      progressRatio: Math.round(progressRatio * 10) / 10,
      actualSales,
      actualCustomers,
      targetDay,
      businessDays,
      isCurrentMonth
    }
  }

  const handleUpdateMonth = async () => {
    setLoading(true)
    setMessage('')

    try {
      const updates = []
      Object.keys(salesData).forEach(day => {
        const dayData = salesData[day]
        // 0値も含めて更新（売上・客数のいずれかが入力されている場合）
        // 空文字列の場合は削除扱いとする
        const hasSales = dayData.sales_amount !== undefined && dayData.sales_amount !== ''
        const hasCustomers = dayData.customer_count !== undefined && dayData.customer_count !== ''
        
        if (hasSales || hasCustomers) {
          // 日付を正確に作成するために、年月日を直接文字列で作成
          const dateString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
          updates.push({
            date: dateString,
            sales_amount: dayData.sales_amount === '' ? 0 : (dayData.sales_amount || 0),
            customer_count: dayData.customer_count === '' ? 0 : (dayData.customer_count || 0),
            store_id: user.store_id
          })
        } else if (dayData.sales_amount === '' && dayData.customer_count === '') {
          // 両方が空文字列の場合は削除リクエストに追加
          const dateString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
          updates.push({
            date: dateString,
            sales_amount: null,
            customer_count: null,
            store_id: user.store_id,
            delete: true
          })
        }
      })

      const response = await fetch('/api/sales/monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      if (response.ok) {
        setMessage('月次データを更新しました')
        fetchMonthlySalesData()
      } else {
        const error = await response.json()
        setMessage(`エラー: ${error.error}`)
      }
    } catch (error) {
      setMessage('更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const changeMonth = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(newDate)
  }

  const getDayOfWeek = (day) => {
    const date = new Date(currentYear, currentMonth - 1, day)
    const dayOfWeek = date.getDay()
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    return { name: dayNames[dayOfWeek], dayOfWeek }
  }

  const getDayColor = (dayOfWeek) => {
    if (dayOfWeek === 0) return '#ff6b6b' // 日曜日：モダンな赤
    if (dayOfWeek === 6) return '#4dabf7' // 土曜日：モダンな青
    return '#495057' // 平日：ダークグレー
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
          store_id: user.store_id
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        setMessage(`CSVアップロード完了: ${result.success}件成功, ${result.errors}件エラー${result.errorDetails && result.errorDetails.length > 0 ? '\n\nエラー詳細:\n' + result.errorDetails.slice(0, 5).join('\n') : ''}`)
        fetchMonthlySalesData()
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
      const response = await fetch(`/api/sales/csv-download?year=${currentYear}&month=${currentMonth}&store_id=${user.store_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sales_data_${currentYear}${currentMonth.toString().padStart(2, '0')}.csv`
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

  const monthlyTotals = getMonthlyTotals()
  const progressData = calculateProgress()

  if (activeTab === 'analytics') {
    return <SalesAnalytics user={user} onTabChange={setActiveTab} />
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '10px'
    }}>
      {/* メインコンテナ */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* タブナビゲーション */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '20px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          padding: '8px',
          borderRadius: '12px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('daily')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'daily' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'transparent',
              color: activeTab === 'daily' ? 'white' : '#667eea',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'daily' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
            }}
          >
            📊 日次入力
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'analytics' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'transparent',
              color: activeTab === 'analytics' ? 'white' : '#667eea',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'analytics' ? '0 4px 15px rgba(102, 126, 234, 0.4)' : 'none'
            }}
          >
            📈 売上分析
          </button>
        </div>

        {/* ヘッダーセクション */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{ textAlign: 'center', fontSize: '20px', marginBottom: '15px', fontWeight: 'bold' }}>
            🏪 {user.store_name}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <button 
              onClick={() => changeMonth(-1)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              ← 前月
            </button>
            
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              📅 {currentYear}年{currentMonth}月
            </h3>
            
            <button 
              onClick={() => changeMonth(1)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              次月 →
            </button>
          </div>

          {/* アクションボタン */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleUpdateMonth}
              disabled={loading}
              style={{
                background: loading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
            >
              {loading ? '⏳ 更新中...' : '💾 更新'}
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={deleteLoading || selectedDays.size === 0}
              style={{
                background: (deleteLoading || selectedDays.size === 0) ? 'rgba(255,255,255,0.3)' : 'rgba(220, 53, 69, 0.8)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: (deleteLoading || selectedDays.size === 0) ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
            >
              {deleteLoading ? '🗑️ 削除中...' : `🗑️ 選択削除${selectedDays.size > 0 ? `(${selectedDays.size}件)` : ''}`}
            </button>

            <button
              onClick={() => window.open('https://lm-order.com', '_blank')}
              style={{
                background: 'rgba(40, 167, 69, 0.8)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
            >
              🛒 LUIDA注文
            </button>

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
                background: csvLoading ? 'rgba(255,255,255,0.3)' : 'rgba(255, 193, 7, 0.8)',
                color: csvLoading ? 'white' : '#212529',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: csvLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
              title="CSV形式: 日付,税込売上,客数"
            >
              {csvLoading ? '📤 アップロード中...' : '📤 CSV取込'}
            </button>

            <button
              onClick={handleCsvDownload}
              style={{
                background: 'rgba(108, 117, 125, 0.8)',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.3s ease'
              }}
            >
              📥 CSV出力
            </button>
          </div>

          {message && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              background: message.includes('エラー') 
                ? 'rgba(248, 215, 218, 0.9)' 
                : 'rgba(212, 237, 218, 0.9)',
              border: `2px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '8px',
              color: message.includes('エラー') ? '#721c24' : '#155724',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {message}
            </div>
          )}
        </div>

        {/* 目標売上設定 */}
        <div style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          padding: '20px',
          borderRadius: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>🎯 目標売上・進捗管理</h4>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px', 
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>目標売上:</span>
            {targetEditing ? (
              <>
                <input
                  type="number"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    width: '150px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease'
                  }}
                  placeholder="目標金額"
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#dee2e6'}
                />
                <button
                  onClick={handleTargetSave}
                  style={{
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ✅ 保存
                </button>
                <button
                  onClick={handleTargetCancel}
                  style={{
                    background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ❌ キャンセル
                </button>
              </>
            ) : (
              <>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: monthlyTarget > 0 ? '#667eea' : '#6c757d'
                }}>
                  ¥{monthlyTarget.toLocaleString()}
                </span>
                <button
                  onClick={handleTargetEdit}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ✏️ 編集
                </button>
              </>
            )}
          </div>

          {/* 進捗指標カード */}
          {monthlyTarget > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '0px'
            }}>
              {/* 売上合計 */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>売上合計</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  ¥{progressData.actualSales.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  📊 月次売上実績
                </div>
              </div>

              {/* 客数合計 */}
              <div style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(240, 147, 251, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>客数合計</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {progressData.actualCustomers.toLocaleString()}人
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  👥 月次来客実績
                </div>
              </div>

              {/* 達成率 */}
              <div style={{
                background: progressData.achievementRate >= 100 
                  ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                  : progressData.achievementRate >= 80
                  ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
                  : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: progressData.achievementRate >= 100
                  ? '0 4px 15px rgba(79, 172, 254, 0.4)'
                  : progressData.achievementRate >= 80
                  ? '0 4px 15px rgba(67, 233, 123, 0.4)'
                  : '0 4px 15px rgba(250, 112, 154, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>達成率</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {progressData.achievementRate.toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  🎯 目標対比
                </div>
              </div>

              {/* 計画進捗率 */}
              <div style={{
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                color: '#2d3748',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(168, 237, 234, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>計画進捗率</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {progressData.planProgress.toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  📅 {progressData.targetDay}/{daysInMonth}日
                </div>
              </div>

              {/* 日平均売上 */}
              <div style={{
                background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                color: '#2d3748',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(255, 236, 210, 0.6)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>日平均売上</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  ¥{progressData.businessDays > 0 ? Math.round(progressData.actualSales / progressData.businessDays).toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  💰 営業日平均
                </div>
              </div>

              {/* 日平均客数 */}
              <div style={{
                background: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
                color: '#2d3748',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(210, 153, 194, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '50%'
                }}></div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>日平均客数</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {progressData.businessDays > 0 ? Math.round(progressData.actualCustomers / progressData.businessDays) : 0}人
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  🙋‍♂️ 営業日平均
                </div>
              </div>
            </div>
          )}
        </div>

        {/* メインテーブル */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center'
            }}>
              📊 月次売上データ入力
            </h3>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: '0px' 
          }}>
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table style={{ 
                borderCollapse: 'collapse', 
                fontSize: '13px',
                margin: '0 auto',
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                border: 'none'
              }}>
                <thead>
                  <tr style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                  }}>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '40px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </th>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '80px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      📅 日付
                    </th>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '120px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      💰 売上(税込)
                    </th>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '70px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      👥 客数
                    </th>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '120px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      💵 売上(税抜)
                    </th>
                    <th style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center', 
                      width: '120px',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                      📊 平均客単価
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const dayData = salesData[day] || { sales_amount: 0, customer_count: 0 }
                    const exTaxAmount = calculateExTax(dayData.sales_amount)
                    const avgPrice = calculateAvgCustomerPrice(dayData.sales_amount, dayData.customer_count)
                    const { name: dayName, dayOfWeek } = getDayOfWeek(day)
                    const dayColor = getDayColor(dayOfWeek)
                    
                    return (
                      <tr key={day} style={{
                        borderBottom: '1px solid #f1f3f4',
                        transition: 'all 0.2s ease'
                      }}>
                        <td style={{ 
                          padding: '8px', 
                          border: 'none', 
                          textAlign: 'center',
                          width: '40px',
                          background: 'linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%)'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedDays.has(day)}
                            onChange={(e) => handleCheckboxChange(day, e.target.checked)}
                            style={{
                              cursor: 'pointer',
                              transform: 'scale(1.2)',
                              accentColor: '#667eea'
                            }}
                          />
                        </td>
                        <td style={{ 
                          padding: '8px 6px', 
                          border: 'none', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          color: dayColor,
                          width: '80px',
                          fontSize: '12px',
                          background: 'linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%)'
                        }}>
                          {day}({dayName})
                        </td>
                        <td style={{ 
                          padding: '6px', 
                          border: 'none', 
                          width: '120px'
                        }}>
                          <input
                            type="number"
                            value={dayData.sales_amount || ''}
                            onChange={(e) => handleInputChange(day, 'sales_amount', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              textAlign: 'right',
                              fontSize: '13px',
                              backgroundColor: '#fff',
                              outline: 'none',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                            }}
                            placeholder=""
                            min="0"
                            onFocus={(e) => {
                              e.target.style.borderColor = '#667eea'
                              e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#e2e8f0'
                              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)'
                            }}
                          />
                        </td>
                        <td style={{ 
                          padding: '6px', 
                          border: 'none', 
                          width: '70px'
                        }}>
                          <input
                            type="number"
                            value={dayData.customer_count || ''}
                            onChange={(e) => handleInputChange(day, 'customer_count', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              textAlign: 'right',
                              fontSize: '13px',
                              backgroundColor: '#fff',
                              outline: 'none',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                            }}
                            placeholder=""
                            min="0"
                            onFocus={(e) => {
                              e.target.style.borderColor = '#667eea'
                              e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#e2e8f0'
                              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)'
                            }}
                          />
                        </td>
                        <td style={{ 
                          padding: '8px 10px', 
                          border: 'none', 
                          textAlign: 'right',
                          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                          width: '120px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}>
                          {exTaxAmount > 0 ? `¥${exTaxAmount.toLocaleString()}` : ''}
                        </td>
                        <td style={{ 
                          padding: '8px 10px', 
                          border: 'none', 
                          textAlign: 'right',
                          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                          width: '120px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#4a5568'
                        }}>
                          {avgPrice > 0 ? `¥${avgPrice.toLocaleString()}` : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center',
                      fontSize: '13px'
                    }}>
                      📊 月計
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'center',
                      fontSize: '13px'
                    }}>
                      —
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'right',
                      fontSize: '13px'
                    }}>
                      ¥{monthlyTotals.totalSales.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'right',
                      fontSize: '13px'
                    }}>
                      {monthlyTotals.totalCustomers}人
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'right',
                      fontSize: '13px'
                    }}>
                      ¥{monthlyTotals.totalExTaxSales.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: '12px 8px', 
                      border: 'none', 
                      textAlign: 'right',
                      fontSize: '13px'
                    }}>
                      ¥{monthlyTotals.avgCustomerPrice.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        
        {/* ユーザー情報フッター */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '15px', 
          borderRadius: '12px',
          marginTop: '20px',
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>👤 ユーザー情報</h4>
          <p style={{ margin: '4px 0', fontSize: '13px' }}>
            <strong>🏪 店舗:</strong> {user.store_name}
          </p>
          <p style={{ margin: '4px 0', fontSize: '13px' }}>
            <strong>👤 ユーザー:</strong> {user.username}
          </p>
        </div>
      </div>
    </div>
  )
}