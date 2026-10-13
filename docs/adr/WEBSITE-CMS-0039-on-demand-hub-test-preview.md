# ADR-WEBSITE-CMS-0039: On-demand Hub CMS test preview

Date: 2026-10-06

## Status

Proposed

## Context

Canonical design: [Comfy Hub CMS TDD](https://app.notion.com/p/3f06d73d365081cf9225d3c34f262b63).
Pair this frontend branch (`feat/website-cms-test-preview`) with Cloud's
`feat/hub-cms-test-preview`. This is a checkpoint; strict adjacent revisions,
archived-save semantics and missing media/reliability work remain implementation
gaps against that TDD, not an alternative design.

The Hub CMS TDD calls for one content source across the website and templates.
The first deliverable is a reviewable version of today's Hub reading the new
CMS tables in the existing Cloud ingest backend. The current website uses
static Astro routes and checked-in JSON/JSONL. Production must remain unchanged
while this initial slice is reviewed.

## Decision

Opt in through server-only `SITE_CATALOG_API_URL`. Use the Vercel Astro adapter
and mark existing Hub routes and their same-origin JSON read endpoints as
on-demand only in that mode. Preserve current page layouts, input schemas,
slugs, media URLs, authentication and execution transports.

Read the eligible LIVE projection from ingest's additive REST catalog. Parse
the envelope with generated ingest schemas and the JSON payload with the
existing website catalogue/detail schemas. Fail with 503 on unavailable or
invalid CMS data rather than silently substituting source-file content.

Catalog revisions are increasing integers: LIVE N, DRAFT N+1. Each UID resolves
to its latest non-archived entity revision at or below the selected revision.
Publishing creates only the next Draft metadata, not copies of every entity.
Entity UID, record edit token and catalog revision are distinct. Normalize the
generated int64 validators to safe JSON numbers before passing server data to
website components; reject values outside JavaScript's safe integer range.

Do not enable this in production. Review responses are private/no-store and
noindex. Without the opt-in, Astro remains static and reads the existing files.
Only currently published records enter the bootstrap fixture; authored,
disabled and future content must not become public seed data.

Tailscale Serve can expose the local website on the Comfy tailnet before any
commit. Ingest remains local or in an isolated Cloud PR preview. Do not tunnel
local-development ingest authentication to the public internet.

## Consequences

This is a local review implementation, not a production cutover or complete CMS.
CMS mode now adds a server-protected `/admin/` console with one Draft queue
(catalog changes and legacy workflow submissions together), All content, and
publication history with rollback. Publishing approves the included workflow
submissions, then publishes the Draft; catalog changes still publish together
until the backend can exclude single records. Staff session credentials are verified by ingest
on every request; cookies select Draft/Live and an effective visibility clock
but do not grant permissions. Mutation forms enforce Origin/CSRF and use native
navigation so client islands do not retain a previous selection. Draft Preview
shows a slim neutral bar with Draft/Live, a time picker that can jump to
scheduled launches, language, a list of the Draft's changes, and Exit.
Staff enter through a floating button and review in a sidebar/action-area layout.
The admin and preview bar are work tools, so they take the developer platform's
graphite palette and control scale (`--color-admin-*` tokens and the reka-ui
primitives in `components/cms/ui`) rather than the marketing site's ink and yellow. Changes are grouped by the field an editor recognises,
showing before and after values and highlighting added list items, rather than
dumping whole records or JSON paths. The local-only sign-in
page shares the website layout and remains inaccessible to forwarded visitors.
Direct-loopback local review can use an isolated local staff account; that
helper rejects forwarded requests and cannot be used on Vercel.

A shareable design demo exists for review without any backend: a pull request
labelled `cms-demo` builds its Vercel preview with `SITE_CATALOG_DEMO=1`, which
answers the site API from the in-memory mock (`lib/cms/mock-ingest.ts`, the same
one `pnpm dev:cms` serves locally) seeded with the public Hub records. Anyone
with the link can enter through `/admin/local-access`; nothing reaches an
ingest service, the state lives in one function instance and resets, and the
mode is refused when `VERCEL_ENV` is `production`.

Temporary ngrok tester invitations are available only in local dev. The owner
creates/revokes one-use named review/edit/publish invitations on the loopback
`/admin/testers` page; remote testers redeem them at `/admin/sign-in`. Codes and
opaque sessions are hashed in an ignored private sidecar, checked on every
request, and expire within seven days or the parent credential's expiry.
The backend audit still identifies the shared test account; this bridge is not
production staff authentication. Ngrok request inspection is disabled.
Preview keeps its banner in both Draft and Live, so a reviewer can compare the
two on the same page; only Exit clears Preview and the simulated clock. The
banner is shown on site pages only, never inside the admin, and in Draft it
labels the Hub cards and links the draft adds, changes or schedules.

Staff edit one item at a time on `/admin/edit/{uid}`, a form rather than
in-place editing, and save it into the draft through
`PUT /admin/api/site/items/{uid}` (`ContentCatalogSave`). New items start as a
copy of an existing one at `/admin/new`, so every record keeps the fields the
website renders; the server validates each save against the catalogue and page
schemas before sending it, because one unreadable draft item would break the
whole preview. Archiving is the same save with `deleted: true`. The editor
writes three fields the ingest contract does not define yet and needs the
backend to accept: `data.translations['zh-CN']` (name and summary),
`data.formLayout` (each input as basic, advanced or hidden), and `target_id`
on `/admin/api/site/revert`, which restores any earlier LIVE revision instead
of only the previous one.

Hosted account sign-in, complete preview evidence, localization editing, media versioning, backend Hub
migration, runtime sitemap/Markdown/LLM files, publication validation,
cache invalidation and last-known-good fallback still need implementation.
UGC management remains post-MVC. The existing shared-source/execution boundary
in WORKSHOP-CATALOG-0037 remains unchanged for the normal static website.

## Verification

The existing catalogue endpoint tests still cover static mode. Additional
tests parse all 180 imported public records and input definitions through the
CMS boundary, assert upstream failures fail closed, and prohibit production
requests. Run the targeted website typecheck and both static/CMS adapter builds.
