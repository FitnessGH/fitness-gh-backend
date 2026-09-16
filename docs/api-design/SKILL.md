---
name: api-design
description: REST API design and implementation patterns for this Express 5 + valibot + Prisma service — resource naming, status codes, response envelopes, pagination, filtering, error responses, versioning, and rate limiting. Use when designing, implementing, or reviewing any HTTP endpoint.
---

# API Design

The HTTP contract for fitness-gh-backend. Code structure is
[`backend-patterns/SKILL.md`](../backend-patterns/SKILL.md); tenant isolation is
[`multi-tenancy/SKILL.md`](../multi-tenancy/SKILL.md). The authoritative endpoint list is
[`openapi.yaml`](../openapi.yaml) — **keep it in sync with every endpoint change.**

> **Target state.** The current API uses a different envelope and has no pagination — see
> [`codebase-review.md`](../codebase-review.md) M-04 and H-06. The envelope migration is a single coordinated
> breaking release (Phase 1 of [`implementation-plan.md`](../implementation-plan.md)), because
> [fitness-gh-frontend](../../../fitness-gh-frontend) calls `/api/v1` directly from the browser.

## When to Activate

- Designing or implementing an endpoint
- Reviewing an API contract or route handler
- Adding pagination, filtering, or sorting to a list endpoint
- Changing an error response, a status code, or the envelope
- Planning a versioning or deprecation step

## Resource Design

### URL structure

```
# Resources are plural nouns, lowercase, kebab-case
GET    /api/v1/gyms
GET    /api/v1/gyms/:gymId
POST   /api/v1/gyms
PATCH  /api/v1/gyms/:gymId
DELETE /api/v1/gyms/:gymId

# Sub-resources for ownership — the parent id is part of the path AND part of every query
GET    /api/v1/gyms/:gymId/plans
GET    /api/v1/gyms/:gymId/plans/:planId
GET    /api/v1/gyms/:gymId/memberships
GET    /api/v1/gyms/:gymId/employees
POST   /api/v1/gyms/:gymId/check-ins

# Actions that don't map to CRUD (verbs, used sparingly)
POST   /api/v1/memberships/:membershipId/cancel
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

# The authenticated caller is always `me`, never an id from the client
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/users/me/memberships
```

### Naming rules

```
# GOOD
/api/v1/subscription-plans        # kebab-case for multi-word resources
/api/v1/gyms?city=Accra           # query params for filtering
/api/v1/gyms/123/memberships      # nested for ownership

# BAD
/api/v1/getGyms                   # verb in the URL
/api/v1/gym                       # singular
/api/v1/subscription_plans        # snake_case
/api/v1/gyms/my/all               # "my" is not a resource — use /users/me/gyms
/api/v1/subscriptions/gyms/:id/plans   # feature-prefixed path that hides the real hierarchy
```

The last two are current endpoints. `/gyms/my/all` and the whole `/subscriptions/gyms/:id/*` tree should move under
`/gyms/:gymId/*` and `/users/me/*`.

### Don't let a wildcard own a namespace

`GET /gyms/:slug` claims every single-segment path under `/gyms`, so any literal route added there silently becomes
a slug lookup — and the ordering is currently held together by comments (M-14). Give lookups their own segment:

```
GET /api/v1/gyms/by-slug/:slug     # not /gyms/:slug
```

## HTTP Methods and Status Codes

| Method | Idempotent | Safe | Use for |
|---|---|---|---|
| GET | Yes | Yes | Retrieve |
| POST | No | No | Create, trigger an action |
| PUT | Yes | No | Full replacement (rare here) |
| PATCH | No* | No | Partial update — **the default for updates in this API** |
| DELETE | Yes | No | Archive (soft delete) |

\* PATCH can be made idempotent with care.

Prefer `PATCH` over `PUT`: every update endpoint in this service takes a partial body, so `PUT` is a lie about
replacement semantics. The current API uses `PUT` throughout — migrate with the Phase 1 release.

