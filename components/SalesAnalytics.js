import { useState, useEffect } from 'react'

export default function SalesAnalytics({ user }) {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState([])
  const [yearSummary, setYearSummary] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [editingTarget, setEditingTarget] = useState({ month: null, amount: '' })

  useEffect(() => {
    fetchMonthlySummary()
  }, [currentYear])

  const fetchMonthlySummary = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/sales/monthly-summary?year=${currentYear}&store_id=${user.store_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setMonthlyData(data.monthlyData)
        setYearSummary(data.yearSummary)
      } else {
        setMessage('データの取得に失敗しました')
      }
    } catch (error) {
      setMessage('データ取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleTargetUpdate = async (month, amount) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          year: currentYear,
          month,
          target_amount: parseInt(amount),
          store_id: user.store_id
        })
      })

      if (response.ok) {
        setMessage('目標売上を更新しました')
        fetchMonthlySummary()
        setEditingTarget({ month: null, amount: '' })
      } else {
        setMessage('目標売上の更新に失敗しました')
      }
    } catch (error) {
      setMessage('更新中にエラーが発生しました')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  const getProgressBarColor = (rate) => {
    if (rate >= 100) return '#28a745'
    if (rate >= 80) return '#ffc107'
    return '#dc3545'
  }

  const getGrowthColor = (rate) => {
    if (rate > 0) return '#28a745'
    if (rate === 0) return '#6c757d'
    return '#dc3545'
  }

  const maxSales = Math.max(...monthlyData.map(d => Math.max(d.sales, d.target, d.previousYearSales)))

  return (
    <div className="container" style={{ padding: '10px' }}>
      {/* ヘッダー */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '15px', 
        borderRadius: '5px', 
        marginBottom: '15px',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>
          {user.store_name} - 売上分析
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <button 
            onClick={() => setCurrentYear(currentYear - 1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ← {currentYear - 1}年
          </button>
          
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            {currentYear}年
          </h3>
          
          <button 
            onClick={() => setCurrentYear(currentYear + 1)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {currentYear + 1}年 →
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>年間売上</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCurrency(yearSummary.totalSales)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>年間目標</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCurrency(yearSummary.totalTarget)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>達成率</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: getProgressBarColor(yearSummary.achievementRate)
                }}>
                  {yearSummary.achievementRate}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>前年比</div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: getGrowthColor(yearSummary.growthRate)
                }}>
                  {yearSummary.growthRate > 0 ? '+' : ''}{yearSummary.growthRate}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>平均客単価</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {formatCurrency(yearSummary.avgCustomerPrice)}
                </div>
              </div>
            </div>
          </div>

          {/* グラフ表示 */}
          <div style={{ 
            backgroundColor: 'white', 
            padding: '15px', 
            borderRadius: '5px', 
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>月別売上推移</h3>
            <div style={{ 
              display: 'flex', 
              alignItems: 'end', 
              height: '200px', 
              gap: '2px',
              padding: '10px 0'
            }}>
              {monthlyData.map((data, index) => (
                <div 
                  key={index} 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    height: '100%'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'end', 
                    width: '100%', 
                    height: '160px',
                    gap: '1px'
                  }}>
                    {/* 実績 */}
                    <div
                      style={{
                        width: '33%',
                        height: `${(data.sales / maxSales) * 100}%`,
                        backgroundColor: '#007bff',
                        minHeight: data.sales > 0 ? '3px' : '0'
                      }}
                      title={`実績: ${formatCurrency(data.sales)}`}
                    />
                    {/* 目標 */}
                    <div
                      style={{
                        width: '33%',
                        height: `${(data.target / maxSales) * 100}%`,
                        backgroundColor: '#28a745',
                        minHeight: data.target > 0 ? '3px' : '0'
                      }}
                      title={`目標: ${formatCurrency(data.target)}`}
                    />
                    {/* 前年 */}
                    <div
                      style={{
                        width: '33%',
                        height: `${(data.previousYearSales / maxSales) * 100}%`,
                        backgroundColor: '#ffc107',
                        minHeight: data.previousYearSales > 0 ? '3px' : '0'
                      }}
                      title={`前年: ${formatCurrency(data.previousYearSales)}`}
                    />
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '5px' }}>
                    {data.month}月
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '12px' }}>
              <span><span style={{ backgroundColor: '#007bff', width: '12px', height: '12px', display: 'inline-block', marginRight: '5px' }}></span>実績</span>
              <span><span style={{ backgroundColor: '#28a745', width: '12px', height: '12px', display: 'inline-block', marginRight: '5px' }}></span>目標</span>
              <span><span style={{ backgroundColor: '#ffc107', width: '12px', height: '12px', display: 'inline-block', marginRight: '5px' }}></span>前年</span>
            </div>
          </div>

          {/* 月別詳細テーブル */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              backgroundColor: 'white',
              fontSize: '11px'
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
                {monthlyData.map((data, index) => (
                  <tr key={index}>
                    <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>
                      {data.month}月
                    </td>
                    <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                      ¥{data.sales.toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 4px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                      {editingTarget.month === data.month ? (
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <input
                            type="number"
                            value={editingTarget.amount}
                            onChange={(e) => setEditingTarget({ ...editingTarget, amount: e.target.value })}
                            style={{ width: '60px', fontSize: '10px', padding: '2px' }}
                          />
                          <button
                            onClick={() => handleTargetUpdate(data.month, editingTarget.amount)}
                            style={{ fontSize: '10px', padding: '2px 4px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '2px' }}
                          >
                            保存
                          </button>
                        </div>
                      ) : (
                        <span 
                          onClick={() => setEditingTarget({ month: data.month, amount: data.target })}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          ¥{data.target.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td style={{ 
                      padding: '6px 4px', 
                      border: '1px solid #dee2e6', 
                      textAlign: 'center',
                      color: getProgressBarColor(data.achievementRate),
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
                      color: getGrowthColor(data.growthRate),
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

          {message && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: message.includes('エラー') ? '#f8d7da' : '#d4edda',
              border: `1px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '5px',
              color: message.includes('エラー') ? '#721c24' : '#155724',
              textAlign: 'center',
              fontSize: '12px'
            }}>
              {message}
            </div>
          )}
        </>
      )}
    </div>
  )
}