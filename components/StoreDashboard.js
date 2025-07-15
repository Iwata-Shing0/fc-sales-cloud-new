import { useState, useEffect } from 'react'

export default function StoreDashboard({ user }) {
  const [salesData, setSalesData] = useState({
    date: new Date().toISOString().split('T')[0],
    sales_amount: '',
    customer_count: ''
  })
  const [historicalData, setHistoricalData] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchHistoricalData()
  }, [])

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('/api/sales')
      if (response.ok) {
        const data = await response.json()
        setHistoricalData(data.filter(item => item.store_id === user.store_id))
      }
    } catch (error) {
      console.error('データ取得エラー:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...salesData,
          store_id: user.store_id
        }),
      })

      if (response.ok) {
        setMessage('売上データを保存しました')
        setSalesData({
          date: new Date().toISOString().split('T')[0],
          sales_amount: '',
          customer_count: ''
        })
        fetchHistoricalData()
      } else {
        const error = await response.json()
        setMessage(`エラー: ${error.error}`)
      }
    } catch (error) {
      setMessage('保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setSalesData({
      ...salesData,
      [e.target.name]: e.target.value
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount)
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: '20px' }}>
        {user.store_name} - 売上管理
      </h2>

      <div className="card">
        <h3>日別売上・客数入力</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="date">日付:</label>
            <input
              type="date"
              id="date"
              name="date"
              value={salesData.date}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="sales_amount">売上金額:</label>
            <input
              type="number"
              id="sales_amount"
              name="sales_amount"
              value={salesData.sales_amount}
              onChange={handleChange}
              placeholder="売上金額を入力"
              required
              min="0"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="customer_count">客数:</label>
            <input
              type="number"
              id="customer_count"
              name="customer_count"
              value={salesData.customer_count}
              onChange={handleChange}
              placeholder="客数を入力"
              required
              min="0"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </form>
        
        {message && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: message.includes('エラー') ? '#f8d7da' : '#d4edda',
            border: `1px solid ${message.includes('エラー') ? '#f5c6cb' : '#c3e6cb'}`,
            borderRadius: '5px',
            color: message.includes('エラー') ? '#721c24' : '#155724'
          }}>
            {message}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3>過去の売上データ</h3>
        {historicalData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>日付</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>売上金額</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>客数</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>客単価</th>
                </tr>
              </thead>
              <tbody>
                {historicalData.slice(-10).reverse().map((item, index) => (
                  <tr key={index}>
                    <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                      {new Date(item.date).toLocaleDateString('ja-JP')}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                      {formatCurrency(item.sales_amount)}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                      {item.customer_count}人
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                      {formatCurrency(Math.round(item.sales_amount / item.customer_count))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>売上データがありません。</p>
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