import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

test('Auth/RBAC: login, session lifecycle, and role-gated routes use actual HTTP handlers', { skip: !process.env.TEST_DATABASE_URL, timeout: 60000 }, async (t) => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, connectionTimeoutMillis: 5000 })
  const prefix = 'integration-auth-' + Date.now()
  const ids = { users: [] }
  const one = async (sql, values = []) => (await pool.query(sql, values)).rows[0]
  let server
  try {
    const roles = ['owner', 'staff', 'cashier']
    for (const role of roles) {
      ids.users.push((await one(
        'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
        [prefix + '-' + role, prefix + '-' + role + '@example.test', await bcrypt.hash('test-password', 4), role],
      )).id)
    }
    const inactiveId = (await one(
      "INSERT INTO users(name,email,password_hash,role,is_active) VALUES($1,$2,$3,'staff',false) RETURNING id",
      [prefix + '-inactive', prefix + '-inactive@example.test', await bcrypt.hash('test-password', 4)],
    )).id
    ids.users.push(inactiveId)

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

    const login = (email, password) => fetch(base + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    const cookieFor = (response) => response.headers.get('set-cookie')?.split(';')[0]
    const withCookie = (path, cookie) => fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} })

    await t.test('login succeeds for each role and returns that role', async () => {
      for (const role of roles) {
        const response = await login(prefix + '-' + role + '@example.test', 'test-password')
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.equal(body.user.role, role)
        assert.ok(cookieFor(response), 'expected a session cookie to be set')
      }
    })

    await t.test('login rejects wrong password, unknown email, and inactive users', async () => {
      assert.equal((await login(prefix + '-owner@example.test', 'wrong-password')).status, 401)
      assert.equal((await login(prefix + '-does-not-exist@example.test', 'test-password')).status, 401)
      assert.equal((await login(prefix + '-inactive@example.test', 'test-password')).status, 401)
    })

    const cookies = {}
    for (const role of roles) {
      cookies[role] = cookieFor(await login(prefix + '-' + role + '@example.test', 'test-password'))
    }

    await t.test('/auth/session reflects the logged-in user and rejects anonymous requests', async () => {
      const response = await withCookie('/auth/session', cookies.owner)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).user.role, 'owner')
      assert.equal((await withCookie('/auth/session', null)).status, 401)
    })

    await t.test('/auth/logout invalidates the session', async () => {
      const loginResponse = await login(prefix + '-cashier@example.test', 'test-password')
      const cashierCookie = cookieFor(loginResponse)
      assert.equal((await withCookie('/auth/session', cashierCookie)).status, 200)
      const logoutResponse = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: cashierCookie } })
      const clearedCookie = cookieFor(logoutResponse)
      assert.equal((await withCookie('/auth/session', clearedCookie)).status, 401)
    })

    const rbacMatrix = [
      { path: '/owner/users', allowed: ['owner'] },
      { path: '/inventory/ingredients', allowed: ['owner', 'staff'] },
      { path: '/cashier/dining-tables', allowed: ['cashier'] },
      { path: '/staff/orders', allowed: ['owner', 'staff'] },
    ]

    await t.test('role-gated route prefixes enforce their allowed roles', async () => {
      for (const { path, allowed } of rbacMatrix) {
        assert.equal((await withCookie(path, null)).status, 401, `${path} should require a session`)
        for (const role of roles) {
          const status = (await withCookie(path, cookies[role])).status
          if (allowed.includes(role)) assert.equal(status, 200, `${role} should be allowed on ${path}`)
          else assert.equal(status, 403, `${role} should be forbidden on ${path}`)
        }
      }
    })
  } finally {
    if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped }
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids.users])
    await pool.end()
  }
})
