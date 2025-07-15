import { supabase } from '../../../lib/supabase'
import jwt from 'jsonwebtoken'

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
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { store_id, year, month } = req.query

      let targetStoreId
      if (req.user.role === 'admin') {
        targetStoreId = store_id
      } else {
        targetStoreId = req.user.store_id
      }

      let query = supabase
        .from('sales_data')
        .select('date, sales_amount, customer_count')
        .order('date')

      if (targetStoreId) {
        query = query.eq('store_id', targetStoreId)
      }

      if (year && month) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
        const endDate = `${year}-${month.toString().padStart(2, '0')}-31`
        query = query.gte('date', startDate).lte('date', endDate)
      }

      const { data, error } = await query

      if (error) {
        return res.status(500).json({ error: 'データ取得エラー' })
      }

      // CSVヘッダー
      let csvContent = '日付,税込売上,客数\n'
      
      // データ行を追加
      data.forEach(row => {
        const date = new Date(row.date).toLocaleDateString('ja-JP')
        csvContent += `${date},${row.sales_amount},${row.customer_count}\n`
      })

      // CSVファイル名
      const filename = year && month 
        ? `sales_data_${year}${month.toString().padStart(2, '0')}.csv`
        : `sales_data_${new Date().toISOString().split('T')[0]}.csv`

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'))
      
      res.status(200).send('\uFEFF' + csvContent) // BOM付きでUTF-8エンコーディング

    } catch (error) {
      console.error('CSV download error:', error)
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  })
}