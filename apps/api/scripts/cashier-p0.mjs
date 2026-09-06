import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const apiDirectory = resolve(scriptDirectory, '..')
const repositoryRoot = resolve(apiDirectory, '..', '..')
process.loadEnvFile(resolve(apiDirectory, '.env'))

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing from apps/api/.env')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const checkOnly = process.argv.includes('--check')

async function relationExists(name) {
  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${name}`])
  return result.rows[0].present
}

async function applyMigration(filename) {
  const sql = await readFile(resolve(repositoryRoot, 'supabase', 'migrations', filename), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`Applied ${filename}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function status() {
  const result = await pool.query(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS core_schema,
      to_regclass('public.cashier_notifications') IS NOT NULL AS cashier_notifications,
      to_regclass('public.cashier_payments') IS NOT NULL AS cashier_payments,
      to_regprocedure('public.expire_table_sessions()') IS NOT NULL AS expiry_function,
      to_regprocedure('public.deduct_stock_fifo(bigint,integer,bigint,bigint)') IS NOT NULL AS fifo_signature,
      pg_get_functiondef('public.deduct_stock_fifo(bigint,integer,bigint,bigint)'::regprocedure)
        ILIKE '%expiry_date > now()%' AS fifo_expiry_guard,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_sessions_valid_duration') AS duration_constraint,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'table_sessions_has_guest') AS guest_constraint,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron
  `)
  const state = result.rows[0]
  let expiryJob = false
  let autoConfirmJob = false
  let freshnessJob = false
  if (state.pg_cron) {
    const jobs = await pool.query(`
      SELECT
        EXISTS(
        SELECT 1 FROM cron.job
        WHERE jobname = 'rims-expire-table-sessions'
          AND active = true
          AND command ILIKE '%expire_table_sessions%'
        ) AS expiry_job,
        EXISTS(
          SELECT 1 FROM cron.job
          WHERE jobname = 'rims-auto-confirm-orders'
            AND active = true
            AND command ILIKE '%auto_confirm_order%'
        ) AS auto_confirm_job,
        EXISTS(
          SELECT 1 FROM cron.job
          WHERE jobname = 'rims-mark-not-fresh-lots'
            AND active = true
            AND command ILIKE '%mark_not_fresh_lots%'
        ) AS freshness_job
    `)
    expiryJob = jobs.rows[0].expiry_job
    autoConfirmJob = jobs.rows[0].auto_confirm_job
    freshnessJob = jobs.rows[0].freshness_job
  }
  return { ...state, expiry_job: expiryJob, auto_confirm_job: autoConfirmJob, freshness_job: freshnessJob }
}

try {
  if (!checkOnly) {
    const coreTables = ['users', 'dining_tables', 'table_sessions', 'orders', 'order_items']
    const coreState = await Promise.all(coreTables.map(relationExists))
    if (coreState.every((present) => !present)) {
      await applyMigration('0001_init.sql')
    } else if (!coreState.every(Boolean)) {
      throw new Error('Core schema is only partially installed; stop and reconcile it before running cashier migrations')
    }

    await applyMigration('0002_cashier_hardening.sql')
    await applyMigration('0003_cashier_expiry_schedule.sql')
    await applyMigration('0005_cashier_stock_deduction_signature.sql')
    await applyMigration('0006_fifo_expiry_guard.sql')
  }

  const state = await status()
  console.log(JSON.stringify(state, null, 2))
  if (Object.values(state).some((ready) => ready !== true)) process.exitCode = 1
} catch (error) {
  console.error(`Cashier P0 migration failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
