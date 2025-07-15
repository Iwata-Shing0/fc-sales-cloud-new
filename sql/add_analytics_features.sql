-- 目標売上テーブルを作成
CREATE TABLE IF NOT EXISTS sales_targets (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  target_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, year, month)
);

-- 月別売上サマリー取得関数を作成
CREATE OR REPLACE FUNCTION get_monthly_sales_summary(target_store_id INTEGER, target_year INTEGER)
RETURNS TABLE (
  month INTEGER,
  total_sales BIGINT,
  total_customers BIGINT,
  avg_customer_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(MONTH FROM date)::INTEGER as month,
    COALESCE(SUM(sales_amount), 0)::BIGINT as total_sales,
    COALESCE(SUM(customer_count), 0)::BIGINT as total_customers,
    CASE 
      WHEN SUM(customer_count) > 0 THEN ROUND(SUM(sales_amount)::NUMERIC / SUM(customer_count), 0)
      ELSE 0
    END as avg_customer_price
  FROM sales_data 
  WHERE store_id = target_store_id 
    AND EXTRACT(YEAR FROM date) = target_year
  GROUP BY EXTRACT(MONTH FROM date)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql;

-- インデックスを追加（パフォーマンス向上のため）
CREATE INDEX IF NOT EXISTS idx_sales_data_store_year_month ON sales_data (store_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date));
CREATE INDEX IF NOT EXISTS idx_sales_targets_store_year ON sales_targets (store_id, year);

-- 売上データの統計情報を取得するビューを作成
CREATE OR REPLACE VIEW sales_statistics AS
SELECT 
  s.id as store_id,
  s.name as store_name,
  EXTRACT(YEAR FROM sd.date) as year,
  EXTRACT(MONTH FROM sd.date) as month,
  COUNT(*) as days_with_data,
  SUM(sd.sales_amount) as total_sales,
  SUM(sd.customer_count) as total_customers,
  AVG(sd.sales_amount) as avg_daily_sales,
  AVG(sd.customer_count) as avg_daily_customers,
  CASE 
    WHEN SUM(sd.customer_count) > 0 
    THEN ROUND(SUM(sd.sales_amount)::NUMERIC / SUM(sd.customer_count), 0)
    ELSE 0 
  END as avg_customer_price,
  MIN(sd.date) as first_sale_date,
  MAX(sd.date) as last_sale_date
FROM stores s
LEFT JOIN sales_data sd ON s.id = sd.store_id
GROUP BY s.id, s.name, EXTRACT(YEAR FROM sd.date), EXTRACT(MONTH FROM sd.date)
ORDER BY s.name, year DESC, month DESC;