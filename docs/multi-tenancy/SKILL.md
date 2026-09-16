---
name: multi-tenancy
description: Tenant isolation and authorisation law for this multi-tenant gym-management API — the Organisation → Gym hierarchy, JWT claims, tenantScope middleware, the scoped Prisma accessor, data-driven roles over a code-owned permission catalogue, and the 404-not-403 rule. Use when writing or reviewing ANY endpoint, service query, or schema change that touches tenant-owned data.
---

# Multi-Tenancy

**This is the highest-risk area of the codebase.** Four of the seven Critical findings in
[`codebase-review.md`](../codebase-review.md) are tenant-isolation failures, and they all have the same root cause:
scoping was *optional*. This skill exists to make it mandatory.

Read alongside [`backend-patterns/SKILL.md`](../backend-patterns/SKILL.md) (how code is structured) and
[`api-design/SKILL.md`](../api-design/SKILL.md) (the HTTP contract).

## When to Activate

- Writing or reviewing **any** endpoint that reads or writes gym-owned data
- Writing any Prisma query in a service
- Adding a model, column, or relation
- Reviewing an authorisation change, a new role, or anything touching the JWT
- Any time you are about to write `where: { id }`

## The hierarchy

```
Organisation      ← the tenant. Billable entity. Owns everything.
  └── Gym         ← a location/club. Has its own staff, plans, members.
        └── Branch     (optional, Phase 6 — reserved, not built)
```

- **Organisation-scoped**: accounts/staff, plans (via gym), payments, invoices, audit events
- **Gym-scoped**: employments, memberships, check-ins, classes, equipment
- **Derived (no direct FK)**: order items (via order), maintenance logs (via equipment)
- **Global (deliberately not scoped)**: `Account` credentials — login resolves the organisation from the account,
  so `accounts.email` is globally unique
- **Platform users**: `Account.platformRole = SUPER_ADMIN` ⇔ `organisationId IS NULL`, enforced by a DB check
  constraint, not just application code

Every tenant-owned row carries `organisationId` **even when it is derivable through a join**. The redundancy is the
point: it lets the scoped accessor filter without a join, it makes a partial index possible, and it turns a missed
scope into an empty result rather than a leak.

## The role axes — do not conflate them

The current schema's `Account.userType` conflates platform identity with per-gym role, which is why one person
cannot be a member at one gym and a trainer at another (finding H-09). Keep them separate:

| Axis | Where it lives | Values | In the JWT? |
|---|---|---|---|
| **Platform role** | `Account.platformRole` | `SUPER_ADMIN`, `USER` | **Yes** — it never changes mid-session |
| **Organisation role** | `OrganisationMember.roleId → Role` | seeded `owner`/`admin`, or custom | **No** — resolved per request |
| **Per-gym role** | `Employment.roleId → Role` | seeded `manager`/`receptionist`/`trainer`/`staff` **plus any custom role the organisation defines** | **No** — resolved per request |
| **Customer relationship** | `Membership` | not a role at all | No |

Only the platform role is in the token. Organisation and gym roles are **not**: a manager demoted mid-session must
lose access immediately, not in 15 minutes, and roles are now editable data that can change under a live session.
Resolve them per request (see caching below).

### Roles are data; permissions are code

Two designs to reject before the right one.

**Reject a linear rank.** `OWNER > MANAGER > TRAINER > RECEPTIONIST > STAFF` asserts each role is a **superset** of
the one below. `TRAINER` and `RECEPTIONIST` are not comparable: a receptionist collects payments and enrols members;
a trainer runs classes and sees assigned members. Ranking `TRAINER > RECEPTIONIST` grants every trainer
payment-collection rights by accident; ranking the other way breaks classes.

**Reject a hardcoded role → permission map.** It fixes the rank bug but every adjustment — "our trainers should be
able to take payments", "we need a Cleaner role" — becomes a code change, a review, and a deploy. It does not
scale past the first customer who asks.

