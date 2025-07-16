const jwt = require('jsonwebtoken')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Auth verify - start')
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth verify - no auth header')
      return res.status(401).json({ message: 'トークンが必要です' })
    }

    const token = authHeader.substring(7)
    console.log('Auth verify - decoding token')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('Auth verify - decoded:', decoded)

    // ユーザー情報を取得
    console.log('Auth verify - fetching user from DB')
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

    console.log('Auth verify - success, returning user:', user)
    res.status(200).json(user)
  } catch (error) {
    console.error('Auth verify - 認証エラー:', error)
    res.status(401).json({ message: '無効なトークンです' })
  }
}