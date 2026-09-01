import { serve } from '@hono/node-server'
import bcrypt from 'bcryptjs'
import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { pool } from './db.js'
import { convertInventoryIntakeLine, type InventoryIntakeConversion } from './inventory-intake.js'
import { InventoryTransferError, transferInventoryIngredientFifo, transferInventoryLot } from './inventory-transfer.js'

// Init cashier_notifications table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS cashier_notifications (
    id SERIAL PRIMARY KEY,
    table_session_id INT,
    table_number VARCHAR(50),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
  )
`).catch(console.error);

type Role = 'owner' | 'staff' | 'cashier'

type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

const app = new Hono()
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
])

app.use('*', cors({
  origin: (origin) => allowedOrigins.has(origin) ? origin : 'http://localhost:5173',
  credentials: true,
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

app.get('/cashier/dining-tables', async (c) => {
  const result = await pool.query(
    `SELECT dt.id::text, dt.table_number AS "tableNumber", dt.status, ts.id::text AS "activeSessionId",
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

    const settingsResult = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM settings
       WHERE key = ANY($1::text[])`,
      [[...BUFFET_PRICE_KEYS, 'qr_duration_minutes']],
    )
    const byKey = Object.fromEntries(settingsResult.rows.map((row) => [row.key, row.value]))
    const qrDurationMinutes = Number(byKey.qr_duration_minutes ?? 120)

    const qrCode = `${diningTableId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let result
    try {
      result = await pool.query(
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
         return c.json({ error: 'โต๊ะนี้ถูกเปิดบิลไปแล้ว (Table is already occupied)' }, 409)
      }
      throw err
    }
    await pool.query(`UPDATE dining_tables SET status = 'occupied' WHERE id = $1`, [diningTableId])

    return c.json({ tableSession: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
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
    const qrCode = `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
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
  try {
    const sessionId = c.req.param('id')
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)
    
    const body = await c.req.json<{ paymentMethod?: string }>().catch(() => ({ paymentMethod: undefined }))

    await client.query('BEGIN')
    const sessionRes = await client.query(
      `UPDATE table_sessions 
       SET ended_at = COALESCE(ended_at, now()), ended_by = $1
       WHERE id = $2 AND ended_at IS NULL
       RETURNING dining_table_id`,
      [actor.id, sessionId]
    )
    if (!sessionRes.rows[0]) {
      await client.query('ROLLBACK')
      return c.json({ error: 'Session not found or already closed' }, 409)
    }

    // Cancel pending orders
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = now() WHERE table_session_id = $1 AND status = 'pending'`,
      [sessionId]
    )

    await client.query(
      `UPDATE dining_tables SET status = 'pending_cleanup' WHERE id = $1`,
      [sessionRes.rows[0].dining_table_id]
    )

    await client.query(
      `INSERT INTO system_logs (actor_id, action, details) VALUES ($1, $2, $3)`,
      [actor.id, 'cashier.checkout', JSON.stringify({ tableSessionId: sessionId, paymentMethod: body.paymentMethod })]
    )

    await client.query('COMMIT')
    return c.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
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
    await ensureMockMenu();
    const result = await pool.query(
      `SELECT mi.id::text,
              mi.name,
              mi.description,
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
              ) AS ingredients
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       GROUP BY mi.id
       ORDER BY mi.name`,
    )
    return c.json({ menuItems: result.rows })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load menu items' }, 500)
  }
})

