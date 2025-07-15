import jwt from 'jsonwebtoken'
import { SalesData } from '../../../lib/db'

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
      if (req.method === 'POST') {
        const { date, sales_amount, customer_count, store_id } = req.body
        let storeId

        if (req.user.role === 'admin') {
          if (!store_id) {
            return res.status(400).json({ error: '店舗IDが必要です' })
          }
          storeId = store_id
        } else {
          storeId = req.user.store_id
        }

        if (!date || sales_amount === undefined || customer_count === undefined) {
          return res.status(400).json({ error: '全ての項目を入力してください' })
        }

        if (sales_amount < 0 || customer_count < 0) {
          return res.status(400).json({ error: '売上金額と客数は0以上で入力してください' })
        }

        const salesData = await SalesData.create(storeId, date, parseInt(sales_amount), parseInt(customer_count))
        res.status(201).json({ message: '売上データが保存されました', data: salesData })
      } else if (req.method === 'GET') {
        const salesData = await SalesData.getAll()
        res.status(200).json(salesData)
      } else {
        res.status(405).json({ error: 'Method not allowed' })
      }
    } catch (error) {
      console.error('売上データ処理エラー:', error)
      if (error.message.includes('duplicate key')) {
        res.status(409).json({ error: 'この日付の売上データは既に存在します' })
      } else {
        res.status(500).json({ error: 'サーバーエラーが発生しました' })
      }
    }
  })
}