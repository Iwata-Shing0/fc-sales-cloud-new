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

    if (req.method === 'POST') {
      // 管理者のみアクセス可能
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'アクセス権限がありません' })
      }

      const { csvData } = req.body

      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ error: 'CSVデータが必要です' })
      }

      let successCount = 0
      let errorCount = 0
      const errorDetails = []

      for (const row of csvData) {
        try {
          const [storeName, storeCode, username, password] = row

          if (!storeName || !storeCode || !username || !password) {
            errorCount++
            errorDetails.push(`行データが不完全です: ${row.join(',')}`)
            continue
          }

          // 店舗コードで既存の店舗を検索
          const { data: existingStores, error: searchError } = await supabase
            .from('stores')
            .select('id')
            .eq('store_code', storeCode)

          if (searchError) {
            errorCount++
            errorDetails.push(`店舗検索エラー (${storeCode}): ${searchError.message}`)
            continue
          }

          if (existingStores.length === 0) {
            // 新規店舗作成
            const { data: newStore, error: storeError } = await supabase
              .from('stores')
              .insert({
                name: storeName,
                store_code: storeCode
              })
              .select()
              .single()

            if (storeError) {
              errorCount++
              errorDetails.push(`新規店舗作成エラー (${storeCode}): ${storeError.message}`)
              continue
            }

            // 新規ユーザー作成
            const hashedPassword = await bcrypt.hash(password, 10)
            const { error: userError } = await supabase
              .from('users')
              .insert({
                username,
                password: hashedPassword,
                store_id: newStore.id,
                role: 'store'
              })

            if (userError) {
              errorCount++
              errorDetails.push(`新規ユーザー作成エラー (${username}): ${userError.message}`)
              continue
            }

            successCount++
          } else {
            // 既存店舗の更新
            const storeId = existingStores[0].id

            // 店舗情報を更新
            const { error: storeUpdateError } = await supabase
              .from('stores')
              .update({
                name: storeName
              })
              .eq('id', storeId)

            if (storeUpdateError) {
              errorCount++
              errorDetails.push(`店舗更新エラー (${storeCode}): ${storeUpdateError.message}`)
              continue
            }

            // ユーザー情報を更新
            const hashedPassword = await bcrypt.hash(password, 10)
            const { error: userUpdateError } = await supabase
              .from('users')
              .update({
                username,
                password: hashedPassword
              })
              .eq('store_id', storeId)

            if (userUpdateError) {
              errorCount++
              errorDetails.push(`ユーザー更新エラー (${username}): ${userUpdateError.message}`)
              continue
            }

            successCount++
          }
        } catch (error) {
          errorCount++
          errorDetails.push(`処理エラー: ${error.message}`)
        }
      }

      res.status(200).json({
        message: 'CSV一括更新が完了しました',
        success: successCount,
        errors: errorCount,
        errorDetails: errorDetails.slice(0, 10) // 最大10件のエラー詳細を返す
      })

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('CSV update API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}