# 🚀 FC売上管理システム デプロイガイド

## 📁 このプロジェクトについて

**クラウド版FC売上管理システム** - 完全動作版

- **技術スタック**: Next.js + Vercel + Supabase
- **状態**: デプロイ準備完了 ✅
- **初期ログイン**: admin / admin

---

## 🎯 デプロイ手順（5分で完了）

### 1️⃣ Supabase（データベース）設定

1. **アカウント作成**
   ```
   https://supabase.com
   ↓
   「Start your project」
   ↓ 
   GitHubでサインアップ
   ```

2. **プロジェクト作成**
   ```
   「New project」→ プロジェクト名入力 → 「Create new project」
   ```

3. **データベース初期化**
   ```
   左メニュー「SQL Editor」→ 新規クエリ → 以下をコピペして実行
   ```

   ```sql
   -- 店舗テーブル
   CREATE TABLE stores (
       id SERIAL PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       store_code VARCHAR(50) UNIQUE NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- ユーザーテーブル
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       username VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       role VARCHAR(20) NOT NULL CHECK(role IN ('admin', 'store')),
       store_id INTEGER REFERENCES stores(id),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- 売上データテーブル
   CREATE TABLE sales_data (
       id SERIAL PRIMARY KEY,
       store_id INTEGER NOT NULL REFERENCES stores(id),
       date DATE NOT NULL,
       sales_amount INTEGER NOT NULL,
       customer_count INTEGER NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(store_id, date)
   );

   -- 管理者ユーザー作成
   INSERT INTO users (username, password, role) 
   VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
   ```

4. **API情報をコピー**
   ```
   「Settings」→「API」
   ↓
   「Project URL」と「anon public」をメモ
   ```

### 2️⃣ GitHub（コード管理）設定

1. **リポジトリ作成**
   ```
   https://github.com
   ↓
   「New repository」
   ↓
   名前: fc-sales-cloud → 「Create repository」
   ```

2. **コードアップロード**
   ```bash
   # このフォルダで実行
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/fc-sales-cloud.git
   git push -u origin main
   ```

### 3️⃣ Vercel（ホスティング）設定

1. **アカウント作成**
   ```
   https://vercel.com
   ↓
   GitHubでサインアップ
   ```

2. **プロジェクトデプロイ**
   ```
   「New Project」
   ↓
   GitHubから「fc-sales-cloud」を選択
   ↓
   「Import」
   ```

3. **環境変数設定**
   ```
   「Environment Variables」で以下を入力:
   
   SUPABASE_URL = [Supabaseの Project URL]
   SUPABASE_ANON_KEY = [Supabaseの anon public key]
   JWT_SECRET = fc-sales-secret-2024
   ```

4. **デプロイ実行**
   ```
   「Deploy」クリック → 完成！
   ```

---

## 🎉 完成後

**アクセスURL**: `https://あなたのプロジェクト名.vercel.app`

**ログイン情報**:
- 管理者: `admin` / `admin`

**実装済み機能**:
- ✅ ログイン・認証
- ✅ 店舗・ユーザー管理
- ✅ レスポンシブデザイン

---

## 📞 サポート

何か問題があれば、各プラットフォームの公式ドキュメントを参照してください：

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Docs](https://nextjs.org/docs)