```
# Success
200 OK                    — GET, PATCH
201 Created               — POST that creates a resource; MUST include a Location header
204 No Content            — DELETE, and any action with no body

# Client errors
400 Bad Request           — malformed JSON, unparseable request
401 Unauthorized          — missing, invalid, or expired token
403 Forbidden             — authenticated, in the right tenant, insufficient role
404 Not Found             — doesn't exist, OR belongs to another tenant (see below)
409 Conflict              — duplicate, or an illegal state transition
422 Unprocessable Entity  — valid JSON, invalid data (field-level details)
429 Too Many Requests     — rate limited; include Retry-After

# Server errors
500 Internal Server Error — unexpected; never expose details
503 Service Unavailable   — dependency down; include Retry-After
```

**404 for cross-tenant access, not 403.** A 403 confirms the resource exists and lets an attacker enumerate other
tenants' ids. 403 is reserved for resources inside *your own* tenant that your role can't reach. This is the single
most important status-code rule in this API — see [`multi-tenancy/SKILL.md`](../multi-tenancy/SKILL.md).

### Mistakes present in the current code

```
# BAD: 200 with a success flag instead of a status code
200 { "success": false, "message": "Not found" }

# BAD: 200 + data:null for a delete            → 204 No Content
# BAD: 200 for POST /payments/initiate          → 201 + Location
# BAD: 201 without a Location header
# BAD: 400 with raw valibot `issues`            → 422 with { field, message, code }
# BAD: 500 on a Prisma P2002 unique violation   → 409
# BAD: `stack` in the response body             → never
```

## Response Format

### Success

```json
{ "data": { "id": "01a0…", "name": "Premium", "price": "250.00" } }
```

### Collection

```json
{
  "data": [{ "id": "01a0…" }, { "id": "01a1…" }],
  "meta": { "total": 142, "page": 1, "perPage": 20, "totalPages": 8 }
}
```

### Error

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Must be a valid email address", "code": "invalid_email" }
    ]
  }
}
```

Rules:

- **JSON is camelCase** throughout, matching the TypeScript domain models end to end.
- **`code` is the contract.** It is a stable snake_case string the frontend switches on. `message` is
  human-readable and may change without notice.
- **Money is a decimal string** (`"250.00"`), not a number — `Decimal(10,2)` in Postgres, serialised as a string to
  avoid float precision loss on the wire.
- **Timestamps are ISO 8601 UTC** (`"2026-09-08T14:32:00.000Z"`).
- **Envelopes are written only by `src/core/http-responses.ts`** (`sendData`, `sendCreated`, `sendNoContent`,
  `sendPaginated`) — never hand-built in a controller, and never through two different helpers as the codebase does
  today (M-04).
- **500 responses carry a `requestId`** so a user report can be matched to a log line. Nothing else internal.

## Implementation Patterns

### Validation as middleware

```typescript
// validations/plans.validation.ts
import { type InferOutput, minLength, minValue, number, object, optional, picklist, pipe, string } from 'valibot'

