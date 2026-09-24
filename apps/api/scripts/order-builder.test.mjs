import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// OrderBuilder's "ส่งซ้ำ" (reorder) button just repopulates the cart from a past
// order client-side — no backend call, nothing to integration-test there. What
// IS backend-enforced is real-time stock/BOM validation at submit time, which
// this proves against real Postgres (order-flow.test.mjs already covers what
// happens after confirmation; this covers the submission itself).
test('POST /customer/orders validates cart contents against real BOM and stock at submit time', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-order-' + Date.now()
  const ids = { users: [], ingredients: [], menuItems: [], tables: [], sessions: [], orders: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const ingredientId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'vegetable',1) RETURNING id", [prefix])).id
    ids.ingredients.push(ingredientId)
    const menuId = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix])).id
    ids.menuItems.push(menuId)
    await pool.query('INSERT INTO menu_item_ingredients(menu_item_id,ingredient_id,quantity_required_plates,removable) VALUES($1,$2,1,false)', [menuId, ingredientId])
    const removableMenuId = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix + '-removable-combo'])).id
    ids.menuItems.push(removableMenuId)
    await pool.query('INSERT INTO menu_item_ingredients(menu_item_id,ingredient_id,quantity_required_plates,removable) VALUES($1,$2,1,true)', [removableMenuId, ingredientId])
    const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    ids.headerId = header
    const lot = (await one(
      "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,1,1,5,now()+interval '1 day' FROM storage_locations WHERE name='ตู้พักละลาย' RETURNING id",
      [header, ingredientId],
    )).id
    ids.lotId = lot

    const makeSession = async (expiresInterval) => {
      const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix + ids.tables.length])).id
      ids.tables.push(table)
      const qr = prefix + '-qr-' + ids.tables.length
      const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+$4::interval,1) RETURNING id", [table, qr, ids.users[0], expiresInterval])).id
      ids.sessions.push(session)
      return qr
    }
    const normalQr = await makeSession('1 hour')
    const closingSoonQr = await makeSession('5 minutes')

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
    const submit = (qrCode, items) => fetch(base + '/customer/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode, items }),
    })
    const oneItem = (quantity, removedIngredients = []) => [{ menuItemId: menuId, quantity, removedIngredients }]

    await t.test('ordering closes 10 minutes before the buffet ends, even though the session is not expired yet', async () => {
      const response = await submit(closingSoonQr, oneItem(1))
      assert.equal(response.status, 409)
    })

    await t.test('removing an ingredient that is not marked removable on this menu item is rejected', async () => {
      const response = await submit(normalQr, oneItem(1, [String(ingredientId)]))
      assert.equal(response.status, 400)
    })

    await t.test('removing every ingredient from a combo is rejected', async () => {
      const response = await submit(normalQr, [{ menuItemId: removableMenuId, quantity: 1, removedIngredients: [String(ingredientId)] }])
      assert.equal(response.status, 400)
      assert.equal((await response.json()).error, 'แต่ละเมนูต้องเหลือวัตถุดิบอย่างน้อย 1 รายการ')
    })

    await t.test('insufficient real stock at submit time is rejected even if the menu looked available earlier', async () => {
      const response = await submit(normalQr, oneItem(2)) // only 1 plate in stock
      assert.equal(response.status, 409)
    })

    await t.test('a valid cart creates a real order with matching items and a snapshotted BOM', async () => {
      const response = await submit(normalQr, oneItem(1))
      assert.equal(response.status, 201)
      const { orderId, confirmAt } = await response.json()
      ids.orders.push(orderId)
      const order = await one('SELECT confirm_at FROM orders WHERE id = $1', [orderId])
      const graceSeconds = (new Date(order.confirm_at).getTime() - Date.now()) / 1000
      assert.ok(graceSeconds > 25 && graceSeconds <= 30)
      assert.ok(Math.abs(new Date(confirmAt).getTime() - new Date(order.confirm_at).getTime()) < 1_000)
      const item = await one('SELECT id, quantity FROM order_items WHERE order_id = $1', [orderId])
      assert.equal(item.quantity, 1)
      assert.equal((await one('SELECT count(*)::int AS n FROM order_item_bom WHERE order_item_id = $1', [item.id])).n, 1)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    for (const orderId of ids.orders) {
      await pool.query('DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [orderId])
      await pool.query('DELETE FROM order_item_bom WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [orderId])
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId])
    }
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = ANY($1::bigint[])', [ids.menuItems])
    await pool.query('DELETE FROM menu_items WHERE id = ANY($1::bigint[])', [ids.menuItems])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
