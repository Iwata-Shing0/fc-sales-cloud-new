import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'トークンが必要です' })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // ユーザー情報を取得
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, store_id')
      .eq('id', decoded.id)
      .single()

    if (error || !user) {
      return res.status(401).json({ message: 'ユーザーが見つかりません' })
    }

    res.status(200).json(user)
  } catch (error) {
    console.error('認証エラー:', error)
    res.status(401).json({ message: '無効なトークンです' })
  }
}