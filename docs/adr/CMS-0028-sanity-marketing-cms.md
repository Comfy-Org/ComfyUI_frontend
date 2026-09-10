# ADR-CMS-0028: Use Sanity for Marketing Content in the Canonical Website

Date: 2026-09-10

## Status

Proposed

## Context

The marketing website already lives in
`Comfy-Org/ComfyUI_frontend/apps/website` and continues to change there. A
private repository copied that application, its workspace configuration, and
its lockfile while adding Payload and an unmerged Sanity implementation. That
fork now needs a bespoke synchronization workflow to replay upstream changes.

The synchronization model is structurally unsafe and expensive to maintain. It
imports code and dependency metadata before installing and building them, has
diverged from its recorded baseline, and duplicates inherited workflows,
schedules, and secret references. It can also create snapshots that omit
workspace packages used by the website. Hardening the synchronization pipeline
would preserve two competing website histories instead of removing the cause.

The existing Sanity implementation cannot be merged as one change. Its sandbox
PR stack mixes the CMS integration with a large upstream refresh, has no
non-author approval, and does not yet satisfy schema parity, security, build,
lint, hreflang, migration, or rollback gates. Useful schema, preview, mapper,
and migration work from that stack is reference material, not accepted code.

The content platform also has material operational and commercial constraints.
As of this ADR's date, Sanity's public pricing lists Growth at $15 per seat per
month, two included datasets, additional datasets at $999 per dataset per
month, 250,000 included uncached API requests with $1 per additional 25,000,
one million included CDN requests with $1 per additional 250,000, 100 GB of
included bandwidth with $0.30 per additional GB, and 100 GB of assets with
$0.50 per additional GB. Pricing must be rechecked before a plan or quota
change. The current source is <https://www.sanity.io/pricing>.

Sanity also introduces product lock-in. GROQ queries, Portable Text rendering,
visual-editing metadata, preview integrations, and Studio plugins are not
portable data contracts. Localization in the reviewed implementation uses
explicit `en`, `zhCN`, and `ja` values with an English fallback rather than
native per-field localization, and the Events schema must be corrected to
include Japanese before migration.

The reviewed work references Sanity project `0z1pln1x` and dataset `sandbox`.
They are non-production inputs to the migration design, not authorization to
reuse them for production. Project administration, billing ownership, token
ownership, production datasets, and usage-alert thresholds remain unresolved
and must be assigned before a production migration or plan change.

## Decision

The canonical marketing website remains
`Comfy-Org/ComfyUI_frontend/apps/website`. We will upstream the Sanity
integration into that application as small, dependency-ordered pull requests.
We will not operate a long-lived website fork or enable the fork's marketing
synchronization workflow.

The private-fork owner selected this direction in FE-2125. Upstream adoption
still requires normal maintainer review; this ADR does not grant merge,
deployment, billing, dataset, or production authority.

The implementation follows these boundaries:

1. Each layer starts from current upstream `main`, has a focused diff, passes
   its own checks, and is approved by a reviewer who is not the author of the
   sandbox stack.
2. A generated, versioned TypeScript/Zod contract defines portable content
   shapes. Studio schemas, website adapters, migration tooling, and parity
   checks consume that contract. GROQ is an adapter detail, not the contract.
3. Published and preview reads use separate server-only clients. Draft access
   requires an authorized preview session. Production rejects sandbox project
   identifiers, unsafe origins, and missing required configuration.
4. Content-family adapters are isolated and testable. When Sanity is selected
   as authoritative, contract or source failure stops the build instead of
   silently serving stale fallback content.
5. The existing Payload service remains protected, frozen for writes at the
   migration boundary, and recoverable through parity validation, rollback
   rehearsal, production cutover, and a 30-day observation period. Payload
   code, data, infrastructure, domains, and secrets are not removed early.
   Editorial writes remain frozen until a Sanity-to-portable-export-to-Payload
   reconciliation rehearsal proves that post-cutover documents and assets can
   survive rollback. During observation, immutable daily Sanity exports retain
   documents, asset binaries, and hashes. A rollback first freezes Sanity
   writes, captures a final complete export, reconciles its documents and
   assets into Payload, and verifies counts and hashes before Payload is
   reopened.
6. Sanity Studio moves to a dedicated repository after its desired schema and
   generated contract are established. That repository owns Studio's React
   runtime, dependency governance, administrators, CI, deployment, and
   operational documentation.
7. The React-removal goal applies to application code and direct production
   dependencies of `apps/website`. It does not ban unrelated transitive
   development dependencies from the monorepo lockfile.
