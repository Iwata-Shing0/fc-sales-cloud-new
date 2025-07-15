// 環境変数を読み込み
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

// 環境変数の確認
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み' : '未設定');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '設定済み' : '未設定');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testSupabaseConnection() {
    console.log('=== Supabase接続テスト開始 ===\n');
    
    try {
        // 1. 接続テスト
        console.log('1. 接続テスト:');
        const { data: testResult, error: testError } = await supabase
            .from('users')
            .select('*')
            .limit(1);
        
        if (testError) {
            console.error('接続エラー:', testError);
            return;
        }
        console.log('✅ Supabase接続テスト成功\n');
        
        // 2. ユーザー数を確認
        console.log('2. ユーザー数確認:');
        const { count, error: countError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        if (countError) {
            console.error('ユーザー数取得エラー:', countError);
        } else {
            console.log(`✅ user_count: ${count}\n`);
        }
        
        // 3. adminユーザーの情報を確認
        console.log('3. adminユーザー確認:');
        const { data: adminData, error: adminError } = await supabase
            .from('users')
            .select('username, role')
            .eq('username', 'admin');
        
        if (adminError) {
            console.error('adminユーザー取得エラー:', adminError);
        } else if (adminData && adminData.length > 0) {
            console.log('✅ adminユーザー情報:');
            console.log(`   username: ${adminData[0].username}`);
            console.log(`   role: ${adminData[0].role}\n`);
        } else {
            console.log('❌ adminユーザーが見つかりません\n');
        }
        
        console.log('=== テスト完了 ===');
        
    } catch (error) {
        console.error('予期しないエラー:', error);
    }
}

// テスト実行
testSupabaseConnection();