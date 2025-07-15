import jwt from 'jsonwebtoken'
import { SalesData } from '../../../../../lib/db'

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'アクセストークンが必要です' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'トークンが無効です' })
    }
    req.user = user
    next()
  })
}

export default async function handler(req, res) {
  authenticateToken(req, res, async () => {
    try {
      if (req.method === 'GET') {
        const { year, month } = req.query

        if (req.user.role !== 'admin') {
          return res.status(403).json({ message: 'アクセス権限がありません' })
        }

        try {
          const salesData = await SalesData.getMonthlyTotalByStore(parseInt(year), parseInt(month))
          res.json(salesData)
        } catch (error) {
          console.log('Database function not found, using direct query:', error.message)
          // 関数が存在しない場合は直接クエリ
          const salesData = await SalesData.findByMonth(parseInt(year), parseInt(month))
          
          // 店舗別に集計
          const storeMap = {}
          salesData.forEach(item => {
            if (!storeMap[item.store_id]) {
              storeMap[item.store_id] = {
                store_id: item.store_id,
                store_name: item.stores?.name || 'Unknown',
                total_sales: 0,
                total_customers: 0,
                days_count: 0
              }
            }
            storeMap[item.store_id].total_sales += item.sales_amount
            storeMap[item.store_id].total_customers += item.customer_count
            if (item.sales_amount > 0) {
              storeMap[item.store_id].days_count += 1
            }
          })

          // 配列に変換して売上順にソート
          const result = Object.values(storeMap).map(store => ({
            ...store,
            avg_daily_sales: store.days_count > 0 ? store.total_sales / store.days_count : 0
          })).sort((a, b) => b.total_sales - a.total_sales)

          res.json(result)
        }
      } else {
        res.status(405).json({ message: 'Method not allowed' })
      }
    } catch (error) {
      console.error('月別売上データ取得エラー:', error)
      res.status(500).json({ message: 'サーバーエラーが発生しました' })
    }
  })
}