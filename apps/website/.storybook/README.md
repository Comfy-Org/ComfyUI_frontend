# Marketing website Storybook

Run `pnpm --filter @comfyorg/website storybook` on port 6008. The root
`pnpm storybook` and `pnpm build-storybook` still use the application catalog.

Build with `pnpm --filter @comfyorg/website build-storybook`; output is
`apps/website/dist/storybook`. Run `typecheck:storybook` and `test:storybook`
through the same package filter. The browser suite uses one worker and verifies
selected catalog contracts in Chromium and WebKit at desktop and mobile widths.
Color contrast remains a palette review; structural WCAG checks are enforced.

The catalog uses current-main production components and fonts. No production
routes, button variants, font metric overrides, or Safari fallbacks are added.
CTA/arrow guidance is documented through existing variants. Proposed missing
Hub components remain explicitly unimplemented and unapproved.

`CI: Marketing Storybook Preview` publishes only PR previews under a distinct
Cloudflare Pages branch, with the source SHA at `/build-info.json`. It requires
the repository's existing Cloudflare credentials. The existing application
Storybook and website preview workflows keep their commands and destinations.

The generated metadata describes catalog coverage and source status; rendering
and reuse decisions still require reviewing the actual story and shipped API.
Hosted MCP OAuth deployment from #15918 is outside this focused integration.
