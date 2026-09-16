---
name: backend-patterns
description: Layered class-based architecture (routes → controllers → services), SOLID principles, constructor dependency injection, Prisma data-access patterns, and error handling for this Express 5 + Prisma + valibot service. Use when implementing or reviewing any feature module or shared infrastructure.
---

# Backend Architecture Patterns

House architecture for fitness-gh-backend. HTTP-contract conventions (URLs, status codes, envelopes, pagination)
live in [`api-design/SKILL.md`](../api-design/SKILL.md); tenant isolation is
[`multi-tenancy/SKILL.md`](../multi-tenancy/SKILL.md) — **read that one before writing any query**. This skill
covers how the code is structured.

> **Target state.** The repository does not follow this yet — see
> [`codebase-review.md`](../codebase-review.md) §4 (M-01 through M-05) for what diverges and
> [`implementation-plan.md`](../implementation-plan.md) Phase 1 and 4 for the migration. New code follows this skill;
> touched code is brought up to it.

## When to Activate

- Implementing or reviewing a feature module (routes, controllers, services)
- Adding shared infrastructure (middlewares, errors, core utilities)
- Writing Prisma queries or transactions, or fixing an N+1
- Deciding where a piece of logic belongs

## Layered Architecture

Every feature module under `src/api/<feature>/` has exactly these layers:

```
routes/<feature>.route.ts             # Route class extending BaseRoute — paths + middleware chain only
controllers/<feature>.controller.ts   # Controller class — HTTP in/out, no business logic
services/<feature>.service.ts         # Service class — business logic + Prisma, no req/res
validations/<feature>.validation.ts   # valibot schemas + inferred input types
types/<feature>.types.ts              # response shapes and serialiser output types
```

Request flow:

```
routes → authenticate → tenantScope → can(permission) → validate → controller → service → prisma
```

Layer rules (Single Responsibility):

- **Routes** declare paths and compose middleware. Nothing else. No inline handlers.
- **Controllers** translate HTTP ↔ domain: read already-validated input, call the service, choose the status code
  and envelope helper. They never call Prisma, never contain business rules, and **never contain `try/catch`** —
  Express 5 forwards rejected promises to the error handler.
- **Services** own business rules and data access. They receive a tenant-scoped db handle and plain input objects,
  return domain data, and throw `AppError` subclasses. They never touch `req`/`res`.
- **Validations** are the only place request shapes are defined; validation runs as **middleware before the
  controller** — not `parse()` inside the controller (which is what the current code does, and the reason there are
  60 redundant `try/catch` blocks).

## Class-Based Modules with Dependency Injection

Services and controllers are classes with constructor-injected dependencies that default to the shared singletons.
Callers get a ready instance; tests get a seam for fakes (Dependency Inversion).

```typescript
// services/plans.service.ts
import type { TenantClient } from '@/config/prisma.config.js'
import { NotFoundError } from '@/errors/index.js'
import type { CreatePlanInput, UpdatePlanInput } from '../validations/plans.validation.js'

export class PlansService {
  async listForGym(db: TenantClient, gymId: string, page: Pagination) {
    const [rows, total] = await Promise.all([
      db.subscriptionPlan.findMany({
        where: { gymId, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: page.skip,
        take: page.perPage,
      }),
      db.subscriptionPlan.count({ where: { gymId, archivedAt: null } }),
    ])
    return { rows, total }
  }

  async update(db: TenantClient, gymId: string, planId: string, input: UpdatePlanInput) {
    // Scope the child by its parent — see multi-tenancy/SKILL.md rule 3
    const plan = await db.subscriptionPlan.findFirst({ where: { id: planId, gymId } })
    if (!plan)
      throw new NotFoundError('Subscription plan not found')
    return db.subscriptionPlan.update({ where: { id: plan.id }, data: input })
  }
}

export const plansService = new PlansService()
```

The tenant-scoped client is passed **per request**, not injected at construction — it is request state, not a
dependency. Anything genuinely injectable (a mailer, a payment provider, a clock) goes in the constructor:

