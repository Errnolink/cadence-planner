import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ThemeProvider } from './themes/ThemeContext.jsx'
import { SettingsProvider } from './hooks/useSettings.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
