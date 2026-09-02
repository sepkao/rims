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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
