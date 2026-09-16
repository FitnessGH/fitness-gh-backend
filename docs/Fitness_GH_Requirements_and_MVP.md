# Requirements & MVP Approach — Fitness GH

> **Status: DRAFT — derived, not authored by the product owner.** Reconstructed on 8 September 2026 from the
> existing implementation, the schema, and the stated product intent ("a multi-tenant backend service for
> management centres where any gym can be enrolled or self-enrol and manage their day-to-day activities,
> staff/employees, gym memberships/subscriptions"). **Confirm §2, §3 priorities, and §6 before building against
> it.** Requirement IDs are referenced from [`implementation-plan.md`](./implementation-plan.md) and from test
> names, so they should be treated as stable once confirmed.

Priority tags: **MVP** (must ship first) · **V1** (required at launch) · **Post** (future iteration).
Status tags: **Built** · **Partial** · **Missing** · **Broken** (implemented but incorrect — see the finding ID).

---

## 1. Product overview

A multi-tenant SaaS platform on which independent gyms run their day-to-day operations. Gyms are onboarded by the
platform or self-enrol, then manage their own staff, subscription plans, members, check-ins, and payments in
isolation from every other gym.

| Attribute | Detail |
|---|---|
| Organization / Business | An **organisation** (a gym business), owning one or more **gyms** (locations) |
| Market | Ghana — GH₵ pricing, mobile money as a first-class payment channel |
| Platform | REST API (this service) + Next.js web frontend (`../fitness-gh-frontend`) |
| Stack | Node.js 24, Express 5, PostgreSQL, Prisma, valibot |
| Deployment | Vercel Functions |

## 2. Stakeholders and roles

Two orthogonal axes — see [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

**Platform role** (on the account):

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Platform administration: onboard/suspend organisations, cross-organization support (with an explicit `X-Organisation-Id` header) |
| `USER` | Everything else; scope comes from the organisation and per-gym roles |

**Roles are data, not an enum.** Roles are rows an organisation owner can create and edit; **permission keys** are
a fixed, typed catalogue in the code (because the code is what enforces them). Endpoints require a *permission*,
never a role name. Design, caching, and guardrails: [`multi-tenancy/SKILL.md`](./multi-tenancy/SKILL.md).

**Seeded system roles** — immutable, shared by every organisation, and the starting point an owner clones to
customise:

| Role | Scope | Permissions granted |
|---|---|---|
| `owner` | Organisation | Everything, including the org-only powers: `gym:archive`, `payment:refund`, `role:write`, ownership transfer |
| `admin` | Organisation | Everything except `gym:archive` |
| `manager` | Gym | `gym:read/write`, `staff:*`, `plan:*`, `membership:read/write/suspend`, `checkin:*`, `payment:read/collect`, `class:*`, `equipment:*`, `report:read` |
| `receptionist` | Gym | `gym:read`, `plan:read`, `staff:read`, `membership:read/write`, `checkin:read/write`, `payment:read/collect` |
| `trainer` | Gym | `gym:read`, `plan:read`, `membership:read` *(assigned members only)*, `checkin:read`, `class:read/write`, `equipment:read` |
| `staff` | Gym | `gym:read`, `plan:read`, `checkin:read` |

Organisation-scoped roles apply at every gym in the organisation (`OrganisationMember.roleId`); gym-scoped roles
apply at one gym (`Employment.roleId`). A person can hold both.

**There is deliberately no rank ordering.** `trainer` and `receptionist` are incomparable — a trainer runs classes
but must not collect payments; a receptionist takes payments but does not manage classes. Any linear hierarchy
silently grants one the other's rights. Escalation is prevented by set logic instead: **you may only grant a
permission you already hold.**

**Member** is not a role — it is a `Membership` relationship with a gym. The same person can be a member of gym A
and a trainer at gym B.

---

## 3. Functional requirements

### 3.1 Tenancy & platform administration (TEN)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| TEN-01 | Every gym-owned record is isolated to its organisation; cross-organization access returns 404 | MVP | **Broken** — C-04, H-07 |
| TEN-02 | An organisation owns one or more gyms (a chain is one organization) | MVP | **Missing** |
| TEN-03 | `SUPER_ADMIN` can act inside an organisation only by naming it explicitly; no implicit escalation | MVP | **Broken** — H-07 |
| TEN-04 | Platform admin can list, suspend, and reactivate organisations | V1 | Missing |
| TEN-05 | Privileged mutations are recorded in an append-only audit log | V1 | Missing |
| TEN-06 | Branch (sub-location) support within a gym | Post | Missing |

### 3.2 Accounts & authentication (ACC)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| ACC-01 | Register with email + password; email verified by OTP before access | MVP | **Broken** — C-08 |
| ACC-02 | Log in for an access token + rotating refresh token; inactive accounts refused | MVP | Built |
| ACC-03 | Log out (single session) and log out everywhere | MVP | Built |
| ACC-04 | Change password; all sessions revoked | MVP | Built |
| ACC-05 | Role-based authorisation enforced on every endpoint, default-deny | MVP | **Broken** — C-03, C-04, H-07 |
| ACC-06 | Forgotten-password reset by email | MVP | **Missing** |
| ACC-07 | Credential and OTP endpoints rate-limited; OTP attempt-capped | MVP | **Missing** — C-07, C-08 |
| ACC-08 | View and update own profile; body metrics private | MVP | **Broken** — C-03, C-05 |
| ACC-09 | Phone verification by SMS OTP | V1 | Missing (`phoneVerified` exists, unused) |
| ACC-10 | Two-factor authentication for owners and platform admins | Post | Missing |
| ACC-11 | Social/Google sign-in | Post | Missing |

### 3.3 Gym onboarding & self-enrolment (GYM)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| GYM-01 | A gym owner self-enrols: creates an organisation and its first gym with real address details | MVP | **Broken** — H-08 (writes `"TBA"` into required columns) |
| GYM-02 | A gym has a unique, stable, human-readable public slug | MVP | **Broken** — H-08 (slug is suffixed with a millisecond timestamp) |
| GYM-03 | The platform can enrol a gym on its behalf | MVP | Missing |
| GYM-04 | Owner maintains gym profile: contact, location, branding, operating hours | MVP | Partial — untyped `Json` (M-06) |
| GYM-05 | Public gym directory: paginated, searchable, filterable by city/region | MVP | **Partial** — exists, unpaginated, unfilterable (H-06) |
| GYM-06 | Public gym detail page by slug; archived gyms excluded | MVP | **Broken** — M-14 (soft-deleted gyms remain readable) |
| GYM-07 | Onboarding has explicit completion state; an incomplete gym is not publicly listed | V1 | Missing |
| GYM-08 | Archive a gym without destroying its history | V1 | Partial (`isActive`, no `archivedAt`) |
| GYM-09 | Ownership transfer and co-ownership | V1 | **Missing** — blocked by `Gym.ownerId` being a single FK |
| GYM-10 | Geo search ("gyms near me") | Post | Missing (`latitude`/`longitude` stored, unused) |

### 3.4 Staff & employees (STF)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| STF-01 | Add an employee to a gym by email with a role | MVP | Partial — 404s if the person has no account yet |
| STF-02 | List a gym's employees with roles and status | MVP | Built |
| STF-03 | Change an employee's role | MVP | **Broken** — C-04 (cross-gym IDOR) |
| STF-04 | Remove an employee (retain the record with an end date) | MVP | **Broken** — C-04 |
| STF-05 | Permission-based authorisation: a caller may only grant permissions they already hold | MVP | **Broken** — H-07 |
| STF-05a | `trainer` cannot collect payments or enrol members; `receptionist` cannot manage classes | MVP | **Missing** |
| STF-10 | An owner defines **custom roles** for their organisation, by cloning a system role and editing its permissions — no deploy required | MVP | **Missing** |
| STF-11 | System roles are immutable; an organisation cannot lock itself out of `role:write`; a role in use cannot be archived | MVP | **Missing** |
| STF-12 | The admin UI lists permissions as a resource × action matrix with human labels | V1 | **Missing** |
| STF-06 | Invite an unregistered person; the invite is claimed on registration | V1 | Missing |
| STF-07 | The organisation's last `owner` cannot be removed or demoted | V1 | Missing |
| STF-08 | Staff shift rosters | V1 | Missing |
| STF-09 | Staff clock-in/out and worked-hours reporting | Post | Missing |

### 3.5 Subscription plans (PLN)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| PLN-01 | Gym defines plans: name, price, duration, features, optional visit cap | MVP | Built |
| PLN-02 | List a gym's plans, ordered for display | MVP | Built |
| PLN-03 | Edit a plan | MVP | **Broken** — C-04 |
| PLN-04 | Archive a plan without affecting existing members | MVP | **Broken** — C-04; no price snapshot, so edits rewrite history |
| PLN-05 | Prices are exact decimal amounts in GH₵ | MVP | **Broken** — H-01 (`Float`) |
| PLN-06 | Public plan browsing for a gym | MVP | Built |
| PLN-07 | Plan names unique per gym | V1 | Missing |
| PLN-08 | Promotions, discount codes, joining fees | Post | Missing |

### 3.6 Memberships & subscriptions (MEM)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| MEM-01 | A member self-enrols in a gym's plan | MVP | Partial |
| MEM-02 | Staff enrol a member by email | MVP | Partial |
| MEM-03 | Membership lifecycle: `PENDING → ACTIVE → EXPIRED`, cancellable, suspendable | MVP | **Broken** — no transition validation; any status settable from the body |
| MEM-04 | A membership activates only on completed payment | MVP | **Broken** — C-01 (free activation) |
| MEM-05 | End date computed from the plan's duration | MVP | Built |
| MEM-06 | List a gym's members, filterable by status, paginated | MVP | **Partial** — unpaginated, unfilterable (H-06) |
| MEM-07 | A member views their memberships across all gyms | MVP | Partial — unpaginated |
| MEM-08 | **A member can renew after expiry, and history is retained** | MVP | **Broken** — H-04 (unique constraint makes renewal impossible) |
| MEM-09 | One live membership per member per gym | MVP | **Broken** — H-04 (app and DB rules disagree) |
| MEM-10 | Expired memberships transition automatically past their end date | V1 | **Missing** — F-03 |
| MEM-11 | Auto-renewal charges and extends without manual action | V1 | **Missing** — `autoRenew` stored and ignored |
| MEM-12 | Expiry reminders to the member at T-7 and T-1 days | V1 | Missing |
| MEM-13 | Upgrade/downgrade mid-term with pro-rating | Post | Missing |
| MEM-14 | Family and corporate group memberships | Post | Missing |
| MEM-15 | Freeze/hold a membership with the end date extended | Post | Missing |

### 3.7 Check-in & attendance (CHK)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| CHK-01 | Record a member check-in at a gym; membership validity enforced | MVP | **Missing** — F-02 (`recordVisit()` exists but no route reaches it) |
| CHK-02 | Visit-capped plans refuse a check-in past the cap | MVP | Partial — logic exists, unreachable, and races |
| CHK-03 | Check-in history per member and per gym, date-filterable | MVP | **Missing** — no `CheckIn` table |
| CHK-04 | "Who is in the gym now" count | V1 | Missing |
| CHK-05 | QR-code / member-card check-in | V1 | Missing |
| CHK-06 | Check-out to measure visit duration | V1 | Missing |
| CHK-07 | Peak-hours and utilisation reporting | Post | Missing |

### 3.8 Payments & billing (PAY)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| PAY-01 | A member pays for a plan by mobile money or card | MVP | Partial — simulator only |
| PAY-02 | **The amount is derived server-side from the plan, never from the client** | MVP | **Broken** — C-01 |
| PAY-03 | Provider webhooks are signature-verified and idempotent | MVP | **Broken** — C-01 (unauthenticated) |
| PAY-04 | A completed payment activates exactly the membership it paid for | MVP | **Broken** — C-01 |
| PAY-05 | A member views their payment history | MVP | Partial — unpaginated |
| PAY-06 | A gym views its payments, date-filterable | MVP | **Partial** — unpaginated, unscoped ownership check |
| PAY-07 | Amounts are exact decimals in GH₵ | MVP | **Broken** — H-01 |
| PAY-08 | Real provider integration (Paystack) replaces the simulator | V1 | Missing — **D-1** |
| PAY-09 | Invoices/receipts issued and emailed | V1 | Missing |
| PAY-10 | Refunds | V1 | Missing (`REFUNDED` unreachable) |
| PAY-11 | Gym revenue reporting: monthly, by plan | V1 | Missing |
| PAY-12 | Payouts from the platform to gyms | V1 | Missing — **D-1**, blocked on a business decision |
| PAY-13 | Platform SaaS billing (gyms pay the platform) | V1 | Missing — **D-4** |
| PAY-14 | Cash/manual payment recording by reception | V1 | Missing |

### 3.9 Classes & training (CLS)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| CLS-01 | Gym schedules classes with a trainer, time, and capacity | V1 | Missing |
| CLS-02 | A member books a class; capacity enforced atomically | V1 | Missing |
| CLS-03 | Cancellation and waitlist promotion | V1 | Missing |
| CLS-04 | Trainer assigned to specific members for PT | V1 | Missing |
| CLS-05 | Programmes and progress tracking against profile metrics | Post | Missing |
| CLS-06 | Recurring class templates | Post | Missing |

### 3.10 Reporting (RPT)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| RPT-01 | Gym dashboard: active members, expiring soon, revenue this month, check-ins today | MVP | **Missing** — no endpoint returns any KPI |
| RPT-02 | Member growth and churn over time | V1 | Missing |
| RPT-03 | Platform dashboard across organisations | V1 | Missing |
| RPT-04 | CSV export of members and payments | V1 | Missing |
| RPT-05 | Equipment register with maintenance schedule | V1 | Missing |

### 3.11 Marketplace (MKT)

**Scope decision required — D-2 in the plan.** Currently a global multi-vendor store with no tenancy model
(F-04). Requirements below assume path A (per-gym storefronts).

| ID | Requirement | Priority | Status |
|---|---|---|---|
| MKT-01 | Products belong to a gym; a vendor is a gym employment, not an account type | V1 | **Broken** — no tenancy |
| MKT-02 | Vendor manages own products and stock | V1 | Built (ownership correctly enforced) |
| MKT-03 | Customer places an order; stock never oversells | V1 | **Broken** — H-03 (race) |
| MKT-04 | Order paid through the payments module | V1 | Missing |
| MKT-05 | Order status lifecycle with fulfilment | V1 | Partial — no validation |
| MKT-06 | Product reviews driving rating and review count | Post | **Broken** — fields stored, permanently 0 |
| MKT-07 | Multi-vendor cart split into per-vendor orders | Post | Missing |

### 3.12 Platform & non-functional (NFR)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| NFR-01 | Secrets required at boot; the service refuses to start misconfigured | MVP | **Broken** — C-02 |
| NFR-02 | No stack traces, PII, or internals in any response | MVP | **Broken** — C-06 |
| NFR-03 | No secrets, tokens, OTPs, or PII in logs | MVP | **Broken** — C-08, M-07 |
| NFR-04 | Structured logging with a request id correlatable to a client error | MVP | **Missing** — M-07 |
| NFR-05 | All list endpoints paginated and capped | MVP | **Missing** — H-06 |
| NFR-06 | Consistent response envelope with machine-readable error codes | MVP | **Broken** — M-04 |
| NFR-07 | Rate limiting per tier | MVP | **Missing** — C-07 |
| NFR-08 | `lint`, `typecheck`, and tests gate every merge | MVP | **Missing** — M-10, M-11 |
| NFR-09 | Cross-organization isolation covered by tests for every scoped endpoint | MVP | **Missing** |
| NFR-10 | Graceful shutdown; in-flight requests drained on deploy | V1 | **Missing** — M-09 |
| NFR-11 | OpenAPI spec published and kept in sync | V1 | Missing |
| NFR-12 | Uploads type-verified, quota'd, and scoped by purpose | V1 | **Broken** — M-15 |
| NFR-13 | Error tracking and latency/error-rate alerting | V1 | Missing |
| NFR-14 | Documented deploy, rollback, and migration runbook | V1 | Missing |

---

## 4. Requirement status summary

| | MVP | V1 | Post |
|---|---|---|---|
| **Built** | 8 | 1 | 0 |
| **Partial** | 11 | 0 | 0 |
| **Broken** | 22 | 2 | 1 |
| **Missing** | 12 | 30 | 17 |

The distribution is the whole story: the MVP surface is *mostly implemented and mostly incorrect*. That is why
[`implementation-plan.md`](./implementation-plan.md) fixes and hardens before it extends — the Missing V1 column
cannot be built safely on a Broken MVP.

## 5. Acceptance criteria (MVP)

The gate for "the MVP is done". One `describe` block per criterion in `test/acceptance/`, named by ID —
see [`testing/SKILL.md`](./testing/SKILL.md).

| ID | Criterion | Covers |
|---|---|---|
| AC-01 | A gym owner self-enrols, verifies email, and gets an organisation with one complete gym record — no placeholder data | GYM-01, GYM-02, ACC-01 |
| AC-02 | The owner adds a manager, a receptionist, and a trainer; each can do exactly their permissions and no more — in particular the **trainer cannot collect a payment or enrol a member**, and the **receptionist cannot manage a class** | STF-01, STF-05, STF-05a, ACC-05 |
| AC-02a | The owner clones `trainer` into a custom role, adds `payment:collect`, reassigns a trainer to it, and that trainer can now take a payment — **with no code change**. A manager attempting to mint a role with `payment:refund` is refused | STF-10, STF-11 |
| AC-03 | The owner creates a GH₵250/month plan; the price round-trips exactly through create → read → payment | PLN-01, PLN-05, PAY-07 |
| AC-04 | A member self-enrols, pays, and the membership becomes `ACTIVE` — and **cannot** become active without a verified completed payment of the plan's price | MEM-01, MEM-04, PAY-02, PAY-04 |
| AC-05 | Reception checks the member in; a visit-capped plan refuses the check-in past its cap | CHK-01, CHK-02 |
| AC-06 | The membership expires past its end date and the member can renew, with both rows retained in history | MEM-08, MEM-10 |
| AC-07 | **Gym B's owner receives 404 for every one of gym A's resources — read and write, parent and child ids** | TEN-01, TEN-03 |
| AC-08 | The gym dashboard reports active members, expiring-soon, revenue this month, and check-ins today, matching a known seeded state | RPT-01 |
| AC-09 | A tampered payment amount, an unsigned webhook, and a replayed webhook are all rejected | PAY-02, PAY-03 |
| AC-10 | No response contains a stack trace, a `passwordHash`, an OTP, another member's body metrics, or another organization's data | NFR-02, C-05, C-06 |
| AC-11 | Every list endpoint is paginated with correct `meta`, and `perPage` is capped | NFR-05 |
| AC-12 | `pnpm lint && pnpm typecheck && pnpm test` pass in CI, and the production build boots | NFR-08 |

**AC-07 and AC-09 are the two that matter most.** They are the criteria the current codebase fails hardest, and
they are what makes the platform safe to sell to a second gym.

## 6. Open questions for the product owner

Answers change what gets built — see the decision table in
[`implementation-plan.md`](./implementation-plan.md#open-decisions-needed-from-the-product-owner).

1. **D-3** — Is the business an organisation (supporting chains) or a single gym? *Assumed: organisation.*
2. **D-1** — Which payment provider, and does the platform collect funds and pay out, or do gyms collect directly
   with their own credentials?
3. **D-4** — Does the platform charge gyms a SaaS subscription, separate from gyms charging members?
4. **D-2** — Marketplace: per-gym storefronts, or a separate platform-wide service?
5. **D-5** — When can the breaking envelope change ship alongside `fitness-gh-frontend`?
6. Which V1 items are actually launch blockers? The V1 list here is inferred from the schema's unused fields and is
   almost certainly wider than the real commercial requirement.
7. Is there a real customer or pilot gym driving priority? That would reorder Phase 6 immediately.
