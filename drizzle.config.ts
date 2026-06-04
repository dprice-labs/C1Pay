import { defineConfig } from 'drizzle-kit'
import { loadEnv } from 'vite'

const loaded = loadEnv('development', process.cwd(), '')
for (const [k, v] of Object.entries(loaded)) {
  if (!(k in process.env)) process.env[k] = v
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — add it to .env.local')

export default defineConfig({
  schema: './src/db/schema',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
})
