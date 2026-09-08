// [SYS01] Migration runner + tracking table — RIMS previously had no way to know which
// of supabase/migrations/*.sql had actually been applied to a given database, so files
// had to be run by hand, in the right order, from memory. This script fixes that:
//
//   npm run db:migrate:check      -- list applied vs pending, run nothing
//   npm run db:migrate:bootstrap  -- first run against an ALREADY-migrated database:
//                                    record every .sql file currently in the folder as
//                                    applied, without re-running any of them. Required
//                                    once before `db:migrate` will do anything, unless
//                                    schema_migrations is empty AND there's exactly one
//                                    migration file (a genuinely fresh database).
//   npm run db:migrate            -- apply every .sql file not yet recorded, in filename
//                                    order, each inside its own transaction.
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const apiDirectory = resolve(scriptDirectory, '..')
const repositoryRoot = resolve(apiDirectory, '..', '..')
const migrationsDirectory = resolve(repositoryRoot, 'supabase', 'migrations')
process.loadEnvFile(resolve(apiDirectory, '.env'))

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing from apps/api/.env')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const mode = process.argv.includes('--bootstrap') ? 'bootstrap' : process.argv.includes('--check') ? 'check' : 'apply'

async function listMigrationFiles() {
  const entries = await readdir(migrationsDirectory)
  return entries.filter((name) => name.endsWith('.sql')).sort()
}

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

async function getAppliedFilenames() {
  const result = await pool.query('SELECT filename FROM schema_migrations')
  return new Set(result.rows.map((row) => row.filename))
}

async function bootstrap(allFiles, applied) {
  if (applied.size > 0) {
    console.log(`schema_migrations already has ${applied.size} row(s) — nothing to bootstrap. Use "npm run db:migrate" for new files.`)
    return
  }
  for (const filename of allFiles) {
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename])
  }
  console.log(`Bootstrapped schema_migrations with ${allFiles.length} file(s) as already-applied (no SQL was run). New files added after this point will be applied normally by "npm run db:migrate".`)
}

async function applyMigration(filename) {
  const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
    await client.query('COMMIT')
    console.log(`Applied ${filename}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw new Error(`Failed applying ${filename}: ${error instanceof Error ? error.message : error}`)
  } finally {
    client.release()
  }
}

async function main() {
  await ensureTrackingTable()
  const allFiles = await listMigrationFiles()
  const applied = await getAppliedFilenames()
  const pending = allFiles.filter((filename) => !applied.has(filename))

  if (mode === 'check') {
    console.log(`${applied.size} applied, ${pending.length} pending:`)
    for (const filename of allFiles) console.log(`  [${applied.has(filename) ? 'x' : ' '}] ${filename}`)
    return
  }

  if (mode === 'bootstrap') {
    await bootstrap(allFiles, applied)
    return
  }

  // mode === 'apply'
  if (applied.size === 0 && allFiles.length > 1) {
    console.error(
      `schema_migrations is empty but ${allFiles.length} migration files exist — this looks like an ALREADY-migrated ` +
      `database that has never been tracked before, not a fresh one. Re-running every file from 0001 would likely fail ` +
      `or double-apply non-idempotent statements. Run "npm run db:migrate:bootstrap" first to record the current files ` +
      `as already-applied, then re-run "npm run db:migrate" for anything added after that.`
    )
    process.exitCode = 1
    return
  }

  if (pending.length === 0) {
    console.log('Nothing to apply — schema_migrations is up to date.')
    return
  }

  for (const filename of pending) {
    await applyMigration(filename)
  }
  console.log(`Applied ${pending.length} migration(s).`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
