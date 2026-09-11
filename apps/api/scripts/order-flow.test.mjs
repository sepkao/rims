import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('PostgreSQL inventory, upgrade and HTTP staff/checkout flow', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async t => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const ids = { users: [], ingredients: [], orders: [] }
  const prefix = 'integration-' + Date.now()
  let server
  let session, table, menu, header
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  try {
    for (const role of ['staff', 'staff', 'cashier']) {
      ids.users.push((await one('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
        [prefix, prefix + ids.users.length + '@example.test', await bcrypt.hash('test-password', 4), role])).id)
    }
    table = (await one("INSERT INTO dining_tables(table_number,status) VALUES($1,'occupied') RETURNING id", [prefix])).id
    session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, prefix, ids.users[2]])).id
    menu = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix])).id
    header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    for (let i = 0; i < 2; i++) ids.ingredients.push((await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'meat',0.1) RETURNING id", [prefix + i])).id)
    const lot = (await one("INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,10,10,5,now()+interval '1 day' FROM storage_locations WHERE name='ตู้พักละลาย' RETURNING id", [header, ids.ingredients[0]])).id
    const order = async (both = false, quantity = 1) => {
      const id = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()-interval '1 minute') RETURNING id", [session])).id
      ids.orders.push(id)
      const item = (await one('INSERT INTO order_items(order_id,menu_item_id,quantity) VALUES($1,$2,$3) RETURNING id', [id, menu, quantity])).id
      for (const ingredient of both ? ids.ingredients : [ids.ingredients[0]]) await pool.query('INSERT INTO order_item_bom VALUES($1,$2,1,false)', [item, ingredient])
      return id
    }
    await t.test('insufficient second ingredient rolls back the first deduction', async () => {
      const id = await order(true)
      assert.equal((await one('SELECT auto_confirm_order($1) AS ok', [id])).ok, false)
      assert.equal((await one('SELECT quantity_remaining::int AS n FROM stock_lots WHERE id=$1', [lot])).n, 10)
      assert.equal((await one('SELECT count(*)::int AS n FROM stock_movements WHERE order_id=$1', [id])).n, 0)
    })
    let active
    await t.test('locked stock waits and succeeds; confirming twice deducts only once', async () => {
      active = await order(false, 3)
      const a = await pool.connect()
      const b = await pool.connect()
      try {
        await a.query('BEGIN')
        await a.query('SELECT id FROM stock_lots WHERE id=$1 FOR UPDATE', [lot])
        const pid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
        const work = b.query('SELECT auto_confirm_order($1) AS ok', [active])
        let blocked = false
        const deadline = Date.now() + 5000
        while (Date.now() < deadline) {
          blocked = (await a.query('SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked', [pid])).rows[0].blocked
          if (blocked) break
        }
        await a.query('COMMIT')
        const result = await work
        assert.ok(blocked, 'confirmation must wait for the stock lock')
        assert.equal(result.rows[0].ok, true)
        assert.equal((await one('SELECT auto_confirm_order($1) AS ok', [active])).ok, false)
        assert.equal((await one('SELECT quantity_remaining::int AS n FROM stock_lots WHERE id=$1', [lot])).n, 7)
      } finally { await a.query('ROLLBACK'); a.release(); b.release() }
    })
    await t.test('upgrade releases only ownerless unfinished claims', async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('UPDATE orders SET acknowledged_at=now(), acknowledged_by=NULL WHERE id=$1', [active])
        await client.query(await readFile(new URL('../../../supabase/migrations/0021_fifo_wait_and_legacy_claims.sql', import.meta.url), 'utf8'))
        assert.equal((await client.query('SELECT acknowledged_at FROM orders WHERE id=$1', [active])).rows[0].acknowledged_at, null)
        await client.query('UPDATE orders SET acknowledged_at=now(), acknowledged_by=$2 WHERE id=$1', [active, ids.users[0]])
        await client.query(await readFile(new URL('../../../supabase/migrations/0021_fifo_wait_and_legacy_claims.sql', import.meta.url), 'utf8'))
        assert.equal((await client.query('SELECT acknowledged_by FROM orders WHERE id=$1', [active])).rows[0].acknowledged_by, ids.users[0])
      } finally { await client.query('ROLLBACK'); client.release() }
    })

    let output = ''
    server = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'production', PORT: '0', SESSION_SECRET: 'integration-only-session-secret-123456' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', data => { output += data })
    server.stderr.on('data', data => { output += data })
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('API startup timeout: ' + output)) }, 10000)
      const poll = setInterval(() => {
        const match = output.match(/http:\/\/localhost:(\d+)/)
        if (match) { clearInterval(poll); clearTimeout(timeout); resolve('http://127.0.0.1:' + match[1]) }
      }, 20)
    })
    const cookies = []
    for (let i = 0; i < 3; i++) {
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + i + '@example.test', password: 'test-password' }) })
      assert.equal(response.status, 200)
      cookies.push(response.headers.get('set-cookie').split(';')[0])
    }
    const request = (actor, path, body, method = 'PUT') => fetch(base + path, {
      method, headers: { Cookie: cookies[actor], 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
    })
    await t.test('partial serving, delegated runner, handoff, safe return and checkout use actual HTTP handlers', async () => {
      assert.equal((await request(0, '/staff/orders/' + active + '/acknowledge')).status, 200)
      const itemId = (await one('SELECT id FROM order_items WHERE order_id=$1', [active])).id
      const requestId = prefix + '-partial-serve'
      const partial = await request(1, '/staff/order-items/' + itemId + '/serve', { quantity: 1, requestId })
      assert.equal(partial.status, 200)
      assert.equal((await partial.json()).isDelegate, true)
      assert.equal((await one('SELECT served_quantity::int AS n FROM order_items WHERE id=$1', [itemId])).n, 1)
      assert.equal((await one('SELECT is_delegate FROM order_item_serving_events WHERE order_item_id=$1 ORDER BY id DESC LIMIT 1', [itemId])).is_delegate, true)
      assert.equal((await request(1, '/staff/order-items/' + itemId + '/serve', { quantity: 1, requestId })).status, 200)
      assert.equal((await one('SELECT served_quantity::int AS n FROM order_items WHERE id=$1', [itemId])).n, 1)
      assert.equal((await request(1, '/staff/orders/' + active + '/return', { reason: 'wrong handler' })).status, 409)
      assert.equal((await request(0, '/staff/orders/' + active + '/return', { reason: ' ' })).status, 400)
      const denied = await request(2, '/cashier/table-sessions/' + session + '/checkout', { paymentMethod: 'cash', cashReceived: 0 }, 'POST')
      assert.equal(denied.status, 409)
      const deniedBody = await denied.json()
      assert.equal(deniedBody.code, 'UNSERVED_ORDERS')
      assert.equal(deniedBody.unservedOrderCount, 1)
      assert.equal(deniedBody.unservedItemCount, 2)
      assert.equal((await one('SELECT count(*)::int AS n FROM cashier_payments WHERE table_session_id=$1', [session])).n, 0)
      assert.equal((await request(1, '/staff/orders/' + active + '/reassign')).status, 200)
      assert.equal((await request(0, '/staff/orders/' + active + '/return', { reason: 'old handler' })).status, 409)
      assert.equal((await request(1, '/staff/orders/' + active + '/return', { reason: 'Customer declined remaining dishes' })).status, 200)
      assert.equal((await one('SELECT quantity_remaining::int AS n FROM stock_lots WHERE id=$1', [lot])).n, 9)
      assert.equal((await one("SELECT details->>'reason' AS reason FROM system_logs WHERE actor_id=$1 AND action='staff.order_returned' ORDER BY id DESC LIMIT 1", [ids.users[1]])).reason, 'Customer declined remaining dishes')
      assert.equal((await request(0, '/staff/order-items/' + itemId + '/serve', { quantity: 1, requestId: prefix + '-after-return' })).status, 409)
      assert.equal((await request(1, '/staff/orders/' + active + '/return', { reason: 'retry' })).status, 409)
      assert.equal((await request(2, '/cashier/table-sessions/' + session + '/checkout', { paymentMethod: 'cash', cashReceived: 0 }, 'POST')).status, 200)
      assert.equal((await request(2, '/cashier/table-sessions/' + session + '/checkout', { paymentMethod: 'cash', cashReceived: 0 }, 'POST')).status, 409)
      assert.equal((await one('SELECT count(*)::int AS n FROM cashier_payments WHERE table_session_id=$1', [session])).n, 1)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    // Delete only fixtures created by this test, in foreign-key order.
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM order_item_serving_events WHERE served_by = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM stock_movements WHERE order_id = ANY($1::bigint[])', [ids.orders])
    await pool.query('DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=ANY($1::bigint[]))', [ids.orders])
    await pool.query('DELETE FROM order_item_bom WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=ANY($1::bigint[]))', [ids.orders])
    await pool.query('DELETE FROM order_items WHERE order_id=ANY($1::bigint[])', [ids.orders])
    await pool.query('DELETE FROM orders WHERE id=ANY($1::bigint[])', [ids.orders])
    if (session) { await pool.query('DELETE FROM cashier_payments WHERE table_session_id=$1', [session]); await pool.query('DELETE FROM table_sessions WHERE id=$1', [session]) }
    if (table) await pool.query('DELETE FROM dining_tables WHERE id=$1', [table])
    if (menu) await pool.query('DELETE FROM menu_items WHERE id=$1', [menu])
    if (header) { await pool.query('DELETE FROM stock_lots WHERE lot_header_id=$1', [header]); await pool.query('DELETE FROM lot_headers WHERE id=$1', [header]) }
    await pool.query('DELETE FROM ingredients WHERE id=ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id=ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
