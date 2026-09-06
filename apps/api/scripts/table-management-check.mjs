import assert from 'node:assert/strict'
import { pool } from '../dist/db.js'

const client = await pool.connect()
try {
  await client.query('BEGIN')
  const { rows: [table] } = await client.query("INSERT INTO dining_tables(table_number) VALUES ('check-' || gen_random_uuid()::text) RETURNING id, is_hidden, is_deleted")
  assert.equal(table.is_hidden, false)
  assert.equal(table.is_deleted, false)
  await client.query('UPDATE dining_tables SET is_hidden = true WHERE id = $1', [table.id])
  assert.equal((await client.query('SELECT id FROM dining_tables WHERE id = $1 AND NOT is_hidden AND NOT is_deleted', [table.id])).rowCount, 0)
  await client.query('UPDATE dining_tables SET is_hidden = false WHERE id = $1', [table.id])
  assert.equal((await client.query('SELECT id FROM dining_tables WHERE id = $1 AND NOT is_hidden AND NOT is_deleted', [table.id])).rowCount, 1)
  await client.query('UPDATE dining_tables SET is_deleted = true WHERE id = $1', [table.id])
  assert.equal((await client.query('SELECT id FROM dining_tables WHERE id = $1 AND NOT is_deleted', [table.id])).rowCount, 0)
  console.log('Create, hide, restore, and delete filters passed (rolled back).')
} finally {
  await client.query('ROLLBACK')
  client.release()
  await pool.end()
}
