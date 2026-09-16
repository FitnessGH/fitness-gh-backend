# Database Schema

PostgreSQL managed with Prisma ORM 6. Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).
Findings: [`codebase-review.md`](./codebase-review.md) §3 · migration sequencing:
[`implementation-plan.md`](./implementation-plan.md) Phase 2–3 · tenancy rules:
[`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

> **This document describes the target schema.** The current schema differs in the ways marked
> **⚠ current** below. Update this file in the **same commit** as any migration.

## Conventions

- **Primary keys**: UUIDv7 (`@default(uuid(7)) @db.Uuid`) **everywhere** — time-ordered for B-tree index locality,
  native 16-byte `uuid` columns instead of 25-char text, and usable directly as cursors for cursor pagination.
  **⚠ current:** every table uses `cuid()`. **Convert them all.** The service is not in production yet, so there is
  no data worth preserving and no external consumer holding ids — this is the last cheap moment to do it. Migrate
  the whole schema in one migration (Phase 3), not table by table: a half-converted schema means every join and
  every fixture has to remember which side is which.
- **Money**: `Decimal(10,2)`, single currency (GH₵). **Never `Float`.** Decimals serialise to JSON as strings.
  **⚠ current:** every money column is `Float` (H-01).
- **Naming**: PascalCase models, camelCase fields in Prisma; plural snake_case table names via `@@map`
  (`user_profiles`, `subscription_plans`). JSON API payloads stay camelCase end to end.
- **Timestamps**: every mutable table has `createdAt` + `updatedAt`. Lifecycle events get their **own nullable
  timestamps** (`cancelledAt`, `paidAt`, `archivedAt`, `checkedOutAt`) rather than being inferred from `updatedAt`.
- **Soft delete**: one convention — nullable `archivedAt`. `isActive` survives only where it means "currently
  suspended", not "deleted".
  **⚠ current:** four conventions coexist — `isActive` (gym, plan), `isActive` + `endDate` (employment),
  `isActive` + `status` (product), hard `delete()` (profile).
- **Enums for state**, never free-text status strings. `Payment.provider` and `Payment.channel` are the exception
  and should become enums.
- **Organization column on every organization-owned row**: `organisationId`, even when derivable through a join.
  See [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md) for why the redundancy is load-bearing.
- **Derived values are computed, not stored** — with one deliberate exception (price snapshots, below).

## Organization and Business Boundaries

```
Organisation      ← the business. Billable organization.
  └── Gym         ← a location/club
        └── Branch     (reserved for Phase 6; not built)
```

- **Organization-scoped**: gyms, staff accounts, payments, invoices, audit events
- **Gym-scoped**: employments, subscription plans, memberships, check-ins, classes, equipment
- **Derived (no direct organization FK)**: order items (via order), maintenance logs (via equipment)
- **Global, deliberately**: `Account` credentials — login resolves the organisation from the account
- **Platform users**: `Account.platformRole = SUPER_ADMIN` ⇔ `organisationId IS NULL`, enforced by check constraint
  `accounts_super_admin_org_check`

**⚠ current:** there is no `Organisation`, no `organisationId` anywhere, and the organization boundary exists only
as `Gym.ownerId` plus hand-written `checkGymAccess()` calls (H-07, C-04).

### Uniqueness scoping

| Field | Scope | Why |
|---|---|---|
| `accounts.email` | global | Login resolves the organisation from the account |
| `accounts.phone` | global | Same |
| `user_profiles.username` | global | Public handle |
| `organisations.slug`, `gyms.slug` | global | Public URLs |
| `subscription_plans.name` | per gym | Two gyms may both sell "Premium" |
| one live `Membership` | per `(profileId, gymId)` | **Partial** unique index where `status IN ('PENDING','ACTIVE')` |
| `Employment` | per `(profileId, gymId)` | Already correct today |
| `invoices.number` | per organization | Sequential per organization, from a counter table |

## Models

### Identity

| Model | Table | Purpose | Notes |
|---|---|---|---|
| `Account` | `accounts` | Credentials + platform identity | `email`, `passwordHash`, `phone?`, `emailVerified`, `platformRole`, `isActive`, `lastLoginAt`. **⚠ current:** carries `userType` instead of `platformRole` (H-09) |
| `UserProfile` | `user_profiles` | Person: identity, fitness data, preferences | 1:1 with `Account`; `username` global; body metrics are **private** and never in a public projection (C-05) |
| `RefreshToken` | `refresh_tokens` | Rotating session tokens | `revokedAt` on rotation. Already implemented correctly |
| `EmailVerification` | `email_verifications` | OTP for email verification | **⚠ current:** stores the OTP in **plaintext**, keyed `@@unique([email, otp])`, no `attempts` (C-08). Target: `otpHash`, `attempts`, `@@unique([email])` |

### Organization and Business

| Model | Table | Purpose |
|---|---|---|
| `Organisation` | `organisations` | The business organization: `name`, `slug` (unique), `onboardingStatus`, `isActive`, billing details |
| `Gym` | `gyms` | A location: address, geo, contact, branding, `operatingHours`, `settings`, `archivedAt` |
| `OrganisationMember` | `organisation_members` | Person ↔ organisation, with `roleId → Role` (scope `ORGANISATION`). **Replaces `Gym.ownerId`** — ownership is a row, so it is transferable, co-ownable, and spans every gym in a chain |
| `Employment` | `employments` | Person ↔ **gym**, with `roleId → Role` (scope `GYM`). Independent of org membership: a manager at one gym is not a manager at another |
| `Role` | `roles` | A named permission set. `organisationId = null` ⇒ a **system role** (seeded: `owner`, `admin`, `manager`, `receptionist`, `trainer`, `staff`), immutable and shared. Non-null ⇒ a custom role owned by that organisation. `scope` limits where it may be assigned; `isSystem` blocks edits; `archivedAt` instead of deletion |
| `RolePermission` | `role_permissions` | `(roleId, permission)`. `permission` is validated against the code catalogue on write — an unknown key is a 422, and a CI test asserts none is persisted |
| `Permission` | `permissions` | Seeded projection of `PERMISSION_CATALOGUE` with display labels, so the admin UI can render a resource × action matrix. Retired keys get `deprecatedAt`, never a delete |

**Roles are data; permissions are code.** `Employment.role` stops being an enum and becomes
`Employment.roleId → Role`. `Role` rows are editable per organisation, so an owner can define a "Cleaner" role or
let their trainers take payments without a deploy. Permission **keys** stay a code-owned typed catalogue
(`src/core/permissions.ts`) because the code is what enforces them — the `permissions` table is a seeded projection
of that catalogue, never the reverse. Full rationale, caching, and the guardrails that editable roles require are
in [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

There is deliberately **no rank ordering**: the seeded `trainer` and `receptionist` roles hold disjoint permissions
(classes versus payments), so no linear hierarchy is correct.

### Subscriptions and billing

| Model | Table | Purpose | Notes |
|---|---|---|---|
| `SubscriptionPlan` | `subscription_plans` | Gym-defined plan: `price` Decimal, `duration` + `durationUnit`, `features`, `maxVisits?`, `sortOrder`, `archivedAt` | |
| `Membership` | `memberships` | A member's subscription to a plan | Status machine; **snapshots** `price`/`duration`/`durationUnit` at creation; `lastPaymentId` a real FK |
| `Payment` | `payments` | Transaction record | `amount` Decimal, `reference` unique, `provider`, `channel`, `status`, `paidAt`, `idempotencyKey`, `rawProviderPayload` |
| `Invoice` | `invoices` | Issuable document (Phase 5) | `number` per-organisation sequential, line items, `issuedAt` |
| `Counter` | `counters` | Race-safe per-organisation-per-year sequences behind `invoice.number` and `order.orderNumber` | Atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` inside the creating transaction |

### Operations (Phase 6)

| Model | Table | Purpose |
|---|---|---|
| `CheckIn` | `check_ins` | Append-only visit log: gym, membership, profile, `checkedInAt`, `checkedOutAt?`, `method`. Powers attendance, "currently in", peak hours |
| `ClassTemplate` / `ClassSession` / `ClassBooking` | | Group classes with capacity, trainer, and a waitlist |
| `Shift` | `shifts` | Staff roster per employment |
| `Equipment` / `MaintenanceLog` | | Asset register per gym |
| `AuditEvent` | `audit_events` | Append-only: actor, organisation, gym, action, target, before/after |

### Marketplace

**Blocked on a product decision** (F-04, D-2 in the plan). `Product`, `Order`, `OrderItem` currently carry **no
tenant column at all** and a "vendor" is a `UserProfile` with `userType: EMPLOYEE`. Either add
`organisationId`/`gymId` and make a vendor an `Employment` (per-gym storefronts), or extract the whole thing into
its own service. `Product.rating`/`reviewCount` are dropped until a `Review` model exists.

## Status machines

Enforce these in the service layer and reject illegal transitions with **409**.

```
MembershipStatus:  PENDING ──→ ACTIVE ──→ EXPIRED
                      │          │
                      │          ├──→ SUSPENDED ──→ ACTIVE
                      └──────────┴──→ CANCELLED

PaymentStatus:     PENDING ──→ COMPLETED ──→ REFUNDED
                      └──→ FAILED

OrderStatus:       PENDING → PROCESSING → SHIPPED → DELIVERED
                      └──────┴──→ CANCELLED → REFUNDED
```

**⚠ current:** no transition is validated anywhere. `updateMembership` accepts any `status` from the request body,
so a receptionist can set `EXPIRED` → `ACTIVE` directly, bypassing payment.

## Design decisions

**Ownership is a role, not a foreign key.** `Gym.ownerId` makes ownership untransferable, prevents co-ownership,
and creates two authorisation paths (`isOwner` versus `employment.role`) that the current code has to branch on
everywhere. One `Employment` row with `role: OWNER` collapses both.

**One live membership per member per gym; unlimited history.** A partial unique index on
`(profileId, gymId) WHERE status IN ('PENDING','ACTIVE')` gives the invariant that matters while leaving expired and
cancelled rows in place. **⚠ current:** `@@unique([profileId, gymId, planId])` means a member who has ever held a
plan can **never hold it again** — renewals, the core motion of a subscription business, are impossible (H-04). The
application also enforces a *different*, looser rule than the database, so the two disagree and the DB wins with an
unmapped `P2002` → 500.

**Prices are snapshotted onto the membership.** A gym editing a plan's price must not rewrite what existing members
agreed to pay, and reporting on historical revenue must be reproducible. The plan row stays the current offer; the
membership row holds the agreed terms. This is the only deliberate denormalisation in the schema.

**Everything else derivable is not stored.** No `available` column, no `isExpired` flag (expired =
`status = ACTIVE AND endDate < now()`, swept nightly into `EXPIRED`), no `memberCount` on `Gym`, no `rating` on
`Product` without a `Review` table behind it. **⚠ current:** `Product.rating` and `reviewCount` are stored,
maintained by nothing, and permanently `0` (M-06).

**Check-ins are a raw append-only log.** No `UNIQUE(membershipId, date)` — multiple visits per day and
check-in/check-out pairs must stay possible. `Membership.visitsUsed` is a counter maintained *by* the check-in
transaction, not the source of truth; the log is.

**JSON columns are schema-validated at the edge.** `operatingHours`, `settings`, `preferences`, `features`,
`shippingAddress`, `images` each get a valibot schema and an inferred TypeScript type, validated on write.
**⚠ current:** all six are untyped `Json?` documented only in a comment — clients cannot rely on any of them
(M-06). `businessName`, currently stuffed into `preferences` by the auth service, becomes a real column.

**Availability and capacity are arbitrated by the database, not by a read-then-write.** Product stock, class-session
capacity, and visit caps all use a guarded update inside a transaction
(`UPDATE … WHERE … >= :qty`), treating zero affected rows as a conflict. **⚠ current:** marketplace stock is
checked *before* the transaction and decremented inside it, so two concurrent orders both succeed and stock goes
negative (H-03).

## Check constraints

Application validation is not enough — back it with SQL (Prisma's DSL can't express these, so they go in a
migration as raw SQL):

```sql
ALTER TABLE accounts        ADD CONSTRAINT accounts_super_admin_org_check
  CHECK ((platform_role = 'SUPER_ADMIN') = (organisation_id IS NULL));
ALTER TABLE subscription_plans ADD CONSTRAINT plans_price_check      CHECK (price >= 0);
ALTER TABLE subscription_plans ADD CONSTRAINT plans_duration_check   CHECK (duration > 0);
ALTER TABLE payments        ADD CONSTRAINT payments_amount_check     CHECK (amount > 0);
ALTER TABLE memberships     ADD CONSTRAINT memberships_dates_check   CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
ALTER TABLE memberships     ADD CONSTRAINT memberships_visits_check  CHECK (visits_used >= 0);
ALTER TABLE products        ADD CONSTRAINT products_stock_check      CHECK (stock >= 0);
ALTER TABLE order_items     ADD CONSTRAINT order_items_qty_check     CHECK (quantity > 0);

CREATE UNIQUE INDEX memberships_one_live_per_gym
  ON memberships (profile_id, gym_id)
  WHERE status IN ('PENDING', 'ACTIVE');

-- A system role must not be owned by an organisation, and vice versa.
ALTER TABLE roles ADD CONSTRAINT roles_system_org_check
  CHECK ((is_system = true) = (organisation_id IS NULL));

-- A role may only be assigned where its scope allows.
-- (Enforced in the service too; the constraint is the backstop.)
```

**⚠ current:** there are **no check constraints** and no partial indexes.

## Indexes

**⚠ current: the schema has only one hand-added index** (`payments(membershipId, status, createdAt)`, added
alongside the C-01 payment-initiation query it serves) — otherwise no `@@index` anywhere, and **Prisma does not
auto-index foreign keys on PostgreSQL** (H-02). Every other list query in the service is a sequential scan.

Required beyond primary keys and uniques:

```prisma
// Tenancy — every scoped query filters on these first
@@index([organisationId])                    // gyms, payments, invoices, audit_events
@@index([gymId])                             // employments, subscription_plans, memberships, check_ins

// Hot paths
@@index([gymId, status])                     // memberships — the gym's member list, filtered
@@index([profileId, status])                 // memberships — "my memberships"
@@index([endDate])                           // memberships — nightly expiry sweep + expiring-soon dashboard
@@index([gymId, createdAt])                  // payments — gym revenue, newest first
@@index([status])                            // payments — reconciliation
@@index([profileId, createdAt])              // payments — a member's history
@@index([gymId, checkedInAt])                // check_ins — attendance by date range
@@index([accountId, revokedAt])              // refresh_tokens — active session lookup
@@index([email, expiresAt])                  // email_verifications — OTP lookup
@@index([roleId])                            // employments, organisation_members — permission resolution
@@index([organisationId, scope])             // roles — the org's assignable role list
@@index([profileId, isActive])               // employments — resolving the caller's gym role per request
@@index([vendorId, status])                  // products
@@index([customerId, createdAt])             // orders
```

Add an index when you add a `where` clause, in the same migration. Verify with `EXPLAIN` on a seeded table, not by
assumption.

## Workflow

```bash
npx prisma migrate dev --name <change>   # schema change (needs an interactive terminal)
npx prisma generate                      # regenerate the client
npx prisma migrate deploy                # apply in CI/production
npx prisma db seed                       # wipe + reseed demo data (prisma/seed.ts)
npx prisma studio                        # browse data
```

- **Never `prisma db push`** on a project with a migrations directory — it is the fastest route to drift. Remove
  the `db:push` script.
- Raw SQL (check constraints, partial indexes, counter upserts) is appended by hand to the generated
  `migration.sql` in the same migration.
- In a non-interactive session, generate the SQL with
  `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`, place it in a
  hand-made `prisma/migrations/<timestamp>_<name>/migration.sql`, then `prisma migrate deploy` + `prisma generate`.
- `prisma migrate reset` **destroys data — stop and ask the user** before running it, in any environment.
- Update this document in the same commit as the migration.

## Client

One `PrismaClient` for the process, constructed only in `src/config/prisma.config.ts` and guarded on `globalThis`
so `tsx watch` reloads and serverless cold starts don't leak connection pools (M-09). Services never import it
directly — they receive the organization-scoped handle
(see [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md)).

The Prisma **CLI** config belongs at the repo root as `prisma.config.ts`. **⚠ current:** it lives at
`src/config/prisma.config.ts` and is re-exported from `src/config/index.ts`, which pulls CLI internals into the
application barrel (M-13).
