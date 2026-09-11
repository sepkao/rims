import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'

// Dedicated PostgreSQL test database only; never falls back to application DATABASE_URL.
const url = process.env.TEST_DATABASE_URL
test('expiry preserves checkout and confirmation serializes with session closure', { skip: !url }, async () => {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 })
  const schema = `rims_lifecycle_${process.pid}_${Date.now()}`
  const a = await pool.connect()
  const b = await pool.connect()
  try {
    await a.query(`CREATE SCHEMA ${schema}`)
    for (const client of [a, b]) await client.query(`SET search_path TO ${schema}`)
    await a.query(`
      CREATE TABLE dining_tables(id bigint PRIMARY KEY, status text);
      CREATE TABLE table_sessions(id bigint PRIMARY KEY, dining_table_id bigint,
        ended_at timestamptz, expires_at timestamptz);
      CREATE TABLE orders(id bigint PRIMARY KEY, table_session_id bigint, status text,
        confirm_at timestamptz, confirmed_at timestamptz, cancelled_at timestamptz);
      CREATE TABLE order_items(id bigint, order_id bigint, quantity int);
      CREATE TABLE order_item_bom(order_item_id bigint, ingredient_id bigint, quantity_required_plates int);
      CREATE TABLE order_item_customizations(order_item_id bigint, ingredient_id bigint);
      CREATE TABLE deductions(order_id bigint);
      CREATE FUNCTION deduct_stock_fifo(bigint, integer, bigint, bigint) RETURNS boolean AS
        'INSERT INTO deductions VALUES ($3); SELECT true' LANGUAGE sql;
      INSERT INTO dining_tables VALUES (1, 'occupied');
      INSERT INTO table_sessions VALUES (1, 1, NULL, now() - interval '2 minutes');
      INSERT INTO orders VALUES (1, 1, 'confirmed', now(), now(), NULL),
        (2, 1, 'pending', now() - interval '1 minute', NULL, NULL);
    `)
    await a.query(await readFile(new URL('../../../supabase/migrations/0020_session_checkout_locking.sql', import.meta.url), 'utf8'))
    await a.query('SELECT expire_table_sessions()')
    assert.equal((await a.query('SELECT ended_at FROM table_sessions')).rows[0].ended_at, null)
    assert.equal((await a.query('SELECT status FROM dining_tables')).rows[0].status, 'expired')
    assert.deepEqual((await a.query('SELECT status FROM orders ORDER BY id')).rows.map(r => r.status), ['confirmed', 'cancelled'])
    await a.query("UPDATE table_sessions SET expires_at = now() + interval '1 hour'")
    await a.query("UPDATE orders SET status = 'pending' WHERE id = 2")
    await a.query('INSERT INTO order_items VALUES (2, 2, 1); INSERT INTO order_item_bom VALUES (2, 1, 1)')

    // Checkout wins: hold its session lock, then launch confirmation concurrently.
    await a.query('BEGIN')
    await a.query('SELECT id FROM table_sessions WHERE id = 1 FOR UPDATE')
    const backendPid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const confirmation = b.query('SELECT auto_confirm_order(2) AS confirmed')
    const deadline = Date.now() + 5000
    let blocked = false
    while (Date.now() < deadline) {
      blocked = (await a.query('SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked', [backendPid])).rows[0].blocked
      if (blocked) break
    }
    if (!blocked) {
      await a.query('ROLLBACK')
      await confirmation
      assert.fail('confirmation did not wait for the checkout session lock')
    }
    await a.query('UPDATE table_sessions SET ended_at = now() WHERE id = 1')
    await a.query('COMMIT')
    assert.equal((await confirmation).rows[0].confirmed, false)
    assert.equal((await a.query('SELECT count(*)::int AS n FROM deductions')).rows[0].n, 0)

    // Confirmation wins: a later checkout sees confirmed work, and retry never deducts twice.
    await a.query('UPDATE table_sessions SET ended_at = NULL WHERE id = 1')
    await a.query("UPDATE orders SET status = 'pending' WHERE id = 2")
    assert.equal((await a.query('SELECT auto_confirm_order(2) AS ok')).rows[0].ok, true)
    assert.equal((await b.query('SELECT auto_confirm_order(2) AS ok')).rows[0].ok, false)
    assert.equal((await a.query('SELECT count(*)::int AS n FROM deductions')).rows[0].n, 1)
  } finally {
    await a.query('ROLLBACK')
    await b.query('RESET search_path')
    await a.query('RESET search_path')
    await a.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    a.release()
    b.release()
    await pool.end()
  }
})
