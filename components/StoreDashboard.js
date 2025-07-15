import { useState, useEffect, useRef } from 'react'

export default function StoreDashboard({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [salesData, setSalesData] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [csvLoading, setCsvLoading] = useState(false)
  const fileInputRef = useRef(null)

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

  const TAX_RATE = 0.1

  useEffect(() => {
    fetchMonthlySalesData()
  }, [currentDate])

  const fetchMonthlySalesData = async () => {
    try {
      const response = await fetch(`/api/sales?year=${currentYear}&month=${currentMonth}&store_id=${user.store_id}`)
      if (response.ok) {
        const data = await response.json()
        const salesByDate = {}
        data.forEach(item => {
          const day = new Date(item.date).getDate()
          salesByDate[day] = {
            sales_amount: item.sales_amount,
            customer_count: item.customer_count
          }
        })
        setSalesData(salesByDate)
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
    }
  }

  const handleInputChange = (day, field, value) => {
    setSalesData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: parseFloat(value) || 0
      }
    }))
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

  const handleUpdateMonth = async () => {
    setLoading(true)
    setMessage('')

    try {
      const updates = []
      Object.keys(salesData).forEach(day => {
        const dayData = salesData[day]
        if (dayData.sales_amount > 0 || dayData.customer_count > 0) {
          updates.push({
            date: new Date(currentYear, currentMonth - 1, day).toISOString().split('T')[0],
            sales_amount: dayData.sales_amount || 0,
            customer_count: dayData.customer_count || 0,
            store_id: user.store_id
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
    if (dayOfWeek === 0) return '#ff0000' // 日曜日：赤
    if (dayOfWeek === 6) return '#0000ff' // 土曜日：青
    return '#000000' // 平日：黒
  }

  const handleCsvUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setCsvLoading(true)
    setMessage('')

    try {
      const text = await file.text()
      const rows = text.split('\n').map(row => row.split(','))
      
      // ヘッダー行をスキップ
      const dataRows = rows.slice(1).filter(row => row.length >= 3 && row[0].trim())

      if (dataRows.length === 0) {
        setMessage('有効なデータが見つかりません')
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
        setMessage(`CSVアップロード完了: ${result.success}件成功, ${result.errors}件エラー`)
        fetchMonthlySalesData()
      } else {
        setMessage(`エラー: ${result.error}`)
      }
    } catch (error) {
      setMessage('CSVファイルの処理中にエラーが発生しました')
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

  return (
    <div className="container" style={{ padding: '10px' }}>
      {/* 固定ヘッダー */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        backgroundColor: '#f8f9fa', 
        zIndex: 100, 
        padding: '10px',
        borderRadius: '5px',
        marginBottom: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', fontSize: '16px', marginBottom: '10px', fontWeight: 'bold' }}>
          {user.store_name}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button 
            onClick={() => changeMonth(-1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ← 前月
          </button>
          
          <h3 style={{ margin: 0, fontSize: '16px' }}>
            {currentYear}年{currentMonth}月
          </h3>
          
          <button 
            onClick={() => changeMonth(1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            次月 →
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleUpdateMonth}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '更新中...' : '更新'}
          </button>

          <button
            onClick={() => window.open('https://lm-order.com', '_blank')}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
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
              backgroundColor: csvLoading ? '#ccc' : '#ffc107',
              color: 'black',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: csvLoading ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
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
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            CSV出力
          </button>
        </div>

        {message && (
          <div style={{
            marginTop: '10px',
            padding: '8px',
            backgroundColor: message.includes('エラー') ? '#f8d7da' : '#d4edda',
            border: `1px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
            borderRadius: '3px',
            color: message.includes('エラー') ? '#721c24' : '#155724',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            {message}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '10px' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          minWidth: '320px',
          fontSize: '12px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center', 
                width: '50px',
                fontSize: '11px'
              }}>
                日付
              </th>
              <th style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center', 
                width: '70px',
                fontSize: '11px'
              }}>
                売上(税込)
              </th>
              <th style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center', 
                width: '50px',
                fontSize: '11px'
              }}>
                客数
              </th>
              <th style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center', 
                width: '70px',
                fontSize: '11px'
              }}>
                売上(税抜)
              </th>
              <th style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center', 
                width: '70px',
                fontSize: '11px'
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
                <tr key={day}>
                  <td style={{ 
                    padding: '6px 2px', 
                    border: '1px solid #dee2e6', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: dayColor,
                    width: '50px',
                    fontSize: '11px'
                  }}>
                    {day}({dayName})
                  </td>
                  <td style={{ 
                    padding: '3px', 
                    border: '1px solid #dee2e6', 
                    width: '70px'
                  }}>
                    <input
                      type="number"
                      value={dayData.sales_amount || ''}
                      onChange={(e) => handleInputChange(day, 'sales_amount', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ccc',
                        borderRadius: '2px',
                        textAlign: 'right',
                        fontSize: '11px'
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </td>
                  <td style={{ 
                    padding: '3px', 
                    border: '1px solid #dee2e6', 
                    width: '50px'
                  }}>
                    <input
                      type="number"
                      value={dayData.customer_count || ''}
                      onChange={(e) => handleInputChange(day, 'customer_count', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ccc',
                        borderRadius: '2px',
                        textAlign: 'right',
                        fontSize: '11px'
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </td>
                  <td style={{ 
                    padding: '6px 4px', 
                    border: '1px solid #dee2e6', 
                    textAlign: 'right',
                    backgroundColor: '#f8f9fa',
                    width: '70px',
                    fontSize: '11px'
                  }}>
                    {exTaxAmount > 0 ? `¥${exTaxAmount.toLocaleString()}` : ''}
                  </td>
                  <td style={{ 
                    padding: '6px 4px', 
                    border: '1px solid #dee2e6', 
                    textAlign: 'right',
                    backgroundColor: '#f8f9fa',
                    width: '70px',
                    fontSize: '11px'
                  }}>
                    {avgPrice > 0 ? `¥${avgPrice.toLocaleString()}` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
              <td style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px'
              }}>
                月計
              </td>
              <td style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'right',
                fontSize: '11px'
              }}>
                ¥{monthlyTotals.totalSales.toLocaleString()}
              </td>
              <td style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'right',
                fontSize: '11px'
              }}>
                {monthlyTotals.totalCustomers}人
              </td>
              <td style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'right',
                fontSize: '11px'
              }}>
                ¥{monthlyTotals.totalExTaxSales.toLocaleString()}
              </td>
              <td style={{ 
                padding: '8px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'right',
                fontSize: '11px'
              }}>
                ¥{monthlyTotals.avgCustomerPrice.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '10px', 
        borderRadius: '5px',
        marginTop: '10px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>ユーザー情報</h4>
        <p style={{ margin: '4px 0', fontSize: '12px' }}>
          <strong>店舗:</strong> {user.store_name}
        </p>
        <p style={{ margin: '4px 0', fontSize: '12px' }}>
          <strong>ユーザー:</strong> {user.username}
        </p>
      </div>
    </div>
  )
}