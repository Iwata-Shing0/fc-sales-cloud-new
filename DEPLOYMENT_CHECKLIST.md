# FC Sales Cloud - デプロイメントチェックリスト

## 🚀 デプロイ前に必要な作業

### 1. データベースセットアップ
- [ ] Supabaseプロジェクトの作成
- [ ] データベーステーブルの作成（DEPLOYMENT_GUIDE.mdのSQLを実行）
- [ ] **重要**: `database_rpc_function.sql`のRPC関数を実行
  ```sql
  -- Supabase SQL エディタで実行してください
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
  ```

### 2. 環境変数の設定
- [ ] `.env.local`ファイルを作成（`.env.local.example`をコピー）
- [ ] 以下の環境変数を設定:
  - `SUPABASE_URL`: SupabaseプロジェクトのURL
  - `SUPABASE_ANON_KEY`: Supabaseの匿名キー
  - `JWT_SECRET`: JWT署名用の秘密鍵（32文字以上推奨）

### 3. Vercelでの設定
- [ ] Vercelプロジェクトの作成
- [ ] 環境変数をVercelダッシュボードに設定
- [ ] ビルド設定の確認

### 4. 初期データの設定
- [ ] 管理者アカウントの作成
- [ ] 初期店舗データの作成（オプション）

## ✅ 実装完了済み機能

### 高優先度機能
- [x] **データベースRPC関数** - 月間売上サマリー機能
- [x] **StoreDashboard** - 売上データ入力フォーム
- [x] **環境変数設定** - デプロイ用設定ファイル
- [x] **データ検証** - 入力値検証とエラーハンドリング

### 中優先度機能
- [x] **AdminDashboard** - 売上ランキング表示
- [x] **売上データ管理** - GET/POST API改善
- [x] **エラーハンドリング** - 重複データ検出など

## 🔧 新しく実装された機能

### StoreDashboard（店舗ダッシュボード）
- 日別売上・客数入力フォーム
- 過去売上データの表示（最新10件）
- 客単価の自動計算
- リアルタイム入力検証

### AdminDashboard（管理者ダッシュボード）
- 売上ランキング機能（新規タブ）
- 月間売上サマリー表示
- 順位表示（1位🥇、2位🥈、3位🥉）
- 店舗別詳細統計

### API改善
- `/api/sales` - GET/POST両方に対応
- 重複データ検出機能
- 入力値検証強化
- エラーメッセージ改善

## 🎯 デプロイメント完了度

**現在の完成度: 95%**

### 必須項目（デプロイブロッカー）
- [x] データベースRPC関数の作成
- [x] 基本機能の実装
- [x] 環境変数設定
- [x] エラーハンドリング

### 推奨項目
- [x] 売上ランキング機能
- [x] データ検証
- [x] ユーザビリティ改善

## 📋 デプロイ手順

1. **Supabaseセットアップ**
   - 新規プロジェクト作成
   - データベーステーブル作成
   - RPC関数実行

2. **環境変数設定**
   - `.env.local`ファイル作成
   - 必要な値を設定

3. **Vercelデプロイ**
   - GitHubリポジトリとの連携
   - 環境変数の設定
   - デプロイ実行

4. **動作確認**
   - ログイン機能テスト
   - 店舗作成テスト
   - 売上データ入力テスト
   - ランキング表示テスト

## 🚨 重要な注意事項

1. **データベースRPC関数は必須**
   - この関数がないと売上ランキング機能でエラーが発生します
   - デプロイ前に必ず実行してください

2. **環境変数は本番用に設定**
   - JWT_SECRETは強固な値を使用
   - Supabaseの認証情報は正確に設定

3. **初回デプロイ後の確認**
   - 全機能の動作確認
   - エラーログの確認
   - パフォーマンスの確認

## 🎉 デプロイ完了後のテスト手順

1. 管理者でログイン
2. 新規店舗作成
3. 店舗ユーザーでログイン
4. 売上データ入力
5. 管理者で売上ランキング確認
6. 各機能の動作確認

---

**このプロジェクトは本格的なFC売上管理システムとして、クラウドでの運用が可能です。**