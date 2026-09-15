---
name: testing
description: Test strategy for this Express 5 + Prisma service — vitest + supertest integration tests against a dedicated test database, the six-case matrix every endpoint must satisfy, fixture helpers, two-tenant isolation fixtures, and what to unit-test versus integration-test. Use when writing tests, setting up the harness, or reviewing test coverage on a PR.
---

# Testing

The repository currently has **three tests in two files**, one of which is a verbatim duplicate, and they assert
`GET /` and a 404 (finding M-11). Nothing exercises auth, tenancy, payments, or any service. That means none of the
Critical findings in [`codebase-review.md`](../codebase-review.md) would be caught by the suite if reintroduced.

This skill defines the harness and the coverage bar. It is a prerequisite for the refactor:
**nothing gets refactored before there is a test around it.**

## When to Activate

- Writing tests for a new or refactored endpoint
- Setting up or changing the test harness, fixtures, or CI
- Reviewing whether a PR's coverage is adequate
- Fixing a flaky test

## Stack and layout

`vitest` + `supertest`, hitting the exported `app` — **never** a listening server.

```
test/
  setup.ts                    # global setup: env, DB reset, logger silence
  helpers.ts                  # fixture factories + auth header + cleanup
  fixtures/
    organisation.ts           # seedOrganisation() → a complete isolated tenant
  security/                   # regression tests for each Critical finding, by ID
    payments-webhook.test.ts
    user-ownership.test.ts
    tenant-isolation.test.ts
  api/
    auth.test.ts
    gyms.test.ts
    plans.test.ts
    memberships.test.ts
    check-ins.test.ts
  acceptance/
    mvp-acceptance.test.ts    # one block per AC-xx in the requirements doc
  unit/
    money.util.test.ts        # pure functions only
    permissions.test.ts       # catalogue integrity + canGrant
```

Delete `test/api.test.ts` (duplicate) and `jest.config.ts` (dead — the project runs vitest and the file is
CommonJS in an ESM package).

## The test database

**Never run the suite against the dev database.** A `cleanupTestData()` that deletes by prefix is one typo away
from wiping development data, and a shared remote DB makes the suite slow and flaky.

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,        // shared DB state — files must not race
    testTimeout: 15_000,
    env: { NODE_ENV: 'test' },
  },
})
```

- `DATABASE_URL` comes from `.env.test`, pointing at a **separate database** (local Postgres in Docker, or a
  dedicated Prisma Postgres branch). CI uses a service container.
- `test/setup.ts` runs `prisma migrate deploy` once, then truncates all tables between files.
- Truncate in FK order (or `TRUNCATE … CASCADE`) rather than deleting by prefix — prefix matching is what forces
  the "shared dev DB" compromise in the first place.
- The logger is `silent` under `NODE_ENV=test`, and the request logger is not mounted — the current suite prints
  morgan access logs and a full `NotFoundError` dump, which hides real failures.
- Rate limiters are production-only, so they do not interfere. Test the limiter itself by mounting it directly in
  one focused test.

## The six-case matrix

**Every endpoint gets all six.** This is the coverage bar for a PR:

| # | Case | Expect |
|---|---|---|
| 1 | Happy path | 200/201/204 + correct body and `Location` |
| 2 | Validation failure | **422** with `details[].field` |
| 3 | Unauthenticated | **401** |
| 4 | Wrong role, own tenant | **403** |
| 5 | **Cross-tenant** | **404** — not 403, not 200 |
| 6 | State conflict / duplicate | **409** |

Cases 5 and 6 are the ones that would have caught the findings. Case 5 is non-negotiable for anything gym-scoped;
case 6 applies wherever there is a status machine or a unique constraint.

Where a case genuinely doesn't apply (a public endpoint has no case 3–5), say so in a comment rather than omitting
it silently.

## Two-tenant fixtures

Tenant isolation can only be tested if two complete tenants exist. Make that one call:

```ts
// test/fixtures/organisation.ts
export async function seedOrganisation(opts: { slug: string }) {
  const owner = await createAccount({ email: `owner@${opts.slug}.test`, platformRole: 'USER' })
  const org = await prisma.organisation.create({ data: { name: opts.slug, slug: opts.slug } })
  const gym = await prisma.gym.create({ data: { organisationId: org.id, name: `${opts.slug} gym`, /* … */ } })
  await prisma.organisationMember.create({
    data: { organisationId: org.id, profileId: owner.profile.id, roleId: await systemRoleId('owner') },
  })
  const manager = await createEmployee(gym, 'manager')
  const receptionist = await createEmployee(gym, 'receptionist')
  const trainer = await createEmployee(gym, 'trainer')     // needed for the disjoint-permission tests
  const staff = await createEmployee(gym, 'staff')
  const plan = await createPlan(gym, { price: '250.00' })
  const member = await createMember(gym, plan)
  return { org, gym, owner, manager, receptionist, trainer, staff, plan, member }
}
```

Then the isolation suite is a table, not fifty hand-written tests:

```ts
const a = await seedOrganisation({ slug: 'test-org-a' })
const b = await seedOrganisation({ slug: 'test-org-b' })

