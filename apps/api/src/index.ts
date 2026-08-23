import { serve } from '@hono/node-server'
import {pool} from './db.js'
import { Hono } from 'hono'
import {setSignedCookie,getSignedCookie, deleteCookie} from 'hono/cookie'
import bcrypt from 'bcryptjs'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))
app.get('/health', async (c) => {
  async function fetchData() {
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT NOW()')
      client.release()
      return result.rows[0]
    } catch (err) {
      console.error(err)
      return { error: 'Database query failed' }
    }
  }

  const data = await fetchData()
  return c.json(data)


  
})
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  async function fetchData() {
    try {
      const client = await pool.connect()
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email])
      client.release()
      return result.rows[0]
    } catch (err) {
      console.error(err)
      return { error: 'Database query failed' }
    }
  }

  const data = await fetchData()
  if (!data || !data.is_active) {

    return c.json({ error: 'Invalid email or password' }, 401)
  }
  const passwordMatch  = await bcrypt.compare(password, data.password_hash)
  if (!passwordMatch) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }
  await setSignedCookie(c, 'session', String(data.id), process.env.SESSION_SECRET!)

  return c.json({ role: data.role })

})

app.use('/owner/*', async (c, next) => {
  const userId = await getSignedCookie(c, process.env.SESSION_SECRET!, 'session')
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId])
  const user = result.rows[0]
  if (!user ||!user.is_active|| user.role !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
app.post('/auth/logout', async (c) => {
  await deleteCookie(c,'session')
  return c.json({ message: 'Logged out successfully' })
})

app.post('/owner/users', async (c) => {
  const { name,email, password, role } = await c.req.json()
  const passwordHash = await bcrypt.hash(password, 10)
  const result = await pool.query('INSERT INTO users (name,email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role', [name,email, passwordHash, role])
  return c.json(result.rows[0] )

})
app.put('/owner/users/:id', async (c) => {
  const { id } = c.req.param()
  const { email, password, role } = await c.req.json()  
  const passwordHash = await bcrypt.hash(password, 10)
  const result = await pool.query('UPDATE users SET email = $1, password_hash = $2, role = $3 WHERE id = $4', [email, passwordHash, role, id])
  return c.json({ message: 'User updated successfully' })
})


app.post('/owner/menu-items', async (c) => {
  const { name, description, price } = await c.req.json()
  const result = await pool.query('INSERT INTO menu_items (name, description, price) VALUES ($1, $2, $3) RETURNING id, name, description, price', [name, description, price])
  return c.json(result.rows[0])
})


app.post('/owner/menu-items/:id/ingredients', async (c) => {
  const { id } = c.req.param()
  const { ingredient_id, quantity_required_plates, removable } = await c.req.json()
  const result = await pool.query('INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required_plates, removable) VALUES ($1, $2, $3,$4) RETURNING id, menu_item_id, ingredient_id, quantity_required_plates, removable', [id, ingredient_id, quantity_required_plates,removable])
  return c.json(result.rows[0])

})
app.get('/owner/menu-items', async (c) => {
  const result = await pool.query('SELECT MenuI.id, MenuI.name, MenuI.price, MenuI.description, MenuIDgredients.ingredient_id, MenuIDgredients.quantity_required_plates, MenuIDgredients.removable FROM menu_items AS MenuI LEFT JOIN menu_item_ingredients AS MenuIDgredients ON MenuI.id = MenuIDgredients.menu_item_id')
  return c.json(result.rows)
})
app.put('/owner/menu-items/:id', async (c) => {
  const { id } = c.req.param()
  const { name, description, price, is_active } = await c.req.json()
  const result = await pool.query('UPDATE menu_items SET name = $1, description = $2, price = $3, is_active = $4 WHERE id = $5', [name, description, price, is_active, id])
  return c.json({ message: 'Menu item updated successfully' })
})
 
app.delete('/owner/menu-items/:id', async (c) => {
  const { id } = c.req.param()
  const check = await pool.query('SELECT id FROM  order_items WHERE menu_item_id = $1 LIMIT 1', [id])
  if(check.rows.length > 0){ 
    return c.json({ message: 'Cannot delete menu item with existing orders' })
  }
  const deleteResult = await pool.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [id])
  const deleteMenuItemResult = await pool.query('DELETE FROM menu_items WHERE id = $1', [id])
  return c.json({ message: 'Menu item deleted successfully' })
  
})
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
