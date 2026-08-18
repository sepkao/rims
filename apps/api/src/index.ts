import { serve } from '@hono/node-server'
import {pool} from './db.js'
import { Hono } from 'hono'
import {setSignedCookie,getSignedCookie, deleteCookie} from 'hono/cookie'
import bcrypt from 'bcryptjs'


const app = new Hono()

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
app.post('/owner/logout', async (c) => {
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

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
