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

    if (req.method === 'GET') {
      // 管理者のみアクセス可能
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'アクセス権限がありません' })
      }

      try {
        // 店舗データとユーザー情報を取得
        const { data: storesData, error: storesError } = await supabase
          .from('stores')
          .select(`
            id,
            name,
            store_code,
            users (
              username,
              password
            )
          `)
          .order('id')

        if (storesError) {
          console.error('店舗データ取得エラー:', storesError)
          return res.status(500).json({ error: '店舗データの取得に失敗しました' })
        }

        // CSVヘッダー
        const csvHeader = '店舗名,店舗コード,ユーザー名,パスワード\n'
        
        // CSVデータ行を作成
        const csvRows = storesData.map(store => {
          const user = store.users && store.users.length > 0 ? store.users[0] : { username: '', password: '' }
          // パスワードは暗号化されているため、プレースホルダーを表示
          const passwordDisplay = user.password ? '[暗号化済み - 編集ページで新しいパスワードを設定]' : ''
          return `"${store.name}","${store.store_code}","${user.username}","${passwordDisplay}"`
        }).join('\n')

        const csvContent = csvHeader + csvRows

        // BOMを追加してUTF-8で保存
        const bom = '\uFEFF'
        const csvWithBom = bom + csvContent

        // レスポンスヘッダーを設定
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="stores_data_${new Date().toISOString().slice(0, 10)}.csv"`)
        
        res.status(200).send(csvWithBom)

      } catch (error) {
        console.error('CSVダウンロードエラー:', error)
        res.status(500).json({ error: 'CSVダウンロード中にエラーが発生しました' })
      }

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('CSV download API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}