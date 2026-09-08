import { Pool } from 'pg'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  process.loadEnvFile(resolve(__dirname, '../.env'))
} catch {
  try {
    process.loadEnvFile()
  } catch {
    // ignore
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep the conservative pg default unless the deployment's DB quota is known.
  max: positiveInteger(process.env.DB_POOL_MAX, 10),
  connectionTimeoutMillis: positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 5_000),
})

// pg emits an error for an idle client when the database drops its connection.
// Without a listener this becomes an uncaught EventEmitter error and exits Node.
pool.on('error', (error) => {
  console.error('Unexpected idle PostgreSQL client error', error)
})
