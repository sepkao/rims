import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Buffet pricing (4 tiers) and QR session duration use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-pricing-' + Date.now()
  const ids = { users: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  const originalSettings = (await pool.query("SELECT key, value FROM settings WHERE key = ANY($1::text[])",
    [['buffet_price_adult', 'buffet_price_child', 'buffet_price_senior', 'buffet_price_disabled', 'qr_duration_minutes']])).rows
  let server
  try {
    ids.users.push((await one(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,\'cashier\') RETURNING id',
      [prefix + '-cashier', prefix + '-cashier@example.test', await bcrypt.hash('test-password', 4)],
    )).id)
    ids.users.push((await one(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,\'owner\') RETURNING id',
      [prefix + '-owner', prefix + '-owner@example.test', await bcrypt.hash('test-password', 4)],
    )).id)
    const table = (await one("INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id", [prefix])).id
    ids.table = table

    let output = ''
    server = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'production', PORT: '0', SESSION_SECRET: 'integration-only-session-secret-123456' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', (data) => { output += data })
    server.stderr.on('data', (data) => { output += data })
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('API startup timeout: ' + output)) }, 10000)
      const poll = setInterval(() => {
        const match = output.match(/http:\/\/localhost:(\d+)/)
        if (match) { clearInterval(poll); clearTimeout(timeout); resolve('http://127.0.0.1:' + match[1]) }
      }, 20)
    })
    const login = async (email) => (await fetch(base + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'test-password' }),
    })).headers.get('set-cookie').split(';')[0]
    const ownerCookie = await login(prefix + '-owner@example.test')
    const cashierCookie = await login(prefix + '-cashier@example.test')
    const asOwner = (method, body) => fetch(base + '/owner/settings/buffet-prices', {
      method, headers: { Cookie: ownerCookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })

    await t.test('owner can set all 4 buffet price tiers, and a negative price is rejected', async () => {
      assert.equal((await asOwner('PUT', { adult: 200, child: 100, senior: -1, disabled: 0 })).status, 400)
      const update = await asOwner('PUT', { adult: 200, child: 100, senior: 150, disabled: 0 })
      assert.equal(update.status, 200)
      assert.deepEqual(await update.json(), { adult: 200, child: 100, senior: 150, disabled: 0 })
      assert.deepEqual(await (await asOwner('GET')).json(), { adult: 200, child: 100, senior: 150, disabled: 0 })
    })

    await t.test('a checked-in session snapshots the current buffet prices and QR duration', async () => {
      await pool.query("UPDATE settings SET value = '45' WHERE key = 'qr_duration_minutes'")
      const response = await fetch(base + '/cashier/table-sessions', {
        method: 'POST', headers: { Cookie: cashierCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ diningTableId: table, adultCount: 2, childCount: 1, seniorCount: 0, disabledCount: 0 }),
      })
      assert.equal(response.status, 201)
      const session = (await response.json()).tableSession
      ids.sessionId = session.id
      assert.equal((await one('SELECT price_per_adult::int AS n FROM table_sessions WHERE id = $1', [session.id])).n, 200)
      const minutesLeft = (new Date(session.expiresAt) - Date.now()) / 60000
      assert.ok(minutesLeft > 43 && minutesLeft <= 45, `expected ~45 minutes left, got ${minutesLeft}`)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    for (const row of originalSettings) await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [row.value, row.key])
    if (ids.sessionId) await pool.query('DELETE FROM table_sessions WHERE id = $1', [ids.sessionId])
    if (ids.table) await pool.query('DELETE FROM dining_tables WHERE id = $1', [ids.table])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
