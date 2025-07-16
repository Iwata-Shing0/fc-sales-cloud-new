import jwt from 'jsonwebtoken'
import { User } from '../../../lib/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body
    console.log('ログイン試行:', { username, passwordLength: password?.length })

    if (!username || !password) {
      return res.status(400).json({ message: 'ユーザー名とパスワードが必要です' })
    }

    console.log('ユーザー検索中:', username)
    const user = await User.findByUsername(username)
    console.log('ユーザー検索結果:', user ? 'found' : 'not found')
    
    if (!user) {
      console.log('ユーザーが見つかりません:', username)
      return res.status(401).json({ message: 'ユーザー名またはパスワードが間違っています' })
    }

    console.log('パスワード検証中...')
    const isValid = await User.validatePassword(password, user.password)
    console.log('パスワード検証結果:', isValid)
    
    if (!isValid) {
      console.log('パスワードが一致しません')
      return res.status(401).json({ message: 'ユーザー名またはパスワードが間違っています' })
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        store_id: user.store_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )

    res.json({
      message: 'ログイン成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        store_id: user.store_id,
        store_name: user.stores?.name
      }
    })
  } catch (error) {
    console.error('ログインエラー:', error)
    res.status(500).json({ message: 'サーバーエラーが発生しました' })
  }
}