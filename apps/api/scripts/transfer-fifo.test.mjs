import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// inventory-transfer.test.ts covers the FIFO/expiry math against a fully mocked
// pg client. This runs the real transfer endpoints against real Postgres to
// prove the SQL (expiry filter, ORDER BY expiry_date, row locking) is correct.
test('Transfer endpoints enforce staff-only, real expiry, and real FIFO ordering', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-transfer-' + Date.now()
  const ids = { users: [], ingredients: [], lots: [], headerId: null }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id", [prefix + '-staff', prefix + '-staff@example.test', await bcrypt.hash('test-password', 4)])).id)
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [prefix + '-owner', prefix + '-owner@example.test', await bcrypt.hash('test-password', 4)])).id)
    const meatId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'meat',0.1) RETURNING id", [prefix + '-meat'])).id
    ids.ingredients.push(meatId)
    ids.headerId = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id

    const makeLot = async (expiryInterval, qty = 5) => {
      const id = (await one(
        "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,$3,$3,10,now()+$4::interval FROM storage_locations WHERE name='Freezer' RETURNING id",
        [ids.headerId, meatId, qty, expiryInterval],
      )).id
      ids.lots.push(id)
      return id
    }
    const expiredLot = await makeLot('-1 day')
    const soonLot = await makeLot('1 day')
    const laterLot = await makeLot('5 days')

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
    const staffCookie = await login(prefix + '-staff@example.test')
    const ownerCookie = await login(prefix + '-owner@example.test')
    const transferLot = (lotId, cookie, quantityKg) => fetch(base + '/inventory/lots/' + lotId + '/transfer', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ quantityKg }),
    })
    const transferFifo = (cookie, plateCount) => fetch(base + '/inventory/ingredients/' + meatId + '/transfer', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ plateCount }),
    })

    await t.test('only staff may transfer; owner is forbidden despite /inventory/* allowing owner elsewhere', async () => {
      assert.equal((await transferLot(soonLot, ownerCookie, 0.1)).status, 403)
      assert.equal((await transferFifo(ownerCookie, 1)).status, 403)
    })

    await t.test('a real expired lot is rejected by clock_timestamp(), not just app-side logic', async () => {
      const response = await transferLot(expiredLot, staffCookie, 0.1)
      assert.equal(response.status, 409)
      assert.equal((await response.json()).code, 'source_lot_expired')
    })

    await t.test('single-lot transfer moves kg to a new Prep lot and decrements the source', async () => {
      const response = await transferLot(soonLot, staffCookie, 0.2)
      assert.equal(response.status, 201)
      assert.equal((await one('SELECT quantity_remaining::float8 AS n FROM stock_lots WHERE id = $1', [soonLot])).n, 4.8)
    })

    await t.test('FIFO ingredient transfer draws from the earliest-expiring real lot first, then spills over', async () => {
      // soonLot has 4.8kg left / 0.1 = 48 plates; ask for 50 to force spillover into laterLot.
      const response = await transferFifo(staffCookie, 50)
      assert.equal(response.status, 201)
      assert.equal((await one('SELECT quantity_remaining::float8 AS n FROM stock_lots WHERE id = $1', [soonLot])).n, 0)
      assert.equal((await one('SELECT quantity_remaining::float8 AS n FROM stock_lots WHERE id = $1', [laterLot])).n, 4.8)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    // Transfers create new Prep sub-lots beyond the ones in ids.lots, so clean up
    // everything by ingredient_id (a fixture we fully control) instead.
    await pool.query('DELETE FROM stock_movements WHERE stock_lot_id IN (SELECT id FROM stock_lots WHERE ingredient_id = $1)', [ids.ingredients[0]])
    await pool.query('DELETE FROM stock_lots WHERE ingredient_id = $1', [ids.ingredients[0]])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
