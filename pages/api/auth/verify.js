import jwt from 'jsonwebtoken'
import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // 環境変数の確認
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET が設定されていません')
      return res.status(500).json({ message: 'サーバー設定エラー: JWT_SECRET が設定されていません' })
    }

    const authHeader = req.headers.authorization
    console.log('Auth verify - authHeader:', authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth verify - no valid auth header')
      return res.status(401).json({ message: 'トークンが必要です' })
    }

    const token = authHeader.substring(7)
    console.log('Auth verify - token length:', token.length)
    
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('Auth verify - decoded token:', decoded)
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message)
      return res.status(401).json({ message: 'トークンが無効です: ' + jwtError.message })
    }

    // Supabaseクライアントの確認
    if (!supabase) {
      console.error('Supabase クライアントが初期化されていません')
      return res.status(500).json({ message: 'サーバー設定エラー: データベース接続に失敗しました' })
    }

    // ユーザー情報を取得
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, store_id')
      .eq('id', decoded.id)
      .single()

    console.log('Auth verify - DB result:', { user, error })

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ message: 'データベースエラー: ' + error.message })
    }

    if (!user) {
      console.log('Auth verify - user not found')
      return res.status(401).json({ message: 'ユーザーが見つかりません' })
    }

    console.log('Auth verify - success')
    res.status(200).json(user)
  } catch (error) {
    console.error('Auth verify - 予期しないエラー:', error)
    res.status(500).json({ message: '予期しないエラーが発生しました: ' + error.message })
  }
}