**The split that works:**

| | Owned by | Why |
|---|---|---|
| **Permission keys** (`plan:write`) | **Code** — a closed, typed catalogue | The code is what enforces them. `can('plna:write')` must fail to compile, not silently grant nothing. A permission that no route checks is a lie. |
| **Roles and their permissions** | **Data** — rows an organisation can edit | This is the part that varies per gym, per market, per customer. It must be editable at runtime by an owner, with no deploy. |

So permissions are a fixed vocabulary the code publishes; roles are sentences written in it by users.

#### The permission catalogue (code)

```typescript
// src/core/permissions.ts — the single source of truth for what CAN be enforced.
// resource × action, so the admin UI renders a checkbox matrix instead of a flat list of strings.
export const PERMISSION_CATALOGUE = {
  gym:        ['read', 'write', 'archive'],
  staff:      ['read', 'write'],
  role:       ['read', 'write'],              // manage custom roles
  plan:       ['read', 'write', 'archive'],
  membership: ['read', 'write', 'suspend'],
  checkin:    ['read', 'write'],
  payment:    ['read', 'collect', 'refund'],
  class:      ['read', 'write'],
  equipment:  ['read', 'write'],
  report:     ['read'],
} as const

export type Permission = {
  [R in keyof typeof PERMISSION_CATALOGUE]: `${R}:${(typeof PERMISSION_CATALOGUE)[R][number]}`
}[keyof typeof PERMISSION_CATALOGUE]
// → 'gym:read' | 'gym:write' | … — a typo in can('…') is a compile error
```

Adding a permission is a code change **because adding one only means something if a route checks it**. A seed step
syncs the catalogue into a `permissions` table (with display labels and descriptions) so the admin UI can render
it; the table is a projection of the code, never the other way round. Removing a key marks the row
`deprecatedAt` rather than deleting it, so existing role assignments degrade visibly instead of vanishing.

#### Roles (data)

```prisma
model Role {
  id             String    @id @default(uuid(7)) @db.Uuid
  // null = a system role, seeded and shared by every organisation
  organisationId String?   @db.Uuid
  organisation   Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  key            String    // stable identifier, e.g. "manager" — used in seeds and tests
  name           String    // editable display name
  description    String?
  scope          RoleScope // ORGANISATION | GYM — where the role may be assigned
  isSystem       Boolean   @default(false) // seeded, not editable, not deletable
  archivedAt     DateTime?

  permissions    RolePermission[]
  employments    Employment[]
  orgMembers     OrganisationMember[]

  @@unique([organisationId, key])
  @@index([organisationId, scope])
  @@map("roles")
}

model RolePermission {
  roleId     String @db.Uuid
  permission String        // validated against the code catalogue on write
  role       Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([roleId, permission])
  @@map("role_permissions")
}

enum RoleScope {
  ORGANISATION
  GYM
}
```

`Employment.role` (an enum today) becomes `Employment.roleId → Role`, and `OrganisationMember.roleId → Role`. The
seed ships system roles — `owner`, `admin` (organisation scope); `manager`, `receptionist`, `trainer`, `staff`
(gym scope) — so a new organisation works immediately. An owner can then **clone a system role and edit the copy**
(`POST /roles { cloneFrom: "trainer" }`), which is the safe path: system roles stay immutable, so a platform-wide
change to "manager" can never be broken by one customer's edit.

#### Resolution and caching

Permissions resolve per request, never from the JWT (a demotion must take effect immediately, not in 15 minutes).
Naively that is two joins on every request, so cache the *role definition* — which changes rarely — not the
request:

