import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Waste record confirm/reject writes real stock changes, or none at all', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-waste-' + Date.now()
  const ids = { users: [], ingredients: [], records: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const ingredientId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'meat',0.1) RETURNING id", [prefix])).id
    ids.ingredients.push(ingredientId)
    const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    ids.headerId = header

    const makePendingRecord = async () => {
      const lot = (await one(
        "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,3,3,10,now()+interval '1 day' FROM storage_locations WHERE name='Freezer' RETURNING id",
        [header, ingredientId],
      )).id
      const record = (await one(
        "INSERT INTO waste_records(stock_lot_id,quantity,unit_cost_snapshot,waste_cost,status) VALUES($1,3,10,30,'pending_review') RETURNING id",
        [lot],
      )).id
      ids.records.push({ lot, record })
      return { lot, record }
    }

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
    const review = (recordId, status) => fetch(base + '/owner/waste-records/' + recordId, {
      method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })

    await t.test('confirming a waste record zeroes the lot, marks it not-fresh, and logs an adjustment', async () => {
      const { lot, record } = await makePendingRecord()
      assert.equal((await review(record, 'confirmed')).status, 200)
      const after = await one('SELECT quantity_remaining::float8 AS qty, is_not_fresh AS fresh FROM stock_lots WHERE id = $1', [lot])
      assert.equal(after.qty, 0)
      assert.equal(after.fresh, true)
      const movement = await one("SELECT quantity::float8 AS qty FROM stock_movements WHERE stock_lot_id = $1 AND movement_type = 'adjustment'", [lot])
      assert.equal(movement.qty, -3)
    })

    await t.test('rejecting a waste record leaves the lot completely untouched', async () => {
      const { lot, record } = await makePendingRecord()
      assert.equal((await review(record, 'rejected')).status, 200)
      const after = await one('SELECT quantity_remaining::float8 AS qty, is_not_fresh AS fresh FROM stock_lots WHERE id = $1', [lot])
      assert.equal(after.qty, 3)
      assert.equal(after.fresh, false)
      assert.equal((await one("SELECT status FROM waste_records WHERE id = $1", [record])).status, 'rejected')
    })

    await t.test('a record already reviewed cannot be reviewed again', async () => {
      const { record } = await makePendingRecord()
      await review(record, 'confirmed')
      assert.equal((await review(record, 'rejected')).status, 409)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    const lots = ids.records.map((r) => r.lot)
    await pool.query('DELETE FROM stock_movements WHERE stock_lot_id = ANY($1::bigint[])', [lots])
    await pool.query('DELETE FROM waste_records WHERE stock_lot_id = ANY($1::bigint[])', [lots])
    await pool.query('DELETE FROM stock_lots WHERE id = ANY($1::bigint[])', [lots])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
