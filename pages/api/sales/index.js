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
        const { date, salesAmount, customerCount } = req.body
        let storeId

        if (req.user.role === 'admin') {
          if (!req.body.storeId) {
            return res.status(400).json({ message: '店舗IDが必要です' })
          }
          storeId = req.body.storeId
        } else {
          storeId = req.user.store_id
        }

        if (!date || !salesAmount || !customerCount) {
          return res.status(400).json({ message: '全ての項目を入力してください' })
        }

        const salesData = await SalesData.create(storeId, date, parseInt(salesAmount), parseInt(customerCount))
        res.status(201).json({ message: '売上データが保存されました', data: salesData })
      } else {
        res.status(405).json({ message: 'Method not allowed' })
      }
    } catch (error) {
      console.error('売上データ保存エラー:', error)
      res.status(500).json({ message: 'サーバーエラーが発生しました' })
    }
  })
}