import { Component, ErrorInfo, ReactNode } from 'react'

interface Props  { children: ReactNode }
interface State  { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        background: '#090810',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Georgia, serif',
        color: '#e8d5b0',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '480px',
          background: '#12101a',
          border: '1px solid #3a2d4a',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🕯️</div>
          <h2 style={{ margin: '0 0 0.5rem', color: '#c0392b' }}>Algo deu errado</h2>
          <p style={{ color: '#9a8fa0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Um erro inesperado ocorreu. Você pode tentar recarregar a página.
          </p>
          <details style={{ textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.78rem', color: '#6a607a' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Detalhes técnicos</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error.message}
            </pre>
          </details>
          <button
            onClick={() => {
              try { localStorage.removeItem('detetive_save_v2') } catch { /* noop */ }
              location.reload()
            }}
            style={{
              background: '#c0392b',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.4rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
            }}
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
