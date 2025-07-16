import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    console.log('Auth verify - authHeader:', authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth verify - no valid auth header')
      return res.status(401).json({ message: 'トークンが必要です' })
    }

    const token = authHeader.substring(7)
    console.log('Auth verify - token length:', token.length)
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('Auth verify - decoded token:', decoded)

    // ユーザー情報を取得
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, store_id')
      .eq('id', decoded.id)
      .single()

    console.log('Auth verify - DB result:', { user, error })

    if (error || !user) {
      console.log('Auth verify - user not found')
      return res.status(401).json({ message: 'ユーザーが見つかりません' })
    }

    console.log('Auth verify - success')
    res.status(200).json(user)
  } catch (error) {
    console.error('Auth verify - エラー:', error.message)
    res.status(401).json({ message: '無効なトークンです' })
  }
}