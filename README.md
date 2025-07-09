# FC売上管理システム（クラウド版）

FC本部向けの加盟店売上管理システムのクラウド版です。

## 🌐 使用技術

- **フロントエンド**: Next.js 14 + React 18
- **バックエンド**: Next.js API Routes
- **データベース**: PostgreSQL (Supabase)
- **ホスティング**: Vercel
- **認証**: JWT

## 📋 デプロイ手順

### 1. Supabaseプロジェクト作成

1. [Supabase](https://supabase.com) にアクセス
2. 「New project」でプロジェクト作成
3. Project Settings → API から以下を取得:
   - `Project URL`
   - `anon public key`

### 2. データベース初期化

Supabaseの SQL Editor で以下を実行:

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

-- 管理者ユーザーを作成（パスワード: admin）
INSERT INTO users (username, password, role) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
```

### 3. GitHubリポジトリ作成

1. GitHubで新しいリポジトリを作成
2. プロジェクトをpush:

```bash
cd fc-sales-cloud
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/fc-sales-cloud.git
git push -u origin main
```

### 4. Vercelデプロイ

1. [Vercel](https://vercel.com) にログイン
2. 「New Project」からGitHubリポジトリを選択
3. 環境変数を設定:
   - `SUPABASE_URL`: SupabaseのProject URL
   - `SUPABASE_ANON_KEY`: Supabaseのanon public key
   - `JWT_SECRET`: 任意の文字列（例: fc-sales-secret-key-2024）

## 🔐 初期ログイン情報

- **管理者**: username: `admin`, password: `admin`

## ✨ 機能

### 本部管理機能
- ✅ ログイン・認証
- ✅ 店舗・ユーザー管理
- 🔄 売上ランキング（開発予定）
- 🔄 売上グラフ（開発予定）

### 加盟店機能
- ✅ ログイン・認証
- 🔄 売上入力（開発予定）
- 🔄 データ閲覧（開発予定）

## 🚀 ローカル開発

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセス

## 📝 環境変数

`.env.local` ファイルを作成:

```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
JWT_SECRET=your-jwt-secret
```