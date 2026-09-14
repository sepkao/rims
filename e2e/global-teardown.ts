import { Pool } from 'pg'
import { E2E_PREFIX } from './global-setup'

async function main() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL })
  const userIds = (await pool.query("SELECT id FROM users WHERE name LIKE $1", [E2E_PREFIX + '%'])).rows.map((r) => r.id)
  const ingredientIds = (await pool.query('SELECT id FROM ingredients WHERE name LIKE $1', [E2E_PREFIX + '%'])).rows.map((r) => r.id)
  const tableIds = (await pool.query('SELECT id FROM dining_tables WHERE table_number LIKE $1', [E2E_PREFIX + '%'])).rows.map((r) => r.id)
  const sessionIds = (await pool.query('SELECT id FROM table_sessions WHERE dining_table_id = ANY($1::bigint[])', [tableIds])).rows.map((r) => r.id)
  const orderIds = (await pool.query('SELECT id FROM orders WHERE table_session_id = ANY($1::bigint[])', [sessionIds])).rows.map((r) => r.id)
  const menuItemIds = (await pool.query("SELECT id FROM menu_items WHERE name LIKE $1", [E2E_PREFIX + '%'])).rows.map((r) => r.id)
  const categoryIds = (await pool.query("SELECT id FROM menu_categories WHERE name LIKE $1", [E2E_PREFIX + '%'])).rows.map((r) => r.id)
  const lotIds = (await pool.query('SELECT id FROM stock_lots WHERE ingredient_id = ANY($1::bigint[])', [ingredientIds])).rows.map((r) => r.id)
  const headerIds = (await pool.query('SELECT lot_header_id FROM stock_lots WHERE id = ANY($1::bigint[])', [lotIds])).rows.map((r) => r.lot_header_id)

  await pool.query('DELETE FROM cashier_payments WHERE table_session_id = ANY($1::bigint[])', [sessionIds])
  await pool.query('DELETE FROM cashier_notifications WHERE table_number = $1', [E2E_PREFIX])
  await pool.query('DELETE FROM order_item_serving_events WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ANY($1::bigint[]))', [orderIds])
  await pool.query('DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ANY($1::bigint[]))', [orderIds])
  await pool.query('DELETE FROM order_item_bom WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ANY($1::bigint[]))', [orderIds])
  await pool.query('DELETE FROM stock_movements WHERE order_id = ANY($1::bigint[]) OR stock_lot_id = ANY($2::bigint[])', [orderIds, lotIds])
  await pool.query('DELETE FROM order_items WHERE order_id = ANY($1::bigint[])', [orderIds])
  await pool.query('DELETE FROM orders WHERE id = ANY($1::bigint[])', [orderIds])
  await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [sessionIds])
  await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [tableIds])
  await pool.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = ANY($1::bigint[])', [menuItemIds])
  await pool.query('DELETE FROM menu_items WHERE id = ANY($1::bigint[])', [menuItemIds])
  await pool.query('DELETE FROM menu_categories WHERE id = ANY($1::bigint[])', [categoryIds])
  await pool.query('DELETE FROM stock_lots WHERE id = ANY($1::bigint[])', [lotIds])
  await pool.query('DELETE FROM lot_headers WHERE id = ANY($1::bigint[])', [headerIds])
  await pool.query('DELETE FROM ingredients WHERE id = ANY($1::bigint[])', [ingredientIds])
  await pool.query('DELETE FROM system_logs WHERE actor_id = ANY($1::bigint[])', [userIds])
  await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds])
  await pool.end()
  console.log('E2E fixtures cleaned up')
}

export default main
