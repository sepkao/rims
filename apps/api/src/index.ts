import { serve } from '@hono/node-server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { pool } from './db.js'
import { convertInventoryIntakeLine, type InventoryIntakeConversion } from './inventory-intake.js'
import { InventoryTransferError, transferInventoryIngredientFifo, transferInventoryLot } from './inventory-transfer.js'
import { CashierPaymentError, parseCheckoutPayment } from './cashier-payment.js'

type Role = 'owner' | 'staff' | 'cashier'

type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

const app = new Hono()
const menuImageRoot = resolve(process.cwd(), 'uploads', 'menu')
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  ...(process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
])

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true
  if (allowedOrigins.has(origin)) return true

  const dynamicAllowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (dynamicAllowed.includes(origin)) return true

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { hostname } = new URL(origin)
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
      ) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    return isOriginAllowed(origin) ? origin : null
  },
  credentials: true,
  allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected server error'
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not configured')
  return secret
}

async function getSessionUser(c: Context): Promise<SessionUser | null> {
  const userId = await getSignedCookie(c, sessionSecret(), 'session')
  if (!userId) return null

  const result = await pool.query<SessionUser>(
    `SELECT id::text, name, email, role
     FROM users
     WHERE id = $1 AND is_active = true`,
    [userId],
  )
  return result.rows[0] ?? null
}

async function createSession(c: Context, userId: string) {
  await setSignedCookie(c, 'session', userId, sessionSecret(), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

async function requireRoles(c: Context, next: Next, roles: Role[]) {
  try {
    const user = await getSessionUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    if (!roles.includes(user.role)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
}

app.get('/health', async (c) => {
  try {
    const result = await pool.query('SELECT NOW() AS now')
    return c.json(result.rows[0])
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Database query failed' }, 500)
  }
})

app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>()
    const email = body.email?.trim().toLowerCase()
    if (!email || !body.password) return c.json({ error: 'Email and password are required' }, 400)

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM users
       WHERE lower(email) = $1`,
      [email],
    )
    const user = result.rows[0]
    if (!user?.is_active || !(await bcrypt.compare(body.password, user.password_hash))) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    await createSession(c, String(user.id))

    return c.json({
      user: { id: String(user.id), name: user.name, email: user.email, role: user.role as Role },
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
})

app.get('/auth/bootstrap-status', async (c) => {
  try {
    const result = await pool.query<{ hasUsers: boolean }>('SELECT EXISTS(SELECT 1 FROM users) AS "hasUsers"')
    return c.json({ registrationOpen: !result.rows[0].hasUsers })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to check registration status' }, 500)
  }
})
app.post('/auth/register', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const body = await c.req.json<{ name?: string; email?: string; password?: string }>()
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    if (!name || !email || !password) return c.json({ error: 'Name, email and password are required' }, 400)
    if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

    await client.query('BEGIN')
    transactionStarted = true
    await client.query('SELECT pg_advisory_xact_lock(531009)')
    const status = await client.query<{ hasUsers: boolean }>('SELECT EXISTS(SELECT 1 FROM users) AS "hasUsers"')
    if (status.rows[0].hasUsers) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Initial registration is no longer available' }, 403)
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING id::text, name, email, role`,
      [name, email, passwordHash],
    )
    await client.query('COMMIT')
    transactionStarted = false

    const user = result.rows[0] as SessionUser
    await createSession(c, user.id)
    return c.json({ user }, 201)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: 'Unable to create account' }, 400)
  } finally {
    client.release()
  }
})

app.get('/auth/session', async (c) => {
  try {
    const user = await getSessionUser(c)
    return user ? c.json({ user }) : c.json({ error: 'Unauthorized' }, 401)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
})

app.post('/auth/logout', async (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ message: 'Logged out successfully' })
})

app.use('/owner/*', (c, next) => requireRoles(c, next, ['owner']))
app.use('/inventory/*', (c, next) => requireRoles(c, next, ['owner', 'staff']))
app.use('/cashier/*', (c, next) => requireRoles(c, next, ['cashier']))
app.use('/staff/*', (c, next) => requireRoles(c, next, ['staff']))
app.use('/dev/*', async (c, next) => {
  if (process.env.NODE_ENV === 'production') return c.json({ error: 'Development tools are disabled' }, 404)
  await next()
})

app.get('/staff/orders', async (c) => {
  try {
    const result = await pool.query(`
      SELECT o.id::text,
             dt.table_number AS "tableNumber",
             o.created_at AS "createdAt",
             o.confirmed_at AS "confirmedAt",
             o.acknowledged_at AS "acknowledgedAt",
             json_agg(
               json_build_object(
                 'id', oi.id::text,
                 'name', mi.name,
                 'quantity', oi.quantity,
                 'removedIngredients', COALESCE(customizations.names, '[]'::json)
               ) ORDER BY oi.id
             ) AS items
      FROM orders o
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN dining_tables dt ON dt.id = ts.dining_table_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN LATERAL (
        SELECT json_agg(i.name ORDER BY i.name) AS names
        FROM order_item_customizations oic
        JOIN ingredients i ON i.id = oic.ingredient_id
        WHERE oic.order_item_id = oi.id
      ) customizations ON true
      WHERE o.status = 'confirmed' AND o.served_at IS NULL
      GROUP BY o.id, dt.table_number
      ORDER BY o.confirmed_at ASC, o.id ASC
    `)
    return c.json({ orders: result.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load kitchen orders' }, 500)
  }
})

app.put('/staff/orders/:id/acknowledge', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const result = await pool.query(
      `UPDATE orders
       SET acknowledged_at = now()
       WHERE id = $1 AND status = 'confirmed' AND served_at IS NULL
       RETURNING id::text, acknowledged_at AS "acknowledgedAt"`,
      [c.req.param('id')],
    )
    if (!result.rows[0]) return c.json({ error: 'Active kitchen order not found' }, 404)
    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'staff.order_acknowledged', jsonb_build_object('orderId', $2::bigint))`,
      [actor.id, c.req.param('id')],
    )
    return c.json({ order: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to acknowledge order' }, 500)
  }
})

app.put('/staff/orders/:id/unacknowledge', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const result = await pool.query(
      `UPDATE orders
       SET acknowledged_at = NULL
       WHERE id = $1 AND status = 'confirmed' AND served_at IS NULL
       RETURNING id::text, acknowledged_at AS "acknowledgedAt"`,
      [c.req.param('id')],
    )
    if (!result.rows[0]) return c.json({ error: 'Active kitchen order not found' }, 404)
    return c.json({ order: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to revert order acknowledgement' }, 500)
  }
})

app.put('/staff/orders/acknowledge-all', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const result = await pool.query(
      `UPDATE orders
       SET acknowledged_at = now()
       WHERE status = 'confirmed' AND served_at IS NULL AND acknowledged_at IS NULL
       RETURNING id::text`,
    )
    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'staff.orders_acknowledged_all', jsonb_build_object('count', $2))`,
      [actor.id, result.rowCount],
    )
    return c.json({ updatedCount: result.rowCount })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to acknowledge all orders' }, 500)
  }
})

