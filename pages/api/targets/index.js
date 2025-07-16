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

      // sales_targetsテーブルは事前に作成済みと想定

      console.log('Target upsert data:', {
        store_id: targetStoreId,
        year: parseInt(year),
        month: parseInt(month),
        target_amount: parseInt(target_amount)
      })

      // 既存データを確認
      const { data: existingData } = await supabase
        .from('sales_targets')
        .select('id')
        .eq('store_id', targetStoreId)
        .eq('year', parseInt(year))
        .eq('month', parseInt(month))
        .single()

      let result
      if (existingData) {
        // 更新
        result = await supabase
          .from('sales_targets')
          .update({
            target_amount: parseInt(target_amount),
            updated_at: new Date().toISOString()
          })
          .eq('store_id', targetStoreId)
          .eq('year', parseInt(year))
          .eq('month', parseInt(month))
          .select()
      } else {
        // 新規作成
        result = await supabase
          .from('sales_targets')
          .insert({
            store_id: targetStoreId,
            year: parseInt(year),
            month: parseInt(month),
            target_amount: parseInt(target_amount)
          })
          .select()
      }

      const { data, error } = result

      console.log('Target upsert result:', { data, error })

      if (error) {
        console.error('Target upsert error:', error)
        return res.status(500).json({ error: 'データ保存エラー', details: error })
      }

      res.status(200).json({ 
        message: '目標売上を設定しました',
        data: data[0]
      })

    } else if (req.method === 'GET') {
      const { year, month, store_id } = req.query

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

      let query = supabase
        .from('sales_targets')
        .select('*')
        .eq('store_id', targetStoreId)
        .eq('year', targetYear)

      if (month) {
        query = query.eq('month', parseInt(month))
      }

      query = query.order('month')

      const { data, error } = await query

      if (error) {
        console.error('Target fetch error:', error)
        return res.status(500).json({ error: 'データ取得エラー' })
      }

      // 月が指定されている場合は単一の結果を返す
      if (month) {
        const result = data.length > 0 ? data[0] : { target_amount: 0 }
        res.status(200).json(result)
      } else {
        res.status(200).json(data)
      }

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Targets API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}