import { supabase } from '../../../lib/supabase'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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
    const { id } = req.query

    if (req.method === 'GET') {
      // 管理者のみアクセス可能
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'アクセス権限がありません' })
      }

      try {
        // 店舗情報を取得
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('*')
          .eq('id', id)
          .single()

        if (storeError || !store) {
          return res.status(404).json({ error: '店舗が見つかりません' })
        }

        // ユーザー情報を取得（編集用の場合は平文パスワードも含む）
        if (req.query.edit === 'true') {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('username, password')
            .eq('store_id', id)
            .single()

          if (userError) {
            return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' })
          }

          res.status(200).json({ store, user })
        } else {
          res.status(200).json({ store })
        }
      } catch (error) {
        console.error('店舗取得エラー:', error)
        res.status(500).json({ error: 'サーバーエラーが発生しました' })
      }

    } else if (req.method === 'PUT') {
      // 管理者のみ編集可能
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'アクセス権限がありません' })
      }

      try {
        const { name, store_code, username, password } = req.body

        if (!name || !store_code || !username || !password) {
          return res.status(400).json({ error: '全ての項目を入力してください' })
        }

        // 店舗情報を更新
        const { error: storeError } = await supabase
          .from('stores')
          .update({
            name,
            store_code
          })
          .eq('id', id)

        if (storeError) {
          console.error('店舗更新エラー:', storeError)
          return res.status(500).json({ error: '店舗情報の更新に失敗しました' })
        }

        // パスワードをハッシュ化
        const hashedPassword = await bcrypt.hash(password, 10)

        // ユーザー情報を更新
        const { error: userError } = await supabase
          .from('users')
          .update({
            username,
            password: hashedPassword
          })
          .eq('store_id', id)

        if (userError) {
          console.error('ユーザー更新エラー:', userError)
          return res.status(500).json({ error: 'ユーザー情報の更新に失敗しました' })
        }

        res.status(200).json({ message: '店舗情報を更新しました' })
      } catch (error) {
        console.error('店舗更新エラー:', error)
        res.status(500).json({ error: 'サーバーエラーが発生しました' })
      }

    } else if (req.method === 'DELETE') {
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

  } catch (error) {
    console.error('Stores API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}