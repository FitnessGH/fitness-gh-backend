# Codebase Review — fitness-gh-backend

> **Reviewed:** 8 September 2026 · commit `55d4894` · Express 5 + Prisma 6 + valibot, 7,634 LOC across 88 files.
> **Verdict:** the *shape* is right (vertical feature slices, `BaseRoute`, error classes, singleton Prisma) but the
> multi-tenant product it claims to be is **not implemented** — tenant isolation is opt-in per controller and leaks in
> several confirmed places. Fix the Critical list before anything else; then refactor in place (do not rebuild).

Companion documents: remediation sequencing in [`implementation-plan.md`](./implementation-plan.md) · target schema in
[`database-schema.md`](./database-schema.md) · target architecture in
[`backend-patterns/SKILL.md`](./backend-patterns/SKILL.md) · tenancy law in
[`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

---

## 1. What the codebase gets right

Worth stating, because the remediation plan builds on it rather than discarding it:

- **Vertical feature slices** under `src/api/<feature>/{controllers,routes,services,types,validations}` — the same
  layout as the reference implementation, so the refactor is mechanical rather than structural.
- **`BaseRoute`** abstract class gives every module a consistent mounting story and an Open/Closed extension point.
- **An error class hierarchy exists** (`CustomError` → `ClientError` → `BadRequest`/`Unauthorized`/`Forbidden`/
  `NotFound`/`Conflict`) with a single `errorHandler` middleware — the skeleton of correct error handling.
- **Auth fundamentals are sound**: bcrypt at 12 rounds, access/refresh split, refresh tokens persisted and
  **rotated on use** with `revokedAt`, password change revokes all sessions, `isActive` checked on login and refresh,
  `passwordHash` stripped by an explicit `sanitizeAccount`, email normalised to lowercase.
- **Registration is transactional** (`prisma.$transaction` for account + profile + gym).
- **Marketplace vendor ownership is enforced** (`product.vendorId !== vendorId` → Forbidden) — the one place
  resource ownership is checked properly.
- `typecheck` passes clean. TypeScript `strict` is on.

Everything below is what stands between this and a production multi-tenant service.

---

## 2. Critical — exploitable today

### C-01 · Payment webhook is unauthenticated and the amount is client-supplied → free memberships

`POST /api/v1/payments/webhook` is mounted with **no authentication and no signature verification**
([payment.route.ts:9](../src/api/payments/routes/payment.route.ts#L9)) and trusts the request body verbatim
([payment.service.ts:73-103](../src/api/payments/services/payment.service.ts#L73-L103)). Separately,
`initiatePayment` takes `amount` and `membershipId` straight from the client
([payment.validation.ts:17-37](../src/api/payments/validations/payment.validation.ts#L17-L37)) and never compares
`amount` against `plan.price`, nor checks that `membershipId` belongs to the caller or to `gymId`.

Chained, this is a complete billing bypass:

```
POST /payments/initiate   { gymId, membershipId: <mine or anyone's>, amount: 0.01 }  → { reference }
POST /payments/webhook    { event: "charge.success", data: { reference, status: "success" } }
  → payment COMPLETED → SubscriptionService.activateMembership() → membership ACTIVE for GH₵0.01
```

Because `membershipId` is unvalidated, the same two calls activate **another gym's** membership. `handleWebhook`
also swallows unknown references silently, so there is no signal that this is happening.

**Fix:** derive `amount` server-side from the plan; verify `membershipId` ownership + gym; require a provider
signature (HMAC over the raw body) on the webhook; make webhook handling idempotent on `reference`; keep the
simulator behind an env flag that is off in production. Also add ownership checks to
`GET /payments/verify/:reference` and `GET /payments/gyms/:id` (see C-04).

### C-02 · JWT secrets silently fall back to a public constant → token forgery

```ts
const DEV_SECRET = "development-only-secret-key-min-32-characters-long";
JWT_ACCESS_SECRET: optional(string(), DEV_SECRET),
JWT_REFRESH_SECRET: optional(string(), DEV_SECRET),
```
[env.config.ts:5-25](../src/config/env.config.ts#L5-L25)

If either variable is absent in a production deploy, the service **boots normally** and signs tokens with a string
committed to a public repository. Anyone can then mint `{ accountId, userType: "SUPER_ADMIN" }`. The same schema also
makes `DATABASE_URL` the only genuinely required variable.

**Fix:** required, `minLength(32)`, and distinct access/refresh secrets when `NODE_ENV === "production"`; keep dev
defaults behind an explicit `NODE_ENV !== "production"` branch. Fail fast at boot.

### C-03 · `PUT`/`DELETE /users/:id` have no ownership or role check

Both routes carry `authenticate` and nothing else
([user.route.ts:17-18](../src/api/users/routes/user.route.ts#L17-L18)), and neither controller method reads the
caller's identity — they act on the `:id` from the URL
([user.controller.ts](../src/api/users/controllers/user.controller.ts)). Any authenticated member can rewrite or
attempt to **hard-delete** any other user's profile, including a gym owner's. (`deleteProfile` is a real
`prisma.userProfile.delete()`, not a soft delete, so where FK restrictions bite it fails with an unmapped Prisma
error → 500 instead of 409.)

**Fix:** `PUT /users/me` for self-service; keep `/users/:id` for `SUPER_ADMIN` only; soft-delete via `archivedAt`.

### C-04 · Cross-gym IDOR on every child resource

The pattern throughout: the controller authorises the **gym** in the URL, then the service acts on a **child id**
that it never re-scopes to that gym.

| Endpoint | Authorises | Acts on | Service |
|---|---|---|---|
| `PUT /gyms/:id/plans/:planId` | `:id` | `:planId` | `updatePlan(planId)` — no `gymId` filter |
| `DELETE /gyms/:id/plans/:planId` | `:id` | `:planId` | `deletePlan(planId)` |
| `PUT /gyms/:id/memberships/:membershipId` | `:id` | `:membershipId` | `updateMembership(membershipId)` |
| `POST /gyms/:id/memberships/:membershipId/activate` | `:id` | `:membershipId` | `activateMembership(membershipId)` |
| `PUT /gyms/:id/employees/:employeeId` | `:id` | `:employeeId` | `updateEmployee(employeeId)` |
| `DELETE /gyms/:id/employees/:employeeId` | `:id` | `:employeeId` | `removeEmployee(employeeId)` |

Sources: [subscription.controller.ts:133-176, 358-446](../src/api/subscriptions/controllers/subscription.controller.ts#L133-L176) ·
[gym.controller.ts:293-360](../src/api/gyms/controllers/gym.controller.ts#L293-L360) ·
[subscription.service.ts:59-84, 234-280](../src/api/subscriptions/services/subscription.service.ts#L59-L84) ·
[gym.service.ts:326-358](../src/api/gyms/services/gym.service.ts#L326-L358).

So a manager of gym A can rewrite gym B's pricing, activate gym B's memberships for free, or fire gym B's staff by
passing their own `gymId` with the victim's child id. `GET /gyms/:id/plans/:planId` has no access check at all and
returns any plan by id.

**Fix:** this is not fixable case-by-case. Every read/write must be scoped in the `where` clause
(`where: { id, gymId }`), and a cross-tenant hit must **404, not 403** — see
[`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

### C-05 · Member PII is publicly enumerable

`GET /users/:id`, `GET /users/search`, `GET /users/stats` are mounted **without `authenticate`**
([user.route.ts:12-14](../src/api/users/routes/user.route.ts#L12-L14)). `getProfileById` returns the whole
`UserProfile` row — including `height`, `weight`, `age`, `gender`, and `preferences`. `searchProfiles` accepts any
substring, so the entire member base is walkable.

Worse: `GET /users?withAccounts=true` requires only `authenticate` (any role, including `MEMBER`) and returns
**every account in the system** with `email`, `phone`, `lastLoginAt`, `userType`
([user.service.ts:32-58](../src/api/users/services/user.service.ts#L32-L58)) — unpaginated.

**Fix:** authenticate everything under `/users`; `SUPER_ADMIN` only for cross-account listing; a `publicProfile`
serialiser that excludes body metrics; paginate.

### C-06 · Stack traces are returned to clients

```ts
const response: ResponseError = { message, status, success, data, details, stack: customError.stack };
res.status(customError.status!).json(response);
```
[error-handler.middleware.ts:83-93](../src/middlewares/error-handler.middleware.ts#L83-L93)

Every `CustomError` response carries a `stack` field, in all environments. `ValiError` responses leak raw valibot
`issues`. The handler also `console.error`s unconditionally, so routine 404s are logged as errors.

### C-07 · No rate limiting anywhere

`express-rate-limit` is not a dependency and no limiter is mounted ([app.ts](../src/app.ts)). `POST /auth/login`,
`/auth/register`, and `/auth/send-otp` are unthrottled — credential stuffing, username/email enumeration (register
returns distinct conflict messages for email vs username vs phone), and OTP/email-cost flooding are all free.
`POST /upload` is unthrottled and unquota'd too.

### C-08 · OTP verification is not trustworthy

[otp.service.ts](../src/core/services/otp.service.ts):

- OTPs are **stored in plaintext** and generated with `Math.random()` (not cryptographically secure, ~10⁶ space).
- **No attempt counter and no rate limit** → a 6-digit code is brute-forceable in minutes.
- On any DB error the service falls back to an **in-memory `Map`** — which in a serverless/multi-instance deploy
  means verification results depend on which instance you hit, and errors are downgraded to `console.warn`.
- `verifyEmailOTP` **returns `true` when no account matches the email** (line ~137), so callers believe an
  unverifiable email was verified.
- Both create and verify **log the email and OTP value** plus full DB records to stdout.

Related: `EmailService` degrades to a mock that prints the message body when `SMTP_USER`/`SMTP_PASS` are unset
([email.service.ts:26-30](../src/core/services/email.service.ts#L26-L30)) — and those variables are in neither
`env.config.ts` nor `.env.sample`, so a misconfigured production instance prints OTPs into its logs while appearing
to work.

**Fix:** `crypto.randomInt`, store a hash, `attempts` column with a cap, per-email + per-IP rate limit, no
in-memory fallback, no OTP in logs, SMTP config required in production.

---

## 3. High — correctness and data integrity

### H-01 · Money is stored as `Float`

`SubscriptionPlan.price`, `Payment.amount`, `Product.price`, `Order.total`, `OrderItem.price`, `OrderItem.subtotal`
are all `Float` ([schema.prisma](../prisma/schema.prisma)). Binary floating point cannot represent GH₵ amounts
exactly; totals computed as `product.price * item.quantity` accumulate error, and reconciliation against a payment
provider will drift. Must be `Decimal(10,2)`.

### H-02 · Zero indexes in the entire schema

No `@@index` anywhere, no index in either migration, and **Prisma does not auto-index foreign keys on PostgreSQL**.
Every one of these is a sequential scan that grows with the whole table: `gym.findMany({ where: { ownerId } })`,
`employment.findMany({ where: { gymId } })`, `subscriptionPlan.findMany({ where: { gymId } })`,
`membership.findMany({ where: { gymId } | { profileId } })`, `payment.findMany({ where: { gymId } | { profileId } })`,
`product.findMany({ where: { vendorId } })`, `order.findMany({ where: { customerId } })`,
`refreshToken` lookups, `emailVerification.findFirst({ where: { email, otp } })`.

### H-03 · Marketplace oversells under concurrency

`createOrder` reads products and checks `product.stock < item.quantity` **before** opening the transaction, then
decrements inside it ([marketplace.service.ts:347-445](../src/api/marketplace/services/marketplace.service.ts#L347-L445)).
Two concurrent orders for the last unit both pass the check and both decrement — stock goes negative.

**Fix:** guarded update inside the transaction (`UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`);
zero rows affected → `ConflictError`. Also `orderNumber` uses `Date.now()` + `Math.random().toString(36).substr(2,9)`
(deprecated `substr`, collision-prone under load) — use a DB sequence.

### H-04 · `Membership` unique constraint makes renewal impossible

```prisma
@@unique([profileId, gymId, planId])
```
[schema.prisma:287](../prisma/schema.prisma#L287)

Once a member has *ever* held a plan, they can never hold it again — expired and cancelled rows keep the slot. This
is exactly backwards for a subscription business: renewals are the core motion and membership history is a reporting
requirement. `createMembership` also duplicates the constraint in application code, filtered to
`status: { in: ["PENDING","ACTIVE"] }`, so the two disagree: the app allows what the DB rejects (→ unmapped `P2002`
→ 500, see H-05).

**Fix:** drop the constraint; add a **partial unique index** on `(profileId, gymId)` `WHERE status IN ('PENDING','ACTIVE')`
so one live membership per member per gym, with unlimited history.

Related: `Membership.lastPaymentId` is a bare `String?` with no FK to `Payment`.

### H-05 · Prisma error mapping is commented out

[error-handler.middleware.ts:25-82](../src/middlewares/error-handler.middleware.ts#L25-L82) — the
`PrismaClientKnownRequestError` and `MulterError` branches are commented out, so a `P2002` unique violation
(duplicate email under a race, duplicate membership per H-04) and `P2025` (record not found) both surface as
**500 "Server error, please try again later"** instead of 409/404.

### H-06 · No pagination on any list endpoint

Every list is an unbounded `findMany`: `GET /gyms`, `GET /users`, `GET /marketplace/products`,
`GET /marketplace/orders/my`, `GET /payments/my`, `GET /payments/gyms/:id`, `GET /gyms/:id/employees`,
`GET /gyms/:id/memberships`, `GET /subscriptions/memberships/my`, `GET /gyms/:id/plans`. No `skip`/`take` appears
anywhere in `src/`. There is also no filtering or sorting support beyond `?includeOwner` and `?withAccounts` —
which means the frontend is fetching whole tables and filtering client-side.

### H-07 · Tenant scoping is opt-in, so it is a matter of time

`GymService.checkGymAccess(gymId, profileId, roles?)` is a good primitive
([gym.service.ts:196-227](../src/api/gyms/services/gym.service.ts#L196-L227)) but it is **called by hand in each
controller method**. There is no middleware, no default-deny, and nothing that fails a build or a test when a new
endpoint forgets it. C-04 is the predictable result. Its semantics are also wrong in three ways:

1. `requiredRoles` is **optional**, and omitting it means "any active employment" — so a `STAFF`-role employee
   passes the check used by `listEmployees` and `listMemberships`.
2. Authorisation is expressed as an **exact-match list of role names**, so every call site must enumerate roles —
   and they have already drifted (`["MANAGER"]` in gyms versus `["MANAGER","RECEPTIONIST"]` in subscriptions).
   Endpoints should require a *permission* and let the role → permission mapping live in one place; see
   [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).
3. There is **no `SUPER_ADMIN` bypass**, while `requireGymOwner`/`requireEmployee` list `SUPER_ADMIN` as allowed
   ([rbac.middleware.ts:42-52](../src/middlewares/rbac.middleware.ts#L42-L52)). A platform admin passes the route
   guard and is then rejected by the service — super admins cannot administer gyms at all.

### H-08 · Self-enrolment produces invalid gym records

Registering as `GYM_OWNER` creates the gym inside the **auth** service
([auth.service.ts:84-95](../src/api/auth/services/auth.service.ts#L84-L95)) with:

```ts
slug: `${data.gymName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
address: 'TBA', city: 'TBA', region: 'TBA',
```

Required columns get placeholder strings that nothing forces anyone to fix, and the slug — the gym's public URL —
is permanently suffixed with a millisecond timestamp. Vendor registration writes `businessName` into the free-form
`preferences` JSON blob "for now" (line 98-107). Self-enrolment is the product's headline feature and it has no
onboarding state machine, no slug reservation/uniqueness retry, no verification step, and no way to complete the
profile.

### H-09 · `Account.userType` contradicts the relational model

`UserType` is a single enum on `Account`, but `Employment` and `Membership` already express per-gym relationships.
So one person cannot be a `MEMBER` at gym A and a `TRAINER` at gym B — yet the schema permits exactly those rows.
`userType` is therefore an unreliable input to authorisation decisions, and it is the only role claim in the JWT
([jwt.service.ts:7-11](../src/core/services/jwt.service.ts#L7-L11)), forcing every real authorisation check to hit
the database anyway. The marketplace compounds it: a "vendor" is a `UserProfile` with `userType: EMPLOYEE`
([schema.prisma:346-348](../prisma/schema.prisma#L346-L348)) and no link to any gym.

---

## 4. Medium — architecture, layering, maintainability

### M-01 · Validation lives in controllers, so controllers are not thin

Every controller method opens `try { const x = parse(schema, req.body) … } catch (e) { next(e) }` — **60 `catch`
blocks** across `src/`. Consequences: controllers carry three responsibilities (validate, orchestrate, respond);
`ValiError` reaches the error handler as a generic 400 with raw `issues` instead of a 422 with
`{ field, message, code }`; schemas don't double as route documentation. Express 5 already forwards rejected
promises, so none of the `try/catch` is needed.

### M-02 · Handlers are prototype methods passed unbound

`export default new GymController()` with `async createGym(req, res, next)` as a prototype method, then
`this.get("/", GymController.createGym)` — `this` is `undefined` inside the handler. It works today only because no
controller uses `this`. The moment anyone injects a service (`this.service.create(...)`), it breaks at runtime, not
at compile time. Fix: arrow-function class properties.

### M-03 · No dependency injection; services are unmockable

Every service hard-imports the `prisma` singleton at module scope. There is no seam to inject a fake, so no service
can be unit-tested without a live database. `UserService` uses **`static` methods** while every other service is an
instance with a default export — two conventions in one codebase.

### M-04 · Two response envelopes and no machine-readable error codes

Most controllers hand-build `{ success, message, data }`. The users module instead uses
`success()`/`error()` from [response.util.ts](../src/utils/response.util.ts), producing
`{ success, data, meta }` and `{ success, message, status, details, data }`. Two error shapes are declared —
`ResponseError` in `errors/` and `ApiErrorResponse` in `types/` — and neither carries a stable `code`, so the
frontend has to match on human-readable `message` strings. Status codes are inconsistent too: `DELETE` returns 200
with `data: null` (gyms, plans, memberships) but 204 in users; creates return 201 without a `Location` header;
`POST /payments/initiate` returns 200 for a creation.

Because [fitness-gh-frontend](../../fitness-gh-frontend) calls `/api/v1` directly, the envelope is a **published
contract** — changing it is a breaking change that must be coordinated (see Phase 1 of the plan).

### M-05 · `CustomError` is untyped and has no `code`

`status`, `success`, `data`, `details` are all optional and `any`; `stack` is passed in by hand. `res.status(customError.status!)`
relies on a non-null assertion. There is no `code`, no `details` shape, and `ClientError` re-assigns every field its
parent already set. `BadRequestError` and `ClientError` overlap.

### M-06 · Untyped `Json` columns are an unknowable contract

`Gym.operatingHours`, `Gym.settings`, `UserProfile.preferences`, `SubscriptionPlan.features`,
`Order.shippingAddress`, `Product.images` are all `Json?` with the shape described only in a comment. Nothing
validates writes, nothing types reads, and clients cannot rely on any of it. Each needs a valibot/Zod schema at the
edge and a generated TypeScript type.

### M-07 · No structured logging

**63 bare `console.*` calls** in `src/`, including `console.log` of request query params in `UserController.getUsers`
and OTP values in `OTPService`. `morgan("combined")` is mounted in all environments — including tests, which is why
the suite prints access logs. There is no request id, no correlation between a client error report and a log line,
and no log level control.

### M-08 · Deployment shape is incoherent

[vercel.json](../vercel.json) uses the legacy v2 `builds`/`routes` form and points every request at
`dist/src/server.js` — a module whose top-level statement is `app.listen(port)`. Meanwhile
[api/index.ts](../api/index.ts) exports `app` (the correct serverless entry) and is never routed to. Current Vercel
guidance is a Function that exports the app, with no `builds` key. There is also no `engines`/`packageManager`
field, no `.nvmrc` enforcement, and `NODE_TLS_REJECT_UNAUTHORIZED=0` is baked into the `vercel:deploy` script —
which disables TLS verification for the whole deploy process.

### M-09 · No graceful shutdown; Prisma singleton has no global guard

[server.ts](../src/server.ts) handles `EADDRINUSE` and nothing else: no `SIGTERM`/`SIGINT` handler, no
`server.close()`, no `prisma.$disconnect()`. In-flight requests are dropped on every deploy. `PrismaService` caches
on a static field rather than `globalThis`, so `tsx watch` hot reloads and serverless cold starts open new pools
without releasing old ones; `log: ["error"]` only, and no driver adapter.

### M-10 · `pnpm lint` has never run — it crashes

```ts
"unicorn/filename-case": ["error", { case: "kebabCase", ignore: ["*.md"] }],
```
[eslint.config.mts](../eslint.config.mts) — `"*.md"` is compiled as the regex `/*.md/`, which is invalid
("Nothing to repeat"), so ESLint aborts on the first file:

```
SyntaxError: Error while loading rule 'unicorn/filename-case': Invalid regular expression: /*.md/u
```

This explains the mixed formatting: `auth.service.ts` and parts of `user.service.ts` use single quotes while the
config mandates double, several files have inconsistent indentation, and `no-console` warnings were never seen.
Fix the pattern to `String.raw`\.md$`` and expect a large first-run diff.

### M-11 · Tests cover nothing that matters

Three tests in two files — and `test/api.test.ts` is a **verbatim duplicate** of one of `test/app.test.ts`'s cases.
They assert `GET /` and a 404. Nothing exercises auth, tenancy, payments, memberships, or any service. There is no
test database strategy, no fixtures, no factory helpers, no CI workflow (`.github/` is absent), so nothing gates a
merge. `jest.config.ts` is dead: the project runs vitest, and the file uses CommonJS `module.exports` in a
`"type": "module"` package.

### M-12 · TypeScript configuration is inconsistent with the code

[tsconfig.json](../tsconfig.json): `moduleResolution: "node"` (classic Node10 resolution) with `module: "esnext"`
and `.js`-suffixed ESM imports — should be `nodenext`. `include` lists `"../test/**/*"`, outside `rootDir: "./src"`.
The `paths` map declares `@/routes/*`, `@/controllers/*`, `@/services/*`, `@/models/*` — **four directories that do
not exist** — and the `@/` alias is essentially unused: source files import via deep relative paths
(`../../../core/services/prisma.service.js`) throughout.

### M-13 · Dead and misplaced files

- `jest.config.ts` — dead (see M-11).
- `src/examples/router-patterns.ts` (85 lines) — sample code shipped in `src/`.
- `src/middlewares/async-handler.middleware.ts` — unnecessary under Express 5; unused.
- `src/types/custom-request.type.ts` — a type alias with every member commented out.
- `src/config/prisma.config.ts` — a **Prisma CLI** config (imports `prisma/config`) living inside `src/`, and
  re-exported from `src/config/index.ts`, which pulls CLI internals into the application barrel. Belongs at repo
  root as `prisma.config.ts`.
- `config.env = process.env` in [env.config.ts:48](../src/config/env.config.ts#L48) re-exposes the entire
  environment through the config object, defeating the point of a validated config.
- Commented-out `MulterError`/Prisma blocks in the error handler (58 lines).
- `.DS_Store` at repo root and in `src/`, untracked and not gitignored.
- `package.json`: `@types/nodemailer` in `dependencies`; the `vercel` CLI as a devDependency; `build` and
  `build:vercel` are identical; `"main": "src/server.ts"`.
- `db:push` sits alongside a migrations directory — an open invitation to schema drift.

### M-14 · Route ordering is held together by comments

Specific-before-parameterised ordering is enforced by convention and comments ("IMPORTANT: Specific routes must come
before parameterized routes") in marketplace, users, and subscriptions. `GET /gyms/:slug` occupies the entire
single-segment namespace under `/gyms`, so any future literal route there silently becomes a slug lookup. It also
does not filter `isActive`, so soft-deleted gyms stay publicly readable
([gym.service.ts:136-151](../src/api/gyms/services/gym.service.ts#L136-L151)); `getAllGyms` does filter it.

### M-15 · Upload endpoint validation is weak

[upload.controller.ts](../src/api/upload/controllers/upload.controller.ts): the MIME type comes from the
client's `Content-Type` header with no magic-byte sniff, and the allow-list test is a **substring** check
(`allowedTypes.some(t => contentType.includes(t))`), so `image/jpeg-anything` passes. The blob key's extension is
taken from the client's `?filename=` via `split(".").pop()` with no sanitisation, so a crafted filename injects path
segments into the key. Every upload is hardcoded under `products/` regardless of purpose (avatars, gym logos, covers
all land there), there is no per-user quota or rate limit, and `BLOB_READ_WRITE_TOKEN` is absent from the env schema.

---

## 5. Functional gaps — "manage their day-to-day activities"

The stated product is a management centre for gyms. What exists is **enrolment + billing**. Everything a gym
actually does day to day is missing from both the schema and the API:

| Missing capability | Why it matters | Evidence of intent |
|---|---|---|
| **Member check-in / attendance** | The single most-used screen in any gym. `Membership.visitsUsed` and `plan.maxVisits` exist, and `recordVisit()` is implemented — but **no route exposes it**, and there is no `CheckIn` table, so there is no visit history, no "who's in the gym now", no peak-hours data. | `recordVisit` in [subscription.service.ts:307](../src/api/subscriptions/services/subscription.service.ts#L307) |
| **Classes & schedules** | Group classes, capacity, bookings, waitlists, cancellations. | `EmployeeRole.TRAINER` exists with nothing to do |
| **Trainer ↔ member assignment** | PT sessions, programmes, progress. | `TRAINER` role; fitness fields on `UserProfile` |
| **Staff shifts / rosters** | `Employment` records who works there, not when. | `RECEPTIONIST`, `STAFF` roles |
| **Equipment / asset register** | Maintenance schedules, faults, downtime. | `ProductCategory.EQUIPMENT` (marketplace only) |
| **Invoices & receipts** | `Payment` records a transaction; there is no document to issue a member. | — |
| **Renewals / expiry automation** | Nothing transitions `ACTIVE` → `EXPIRED` past `endDate`, and `autoRenew` is stored but never acted on. No scheduled job exists. | `Membership.autoRenew`, `MembershipStatus.EXPIRED` |
| **Branches / multi-location** | A gym chain is the obvious customer for this product; `Gym` is a single address. | Reference project models Company → Branch |
| **Dashboard / reporting** | No endpoint returns a single KPI. Owners have no revenue, churn, or attendance view. | — |
| **Product reviews** | `Product.rating` and `reviewCount` are stored, maintained by nothing, and permanently `0`. | [schema.prisma:370-371](../prisma/schema.prisma#L370-L371) |
| **Notifications** | No email beyond OTP; no expiry reminders, receipts, or staff alerts. | `UserProfile.preferences` comment mentions "Notification prefs" |
| **Audit log** | Who changed a plan's price, who cancelled a membership, who removed staff — all unrecorded. | — |

**Marketplace needs a product decision, not just a refactor.** It is currently a global multi-vendor e-commerce
store bolted onto a gym-management API: `Product` and `Order` carry no `gymId`, a vendor is any profile with
`userType: EMPLOYEE`, `Order` has no vendor scope (so a multi-vendor cart cannot be fulfilled or split), there is
no payment integration on the order path, and no shipping or fulfilment model. Either scope it down to
**per-gym storefronts** (products belong to a gym, orders are gym-scoped, reuse the payment module) or extract it
into its own service. Leaving it as-is means the multi-tenancy work has to cover two unrelated tenancy models.

---

## 6. Recommendation: refactor in place, do not rebuild

**Refactor.** A rewrite would discard the parts that are genuinely fine (the module layout, `BaseRoute`, the auth
token flow, the error hierarchy skeleton) and would still have to solve the same schema and tenancy problems. The
work is concentrated in four things — a tenancy layer, a data-model migration, a contract change, and a test
suite — and all four can be done incrementally against a live frontend.

Three constraints shape the sequencing in [`implementation-plan.md`](./implementation-plan.md):

1. **The Critical list ships first, as small independent fixes**, before any restructuring. Several are
   exploitable now and none of them need the refactor to land.
2. **The envelope change (M-04) is breaking** and `fitness-gh-frontend` calls the API directly. Do it **once**,
   early, in one coordinated release — not gradually.
3. **Nothing gets refactored before there is a test around it.** With 3 trivial tests, the current suite would not
   notice any of C-01 through C-08 regressing.

## 7. Findings index

| ID | Severity | Finding |
|---|---|---|
| C-01 | Critical | Unauthenticated payment webhook + client-supplied amount → free/arbitrary membership activation |
| C-02 | Critical | JWT secrets default to a committed constant → token forgery |
| C-03 | Critical | `PUT`/`DELETE /users/:id` have no ownership check |
| C-04 | Critical | Cross-gym IDOR on plans, memberships, employments |
| C-05 | Critical | Member PII publicly enumerable; all accounts listable by any member |
| C-06 | Critical | Stack traces and raw validation internals returned to clients |
| C-07 | Critical | No rate limiting on auth, OTP, or upload |
| C-08 | Critical | OTP plaintext, `Math.random()`, no attempt cap, in-memory fallback, returns true without an account |
| H-01 | High | Money stored as `Float` |
| H-02 | High | Zero indexes in the schema |
| H-03 | High | Marketplace stock check outside the transaction → oversell |
| H-04 | High | `Membership` unique constraint blocks renewal; app and DB rules disagree |
| H-05 | High | Prisma error mapping commented out → 500 instead of 409/404 |
| H-06 | High | No pagination, filtering, or sorting on any list endpoint |
| H-07 | High | Tenant scoping is opt-in per controller; `checkGymAccess` semantics wrong in 3 ways; role-name authorisation drifts between call sites |
| H-08 | High | Self-enrolment writes `"TBA"` into required columns and timestamped slugs |
| H-09 | High | `Account.userType` contradicts `Employment`/`Membership`; single role claim in JWT |
| M-01 | Medium | Validation in controllers; 60 redundant `try/catch` |
| M-02 | Medium | Handlers passed as unbound prototype methods |
| M-03 | Medium | No DI; services unmockable; static/instance inconsistency |
| M-04 | Medium | Two response envelopes; no machine-readable error codes; inconsistent status codes |
| M-05 | Medium | `CustomError` untyped, no `code`, non-null assertions |
| M-06 | Medium | Six untyped `Json` columns form an unknowable contract |
| M-07 | Medium | 63 bare `console.*`; no structured logging or request ids |
| M-08 | Medium | Deployment shape incoherent; TLS verification disabled in deploy script |
| M-09 | Medium | No graceful shutdown; Prisma singleton without `globalThis` guard |
| M-10 | Medium | `pnpm lint` crashes on an invalid regex — has never run |
| M-11 | Medium | 3 trivial duplicated tests; no CI; dead `jest.config.ts` |
| M-12 | Medium | `moduleResolution: node`, phantom path aliases, `include` outside `rootDir` |
| M-13 | Medium | Dead/misplaced files; Prisma CLI config inside `src/`; whole `process.env` re-exported |
| M-14 | Medium | Route ordering enforced by comments; `/gyms/:slug` ignores `isActive` |
| M-15 | Medium | Upload: client-trusted MIME, substring allow-list, unsanitised key, no quota |
| F-01 | Gap | No check-in/attendance, classes, trainers, shifts, equipment, invoices, branches, dashboard, notifications, audit log |
| F-02 | Gap | `recordVisit()` implemented but unreachable — no route |
| F-03 | Gap | No renewal/expiry automation; `autoRenew` stored and ignored |
| F-04 | Gap | Marketplace has no tenancy model and needs a product decision |
