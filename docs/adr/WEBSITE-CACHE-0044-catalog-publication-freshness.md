# ADR-WEBSITE-CACHE-0044: Catalog publication freshness

Date: 2026-10-16

## Status

Proposed

## Context

CCC publication and forward Revert select a new Live revision without rebuilding
Astro. An origin cache keyed by revision is insufficient if a CDN or retained
browser view answers without checking that authority. Asynchronous soft purges
and positive TTLs permit stale pages after a successful publication.

## Decision

Mutable CMS responses must reach current Live authority. In the non-production
adapter, explicitly bypass browser and provider response caches across the
entire middleware chain, including errors and redirects. Retain revision-keyed
application artifacts and immutable asset caching, but not TTL-only selection
of a mutable URL. Production behavior remains off until explicit cutover.

Retained list/detail views revalidate bounded data on navigation, focus and
browser restoration. Hide stale actionable content while revalidating and on
failure; offer retry. Preserve query/scroll and cancel superseded requests.
Do not replace active paid runs or trigger execution. This is event-based
revalidation, not live push into a continuously visible idle tab.

## Consequences

Each new mutable request incurs a fresh authority check, but can reuse compact
projection data/prepared bytes. It need not load the catalog or regenerate Astro.
CDN purge becomes idempotent cleanup, not the publication correctness mechanism.
Stale-while-revalidate and stale-on-error are rejected for mutable CMS data.

Cloudflare Worker forced sitemap/manifest TTLs require a separate opt-in bypass
at cutover. Old entries need scoped provider purging when activating the new
deployment. Sitemap/LLM composition must retain non-CMS pages. Actual-hostname
warm-cache publication/Revert and conditional-response tests remain required;
local adapter/browser fixtures alone do not certify either provider.
