import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// The existing inventory-intake.test.ts only exercises convertInventoryIntakeLine
// against a fully mocked pg client. This runs the real /inventory/lots endpoint
// against a real Postgres to prove the SQL itself is correct, not just the math.
test('Intake (/inventory/lots) writes real lot_headers/stock_lots/stock_movements rows', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-intake-' + Date.now()
  const ids = { users: [], ingredients: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,\'staff\') RETURNING id',
      [prefix + '-staff', prefix + '-staff@example.test', await bcrypt.hash('test-password', 4)],
    )).id)
    const vegId = (await one(
      "INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'vegetable',0.5) RETURNING id",
      [prefix + '-veg'],
    )).id
    ids.ingredients.push(vegId)

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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + '-staff@example.test', password: 'test-password' }),
    })).headers.get('set-cookie').split(';')[0]
    const intake = (body) => fetch(base + '/inventory/lots', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const headerCount = () => pool.query('SELECT count(*)::int AS n FROM lot_headers WHERE received_by = $1', [ids.users[0]]).then((r) => r.rows[0].n)

    await t.test('unauthenticated intake is rejected', async () => {
      assert.equal((await fetch(base + '/inventory/lots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401)
    })

    await t.test('an expiry date on or before the received date is rejected and nothing is written', async () => {
      const before = await headerCount()
      const response = await intake({
        reference: prefix + '-bad', receivedAt: '2026-01-10',
        items: [{ ingredientId: vegId, quantity: 5, unit: 'kg', expiryDate: '2026-01-10', unitCost: 40 }],
      })
      assert.equal(response.status, 400)
      assert.equal(await headerCount(), before)
    })

    await t.test('an unregistered ingredient is rejected and nothing is written', async () => {
      const before = await headerCount()
      const response = await intake({
        reference: prefix + '-bad2', receivedAt: '2026-01-10',
        items: [{ ingredientId: '999999999', quantity: 5, unit: 'kg', expiryDate: '2026-01-15', unitCost: 40 }],
      })
      assert.equal(response.status, 400)
      assert.equal(await headerCount(), before)
    })

    await t.test('a real vegetable intake converts kg to whole plates and records real rows', async () => {
      const response = await intake({
        reference: prefix + '-ok', receivedAt: '2026-01-10',
        items: [{ ingredientId: vegId, quantity: 5, unit: 'kg', expiryDate: '2026-01-15', unitCost: 40 }],
      })
      assert.equal(response.status, 201)
      const { id: headerId, lotIds } = await response.json()
      ids.headerId = headerId
      ids.lotId = lotIds[0]

      // 5kg / 0.5kg-per-plate = 10 plates; cost per plate = 40 * 0.5 = 20
      const lot = await one('SELECT quantity_remaining::float8 AS qty, unit_cost::float8 AS cost FROM stock_lots WHERE id = $1', [lotIds[0]])
      assert.equal(lot.qty, 10)
      assert.equal(lot.cost, 20)
      const movement = await one("SELECT quantity::float8 AS qty FROM stock_movements WHERE stock_lot_id = $1 AND movement_type = 'intake'", [lotIds[0]])
      assert.equal(movement.qty, 10)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    if (ids.lotId) await pool.query('DELETE FROM stock_movements WHERE stock_lot_id = $1', [ids.lotId])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
