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
        let salesData

        if (req.user.role === 'admin') {
          salesData = await SalesData.findByMonth(parseInt(year), parseInt(month))
        } else {
          salesData = await SalesData.findByStoreAndMonth(req.user.store_id, parseInt(year), parseInt(month))
        }

        res.json(salesData)
      } else {
        res.status(405).json({ message: 'Method not allowed' })
      }
    } catch (error) {
      console.error('月別売上データ取得エラー:', error)
      res.status(500).json({ message: 'サーバーエラーが発生しました' })
    }
  })
}