```typescript
export class MembershipsService {
  constructor(
    private readonly mailer: Mailer = mailerService,
    private readonly clock: () => Date = () => new Date(),
  ) {}
}
```

```typescript
// controllers/plans.controller.ts
import type { Request, Response } from 'express'
import { sendCreated, sendPaginated } from '@/core/http-responses.js'
import { PlansService, plansService } from '../services/plans.service.js'

export class PlansController {
  constructor(private readonly service: PlansService = plansService) {}

  // Arrow properties keep `this` bound when passed as route handlers.
  // Prototype methods (what the codebase uses today) silently lose `this` — see M-02.
  listPlans = async (req: Request, res: Response): Promise<void> => {
    const { rows, total } = await this.service.listForGym(req.db, param(req, 'gymId'), req.page)
    sendPaginated(res, rows.map(toPlanResponse), total, req.page)
  }

  createPlan = async (req: Request, res: Response): Promise<void> => {
    const plan = await this.service.create(req.db, param(req, 'gymId'), req.body)
    sendCreated(res, toPlanResponse(plan), `/api/v1/gyms/${param(req, 'gymId')}/plans/${plan.id}`)
  }
}

export const plansController = new PlansController()
```

```typescript
// routes/plans.route.ts
import { BaseRoute } from '@/core/base-route.js'
import { authenticate } from '@/middlewares/auth.middleware.js'
import { tenantScope } from '@/middlewares/tenant-scope.middleware.js'
import { can } from '@/middlewares/permission.middleware.js'
import { paginate } from '@/middlewares/paginate.middleware.js'
import { validateBody, validateParams } from '@/middlewares/validate-request.middleware.js'
import { plansController } from '../controllers/plans.controller.js'
import { createPlanSchema, gymPlanParamsSchema, updatePlanSchema } from '../validations/plans.validation.js'

class PlansRoute extends BaseRoute {
  protected initializeRoutes(): void {
    this.router.use(authenticate, tenantScope, validateParams(gymPlanParamsSchema))

    // Routes declare the PERMISSION they need. Which roles hold it is data, not code.
    this.router.get('/', paginate, can('plan:read'), plansController.listPlans)
    this.router.post('/', can('plan:write'), validateBody(createPlanSchema), plansController.createPlan)
    this.router.patch('/:planId', can('plan:write'), validateBody(updatePlanSchema), plansController.updatePlan)
    this.router.delete('/:planId', can('plan:archive'), plansController.archivePlan)
  }
}

export const plansRouter = new PlansRoute().getRouter()
```

`BaseRoute` (in `src/core/base-route.ts`) provides the configured router and forces each module to declare routes in
`initializeRoutes()`, so a new module is added without modifying existing ones (Open/Closed).

**Trim `BaseRoute` to that.** Its current `get`/`post`/`put`/`delete`/`patch`/`use` wrappers add nothing over
`this.router.*` while hiding the middleware chain, and its `asyncHandler` and `validate` helpers are dead weight
under Express 5 (rejections auto-forward) and wrong (`validate` writes a bare `{ error }` response, bypassing the
error handler entirely).

## SOLID Mapping

| Principle | Where it shows up |
|---|---|
| **S**ingle Responsibility | Route/controller/service/validation split; errors become responses only in `error-handler`; envelopes written only by `core/http-responses.ts`; validation only in middleware |
| **O**pen/Closed | New feature = new `BaseRoute` subclass mounted in `src/api/index.ts`; the error handler works for any new `AppError` subclass (status and code travel on the instance — no switch to edit); a new payment provider implements `PaymentProvider` without touching the payments service |
| **L**iskov Substitution | Every `AppError` subclass is usable wherever `AppError` is expected; a service given a fake db handle behaves identically to one given the real client |
| **I**nterface Segregation | Controllers see only their service's methods; middlewares are small single-purpose functions composed per route (`authenticate`, `tenantScope`, `can('plan:write')`, `validateBody(x)`) |
| **D**ependency Inversion | Services depend on the `TenantClient` type, not a concrete client; controllers depend on services via constructor with singleton defaults; the payments service depends on the `PaymentProvider` interface |

