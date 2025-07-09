export default function StoreDashboard({ user }) {
  return (
    <div className="container">
      <h2 style={{ marginBottom: '20px' }}>
        {user.store_name} - 売上管理
      </h2>

      <div className="card">
        <h3>店舗機能</h3>
        <p>クラウド版FC売上管理システムが正常に動作しています！</p>
        <p>加盟店として以下の機能を利用できます：</p>
        <ul style={{ margin: '20px 0', paddingLeft: '20px' }}>
          <li>✅ ログイン・認証機能</li>
          <li>🔄 日別売上・客数入力（開発中）</li>
          <li>🔄 売上データ修正（開発中）</li>
          <li>🔄 過去データ閲覧（開発中）</li>
          <li>🔄 統計情報表示（開発中）</li>
        </ul>
        
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
          <h4>現在のユーザー情報</h4>
          <p><strong>店舗名:</strong> {user.store_name}</p>
          <p><strong>ユーザー名:</strong> {user.username}</p>
          <p><strong>権限:</strong> 店舗ユーザー</p>
        </div>
      </div>
    </div>
  )
}