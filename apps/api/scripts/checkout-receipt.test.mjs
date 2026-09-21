import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// cashier-payment.test.ts unit-tests parseCheckoutPayment against a plain
// function call. This runs the real checkout endpoint end-to-end: the bill
// total, an insufficient-cash rejection that must not touch any real row,
// and a real payment that generates a receipt and closes the table.
test('Bill total and checkout write a real receipt and close the table', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-checkout-' + Date.now()
  const ids = { users: [], tables: [], sessions: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix])).id
    ids.tables.push(table)
    const session = (await one(
      `INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count,child_count,price_per_adult,price_per_child,price_per_senior,price_per_disabled)
       VALUES($1,$2,$3,now()+interval '1 hour',2,1,100,50,0,0) RETURNING id`,
      [table, prefix, ids.users[0]],
    )).id
    ids.sessions.push(session)

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
    const checkout = (body) => fetch(base + '/cashier/table-sessions/' + session + '/checkout', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })

    await t.test('the bill total matches adult/child prices times headcount', async () => {
      const response = await fetch(base + '/cashier/table-sessions/' + session + '/bill', { headers: { Cookie: cookie } })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).total, 250) // 2*100 + 1*50
    })

    await t.test('insufficient cash is rejected and leaves the session untouched', async () => {
      const response = await checkout({ paymentMethod: 'cash', cashReceived: 100 })
      assert.equal(response.status, 400)
      assert.equal((await one('SELECT count(*)::int AS n FROM cashier_payments WHERE table_session_id = $1', [session])).n, 0)
      assert.equal((await one('SELECT ended_at FROM table_sessions WHERE id = $1', [session])).ended_at, null)
    })

    await t.test('a real cash payment records the correct change, a receipt number, and closes the table', async () => {
      const response = await checkout({ paymentMethod: 'cash', cashReceived: 300 })
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.match(body.receiptNumber, /^RIMS-\d{8}$/)
      assert.equal(body.payment.changeAmount, 50)
      const payment = await one('SELECT change_amount::float8 AS change, receipt_number AS receipt FROM cashier_payments WHERE table_session_id = $1', [session])
      assert.equal(payment.change, 50)
      assert.equal(payment.receipt, body.receiptNumber)
      assert.equal((await one('SELECT status FROM dining_tables WHERE id = $1', [table])).status, 'pending_cleanup')
      assert.notEqual((await one('SELECT ended_at FROM table_sessions WHERE id = $1', [session])).ended_at, null)
    })

    await t.test('checking out an already-closed session is rejected', async () => {
      assert.equal((await checkout({ paymentMethod: 'cash', cashReceived: 300 })).status, 409)
    })

    // Deltas, not absolute totals: the report sums the whole week across every
    // session in the database, so a fixed expected figure would depend on
    // whatever else ran first.
    await t.test('the weekly report counts a session only once it has been paid', async () => {
      const revenue = async () => Number((await one('SELECT revenue::float8 AS revenue FROM get_weekly_cost_profit_report()')).revenue)
      const before = await revenue()

      const walkoutTable = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix + '-walkout'])).id
      ids.tables.push(walkoutTable)
      const walkout = (await one(
        `INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count,price_per_adult)
         VALUES($1,$2,$3,now()+interval '1 hour',3,100) RETURNING id`,
        [walkoutTable, prefix + '-walkout', ids.users[0]],
      )).id
      ids.sessions.push(walkout)

      assert.equal(await revenue(), before, 'an unpaid session must not be booked as revenue')

      await one(
        `INSERT INTO cashier_payments(table_session_id,cashier_id,payment_method,subtotal,cash_received,change_amount)
         VALUES($1,$2,'cash',300,300,0) RETURNING id`,
        [walkout, ids.users[0]],
      )

      assert.equal(await revenue() - before, 300, 'paying the session must add exactly its billed subtotal')
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [ids.users])
    await pool.query('DELETE FROM cashier_payments WHERE table_session_id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
