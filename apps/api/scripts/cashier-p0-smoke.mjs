import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

process.loadEnvFile()

if (!process.argv.includes('--allow-temporary-data')) {
  throw new Error('Refusing to create smoke-test records without --allow-temporary-data')
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from apps/api/.env')

const apiUrl = process.env.P0_API_URL ?? 'http://localhost:3000'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`
const email = `cashier-p0-${suffix}@local.test`
const password = randomBytes(24).toString('base64url')
const tableNumber = `P0-${suffix}`

let userId
let tableId
let sessionId
let orderId
let ingredientId
let menuItemId
let lotHeaderId
let stockLotId

async function request(path, init = {}) {
  const response = await fetch(`${apiUrl}${path}`, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${body.error ?? 'unknown error'}`)
  return { response, body }
}

try {
  await request('/health')
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Cashier P0 Smoke Test', $1, $2, 'cashier') RETURNING id::text`,
    [email, passwordHash],
  )
  userId = user.rows[0].id
  const ingredient = await pool.query(
    `INSERT INTO ingredients (name, category, default_portion_size_kg)
     VALUES ($1, 'vegetable', 0.100) RETURNING id::text`,
    [`P0 ingredient ${suffix}`],
  )
  ingredientId = ingredient.rows[0].id
  const menuItem = await pool.query(
    `INSERT INTO menu_items (name, description)
     VALUES ($1, 'Isolated Cashier P0 smoke-test item') RETURNING id::text`,
    [`P0 menu ${suffix}`],
  )
  menuItemId = menuItem.rows[0].id
  await pool.query(
    `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required_plates, removable)
     VALUES ($1, $2, 1, false)`,
    [menuItemId, ingredientId],
  )
  const lotHeader = await pool.query(
    `INSERT INTO lot_headers (received_by) VALUES ($1) RETURNING id::text`,
    [userId],
  )
  lotHeaderId = lotHeader.rows[0].id
  const stockLot = await pool.query(
    `INSERT INTO stock_lots (
       lot_header_id, ingredient_id, storage_location_id,
       quantity_original, quantity_remaining, unit_cost, expiry_date
     )
     SELECT $1, $2, id, 5, 5, 1, now() + interval '1 day'
     FROM storage_locations WHERE name = 'ตู้พักละลาย'
     RETURNING id::text`,
    [lotHeaderId, ingredientId],
  )
  if (!stockLot.rows[0]) throw new Error('Prep storage location is missing')
  stockLotId = stockLot.rows[0].id
  const table = await pool.query(
    `INSERT INTO dining_tables (table_number, status) VALUES ($1, 'empty') RETURNING id::text`,
    [tableNumber],
  )
  tableId = table.rows[0].id

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = login.response.headers.getSetCookie()[0]?.split(';')[0]
  if (!cookie) throw new Error('Login did not issue a session cookie')

  const opened = await request('/cashier/table-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ diningTableId: tableId, adultCount: 1, childCount: 0, seniorCount: 0, disabledCount: 0 }),
  })
  sessionId = opened.body.tableSession.id
  const qrCode = opened.body.tableSession.qrCode
  if (!qrCode) throw new Error('Cashier check-in did not return a QR token')

  const customerSession = await request(`/customer/session?qr_code=${encodeURIComponent(qrCode)}`)
  if (customerSession.body.session.id !== sessionId || customerSession.body.session.status !== 'active') {
    throw new Error('Customer QR did not resolve to the active cashier session')
  }

  const menu = await request(`/customer/menu-items?qr_code=${encodeURIComponent(qrCode)}`)
  const availableItem = menu.body.menuItems?.find((item) => item.id === menuItemId && Number(item.availableServings) > 0)
  if (!availableItem) throw new Error('Temporary menu item is not available to the customer')

  const order = await request('/customer/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qrCode,
      items: [{ menuItemId: availableItem.id, quantity: 1, removedIngredients: [] }],
    }),
  })
  orderId = order.body.orderId

  const tables = await request('/cashier/dining-tables', { headers: { Cookie: cookie } })
  const testedTable = tables.body.diningTables?.find((entry) => entry.id === tableId)
  if (!testedTable || testedTable.activeSessionId !== sessionId || Number(testedTable.pendingOrders) !== 1) {
    throw new Error('Cashier table list did not expose the customer pending order')
  }

  console.log(JSON.stringify({
    health: true,
    cashier_login: true,
    table_check_in: true,
    qr_customer_session: true,
    customer_order: true,
    cashier_sees_pending_order: true,
  }, null, 2))
} catch (error) {
  console.error(`Cashier P0 smoke test failed: ${error.message}`)
  process.exitCode = 1
} finally {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (orderId) {
      await client.query('DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [orderId])
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
      await client.query('DELETE FROM orders WHERE id = $1 AND status = \'pending\'', [orderId])
    }
    if (sessionId) await client.query('DELETE FROM table_sessions WHERE id = $1', [sessionId])
    if (tableId) await client.query('DELETE FROM dining_tables WHERE id = $1', [tableId])
    if (stockLotId) await client.query('DELETE FROM stock_lots WHERE id = $1', [stockLotId])
    if (menuItemId) await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [menuItemId])
    if (menuItemId) await client.query('DELETE FROM menu_items WHERE id = $1', [menuItemId])
    if (lotHeaderId) await client.query('DELETE FROM lot_headers WHERE id = $1', [lotHeaderId])
    if (ingredientId) await client.query('DELETE FROM ingredients WHERE id = $1', [ingredientId])
    if (userId) await client.query('DELETE FROM users WHERE id = $1', [userId])
    await client.query('COMMIT')
  } catch (cleanupError) {
    await client.query('ROLLBACK')
    console.error(`Smoke-test cleanup failed: ${cleanupError.message}`)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}
