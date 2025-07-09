export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      <h1>FC売上管理システム（クラウド版）</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span>
          {user.role === 'admin' ? '本部管理者' : user.store_name} - {user.username}
        </span>
        <button className="btn btn-danger" onClick={onLogout}>
          ログアウト
        </button>
      </div>
    </header>
  )
}