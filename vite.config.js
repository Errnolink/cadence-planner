import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // pure-logic tests; no DOM needed yet
    include: ['src/**/*.test.js'],
  },
})