8. Migration is dry-run by default, resumable, idempotent, asset-aware, and
   produces explicit quarantine and reconciliation reports. Content and asset
   exports are retained with counts and hashes before any production import.
9. Payload and Sanity builds from the same commit must produce zero unexplained
   differences across routes, locales, metadata, links, media, redirects, and
   structured data. Editors sign off by content family before cutover.
10. The private fork remains inert during migration. Its target archival date
    is **2027-01-31**, which includes the required 30-day observation window.
    Missing that date requires an explicit ADR amendment; it does not authorize
    re-enabling synchronization or publishers.

The fallback is a standalone website repository, not retention of the current
fork. Fallback requires a reviewed amendment to this ADR and is considered only
if upstream maintainers reject the ADR or the focused Sanity layers. It must
define package ownership, releases, CI, and deployment before code moves.

## Alternatives considered

### Keep and harden the private fork

Rejected. It retains duplicate history, privileged synchronization, inherited
automation, recurring conflicts, and permanent operational ownership. Security
work would reduce symptoms without removing the duplicated source of truth.

### Move the entire website to a standalone repository

Retained as the fallback. It gives strong isolation but moves an actively
maintained upstream application, requires ownership for currently internal
workspace packages, and creates new release and deployment responsibilities.

### Keep Payload outside the frontend repository

Rejected as the target architecture but retained temporarily for rollback.
Payload supports native field localization and avoids Sanity-specific query and
document formats, but it keeps ownership of Postgres, object storage,
migrations, first-admin bootstrap, deployment, and service security.

### Use a Git-backed CMS or Astro content collections

Rejected for the current migration. Decap CMS, Keystatic, Astro content
collections, and MDX reduce hosted-platform lock-in, but replacing the existing
editorial workflow and reviewed Sanity implementation would restart schema,
preview, media, localization, and migration design.

### Operate without a CMS

Rejected. Repository-backed content can remain schema-validated and previewed,
but the team would lose the managed non-developer editing experience and would
own publishing authorization, scheduling, media workflows, and editorial
automation in the repository.

### Select another hosted CMS

Rejected for now. Another SaaS platform could reduce specific Sanity lock-in or
cost concerns, but no alternative has an implementation, migration tooling, or
editor validation comparable to the existing Sanity work.

## Consequences

### Positive

- The website again has one canonical code history, lockfile, CI system, and
  deployment path.
- The privileged synchronization pipeline and its recurring conflict burden
  disappear when the fork is archived.
- Sanity removes self-operated database, migration-runner, first-admin, and
  object-storage access-control responsibilities from the target architecture.
- Small layers allow reviewers to separate schemas, security boundaries,
  adapters, migration, and acceptance behavior.
- The generated contract and export format provide an explicit exit boundary.

### Negative

- Upstream maintainers must review and accept a multi-layer CMS integration.
- Sanity creates recurring seat, usage, and dataset costs that require billing
  ownership and monitoring.
- GROQ, Portable Text, previews, and plugins remain platform-specific even when
  the content contract is portable.
- Localization remains custom code and needs explicit schema and fallback
  tests.
- Payload must be operated safely in parallel until parity, rollback, and the
  observation period complete.
- Studio becomes a separately governed repository with its own administrators,
  dependency policy, CI, and deployment lifecycle.

## Validation and rollout

The implementation order is:

1. Complete the Phase 0 and Phase 1 security and containment gates.
2. Review and accept this ADR.
3. Rebuild the Sanity work from current upstream `main` without upstream-refresh
   noise.
4. Land schema/contract and client/preview layers independently.
5. Land content adapters and make authoritative builds fail closed.
6. Export and restore-test Payload data, then rehearse the idempotent migration.
7. Reach zero unexplained parity differences and obtain editor sign-off.
8. Extract Studio into its governed repository.
9. Rehearse cutover, rollback, and reconciliation of post-cutover Sanity edits,
   then obtain explicit production approval.
10. Cut over, retain immutable daily Sanity exports, observe for 30 days,
    remove Payload, and archive the fork.

Each step keeps failed, skipped, canceled, and unavailable evidence distinct
from passing evidence. Agent review does not substitute for non-author human
approval.

## Notes

- Decision tracking: <https://linear.app/comfyorg/issue/FE-2125>
- ADR requirements: <https://linear.app/comfyorg/issue/FE-2093>
- Layered upstream delivery: <https://linear.app/comfyorg/issue/FE-2121>
- Migration and observation: <https://linear.app/comfyorg/issue/FE-2072>
- Historical sandbox stack: pull requests #10, #11, #12, #13, and #15 in
  `Comfy-Org/comfyui-frontend-sanity-sandbox`
