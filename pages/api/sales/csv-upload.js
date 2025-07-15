import { supabase } from '../../../lib/supabase'
import jwt from 'jsonwebtoken'

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
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { csvData, store_id } = req.body

      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ error: 'CSVデータが無効です' })
      }

      let targetStoreId
      if (req.user.role === 'admin') {
        if (!store_id) {
          return res.status(400).json({ error: '店舗IDが必要です' })
        }
        targetStoreId = store_id
      } else {
        targetStoreId = req.user.store_id
      }

      const results = []
      const errors = []

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i]
        
        if (row.length < 3) {
          errors.push(`行${i + 1}: データが不足しています`)
          continue
        }

        const [dateStr, salesAmountStr, customerCountStr] = row
        
        if (!dateStr || !salesAmountStr || !customerCountStr) {
          errors.push(`行${i + 1}: 必須項目が空です (${dateStr}, ${salesAmountStr}, ${customerCountStr})`)
          continue
        }

        // 日付の解析を柔軟に行う
        let date
        const cleanDateStr = dateStr.trim()
        
        // 複数の日付形式に対応
        if (cleanDateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
          // YYYY/MM/DD 形式
          date = new Date(cleanDateStr)
        } else if (cleanDateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          // YYYY-MM-DD 形式
          date = new Date(cleanDateStr)
        } else if (cleanDateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          // MM/DD/YYYY 形式
          const parts = cleanDateStr.split('/')
          date = new Date(parts[2], parts[0] - 1, parts[1])
        } else if (cleanDateStr.match(/^\d{4}\.\d{1,2}\.\d{1,2}$/)) {
          // YYYY.MM.DD 形式
          date = new Date(cleanDateStr.replace(/\./g, '/'))
        } else if (cleanDateStr.match(/^\d{4}年\d{1,2}月\d{1,2}日$/)) {
          // YYYY年MM月DD日 形式
          const match = cleanDateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
          date = new Date(match[1], match[2] - 1, match[3])
        } else {
          date = new Date(cleanDateStr)
        }
        
        if (isNaN(date.getTime())) {
          errors.push(`行${i + 1}: 日付形式が無効です (${cleanDateStr})`)
          continue
        }

        // 売上金額の処理（カンマや円マークを除去）
        const cleanSalesStr = salesAmountStr.toString().replace(/[,円¥￥]/g, '').trim()
        const salesAmount = parseFloat(cleanSalesStr)
        
        // 客数の処理（小数点以下切り捨て、人という文字を除去）
        const cleanCustomerStr = customerCountStr.toString().replace(/[人,]/g, '').trim()
        const customerCount = Math.floor(parseFloat(cleanCustomerStr))

        if (isNaN(salesAmount)) {
          errors.push(`行${i + 1}: 売上金額が無効です (${salesAmountStr})`)
          continue
        }
        
        if (isNaN(customerCount)) {
          errors.push(`行${i + 1}: 客数が無効です (${customerCountStr})`)
          continue
        }

        if (salesAmount < 0 || customerCount < 0) {
          errors.push(`行${i + 1}: 売上金額と客数は0以上である必要があります`)
          continue
        }

        try {
          const { data, error } = await supabase
            .from('sales_data')
            .upsert({
              store_id: targetStoreId,
              date: date.toISOString().split('T')[0],
              sales_amount: salesAmount,
              customer_count: customerCount,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'store_id,date',
              ignoreDuplicates: false
            })
            .select()

          if (error) {
            errors.push(`行${i + 1}: データベースエラー - ${error.message}`)
          } else {
            results.push(data[0])
          }
        } catch (dbError) {
          errors.push(`行${i + 1}: データベースエラー - ${dbError.message}`)
        }
      }

      res.status(200).json({
        message: `${results.length}件のデータを処理しました`,
        success: results.length,
        errors: errors.length,
        errorDetails: errors
      })

    } catch (error) {
      console.error('CSV upload error:', error)
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  })
}