```typescript
// src/core/permission-resolver.ts
export async function resolvePermissions(
  db: PrismaClient, tenant: TenantContext, gymId?: string,
): Promise<ReadonlySet<Permission>> {
  const [orgMember, employment] = await Promise.all([
    db.organisationMember.findFirst({
      where: { organisationId: tenant.organisationId, profileId: tenant.profileId, archivedAt: null },
      select: { roleId: true },
    }),
    gymId
      ? db.employment.findFirst({
          where: { gymId, profileId: tenant.profileId, isActive: true },
          select: { roleId: true },
        })
      : null,
  ])

  const roleIds = [orgMember?.roleId, employment?.roleId].filter(Boolean) as string[]
  const sets = await Promise.all(roleIds.map(id => permissionsForRole(db, id)))
  return new Set(sets.flat())
}

// Role definitions are read-mostly: cache them in-process, keyed by role id + updatedAt.
// Invalidate by bumping Role.updatedAt on any RolePermission write — no cross-instance
// invalidation needed because the key contains the version.
const roleCache = new LRU<string, readonly Permission[]>({ max: 500, ttl: 60_000 })
```

Two round-trips per request for the memberships (indexed, sub-millisecond), zero for the permission sets after the
first. If that ever shows up in a profile, the next step is a materialised
`profile_gym_permissions` view — not embedding permissions in the token.

Middleware, named `can` (not `require` — that shadows CommonJS):

```typescript
export function can(...required: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const gymId = req.validatedParams?.gymId
    req.permissions ??= await resolvePermissions(prisma, req.tenant!, gymId)
    if (!required.every(p => req.permissions!.has(p)))
      throw new ForbiddenError(`Requires ${required.join(', ')}`, 'insufficient_permission')
    next()
  }
}
```

```typescript
this.router.get('/', can('plan:read'), plansController.listPlans)
this.router.post('/', can('plan:write'), validateBody(createPlanSchema), plansController.createPlan)
this.router.delete('/:planId', can('plan:archive'), plansController.archivePlan)
```

#### Guardrails on editable roles

Making roles data introduces failure modes a hardcoded map cannot have. Each needs an explicit rule:

| Risk | Rule |
|---|---|
| Unknown permission strings accumulate in `role_permissions` | Validate every key against the code catalogue on write; reject with 422. A test asserts no persisted key is outside the catalogue. |
| An owner locks themselves out | An organisation must always retain at least one principal holding `role:write` **and** `staff:write`. Enforced in the service, tested. |
| Privilege escalation via role editing | `role:write` is itself a permission, and **a caller may only grant permissions they already hold** (subset check below). A manager cannot mint a role with `payment:refund`. |
| System roles diverge per customer | `isSystem` roles are immutable and undeletable; customisation clones them. |
| A role in use is deleted | Archive, don't delete; reassignment is required before archiving a role with live assignments (409). |
| Permission drift between code and DB | A CI test asserts every catalogue key is checked by at least one route, and every route's `can(...)` argument exists in the catalogue. |

Escalation prevention is still set logic, now over data:

```typescript
// You may only grant what you hold — for role editing and for role assignment alike.
export function canGrant(actor: ReadonlySet<Permission>, granting: Iterable<Permission>): boolean {
  return [...granting].every(p => actor.has(p))
}
```

Why this is the right default here: it is correct for lateral roles, an owner can adjust who does what without a
deploy, endpoints declare intent (`can('plan:write')`) so adding a role touches no route, escalation is one subset
check, and the permission vocabulary stays typed and closed. The cost is one extra table pair, a cache, and the
guardrails above — proportionate, and it removes a migration that would otherwise be forced by the first customer
who asks for a custom role.

**Deferred:** field-level and row-level permission grants, permission bundles/templates beyond role cloning, and a
policy engine (CASL, Cedar, oso) for attribute-based rules. Record the driver here if one arrives.

### Permissions gate the endpoint; the service decides *whose*

Permissions are coarse. Relationship rules stay in the service layer, where the data is:

| Rule | Enforced by |
|---|---|
| "may read memberships" | `can('membership:read')` on the route |
| "…but a trainer only sees **assigned** members" | the service, filtering on the trainer assignment |
| "a member may cancel **their own** membership" | the service, comparing `req.tenant.profileId` |
| "may collect payments" | `can('payment:collect')` |
| "…for a membership at **this** gym" | the service's `where: { id, gymId }` |

