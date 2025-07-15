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
    const { id } = req.query

    if (req.method === 'DELETE') {
      // 管理者のみが削除可能
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'アクセス権限がありません' })
      }

      try {
        // トランザクションを使用して関連データも削除
        const { error: salesError } = await supabase
          .from('sales_data')
          .delete()
          .eq('store_id', id)

        if (salesError) {
          console.error('売上データ削除エラー:', salesError)
        }

        const { error: targetsError } = await supabase
          .from('sales_targets')
          .delete()
          .eq('store_id', id)

        if (targetsError) {
          console.error('目標データ削除エラー:', targetsError)
        }

        const { error: usersError } = await supabase
          .from('users')
          .delete()
          .eq('store_id', id)

        if (usersError) {
          console.error('ユーザーデータ削除エラー:', usersError)
        }

        const { error: storeError } = await supabase
          .from('stores')
          .delete()
          .eq('id', id)

        if (storeError) {
          console.error('店舗削除エラー:', storeError)
          return res.status(500).json({ error: '店舗削除に失敗しました' })
        }

        res.status(200).json({ message: '店舗を削除しました' })
      } catch (error) {
        console.error('店舗削除エラー:', error)
        res.status(500).json({ error: 'サーバーエラーが発生しました' })
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  })
}