import { serve } from '@hono/node-server'
import bcrypt from 'bcryptjs'
import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { pool } from './db.js'

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
    `SELECT id::text, table_number AS "tableNumber", status
     FROM dining_tables
     ORDER BY table_number`,
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

    const result = await pool.query(
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
    await pool.query(`UPDATE dining_tables SET status = 'occupied' WHERE id = $1`, [diningTableId])

    return c.json({ tableSession: result.rows[0] }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
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
            i.name AS item,
            CASE i.category WHEN 'meat' THEN 'Meat' ELSE 'Vegetable' END AS category,
            'LOT-' || sl.id AS batch,
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
  try {
    const actor = await getSessionUser(c)
    if (!actor) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      item?: string
      category?: 'Meat' | 'Vegetable'
      quantity?: number
      unit?: string
      receivedAt?: string
      expiryDate?: string
      unitCost?: number
    }>()
    const item = body.item?.trim()
    const quantity = Number(body.quantity)
    const unitCost = Number(body.unitCost)
    if (!item || !body.category || !body.expiryDate || !Number.isFinite(quantity) || quantity <= 0) {
      return c.json({ error: 'Item, category, positive quantity and expiry date are required' }, 400)
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return c.json({ error: 'Unit cost must be zero or greater' }, 400)
    }

    const category = body.category === 'Meat' ? 'meat' : 'vegetable'
    const defaultPortionSizeKg = category === 'meat' ? 0.1 : 0.05
    const normalizedUnit = body.unit?.trim().toLowerCase()
    if (category === 'meat' && normalizedUnit !== 'kg') {
      return c.json({ error: 'Meat must be received in kg' }, 400)
    }
    if (category === 'vegetable' && normalizedUnit !== 'kg' && normalizedUnit !== 'plate' && normalizedUnit !== 'plates') {
      return c.json({ error: 'Vegetables must be received in kg or plates' }, 400)
    }

    const storageName = category === 'meat' ? 'Freezer' : 'ตู้พักละลาย'
    const storedQuantity = category === 'vegetable' && normalizedUnit === 'kg'
      ? Math.floor(quantity / defaultPortionSizeKg)
      : quantity
    if (storedQuantity <= 0) return c.json({ error: 'Quantity is too small to create one plate' }, 400)

    await client.query('BEGIN')
    const existingIngredient = await client.query(
      `SELECT id, category FROM ingredients WHERE lower(name) = lower($1) LIMIT 1`,
      [item],
    )
    let ingredientId: string
    if (existingIngredient.rows[0]) {
      if (existingIngredient.rows[0].category !== category) {
        throw new Error('Ingredient already exists with a different category')
      }
      ingredientId = String(existingIngredient.rows[0].id)
    } else {
      const insertedIngredient = await client.query(
        `INSERT INTO ingredients (name, category, default_portion_size_kg)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [item, category, defaultPortionSizeKg],
      )
      ingredientId = String(insertedIngredient.rows[0].id)
    }

    const storageResult = await client.query(`SELECT id FROM storage_locations WHERE name = $1`, [storageName])
    if (!storageResult.rows[0]) throw new Error(`Storage location ${storageName} is missing`)

    const headerResult = await client.query(
      `INSERT INTO lot_headers (received_at, received_by)
       VALUES (COALESCE($1::timestamptz, now()), $2)
       RETURNING id`,
      [body.receivedAt || null, actor.id],
    )
    const lotResult = await client.query(
      `INSERT INTO stock_lots (
         lot_header_id, ingredient_id, storage_location_id,
         quantity_original, quantity_remaining, unit_cost, expiry_date
       )
       VALUES ($1, $2, $3, $4, $4, $5, $6)
       RETURNING id`,
      [headerResult.rows[0].id, ingredientId, storageResult.rows[0].id, storedQuantity, unitCost, body.expiryDate],
    )
    await client.query(
      `INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
       VALUES ($1, 'intake', $2, $3)`,
      [lotResult.rows[0].id, storedQuantity, actor.id],
    )
    await client.query(
      `INSERT INTO system_logs (actor_id, action, details)
       VALUES ($1, 'inventory.lot_received', $2::jsonb)`,
      [actor.id, JSON.stringify({ lotId: String(lotResult.rows[0].id), item, quantity: storedQuantity, storageName })],
    )
    await client.query('COMMIT')
    return c.json({ id: String(lotResult.rows[0].id) }, 201)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(error)
    return c.json({ error: errorMessage(error) }, 400)
  } finally {
    client.release()
  }
})

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
