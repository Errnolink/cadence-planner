import React from 'react'

/**
 * ErrorBoundary — catches unhandled render errors and displays a
 * themed fallback UI instead of a blank white screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          background: '#0a0a0a',
          color: '#ef4444',
          fontFamily: "'Share Tech Mono', monospace",
          padding: '24px',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '14px', letterSpacing: '0.2em', fontWeight: 'bold' }}>
            ⚠ SYSTEM FAULT DETECTED
          </div>
          <div style={{
            fontSize: '10px',
            color: '#a3a3a3',
            maxWidth: '420px',
            lineHeight: 1.6,
            padding: '12px',
            border: '1px solid #333',
            background: '#111',
          }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.15em',
                padding: '8px 24px',
                border: '1px solid #f97316',
                color: '#f97316',
                background: 'rgba(249,115,22,0.1)',
                cursor: 'pointer',
              }}
            >
              ATTEMPT RECOVERY
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.15em',
                padding: '8px 24px',
                border: '1px solid #525252',
                color: '#525252',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              FULL REBOOT
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
