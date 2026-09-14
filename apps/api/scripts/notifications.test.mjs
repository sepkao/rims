import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Notifications and alerts across roles use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-notify-' + Date.now()
  const ids = { users: [], ingredients: [], tables: [], sessions: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix + '-cashier', prefix + '-cashier@example.test', await bcrypt.hash('test-password', 4)])).id)
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [prefix + '-owner', prefix + '-owner@example.test', await bcrypt.hash('test-password', 4)])).id)
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id", [prefix + '-staff', prefix + '-staff@example.test', await bcrypt.hash('test-password', 4)])).id)
    const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix])).id
    ids.tables.push(table)
    const qr = prefix + '-qr'
    const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, qr, ids.users[0]])).id
    ids.sessions.push(session)
    const meatId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg,reorder_threshold_kg) VALUES($1,'meat',0.1,5) RETURNING id", [prefix])).id
    ids.ingredients.push(meatId)

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
    const cashierCookie = await login(prefix + '-cashier@example.test')
    const ownerCookie = await login(prefix + '-owner@example.test')
    const staffCookie = await login(prefix + '-staff@example.test')
    const req = (path, method, cookie) => fetch(base + path, { method, headers: cookie ? { Cookie: cookie } : {} })

    await t.test('call-staff creates a real cashier notification, and rate-limits repeat calls', async () => {
      const first = await fetch(base + '/customer/call-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: qr }) })
      assert.equal(first.status, 200)
      const again = await fetch(base + '/customer/call-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: qr }) })
      assert.equal(again.status, 429)
    })

    await t.test('cashier sees the unread notification and can read it (single, then all)', async () => {
      const list = await (await req('/cashier/notifications', 'GET', cashierCookie)).json()
      const notif = list.notifications.find((n) => n.tableNumber === prefix)
      assert.ok(notif && !notif.isRead)
      assert.equal((await req('/cashier/notifications/' + notif.id + '/read', 'POST', cashierCookie)).status, 200)
      assert.equal((await (await req('/cashier/notifications', 'GET', cashierCookie)).json()).notifications.some((n) => n.id === notif.id), false)
      assert.equal((await req('/cashier/notifications/read-all', 'POST', cashierCookie)).status, 200)
    })

    await t.test('expiry-alerts is staff-only even though /staff/* generally allows owner too', async () => {
      assert.equal((await req('/staff/expiry-alerts', 'GET', staffCookie)).status, 200)
      assert.equal((await req('/staff/expiry-alerts', 'GET', ownerCookie)).status, 403)
    })

    await t.test('low-stock-alerts reflects real Freezer stock against the real reorder threshold', async () => {
      const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[2]])).id
      ids.headerId = header
      const lot = (await one(
        "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,2,2,10,now()+interval '1 day' FROM storage_locations WHERE name='Freezer' RETURNING id",
        [header, meatId],
      )).id
      ids.lotId = lot
      const alerts = (await (await req('/owner/low-stock-alerts', 'GET', ownerCookie)).json()).alerts
      const alert = alerts.find((a) => a.ingredientId === String(meatId))
      assert.equal(alert.severity, 'low') // 2kg on hand < 5kg threshold, but not zero

      await pool.query('UPDATE stock_lots SET quantity_remaining = 0 WHERE id = $1', [lot])
      const alertsAfter = (await (await req('/owner/low-stock-alerts', 'GET', ownerCookie)).json()).alerts
      assert.equal(alertsAfter.find((a) => a.ingredientId === String(meatId)).severity, 'critical')
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM cashier_notifications WHERE table_number = $1', [prefix])
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
