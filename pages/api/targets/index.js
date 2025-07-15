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
    try {
      if (req.method === 'POST') {
        const { year, month, target_amount, store_id } = req.body

        let targetStoreId
        if (req.user.role === 'admin') {
          if (!store_id) {
            return res.status(400).json({ error: '店舗IDが必要です' })
          }
          targetStoreId = store_id
        } else {
          targetStoreId = req.user.store_id
        }

        if (!year || !month || target_amount === undefined) {
          return res.status(400).json({ error: '年、月、目標金額は必須です' })
        }

        if (target_amount < 0) {
          return res.status(400).json({ error: '目標金額は0以上である必要があります' })
        }

        const { data, error } = await supabase
          .from('sales_targets')
          .upsert({
            store_id: targetStoreId,
            year: parseInt(year),
            month: parseInt(month),
            target_amount: parseInt(target_amount),
            updated_at: new Date().toISOString()
          })
          .select()

        if (error) {
          console.error('Target upsert error:', error)
          return res.status(500).json({ error: 'データ保存エラー' })
        }

        res.status(200).json({ 
          message: '目標売上を設定しました',
          data: data[0]
        })

      } else if (req.method === 'GET') {
        const { year, store_id } = req.query

        let targetStoreId
        if (req.user.role === 'admin') {
          targetStoreId = store_id
        } else {
          targetStoreId = req.user.store_id
        }

        if (!targetStoreId) {
          return res.status(400).json({ error: '店舗IDが必要です' })
        }

        const targetYear = year || new Date().getFullYear()

        const { data, error } = await supabase
          .from('sales_targets')
          .select('*')
          .eq('store_id', targetStoreId)
          .eq('year', targetYear)
          .order('month')

        if (error) {
          console.error('Target fetch error:', error)
          return res.status(500).json({ error: 'データ取得エラー' })
        }

        res.status(200).json(data)

      } else {
        res.status(405).json({ error: 'Method not allowed' })
      }

    } catch (error) {
      console.error('Targets API error:', error)
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  })
}