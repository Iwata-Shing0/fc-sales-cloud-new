export default function Header({ user, onLogout, onSettings }) {
  return (
    <header className="header">
      <h1 style={{ fontSize: '20px' }}>LM売上管理</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span>
          {user.role === 'admin' && !user.isAdminMode 
            ? '本部管理者' 
            : user.isAdminMode 
              ? `管理者 → ${user.store_name}`
              : user.store_name
          } - {user.username}
        </span>
        {user.role === 'admin' && !user.isAdminMode && onSettings && (
          <button 
            className="btn btn-secondary" 
            onClick={onSettings}
            style={{
              backgroundColor: '#6c757d',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⚙️ 設定
          </button>
        )}
        <button className="btn btn-danger" onClick={onLogout}>
          ログアウト
        </button>
      </div>
    </header>
  )
}