Don't push relationship predicates into the permission layer — that is the point at which people reach for a
policy engine (CASL, Cedar, oso) and end up with authorisation split across two systems. Coarse permission at the
edge, ownership in the service, is enough for everything in
[`Fitness_GH_Requirements_and_MVP.md`](../Fitness_GH_Requirements_and_MVP.md).

The current `checkGymAccess(gymId, profileId, requiredRoles?)` fails all of this — optional roles default to "any
employment", exact-list matching drifts between call sites, and there is no `SUPER_ADMIN` path. Replace it; don't
extend it.

**Deferred:** per-gym custom roles (persisting the map, plus an admin UI) and a policy engine. Neither is justified
until a customer asks for a role the static map can't express — record the request here when it happens.

## JWT claims

```typescript
type AccessTokenClaims = {
  sub: string                     // accountId
  profileId: string
  organisationId: string | null   // null ⇔ platformRole === 'SUPER_ADMIN'
  platformRole: 'SUPER_ADMIN' | 'USER'
}
```

Nothing else. No gym roles, no permission arrays, no email. Refresh tokens stay opaque, persisted, and rotated on
use (the current implementation already does this correctly — keep it).

## The request pipeline

```
authenticate  →  tenantScope  →  can(permission)  →  validate  →  controller  →  service
```

1. **`authenticate`** — verifies the Bearer token, loads the account, rejects inactive accounts, sets `req.auth`.
2. **`tenantScope`** — resolves the acting organisation and sets `req.tenant`. **Every** route except the explicit
   public allowlist gets this.
3. **`can(...permissions)`** — resolves the caller's organisation membership and, for routes with a `:gymId`,
   their employment at that gym; unions the two roles' permission sets; sets `req.permissions`. 404 if the gym
   isn't in the caller's organisation (see below), 403 (`insufficient_permission`) if a permission is missing.
4. **Service** — receives a scoped db handle; every query is already filtered.

### `tenantScope` — and the SUPER_ADMIN escape hatch

```typescript
// src/middlewares/tenant-scope.middleware.ts
export function tenantScope(req: Request, _res: Response, next: NextFunction): void {
  const { organisationId, platformRole, profileId } = req.auth!

  if (platformRole === 'SUPER_ADMIN') {
    // Platform users have no organisation of their own and must name the target explicitly.
    const target = req.header('X-Organisation-Id')
    if (!target)
      throw new ForbiddenError('Platform users must supply X-Organisation-Id', 'organisation_required')
    req.tenant = { organisationId: target, profileId, platformRole, impersonating: true }
    return next()
  }

  if (!organisationId)
    throw new ForbiddenError('Account is not attached to an organisation', 'no_organisation')

  // The header is IGNORED for organisation users — this is the whole security property.
  req.tenant = { organisationId, profileId, platformRole, impersonating: false }
  next()
}
```

The header must be **ignored, not validated**, for non-platform users. Validating it invites a bug where a
well-formed header from an ordinary user is honoured. Log every `impersonating: true` request to the audit trail.

## The scoped accessor — the mechanism that actually prevents leaks

Manual scoping is what failed. Reviews cannot reliably catch a missing `organisationId` in a `where` clause across
dozens of endpoints, and finding C-04 is the proof: six endpoints authorised the *parent* and then operated on an
unscoped *child* id.

So services do not receive `PrismaClient`. They receive a tenant-bound handle:

```typescript
// src/config/prisma.config.ts
const TENANT_MODELS = ['gym', 'employment', 'subscriptionPlan', 'membership', 'payment', 'checkIn'] as const

export function tenantDb(tenant: TenantContext) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.includes(model as never))
            return query(args)

          if (operation === 'create' || operation === 'createMany')
            return query(withOrganisationOnData(args, tenant.organisationId))

          // findUnique/findFirst/findMany/update/delete/count/aggregate/upsert
          return query(withOrganisationInWhere(args, tenant.organisationId))
        },
      },
    },
  })
}
```