const GYM_SCOPED = [
  { method: 'get',    path: (f) => `/api/v1/gyms/${f.gym.id}/plans/${f.plan.id}` },
  { method: 'patch',  path: (f) => `/api/v1/gyms/${f.gym.id}/plans/${f.plan.id}`, body: { price: 1 } },
  { method: 'delete', path: (f) => `/api/v1/gyms/${f.gym.id}/plans/${f.plan.id}` },
  { method: 'patch',  path: (f) => `/api/v1/gyms/${f.gym.id}/memberships/${f.member.membership.id}`, body: { status: 'ACTIVE' } },
  { method: 'post',   path: (f) => `/api/v1/gyms/${f.gym.id}/memberships/${f.member.membership.id}/cancel` },
  { method: 'patch',  path: (f) => `/api/v1/gyms/${f.gym.id}/employees/${f.manager.employment.id}`, body: { roleId: null } },
  { method: 'delete', path: (f) => `/api/v1/gyms/${f.gym.id}/employees/${f.manager.employment.id}` },
] as const

describe('tenant isolation', () => {
  it.each(GYM_SCOPED)('$method $path → 404 for another tenant', async ({ method, path, body }) => {
    await request(app)[method](path(a))              // A's resource…
      .set(authHeaderFor(b.owner))                   // …with B's credentials
      .send(body ?? {})
      .expect(404)
  })

  it.each(GYM_SCOPED)('$method $path → mixing A gym with B child id → 404', async ({ method, path }) => {
    // The finding C-04 shape: authorise your own parent, pass a foreign child id
    const mixed = path(a).replace(a.plan.id, b.plan.id)
    await request(app)[method](mixed).set(authHeaderFor(a.owner)).send({}).expect(404)
  })

  it('ignores X-Organisation-Id from a non-platform user', async () => {
    const res = await request(app).get(`/api/v1/gyms`)
      .set(authHeaderFor(b.owner))
      .set('X-Organisation-Id', a.org.id)
      .expect(200)
    expect(res.body.data.map((g: any) => g.id)).not.toContain(a.gym.id)
  })
})
```

Add a route to `GYM_SCOPED` when you add a gym-scoped endpoint. The list *is* the tenancy audit.

Alongside isolation, assert authorisation for each endpoint: a role **lacking the required permission** gets 403
`insufficient_permission` within its own organisation — including the two cases a rank-based role model gets wrong
(a `trainer` attempting `payment:collect` or `membership:write`, a `receptionist` attempting `class:write`);
`SUPER_ADMIN` succeeds with `X-Organisation-Id` and is refused without it; and an `X-Organisation-Id` header sent
by an ordinary organisation user is **ignored** (the test above).

## The route-guard test

Cheaper and more reliable than review discipline: enumerate what's actually mounted and assert the guards.

```ts
it('every mounted route is authenticated and tenant-scoped unless allowlisted', () => {
  for (const route of enumerateRoutes(app)) {
    if (PUBLIC_ROUTES.some(p => p.matches(route))) continue
    const names = route.stack.map(l => l.name)
    expect(names, `${route.method} ${route.path}`).toContain('authenticate')
    expect(names, `${route.method} ${route.path}`).toContain('tenantScope')
  }
})
```

Pair it with one that fails when a model gains an `organisationId` column but is missing from the scoped
accessor's `TENANT_MODELS` allowlist.

## Security regression tests

One file per Critical finding, named by ID, asserting the exploit no longer works. These must **fail against the
pre-fix code** — write them first, watch them fail, then fix. Minimum set:

```ts
// test/security/payments-webhook.test.ts  — C-01
it('rejects an unsigned webhook', () => post('/payments/webhook', body).expect(401))
it('rejects a tampered signature', …)
it('is a no-op on replay', …)                          // same reference twice → one activation
it('ignores a client-supplied amount', async () => {
  const res = await post('/payments/initiate', { gymId, membershipId, amount: 0.01 })
  expect(res.body.data.amount).toBe('250.00')          // derived from the plan, not the body
})
it('refuses a membershipId belonging to another profile', …).expect(404)

