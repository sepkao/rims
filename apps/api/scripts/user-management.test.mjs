import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// Must run before any other integration test inserts a user: the bootstrap
// flow only stays open while the users table is empty. This file is listed
// first in package.json's test:integration script for that reason.
test('Bootstrap and Owner user management use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-bootstrap-' + Date.now()
  const ids = { users: [] }
  let server
  try {
    const preexisting = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n
    assert.equal(preexisting, 0, 'expected an empty users table to exercise the bootstrap-open path; run this file before other integration tests')

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

    const bootstrapStatus = () => fetch(base + '/auth/bootstrap-status').then((r) => r.json())
    const register = (body) => fetch(base + '/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    let ownerCookie

    await t.test('registration is open while the users table is empty', async () => {
      assert.equal((await bootstrapStatus()).registrationOpen, true)
    })

    await t.test('register validates required fields and password length', async () => {
      assert.equal((await register({ email: 'a@example.test', password: 'longenough1' })).status, 400)
      assert.equal((await register({ name: 'A', email: 'a@example.test', password: 'short' })).status, 400)
    })

    await t.test('register creates the first account as owner and starts a session', async () => {
      const response = await register({ name: prefix + '-owner', email: prefix + '-owner@example.test', password: 'test-password' })
      assert.equal(response.status, 201)
      const body = await response.json()
      assert.equal(body.user.role, 'owner')
      ids.users.push(body.user.id)
      ownerCookie = response.headers.get('set-cookie')?.split(';')[0]
      assert.ok(ownerCookie, 'expected register to start a session')
    })

    await t.test('registration closes once an account exists', async () => {
      assert.equal((await bootstrapStatus()).registrationOpen, false)
      const response = await register({ name: 'Second Owner', email: prefix + '-second@example.test', password: 'test-password' })
      assert.equal(response.status, 403)
    })

    const asOwner = (path, method, body) => fetch(base + path, {
      method, headers: { Cookie: ownerCookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    })
    let staffId

    await t.test('owner can create staff and cashier accounts, but not another owner', async () => {
      const staffResponse = await asOwner('/owner/users', 'POST', { name: prefix + '-staff', email: prefix + '-staff@example.test', password: 'test-password', role: 'staff' })
      assert.equal(staffResponse.status, 201)
      staffId = (await staffResponse.json()).user.id
      ids.users.push(staffId)

      const cashierResponse = await asOwner('/owner/users', 'POST', { name: prefix + '-cashier', email: prefix + '-cashier@example.test', password: 'test-password', role: 'cashier' })
      assert.equal(cashierResponse.status, 201)
      ids.users.push((await cashierResponse.json()).user.id)

      const ownerAttempt = await asOwner('/owner/users', 'POST', { name: 'x', email: prefix + '-x@example.test', password: 'test-password', role: 'owner' })
      assert.equal(ownerAttempt.status, 400)
    })

    await t.test('GET /owner/users lists created accounts', async () => {
      const response = await asOwner('/owner/users', 'GET')
      assert.equal(response.status, 200)
      const emails = (await response.json()).users.map((u) => u.email)
      assert.ok(emails.includes((prefix + '-staff@example.test').toLowerCase()))
    })

    await t.test('owner can edit and disable a staff account; disabling blocks that account from logging in', async () => {
      const update = await asOwner('/owner/users/' + staffId, 'PUT', { isActive: false })
      assert.equal(update.status, 200)
      assert.equal((await update.json()).user.isActive, false)

      const loginAttempt = await fetch(base + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: prefix + '-staff@example.test', password: 'test-password' }),
      })
      assert.equal(loginAttempt.status, 401)
    })

    await t.test('owner accounts cannot be edited through this endpoint, even by themselves', async () => {
      const response = await asOwner('/owner/users/' + ids.users[0], 'PUT', { isActive: false })
      assert.equal(response.status, 403)
    })

    await t.test('a short password on update is rejected', async () => {
      const response = await asOwner('/owner/users/' + staffId, 'PUT', { password: 'short' })
      assert.equal(response.status, 400)
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
