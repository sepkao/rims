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

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
