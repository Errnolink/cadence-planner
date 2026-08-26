import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev-server escape hatch for the CSP: the shipped meta tag stays tight
// (no ws:/http: sources), but Vite's HMR websocket and the odd plain-http
// proxy need them while developing. Injected only under `vite serve`.
const cspDevExtras = {
  name: 'csp-dev-extras',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(/(connect-src[^;]*)(;)/, '$1 ws: http:$2')
  },
}

export default defineConfig({
  plugins: [react(), cspDevExtras],
  test: {
    environment: 'node', // pure-logic tests; no DOM needed yet
    include: ['src/**/*.test.js'],
  },
})