export const createPlanSchema = object({
  name: pipe(string(), minLength(1, 'Name is required')),
  description: optional(string()),
  price: pipe(number(), minValue(0, 'Price cannot be negative')),
  duration: pipe(number(), minValue(1, 'Duration must be at least 1')),
  durationUnit: picklist(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']),
  maxVisits: optional(pipe(number(), minValue(1))),
})

export type CreatePlanInput = InferOutput<typeof createPlanSchema>
```

Use **strict object schemas** so unknown keys are rejected rather than ignored. That is what stops a client from
smuggling `organisationId`, `profileId`, `vendorId`, or `amount` into a body — the shape of finding C-01.

```typescript
// middlewares/validate-request.middleware.ts
export function validateBody(schema: GenericSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = safeParse(schema, req.body)
    if (!result.success) {
      return next(new ValidationError(result.issues.map(issue => ({
        field: getDotPath(issue) ?? '',
        message: issue.message,
        code: issue.type,
      }))))
    }
    req.body = result.output
    next()
  }
}
```

`validateQuery` writes to `req.validatedQuery` (Express 5 types `req.query` as read-only-ish and coercion belongs in
the schema); `validateParams` writes to `req.validatedParams`. Never mutate `req.query` in place.

### Routes → controller → service

See [`backend-patterns/SKILL.md`](../backend-patterns/SKILL.md) for the full worked example. The contract-relevant
part is that the controller does exactly three things: read validated input, call the service, pick the envelope.

```typescript
createPlan = async (req: Request, res: Response): Promise<void> => {
  const gymId = req.validatedParams.gymId
  const plan = await this.service.create(req.db, gymId, req.body)
  sendCreated(res, toPlanResponse(plan), `/api/v1/gyms/${gymId}/plans/${plan.id}`)
}
```

### Central error handler

```typescript
// middlewares/error-handler.middleware.ts — the ONLY place errors become HTTP responses
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code]     // P2002 → 409, P2025 → 404, P2003 → 409
    if (mapped) {
      res.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } })
      return
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'malformed_json', message: 'Request body is not valid JSON' } })
    return
  }

  logger.error({ err, requestId: req.id }, 'unhandled error')      // internals to the log, never the response
  res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong', requestId: req.id },
  })
}
```

Express 5 forwards rejected promises from async handlers automatically — no `asyncHandler` wrapper, no `try/catch`.

## Pagination

**Every list endpoint is paginated.** There are no exceptions; an unpaginated list in a multi-tenant API is a
denial-of-service surface and, if the scope is ever wrong, a bulk data leak. Today no endpoint paginates (H-06).

### Offset-based — the default

Right for admin tables where "jump to page N" and a total count matter (members, payments, staff).

```
GET /api/v1/gyms/:gymId/memberships?page=2&perPage=20
```

```typescript
const [data, total] = await Promise.all([
  db.membership.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
  db.membership.count({ where }),
])
```

`perPage` defaults to 20 and is **capped at 100** in the schema, so a client cannot ask for everything.

### Cursor-based — for large or fast-growing tables

Right for check-in history and audit logs: constant performance, stable under concurrent inserts.

```
GET /api/v1/gyms/:gymId/check-ins?cursor=01a02aaf-…&limit=50
```

```typescript
// UUIDv7 primary keys are time-ordered, so the id itself is a valid cursor
const rows = await db.checkIn.findMany({
  take: limit + 1,                                        // one extra to compute hasNext
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  orderBy: { id: 'desc' },
})
const hasNext = rows.length > limit
```

Response `meta` for cursor pages is `{ nextCursor, hasNext }` — no `total` (counting defeats the purpose).

Shared parsing and `meta` construction live in `src/core/pagination.ts`, applied by a `paginate` middleware.

## Filtering, Sorting, and Search

```
# Equality
GET /api/v1/gyms/:gymId/memberships?status=ACTIVE
GET /api/v1/gyms?city=Accra&region=Greater%20Accra

# Multiple values, comma-separated
GET /api/v1/gyms/:gymId/memberships?status=ACTIVE,PENDING

# Ranges, bracket notation
GET /api/v1/gyms/:gymId/plans?price[gte]=50&price[lte]=200
GET /api/v1/gyms/:gymId/payments?createdAt[gte]=2026-09-01

# Sorting: `-` prefix for descending, comma-separate multiple keys
GET /api/v1/gyms/:gymId/memberships?sort=-createdAt,status

# Search
GET /api/v1/gyms?q=fitness
```

Validate query params with a schema exactly like bodies. **Whitelist** sortable and filterable fields and map them
explicitly — never interpolate a raw query param into Prisma `orderBy` or `where`:

```typescript
const SORTABLE = { createdAt: 'createdAt', endDate: 'endDate', status: 'status' } as const

