import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// The grace period has two independent time boundaries that can race: an
// order's own 60s confirm_at window, and the table session's expires_at.
// expire_table_sessions() (the cron) sweeps still-pending orders when the
// session expires; auto_confirm_order() ALSO defensively re-checks session
// expiry before confirming, in case the cron hasn't run yet. Both must
// cancel, never confirm, once the session has expired - and neither may
// touch an order that already confirmed before expiry (that's the whole
// point of the grace period: the bill can still be paid after expiry).
test('Grace period: expiry cancels pending orders but never touches confirmed ones', { skip: !process.env.TEST_DATABASE_URL, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-grace-' + Date.now()
  const ids = { users: [], tables: [], sessions: [], orders: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)

    const makeExpiredSession = async () => {
      const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix + ids.tables.length])).id
      ids.tables.push(table)
      const session = (await one(
        "INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,started_at,expires_at,adult_count) VALUES($1,$2,$3,now()-interval '2 hours',now()-interval '1 minute',1) RETURNING id",
        [table, prefix + ids.tables.length, ids.users[0]],
      )).id
      ids.sessions.push(session)
      return { table, session }
    }

    await t.test('a pending order (confirm_at not reached yet) is cancelled once its session has expired', async () => {
      const { session } = await makeExpiredSession()
      const order = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()+interval '30 seconds') RETURNING id", [session])).id
      ids.orders.push(order)
      await pool.query('SELECT expire_table_sessions()')
      assert.equal((await one('SELECT status FROM orders WHERE id = $1', [order])).status, 'cancelled')
    })

    await t.test('auto_confirm_order refuses to confirm into an expired session, even past its own confirm_at', async () => {
      const { session } = await makeExpiredSession()
      const order = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()-interval '1 second') RETURNING id", [session])).id
      ids.orders.push(order)
      assert.equal((await one('SELECT auto_confirm_order($1) AS ok', [order])).ok, false)
      assert.equal((await one('SELECT status FROM orders WHERE id = $1', [order])).status, 'cancelled')
    })

    await t.test('an order already confirmed before expiry is left alone by expire_table_sessions', async () => {
      const { session } = await makeExpiredSession()
      const order = (await one("INSERT INTO orders(table_session_id,confirm_at,status,confirmed_at) VALUES($1,now()-interval '5 minutes','confirmed',now()-interval '5 minutes') RETURNING id", [session])).id
      ids.orders.push(order)
      await pool.query('SELECT expire_table_sessions()')
      assert.equal((await one('SELECT status FROM orders WHERE id = $1', [order])).status, 'confirmed')
    })

    await t.test('expiry marks the table expired and preserves the bill (ended_at stays null)', async () => {
      const { table, session } = await makeExpiredSession()
      await pool.query('SELECT expire_table_sessions()')
      assert.equal((await one('SELECT status FROM dining_tables WHERE id = $1', [table])).status, 'expired')
      assert.equal((await one('SELECT ended_at FROM table_sessions WHERE id = $1', [session])).ended_at, null)
    })
  } finally {
    for (const orderId of ids.orders) await pool.query('DELETE FROM orders WHERE id = $1', [orderId])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