Notes that matter in practice:

- `findUnique` cannot take a non-unique filter — rewrite it to `findFirst` inside the extension (or write
  `findFirst` in services by convention and reserve `findUnique` for globally-unique lookups like
  `accounts.email`).
- Keep `TENANT_MODELS` as an explicit allowlist, and add a test that fails when a new model with an
  `organisationId` column is missing from it.
- The bare `prisma` client stays exported for the three legitimate unscoped paths — authentication, the public gym
  directory, and platform administration — and those call sites are few enough to review by hand. Name them.

Given that, a service method is simply:

```typescript
export class PlansService {
  async update(db: TenantClient, gymId: string, planId: string, input: UpdatePlanInput) {
    // gymId is still explicit: organisation scoping does not imply gym scoping
    const plan = await db.subscriptionPlan.findFirst({ where: { id: planId, gymId } })
    if (!plan)
      throw new NotFoundError('Subscription plan not found')      // 404, not 403
    return db.subscriptionPlan.update({ where: { id: plan.id }, data: input })
  }
}
```

Two layers of defence: the extension guarantees `organisationId`, the explicit `gymId` guarantees the child belongs
to the gym in the URL. **Both are required** — organisation scoping alone still lets one gym in a chain edit
another's plans.

## The rules

### 1. Cross-tenant access returns 404, never 403

