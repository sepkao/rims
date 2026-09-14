import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Stock movement history and system logs filter real rows correctly', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-history-' + Date.now()
  const ids = { users: [], ingredients: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const ingredientId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'meat',0.1) RETURNING id", [prefix])).id
    ids.ingredients.push(ingredientId)
    const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    ids.headerId = header
    const lot = (await one(
      "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,5,5,10,now()+interval '1 day' FROM storage_locations WHERE name='Freezer' RETURNING id",
      [header, ingredientId],
    )).id
    ids.lotId = lot
    // A recent intake movement, and one deliberately backdated outside the default 30-day window.
    await pool.query("INSERT INTO stock_movements(stock_lot_id,movement_type,quantity,actor_id) VALUES($1,'intake',5,$2)", [lot, ids.users[0]])
    await pool.query("INSERT INTO stock_movements(stock_lot_id,movement_type,quantity,actor_id,created_at) VALUES($1,'adjustment',-1,$2,now()-interval '40 days')", [lot, ids.users[0]])

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
    const movements = (query) => fetch(base + '/owner/stock-movements' + query, { headers: { Cookie: cookie } }).then((r) => r.json())

    await t.test('the default 30-day window excludes an older movement, and includes the recent one', async () => {
      const { movements: rows } = await movements('?search=' + prefix)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].movementType, 'intake')
    })

    await t.test('a wider days window picks up the older movement too', async () => {
      const { movements: rows } = await movements('?search=' + prefix + '&days=60')
      assert.equal(rows.length, 2)
      assert.equal(rows[0].movementType, 'intake') // newest first
      assert.equal(rows[1].movementType, 'adjustment')
    })

    await t.test('the type filter narrows to only that movement type', async () => {
      const { movements: rows } = await movements('?search=' + prefix + '&days=60&type=adjustment')
      assert.equal(rows.length, 1)
      assert.equal(rows[0].movementType, 'adjustment')
    })

    await t.test('system-logs returns the most recent entries first and respects the limit', async () => {
      await pool.query("INSERT INTO system_logs(actor_id,action,details) VALUES($1,'test.marker_a','{}')", [ids.users[0]])
      await pool.query("INSERT INTO system_logs(actor_id,action,details) VALUES($1,'test.marker_b','{}')", [ids.users[0]])
      const { logs } = await (await fetch(base + '/owner/system-logs?limit=1', { headers: { Cookie: cookie } })).json()
      assert.equal(logs.length, 1)
      assert.equal(logs[0].action, 'test.marker_b')
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM stock_movements WHERE stock_lot_id = $1', [ids.lotId ?? -1])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
