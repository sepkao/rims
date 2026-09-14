import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// pricing-qr.test.mjs already covers check-in itself (price/QR-duration
// snapshot). This covers the rest of the table lifecycle it doesn't touch:
// QR regeneration and the pending_cleanup -> empty clear step.
test('QR regeneration and table clearing use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-checkin-' + Date.now()
  const ids = { users: [], tables: [], sessions: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix])).id
    ids.tables.push(table)
    const oldQr = prefix + '-old'
    const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, oldQr, ids.users[0]])).id
    ids.sessions.push(session)

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
    const cookie = (await fetch(base + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + '@example.test', password: 'test-password' }),
    })).headers.get('set-cookie').split(';')[0]
    const req = (path, method) => fetch(base + path, { method, headers: { Cookie: cookie } })

    await t.test('regenerating QR on an active session issues a different code', async () => {
      const response = await req('/cashier/table-sessions/' + session + '/regenerate-qr', 'POST')
      assert.equal(response.status, 200)
      const { qrCode } = await response.json()
      assert.notEqual(qrCode, oldQr)
      assert.equal((await one('SELECT qr_code AS qr FROM table_sessions WHERE id = $1', [session])).qr, qrCode)
    })

    await t.test('clearing a table that is not pending_cleanup is rejected', async () => {
      await pool.query("UPDATE dining_tables SET status = 'occupied' WHERE id = $1", [table])
      assert.equal((await req('/cashier/dining-tables/' + table + '/clear', 'POST')).status, 400)
    })

    await t.test('clearing a pending_cleanup table empties it, and regenerate-qr then 404s on the ended session', async () => {
      await pool.query("UPDATE dining_tables SET status = 'pending_cleanup' WHERE id = $1", [table])
      await pool.query("UPDATE table_sessions SET ended_at = now() WHERE id = $1", [session])
      assert.equal((await req('/cashier/dining-tables/' + table + '/clear', 'POST')).status, 200)
      assert.equal((await one('SELECT status FROM dining_tables WHERE id = $1', [table])).status, 'empty')
      assert.equal((await req('/cashier/table-sessions/' + session + '/regenerate-qr', 'POST')).status, 404)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
