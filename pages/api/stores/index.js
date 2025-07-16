import jwt from 'jsonwebtoken'
import { Store, User } from '../../../lib/db'

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

    if (req.method === 'GET') {
      const stores = await Store.findAll()
      res.json(stores)
    } else if (req.method === 'POST') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '管理者権限が必要です' })
      }

      const { name, storeCode, username, password } = req.body

      if (!name || !storeCode || !username || !password) {
        return res.status(400).json({ message: '全ての項目を入力してください' })
      }

      const store = await Store.create(name, storeCode)
      const storeUser = await User.create(username, password, 'store', store.id)

      res.status(201).json({
        message: '店舗とユーザーが作成されました',
        store,
        user: storeUser
      })
    } else {
      res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('API エラー:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ message: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ message: error.message })
    } else if (error.message.includes('duplicate key') || error.code === '23505') {
      res.status(400).json({ message: '店舗コードまたはユーザー名が既に存在します' })
    } else {
      res.status(500).json({ message: 'サーバーエラーが発生しました' })
    }
  }
}