app.put('/staff/orders/:id/serve', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const result = await pool.query(
      `UPDATE orders
       SET served_at = now()
       WHERE id = $1 AND status = 'confirmed' AND served_at IS NULL
       RETURNING id::text, served_at AS "servedAt"`,
      [c.req.param('id')],
    )
    if (!result.rows[0]) return c.json({ error: 'Active kitchen order not found' }, 404)
    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'staff.order_served', jsonb_build_object('orderId', $2::bigint))`,
      [actor.id, c.req.param('id')],
    )
    return c.json({ order: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to mark order as served' }, 500)
  }
})

app.get('/cashier/dining-tables', async (c) => {
  const result = await pool.query(
    `SELECT dt.id::text, dt.table_number AS "tableNumber",
            CASE
              WHEN ts.id IS NOT NULL AND ts.expires_at <= now() THEN 'expired'
              WHEN ts.id IS NOT NULL AND ts.expires_at <= now() + INTERVAL '5 minutes' THEN 'near_expiry'
              ELSE dt.status
            END AS status,
            ts.id::text AS "activeSessionId",
            ts.started_at AS "startedAt", ts.expires_at AS "expiresAt",
            ts.adult_count AS "adultCount", ts.child_count AS "childCount",
            ts.senior_count AS "seniorCount", ts.disabled_count AS "disabledCount",
            (SELECT COUNT(*) FROM orders o WHERE o.table_session_id = ts.id AND o.status = 'pending') AS "pendingOrders",
            (SELECT COUNT(*) FROM orders o WHERE o.table_session_id = ts.id AND o.status = 'confirmed') AS "confirmedOrders"
     FROM dining_tables dt
     LEFT JOIN table_sessions ts ON ts.dining_table_id = dt.id AND ts.ended_at IS NULL
     ORDER BY dt.table_number`,
  )
  return c.json({ diningTables: result.rows })
})

app.post('/cashier/table-sessions', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const body = await c.req.json<{
      diningTableId?: string
      adultCount?: number
      childCount?: number
      seniorCount?: number
      disabledCount?: number
    }>()
    const diningTableId = body.diningTableId
    const adultCount = Number(body.adultCount ?? 0)
    const childCount = Number(body.childCount ?? 0)
    const seniorCount = Number(body.seniorCount ?? 0)
    const disabledCount = Number(body.disabledCount ?? 0)
    const counts = [adultCount, childCount, seniorCount, disabledCount]
    if (!diningTableId || counts.some((n) => !Number.isInteger(n) || n < 0)) {
      return c.json({ error: 'diningTableId and non-negative integer headcounts are required' }, 400)
    }
    if (counts.every((n) => n === 0)) {
      return c.json({ error: 'At least one guest is required to check in' }, 400)
    }

    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)

    await client.query('BEGIN')
    transactionStarted = true
    const tableResult = await client.query<{ status: string }>(
      `SELECT status FROM dining_tables WHERE id = $1 FOR UPDATE`,
      [diningTableId],
    )
    if (!tableResult.rows[0]) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Table not found' }, 404)
    }
    if (tableResult.rows[0].status !== 'empty') {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'โต๊ะนี้ไม่ว่างหรือยังไม่ได้เก็บโต๊ะ' }, 409)
    }

    const settingsResult = await client.query<{ key: string; value: string }>(
      `SELECT key, value FROM settings
       WHERE key = ANY($1::text[])`,
      [[...BUFFET_PRICE_KEYS, 'qr_duration_minutes']],
    )
    const byKey = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value]))
    const qrDurationMinutes = Number(byKey.qr_duration_minutes ?? 120)

    const qrCode = randomBytes(24).toString('base64url')

    let result
    try {
      result = await client.query(
        `INSERT INTO table_sessions (
           dining_table_id, qr_code, opened_by, expires_at,
           adult_count, child_count, senior_count, disabled_count,
           price_per_adult, price_per_child, price_per_senior, price_per_disabled
         )
         VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id::text, dining_table_id::text AS "diningTableId", qr_code AS "qrCode",
                   started_at AS "startedAt", expires_at AS "expiresAt",
                   adult_count AS "adultCount", child_count AS "childCount",
                   senior_count AS "seniorCount", disabled_count AS "disabledCount"`,
        [
          diningTableId, qrCode, actor.id, qrDurationMinutes,
          adultCount, childCount, seniorCount, disabledCount,
          Number(byKey.buffet_price_adult ?? 0), Number(byKey.buffet_price_child ?? 0),
          Number(byKey.buffet_price_senior ?? 0), Number(byKey.buffet_price_disabled ?? 0),
        ],
      )
    } catch (err: any) {
      if (err.code === '23505' && err.constraint === 'unique_active_table_session') {
         await client.query('ROLLBACK')
         transactionStarted = false
         return c.json({ error: 'โต๊ะนี้ถูกเปิดบิลไปแล้ว (Table is already occupied)' }, 409)
      }
      throw err
    }
    await client.query(`UPDATE dining_tables SET status = 'occupied' WHERE id = $1`, [diningTableId])
    await client.query('COMMIT')
    transactionStarted = false

    return c.json({ tableSession: result.rows[0] }, 201)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

app.post('/cashier/dining-tables/:id/clear', async (c) => {
  try {
    const tableId = c.req.param('id')
    const result = await pool.query(
      `UPDATE dining_tables SET status = 'empty' WHERE id = $1 AND status = 'pending_cleanup' RETURNING id`,
      [tableId]
    )
    if (!result.rows[0]) return c.json({ error: 'Table is not pending cleanup' }, 400)
    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'cashier.table_cleared', jsonb_build_object('diningTableId', $2::bigint))`,
      [(await getSessionUser(c))?.id, tableId],
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to clear table' }, 500)
  }
})

app.get('/cashier/table-sessions/:id/bill', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const sessionRes = await pool.query(
      `SELECT ts.id::text, ts.dining_table_id::text AS "diningTableId", dt.table_number AS "tableNumber",
              ts.adult_count AS "adultCount", ts.child_count AS "childCount",
              ts.senior_count AS "seniorCount", ts.disabled_count AS "disabledCount",
              ts.price_per_adult AS "pricePerAdult", ts.price_per_child AS "pricePerChild",
              ts.price_per_senior AS "pricePerSenior", ts.price_per_disabled AS "pricePerDisabled",
              ts.started_at AS "startedAt", ts.expires_at AS "expiresAt", ts.ended_at AS "endedAt"
       FROM table_sessions ts
       JOIN dining_tables dt ON dt.id = ts.dining_table_id
       WHERE ts.id = $1`,
      [sessionId]
    )
    if (!sessionRes.rows[0]) return c.json({ error: 'Session not found' }, 404)
    const session = sessionRes.rows[0]
    
    const total = 
      Number(session.adultCount) * Number(session.pricePerAdult) +
      Number(session.childCount) * Number(session.pricePerChild) +
      Number(session.seniorCount) * Number(session.pricePerSenior) +
      Number(session.disabledCount) * Number(session.pricePerDisabled)

    const orderItemsRes = await pool.query(
      `SELECT mi.name, SUM(oi.quantity) AS quantity, o.status
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.table_session_id = $1
       GROUP BY mi.id, mi.name, o.status
       ORDER BY o.status, mi.name`,
      [sessionId]
    )

    return c.json({ session, total, items: orderItemsRes.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to load bill' }, 500)
  }
})

app.get('/cashier/table-sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const result = await pool.query(
      `SELECT ts.id::text, ts.dining_table_id::text AS "diningTableId", dt.table_number AS "tableNumber",
              ts.qr_code AS "qrCode", ts.started_at AS "startedAt", ts.expires_at AS "expiresAt", ts.ended_at AS "endedAt",
              ts.adult_count AS "adultCount", ts.child_count AS "childCount",
              ts.senior_count AS "seniorCount", ts.disabled_count AS "disabledCount"
       FROM table_sessions ts
       JOIN dining_tables dt ON dt.id = ts.dining_table_id
       WHERE ts.id = $1`,
      [sessionId]
    )
    if (!result.rows[0]) return c.json({ error: 'Session not found' }, 404)
    return c.json({ tableSession: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to load session' }, 500)
  }
})

app.post('/cashier/table-sessions/:id/regenerate-qr', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const sessionId = c.req.param('id')
    const qrCode = randomBytes(24).toString('base64url')
    
    const result = await pool.query(
      `UPDATE table_sessions SET qr_code = $1 WHERE id = $2 AND ended_at IS NULL RETURNING qr_code AS "qrCode"`,
      [qrCode, sessionId]
    )
    if (!result.rows[0]) return c.json({ error: 'Active session not found' }, 404)
    
    return c.json({ qrCode: result.rows[0].qrCode })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to regenerate QR code' }, 500)
  }
})

app.post('/cashier/table-sessions/:id/checkout', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const sessionId = c.req.param('id')
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    
    const body: unknown = await c.req.json().catch(() => null)

    await client.query('BEGIN')
    transactionStarted = true
    const sessionRes = await client.query<{
      dining_table_id: string
      adult_count: string
      child_count: string
      senior_count: string
      disabled_count: string
      price_per_adult: string
      price_per_child: string
      price_per_senior: string
      price_per_disabled: string
    }>(
      `SELECT dining_table_id, adult_count, child_count, senior_count, disabled_count,
              price_per_adult, price_per_child, price_per_senior, price_per_disabled
       FROM table_sessions WHERE id = $1 AND ended_at IS NULL FOR UPDATE`,
      [sessionId],
    )
    if (!sessionRes.rows[0]) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Session not found or already closed' }, 409)
    }
    const session = sessionRes.rows[0]
    const total =
      Number(session.adult_count) * Number(session.price_per_adult) +
      Number(session.child_count) * Number(session.price_per_child) +
      Number(session.senior_count) * Number(session.price_per_senior) +
      Number(session.disabled_count) * Number(session.price_per_disabled)
    let payment
    try {
      payment = parseCheckoutPayment(body, total)
    } catch (error) {
      await client.query('ROLLBACK')
      transactionStarted = false
      if (error instanceof CashierPaymentError) return c.json({ error: error.message }, 400)
      throw error
    }

    const paymentResult = await client.query<{ id: string }>(
      `INSERT INTO cashier_payments (
         table_session_id, cashier_id, payment_method, subtotal, cash_received,
         change_amount, payment_reference
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [sessionId, actor.id, payment.paymentMethod, total, payment.cashReceived, payment.changeAmount, payment.paymentReference],
    )
    const receiptNumber = `RIMS-${String(paymentResult.rows[0].id).padStart(8, '0')}`
    await client.query(`UPDATE cashier_payments SET receipt_number = $1 WHERE id = $2`, [receiptNumber, paymentResult.rows[0].id])

    await client.query(
      `UPDATE table_sessions SET ended_at = now(), ended_by = $1 WHERE id = $2`,
      [actor.id, sessionId],
    )

    // Cancel pending orders
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE table_session_id = $1 AND status = 'pending'`,
      [sessionId]
    )

    await client.query(
      `UPDATE dining_tables SET status = 'pending_cleanup' WHERE id = $1`,
      [session.dining_table_id]
    )

    await client.query(
      `INSERT INTO system_logs (actor_id, action, details) VALUES ($1, $2, $3)`,
      [actor.id, 'cashier.checkout', JSON.stringify({
        tableSessionId: sessionId,
        receiptNumber,
        paymentMethod: payment.paymentMethod,
        subtotal: total,
        cashReceived: payment.cashReceived,
        changeAmount: payment.changeAmount,
        paymentReference: payment.paymentReference,
      })]
    )

    await client.query('COMMIT')
    transactionStarted = false
    return c.json({ success: true, receiptNumber, payment: { ...payment, subtotal: total, status: 'manually_confirmed' } })
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: 'Failed to check out' }, 500)
  } finally {
    client.release()
  }
})

