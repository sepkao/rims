import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// availableServings is derived live from current Prep stock on every request
// (no cache), which is what makes polling it actually show real-time changes.
// This proves that by mutating stock between polls and re-checking the value.
test('AvailableServings recomputes live on each poll as Prep stock changes', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-servings-' + Date.now()
  const ids = { users: [], ingredients: [], menuItems: [], categoryId: null, headerId: null }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  let menuItemId
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [prefix + '-owner', prefix + '-owner@example.test', await bcrypt.hash('test-password', 4)])).id)
    const ingredientId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'vegetable',0.2) RETURNING id", [prefix])).id
    ids.ingredients.push(ingredientId)
    ids.headerId = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    const lot = (await one(
      "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,3,3,5,now()+interval '1 day' FROM storage_locations WHERE name='ตู้พักละลาย' RETURNING id",
      [ids.headerId, ingredientId],
    )).id
    ids.lotId = lot

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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + '-owner@example.test', password: 'test-password' }),
    })).headers.get('set-cookie').split(';')[0]
    const req = (path, method, body) => fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const pollServings = async () => {
      const list = await (await req('/owner/menu-items', 'GET')).json()
      return list.menuItems.find((m) => m.id === menuItemId).availableServings
    }

    ids.categoryId = (await (await req('/owner/menu-categories', 'POST', { name: prefix + '-cat' })).json()).category.id
    menuItemId = (await (await req('/owner/menu-items', 'POST', {
      name: prefix + '-dish', category: prefix + '-cat',
      ingredients: [{ ingredientId, quantityRequiredPlates: 1 }],
    })).json()).menuItem.id
    ids.menuItems.push(menuItemId)

    await t.test('first poll reflects the stock on hand', async () => {
      assert.equal(await pollServings(), 3)
    })

    await t.test('a real order confirmation deducts stock, and the next poll reflects it immediately', async () => {
      const table = (await one("INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id", [prefix])).id
      ids.table = table
      const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, prefix, ids.users[0]])).id
      ids.session = session
      const order = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()-interval '1 minute') RETURNING id", [session])).id
      ids.order = order
      const item = (await one('INSERT INTO order_items(order_id,menu_item_id,quantity) VALUES($1,$2,2) RETURNING id', [order, menuItemId])).id
      await pool.query('INSERT INTO order_item_bom VALUES($1,$2,1,false)', [item, ingredientId])
      assert.equal((await one('SELECT auto_confirm_order($1) AS ok', [order])).ok, true)
      assert.equal(await pollServings(), 1) // 3 plates - 2 servings * 1 plate each
    })

    await t.test('new stock arriving is reflected on the next poll too', async () => {
      await pool.query('UPDATE stock_lots SET quantity_remaining = quantity_remaining + 4 WHERE id = $1', [ids.lotId])
      assert.equal(await pollServings(), 5)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    if (ids.order) {
      await pool.query('DELETE FROM stock_movements WHERE order_id = $1', [ids.order])
      await pool.query('DELETE FROM order_item_bom WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [ids.order])
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [ids.order])
      await pool.query('DELETE FROM orders WHERE id = $1', [ids.order])
    }
    if (ids.session) await pool.query('DELETE FROM table_sessions WHERE id = $1', [ids.session])
    if (ids.table) await pool.query('DELETE FROM dining_tables WHERE id = $1', [ids.table])
    await pool.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = ANY($1::bigint[])', [ids.menuItems])
    await pool.query('DELETE FROM menu_items WHERE id = ANY($1::bigint[])', [ids.menuItems])
    if (ids.categoryId) await pool.query('DELETE FROM menu_categories WHERE id = $1', [ids.categoryId])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
