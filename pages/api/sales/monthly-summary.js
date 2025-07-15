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
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { year, store_id } = req.query

      let targetStoreId
      if (req.user.role === 'admin') {
        targetStoreId = store_id
      } else {
        targetStoreId = req.user.store_id
      }

      if (!targetStoreId) {
        return res.status(400).json({ error: '店舗IDが必要です' })
      }

      const targetYear = year || new Date().getFullYear()

      // 月別売上サマリーを取得（関数が存在しない場合は直接クエリ）
      let salesData
      const { data: funcData, error: salesError } = await supabase
        .rpc('get_monthly_sales_summary', {
          target_store_id: parseInt(targetStoreId),
          target_year: parseInt(targetYear)
        })

      if (salesError) {
        console.log('Function not found, using direct query:', salesError.message)
        // 関数が存在しない場合は直接クエリ
        const { data: directData, error: directError } = await supabase
          .from('sales_data')
          .select('date, sales_amount, customer_count')
          .eq('store_id', targetStoreId)
          .gte('date', `${targetYear}-01-01`)
          .lte('date', `${targetYear}-12-31`)

        if (directError) {
          console.error('Direct query error:', directError)
          return res.status(500).json({ error: 'データ取得エラー' })
        }

        // 月別にグループ化
        const monthlyMap = {}
        directData.forEach(item => {
          const month = new Date(item.date).getMonth() + 1
          if (!monthlyMap[month]) {
            monthlyMap[month] = { month, total_sales: 0, total_customers: 0 }
          }
          monthlyMap[month].total_sales += item.sales_amount
          monthlyMap[month].total_customers += item.customer_count
        })
        salesData = Object.values(monthlyMap)
      } else {
        salesData = funcData
      }

      // 目標売上データを取得（テーブルが存在しない場合は空配列）
      let targetData = []
      const { data: targetResult, error: targetError } = await supabase
        .from('sales_targets')
        .select('*')
        .eq('store_id', targetStoreId)
        .eq('year', targetYear)

      if (targetError) {
        console.log('Target table may not exist:', targetError.message)
        // テーブルが存在しない場合は空配列を使用
        targetData = []
      } else {
        targetData = targetResult
      }

      // 前年同期データを取得
      const previousYear = parseInt(targetYear) - 1
      let previousYearData = []
      const { data: prevFuncData, error: previousError } = await supabase
        .rpc('get_monthly_sales_summary', {
          target_store_id: parseInt(targetStoreId),
          target_year: previousYear
        })

      if (previousError) {
        console.log('Previous year function not found, using direct query:', previousError.message)
        // 関数が存在しない場合は直接クエリ
        const { data: prevDirectData, error: prevDirectError } = await supabase
          .from('sales_data')
          .select('date, sales_amount, customer_count')
          .eq('store_id', targetStoreId)
          .gte('date', `${previousYear}-01-01`)
          .lte('date', `${previousYear}-12-31`)

        if (!prevDirectError) {
          // 月別にグループ化
          const prevMonthlyMap = {}
          prevDirectData.forEach(item => {
            const month = new Date(item.date).getMonth() + 1
            if (!prevMonthlyMap[month]) {
              prevMonthlyMap[month] = { month, total_sales: 0, total_customers: 0 }
            }
            prevMonthlyMap[month].total_sales += item.sales_amount
            prevMonthlyMap[month].total_customers += item.customer_count
          })
          previousYearData = Object.values(prevMonthlyMap)
        }
      } else {
        previousYearData = prevFuncData
      }

      // データを月別に整理
      const monthlyData = []
      const targetMap = {}
      const previousYearMap = {}

      // 目標データをマップ化
      if (targetData) {
        targetData.forEach(target => {
          targetMap[target.month] = target.target_amount
        })
      }

      // 前年データをマップ化
      if (previousYearData) {
        previousYearData.forEach(data => {
          previousYearMap[data.month] = {
            sales: data.total_sales,
            customers: data.total_customers
          }
        })
      }

      // 1-12月のデータを作成
      for (let month = 1; month <= 12; month++) {
        const currentMonthData = salesData?.find(data => data.month === month)
        const targetAmount = targetMap[month] || 0
        const previousYearAmount = previousYearMap[month]?.sales || 0
        const currentSales = currentMonthData?.total_sales || 0
        const currentCustomers = currentMonthData?.total_customers || 0

        monthlyData.push({
          month,
          sales: currentSales,
          customers: currentCustomers,
          target: targetAmount,
          achievementRate: targetAmount > 0 ? Math.round((currentSales / targetAmount) * 100) : 0,
          previousYearSales: previousYearAmount,
          growthRate: previousYearAmount > 0 ? Math.round(((currentSales - previousYearAmount) / previousYearAmount) * 100) : 0,
          avgCustomerPrice: currentCustomers > 0 ? Math.round(currentSales / currentCustomers) : 0
        })
      }

      // 年間サマリーを計算
      const yearSummary = {
        totalSales: monthlyData.reduce((sum, data) => sum + data.sales, 0),
        totalCustomers: monthlyData.reduce((sum, data) => sum + data.customers, 0),
        totalTarget: monthlyData.reduce((sum, data) => sum + data.target, 0),
        previousYearTotal: monthlyData.reduce((sum, data) => sum + data.previousYearSales, 0)
      }

      yearSummary.avgCustomerPrice = yearSummary.totalCustomers > 0 ? 
        Math.round(yearSummary.totalSales / yearSummary.totalCustomers) : 0
      yearSummary.achievementRate = yearSummary.totalTarget > 0 ? 
        Math.round((yearSummary.totalSales / yearSummary.totalTarget) * 100) : 0
      yearSummary.growthRate = yearSummary.previousYearTotal > 0 ? 
        Math.round(((yearSummary.totalSales - yearSummary.previousYearTotal) / yearSummary.previousYearTotal) * 100) : 0

      res.status(200).json({
        year: targetYear,
        monthlyData,
        yearSummary
      })

    } catch (error) {
      console.error('Monthly summary API error:', error)
      res.status(500).json({ error: 'サーバーエラーが発生しました' })
    }
  })
}