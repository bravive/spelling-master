import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 30000,
    environmentMatchGlobs: [
      ['src/__tests__/server.integration.test.js', 'node'],
      ['src/__tests__/friends.integration.test.js', 'node'],
      ['src/__tests__/db.test.js', 'node'],
    ],
  },
})
