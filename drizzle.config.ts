import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — add it to .env.local')

export default defineConfig({
  schema: './src/db/schema',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
})
