import { supabase } from '../../../lib/supabase'
import jwt from 'jsonwebtoken'

function authenticateToken(req) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    throw new Error('アクセストークンが必要です')
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET)
    return user
  } catch (err) {
    throw new Error('トークンが無効です')
  }
}

export default async function handler(req, res) {
  try {
    const user = authenticateToken(req)
    req.user = user

    // 管理者のみアクセス可能
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'アクセス権限がありません' })
    }

    if (req.method === 'GET') {
      const { year, month } = req.query

      if (!year || !month) {
        return res.status(400).json({ error: '年月の指定が必要です' })
      }

      // 指定月の全店舗の売上データを取得
      const { data: salesData, error } = await supabase
        .from('sales_data')
        .select('sales_amount, customer_count')
        .gte('date', `${year}-${month.toString().padStart(2, '0')}-01`)
        .lt('date', `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`)

      if (error) {
        return res.status(500).json({ error: '売上データの取得に失敗しました' })
      }

      // 統計情報を計算
      const totalSales = salesData.reduce((sum, item) => sum + item.sales_amount, 0)
      const totalCustomers = salesData.reduce((sum, item) => sum + item.customer_count, 0)
      const avgCustomerPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0
      const avgSales = salesData.length > 0 ? Math.round(totalSales / salesData.length) : 0

      res.status(200).json({
        totalSales,
        totalCustomers,
        avgCustomerPrice,
        avgSales,
        recordCount: salesData.length
      })

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Admin statistics API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}