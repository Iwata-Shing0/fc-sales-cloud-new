import jwt from 'jsonwebtoken'
import { Store, User } from '../../../lib/db'

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'アクセストークンが必要です' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'トークンが無効です' })
    }
    req.user = user
    next()
  })
}

export default async function handler(req, res) {
  authenticateToken(req, res, async () => {
    try {
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
        const user = await User.create(username, password, 'store', store.id)

        res.status(201).json({
          message: '店舗とユーザーが作成されました',
          store,
          user
        })
      } else {
        res.status(405).json({ message: 'Method not allowed' })
      }
    } catch (error) {
      console.error('API エラー:', error)
      if (error.message.includes('duplicate key') || error.code === '23505') {
        res.status(400).json({ message: '店舗コードまたはユーザー名が既に存在します' })
      } else {
        res.status(500).json({ message: 'サーバーエラーが発生しました' })
      }
    }
  })
}