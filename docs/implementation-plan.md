# Implementation Plan

> **Status (8 September 2026): not started.** This plan turns the current codebase into a production multi-tenant
> gym-management service. Approach: **refactor in place**, not rebuild — rationale in
> [`codebase-review.md`](./codebase-review.md) §6.
>
> **The service is not in production yet.** That is a significant advantage and the plan spends it deliberately:
> breaking contract changes (the response envelope, `PUT` → `PATCH`, `Float` → decimal strings) ship as one
> coordinated release with `fitness-gh-frontend` instead of a `/api/v2` tree, and destructive migrations
> (UUIDv7 primary keys, the tenancy backfill) reseed rather than migrate data. **Every one of these gets more
> expensive the moment a real gym is onboarded** — which is why Phases 1–3 come before Phase 6's feature work,
> even though the features are what the product is missing.

Traceability: [`Fitness_GH_Requirements_and_MVP.md`](./Fitness_GH_Requirements_and_MVP.md) · findings:
[`codebase-review.md`](./codebase-review.md) · data model: [`database-schema.md`](./database-schema.md) ·
HTTP contract: [`api-design/SKILL.md`](./api-design/SKILL.md) · architecture:
[`backend-patterns/SKILL.md`](./backend-patterns/SKILL.md) · tenancy law:
[`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md) · tests: [`testing/SKILL.md`](./testing/SKILL.md).

**Every phase ends green:** `pnpm lint && pnpm typecheck && pnpm test` pass, and every endpoint touched in the phase
has integration coverage for the happy path, a validation failure, an auth failure, and — for anything gym-scoped —
a **cross-organization 404**.

---

## Phase ordering at a glance

```
Phase 0  Security hotfixes ......... ship immediately, independently, no restructuring
Phase 1  Platform foundations ...... env, logger, errors, envelope, validation, rate limits, CI
   └─ contains the one breaking contract change; coordinate with fitness-gh-frontend
Phase 2  Identity & organization ... Organisation → Gym → Branch, tenantScope, permissions
Phase 3  Data model remediation .... Decimal money, indexes, membership history, typed JSON
Phase 4  Module refactor ........... auth · gyms · staff · plans · memberships (onto new patterns)
Phase 5  Billing done properly ..... provider abstraction, signed webhooks, invoices, renewals
Phase 6  Day-to-day operations ..... check-ins, classes, trainers, shifts, equipment, dashboard
Phase 7  Marketplace decision ...... scope to gym storefronts, or extract
Phase 8  Hardening & launch ........ OpenAPI, observability, deployment, seed, acceptance suite
```

Phases 0 and 1 are strictly sequential. Phase 2 blocks 4–7. Phase 3 can run in parallel with 2 (different files).
Phases 6 and 7 are independent of each other.

---

## Phase 0 — Security hotfixes

**Ship this before touching anything else.** Each item is a small, independent, backwards-compatible patch on the
current architecture. No refactoring, no contract changes — the point is to close what is exploitable today.

| # | Finding | Change |
|---|---|---|
| 0.1 | C-02 | `env.config.ts`: require `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with `minLength(32)` when `NODE_ENV === "production"`; assert they differ from each other and from `DEV_SECRET`; delete `config.env = process.env`. Add `SMTP_*` and `BLOB_READ_WRITE_TOKEN` to the schema. |
| 0.2 | C-01 | Derive `amount` server-side from `plan.price` — remove it from `initiatePaymentSchema`. Verify `membershipId` belongs to the caller's profile **and** to `gymId`. Gate the simulator behind `PAYMENTS_PROVIDER=simulator`; refuse to enable it when `NODE_ENV=production`. Require an HMAC signature header over the raw body on `/payments/webhook` (`express.raw` for that route only). Make webhook processing idempotent on `reference`. Scope `verifyPayment` and `getGymPayments` to the caller. |
| 0.3 | C-03 | Add `POST/PATCH /users/me`; restrict `PUT`/`DELETE /users/:id` to `SUPER_ADMIN`. Replace the hard `delete` with `archivedAt`. |
| 0.4 | C-05 | Add `authenticate` to `/users/:id`, `/users/search`, `/users/stats`. Restrict `?withAccounts=true` to `SUPER_ADMIN`. Add a `publicProfile` serialiser that omits `height`/`weight`/`age`/`gender`/`preferences`. Cap `search` and the account list at 50 rows pending Phase 1 pagination. |
| 0.5 | C-06 | Stop returning `stack` and raw `ValiError.issues`. `console.error` only for 5xx. |
| 0.6 | C-07 | `pnpm add express-rate-limit`; global 100/min per IP on `/api`, 10/min on `/auth/login`, `/auth/register`, `/auth/send-otp`, `/upload`. **Production-only** (limiters break test suites and frontend dev loops). |
| 0.7 | C-08 | `crypto.randomInt(100000, 1000000)`; store `otpHash` not `otp`; add `attempts` with a cap of 5; delete the in-memory fallback; return `false` when no account matches; remove every OTP/email value from logs. |
| 0.8 | C-04 | Interim scoping: pass `gymId` into `updatePlan`, `deletePlan`, `getPlanById`, `updateMembership`, `activateMembership`, `cancelMembership`, `updateEmployee`, `removeEmployee` and add it to the `where` clause. **404 on a cross-organization miss, not 403.** Phase 2 replaces this with the systematic mechanism; this stops the bleeding. |
| 0.9 | H-05 | Uncomment and finish the Prisma branch of the error handler: `P2002` → 409, `P2025` → 404, `P2003` → 409. Delete the `MulterError` block (no multer in the project). |
| 0.10 | M-10 | Fix `unicorn/filename-case` `ignore` to `[String.raw`\.md$`]` so `pnpm lint` runs. Commit the resulting formatting diff **separately** from behavioural changes. |

**Test gate (new file `test/security/`):** each of 0.2–0.4 and 0.8 gets a regression test that fails against the
current code. This is the first real test in the repo and the template for the rest —
see [`testing/SKILL.md`](./testing/SKILL.md).

**Deliverable:** a `fix/security-hotfixes` branch, reviewed as one unit, deployed before Phase 1 begins.

---

## Phase 1 — Platform foundations

Everything after this depends on these primitives. Fill them in this order.

1. **`src/config/env.config.ts`** — finish 0.1: one reader of `process.env` in the whole codebase (enforced by the
   `node/no-process-env` rule, which already exists but is disabled at the top of the file). Remove
   `src/config/prisma.config.ts` → repo-root `prisma.config.ts`; drop it from the `config/index.ts` barrel.
2. **`src/config/logger.config.ts`** — structured logger (levels, JSON in production, pretty in dev, `silent` in
   test), child bindings per module, request-id binding. Replace all 63 `console.*` calls. `morgan` → a
   `request-logger.middleware.ts` that is silent under `NODE_ENV=test`.
3. **`src/errors/`** — replace `CustomError` with `AppError(message, statusCode, code, details?)` and subclasses
   `NotFoundError` 404 · `UnauthorizedError` 401 · `ForbiddenError` 403 · `ConflictError` 409 ·
   `ValidationError` 422 · `RateLimitError` 429. One class per file, `index.ts` barrel. Delete
   `ClientError`/`ResponseError`/`BadRequestError`.
4. **`src/middlewares/`** —
   - `error-handler.middleware.ts` — the only place an error becomes a response. `AppError` → its own status/code;
     Prisma `P2002`/`P2025`/`P2003` → 409/404/409; malformed JSON → 400; anything else → opaque 500 with the
     internals logged and a `requestId` echoed to the client.
   - `validate-request.middleware.ts` — `validateBody` / `validateQuery` / `validateParams`, 422 with
     `{ field, message, code }[]`.
   - `request-id.middleware.ts`, `request-logger.middleware.ts`, `not-found.middleware.ts`,
     `rate-limit.middleware.ts` (tiers from [`api-design/SKILL.md`](./api-design/SKILL.md)).
5. **`src/core/`** — `pagination.ts` (parse `page`/`perPage` and `cursor`/`limit`; build the `meta` block),
   `http-responses.ts` (`sendData` / `sendCreated` / `sendNoContent` / `sendPaginated` — the **only** writers of
   response envelopes), `constants.ts`.
6. **Contract change (breaking — M-04).** Move to `{ data }` / `{ data, meta }` /
   `{ error: { code, message, details? } }`. Delete `utils/response.util.ts` and the `ApiResponse` types. Creates
   return 201 + `Location`; deletes return 204. **Coordinate as one release** with `fitness-gh-frontend`: the
   frontend's `lib/api/api-client.ts` unwraps the envelope in one place, so the change is contained there — audit
   `lib/api/*.ts` for direct `.success` / `.message` reads first.
7. **Validation to the edge (M-01).** Convert every module to `validateBody/Query/Params`; delete the 60
   `try/catch` blocks (Express 5 forwards rejections). Decide valibot vs Zod now and record it — valibot is
   installed and working; the house skills are written for Zod. **Recommendation: stay on valibot** (smaller, no
   migration cost) and keep the skill examples Zod-shaped but valibot-annotated.
8. **Handlers and DI (M-02, M-03).** Controllers → arrow class properties. Services and controllers take
   constructor-injected dependencies defaulting to the shared singletons; each file exports a ready instance.
   `UserService` static → instance.
9. **Prisma & lifecycle (M-09).** `globalThis` guard on the client singleton; `SIGTERM`/`SIGINT` → `server.close()`
   then `prisma.$disconnect()`; drain timeout.
10. **`tsconfig.json` (M-12).** `moduleResolution: "nodenext"`; drop the four phantom path aliases; move test
    includes to a `tsconfig.test.json`. Adopt `@/` imports across `src/` (relative only within a feature).
11. **Housekeeping (M-13).** Delete `jest.config.ts`, `src/examples/`, `async-handler.middleware.ts`,
    `custom-request.type.ts`; gitignore `.DS_Store`; move `@types/nodemailer` to devDependencies; add
    `engines` + `packageManager`; collapse the duplicate build scripts; remove `db:push`.
12. **Test harness (M-11).** Supertest against `app` (never `listen`). Dedicated test database via a
    `DATABASE_URL` override — **not** the dev DB. `test/helpers.ts`: `createAccount`, `createGym`,
    `createEmployment`, `createPlan`, `authHeaderFor`, `cleanupTestData()`. Delete the duplicate
    `test/api.test.ts`.
13. **CI.** `.github/workflows/ci.yml` — `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` against a
    service-container Postgres, on every PR. Required check on `main`.

**Test gate:** the error handler maps every case; `validateBody` returns 422 with field details; rate limiter
returns 429; pagination `meta` is correct; a 500 leaks nothing and echoes a `requestId`.

---

## Phase 2 — Identity and tenancy

The heart of the work (C-04, H-07, H-09). Do the model decision first, then the mechanism, then the migration.

### 2.1 Model decision

Adopt a three-level hierarchy so gym chains are expressible without a second migration later:

```
Organisation (the business organization and billable entity)
  └── Gym (a location / club)          ← current `Gym` becomes this
        └── Branch (optional sub-site)  ← defer to Phase 6 unless a customer needs it now
```

Every domain row carries `organisationId`; gym-physical rows also carry `gymId`.
Rationale and the full field list are in [`database-schema.md`](./database-schema.md).

**Split the two role axes** (H-09):

- `Account.platformRole`: `SUPER_ADMIN` | `USER`. Platform-level only; `SUPER_ADMIN` ⇔ `organisationId IS NULL`,
  backed by a DB check constraint.
- **Roles are data; permissions are code.** Two designs to reject: a linear rank (`TRAINER > RECEPTIONIST` grants
  trainers payment rights by accident — the two roles are genuinely incomparable), and a hardcoded role →
  permission map (correct, but every "our trainers should take payments" becomes a deploy). Instead:
  - **Permission keys** are a typed, closed catalogue in `src/core/permissions.ts` — code-owned, because the code
    is what enforces them. Seeded into a `permissions` table for the admin UI.
  - **Roles and their permissions** are rows (`roles`, `role_permissions`), editable per organisation. System
    roles (`owner`, `admin`, `manager`, `receptionist`, `trainer`, `staff`) are seeded and immutable; an owner
    customises by **cloning** one.
  - Endpoints declare `can('plan:write')`, so adding or editing a role touches no route.
  Full design, caching, and the guardrails editable roles require (catalogue validation, self-lockout, escalation,
  archive-in-use) are in [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).
- **Two role scopes.** `OrganisationMember.roleId` grants across every gym in the organisation and holds the
  org-only powers (create/archive gyms, refunds, ownership transfer). `Employment.roleId` grants at one gym.
  `Gym.ownerId` is replaced by an `OrganisationMember` row, so ownership is transferable, co-ownable, chain-wide.
- Membership (being a customer of a gym) is `Membership` — never a role.
- Retire `Account.userType`. Keep it nullable through one release for the frontend, then drop it.

### 2.2 Mechanism — make scoping impossible to forget

1. **JWT claims**: `sub` (accountId), `profileId`, `organisationId | null`, `platformRole`. Roles per gym are
   **not** in the token (they change without re-login); they are resolved per request and cached for the request.
2. **`tenantScope.middleware.ts`** → sets `req.tenant = { organisationId, profileId, platformRole }`.
   `SUPER_ADMIN` (no organisation) must name the target organization with an `X-Organisation-Id` header; the header is
   **ignored** for everyone else, so there is no escalation path.
3. **`can("plan:write")` middleware** — resolves the caller's org membership and gym employment for the `:gymId`
   in the path, unions their roles' permission sets, and checks the requirement. Attaches `req.permissions` for the
   service layer. Role definitions are cached in-process keyed by `roleId + updatedAt`, so this costs two indexed
   lookups per request and no join. Platform-role gates use a separate `authorize("SUPER_ADMIN")`. Grant-time
   escalation is prevented by subset comparison (`canGrant`), not by rank.
   Also ship `/roles` CRUD (`role:read`/`role:write`) so an owner can manage custom roles — the whole point of
   making roles data.
4. **A scoped Prisma accessor.** Services never receive the bare client — they receive
   `db(req.tenant)`, a thin wrapper that injects `organisationId` into every `where` and every `create`. This is
   the mechanism that makes C-04 structurally impossible rather than a review item. Implementation options and the
   chosen one are recorded in [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).
5. **Cross-organization reads return 404, never 403** — a 403 confirms the resource exists.
6. **A lint-level guard**: a test that enumerates every mounted route and fails if a non-allowlisted route lacks
   `authenticate` + `tenantScope`. Cheap, and it catches the next C-04 before review does.

### 2.3 Migration

`organisations` table; one organisation per existing gym owner; backfill `organisationId` on gyms, employments,
plans, memberships, payments; `OWNER` employment rows from `Gym.ownerId`; check constraint for the `SUPER_ADMIN`
rule. Written by hand as SQL alongside `prisma migrate diff` — see the workflow in
[`database-schema.md`](./database-schema.md).

**Test gate (the most important suite in the project):** for every gym-scoped endpoint, a member of org B receives
**404** for org A's resources — read *and* write, parent *and* child ids. `SUPER_ADMIN` works with the header and
is refused without it. A `MANAGER` cannot perform org-only actions (`gym:archive`, `payment:refund`).
**A `trainer` cannot collect payments or enrol members, and a `receptionist` cannot manage classes** — the pair of
tests a rank-based model would fail. `canGrant` refuses a permission the caller doesn't hold; an unknown permission
key is a 422; an owner cannot remove their own `role:write`; and a role with live assignments cannot be archived.

---

## Phase 3 — Data model remediation

Can run in parallel with Phase 2 (disjoint files, but sequence the migrations).

1. **Money → `Decimal(10,2)`** (H-01) on `SubscriptionPlan.price`, `Payment.amount`, `Product.price`,
   `Order.total`, `OrderItem.price`, `OrderItem.subtotal`. Add `src/utils/money.util.ts` for Decimal-safe
   arithmetic. **Note for the frontend:** Decimals serialise as JSON *strings* — a contract change to fold into the
   Phase 1 release.
2. **Indexes** (H-02): every FK, plus `memberships(gymId, status)`, `memberships(profileId, status)`,
   `memberships(endDate)` (expiry sweep), `payments(gymId, createdAt)`, `payments(status)`,
   `refresh_tokens(accountId, revokedAt)`, `email_verifications(email, expiresAt)`, `products(vendorId, status)`,
   `orders(customerId, createdAt)`.
3. **Membership history** (H-04): drop `@@unique([profileId, gymId, planId])`; add the partial unique index on
   `(profileId, gymId) WHERE status IN ('PENDING','ACTIVE')`; make `lastPaymentId` a real FK.
4. **Check constraints** (raw SQL — Prisma's DSL can't express them): `price >= 0`, `amount > 0`, `duration > 0`,
   `stock >= 0`, `visitsUsed >= 0`, `endDate >= startDate`, and the `SUPER_ADMIN`/organisation rule from Phase 2.
5. **One soft-delete convention** (M-13): nullable `archivedAt` everywhere. `isActive` stays only where it means
   "currently suspended" (`Account.isActive`, `Membership.status: SUSPENDED`) rather than "deleted". Reconcile
   `Product.isActive` with `Product.status` — keep the enum, drop the boolean.
6. **Type the JSON columns** (M-06): a valibot schema + inferred type per column, validated on write, for
   `operatingHours`, `settings`, `preferences`, `features`, `shippingAddress`, `images`. Move
   `businessName` out of `preferences` into a real column (H-08).
7. **UUIDv7 primary keys everywhere** (`@default(uuid(7)) @db.Uuid`) — time-ordered, native 16-byte columns,
   usable directly as pagination cursors. Convert **every** table in one migration, not table by table. The service
   is not in production, so there is no data to preserve and no consumer holding ids; a `cuid()`/`uuid` split would
   otherwise be permanent. Do this **before** Phase 4 so the rewritten modules and their fixtures are written
   against one id type. Reseed rather than migrate data.
8. **Drop the dead denormalisation**: `Product.rating`/`reviewCount` go until a `Review` model exists (Phase 7).

**Test gate:** money round-trips exactly through create → read → payment; renewal after expiry succeeds and both
rows are retained; a second active membership is rejected as 409; `EXPLAIN` confirms index use on the membership
and payment list queries.

---

## Phase 4 — Module refactor

Now rewrite each module onto the Phase 1–3 primitives. One module per branch, in this order (later modules depend
on earlier ones).

**4.1 Auth** — extract gym creation out of `AuthService` (H-08). Registration creates account + profile only.
Self-enrolment becomes an explicit onboarding flow: `POST /organisations` (authenticated, creates organisation +
first gym + `OWNER` employment in one transaction) with real `address`/`city`/`region` required, a slug derived from
the name with a **collision-retry** rather than a timestamp, and an `onboardingStatus` the owner can complete.
Rework the OTP flow onto the Phase 0 primitives; add password reset (missing entirely today).

**4.2 Gyms & organisations** — CRUD under the tenancy layer. `GET /gyms` becomes the paginated, filterable public
directory (`?city=`, `?q=`, `?sort=`) and must filter `archivedAt`/`isActive` — including the slug lookup (M-14).
Restructure the route tree so ordering isn't comment-dependent: put the public directory under
`/public/gyms` or reserve `/gyms/by-slug/:slug`.

**4.3 Staff & employment** — `/gyms/:gymId/employees` with the permission model; invite-by-email flow with a pending
state (today `addEmployeeByEmail` 404s if the person hasn't registered); prevent removing the organisation's last `OWNER`;
audit-log every role change.

**4.4 Subscription plans** — `/gyms/:gymId/plans`, gym-scoped in the `where`. Price changes must not mutate history:
snapshot `price`/`duration`/`durationUnit` onto `Membership` at creation (the same reason the reference project
snapshots `dailyRate`). Archive rather than deactivate.

**4.5 Memberships** — the core motion. Explicit status machine
(`PENDING → ACTIVE → EXPIRED`; `PENDING|ACTIVE → CANCELLED`; `ACTIVE ↔ SUSPENDED`) with illegal transitions → 409.
Staff enrolment and member self-enrolment as separate endpoints with separate authorisation. Expose
`recordVisit` (F-02) — but as part of check-ins in Phase 6, not as a bare counter.

**Test gate per module:** happy path · 422 validation · 401 unauthenticated · 403 wrong role · **404 cross-organization**
· 409 state conflict · pagination `meta`.

---

## Phase 5 — Billing

5.1 **Provider abstraction** — a `PaymentProvider` interface (`initiate`, `verify`, `parseWebhook`) with
`SimulatorProvider` and a real implementation (Paystack is the sensible Ghana default: mobile money + card, GHS
native). Selected by `PAYMENTS_PROVIDER`; the simulator refuses to load in production.

5.2 **Correctness** — server-derived amounts, signed webhooks, and idempotency from Phase 0, now with: an
`idempotencyKey` on initiate, `Payment.rawProviderPayload` for reconciliation, retry-safe webhook handling, and
`PaymentStatus.REFUNDED` actually reachable.

5.3 **Invoices** — an `Invoice` model (number from a per-organisation DB sequence, line items, PDF or hosted view)
issued on payment completion. Receipts by email.

5.4 **Renewals and expiry (F-03)** — a scheduled job (Vercel Cron → an authenticated internal route) that nightly
transitions `ACTIVE` memberships past `endDate` to `EXPIRED`, initiates renewal payments where `autoRenew` is set,
and sends expiry reminders at T-7/T-1 days. Idempotent, resumable, and observable.

5.5 **Payouts to gyms** — decide and document who holds funds. If the platform collects, an organisation ledger and
payout records are needed; if gyms collect directly, each organisation supplies its own provider credentials. This
is a **business decision that blocks implementation** — flag it early.

**Test gate:** a plan-priced payment activates exactly the right membership; a tampered amount is rejected; an
unsigned webhook is rejected; a replayed webhook is a no-op; the expiry job is idempotent across two runs.

---

## Phase 6 — Day-to-day operations

The functional gap (F-01). This is what makes the product a management centre rather than a billing form. Sequenced
by how often a gym would use it.

| Order | Capability | Shape |
|---|---|---|
| 6.1 | **Check-in / attendance** | `CheckIn` table (gym, membership, profile, `checkedInAt`, `checkedOutAt?`, method). `POST /gyms/:gymId/check-ins` validates membership status/expiry/visit cap in one transaction and increments `visitsUsed`. `GET .../check-ins?from=&to=`, plus "currently in" count. Indexed `(gymId, checkedInAt)`. |
| 6.2 | **Dashboard** | `GET /gyms/:gymId/dashboard` — one transaction of counts: active members, expiring in 7 days, revenue this month, check-ins today, new members this month. Backed by the Phase 3 indexes. |
| 6.3 | **Classes & schedules** | `ClassTemplate` + `ClassSession` (trainer, capacity, start/end) + `ClassBooking` with a guarded capacity decrement (the same transaction pattern as marketplace stock) and a waitlist. |
| 6.4 | **Trainer assignment** | Link `Employment(role: TRAINER)` to members; PT sessions and notes. |
| 6.5 | **Staff shifts** | `Shift` per employment; roster view; optional clock-in reusing the check-in machinery. |
| 6.6 | **Equipment register** | `Equipment` + `MaintenanceLog` per gym; status and next-service date. |
| 6.7 | **Notifications** | A queued outbound channel (expiry reminders, receipts, class reminders) driven by `UserProfile.preferences`. |
| 6.8 | **Audit log** | Append-only `AuditEvent` (actor, organisation, gym, action, target, before/after) written by a service-layer helper on every privileged mutation — price changes, role changes, cancellations, refunds. |
| 6.9 | **Branches** | Only if a chain customer needs it; the Phase 2 hierarchy already leaves room. |

Each is a normal vertical slice per [`backend-patterns/SKILL.md`](./backend-patterns/SKILL.md) — the point of
Phases 1–3 is that these become routine.

---

## Phase 7 — Marketplace decision

**Blocked on a product decision** (F-04). Two viable paths:

- **A — per-gym storefronts (recommended).** `Product` and `Order` gain `gymId`/`organisationId`; a vendor is an
  `Employment`, not a `userType`; orders are gym-scoped so a cart is single-vendor by construction; checkout reuses
  the Phase 5 payment module; add `Review` and maintain `rating`/`reviewCount` from it. Fits the tenancy model with
  no new concepts.
- **B — extract.** Move it to its own service with its own tenancy model, and leave this API to gym management.
  Correct if the marketplace is meant to be platform-wide and cross-gym.

Do **not** leave it as-is: a global multi-vendor store with no `gymId` means every tenancy invariant has two
different meanings depending on which router you are in.

Also required either way: order state machine, fulfilment/shipping model, stock guarded inside the transaction
(H-03), order numbers from a sequence, and refunds.

---

## Phase 8 — Hardening and launch

1. **[`openapi.yaml`](./openapi.yaml)** completed for every endpoint and served at `/docs` + `/openapi.json`.
   Keep it in sync with every endpoint change — it is the frontend team's contract.
2. **Acceptance suite** — one Supertest file per requirement group in
   [`Fitness_GH_Requirements_and_MVP.md`](./Fitness_GH_Requirements_and_MVP.md), asserting the acceptance criteria
   by ID.
3. **Observability** — request ids end to end, error tracking, latency and error-rate alerts, a real
   `/health` (DB round-trip + migration status) distinct from `/live`.
4. **Deployment (M-08)** — one coherent shape: a Vercel Function exporting `app` from `api/index.ts`, no legacy
   `builds`/`routes`, no `NODE_TLS_REJECT_UNAUTHORIZED=0`. Migrations run as a deploy step, not at boot. Preview
   deploys get a preview database.
5. **Seed** — a realistic demo dataset: two organisations (to make tenant isolation visible in the UI), several
   gyms, staff across every role, members with memberships in every status including expiring-soon, payments,
   check-in history, classes.
6. **Security review** — dependency audit, secret rotation, a written note on token storage
   (`fitness-gh-frontend` currently holds tokens in the browser and calls the API directly; a BFF proxy is the
   safer shape and worth pricing).
7. **Runbook** — deploy, rollback, migration, incident basics.

---

## Cross-cutting rules (every phase)

- **Layering** per [`backend-patterns/SKILL.md`](./backend-patterns/SKILL.md): routes → controller → service →
  Prisma. Controllers never touch Prisma; services never touch `req`/`res`; validation only in middleware; errors
  only become responses in `error-handler`.
- **Tenancy** per [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md): every query scoped by
   `req.tenant.organisationId`; cross-organization access **404s**; new endpoints are default-deny.
- **HTTP contract** per [`api-design/SKILL.md`](./api-design/SKILL.md): `{ data }` / `{ error }`, correct status
  codes, paginated lists, camelCase JSON.
- **No secrets, PII, or OTPs in logs. Ever.** No bare `console.*` outside `env.config.ts`.
- **Schema changes**: `npx prisma migrate dev --name <change>`, then update
  [`database-schema.md`](./database-schema.md) in the same commit.
- **Branch per unit of work**, conventional commits, gate green before merge.
- **Never speculatively add** Redis, a job queue, a repository layer, a DI container, or GraphQL. Each needs a
  concrete driver — measured load, a second data source, an ops requirement — recorded here when it arrives.

## Open decisions (needed from the product owner)

| # | Decision | Blocks |
|---|---|---|
| D-1 | Payment provider, and whether the platform collects funds or gyms do | Phase 5 |
| D-2 | Marketplace: per-gym storefronts, or extract to its own service | Phase 7 |
| D-3 | Is the business an organisation (chains) or a single gym? | Phase 2 — assumed **organisation** |
| D-4 | Does the platform charge gyms a subscription (SaaS billing), separate from gyms charging members? | Phase 5 |
| D-5 | Timing of the breaking envelope release with `fitness-gh-frontend` | Phase 1 |
| D-6 | Keep valibot or move to Zod | Phase 1 — recommended **keep valibot** |
