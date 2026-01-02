import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '6rem', margin: '1rem 0', color: 'var(--primary-color)' }}>404</h1>

      <h2 style={{ marginBottom: '1rem' }}>Oops! Page Not Found</h2>

      <p style={{
        fontSize: '1.1rem',
        color: 'var(--text-secondary)',
        marginBottom: '2rem',
        maxWidth: '500px'
      }}>
        The page you're looking for doesn't exist.
      </p>

      <Link to="/" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
        🏠 Return Home
      </Link>
    </div>
  );
}
