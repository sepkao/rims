import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// Every customer page shares findCustomerSession(qrCode, requireUnexpired).
// Ordering/browsing (menu-items) requires an unexpired session; the grace-period
// pages (session status, call-staff) intentionally still work after expiry as
// long as the session hasn't been ended. This proves that split holds for real.
test('QR lifecycle: active vs expired (grace period) vs ended, across the customer endpoints', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-qr-' + Date.now()
  const ids = { users: [], tables: [], sessions: [], orders: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    ids.users.push((await one("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'cashier') RETURNING id", [prefix, prefix + '@example.test', await bcrypt.hash('test-password', 4)])).id)

    // check_expires_after_start requires expires_at > started_at, so an
    // "already expired" fixture needs started_at pushed into the past too.
    const makeSession = async (qrCode, startedAgo, expiresAgo, ended = false) => {
      const table = (await one("INSERT INTO dining_tables(table_number) VALUES($1) RETURNING id", [qrCode])).id
      ids.tables.push(table)
      const session = (await one(
        `INSERT INTO table_sessions(dining_table_id,qr_code,opened_by,started_at,expires_at,adult_count,ended_at)
         VALUES($1,$2,$3,now()+$4::interval,now()+$5::interval,1,$6) RETURNING id`,
        [table, qrCode, ids.users[0], startedAgo, expiresAgo, ended ? new Date() : null],
      )).id
      ids.sessions.push(session)
      return session
    }
    const activeQr = prefix + '-active'
    const expiredQr = prefix + '-expired'
    const endedQr = prefix + '-ended'
    await makeSession(activeQr, '-1 minute', '1 hour')
    await makeSession(expiredQr, '-2 hours', '-1 minute')
    await makeSession(endedQr, '-2 hours', '-1 minute', true)

    let output = ''
    server = spawn(process.execPath, [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: 'production', PORT: '0', SESSION_SECRET: 'integration-only-session-secret-123456' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', (data) => { output += data })
    server.stderr.on('data', (data) => { output += data })
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { clearInterval(poll); reject(new Error('API startup timeout: ' + output)) }, 10000)
      const poll = setInterval(() => {
        const match = output.match(/http:\/\/localhost:(\d+)/)
        if (match) { clearInterval(poll); clearTimeout(timeout); resolve('http://127.0.0.1:' + match[1]) }
      }, 20)
    })
    const menuItems = (qr) => fetch(base + '/customer/menu-items?qr_code=' + qr)
    const session = (qr) => fetch(base + '/customer/session?qr_code=' + qr)
    const callStaff = (qr) => fetch(base + '/customer/call-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: qr }) })

    await t.test('an active QR can browse the menu and reports status active', async () => {
      assert.equal((await menuItems(activeQr)).status, 200)
      assert.equal((await (await session(activeQr)).json()).session.status, 'active')
    })

    await t.test('an expired-but-not-ended QR is blocked from ordering, but grace-period pages still work', async () => {
      assert.equal((await menuItems(expiredQr)).status, 410)
      assert.equal((await (await session(expiredQr)).json()).session.status, 'expired')
      assert.equal((await callStaff(expiredQr)).status, 200)
    })

    await t.test('an ended session is fully closed everywhere, regardless of expiry', async () => {
      assert.equal((await menuItems(endedQr)).status, 410)
      assert.equal((await session(endedQr)).status, 404)
      assert.equal((await callStaff(endedQr)).status, 410)
    })

    await t.test('order cancel respects both the session expiry and the confirm_at window', async () => {
      const menu = (await one('INSERT INTO menu_items(name) VALUES($1) RETURNING id', [prefix])).id
      ids.menuItem = menu
      const activeSessionId = ids.sessions[0]
      const withinWindow = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()+interval '30 seconds') RETURNING id", [activeSessionId])).id
      const pastWindow = (await one("INSERT INTO orders(table_session_id,confirm_at) VALUES($1,now()-interval '5 seconds') RETURNING id", [activeSessionId])).id
      ids.orders.push(withinWindow, pastWindow)

      const cancel = (orderId, qr) => fetch(base + '/customer/orders/' + orderId + '/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrCode: qr }),
      })
      assert.equal((await cancel(pastWindow, activeQr)).status, 400) // confirm_at already passed
      assert.equal((await cancel(withinWindow, expiredQr)).status, 400) // session itself is expired
      assert.equal((await cancel(withinWindow, activeQr)).status, 200)
      assert.equal((await one("SELECT status FROM orders WHERE id = $1", [withinWindow])).status, 'cancelled')
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM orders WHERE id = ANY($1::bigint[])', [ids.orders])
    if (ids.menuItem) await pool.query('DELETE FROM menu_items WHERE id = $1', [ids.menuItem])
    await pool.query('DELETE FROM table_sessions WHERE id = ANY($1::bigint[])', [ids.sessions])
    await pool.query('DELETE FROM dining_tables WHERE id = ANY($1::bigint[])', [ids.tables])
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
