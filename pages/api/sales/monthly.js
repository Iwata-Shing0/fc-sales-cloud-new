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

    const results = []
    
    for (const update of updates) {
      const { date, sales_amount, customer_count, store_id, delete: shouldDelete } = update
      
      if (!date || !store_id) {
        continue
      }

      if (shouldDelete) {
        // 削除処理
        const { error } = await supabase
          .from('sales_data')
          .delete()
          .eq('date', date)
          .eq('store_id', store_id)
        
        if (error) {
          console.error('Delete error:', error)
        }
        continue
      }

      const { data: existingData, error: selectError } = await supabase
        .from('sales_data')
        .select('*')
        .eq('date', date)
        .eq('store_id', store_id)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Select error:', selectError)
        continue
      }

      if (existingData) {
        const { data, error } = await supabase
          .from('sales_data')
          .update({
            sales_amount: sales_amount || 0,
            customer_count: customer_count || 0,
            updated_at: new Date()
          })
          .eq('date', date)
          .eq('store_id', store_id)
          .select()

        if (error) {
          console.error('Update error:', error)
        } else {
          results.push(data[0])
        }
      } else {
        if (sales_amount > 0 || customer_count > 0) {
          const { data, error } = await supabase
            .from('sales_data')
            .insert([{
              date,
              sales_amount: sales_amount || 0,
              customer_count: customer_count || 0,
              store_id
            }])
            .select()

          if (error) {
            console.error('Insert error:', error)
          } else {
            results.push(data[0])
          }
        }
      }
    }

    res.status(200).json({ 
      message: 'Monthly data updated successfully',
      results 
    })

  } catch (error) {
    console.error('Monthly update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}