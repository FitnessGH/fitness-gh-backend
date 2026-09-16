# fitness-gh-backend — working instructions

Express 5 + Prisma + valibot REST API for **Fitness GH**: a multi-tenant platform on which gyms are enrolled (or
self-enrol) and then run their day-to-day operations — staff, subscription plans, memberships, check-ins, payments.

**Current state: pre-production, and the multi-tenant guarantees are not yet implemented.** The module layout is
sound; tenant isolation, the response contract, the data model, and the test suite are not. A full review and a
phased remediation plan exist — read them before writing code.

## Read before writing any code

1. **[`docs/codebase-review.md`](docs/codebase-review.md)** — what is broken, by severity, with finding IDs
   (`C-01`…`M-15`, `F-01`…) referenced from commits and tests. Start here.
2. **[`docs/implementation-plan.md`](docs/implementation-plan.md)** — phase order, status, cross-cutting rules,
   and the open decisions (`D-1`…`D-6`) that block work.
3. **[`docs/multi-tenancy/SKILL.md`](docs/multi-tenancy/SKILL.md)** — **the most important document here.** Tenant
   scoping, the scoped Prisma accessor, data-driven roles over a code-owned permission catalogue, 404-not-403.
   Four of the seven Critical findings are tenancy failures. Read it before writing any query.
4. **[`docs/backend-patterns/SKILL.md`](docs/backend-patterns/SKILL.md)** — the architecture law: layered
   class-based modules, constructor DI, SOLID mapping, Prisma patterns, error hierarchy.
5. **[`docs/api-design/SKILL.md`](docs/api-design/SKILL.md)** — the HTTP contract: URLs, status codes, envelopes,
   pagination, filtering, rate-limit tiers.
6. **[`docs/testing/SKILL.md`](docs/testing/SKILL.md)** — the harness and the six-case coverage bar every endpoint
   must meet.
7. **[`docs/database-schema.md`](docs/database-schema.md)** — schema conventions, the tenancy hierarchy, design
   decisions, and what is deliberately *not* modelled.
8. **[`docs/openapi.yaml`](docs/openapi.yaml)** — the target API contract. **Keep it in sync with every endpoint
   change.**
9. **[`docs/Fitness_GH_Requirements_and_MVP.md`](docs/Fitness_GH_Requirements_and_MVP.md)** — requirement IDs
   (`MEM-xx`, `PAY-xx`, …) and the MVP acceptance criteria (`AC-01`…`AC-12`). **Draft — confirm with the product
   owner before treating priorities as settled.**

The four `SKILL.md` files describe the **target** architecture, not what the repo does today. New code follows
them; code you touch gets brought up to them.

## Commands

```bash
pnpm dev             # tsx watch on PORT (default 5001)
pnpm test            # vitest + supertest
pnpm lint            # eslint --fix  ⚠️ CURRENTLY CRASHES — see finding M-10, fix first
pnpm typecheck       # tsc --noEmit (passes clean today)
pnpm build           # prisma generate + tsc + tsc-alias → dist/
pnpm db:migrate      # prisma migrate dev (needs an interactive terminal)
pnpm db:seed         # tsx prisma/seed.ts
pnpm db:studio       # browse data
```

## Non-negotiables

These are the rules that the findings in the review exist because of. Breaking one is a bug, not a style choice.

- **Every query is tenant-scoped.** Use the tenant-bound db handle, never the bare `prisma` client, outside the
  three named unscoped paths (authentication, the public gym directory, platform administration).
- **Scope the child, not just the parent.** `where: { id, gymId }` — authorising `:gymId` and then acting on an
  unscoped `:planId` is finding C-04, and it is the single most repeated mistake in this codebase.
- **Cross-tenant access returns 404, never 403.** A 403 confirms the resource exists.
- **Authorise with `can('plan:write')`** — a permission from the code catalogue. Never a role name, never a rank,
  never an optional role list.
- **Never trust a client-supplied id or amount.** `organisationId` comes from `req.tenant`; `profileId` from
  `req.auth`; money from the database. Use strict schemas so unknown body keys are rejected.
- **Money is `Decimal`, never `Float`**, and serialises to JSON as a string.
- **Every list endpoint is paginated**, with `perPage` capped.
- **Validation is middleware**, before the controller. Controllers contain no `try/catch` — Express 5 forwards
  rejections.
- **Only `error-handler` writes error responses.** Services throw `AppError` subclasses carrying a stable `code`.
- **No stack traces, PII, Prisma text, or SQL in any response.** No secrets, tokens, OTPs, or PII in any log.
- **No bare `console.*`** outside `env.config.ts`. **`env.config.ts` is the only reader of `process.env`.**
- **Add an index in the same migration as the `where` clause that needs it.** Prisma does not auto-index foreign
  keys on Postgres, and the schema currently has zero indexes.
- **No check-then-write.** Use a guarded update inside a transaction and treat zero affected rows as a 409.
- **Never `prisma db push`** — this project has migrations. `prisma migrate reset` destroys data: **stop and ask.**

## Workflow

- **Branch per unit of work** (`fix/…`, `feat/…`, `refactor/…`, `chore/…`), gate, then merge to `main`.
  Conventional commits, referencing finding or requirement IDs (`fix(payments): verify webhook signature (C-01)`).
- **Gate before merging:** `pnpm lint && pnpm typecheck && pnpm test` all green. There is no CI yet — Phase 1
  adds it; until then, run the gate by hand.
- **No `Co-Authored-By` trailers.**
- Push to `origin` only when the user asks.
- Package manager: **pnpm**. Don't remove dependencies the user added without asking.
- Commit a large formatting diff (the first successful `pnpm lint` run) **separately** from behavioural changes.

## Environment notes

- `pnpm lint` crashes on an invalid regex in `eslint.config.mts` (`ignore: ["*.md"]` compiles to `/*.md/`). It has
  therefore never run, which is why formatting is inconsistent across the tree. Fix is finding M-10.
- Default dev port is **5001**; the frontend expects it via `NEXT_PUBLIC_API_URL`.
- `pnpm install` prints an `ERR_PNPM_IGNORED_BUILDS` warning for `@prisma/client`, `prisma`, `bcrypt`, `esbuild` —
  run `pnpm approve-builds` once, and approve only those.
- Tests currently hit whatever `DATABASE_URL` points at. **Do not run the suite against the dev database** — set
  up `.env.test` against a separate database first (Phase 1, item 12).
- Prisma `migrate dev` needs an interactive TTY. In a non-interactive session use the `migrate diff` →
  hand-written `migration.sql` → `migrate deploy` fallback documented in
  [`docs/database-schema.md`](docs/database-schema.md#workflow).
- `vercel.json` is the legacy v2 `builds`/`routes` form pointing at a module that calls `listen()`, while
  `api/index.ts` (the correct serverless entry) is unrouted. Don't build on that shape — Phase 8 fixes it.

## Consumers

[`../fitness-gh-frontend`](../fitness-gh-frontend) — Next.js, calls `/api/v1` **directly from the browser** via
`NEXT_PUBLIC_API_URL` (no BFF proxy, so tokens live client-side; a proxy is proposed in Phase 8).
`lib/api/api-client.ts` unwraps the response envelope in one place, which is what makes the Phase 1 breaking
contract change tractable — audit `lib/api/*.ts` for direct `.success` / `.message` reads before shipping it.

**The service is not in production yet.** Breaking changes and destructive migrations are cheap *now* and expensive
the moment a real gym is onboarded. That is the whole reason Phases 1–3 come before the feature work in Phase 6.
