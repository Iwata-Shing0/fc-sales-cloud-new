-- FC Sales Cloud - Missing RPC Function
-- This function needs to be executed in your Supabase SQL editor

CREATE OR REPLACE FUNCTION get_monthly_store_summary(start_date DATE, end_date DATE)
RETURNS TABLE (
    store_id INTEGER,
    store_name VARCHAR(255),
    total_sales BIGINT,
    total_customers BIGINT,
    avg_daily_sales NUMERIC,
    days_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        COALESCE(SUM(sd.sales_amount), 0) as total_sales,
        COALESCE(SUM(sd.customer_count), 0) as total_customers,
        COALESCE(AVG(sd.sales_amount), 0) as avg_daily_sales,
        COUNT(sd.id)::INTEGER as days_count
    FROM stores s
    LEFT JOIN sales_data sd ON s.id = sd.store_id AND sd.date BETWEEN start_date AND end_date
    GROUP BY s.id, s.name
    ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql;