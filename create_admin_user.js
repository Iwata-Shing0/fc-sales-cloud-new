// 管理者ユーザーを作成するスクリプト
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { User } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

async function createAdminUser() {
    console.log('=== 管理者ユーザー作成スクリプト ===\n');
    
    try {
        // 既存のadminユーザーを確認
        console.log('1. 既存adminユーザー確認...');
        const existingUser = await User.findByUsername('admin');
        
        if (existingUser) {
            console.log('❌ adminユーザーは既に存在します');
            console.log(`   username: ${existingUser.username}`);
            console.log(`   role: ${existingUser.role}`);
            return;
        }
        
        console.log('✅ adminユーザーは存在しません。新規作成します。\n');
        
        // 新しい管理者ユーザーを作成
        console.log('2. 管理者ユーザー作成中...');
        const newUser = await User.create('admin', 'admin', 'admin', null);
        
        console.log('✅ 管理者ユーザーが正常に作成されました');
        console.log(`   ID: ${newUser.id}`);
        console.log(`   username: ${newUser.username}`);
        console.log(`   role: ${newUser.role}`);
        console.log('\n=== 作成完了 ===');
        console.log('ログイン情報:');
        console.log('- ユーザー名: admin');
        console.log('- パスワード: admin');
        
    } catch (error) {
        console.error('❌ エラーが発生しました:', error);
    }
}

// スクリプト実行
createAdminUser();