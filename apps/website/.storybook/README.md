# Marketing website Storybook

Run `pnpm --filter @comfyorg/website storybook` on port 6008. The root
`pnpm storybook` and `pnpm build-storybook` still use the application catalog.

Build with `pnpm --filter @comfyorg/website build-storybook`; output is
`apps/website/dist/storybook`. Run `typecheck:storybook` and `test:storybook`
through the same package filter. The browser suite uses one worker and verifies
every certified story plus selected interaction and accessibility contracts in
Chromium and WebKit at desktop and mobile widths.
Color contrast remains a palette review; structural WCAG checks are enforced.

The catalog uses current-main production components and fonts. No production
routes, button variants, font metric overrides, or Safari fallbacks are added.
CTA/arrow guidance is documented through existing variants. Proposed missing
Hub components remain explicitly unimplemented and unapproved.

`CI: Marketing Storybook Preview` verifies every PR, including forks, with a
read-only token and uploads the static catalog. `PR: Marketing Storybook Preview`
consumes successful runs from the trusted default branch, checks the current PR
head and stamped artifact SHA, deploys a same-repository Cloudflare Pages preview, and
posts its link. Only that consumer receives the existing Cloudflare credentials
and comment permission. New workflow-run consumers become active after merging
them into the default branch. The source SHA is available at `/build-info.json`. The existing application
Storybook and website preview workflows keep their commands and destinations.

The generated metadata describes catalog coverage and source status; rendering
and reuse decisions still require reviewing the actual story and shipped API.
Hosted MCP OAuth deployment from #15918 is outside this focused integration.

The persistent marketing catalog is built from `main` and deployed to the
`marketing` branch of the existing Pages project. Its expected alias after the
first successful deployment is `https://marketing.comfy-storybook.pages.dev`.
The root application catalog retains its production branch. Only same-repository
PRs receive deployment previews; fork PRs receive verification and artifacts.
`test:storybook` rebuilds before testing, while CI uses `test:storybook:built`
after its explicit build step. The package's format command regenerates metadata.
SiteVideo currently has no production page consumer; its catalog demonstrates the
shared video API without certifying production adoption.

The static deployment serves the JSON catalog and story pages. The addon MCP
endpoint requires the local development server; hosted MCP remains separate.
