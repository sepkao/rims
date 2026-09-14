import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// order-flow.test.mjs already covers partial serve, handoff, and return
// sequentially, plus requestId-based double-submit protection for a single
// caller retrying. This targets a true concurrency case instead: two
// DIFFERENT staff, different requestIds, firing at the same instant for the
// same remaining quantity. The table_sessions FOR UPDATE lock in the serve
// handler must serialize them so exactly one succeeds and the item is never
// overserved past its own quantity.
test('Serve race: two staff serving the same remaining quantity at once never overserves', { skip: !process.env.TEST_DATABASE_URL, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-servrace-' + Date.now()
  const ids = { users: [], tables: [], sessions: [], orders: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    for (const i of [0, 1]) {
      ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id", [prefix + i, prefix + i + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    }
    const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix])).id
    ids.tables.push(table)
    const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, prefix, ids.users[0]])).id
    ids.sessions.push(session)
    const menu = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix])).id
    ids.menuItem = menu
    const order = (await one("INSERT INTO orders(table_session_id,confirm_at,status,confirmed_at,acknowledged_at,acknowledged_by) VALUES($1,now(),'confirmed',now(),now(),$2) RETURNING id", [session, ids.users[0]])).id
    ids.orders.push(order)
    const item = (await one('INSERT INTO order_items(order_id,menu_item_id,quantity) VALUES($1,$2,5) RETURNING id', [order, menu])).id
    ids.item = item

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
    const cookies = []
    for (const i of [0, 1]) {
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + i + '@example.test', password: 'test-password' }) })
      cookies.push(response.headers.get('set-cookie').split(';')[0])
    }
    const serve = (actor, requestId) => fetch(base + '/staff/order-items/' + item + '/serve', {
      method: 'PUT', headers: { Cookie: cookies[actor], 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: 5, requestId }),
    })

    await t.test('two staff both claiming all 5 remaining plates at once: exactly one wins', async () => {
      const [a, b] = await Promise.all([serve(0, prefix + '-req-a'), serve(1, prefix + '-req-b')])
      const statuses = [a.status, b.status].sort()
      assert.deepEqual(statuses, [200, 409])
      assert.equal((await one('SELECT served_quantity::int AS n FROM order_items WHERE id = $1', [item])).n, 5)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM order_item_serving_events WHERE order_item_id = $1', [ids.item])
    for (const orderId of ids.orders) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId])
    }
    if (ids.menuItem) await pool.query('DELETE FROM menu_items WHERE id = $1', [ids.menuItem])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