app.post('/owner/menu-items', async (c) => {
  try {
    const body = await c.req.json<{ name?: string; description?: string }>()
    const name = body.name?.trim()
    if (!name) {
      return c.json({ error: 'Name is required' }, 400)
    }

    const result = await pool.query(
      `INSERT INTO menu_items (name, description)
       VALUES ($1, $2)
       RETURNING id::text, name, description, is_active AS "isActive"`,
      [name, body.description?.trim() || null],
    )
    return c.json({ menuItem: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.put('/owner/menu-items/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{ name?: string; description?: string; isActive?: boolean }>()

    const result = await pool.query(
      `UPDATE menu_items
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING id::text, name, description, is_active AS "isActive"`,
      [body.name?.trim() || null, body.description?.trim() || null, body.isActive ?? null, id],
    )
    if (!result.rows[0]) return c.json({ error: 'Menu item not found' }, 404)
    return c.json({ menuItem: result.rows[0] })
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  }
})

app.delete('/owner/menu-items/:id', async (c) => {
  const client = await pool.connect()
  try {
    const id = c.req.param('id')
    const orderCheck = await client.query('SELECT id FROM order_items WHERE menu_item_id = $1 LIMIT 1', [id])
    if (orderCheck.rows.length > 0) {
      return c.json({ error: 'Cannot delete a menu item that has already been ordered' }, 409)
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [id])
    const deleted = await client.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [id])
    await client.query('COMMIT')

    if (!deleted.rows[0]) return c.json({ error: 'Menu item not found' }, 404)
    return c.json({ message: 'Menu item deleted successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
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
    `SELECT id::text, name, category, default_portion_size_kg::float8 AS "defaultPortionSizeKg"
     FROM ingredients
     ORDER BY name`,
  )
  return c.json({ ingredients: result.rows })
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


async function ensureMockSession(sessionId: number) {

  const res = await pool.query('SELECT id FROM table_sessions WHERE id = $1', [sessionId]);
  if (res.rows.length === 0) {
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    let userId = userRes.rows[0]?.id;
    if (!userId) {
      const u = await pool.query(`INSERT INTO users (name, email, password_hash, role) VALUES ('Mock Cashier', 'mock@example.com', 'mock', 'cashier') RETURNING id`);
      userId = u.rows[0].id;
    }
    const tableRes = await pool.query(`INSERT INTO dining_tables (table_number, status) VALUES ('MOCK-' || $1, 'occupied') ON CONFLICT (table_number) DO UPDATE SET status = 'occupied' RETURNING id`, [sessionId]);
    const tableId = tableRes.rows[0].id;
    await pool.query(`INSERT INTO table_sessions (id, dining_table_id, qr_code, opened_by, expires_at) VALUES ($1, $2, 'mock-qr', $3, now() + interval '100 years')`, [sessionId, tableId, userId]);
  }
}

async function ensureMockMenu() {
  const res = await pool.query('SELECT id FROM menu_items LIMIT 1');
  if (res.rows.length === 0) {
    await pool.query(`INSERT INTO ingredients (name, category, default_portion_size_kg) VALUES 
      ('หมูสามชั้นสไลด์', 'meat', 0.1), 
      ('เนื้อวากิวสไลด์', 'meat', 0.1), 
      ('ผักกาดขาว', 'vegetable', 0.05),
      ('ผักบุ้ง', 'vegetable', 0.05)
      ON CONFLICT (name) DO NOTHING`);
      
    const menuRes = await pool.query(`INSERT INTO menu_items (name, description) VALUES 
      ('ชุดหมูรวม', 'รวมหมูสามชั้นและสันคอ'),
      ('เนื้อวากิวพรีเมียม', 'เนื้อวากิว A4 ละลายในปาก'),
      ('ชุดผักรวม', 'ผักกาดขาว ผักบุ้ง เห็ดเข็มทอง')
      RETURNING id`);
      
    const menuIds = menuRes.rows.map(r => r.id);
    
    const ingRes = await pool.query(`SELECT id, name FROM ingredients WHERE name IN ('หมูสามชั้นสไลด์', 'เนื้อวากิวสไลด์', 'ผักกาดขาว')`);
    const ingMap = {} as any;
    ingRes.rows.forEach(r => { ingMap[r.name] = r.id; });
    
    if (ingMap['หมูสามชั้นสไลด์']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[0], ingMap['หมูสามชั้นสไลด์']]);
    if (ingMap['เนื้อวากิวสไลด์']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[1], ingMap['เนื้อวากิวสไลด์']]);
    if (ingMap['ผักกาดขาว']) await pool.query(`INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, removable) VALUES ($1, $2, true)`, [menuIds[2], ingMap['ผักกาดขาว']]);
  }
}




app.post('/customer/call-staff', async (c) => {
  try {
    const body = await c.req.json<{ tableSessionId?: number; qrCode?: string }>()
    let tableSessionId = body.tableSessionId
    if (body.qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [body.qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1
    
    await ensureMockSession(tableSessionId);
    
    const sessionRes = await pool.query(
      `SELECT dt.table_number 
       FROM table_sessions ts 
       JOIN dining_tables dt ON dt.id = ts.dining_table_id 
       WHERE ts.id = $1`, [tableSessionId]
    );
      
    const tableNum = sessionRes.rows[0]?.table_number || 'Unknown';

    await pool.query(
      `INSERT INTO system_logs (action, details) VALUES ($1, $2)`,
      ['UC-N13_call_staff', { tableSessionId, tableNumber: tableNum, message: 'Customer needs assistance' }]
    );

    // Insert into notifications
    await pool.query(
      `INSERT INTO cashier_notifications (table_session_id, table_number, message) VALUES ($1, $2, 'เรียกพนักงาน')`,
      [tableSessionId, tableNum]
    );

    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to call staff' }, 500)
  }
})

app.post('/dev/reset-session', async (c) => {
  try {
    const body = await c.req.json<{ tableSessionId?: number; qrCode?: string }>().catch(() => ({}))
    let tableSessionId = body.tableSessionId;
    if (body.qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [body.qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1;

    await pool.query(`UPDATE table_sessions SET expires_at = now() + interval '100 years' WHERE id = $1`, [tableSessionId]);
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
    let tableSessionId = Number(c.req.query('table_session_id'))
    const qrCode = c.req.query('qr_code')
    if (qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1
    await ensureMockSession(tableSessionId)
    
    const result = await pool.query(
      `SELECT
          oi.id AS "id",
          o.id AS "orderId",
          mi.name AS "name",
          oi.quantity AS "qty",
          CASE
              WHEN o.served_at IS NOT NULL THEN 'served'
              WHEN o.status = 'confirmed' THEN 'cooking'
              WHEN o.status = 'pending' THEN 'pending'
              ELSE o.status
          END AS "status",
          TO_CHAR(o.created_at, 'HH24:MI') AS "time"
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.table_session_id = $1
         AND o.status != 'cancelled'
       ORDER BY o.created_at DESC`,
      [tableSessionId]
    )
    
    const sessionRes = await pool.query(
      `SELECT started_at, expires_at FROM table_sessions WHERE id = $1`,
      [tableSessionId]
    )
    
    return c.json({ 
      items: result.rows,
      session: sessionRes.rows[0] ? {
        startedAt: sessionRes.rows[0].started_at,
        expiresAt: sessionRes.rows[0].expires_at
      } : null
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load orders' }, 500)
  }
})

app.post('/customer/orders', async (c) => {
  const client = await pool.connect()
  try {
    const body = await c.req.json<{
      tableSessionId?: number
      qrCode?: string
      items: Array<{ menuItemId: string; quantity: number; removedIngredients: string[] }>
    }>()
    
    let tableSessionId = body.tableSessionId
    if (body.qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [body.qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1
    await ensureMockSession(tableSessionId)

    if (!body.items || body.items.length === 0) {
      return c.json({ error: 'Order must contain items' }, 400)
    }

    await client.query('BEGIN')

    const orderRes = await client.query(
      `INSERT INTO orders (table_session_id, confirm_at)
       VALUES ($1, now() + interval '60 seconds')
       RETURNING id`,
      [tableSessionId]
    )
    const orderId = orderRes.rows[0].id

    for (const item of body.items) {
      const oiRes = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [orderId, item.menuItemId, item.quantity]
      )
      const orderItemId = oiRes.rows[0].id

      if (item.removedIngredients && item.removedIngredients.length > 0) {
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
    return c.json({ orderId }, 201)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 500)
  } finally {
    client.release()
  }
})

app.get('/customer/session', async (c) => {
  try {
    const tableSessionId = Number(c.req.query('table_session_id'))
    const qrCode = c.req.query('qr_code')

    if (!tableSessionId && !qrCode) {
      return c.json({ error: 'table_session_id or qr_code is required' }, 400)
    }

    if (tableSessionId) {
      await ensureMockSession(tableSessionId)
    }

    let sessionRes
    if (qrCode) {
      sessionRes = await pool.query(
        `SELECT 
           ts.started_at, 
           ts.expires_at,
           dt.table_number
         FROM table_sessions ts
         JOIN dining_tables dt ON ts.dining_table_id = dt.id
         WHERE ts.qr_code = $1 AND ts.ended_at IS NULL`,
        [qrCode]
      )
    } else {
      sessionRes = await pool.query(
        `SELECT 
           ts.started_at, 
           ts.expires_at,
           dt.table_number
         FROM table_sessions ts
         JOIN dining_tables dt ON ts.dining_table_id = dt.id
         WHERE ts.id = $1 AND ts.ended_at IS NULL`,
        [tableSessionId]
      )
    }
    
    return c.json({
      session: sessionRes.rows[0] ? {
        startedAt: sessionRes.rows[0].started_at,
        expiresAt: sessionRes.rows[0].expires_at,
        tableNumber: sessionRes.rows[0].table_number,
        capacity: 4
      } : null
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Unable to load session' }, 500)
  }
})

app.post('/customer/start-timer', async (c) => {
  try {
    const body = await c.req.json<{ tableSessionId?: number; qrCode?: string }>().catch(() => ({}))
    let tableSessionId = body.tableSessionId;
    if (body.qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [body.qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1; // hardcoded for customer app mock
    await ensureMockSession(tableSessionId);
    
    // Check if the current expires_at is far in the future (> 24 hours)
    const res = await pool.query(`SELECT expires_at FROM table_sessions WHERE id = $1`, [tableSessionId]);
    if (res.rows.length > 0) {
      const expiresAt = new Date(res.rows[0].expires_at).getTime();
      const now = Date.now();
      
      // If it expires more than 24 hours from now, it means it hasn't started yet
      if (expiresAt > now + 24 * 60 * 60 * 1000) {
        await pool.query(
          `UPDATE table_sessions SET started_at = now(), expires_at = now() + interval '2 hours' WHERE id = $1`, 
          [tableSessionId]
        );
      }
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Unable to start timer' }, 500);
  }
})

app.post('/customer/orders/:id/cancel', async (c) => {
  const orderId = c.req.param('id')
  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'cancelled', cancelled_at = now() 
       WHERE id = $1 AND status = 'pending' 
       RETURNING id`,
      [orderId]
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
    const { minutes, tableSessionId: reqSessionId, qrCode } = await c.req.json<{ minutes: number, tableSessionId?: number, qrCode?: string }>()
    let tableSessionId = reqSessionId;
    if (qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1;
    
    await pool.query(
      `UPDATE table_sessions 
       SET expires_at = expires_at + ($1 || ' minutes')::interval 
       WHERE id = $2`,
      [minutes, tableSessionId]
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to shift time' }, 500)
  }
})

app.post('/dev/set-time', async (c) => {
  try {
    const { minutesLeft, tableSessionId: reqSessionId, qrCode } = await c.req.json<{ minutesLeft: number, tableSessionId?: number, qrCode?: string }>()
    let tableSessionId = reqSessionId;
    if (qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1;
    
    await pool.query(
      `UPDATE table_sessions 
       SET expires_at = now() + ($1 || ' minutes')::interval 
       WHERE id = $2`,
      [minutesLeft, tableSessionId]
    )
    return c.json({ success: true })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to set time' }, 500)
  }
})

app.post('/dev/force-confirm', async (c) => {
  try {
    const { tableSessionId: reqSessionId, qrCode } = await c.req.json<{ tableSessionId?: number, qrCode?: string }>()
    let tableSessionId = reqSessionId;
    if (qrCode) {
      const ts = await pool.query('SELECT id FROM table_sessions WHERE qr_code = $1', [qrCode]);
      if (ts.rows[0]) tableSessionId = ts.rows[0].id;
    }
    tableSessionId = tableSessionId || 1;

    // Make pending orders confirmable immediately by pushing their confirm_at to the past
    await pool.query(
      `UPDATE orders SET confirm_at = now() - interval '1 second' 
       WHERE status = 'pending' AND table_session_id = $1`,
      [tableSessionId]
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

// === BACKGROUND WORKER (MOCK PG_CRON) ===
setInterval(async () => {
  try {
    const res = await pool.query(`SELECT id FROM orders WHERE status = 'pending' AND now() >= confirm_at`);
    for (const row of res.rows) {
      await pool.query(`SELECT auto_confirm_order($1)`, [row.id]);
      console.log(`Auto-confirmed order ${row.id}`);
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
}, 5000);
