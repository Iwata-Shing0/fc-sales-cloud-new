import { useState, useEffect } from 'react'

export default function StoreDashboard({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [salesData, setSalesData] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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

  const monthlyTotals = getMonthlyTotals()

  return (
    <div className="container">
      <h2 style={{ marginBottom: '20px' }}>
        {user.store_name} - 月次売上管理
      </h2>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button 
            onClick={() => changeMonth(-1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ← 前月
          </button>
          
          <h3 style={{ margin: 0 }}>
            {currentYear}年{currentMonth}月
          </h3>
          
          <button 
            onClick={() => changeMonth(1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            次月 →
          </button>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>日</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>売上（税込）</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>客数</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>売上（税抜）</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>平均客単価</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayData = salesData[day] || { sales_amount: 0, customer_count: 0 }
                const exTaxAmount = calculateExTax(dayData.sales_amount)
                const avgPrice = calculateAvgCustomerPrice(dayData.sales_amount, dayData.customer_count)
                
                return (
                  <tr key={day}>
                    <td style={{ 
                      padding: '8px', 
                      border: '1px solid #dee2e6', 
                      textAlign: 'center',
                      fontWeight: 'bold'
                    }}>
                      {day}
                    </td>
                    <td style={{ padding: '5px', border: '1px solid #dee2e6' }}>
                      <input
                        type="number"
                        value={dayData.sales_amount || ''}
                        onChange={(e) => handleInputChange(day, 'sales_amount', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '3px',
                          textAlign: 'right'
                        }}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td style={{ padding: '5px', border: '1px solid #dee2e6' }}>
                      <input
                        type="number"
                        value={dayData.customer_count || ''}
                        onChange={(e) => handleInputChange(day, 'customer_count', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '3px',
                          textAlign: 'right'
                        }}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      border: '1px solid #dee2e6', 
                      textAlign: 'right',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {exTaxAmount > 0 ? `¥${exTaxAmount.toLocaleString()}` : ''}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      border: '1px solid #dee2e6', 
                      textAlign: 'right',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {avgPrice > 0 ? `¥${avgPrice.toLocaleString()}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                  月計
                </td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                  ¥{monthlyTotals.totalSales.toLocaleString()}
                </td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                  {monthlyTotals.totalCustomers}人
                </td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                  ¥{monthlyTotals.totalExTaxSales.toLocaleString()}
                </td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                  ¥{monthlyTotals.avgCustomerPrice.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button
            onClick={handleUpdateMonth}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '12px 30px',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '更新中...' : '更新'}
          </button>
        </div>

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: message.includes('エラー') ? '#f8d7da' : '#d4edda',
            border: `1px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
            borderRadius: '5px',
            color: message.includes('エラー') ? '#721c24' : '#155724',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
      </div>
      
      <div className="card" style={{ marginTop: '20px' }}>
        <h4>現在のユーザー情報</h4>
        <p><strong>店舗名:</strong> {user.store_name}</p>
        <p><strong>ユーザー名:</strong> {user.username}</p>
        <p><strong>権限:</strong> 店舗ユーザー</p>
      </div>
    </div>
  )
}