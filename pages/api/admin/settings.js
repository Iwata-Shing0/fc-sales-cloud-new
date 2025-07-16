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

    // 管理者のみアクセス可能
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'アクセス権限がありません' })
    }

    if (req.method === 'GET') {
      // 管理者情報を取得
      const { data: adminUser, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('id', req.user.id)
        .single()

      if (error) {
        return res.status(500).json({ error: '管理者情報の取得に失敗しました' })
      }

      res.status(200).json(adminUser)

    } else if (req.method === 'PUT') {
      const { username, password } = req.body

      if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' })
      }

      // パスワードをハッシュ化
      const hashedPassword = await bcrypt.hash(password, 10)

      // 管理者情報を更新
      const { error } = await supabase
        .from('users')
        .update({
          username,
          password: hashedPassword
        })
        .eq('id', req.user.id)

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'このユーザー名は既に使用されています' })
        }
        return res.status(500).json({ error: '管理者情報の更新に失敗しました' })
      }

      res.status(200).json({ message: '管理者情報を更新しました' })

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Admin settings API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}