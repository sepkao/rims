import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// The environment takes precedence; CI does not need a local .env file.
if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
const directory = new URL('../../../supabase/migrations/', import.meta.url)
const args = process.argv.slice(2)
const check = args.includes('--check')
const bootstrap = args.includes('--bootstrap')
const through = args.find(arg => arg.startsWith('--through='))?.slice('--through='.length)

async function main() {
  const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
  if (through && !files.includes(through)) throw new Error('Unknown --through migration filename')
  if (bootstrap && !through) throw new Error('Bootstrap requires --through=EXACT_FILENAME.sql for the last manually verified migration')
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(74192021)')
    const tracked = (await client.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name
    const applied = new Set(tracked ? (await client.query('SELECT filename FROM public.schema_migrations')).rows.map(r => r.filename) : [])
    if ([...applied].some(name => !files.includes(name))) throw new Error('Database contains migrations missing from this checkout')
    const pending = files.filter(name => !applied.has(name))
    if (check) {
      for (const name of files) console.log((applied.has(name) ? '[x] ' : '[ ] ') + name)
      if (pending.length) process.exitCode = 1
      return
    }
    const existing = (await client.query("SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> 'schema_migrations') AS present")).rows[0].present
    if (!applied.size && existing && !bootstrap) throw new Error('Existing untracked database: verify its schema then bootstrap with --through=EXACT_FILENAME.sql')
    if (bootstrap && (!existing || applied.size)) throw new Error('Bootstrap requires an existing, untracked database')
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
    const selected = pending.filter(name => !through || files.indexOf(name) <= files.indexOf(through))
    if (bootstrap) {
      await client.query('BEGIN')
      try {
        for (const name of selected) await client.query('INSERT INTO public.schema_migrations(filename) VALUES($1)', [name])
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error }
      console.log('Recorded verified baseline through ' + through + '; later migrations remain pending')
      return
    }
    for (const name of selected) {
      await client.query('BEGIN')
      try {
        await client.query(await readFile(new URL(name, directory), 'utf8'))
        await client.query('INSERT INTO public.schema_migrations(filename) VALUES($1)', [name])
        await client.query('COMMIT')
        console.log('Applied ' + name)
      } catch (error) { await client.query('ROLLBACK'); throw new Error(name + ': ' + error.message, { cause: error }) }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(74192021)')
    client.release()
  }
}
main().catch(error => { console.error(error.message || error.code || String(error)); process.exitCode = 1 }).finally(() => pool.end())
