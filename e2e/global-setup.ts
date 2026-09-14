import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

export const E2E_PREFIX = 'e2e-fixture'
export const E2E_PASSWORD = 'test-password'

async function main() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL })
  const one = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows[0]
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 4)

  const owner = await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'owner') RETURNING id", [E2E_PREFIX + '-owner', E2E_PREFIX + '-owner@example.test', passwordHash])
  await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'staff') RETURNING id", [E2E_PREFIX + '-staff', E2E_PREFIX + '-staff@example.test', passwordHash])
  await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [E2E_PREFIX + '-cashier', E2E_PREFIX + '-cashier@example.test', passwordHash])

  const ingredientId = (await one(
    "INSERT INTO ingredients(name,category,default_portion_size_kg) VALUES($1,'vegetable',0.2) RETURNING id",
    [E2E_PREFIX + '-ingredient'],
  )).id
  const header = (await one('INSERT INTO lot_headers(received_by) VALUES($1) RETURNING id', [owner.id])).id
  await pool.query(
    "INSERT INTO stock_lots(lot_header_id,ingredient_id,storage_location_id,quantity_original,quantity_remaining,unit_cost,expiry_date) SELECT $1,$2,id,10,10,5,now()+interval '2 days' FROM storage_locations WHERE name='ตู้พักละลาย'",
    [header, ingredientId],
  )

  const table = (await one('INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id', [E2E_PREFIX])).id

  await pool.query(
    `UPDATE settings SET value = '100' WHERE key = 'buffet_price_adult'`,
  )

  await pool.end()
  console.log('E2E fixtures seeded:', { ownerId: owner.id, ingredientId, table })
}

export default main
