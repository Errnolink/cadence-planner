import React from 'react'

/**
 * ErrorBoundary — catches unhandled render errors and displays a
 * themed fallback UI instead of a blank white screen. Auto-reloads
 * after a countdown; manual recovery remounts children with a fresh key.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, countdown: 10, resetKey: 0 }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.hasError && this.state.hasError) {
      this.timer = setInterval(() => {
        this.setState(s => {
          if (s.countdown <= 1) {
            clearInterval(this.timer)
            window.location.reload()
            return null
          }
          return { countdown: s.countdown - 1 }
        })
      }, 1000)
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer)
  }

  attemptRecovery() {
    clearInterval(this.timer)
    this.setState(s => ({ hasError: false, error: null, countdown: 10, resetKey: s.resetKey + 1 }))
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
          <div style={{ fontSize: '10px', color: '#737373', letterSpacing: '0.1em' }}>
            AUTO-REBOOT IN {this.state.countdown}s
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => this.attemptRecovery()}
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

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
  }
}