// test/security/user-ownership.test.ts  — C-03, C-05
it('a member cannot patch another profile', …).expect(403)
it('a member cannot list all accounts', …).expect(403)
it('unauthenticated profile read is rejected', …).expect(401)
it('a public profile omits body metrics', async () => {
  expect(res.body.data).not.toHaveProperty('weight')
})

// test/security/errors.test.ts  — C-06
it('never returns a stack trace', async () => {
  expect(JSON.stringify(res.body)).not.toContain('at ')
  expect(res.body.error).not.toHaveProperty('stack')
})

// test/security/otp.test.ts  — C-08
it('locks a code after 5 failed attempts', …).expect(429)
it('returns false when no account matches the email', …)
```

## Concurrency tests

Two of the findings are races (H-03 marketplace stock, and any capacity or visit-cap decrement). A race needs a
concurrent test — a sequential one passes against the broken code:

```ts
it('sells the last unit exactly once', async () => {
  await setStock(product.id, 1)
  const results = await Promise.allSettled([order(product, 1), order(product, 1)])
  const created = results.filter(r => r.status === 'fulfilled' && r.value.status === 201)
  expect(created).toHaveLength(1)
  expect(await stockOf(product.id)).toBe(0)            // never negative
})
```

## Unit versus integration

**Integration (supertest) is the default.** It covers the middleware chain, the tenancy layer, validation, and the
real Prisma query — which is where the bugs in this codebase live. A service unit test with a mocked Prisma client
would have passed for every one of C-01 through C-08.

**Unit-test only:**
- Pure functions: `money.util.ts`, slug generation, duration/end-date arithmetic (the
  `calculateEndDate` month-arithmetic edge cases — 31 Jan + 1 month — deserve a focused test)
- The status machines: legal and illegal transitions as a table
- The permission catalogue and `canGrant`: assert the seeded `trainer` and `receptionist` roles are **disjoint
  except for reads**, that `canGrant` refuses any permission the caller does not hold, and that a persisted
  `role_permissions` key outside the code catalogue is rejected with 422
- Serialisers: assert the forbidden fields are absent

Unit tests need the constructor-injection seam from
[`backend-patterns/SKILL.md`](../backend-patterns/SKILL.md) — inject a fake clock and a fake mailer, not a fake
Prisma client.

## Acceptance tests

One `describe` block per acceptance criterion ID in
[`Fitness_GH_Requirements_and_MVP.md`](../Fitness_GH_Requirements_and_MVP.md), named with the ID so a failure
points at a requirement:

```ts
describe('AC-04 — a member can self-enrol and pay for a plan', () => { /* … */ })
```

This is the suite that answers "is the MVP done".

## Flakiness

- `fileParallelism: false` while the suite shares one database.
- Never assert on wall-clock `Date.now()`; inject the clock.
- Never depend on row ordering without an explicit `orderBy`.
- Seed data per test file, truncate between files; don't rely on state from a previous file.
- If a test is flaky, fix it or delete it. A quarantined flaky test teaches the team to ignore red.

## CI gate

`.github/workflows/ci.yml` on every PR, required on `main`:

```yaml
- pnpm install --frozen-lockfile
- pnpm lint          # must actually run — see M-10
- pnpm typecheck
- pnpm test          # against a Postgres service container
```

No merge on red. This does not exist today, which is why `pnpm lint` has been broken without anyone noticing.

## Coverage targets

Percentages are a poor proxy; use these instead:

- **100%** of gym-scoped endpoints have a cross-tenant 404 test
- **100%** of Critical findings have a named regression test
- **100%** of status machines have an illegal-transition test
- **Every** key in `PERMISSION_CATALOGUE` is checked by at least one route, and every `can(...)` argument in the
  route tree exists in the catalogue — two CI tests, catching drift in both directions
- **Every** permission is asserted both granted and denied at least once
- Custom-role editing covered: create, clone a system role, escalation refusal, self-lockout refusal, and the
  archive-while-in-use conflict
- **Every** money path has an exact-value assertion (no `toBeCloseTo`)
- Every endpoint in [`openapi.yaml`](../openapi.yaml) is reachable from at least one test
