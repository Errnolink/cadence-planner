import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { AuthProvider } from './providers/AuthProvider.jsx'
import { SettingsProvider } from './providers/SettingsProvider.jsx'
import { ThemeProvider } from './providers/ThemeProvider.jsx'
import './index.css'

// PWA offline shell — production only (dev serves un-hashed modules)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <App />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