app.get('/owner/users', async (c) => {
  const result = await pool.query(
    `SELECT id::text, name, email, role, is_active AS "isActive", created_at AS "createdAt"
     FROM users
     ORDER BY created_at DESC`,
  )
  return c.json({ users: result.rows })
})

app.post('/owner/users', async (c) => {
  try {
    const body = await c.req.json<{ name?: string; email?: string; password?: string; role?: Role }>()
    if (!body.name?.trim() || !body.email?.trim() || !body.password) {
      return c.json({ error: 'Name, email and password are required' }, 400)
    }
    if (body.role !== 'staff' && body.role !== 'cashier') {
      return c.json({ error: 'Role must be staff or cashier' }, 400)
    }

    const actor = await getSessionUser(c)
    const passwordHash = await bcrypt.hash(body.password, 10)
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, created_by)
       VALUES ($1, lower($2), $3, $4, $5)
       RETURNING id::text, name, email, role, is_active AS "isActive", created_at AS "createdAt"`,
      [body.name.trim(), body.email.trim(), passwordHash, body.role, actor?.id],
    )
    return c.json({ user: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.put('/owner/users/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{
      name?: string
      email?: string
      password?: string
      role?: Role
      isActive?: boolean
    }>()
    if (body.role && body.role !== 'staff' && body.role !== 'cashier') {
      return c.json({ error: 'Role must be staff or cashier' }, 400)
    }

    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE(lower($2), email),
           password_hash = COALESCE($3, password_hash),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING id::text, name, email, role, is_active AS "isActive", created_at AS "createdAt"`,
      [body.name?.trim() || null, body.email?.trim() || null, passwordHash, body.role ?? null, body.isActive ?? null, id],
    )
    if (!result.rows[0]) return c.json({ error: 'User not found' }, 404)
    return c.json({ user: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.get('/owner/waste-records/summary', async (c) => {
  try {
    // เดือนที่มีข้อมูลจริง (waste_records ที่ confirmed แล้วเท่านั้น) เอาไว้ทำ dropdown เลือกเดือนฝั่ง frontend
    const monthsResult = await pool.query<{ month: string }>(
      `SELECT DISTINCT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month
       FROM waste_records
       WHERE status = 'confirmed'
       ORDER BY month DESC`,
    )
    const availableMonths = monthsResult.rows.map((row) => row.month)

    const requestedMonth = c.req.query('month')
    const isValidMonth = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
    // ถ้าไม่ระบุเดือน (หรือระบุมาไม่ถูกฟอร์แมต) ใช้เดือนล่าสุดที่มีข้อมูลจริงเป็นค่าเริ่มต้น ไม่ใช่เดือนปัจจุบันเสมอไป
    // เพราะเดือนปัจจุบันอาจยังไม่มี waste_records ที่ confirmed เลยสักแถว
    const month = isValidMonth ? requestedMonth : (availableMonths[0] ?? new Date().toISOString().slice(0, 7))

    const summaryResult = await pool.query<{ lossValue: string; itemsForDisposal: string }>(
      `SELECT COALESCE(SUM(waste_cost), 0) AS "lossValue", COUNT(*) AS "itemsForDisposal"
       FROM waste_records
       WHERE status = 'confirmed' AND to_char(date_trunc('month', created_at), 'YYYY-MM') = $1`,
      [month],
    )

    return c.json({
      month,
      availableMonths,
      lossValue: Number(summaryResult.rows[0].lossValue),
      itemsForDisposal: Number(summaryResult.rows[0].itemsForDisposal),
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
})

// รันกฎ rule-based ตรวจของเสีย (flag_waste_candidates() ใน DB — ใกล้หมดอายุ 2 วัน + ไม่มีการเคลื่อนไหว 3 วัน)
// แล้วเติมแถวใหม่เข้า waste_records (status='pending_review') ให้ Owner มาตรวจต่อ — ไม่มี AI จริง เป็น SQL ล้วนๆ ตามที่ล็อกไว้ (รอบ 10)
app.post('/owner/waste-records/scan', async (c) => {
  try {
    const before = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM waste_records WHERE status = 'pending_review'`)
    await pool.query('SELECT flag_waste_candidates()')
    const after = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM waste_records WHERE status = 'pending_review'`)
    return c.json({ newlyFlagged: Number(after.rows[0].count) - Number(before.rows[0].count) })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
})

app.get('/owner/waste-records', async (c) => {
  try {
    const status = c.req.query('status') || 'pending_review'
    const result = await pool.query(
      `SELECT wr.id::text,
              wr.quantity::float8,
              wr.unit_cost_snapshot::float8 AS "unitCostSnapshot",
              wr.waste_cost::float8 AS "wasteCost",
              wr.ai_reason AS "aiReason",
              wr.status,
              wr.created_at AS "createdAt",
              i.name AS "ingredientName",
              loc.name AS "storageName",
              loc.unit_type AS unit,
              sl.expiry_date AS "expiryDate"
       FROM waste_records wr
       JOIN stock_lots sl ON sl.id = wr.stock_lot_id
       JOIN ingredients i ON i.id = sl.ingredient_id
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE wr.status = $1
       ORDER BY wr.created_at ASC`,
      [status],
    )
    return c.json({ wasteRecords: result.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  }
})

app.put('/owner/waste-records/:id', async (c) => {
  const client = await pool.connect()
  try {
    const id = c.req.param('id')
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ status?: 'confirmed' | 'rejected' }>()
    if (body.status !== 'confirmed' && body.status !== 'rejected') {
      return c.json({ error: 'status must be confirmed or rejected' }, 400)
    }

    await client.query('BEGIN')
    // WHERE status='pending_review' กันไม่ให้ตรวจซ้ำแถวที่ถูกตัดสินไปแล้ว (กด confirm/reject ซ้ำ)
    const updated = await client.query<{ stockLotId: string; quantity: string }>(
      `UPDATE waste_records
       SET status = $1, reviewed_by = $2
       WHERE id = $3 AND status = 'pending_review'
       RETURNING stock_lot_id AS "stockLotId", quantity`,
      [body.status, actor.id, id],
    )
    if (!updated.rows[0]) {
      await client.query('ROLLBACK')
      return c.json({ error: 'Waste record not found or already reviewed' }, 409)
    }

    if (body.status === 'confirmed') {
      const { stockLotId, quantity } = updated.rows[0]
      // ยืนยันว่าเป็นของเสียแล้ว = ทิ้งทั้งล็อต ตัด quantity_remaining เหลือ 0 ทันที
      await client.query(`UPDATE stock_lots SET quantity_remaining = 0 WHERE id = $1`, [stockLotId])
      // movement_type ใช้ 'adjustment' (ไม่ใช่ 'deduction') เพราะ 'deduction' ผูกกับการตัดสต็อกจากออเดอร์ลูกค้าเท่านั้น
      // (ใช้คำนวณ COGS ใน get_weekly_cost_profit_report()) — ของเสียไม่ใช่ยอดขาย ต้องแยกกันไม่ให้ปนกัน
      await client.query(
        `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id) VALUES ($1, 'adjustment', $2, $3)`,
        [stockLotId, -Number(quantity), actor.id],
      )
    }

    await client.query('COMMIT')
    return c.json({ message: `Waste record ${body.status}` })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

app.get('/owner/system-logs', async (c) => {
  const requestedLimit = Number(c.req.query('limit') ?? 100)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100
  const result = await pool.query(
    `SELECT sl.id::text,
            sl.created_at AS timestamp,
            sl.action,
            sl.details,
            u.name AS actor
     FROM system_logs sl
     LEFT JOIN users u ON u.id = sl.actor_id
     ORDER BY sl.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return c.json({ logs: result.rows })
})

const BUFFET_PRICE_KEYS = ['buffet_price_adult', 'buffet_price_child', 'buffet_price_senior', 'buffet_price_disabled'] as const

app.get('/owner/settings/buffet-prices', async (c) => {
  const result = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key = ANY($1::text[])`,
    [BUFFET_PRICE_KEYS],
  )
  const byKey = Object.fromEntries(result.rows.map((row) => [row.key, Number(row.value)]))
  return c.json({
    adult: byKey.buffet_price_adult ?? 0,
    child: byKey.buffet_price_child ?? 0,
    senior: byKey.buffet_price_senior ?? 0,
    disabled: byKey.buffet_price_disabled ?? 0,
  })
})

app.put('/owner/settings/buffet-prices', async (c) => {
  try {
    const body = await c.req.json<{ adult?: number; child?: number; senior?: number; disabled?: number }>()
    const entries: Array<[string, number]> = [
      ['buffet_price_adult', Number(body.adult)],
      ['buffet_price_child', Number(body.child)],
      ['buffet_price_senior', Number(body.senior)],
      ['buffet_price_disabled', Number(body.disabled)],
    ]
    for (const [, value] of entries) {
      if (!Number.isFinite(value) || value < 0) {
        return c.json({ error: 'Every buffet price must be zero or a positive number' }, 400)
      }
    }

    for (const [key, value] of entries) {
      await pool.query(
        `UPDATE settings SET value = $1, updated_at = now() WHERE key = $2`,
        [String(value), key],
      )
    }
    return c.json({ adult: entries[0][1], child: entries[1][1], senior: entries[2][1], disabled: entries[3][1] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.get('/menu-items', async (c) => {
  try {
    const result = await pool.query(
      `SELECT mi.id::text,
              mi.name,
              mi.description,
              mi.category,
              CASE WHEN mi.image_path IS NULL THEN NULL ELSE '/menu-images/' || mi.image_path END AS "imagePath",
              mi.is_active AS "isActive",
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'quantityRequiredPlates', mii.quantity_required_plates,
                    'removable', mii.removable,
                    'availablePlates', COALESCE(stock.available_plates, 0)
                  ) ORDER BY i.name
                ) FILTER (WHERE mii.id IS NOT NULL),
                '[]'::json
              ) AS ingredients,
              CASE WHEN COUNT(mii.id) = 0 THEN 0 ELSE COALESCE(MIN(
                FLOOR(COALESCE(stock.available_plates, 0) / NULLIF(mii.quantity_required_plates, 0))
              ), 0) END::int AS "availableServings"
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       LEFT JOIN LATERAL (
         SELECT SUM(sl.quantity_remaining)::float8 AS available_plates
         FROM stock_lots sl
         JOIN storage_locations loc ON loc.id = sl.storage_location_id
         WHERE sl.ingredient_id = mii.ingredient_id
           AND loc.name = 'ตู้พักละลาย'
           AND sl.is_not_fresh = false
           AND sl.expiry_date > now()
       ) stock ON true
       WHERE mi.is_deleted = false
       GROUP BY mi.id
       ORDER BY mi.name`,
    )
    return c.json({ menuItems: result.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load menu items' }, 500)
  }
})

app.get('/owner/menu-categories', async (c) => {
  const result = await pool.query('SELECT id::text, name FROM menu_categories ORDER BY sort_order, name')
  return c.json({ categories: result.rows })
})

app.post('/owner/menu-categories', async (c) => {
  try {
    const actor = await getSessionUser(c)
    const name = (await c.req.json<{ name?: string }>()).name?.trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) return c.json({ error: 'Category name is required and must not exceed 80 characters' }, 400)
    if ((await pool.query('SELECT id FROM menu_categories WHERE lower(name) = lower($1)', [name])).rows[0]) return c.json({ error: 'Category name already exists' }, 409)
    const result = await pool.query('INSERT INTO menu_categories (name) VALUES ($1) RETURNING id::text, name', [name])
    await pool.query(`INSERT INTO system_logs (actor_id, action, details) VALUES ($1, 'menu.category_created', $2::jsonb)`, [actor?.id, JSON.stringify({ categoryId: result.rows[0].id, name })])
    return c.json({ category: result.rows[0] }, 201)
  } catch (error) { console.error(error); return c.json({ error: errorMessage(error) }, 400) }
})

app.put('/owner/menu-categories/:id', async (c) => {
  const client = await pool.connect(); let started = false
  try {
    const actor = await getSessionUser(c)
    const name = (await c.req.json<{ name?: string }>()).name?.trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) return c.json({ error: 'Category name is required and must not exceed 80 characters' }, 400)
    await client.query('BEGIN'); started = true
    const current = await client.query<{ name: string }>('SELECT name FROM menu_categories WHERE id = $1 FOR UPDATE', [c.req.param('id')])
    if (!current.rows[0]) { await client.query('ROLLBACK'); started = false; return c.json({ error: 'Category not found' }, 404) }
    if ((await client.query('SELECT id FROM menu_categories WHERE lower(name) = lower($1) AND id <> $2', [name, c.req.param('id')])).rows[0]) { await client.query('ROLLBACK'); started = false; return c.json({ error: 'Category name already exists' }, 409) }
    await client.query('UPDATE menu_items SET category = $1 WHERE category = $2', [name, current.rows[0].name])
    const result = await client.query('UPDATE menu_categories SET name = $1 WHERE id = $2 RETURNING id::text, name', [name, c.req.param('id')])
    await client.query(`INSERT INTO system_logs (actor_id, action, details) VALUES ($1, 'menu.category_renamed', $2::jsonb)`, [actor?.id, JSON.stringify({ categoryId: c.req.param('id'), previousName: current.rows[0].name, name })])
    await client.query('COMMIT'); started = false
    return c.json({ category: result.rows[0] })
  } catch (error) { if (started) await client.query('ROLLBACK'); console.error(error); return c.json({ error: errorMessage(error) }, 400) } finally { client.release() }
})

app.delete('/owner/menu-categories/:id', async (c) => {
  try {
    const category = await pool.query<{ name: string }>('SELECT name FROM menu_categories WHERE id = $1', [c.req.param('id')])
    if (!category.rows[0]) return c.json({ error: 'Category not found' }, 404)
    if ((await pool.query('SELECT id FROM menu_items WHERE category = $1 AND is_deleted = false LIMIT 1', [category.rows[0].name])).rows[0]) return c.json({ error: 'ย้ายหรือลบเมนูในหมวดนี้ก่อนลบหมวดหมู่' }, 409)
    await pool.query('DELETE FROM menu_categories WHERE id = $1', [c.req.param('id')])
    return c.json({ message: 'Category deleted' })
  } catch (error) { console.error(error); return c.json({ error: errorMessage(error) }, 400) }
})

app.get('/customer/menu-items', async (c) => {
  try {
    const session = await findCustomerSession(c.req.query('qr_code'))
    if (!session) return c.json({ error: 'QR session is invalid, closed, or expired' }, 410)
    const result = await pool.query(
      `SELECT mi.id::text, mi.name, mi.description, mi.category,
              CASE WHEN mi.image_path IS NULL THEN NULL ELSE '/menu-images/' || mi.image_path END AS "imagePath",
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'quantityRequiredPlates', mii.quantity_required_plates,
                    'removable', mii.removable
                  ) ORDER BY i.name
                ) FILTER (WHERE mii.id IS NOT NULL),
                '[]'::json
              ) AS ingredients,
              CASE WHEN COUNT(mii.id) = 0 THEN 0 ELSE COALESCE(MIN(
                FLOOR(COALESCE(stock.available_plates, 0) / NULLIF(mii.quantity_required_plates, 0))
              ), 0) END::int AS "availableServings"
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       LEFT JOIN LATERAL (
         SELECT SUM(sl.quantity_remaining) AS available_plates
         FROM stock_lots sl
         JOIN storage_locations loc ON loc.id = sl.storage_location_id
         WHERE sl.ingredient_id = mii.ingredient_id
           AND loc.name = 'ตู้พักละลาย'
           AND sl.is_not_fresh = false
           AND sl.expiry_date > now()
       ) stock ON true
       WHERE mi.is_active = true AND mi.is_deleted = false
       GROUP BY mi.id
       ORDER BY mi.name`,
    )
    return c.json({ menuItems: result.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load available menu items' }, 500)
  }
})

app.get('/customer/menu-items/:id', async (c) => {
  try {
    const session = await findCustomerSession(c.req.query('qr_code'))
    if (!session) return c.json({ error: 'QR session is invalid, closed, or expired' }, 410)
    const result = await pool.query(
      `SELECT mi.id::text, mi.name, mi.description, mi.category,
              CASE WHEN mi.image_path IS NULL THEN NULL ELSE '/menu-images/' || mi.image_path END AS "imagePath",
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'quantityRequiredPlates', mii.quantity_required_plates,
                    'removable', mii.removable
                  ) ORDER BY i.name
                ) FILTER (WHERE mii.id IS NOT NULL),
                '[]'::json
              ) AS ingredients,
              CASE WHEN COUNT(mii.id) = 0 THEN 0 ELSE COALESCE(MIN(
                FLOOR(COALESCE(stock.available_plates, 0) / NULLIF(mii.quantity_required_plates, 0))
              ), 0) END::int AS "availableServings"
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       LEFT JOIN LATERAL (
         SELECT SUM(sl.quantity_remaining) AS available_plates
         FROM stock_lots sl
         JOIN storage_locations loc ON loc.id = sl.storage_location_id
         WHERE sl.ingredient_id = mii.ingredient_id
           AND loc.name = 'ตู้พักละลาย'
           AND sl.is_not_fresh = false
           AND sl.expiry_date > now()
       ) stock ON true
       WHERE mi.id = $1 AND mi.is_active = true AND mi.is_deleted = false
       GROUP BY mi.id`,
      [c.req.param('id')],
    )
    if (!result.rows[0]) {
      return c.json({ error: 'Menu item not found' }, 404)
    }
    return c.json({ menuItem: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load menu item' }, 500)
  }
})

app.post('/owner/menu-items', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const body = await c.req.json<{
      name?: string
      description?: string
      category?: string
      ingredients?: Array<{ ingredientId?: string; quantityRequiredPlates?: number; removable?: boolean }>
    }>()
    const name = body.name?.trim()
    const category = body.category?.trim()
    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }
    if (!category || category.length > 80) return c.json({ error: 'A valid category is required' }, 400)
    if (!(await pool.query('SELECT id FROM menu_categories WHERE name = $1', [category])).rows[0]) return c.json({ error: 'Menu category is not registered' }, 400)
    const ingredients = body.ingredients ?? []
    if (ingredients.length === 0) return c.json({ error: 'At least one Prep ingredient is required' }, 400)
    const ingredientIds = new Set<string>()
    const lines = ingredients.map((line, index) => {
      const ingredientId = line.ingredientId?.trim()
      const quantity = Number(line.quantityRequiredPlates)
      if (!ingredientId || !/^\d+$/.test(ingredientId) || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(`Ingredient line ${index + 1} is invalid`)
      }
      if (ingredientIds.has(ingredientId)) throw new Error('The same ingredient cannot be selected more than once')
      ingredientIds.add(ingredientId)
      return { ingredientId, quantity, removable: Boolean(line.removable) }
    })

    await client.query('BEGIN')
    transactionStarted = true
    const existing = await client.query<{ id: string }>(
      'SELECT id::text FROM ingredients WHERE id = ANY($1::bigint[])',
      [[...ingredientIds]],
    )
    if (existing.rows.length !== lines.length) throw new Error('One or more ingredients do not exist')

    const result = await client.query(
      `INSERT INTO menu_items (name, description, category)
       VALUES ($1, $2, $3)
       RETURNING id::text, name, description, category, is_active AS "isActive"`,
      [name, body.description?.trim() || null, category],
    )
    const menuItem = result.rows[0]
    for (const line of lines) {
      await client.query(
        `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required_plates, removable)
         VALUES ($1, $2, $3, $4)`,
        [menuItem.id, line.ingredientId, line.quantity, line.removable],
      )
    }
    await client.query('COMMIT')
    transactionStarted = false
    return c.json({ menuItem }, 201)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

app.get('/menu-images/:filename', async (c) => {
  const filename = c.req.param('filename')
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) return c.json({ error: 'Image not found' }, 404)
  try {
    const image = await readFile(join(menuImageRoot, filename))
    const extension = extname(filename).toLowerCase()
    const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
    return new Response(image, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' } })
  } catch {
    return c.json({ error: 'Image not found' }, 404)
  }
})

app.put('/owner/menu-items/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{ name?: string; description?: string; category?: string; isActive?: boolean }>()
    if (body.category && !(await pool.query('SELECT id FROM menu_categories WHERE name = $1', [body.category.trim()])).rows[0]) return c.json({ error: 'Menu category is not registered' }, 400)

    const result = await pool.query(
      `UPDATE menu_items
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           is_active = COALESCE($4, is_active)
       WHERE id = $5 AND is_deleted = false
       RETURNING id::text, name, description, category, is_active AS "isActive"`,
      [body.name?.trim() || null, body.description?.trim() || null, body.category?.trim() || null, body.isActive ?? null, id],
    )
    if (!result.rows[0]) return c.json({ error: 'Menu item not found' }, 404)
    return c.json({ menuItem: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.put('/owner/menu-items/:id/image', async (c) => {
  try {
    const body = await c.req.parseBody()
    const image = body.image
    if (!(image instanceof File)) return c.json({ error: 'An image file is required' }, 400)
    const extensionByType: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
    const extension = extensionByType[image.type]
    if (!extension) return c.json({ error: 'Only JPG, PNG, and WebP images are supported' }, 400)
    if (image.size > 5 * 1024 * 1024) return c.json({ error: 'Image must be 5 MB or smaller' }, 400)

    const filename = `${randomBytes(16).toString('hex')}${extension}`
    await mkdir(menuImageRoot, { recursive: true })
    await writeFile(join(menuImageRoot, filename), Buffer.from(await image.arrayBuffer()))
    const previous = await pool.query<{ imagePath: string | null }>('SELECT image_path AS "imagePath" FROM menu_items WHERE id = $1 AND is_deleted = false', [c.req.param('id')])
    const result = await pool.query(
      `UPDATE menu_items SET image_path = $1, image_alt = COALESCE(NULLIF($2, ''), name)
       WHERE id = $3 AND is_deleted = false RETURNING id::text, '/menu-images/' || image_path AS "imagePath", image_alt AS "imageAlt"`,
      [filename, body.altText ?? '', c.req.param('id')],
    )
    if (!result.rows[0]) {
      await unlink(join(menuImageRoot, filename)).catch(() => undefined)
      return c.json({ error: 'Menu item not found' }, 404)
    }
    if (previous.rows[0]?.imagePath) await unlink(join(menuImageRoot, previous.rows[0].imagePath)).catch(() => undefined)
    return c.json({ image: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.delete('/owner/menu-items/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const deleted = await pool.query(
      `UPDATE menu_items SET is_deleted = true, is_active = false
       WHERE id = $1 AND is_deleted = false RETURNING id`,
      [id],
    )
    if (!deleted.rows[0]) return c.json({ error: 'Menu item not found' }, 404)
    return c.json({ message: 'Menu item archived successfully' })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.post('/owner/menu-items/:id/ingredients', async (c) => {
  try {
    const menuItemId = c.req.param('id')
    const body = await c.req.json<{ ingredientId?: string; quantityRequiredPlates?: number; removable?: boolean }>()
    const quantity = Number(body.quantityRequiredPlates)
    if (!body.ingredientId || !Number.isFinite(quantity) || quantity <= 0) {
      return c.json({ error: 'ingredientId and a positive quantityRequiredPlates are required' }, 400)
    }

    const result = await pool.query(
      `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required_plates, removable)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (menu_item_id, ingredient_id)
       DO UPDATE SET quantity_required_plates = EXCLUDED.quantity_required_plates, removable = EXCLUDED.removable
       RETURNING id::text, menu_item_id::text AS "menuItemId", ingredient_id::text AS "ingredientId",
                 quantity_required_plates AS "quantityRequiredPlates", removable`,
      [menuItemId, body.ingredientId, quantity, Boolean(body.removable)],
    )
    return c.json({ ingredient: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.delete('/owner/menu-items/:id/ingredients/:ingredientId', async (c) => {
  try {
    const { id, ingredientId } = c.req.param()
    const result = await pool.query(
      'DELETE FROM menu_item_ingredients WHERE menu_item_id = $1 AND ingredient_id = $2 RETURNING id',
      [id, ingredientId],
    )
    if (!result.rows[0]) return c.json({ error: 'BOM line not found' }, 404)
    return c.json({ message: 'Ingredient removed from menu item' })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.get('/inventory/ingredients', async (c) => {
  const result = await pool.query(
    `SELECT id::text, name, category,
            default_portion_size_kg::float8 AS "defaultPortionSizeKg",
            thaw_prep_threshold_plates AS "thawPrepThresholdPlates",
            COALESCE(prep.available_plates, 0)::float8 AS "prepAvailablePlates"
     FROM ingredients i
     LEFT JOIN LATERAL (
       SELECT SUM(sl.quantity_remaining) AS available_plates
       FROM stock_lots sl
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE sl.ingredient_id = i.id
         AND loc.name = 'ตู้พักละลาย'
         AND sl.is_not_fresh = false
         AND sl.expiry_date > now()
     ) prep ON true
     ORDER BY i.name`,
  )
  return c.json({ ingredients: result.rows })
})

app.post('/inventory/ingredients', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    const body = await c.req.json<{ name?: string; category?: string }>()
    const name = body.name?.trim().replace(/\s+/g, ' ')
    const category = body.category
    const portionSize = category === 'vegetable' ? 0.05 : 0.1
    if (!name || name.length > 120) return c.json({ error: 'Ingredient name is required and must not exceed 120 characters' }, 400)
    if (category !== 'meat' && category !== 'vegetable') return c.json({ error: 'Category must be meat or vegetable' }, 400)

    const duplicate = await pool.query('SELECT id FROM ingredients WHERE lower(name) = lower($1)', [name])
    if (duplicate.rows[0]) return c.json({ error: 'Ingredient name already exists' }, 409)
    const result = await pool.query(
      `INSERT INTO ingredients (name, category, default_portion_size_kg)
       VALUES ($1, $2, $3)
       RETURNING id::text, name, category, default_portion_size_kg::float8 AS "defaultPortionSizeKg",
                 thaw_prep_threshold_plates AS "thawPrepThresholdPlates", 0::float8 AS "prepAvailablePlates"`,
      [name, category, portionSize],
    )
    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.ingredient_created', $2::jsonb)`,
      [actor.id, JSON.stringify({ ingredientId: result.rows[0].id, name, category, defaultPortionSizeKg: portionSize })],
    )
    return c.json({ ingredient: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.put('/inventory/ingredients/:id/portion-preset', async (c) => {
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    if (actor.role !== 'owner') return c.json({ error: 'Only owners can update portion presets' }, 403)

    const value = Number((await c.req.json<{ defaultPortionSizeKg?: number }>()).defaultPortionSizeKg)
    if (!Number.isFinite(value) || value <= 0 || value > 999.999) {
      return c.json({ error: 'Portion preset must be between 0.001 and 999.999 kg' }, 400)
    }

    const result = await pool.query(
      `UPDATE ingredients
       SET default_portion_size_kg = $1
       WHERE id = $2
       RETURNING id::text, name, category, default_portion_size_kg::float8 AS "defaultPortionSizeKg"`,
      [value, c.req.param('id')],
    )
    if (!result.rows[0]) return c.json({ error: 'Ingredient not found' }, 404)

    await pool.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'ingredient.portion_preset_updated', $2::jsonb)`,
      [actor.id, JSON.stringify({ ingredientId: c.req.param('id'), defaultPortionSizeKg: value })],
    )
    return c.json({ ingredient: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.get('/inventory/lots', async (c) => {
  const result = await pool.query(
    `SELECT sl.id::text,
            sl.ingredient_id::text AS "ingredientId",
            i.name AS item,
            CASE i.category WHEN 'meat' THEN 'Meat' ELSE 'Vegetable' END AS category,
            'LOT-' || lh.id AS batch,
            sl.quantity_remaining::float8 AS quantity,
            loc.unit_type AS unit,
            lh.received_at AS "receivedAt",
            sl.expiry_date AS "expiryDate",
            sl.unit_cost::float8 AS "unitCost",
            (sl.quantity_remaining * sl.unit_cost)::float8 AS "unitValue",
            loc.name AS location,
            CASE
              WHEN sl.is_not_fresh OR sl.expiry_date < now() THEN 'Expired'
              WHEN sl.expiry_date <= now() + interval '3 days' THEN 'Expiring Soon'
              ELSE 'Fresh'
            END AS status
     FROM stock_lots sl
     JOIN ingredients i ON i.id = sl.ingredient_id
     JOIN storage_locations loc ON loc.id = sl.storage_location_id
     JOIN lot_headers lh ON lh.id = sl.lot_header_id
     ORDER BY sl.expiry_date, sl.created_at`,
  )
  return c.json({ lots: result.rows })
})

app.post('/inventory/lots/:id/dispose', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    if (actor.role !== 'owner') {
      return c.json({ error: 'Only owners can dispose expired stock' }, 403)
    }

    const body = await c.req.json<{ reason?: string }>()
    const reason = body.reason?.trim()
    if (!reason) return c.json({ error: 'Disposal reason is required' }, 400)
    if (reason.length > 500) return c.json({ error: 'Disposal reason must not exceed 500 characters' }, 400)

    await client.query('BEGIN')
    transactionStarted = true
    const lotResult = await client.query<{
      id: string
      quantity: number
      unitCost: number
      item: string
      unit: string
    }>(
      `SELECT sl.id::text,
              sl.quantity_remaining::float8 AS quantity,
              sl.unit_cost::float8 AS "unitCost",
              i.name AS item,
              loc.unit_type AS unit
       FROM stock_lots sl
       JOIN ingredients i ON i.id = sl.ingredient_id
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE sl.id = $1
       FOR UPDATE OF sl`,
      [c.req.param('id')],
    )
    const lot = lotResult.rows[0]
    if (!lot) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Stock lot not found' }, 404)
    }
    if (Number(lot.quantity) <= 0) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Stock lot has no remaining quantity' }, 409)
    }

    const expiredResult = await client.query<{ expired: boolean }>(
      `SELECT is_not_fresh OR expiry_date < now() AS expired FROM stock_lots WHERE id = $1`,
      [lot.id],
    )
    if (!expiredResult.rows[0]?.expired) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'Only expired or not-fresh stock can be disposed' }, 409)
    }

    const quantity = Number(lot.quantity)
    const wasteCost = quantity * Number(lot.unitCost)
    await client.query(
      `UPDATE stock_lots SET quantity_remaining = 0, is_not_fresh = true WHERE id = $1`,
      [lot.id],
    )
    await client.query(
      `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
       VALUES ($1, 'adjustment', $2, $3)`,
      [lot.id, -quantity, actor.id],
    )
    const existingWaste = await client.query(
      `UPDATE waste_records
       SET quantity = $2, unit_cost_snapshot = $3, waste_cost = $4,
           ai_reason = $5, status = 'confirmed', reviewed_by = $6
       WHERE id = (
         SELECT id FROM waste_records
         WHERE stock_lot_id = $1 AND status = 'pending_review'
         ORDER BY created_at DESC LIMIT 1
       )
       RETURNING id`,
      [lot.id, quantity, lot.unitCost, wasteCost, reason, actor.id],
    )
    if (!existingWaste.rows[0]) {
      await client.query(
        `INSERT INTO waste_records (
           stock_lot_id, quantity, unit_cost_snapshot, waste_cost, ai_reason, status, reviewed_by
         ) VALUES ($1, $2, $3, $4, $5, 'confirmed', $6)`,
        [lot.id, quantity, lot.unitCost, wasteCost, reason, actor.id],
      )
    }
    await client.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.expired_lot_disposed', $2::jsonb)`,
      [actor.id, JSON.stringify({ lotId: lot.id, item: lot.item, quantity, unit: lot.unit, reason, wasteCost })],
    )
    await client.query('COMMIT')
    transactionStarted = false
    return c.json({ message: 'Expired stock disposed', quantity, unit: lot.unit, wasteCost })
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

app.post('/inventory/lots', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      reference?: string
      receivedAt?: string
      items?: Array<{
        ingredientId?: string
        quantity?: number
        unit?: string
        expiryDate?: string
        unitCost?: number
      }>
    }>()
    const requestedItems = body.items ?? []

    if (!requestedItems.length) return c.json({ error: 'At least one ingredient is required' }, 400)

    const lines = requestedItems.map((requestedItem, index) => {
      const ingredientId = requestedItem.ingredientId?.trim()
      const quantity = Number(requestedItem.quantity)
      const unitCost = Number(requestedItem.unitCost)
      if (!ingredientId || !/^\d+$/.test(ingredientId) || !requestedItem.expiryDate || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Ingredient line ${index + 1} is incomplete`)
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error(`Unit cost for ingredient line ${index + 1} must be zero or greater`)
      }

      const normalizedUnit = requestedItem.unit?.trim().toLowerCase()
      return {
        ingredientId,
        quantity,
        unit: normalizedUnit,
        unitCost,
        expiryDate: requestedItem.expiryDate,
      }
    })

    await client.query('BEGIN')
    transactionStarted = true
    const headerResult = await client.query(
      `INSERT INTO lot_headers (received_at, received_by)
       VALUES (COALESCE($1::timestamptz, now()), $2)
       RETURNING id`,
      [body.receivedAt || null, actor.id],
    )

    const lotIds: string[] = []
    const receivedLines: Array<InventoryIntakeConversion & {
      ingredientId: string
      item: string
      category: 'meat' | 'vegetable'
      storageName: string
    }> = []
    for (const line of lines) {
      const ingredientResult = await client.query<{
        id: string
        name: string
        category: 'meat' | 'vegetable'
        defaultPortionSizeKg: number
      }>(
        `SELECT id::text, name, category,
                default_portion_size_kg::float8 AS "defaultPortionSizeKg"
         FROM ingredients
         WHERE id = $1`,
        [line.ingredientId],
      )
      const ingredient = ingredientResult.rows[0]
      if (!ingredient) throw new Error(`Registered ingredient ${line.ingredientId} was not found`)

      const conversion = convertInventoryIntakeLine({
        ingredientName: ingredient.name,
        category: ingredient.category,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
        defaultPortionSizeKg: Number(ingredient.defaultPortionSizeKg),
      })
      const storageName = ingredient.category === 'meat' ? 'Freezer' : 'ตู้พักละลาย'

      const storageResult = await client.query(`SELECT id FROM storage_locations WHERE name = $1`, [storageName])
      if (!storageResult.rows[0]) throw new Error(`Storage location ${storageName} is missing`)

      const lotResult = await client.query(
        `INSERT INTO stock_lots (
           lot_header_id, ingredient_id, storage_location_id,
           quantity_original, quantity_remaining, unit_cost, expiry_date
         )
         VALUES ($1, $2, $3, $4, $4, $5, $6)
         RETURNING id`,
        [
          headerResult.rows[0].id,
          ingredient.id,
          storageResult.rows[0].id,
          conversion.storedQuantity,
          conversion.storedUnitCost,
          line.expiryDate,
        ],
      )
      const lotId = String(lotResult.rows[0].id)
      lotIds.push(lotId)
      await client.query(
        `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
         VALUES ($1, 'intake', $2, $3)`,
        [lotId, conversion.storedQuantity, actor.id],
      )
      receivedLines.push({
        ingredientId: ingredient.id,
        item: ingredient.name,
        category: ingredient.category,
        ...conversion,
        storageName,
      })
    }

    await client.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.lot_received', $2::jsonb)`,
      [actor.id, JSON.stringify({
        lotHeaderId: String(headerResult.rows[0].id),
        reference: body.reference?.trim() || null,
        lineCount: lines.length,
        lines: receivedLines,
      })],
    )
    await client.query('COMMIT')
    return c.json({ id: String(headerResult.rows[0].id), lotIds }, 201)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

app.post('/inventory/lots/:id/transfer', async (c) => {
  const actor = await getSessionUser(c)
  if (!actor) return c.json({ error: 'Unauthorized' }, 401)
  if (actor.role !== 'staff') {
    return c.json({ error: 'Only staff can transfer stock from Freezer to Prep' }, 403)
  }

  let body: { quantityKg?: number }
  try {
    body = await c.req.json<{ quantityKg?: number }>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const client = await pool.connect()
  try {
    const transfer = await transferInventoryLot(client, {
      lotId: c.req.param('id'),
      quantityKg: Number(body.quantityKg),
      actorId: actor.id,
    })
    return c.json({ transfer }, 201)
  } catch (error) {
    if (error instanceof InventoryTransferError) {
      return c.json({ error: error.message, code: error.code }, error.status)
    }
    console.error(error)
    return c.json({ error: 'Unable to transfer stock lot' }, 500)
  } finally {
    client.release()
  }
})

app.post('/inventory/ingredients/:id/transfer', async (c) => {
  const actor = await getSessionUser(c)
  if (!actor) return c.json({ error: 'Unauthorized' }, 401)
  if (actor.role !== 'staff') {
    return c.json({ error: 'Only staff can transfer stock from Freezer to Prep' }, 403)
  }

  let body: { plateCount?: number }
  try {
    body = await c.req.json<{ plateCount?: number }>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const client = await pool.connect()
  try {
    const transfer = await transferInventoryIngredientFifo(client, {
      ingredientId: c.req.param('id'),
      plateCount: Number(body.plateCount),
      actorId: actor.id,
    })
    return c.json({ transfer }, 201)
  } catch (error) {
    if (error instanceof InventoryTransferError) {
      return c.json({ error: error.message, code: error.code }, error.status)
    }
    console.error(error)
    return c.json({ error: 'Unable to transfer ingredient stock' }, 500)
  } finally {
    client.release()
  }
})


type CustomerSession = {
  id: string
  tableNumber: string
  startedAt: string
  expiresAt: string
  endedAt: string | null
}

async function findCustomerSession(qrCode: unknown, requireUnexpired = true): Promise<CustomerSession | null> {
  if (typeof qrCode !== 'string' || !qrCode.trim()) return null
  const result = await pool.query<CustomerSession>(
    `SELECT ts.id::text, dt.table_number AS "tableNumber", ts.started_at AS "startedAt",
            ts.expires_at AS "expiresAt", ts.ended_at AS "endedAt"
     FROM table_sessions ts
     JOIN dining_tables dt ON dt.id = ts.dining_table_id
     WHERE ts.qr_code = $1
       AND ts.ended_at IS NULL
       ${requireUnexpired ? 'AND ts.expires_at > now()' : ''}`,
    [qrCode.trim()],
  )
  return result.rows[0] ?? null
}

app.post('/customer/call-staff', async (c) => {
  try {
    const body = await c.req.json<{ qrCode?: string }>()
    const session = await findCustomerSession(body.qrCode, false)
    if (!session) return c.json({ error: 'QR session is invalid or closed' }, 410)
    const recentCall = await pool.query<{ recent: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM cashier_notifications
         WHERE table_session_id = $1 AND message = 'เรียกพนักงาน'
           AND created_at > now() - INTERVAL '30 seconds'
       ) AS recent`,
      [session.id],
    )
    if (recentCall.rows[0].recent) return c.json({ error: 'พนักงานได้รับการเรียกแล้ว กรุณารอสักครู่' }, 429)

    await pool.query(
      `INSERT INTO system_logs (action, details) VALUES ($1, $2)`,
      ['UC-N13_call_staff', { tableSessionId: session.id, tableNumber: session.tableNumber, message: 'Customer needs assistance' }]
    );

    await pool.query(
      `INSERT INTO cashier_notifications (table_session_id, table_number, message) VALUES ($1, $2, 'เรียกพนักงาน')`,
      [session.id, session.tableNumber]
    );

    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to call staff' }, 500)
  }
})

app.post('/dev/reset-session', async (c) => {
  try {
    const body = await c.req.json<{ qrCode?: string }>().catch((): { qrCode?: string } => ({}))
    const session = await findCustomerSession(body.qrCode, false)
    if (!session) return c.json({ error: 'QR session is invalid or closed' }, 404)

    await pool.query(`UPDATE table_sessions SET expires_at = now() + interval '100 years' WHERE id = $1`, [session.id]);
    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed' }, 500);
  }
});

app.get('/cashier/notifications', async (c) => {
  try {
    const res = await pool.query(`
      SELECT id, table_number AS "tableNumber", message, created_at AS "createdAt", is_read AS "isRead"
      FROM cashier_notifications
      WHERE is_read = false
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return c.json({ notifications: res.rows });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to load notifications' }, 500);
  }
});

app.post('/cashier/notifications/:id/read', async (c) => {
  try {
    const id = c.req.param('id');
    await pool.query(`UPDATE cashier_notifications SET is_read = true WHERE id = $1`, [id]);
    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed' }, 500);
  }
});

app.post('/cashier/notifications/read-all', async (c) => {
  try {
    await pool.query(`UPDATE cashier_notifications SET is_read = true WHERE is_read = false`);
    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed' }, 500);
  }
});

app.get('/customer/orders', async (c) => {
  try {
    const session = await findCustomerSession(c.req.query('qr_code'), false)
    if (!session) return c.json({ error: 'QR session is invalid, closed, or expired' }, 410)
    const result = await pool.query(
      `SELECT
          oi.id AS "id",
          o.id AS "orderId",
          mi.name AS "name",
          oi.quantity AS "qty",
          CASE
              WHEN o.served_at IS NOT NULL THEN 'served'
              WHEN o.acknowledged_at IS NOT NULL THEN 'serving'
              WHEN o.status = 'confirmed' THEN 'cooking'
              WHEN o.status = 'pending' THEN 'pending'
              WHEN o.status = 'cancelled' THEN 'cancelled'
              ELSE 'unknown'
          END AS "status",
          TO_CHAR(o.created_at, 'HH24:MI') AS "time",
          o.confirm_at AS "confirmAt"
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.table_session_id = $1
       ORDER BY o.created_at DESC`,
      [session.id]
    )
    return c.json({ 
      items: result.rows,
      session,
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load orders' }, 500)
  }
})

app.post('/customer/orders', async (c) => {
  const client = await pool.connect()
  let transactionStarted = false
  try {
    const body = await c.req.json<{
      qrCode?: string
      items?: Array<{ menuItemId?: string; quantity?: number; removedIngredients?: string[] }>
    }>()
    const items = body.items
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      return c.json({ error: 'Order must contain 1 to 30 items' }, 400)
    }
    if (typeof body.qrCode !== 'string' || !body.qrCode.trim()) return c.json({ error: 'QR code is required' }, 400)
    if (items.some((item) => !item.menuItemId || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20 || !Array.isArray(item.removedIngredients))) {
      return c.json({ error: 'Every order item needs a menu item, quantity from 1 to 20, and removed ingredients array' }, 400)
    }
    const validatedItems = items as Array<{ menuItemId: string; quantity: number; removedIngredients: string[] }>

    await client.query('BEGIN')
    transactionStarted = true
    const sessionRes = await client.query<{ id: string }>(
      `SELECT id::text FROM table_sessions
       WHERE qr_code = $1 AND ended_at IS NULL AND expires_at > now() FOR UPDATE`,
      [body.qrCode.trim()],
    )
    if (!sessionRes.rows[0]) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'QR session is invalid, closed, or expired' }, 410)
    }
    const tableSessionId = sessionRes.rows[0].id

    const menuIds = [...new Set(validatedItems.map((item) => item.menuItemId))]
    const bomRes = await client.query<{
      menu_item_id: string
      ingredient_id: string
      quantity_required_plates: string
      removable: boolean
      is_active: boolean
    }>(
      `SELECT mi.id::text AS menu_item_id, mi.is_active, mii.ingredient_id::text,
              mii.quantity_required_plates, mii.removable
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       WHERE mi.id = ANY($1::bigint[])`,
      [menuIds],
    )
    const bomByMenu = new Map<string, typeof bomRes.rows>()
    for (const row of bomRes.rows) {
      const rows = bomByMenu.get(row.menu_item_id) ?? []
      rows.push(row)
      bomByMenu.set(row.menu_item_id, rows)
    }
    const requiredByIngredient = new Map<string, number>()
    for (const item of validatedItems) {
      const rows = bomByMenu.get(item.menuItemId)
      if (!rows?.length || !rows[0].is_active || rows.some((row) => !row.ingredient_id)) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return c.json({ error: 'One or more menu items are unavailable' }, 409)
      }
      const removed = new Set(item.removedIngredients)
      if (removed.size !== item.removedIngredients.length || [...removed].some((id) => !rows.some((row) => row.ingredient_id === id && row.removable))) {
        await client.query('ROLLBACK')
        transactionStarted = false
        return c.json({ error: 'Removed ingredients must be removable ingredients in that menu item' }, 400)
      }
      for (const row of rows) {
        if (removed.has(row.ingredient_id)) continue
        requiredByIngredient.set(row.ingredient_id, (requiredByIngredient.get(row.ingredient_id) ?? 0) + Number(row.quantity_required_plates) * Number(item.quantity))
      }
    }
    const ingredientIds = [...requiredByIngredient.keys()]
    const stockRes = await client.query<{ ingredient_id: string; available: string }>(
      `SELECT sl.ingredient_id::text, COALESCE(SUM(sl.quantity_remaining), 0) AS available
       FROM stock_lots sl
       JOIN storage_locations loc ON loc.id = sl.storage_location_id
       WHERE sl.ingredient_id = ANY($1::bigint[]) AND loc.name = 'ตู้พักละลาย'
         AND sl.is_not_fresh = false AND sl.expiry_date > now()
       GROUP BY sl.ingredient_id`,
      [ingredientIds],
    )
    const availableByIngredient = new Map(stockRes.rows.map((row) => [row.ingredient_id, Number(row.available)]))
    if ([...requiredByIngredient].some(([ingredientId, required]) => (availableByIngredient.get(ingredientId) ?? 0) < required)) {
      await client.query('ROLLBACK')
      transactionStarted = false
      return c.json({ error: 'One or more items just sold out. Please refresh the menu.' }, 409)
    }

    const orderRes = await client.query(
      `INSERT INTO orders (table_session_id, confirm_at)
       VALUES ($1, now() + interval '60 seconds')
       RETURNING id`,
      [tableSessionId]
    )
    const orderId = orderRes.rows[0].id

    for (const item of validatedItems) {
      const oiRes = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [orderId, item.menuItemId, item.quantity]
      )
      const orderItemId = oiRes.rows[0].id

      await client.query(
        `INSERT INTO order_item_bom (order_item_id, ingredient_id, quantity_required_plates, removable)
         SELECT $1, ingredient_id, quantity_required_plates, removable
         FROM menu_item_ingredients
         WHERE menu_item_id = $2`,
        [orderItemId, item.menuItemId],
      )

      if (item.removedIngredients.length > 0) {
        for (const ingredientId of item.removedIngredients) {
          await client.query(
            `INSERT INTO order_item_customizations (order_item_id, ingredient_id)
             VALUES ($1, $2)`,
            [orderItemId, ingredientId]
          )
        }
      }
    }

    await client.query('COMMIT')
    transactionStarted = false
    return c.json({ orderId: String(orderId), confirmAt: new Date(Date.now() + 60_000).toISOString() }, 201)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  } finally {
    client.release()
  }
})

app.get('/customer/session', async (c) => {
  try {
    const qrCode = c.req.query('qr_code')
    const session = await findCustomerSession(qrCode, false)
    if (!session) return c.json({ error: 'QR session is invalid or closed' }, 404)
    const isExpired = new Date(session.expiresAt).getTime() <= Date.now()
    return c.json({ session: { ...session, capacity: 4, status: isExpired ? 'expired' : 'active' } })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load session' }, 500)
  }
})

app.post('/customer/start-timer', async (c) => {
  // เดิมเป็น mock endpoint สำหรับทดสอบ (hardcode tableSessionId=1) — origin/main เปลี่ยนมาเริ่มจับเวลาจริงตอน Cashier check-in
  // แทนแล้ว (ดู POST /cashier/table-sessions) จึง retire endpoint นี้ตามต้นทาง ไม่ใช้ mock อีกต่อไป
  return c.json({ error: 'Timer starts at Cashier check-in; this endpoint is retired' }, 410)
})

app.post('/customer/orders/:id/cancel', async (c) => {
  const orderId = c.req.param('id')
  try {
    const body = await c.req.json<{ qrCode?: string }>()
    if (typeof body.qrCode !== 'string' || !body.qrCode.trim()) return c.json({ error: 'QR code is required' }, 400)
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'cancelled', cancelled_at = now() 
       WHERE id = $1 AND status = 'pending'
         AND table_session_id = (
           SELECT id FROM table_sessions
           WHERE qr_code = $2 AND ended_at IS NULL AND expires_at > now()
         )
       RETURNING id`,
      [orderId, body.qrCode.trim()]
    )
    if (result.rows.length === 0) {
      return c.json({ error: 'Order cannot be cancelled' }, 400)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to cancel order' }, 500)
  }
})

// === DEV TOOLS API ===
app.post('/dev/time-shift', async (c) => {
  try {
    const { minutes, qrCode } = await c.req.json<{ minutes: number, qrCode?: string }>()
    const session = await findCustomerSession(qrCode, false)
    if (!session || !Number.isFinite(minutes)) return c.json({ error: 'Valid QR code and minutes are required' }, 400)
    
    await pool.query(
      `UPDATE table_sessions 
       SET expires_at = expires_at + ($1 || ' minutes')::interval 
       WHERE id = $2`,
      [minutes, session.id]
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to shift time' }, 500)
  }
})

app.post('/dev/set-time', async (c) => {
  try {
    const { minutesLeft, qrCode } = await c.req.json<{ minutesLeft: number, qrCode?: string }>()
    const session = await findCustomerSession(qrCode, false)
    if (!session || !Number.isFinite(minutesLeft)) return c.json({ error: 'Valid QR code and minutes are required' }, 400)
    
    await pool.query(
      `UPDATE table_sessions 
       SET expires_at = now() + ($1 || ' minutes')::interval 
       WHERE id = $2`,
      [minutesLeft, session.id]
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to set time' }, 500)
  }
})

app.post('/dev/force-confirm', async (c) => {
  try {
    const { qrCode } = await c.req.json<{ qrCode?: string }>()
    const session = await findCustomerSession(qrCode, false)
    if (!session) return c.json({ error: 'QR session is invalid or closed' }, 404)

    // Make pending orders confirmable immediately by pushing their confirm_at to the past
    await pool.query(
      `UPDATE orders SET confirm_at = now() - interval '1 second' 
       WHERE status = 'pending' AND table_session_id = $1`,
      [session.id]
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to force confirm' }, 500)
  }
})

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

// === DEVELOPMENT BACKGROUND WORKER (PG_CRON FALLBACK) ===
// Production uses supabase/migrations/0003_cashier_expiry_schedule.sql.
async function runDevelopmentWorker() {
  try {
    // Development fallback. Production should schedule this database function with pg_cron.
    await pool.query('SELECT expire_table_sessions()')
  } catch (e) {
    console.error('Table session expiry error:', e)
  }

  try {
    const res = await pool.query(`SELECT id FROM orders WHERE status = 'pending' AND now() >= confirm_at`);
    for (const row of res.rows) {
      const confirmation = await pool.query<{ confirmed: boolean }>(
        `SELECT auto_confirm_order($1) AS confirmed`,
        [row.id],
      );
      console.log(`${confirmation.rows[0]?.confirmed ? 'Auto-confirmed' : 'Auto-cancelled'} order ${row.id}`);
    }
  } catch (e) {
    console.error("Auto confirm error:", e);
  }

  try {
    // Check table expirations for notifications
    const activeSessions = await pool.query(`
      SELECT ts.id, dt.table_number,
             EXTRACT(EPOCH FROM (ts.expires_at - now())) / 60 AS mins_left
      FROM table_sessions ts
      JOIN dining_tables dt ON ts.dining_table_id = dt.id
      WHERE ts.ended_at IS NULL AND ts.expires_at IS NOT NULL
    `);
    
    for (const session of activeSessions.rows) {
      const mins = parseFloat(session.mins_left);
      
      if (mins <= 30) {
        const check30 = await pool.query(`SELECT id FROM cashier_notifications WHERE table_session_id = $1 AND message LIKE 'เหลือเวลา 30 นาที%'`, [session.id]);
        if (check30.rows.length === 0) {
          await pool.query(
            `INSERT INTO cashier_notifications (table_session_id, table_number, message) VALUES ($1, $2, 'เหลือเวลา 30 นาที')`,
            [session.id, session.table_number]
          );
        }
      }
      
      if (mins <= 5) {
        const check5 = await pool.query(`SELECT id FROM cashier_notifications WHERE table_session_id = $1 AND message LIKE 'เหลือเวลา 5 นาที%'`, [session.id]);
        if (check5.rows.length === 0) {
          await pool.query(
            `INSERT INTO cashier_notifications (table_session_id, table_number, message) VALUES ($1, $2, 'เหลือเวลา 5 นาที (ใกล้หมดเวลา)')`,
            [session.id, session.table_number]
          );
        }
      }

      if (mins <= 0) {
        const check0 = await pool.query(`SELECT id FROM cashier_notifications WHERE table_session_id = $1 AND message LIKE 'หมดเวลา%'`, [session.id]);
        if (check0.rows.length === 0) {
          await pool.query(
            `INSERT INTO cashier_notifications (table_session_id, table_number, message) VALUES ($1, $2, 'หมดเวลาทานบุฟเฟต์!')`,
            [session.id, session.table_number]
          );
        }
      }
    }
  } catch (e) {
    console.error("Table expiration notification error:", e);
  }
}

if (process.env.NODE_ENV !== 'production') {
  const developmentWorker = setInterval(runDevelopmentWorker, 5000)
  // Do not keep one-off scripts/tests alive solely because of the fallback worker.
  developmentWorker.unref()
}
