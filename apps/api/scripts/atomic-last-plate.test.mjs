import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// order-flow.test.mjs already proves the stock lock blocks a second confirm
// while stock is plentiful (10 -> 7 left). This targets the exact zero
// boundary instead: only ONE plate exists, two orders race for it at the
// same instant (fired concurrently, not sequentially) - exactly one must
// win, the other must fail cleanly, and the lot must land at exactly 0,
// never negative.
test('Atomic FIFO: two orders racing for the last plate never oversell', { skip: !process.env.TEST_DATABASE_URL, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-lastplate-' + Date.now()
  const ids = { users: [], ingredients: [], menuItems: [], tables: [], sessions: [], orders: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)
    const ingredientId = (await one("INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'vegetable',1) RETURNING id", [prefix])).id
    ids.ingredients.push(ingredientId)
    const menuId = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix])).id
    ids.menuItems.push(menuId)
    const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [ids.users[0]])).id
    ids.headerId = header
    const lot = (await one(
      "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,1,1,5,now()+interval '1 day' FROM storage_locations WHERE name='ตู้พักละลาย' RETURNING id",
      [header, ingredientId],
    )).id
    ids.lotId = lot

    const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [prefix])).id
    ids.tables.push(table)
    const session = (await one("INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,expires_at,adult_count) VALUES($1,$2,$3,now()+interval '1 hour',1) RETURNING id", [table, prefix, ids.users[0]])).id
    ids.sessions.push(session)

    const makeOrder = async () => {
      const order = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()-interval '1 second') RETURNING id", [session])).id
      const item = (await one('INSERT INTO order_items(order_id,menu_item_id,quantity) VALUES($1,$2,1) RETURNING id', [order, menuId])).id
      await pool.query('INSERT INTO order_item_bom VALUES($1,$2,1,false)', [item, ingredientId])
      ids.orders.push(order)
      return order
    }

    await t.test('exactly one of two orders confirms; the loser fails cleanly; stock lands at exactly 0', async () => {
      const [orderA, orderB] = [await makeOrder(), await makeOrder()]
      const [resultA, resultB] = await Promise.all([
        pool.query('SELECT auto_confirm_order($1) AS ok', [orderA]),
        pool.query('SELECT auto_confirm_order($1) AS ok', [orderB]),
      ])
      const outcomes = [resultA.rows[0].ok, resultB.rows[0].ok].sort()
      assert.deepEqual(outcomes, [false, true])
      assert.equal((await one('SELECT quantity_remaining::int AS n FROM stock_lots WHERE id=$1', [lot])).n, 0)
    })

    await t.test('a third order at true zero stock is rejected too, not just below zero', async () => {
      const orderC = await makeOrder()
      assert.equal((await one('SELECT auto_confirm_order($1) AS ok', [orderC])).ok, false)
      assert.equal((await one('SELECT quantity_remaining::int AS n FROM stock_lots WHERE id=$1', [lot])).n, 0)
    })
  } finally {
    for (const orderId of ids.orders) {
      await pool.query('DELETE FROM stock_movements WHERE order_id = $1', [orderId])
      await pool.query('DELETE FROM order_item_bom WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [orderId])
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId])
    }
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    if (ids.lotId) await pool.query('DELETE FROM stock_lots WHERE id = $1', [ids.lotId])
    if (ids.headerId) await pool.query('DELETE FROM lot_headers WHERE id = $1', [ids.headerId])
    await pool.query('DELETE FROM menu_items WHERE id = ANY($1::bigint[])', [ids.menuItems])
    await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ids.ingredients])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