**Guardrails against over-engineering.** No repository layer on top of Prisma — Prisma *is* the data-access
abstraction, and an `IPlanRepository` would duplicate its API for zero value (introduce one only if a second data
source appears). No DI container — constructor defaults do the job at this scale. No CQRS, no event sourcing, no
GraphQL layer.

## Error Handling

One hierarchy in `src/errors/`, one translation point in `src/middlewares/error-handler.middleware.ts`:

```
AppError(message, statusCode, code, details?)
├── ValidationError     422 validation_error   (carries field-level details)
├── UnauthorizedError   401 unauthorized
├── ForbiddenError      403 forbidden
├── NotFoundError       404 not_found
├── ConflictError       409 conflict
└── RateLimitError      429 rate_limit_exceeded
```

- Services throw; nothing below the error handler writes an error response. (Today `UserController` writes its own
  status codes and swallows errors — M-04. Don't.)
- `code` is a stable machine-readable string. The frontend switches on `code`, never on `message`.
- The handler also translates infra errors that escape services: Prisma `P2002` → 409, `P2025` → 404, `P2003` → 409,
  malformed JSON → 400, everything else → an **opaque 500**: log the internals with the request id, return
  `{ error: { code: 'internal_error', message: 'Something went wrong', requestId } }`.
- **Never** put `stack`, `details` from a Prisma error, or raw validator internals in a response (C-06).
- Async middleware and handlers need no wrapper — Express 5 forwards rejections. Delete `async-handler.middleware.ts`.

```typescript
// src/errors/app.error.ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = new.target.name
    Error.captureStackTrace?.(this, new.target)
  }
}

// src/errors/not-found.error.ts
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'not_found') {
    super(message, 404, code)
  }
}
```

Note the shape: **positional arguments, all required fields non-optional**. The current
`CustomError({ message, status?, success?, data?, details?, stack? })` makes every field optional and `any`, which
is why the handler needs `customError.status!`.

## Prisma Patterns

**Always use the tenant-scoped handle.** `req.db` (from `tenantScope`), never the bare `prisma` import, except in
the three named unscoped paths — authentication, the public gym directory, platform administration. See
[`multi-tenancy/SKILL.md`](../multi-tenancy/SKILL.md).

**Select what you return.** List endpoints must not `findMany()` bare. Select or include exactly the shape the
response needs, and never let `passwordHash`, `otpHash`, or member body metrics out of a service. Each module owns a
serialiser (`toPlanResponse`, `toPublicProfile`) — the Prisma row is never the response.

**N+1 prevention.** Relations are fetched in one query, never in a loop:

```typescript
// BAD: 1 + N queries
const memberships = await db.membership.findMany({ where: { gymId } })
for (const m of memberships) m.plan = await db.subscriptionPlan.findUnique({ where: { id: m.planId } })

// GOOD: one query
const memberships = await db.membership.findMany({
  where: { gymId },
  include: { plan: { select: { id: true, name: true, price: true } } },
})
```

Note `getMyGyms` in the current gym controller issues two sequential awaits that could be one `Promise.all` — and
`getUserPayments` includes a nested `membership.plan` without selecting fields, pulling whole rows.

**Transactions for multi-step writes.** Anything that must succeed or fail together runs in `db.$transaction`.

**Guarded updates for check-then-write races.** A read, a check, and then a write is a race — the marketplace's
stock check (H-03) is exactly this bug. Do the check *in* the write and treat zero affected rows as a conflict:

```typescript
// BAD — two concurrent orders both pass the check and both decrement
const product = await db.product.findUnique({ where: { id } })
if (product.stock < qty) throw new ConflictError('Insufficient stock')
await db.product.update({ where: { id }, data: { stock: { decrement: qty } } })

// GOOD — the database arbitrates
const updated = await tx.$executeRaw`
  UPDATE products SET stock = stock - ${qty}
  WHERE id = ${id} AND stock >= ${qty}`
if (updated === 0)
  throw new ConflictError('Insufficient stock', 'insufficient_stock')
```

The same pattern applies to class-session capacity (Phase 6) and to any visit-cap decrement.

**Sequences, not timestamps, for human-readable numbers.** `ORD-${Date.now()}-${Math.random()…}` collides and
leaks timing. Use a per-organisation counter table with `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the
creating transaction.

**Snapshot prices; compute everything else.** `Membership` stores the plan's `price`/`duration` **as at creation**
so a later price edit can't rewrite history — the same reason invoices snapshot line items. Everything genuinely
derivable is *not* stored: no `available` column, no `EXPIRED` flag alongside `endDate`, no `rating` column without
a `Review` table behind it (the current `Product.rating`/`reviewCount` are permanently zero — M-06).

**Money is `Decimal`, never `Float`** (H-01). Do arithmetic through `src/utils/money.util.ts`; Decimals serialise
to JSON as strings.

## Shared Infrastructure Map

```
src/config/       *.config.ts — env (fail-fast valibot parse), prisma (singleton + tenantDb), logger, mailer
src/core/         base-route.ts, http-responses.ts, pagination.ts, permissions.ts (catalogue),
                  permission-resolver.ts, public-routes.ts, constants.ts
src/errors/       AppError hierarchy (one class per file + index barrel)
src/middlewares/  *.middleware.ts — request-id, request-logger, rate-limit, auth, tenant-scope, gym-role,
                  validate-request, paginate, not-found, error-handler
src/utils/        *.util.ts — money, slug, otp, password — pure stateless helpers
src/types/        express.d.ts (Request augmentation: auth, tenant, db, page, permissions)
```

- **`env.config.ts` is the only reader of `process.env`** (the `node/no-process-env` rule already exists; it is
  currently disabled at the top of that file and bypassed by `email.service.ts`). Never re-export `process.env`
  itself.
- **`prisma.config.ts` is the only constructor of `PrismaClient`**, guarded on `globalThis` so hot reload and cold
  starts don't open new pools. The Prisma **CLI** config belongs at the repo root, not in `src/config/`.
- **`core/http-responses.ts` is the only writer of response envelopes.** No hand-built `{ success, data }` in a
  controller, and delete `utils/response.util.ts`.
- **The logger is the only output path.** No bare `console.*` outside `env.config.ts` (which runs before the logger
  exists). Never log secrets, tokens, OTPs, or PII.
- Utils stay pure functions — they earn a class only when they acquire state or need substitution in tests.
- Imports use the `@/` alias for anything outside the current feature; relative paths only within a feature. The
  alias is configured today but unused — source files use `../../../core/services/...` chains (M-12).
- Augment `Request` in `src/types/express.d.ts`. Do not use per-module `AuthenticatedRequest` casts
  (`(req as AuthenticatedRequest).profileId`) — the cast asserts a property the type system can't guarantee is
  there, which is how `profileId` ends up checked for `undefined` in 12 separate controller methods.

## Module checklist

Before opening a PR for a feature module:

- [ ] Route class extends `BaseRoute`; mounted in `src/api/index.ts`; no inline handlers
- [ ] `authenticate` + `tenantScope` applied (or the path is on the public allowlist, deliberately)
- [ ] `can(permission)` on every gym-scoped route — a permission, never a role name or a rank
- [ ] Body, query, and params validated by middleware; strict schemas reject unknown keys
- [ ] Controller: arrow properties, no Prisma, no business logic, no `try/catch`, envelope via `core/http-responses`
- [ ] Service: takes `TenantClient`; every child lookup scoped by its parent; throws `AppError` subclasses
- [ ] Lists paginated; responses go through a serialiser (no raw Prisma rows, no `passwordHash`)
- [ ] Multi-step writes in a transaction; check-then-write replaced by a guarded update
- [ ] Money as `Decimal` via `money.util.ts`
- [ ] Tests: happy path · 422 · 401 · 403 (wrong role) · **404 cross-tenant** · 409 state conflict
- [ ] [`openapi.yaml`](../openapi.yaml) updated in the same commit
