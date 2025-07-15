import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export class Store {
  static async create(name, storeCode) {
    const { data, error } = await supabase
      .from('stores')
      .insert([{ name, store_code: storeCode }])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async findAll() {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }
}

export class User {
  static async create(username, password, role, storeId = null) {
    const hashedPassword = await bcrypt.hash(password, 10)
    
    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        username, 
        password: hashedPassword, 
        role, 
        store_id: storeId 
      }])
      .select()
      .single()
    
    if (error) throw error
    return { ...data, password: undefined }
  }

  static async findByUsername(username) {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        stores (
          name
        )
      `)
      .eq('username', username)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  static async validatePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword)
  }
}

export class SalesData {
  static async create(storeId, date, salesAmount, customerCount) {
    const { data, error } = await supabase
      .from('sales_data')
      .upsert({
        store_id: storeId,
        date,
        sales_amount: salesAmount,
        customer_count: customerCount,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async findByStoreAndMonth(storeId, year, month) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`
    
    const { data, error } = await supabase
      .from('sales_data')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
    
    if (error) throw error
    return data
  }

  static async findByMonth(year, month) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`
    
    const { data, error } = await supabase
      .from('sales_data')
      .select(`
        *,
        stores (
          name
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
    
    if (error) throw error
    return data
  }

  static async getMonthlyTotalByStore(year, month) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`
    
    const { data, error } = await supabase.rpc('get_monthly_store_summary', {
      start_date: startDate,
      end_date: endDate
    })
    
    if (error) throw error
    return data
  }

  static async findByStoreId(storeId) {
    const { data, error } = await supabase
      .from('sales_data')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })
    
    if (error) throw error
    return data
  }

  static async getByMonthAndStore(storeId, startDate, endDate) {
    const { data, error } = await supabase
      .from('sales_data')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date')
    
    if (error) throw error
    return data
  }

  static async getAll() {
    const { data, error } = await supabase
      .from('sales_data')
      .select(`
        *,
        stores (
          name
        )
      `)
      .order('date', { ascending: false })
    
    if (error) throw error
    return data
  }
}

export class SalesTarget {
  static async ensureTableExists() {
    try {
      const { error } = await supabase.rpc('create_sales_targets_table_if_not_exists')
      if (error) console.log('Table creation result:', error.message)
    } catch (error) {
      console.log('Table may already exist:', error.message)
    }
  }

  static async create(storeId, year, month, targetAmount) {
    await this.ensureTableExists()
    
    const { data, error } = await supabase
      .from('sales_targets')
      .upsert({
        store_id: storeId,
        year: parseInt(year),
        month: parseInt(month),
        target_amount: parseInt(targetAmount),
        updated_at: new Date().toISOString()
      })
      .select()

    if (error) throw error
    return data[0]
  }

  static async findByStoreAndYear(storeId, year) {
    await this.ensureTableExists()
    
    const { data, error } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('store_id', storeId)
      .eq('year', year)
      .order('month')

    if (error) throw error
    return data
  }
}