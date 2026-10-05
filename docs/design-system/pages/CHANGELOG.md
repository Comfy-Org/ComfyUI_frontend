# Changelog

Feature-local composition: `ChangelogContent.vue`, `ChangelogMarkdown.ts`, and
`changelog.astro`.

The English changelog at `/changelog` reads the authoritative
Comfy-Org/docs `main/changelog/index.mdx` source in the browser. It is linked
last in footer Resources; no header navigation is added.

## Design provenance

BaseLayout and the existing legal HeroSection are reused unchanged. The page
uses the Enterprise MSA reading width, padding, type sizes and colors. Each
release places its version/date in a 10rem column beside its notes on desktop,
sticky at 144px within that release. Mobile stacks metadata above notes.
The first note block has no leading margin, aligning it with the version.
The separate version navigation is intentionally omitted.

One outline BrandButton under the page heading reads VIEW DOCS and links to
https://docs.comfy.org/changelog/index. Shared size md provides the confirmed
160x52px,16px-radius,16px-bold reference treatment, without an arrow.
The normal successful source/status timestamp is intentionally omitted.
Loading, outage, saved-note and retry states remain visible when needed.

## Data and freshness

The static Astro route hydrates a Vue island. Each visit revalidates the public
raw source, then rechecks every five minutes with a ten-second fetch timeout.
The last validated raw source is saved in localStorage for up to seven days.
An outage labels saved notes; an empty failure offers retry. Storage is optional.
Unsupported source format fails closed. Mintlify wrappers are parsed as data;
remote MDX is never executed. Markdown uses an allowlisted parse5-to-VNode
renderer, excludes executable/foreign content and accepts HTTPS links only.

Translated footer labels point to the English route. The route is declared
locale-invariant and noindex while notes are client-rendered. No-JavaScript
visitors receive a docs link; initial HTML/Markdown twins do not include notes.
Existing CMS systems and deployment configuration are unchanged.

## Verification

Parser/cache/fetch and Vue component tests cover controlled source updates,
loading, unavailable and saved-cache states, retry, safe rendering, cache writes,
CTA destination and footer ordering. Website route/index coverage tests guard
locale and indexing integration. Local browser checks cover desktop/mobile
layout, deep links, alignment and release sticky containment at boundaries.
