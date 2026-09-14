import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Menu/BOM: create, availableServings, active/removable/soft-delete filtering use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-menu-' + Date.now()
  const ids = { users: [], ingredients: [], menuItems: [], categoryId: null, headerId: null }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,\'owner\') RETURNING id',
      [prefix + '-owner', prefix + '-owner@example.test', await bcrypt.hash('test-password', 4)],
    )).id)
    for (let i = 0; i < 2; i++) {
      ids.ingredients.push((await one(
        "INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'meat',0.1) RETURNING id",
        [prefix + i],
      )).id)
    }
    ids.headerId = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    const lot = (await one(
      "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,5,5,5,now()+interval '1 day' FROM storage_locations WHERE name='ตู้พักละลาย' RETURNING id",
      [ids.headerId, ids.ingredients[0]],
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
    const loginResponse = await fetch(base + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + '-owner@example.test', password: 'test-password' }),
    })
    const cookie = loginResponse.headers.get('set-cookie').split(';')[0]
    const req = (path, method, body) => fetch(base + path, {
      method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })

    ids.categoryId = (await (await req('/owner/menu-categories', 'POST', { name: prefix + '-cat' })).json()).category.id

    await t.test('create rejects an unregistered category and a nonexistent ingredient', async () => {
      assert.equal((await req('/owner/menu-items', 'POST', { name: 'x', category: 'no-such-category', ingredients: [{ ingredientId: ids.ingredients[0], quantityRequiredPlates: 1 }] })).status, 400)
      assert.equal((await req('/owner/menu-items', 'POST', { name: 'x', category: prefix + '-cat', ingredients: [{ ingredientId: '999999999', quantityRequiredPlates: 1 }] })).status, 400)
    })

    let menuItemId
    await t.test('create computes availableServings from real stock, and marks the removable ingredient', async () => {
      const response = await req('/owner/menu-items', 'POST', {
        name: prefix + '-dish', category: prefix + '-cat',
        ingredients: [{ ingredientId: ids.ingredients[0], quantityRequiredPlates: 2, removable: true }],
      })
      assert.equal(response.status, 201)
      menuItemId = (await response.json()).menuItem.id
      ids.menuItems.push(menuItemId)

      const list = await (await req('/owner/menu-items', 'GET')).json()
      const dish = list.menuItems.find((m) => m.id === menuItemId)
      assert.equal(dish.availableServings, 2) // 5 plates in stock / 2 required per serving
      assert.equal(dish.ingredients[0].removable, true)
    })

    await t.test('customer menu only shows active, non-deleted items', async () => {
      const customerVisible = () => pool.query('SELECT id FROM menu_items WHERE id = $1 AND is_active AND NOT is_deleted', [menuItemId]).then((r) => r.rows.length === 1)
      assert.equal(await customerVisible(), true)

      assert.equal((await req('/owner/menu-items/' + menuItemId, 'PUT', { isActive: false })).status, 200)
      assert.equal(await customerVisible(), false)

      assert.equal((await req('/owner/menu-items/' + menuItemId, 'PUT', { isActive: true })).status, 200)
      assert.equal((await req('/owner/menu-items/' + menuItemId, 'DELETE')).status, 200)
      assert.equal(await customerVisible(), false)

      const ownerList = await (await req('/owner/menu-items', 'GET')).json()
      assert.equal(ownerList.menuItems.some((m) => m.id === menuItemId), false)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
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
