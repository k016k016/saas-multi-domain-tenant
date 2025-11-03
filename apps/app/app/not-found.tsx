/**
 * 404エラーページ（appドメイン用）
 */

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{
        fontSize: '4rem',
        marginBottom: '1rem',
        color: '#ef4444'
      }}>404</h1>
      <h2 style={{
        fontSize: '1.5rem',
        marginBottom: '1rem'
      }}>ページが見つかりません</h2>
      <p style={{
        marginBottom: '2rem',
        color: '#a1a1aa'
      }}>
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <a
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          background: '#3b82f6',
          color: 'white',
          borderRadius: '0.375rem',
          textDecoration: 'none',
          display: 'inline-block'
        }}
      >
        ダッシュボードに戻る
      </a>
    </div>
  );
}