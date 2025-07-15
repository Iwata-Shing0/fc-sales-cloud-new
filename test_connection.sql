-- Supabase接続テスト
SELECT 'Supabase接続テスト成功' as test_result;

-- ユーザー数を確認
SELECT COUNT(*) as user_count FROM users;

-- adminユーザーの情報を確認
SELECT username, role FROM users WHERE username = 'admin';