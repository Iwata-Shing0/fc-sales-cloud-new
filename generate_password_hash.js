// パスワードハッシュ生成スクリプト
import bcrypt from 'bcryptjs';

async function generatePasswordHash() {
    const password = 'admin';
    const saltRounds = 10;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('=== パスワードハッシュ生成 ===');
        console.log(`パスワード: ${password}`);
        console.log(`ハッシュ: ${hash}`);
        console.log('\n=== Supabaseで実行するSQL ===');
        console.log(`INSERT INTO users (username, password, role) VALUES ('admin', '${hash}', 'admin') ON CONFLICT (username) DO NOTHING;`);
    } catch (error) {
        console.error('エラー:', error);
    }
}

generatePasswordHash();