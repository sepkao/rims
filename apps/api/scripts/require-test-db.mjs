if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is required. Use a dedicated migrated test database; application DATABASE_URL is never used as fallback.')
  process.exitCode = 1
}
