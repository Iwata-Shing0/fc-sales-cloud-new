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
    if (dayOfWeek === 0) return '#dc3545' // 日曜日：赤
    if (dayOfWeek === 6) return '#007bff' // 土曜日：青
    return '#495057' // 平日：グレー
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
      backgroundColor: '#f8f9fa',
      padding: '10px'
    }}>
      {/* メインコンテナ */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* タブナビゲーション */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginBottom: '15px',
          backgroundColor: '#f8f9fa',
          padding: '4px',
          borderRadius: '6px'
        }}>
          <button
            onClick={() => setActiveTab('daily')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'daily' ? '#007bff' : 'transparent',
              color: activeTab === 'daily' ? 'white' : '#007bff',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            日次入力
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'analytics' ? '#007bff' : 'transparent',
              color: activeTab === 'analytics' ? 'white' : '#007bff',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            売上分析
          </button>
        </div>

        {/* ヘッダーセクション */}
        <div style={{ 
          backgroundColor: '#f8f9fa',
          color: '#495057',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '10px',
          border: '1px solid #dee2e6'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button 
              onClick={() => changeMonth(-1)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              ← 前月
            </button>
            
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              {currentYear}年{currentMonth}月
            </h3>
            
            <button 
              onClick={() => changeMonth(1)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              次月 →
            </button>
          </div>

          {/* アクションボタン */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleUpdateMonth}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              {loading ? '更新中...' : '更新'}
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={deleteLoading || selectedDays.size === 0}
              style={{
                backgroundColor: (deleteLoading || selectedDays.size === 0) ? '#6c757d' : '#dc3545',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: (deleteLoading || selectedDays.size === 0) ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              {deleteLoading ? '削除中...' : `選択削除${selectedDays.size > 0 ? `(${selectedDays.size}件)` : ''}`}
            </button>

            <button
              onClick={() => window.open('https://lm-order.com', '_blank')}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              LUIDA注文
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
                backgroundColor: csvLoading ? '#6c757d' : '#ffc107',
                color: csvLoading ? 'white' : '#212529',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: csvLoading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
              title="CSV形式: 日付,税込売上,客数"
            >
              {csvLoading ? 'アップロード中...' : 'CSV取込'}
            </button>

            <button
              onClick={handleCsvDownload}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              CSV出力
            </button>
          </div>

          {message && (
            <div style={{
              marginTop: '10px',
              padding: '8px',
              backgroundColor: message.includes('エラー') 
                ? 'rgba(248, 215, 218, 0.9)' 
                : 'rgba(212, 237, 218, 0.9)',
              border: `1px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '4px',
              color: message.includes('エラー') ? '#721c24' : '#155724',
              textAlign: 'center',
              fontSize: '12px'
            }}>
              {message}
            </div>
          )}
        </div>

        {/* 目標売上設定 */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '8px',
          borderRadius: '6px',
          marginBottom: '10px',
          border: '1px solid #dee2e6'
        }}>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            marginBottom: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#495057' }}>目標売上:</span>
            {targetEditing ? (
              <>
                <input
                  type="number"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '13px',
                    width: '120px',
                    outline: 'none'
                  }}
                  placeholder="目標金額"
                />
                <button
                  onClick={handleTargetSave}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  保存
                </button>
                <button
                  onClick={handleTargetCancel}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: monthlyTarget > 0 ? '#007bff' : '#6c757d'
                }}>
                  ¥{monthlyTarget.toLocaleString()}
                </span>
                <button
                  onClick={handleTargetEdit}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}
                >
                  編集
                </button>
              </>
            )}
          </div>

          {/* 進捗指標カード */}
          {monthlyTarget > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px'
            }}>
              {/* 売上合計 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>売上合計</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                  ¥{progressData.actualSales.toLocaleString()}
                </div>
              </div>

              {/* 客数合計 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>客数合計</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                  {progressData.actualCustomers.toLocaleString()}人
                </div>
              </div>

              {/* 達成率 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>達成率</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: progressData.achievementRate >= 100 ? '#28a745' : progressData.achievementRate >= 80 ? '#ffc107' : '#dc3545'
                }}>
                  {progressData.achievementRate.toFixed(1)}%
                </div>
              </div>

              {/* 計画進捗率 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>計画進捗率</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#6c757d' }}>
                  {progressData.planProgress.toFixed(1)}%
                </div>
              </div>

              {/* 日平均売上 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>日平均売上</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                  ¥{progressData.businessDays > 0 ? Math.round(progressData.actualSales / progressData.businessDays).toLocaleString() : '0'}
                </div>
              </div>

              {/* 日平均客数 */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                padding: '8px',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '10px', color: '#6c757d', marginBottom: '2px' }}>日平均客数</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#007bff' }}>
                  {progressData.businessDays > 0 ? Math.round(progressData.actualCustomers / progressData.businessDays) : 0}人
                </div>
              </div>
            </div>
          )}
        </div>

        {/* メインテーブル */}
        <div style={{ 
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          padding: '10px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057',
            textAlign: 'center'
          }}>
            月次売上データ入力
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              borderCollapse: 'collapse', 
              fontSize: '12px',
              margin: '0 auto',
              backgroundColor: 'white',
              borderRadius: '4px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #dee2e6'
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#007bff',
                  color: 'white'
                }}>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '40px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    選択
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '70px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    日付
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '100px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    売上(税込)
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '60px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    客数
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '100px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    売上(税抜)
                  </th>
                  <th style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center', 
                    width: '100px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    平均客単価
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
                      borderBottom: '1px solid #dee2e6'
                    }}>
                      <td style={{ 
                        padding: '6px', 
                        border: '1px solid #dee2e6', 
                        textAlign: 'center',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedDays.has(day)}
                          onChange={(e) => handleCheckboxChange(day, e.target.checked)}
                          style={{
                            cursor: 'pointer'
                          }}
                        />
                      </td>
                      <td style={{ 
                        padding: '6px 4px', 
                        border: '1px solid #dee2e6', 
                        textAlign: 'center',
                        fontWeight: '600',
                        color: dayColor,
                        fontSize: '11px',
                        backgroundColor: '#f8f9fa'
                      }}>
                        {day}({dayName})
                      </td>
                      <td style={{ 
                        padding: '4px', 
                        border: '1px solid #dee2e6'
                      }}>
                        <input
                          type="number"
                          value={dayData.sales_amount || ''}
                          onChange={(e) => handleInputChange(day, 'sales_amount', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid #ced4da',
                            borderRadius: '2px',
                            textAlign: 'right',
                            fontSize: '11px',
                            outline: 'none'
                          }}
                          placeholder=""
                          min="0"
                        />
                      </td>
                      <td style={{ 
                        padding: '4px', 
                        border: '1px solid #dee2e6'
                      }}>
                        <input
                          type="number"
                          value={dayData.customer_count || ''}
                          onChange={(e) => handleInputChange(day, 'customer_count', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid #ced4da',
                            borderRadius: '2px',
                            textAlign: 'right',
                            fontSize: '11px',
                            outline: 'none'
                          }}
                          placeholder=""
                          min="0"
                        />
                      </td>
                      <td style={{ 
                        padding: '6px 8px', 
                        border: '1px solid #dee2e6', 
                        textAlign: 'right',
                        backgroundColor: '#f8f9fa',
                        fontSize: '11px',
                        color: '#495057'
                      }}>
                        {exTaxAmount > 0 ? `¥${exTaxAmount.toLocaleString()}` : ''}
                      </td>
                      <td style={{ 
                        padding: '6px 8px', 
                        border: '1px solid #dee2e6', 
                        textAlign: 'right',
                        backgroundColor: '#f8f9fa',
                        fontSize: '11px',
                        color: '#495057'
                      }}>
                        {avgPrice > 0 ? `¥${avgPrice.toLocaleString()}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ 
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center',
                    fontSize: '12px'
                  }}>
                    月計
                  </td>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'center',
                    fontSize: '12px'
                  }}>
                    —
                  </td>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'right',
                    fontSize: '12px'
                  }}>
                    ¥{monthlyTotals.totalSales.toLocaleString()}
                  </td>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'right',
                    fontSize: '12px'
                  }}>
                    {monthlyTotals.totalCustomers}人
                  </td>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'right',
                    fontSize: '12px'
                  }}>
                    ¥{monthlyTotals.totalExTaxSales.toLocaleString()}
                  </td>
                  <td style={{ 
                    padding: '8px 6px', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    textAlign: 'right',
                    fontSize: '12px'
                  }}>
                    ¥{monthlyTotals.avgCustomerPrice.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        
        {/* ユーザー情報フッター */}
        <div style={{ 
          backgroundColor: '#f8f9fa',
          padding: '8px', 
          borderRadius: '6px',
          marginTop: '10px',
          border: '1px solid #dee2e6'
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#495057' }}>ユーザー情報</h4>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#6c757d' }}>
            <strong>店舗:</strong> {user.store_name}
          </p>
          <p style={{ margin: '2px 0', fontSize: '12px', color: '#6c757d' }}>
            <strong>ユーザー:</strong> {user.username}
          </p>
        </div>
      </div>
    </div>
  )
}