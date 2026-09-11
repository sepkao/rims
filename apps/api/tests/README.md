# Database regression tests

Use a dedicated PostgreSQL 16 database with pg_cron. Never point TEST_DATABASE_URL at production.
The CI Dockerfile installs pg_cron but disables execution of scheduled jobs to keep tests deterministic.

CI verifies a fresh schema, an untracked installation, an explicit baseline through migration 0020,
the upgrade to the latest migration, and a second no-op migration run. Missing migrations fail --check;
checking never creates the tracking table. Bootstrap without --through is rejected.

To run locally, build `apps/api/tests/Dockerfile.postgres`, start it with POSTGRES_DB=rims_test and
POSTGRES_PASSWORD set, then set DATABASE_URL and TEST_DATABASE_URL to that disposable database.
Run `npm run db:migrate --workspace api`, then `npm run test:integration --workspace api`.
The integration command fails if TEST_DATABASE_URL is absent, rather than silently passing skipped tests.

Tests cover actual PostgreSQL locking, partial deduction rollback, duplicate confirmation,
legacy ownerless claims, and actual HTTP staff ownership, return reasons, stock restoration,
checkout rejection and duplicate-payment prevention. Test fixtures are removed after each suite.

For an existing untracked installation, manually verify its last applied migration and run:
`npm run db:migrate:bootstrap --workspace api -- --through=EXACT_VERIFIED_FILENAME.sql`.
Do not choose the newest filename unless its SQL has actually been applied. Then run db:migrate.
Tracked installations can run db:migrate directly. Back up the database before deployment.
