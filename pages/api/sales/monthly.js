import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { updates } = req.body

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates data' })
    }

    console.log(`Processing ${updates.length} updates...`)
    
    // 並列処理でパフォーマンス向上
    const promises = updates.map(async (update) => {
      const { date, sales_amount, customer_count, store_id, delete: shouldDelete } = update
      
      if (!date || !store_id) {
        return { success: false, error: 'Missing required fields' }
      }

      try {
        if (shouldDelete) {
          // 削除処理
          const { error } = await supabase
            .from('sales_data')
            .delete()
            .eq('date', date)
            .eq('store_id', store_id)
          
          return { success: !error, operation: 'delete', date, error }
        }

        // Upsert処理で存在チェック不要
        const { data, error } = await supabase
          .from('sales_data')
          .upsert({
            date,
            sales_amount: sales_amount || 0,
            customer_count: customer_count || 0,
            store_id,
            updated_at: new Date()
          }, {
            onConflict: 'date,store_id'
          })
          .select()

        return { 
          success: !error, 
          operation: 'upsert', 
          date, 
          data: data?.[0], 
          error 
        }
      } catch (error) {
        console.error(`Error processing update for ${date}:`, error)
        return { success: false, date, error: error.message }
      }
    })

    // 並列実行（最大10秒以内に完了させる）
    const results = await Promise.allSettled(promises)
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful
    
    console.log(`Batch update completed: ${successful} successful, ${failed} failed`)

    res.status(200).json({ 
      message: 'Monthly data updated successfully',
      successful,
      failed,
      total: updates.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
    })

  } catch (error) {
    console.error('Monthly update error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}