function toOrderBy(sort?: string) {
  if (!sort) return { createdAt: 'desc' as const }
  return sort.split(',').map((key) => {
    const desc = key.startsWith('-')
    const field = SORTABLE[(desc ? key.slice(1) : key) as keyof typeof SORTABLE]
    if (!field) throw new ValidationError([{ field: 'sort', message: `Cannot sort by ${key}`, code: 'invalid_sort' }])
    return { [field]: desc ? 'desc' : 'asc' } as const
  })
}
```

Search fields are whitelisted too, and `q` is length-capped — an unbounded `contains` across a members table is
both a performance and a privacy problem (C-05).

## Rate Limiting

`express-rate-limit`, mounted before the routers. **Production-only** — limiters break test suites and frontend dev
loops, so gate them on `env.nodeEnv === 'production'`.

```typescript
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: true,
  keyGenerator: req => req.auth?.sub ?? ipKeyGenerator(req),   // per user when known, per IP otherwise
  message: { error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded. Try again later.' } },
}))
```

| Tier | Limit | Key | Applies to |
|---|---|---|---|
| Credentials | **10/min** | IP | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/change-password` |
| OTP / email | **5/min**, 20/day | IP + email | `/auth/send-otp`, `/auth/verify-otp`, password reset |
| Upload | **10/min** | user | `/upload` |
| Webhook | 300/min | IP | `/payments/webhook` (signature-verified; limit is anti-flood only) |
| Authenticated | 100/min | user | everything else |
| Public | 30/min | IP | gym directory, plan browsing |

Credential and OTP endpoints need their own stricter limiters — a global 100/min does nothing against credential
stuffing. Pair the OTP limiter with a per-code attempt cap in the service (C-08): rate limits protect the endpoint,
the attempt counter protects the individual code.

## Versioning

URL path versioning: routers mount at `/api/v1` in `src/api/index.ts`; a future v2 gets its own router tree.

```
1. Stay on /api/v1 — don't version until you must
2. At most two active versions (current + previous)
3. Non-breaking, no new version: adding response fields, new optional query params, new endpoints
4. Breaking, needs a version or a coordinated release: removing/renaming fields, changing a field's
   type (including Float → decimal string), changing the envelope, changing auth, changing a status code
```

The Phase 1 envelope change is breaking and *pre-launch*, so it ships as a coordinated release with
`fitness-gh-frontend` rather than as `/api/v2`. After launch, that option is gone — which is why it must happen
early.

Unversioned service endpoints stay outside the prefix: `/` (root), `/health` (dependency check), `/live`
(liveness), `/docs`, `/openapi.json`. Remove the duplicate `/api/v1/health` currently declared inline in
`ApiRoute`.

## Endpoint checklist

Before shipping a new or changed endpoint:

- [ ] URL: plural, kebab-case, no verbs, nested under its real parent, no wildcard namespace grab
- [ ] `PATCH` for partial updates; `POST` returns 201 + `Location`; `DELETE` returns 204
- [ ] Body, query, and params validated by middleware with **strict** schemas; unknown keys rejected
- [ ] No client-supplied `organisationId`, `profileId`, `amount`, or `vendorId` is trusted
- [ ] `authenticate` + `tenantScope` applied, or the route is on the public allowlist deliberately
- [ ] Authorised with `can(permission)` — a permission from the code catalogue, not a role name; cross-tenant access returns **404**
- [ ] Paginated (offset for tables, cursor for logs); `perPage` capped; `meta` present
- [ ] Sortable/filterable/searchable fields whitelisted and mapped, never interpolated
- [ ] Response through a serialiser — no raw Prisma rows, no `passwordHash`, no member body metrics
- [ ] Errors are `AppError` subclasses with a stable `code`; only `error-handler` writes error responses
- [ ] Response leaks no internals — no stack, no Prisma text, no SQL, no validator internals
- [ ] Money as a decimal string; timestamps ISO 8601 UTC; JSON camelCase
- [ ] Multi-step writes in a transaction; check-then-write replaced by a guarded update
- [ ] Rate-limit tier chosen
- [ ] [`openapi.yaml`](../openapi.yaml) updated in the same commit
- [ ] Tests: happy path · 422 · 401 · 403 · **404 cross-tenant** · 409