A 403 confirms the resource exists, which is itself a leak (it lets an attacker enumerate other tenants' ids).
Reserve 403 for *your own* tenant's resources that your role can't touch.

```typescript
// GOOD — indistinguishable from "never existed"
const membership = await db.membership.findFirst({ where: { id, gymId } })
if (!membership) throw new NotFoundError('Membership not found')

// BAD — leaks existence
const membership = await prisma.membership.findUnique({ where: { id } })
if (membership.gymId !== gymId) throw new ForbiddenError('Not your gym')
```

### 2. Never trust an id from the client as a scope

Path params, body fields, and query params are all attacker-controlled. `organisationId` comes **only** from
`req.tenant`. `profileId` comes **only** from `req.auth`. A body that contains `organisationId`, `profileId`, or
`vendorId` must have that field stripped by the validator (use strict object schemas so unknown keys are rejected
outright).

```typescript
// BAD — the current payments module does exactly this
const payment = await service.initiate({ profileId, ...req.body })  // body carries membershipId AND amount

// GOOD
const payment = await service.initiate(db, req.tenant.profileId, req.body.membershipId)
// service derives gymId and amount from the membership + plan it just loaded, scoped
```

### 3. Scope the child, not just the parent

This is finding C-04, stated as a rule. If a route is
`/gyms/:gymId/plans/:planId`, authorising `:gymId` is *necessary and not sufficient*. Every query for `:planId`
carries `gymId` in its `where`.

Applies to: plans, memberships, employments, payments, check-ins, class sessions, equipment — anything addressed by
its own id underneath a parent.

### 4. Every list query is scoped and paginated

An unscoped `findMany` in a multi-tenant service is a data breach, not a performance issue. An unpaginated one is
both. The scoped accessor handles the first; you handle the second.

### 5. Uniqueness is scoped too

| Field | Scope | Why |
|---|---|---|
| `accounts.email` | **global** | Login resolves the organisation from the account |
| `user_profiles.username` | **global** | Public handle |
| `gyms.slug` | **global** | Public URL |
| `subscription_plans.name` | per gym | Two gyms may both have "Premium" |
| one active `Membership` | per `(profileId, gymId)` | Partial unique index on `status IN ('PENDING','ACTIVE')` |
| `Employment` | per `(profileId, gymId)` | Already correct today |
| `invoices.number` | per organisation | Sequential per tenant, from a DB sequence |

### 6. Enumerate the public allowlist explicitly

Public endpoints are a short, deliberate list — currently the gym directory, gym-by-slug, plan browsing, auth, and
health. Everything else is authenticated and tenant-scoped. Keep the list in `src/core/public-routes.ts` and assert
it in a test:

```typescript
it('every mounted route is authenticated and tenant-scoped unless allowlisted', () => {
  for (const route of enumerateRoutes(app)) {
    if (PUBLIC_ROUTES.includes(route.path)) continue
    expect(route.stack.map(l => l.name)).toContain('authenticate')
    expect(route.stack.map(l => l.name)).toContain('tenantScope')
  }
})
```

This test is worth more than any amount of review discipline: it fails when someone adds an endpoint and forgets.

### 7. Public endpoints must not leak tenant data either

`GET /gyms` and `GET /gyms/by-slug/:slug` are public, so they must filter `archivedAt`/`isActive` (finding M-14 —
the slug lookup currently returns soft-deleted gyms) and return a **narrow public projection**: no owner email, no
settings, no staff, no member counts. Public list responses get their own serialiser, never the raw Prisma row.

## Testing tenancy

Every gym-scoped endpoint needs the **cross-tenant 404 test**. Make it cheap with a fixture that builds two
complete organisations, then loop:

```typescript
// test/helpers.ts gives you two isolated worlds
const a = await seedOrganisation({ slug: 'test-org-a' })
const b = await seedOrganisation({ slug: 'test-org-b' })

it.each(GYM_SCOPED_ENDPOINTS)('%s isolates tenants', async ({ method, path, body }) => {
  await request(app)[method](path(a.gym.id, a.plan.id))   // A's own resource
    .set(authHeaderFor(b.owner))                          // B's credentials
    .send(body)
    .expect(404)                                          // not 403, not 200
})
```

Also assert, for each endpoint: a lower role gets 403 within its own organisation; `SUPER_ADMIN` succeeds with
`X-Organisation-Id` and is refused without it; an `X-Organisation-Id` header sent by an ordinary user is **ignored**
(they still see only their own data).

## Anti-patterns seen in this codebase

| Anti-pattern | Where | Correct form |
|---|---|---|
| Authorise parent, act on unscoped child id | plans, memberships, employments (C-04) | `where: { id, gymId }` |
| `checkGymAccess()` called by hand per method | every gym controller (H-07) | middleware + scoped accessor |
| Optional `requiredRoles` defaulting to "any employment" | `gym.service.ts` | explicit `can(permission)`, never optional |
| `SUPER_ADMIN` allowed at the route, rejected in the service | `rbac.middleware.ts` vs `gym.service.ts` | one resolution path, header-gated |
| Single `userType` enum as the authorisation input | `Account.userType` (H-09) | platform role + data-driven org/gym roles |
| Client-supplied `profileId`/`amount`/`membershipId` | `payments` (C-01) | derive from `req.tenant` and the DB |
| Ownership by a single FK (`Gym.ownerId`) | `Gym` | an `OrganisationMember` row with the `owner` role — transferable, co-ownable |
| Unscoped global models (`Product`, `Order`) | marketplace (F-04) | add `organisationId`/`gymId`, or extract the service |

## Deferred (not now, and why)

- **Postgres RLS.** The strongest guarantee, but it needs a per-request `SET LOCAL app.organisation_id` on a
  session-pinned connection, which fights connection pooling and Prisma's model. Revisit if the service ever runs
  raw SQL from multiple entry points, or if a compliance requirement demands defence in depth at the DB layer.
- **Schema- or database-per-tenant.** Wrong shape for many small tenants (each gym is a small dataset) and it makes
  the public cross-tenant gym directory hard. Only worth it for a large enterprise customer demanding physical
  isolation.
- **Branch-level scoping.** The hierarchy reserves room for it; don't add the column until a chain customer needs it.
