import { serve } from '@hono/node-server'
import {pool} from './db.js'
import { Hono } from 'hono'


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

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
