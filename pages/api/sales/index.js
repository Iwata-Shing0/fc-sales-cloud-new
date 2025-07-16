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

      // 既存データを確認
      const { data: existingData, error: selectError } = await supabase
        .from('sales_data')
        .select('*')
        .eq('store_id', storeId)
        .eq('date', date)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('データ確認エラー:', selectError)
        return res.status(500).json({ error: 'データ確認に失敗しました' })
      }

      let result
      if (existingData) {
        // 既存データを更新
        result = await supabase
          .from('sales_data')
          .update({
            sales_amount: parseInt(sales_amount),
            customer_count: parseInt(customer_count)
          })
          .eq('store_id', storeId)
          .eq('date', date)
          .select()
      } else {
        // 新規データを作成
        result = await supabase
          .from('sales_data')
          .insert({
            store_id: storeId,
            date,
            sales_amount: parseInt(sales_amount),
            customer_count: parseInt(customer_count)
          })
          .select()
      }

      const { data, error } = result

      if (error) {
        console.error('売上データ保存エラー:', error)
        return res.status(500).json({ error: '売上データの保存に失敗しました' })
      }

      res.status(201).json({ message: '売上データが保存されました', data: data[0] })

    } else if (req.method === 'GET') {
      const { year, month, store_id } = req.query
      
      if (year && month) {
        let storeId
        if (req.user.role === 'admin') {
          storeId = store_id
        } else {
          storeId = req.user.store_id
        }

        if (!storeId) {
          return res.status(400).json({ error: '店舗IDが必要です' })
        }
        
        const { data, error } = await supabase
          .from('sales_data')
          .select('*')
          .eq('store_id', storeId)
          .gte('date', `${year}-${month.toString().padStart(2, '0')}-01`)
          .lt('date', `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`)
          .order('date')

        if (error) {
          console.error('売上データ取得エラー:', error)
          return res.status(500).json({ error: '売上データの取得に失敗しました' })
        }

        res.status(200).json(data)
      } else {
        const { data, error } = await supabase
          .from('sales_data')
          .select('*')
          .order('date')

        if (error) {
          console.error('売上データ取得エラー:', error)
          return res.status(500).json({ error: '売上データの取得に失敗しました' })
        }

        res.status(200).json(data)
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('売上データ処理エラー:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}