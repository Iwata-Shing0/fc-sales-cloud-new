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

    // 管理者のみアクセス可能
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'アクセス権限がありません' })
    }

    if (req.method === 'GET') {
      const { year, month } = req.query

      if (!year || !month) {
        return res.status(400).json({ error: '年月の指定が必要です' })
      }

      // 指定月の全店舗の売上データを取得
      const nextMonth = parseInt(month) + 1
      const nextYear = nextMonth > 12 ? parseInt(year) + 1 : parseInt(year)
      const nextMonthFormatted = nextMonth > 12 ? 1 : nextMonth
      
      const { data: salesData, error } = await supabase
        .from('sales_data')
        .select('sales_amount, customer_count, store_id')
        .gte('date', `${year}-${month.toString().padStart(2, '0')}-01`)
        .lt('date', `${nextYear}-${nextMonthFormatted.toString().padStart(2, '0')}-01`)

      if (error) {
        return res.status(500).json({ error: '売上データの取得に失敗しました' })
      }

      // 店舗別の月次データを取得
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id, name')

      if (storeError) {
        return res.status(500).json({ error: '店舗データの取得に失敗しました' })
      }

      // 各店舗の月次集計を計算
      const storesSummary = await Promise.all(
        storeData.map(async (store) => {
          const storeSales = salesData.filter(item => item.store_id === store.id)
          const totalSales = storeSales.reduce((sum, item) => sum + item.sales_amount, 0)
          const totalCustomers = storeSales.reduce((sum, item) => sum + item.customer_count, 0)
          
          return {
            storeId: store.id,
            storeName: store.name,
            totalSales,
            totalCustomers
          }
        })
      )

      // 統計情報を計算
      const totalSales = salesData.reduce((sum, item) => sum + item.sales_amount, 0)
      const totalCustomers = salesData.reduce((sum, item) => sum + item.customer_count, 0)
      const avgCustomerPrice = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0
      
      // 各店の月の平均売上（売上が1円以上の店舗のみ）
      const storesWithSales = storesSummary.filter(store => store.totalSales > 0)
      const avgSales = storesWithSales.length > 0 ? Math.round(storesWithSales.reduce((sum, store) => sum + store.totalSales, 0) / storesWithSales.length) : 0
      
      // 各店の月の平均客数（客数が1人以上の店舗のみ）
      const storesWithCustomers = storesSummary.filter(store => store.totalCustomers > 0)
      const avgCustomers = storesWithCustomers.length > 0 ? Math.round(storesWithCustomers.reduce((sum, store) => sum + store.totalCustomers, 0) / storesWithCustomers.length) : 0

      // デバッグ情報
      console.log('統計API デバッグ情報:', {
        year, month,
        salesDataCount: salesData.length,
        storeDataCount: storeData.length,
        storesSummary,
        storesWithSales: storesWithSales.length,
        storesWithCustomers: storesWithCustomers.length,
        avgSales,
        avgCustomers
      })

      res.status(200).json({
        totalSales,
        totalCustomers,
        avgCustomerPrice,
        avgSales,
        avgCustomers,
        recordCount: salesData.length
      })

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Admin statistics API error:', error)
    if (error.message === 'アクセストークンが必要です') {
      res.status(401).json({ error: error.message })
    } else if (error.message === 'トークンが無効です') {
      res.status(403).json({ error: error.message })
    } else {
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  }
}