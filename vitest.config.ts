import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    test: {
      environment: 'node',
      // .env files provide defaults, but an explicit DATABASE_URL already in the environment
      // wins — this lets `test:integration:docker` point the tests at the ephemeral
      // integration DB instead of the dev DB configured in .env.local.
      env: process.env.DATABASE_URL
        ? { ...fileEnv, DATABASE_URL: process.env.DATABASE_URL }
        : fileEnv,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
