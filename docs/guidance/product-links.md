---
globs:
  - '**/*.ts'
  - '**/*.vue'
---

# Links to comfy.org from a product

This is the one copy of the UTM convention for every Comfy product repository
(ComfyUI_frontend, Comfy-Desktop, platform, comfy-website). The other
repositories link here instead of copying it:
https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/guidance/product-links.md

## The rule

Every link a person can click in a product that leads to a comfy.org site
carries three UTM parameters:

| Parameter      | Value                                                   | Examples                                                              |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `utm_source`   | The product the link sits in, from the fixed list below | `comfy_desktop`, `comfy_cloud`, `comfy_platform`                      |
| `utm_medium`   | Always `product`                                        | One check catches every internal link: `utm_medium = 'product'`       |
| `utm_campaign` | Where in the product the link is, in snake_case         | `upgrade_button`, `template_browser`, `release_notes`, `error_dialog` |

### `utm_source` values

Use only these. Adding one is a change to this file first.

| Value            | Product                                              |
| ---------------- | ---------------------------------------------------- |
| `comfy_desktop`  | Comfy Desktop, including ComfyUI running inside it   |
| `comfyui_local`  | ComfyUI run locally from source or pip, in a browser |
| `comfy_cloud`    | Comfy Cloud (cloud.comfy.org)                        |
| `comfy_docs`     | docs.comfy.org                                       |
| `comfy_hub`      | comfy.org/hub                                        |
| `comfy_org`      | the rest of www.comfy.org                            |
| `comfy_blog`     | blog.comfy.org                                       |
| `comfy_platform` | platform.comfy.org                                   |
| `comfy_registry` | registry.comfy.org                                   |

ComfyUI_frontend ships in three products, so its source is chosen at run
time: `comfy_cloud` in the cloud build, `comfy_desktop` in the desktop build,
`comfyui_local` otherwise.

### `utm_campaign`

- snake_case: lower-case letters, digits and single underscores.
- Name the place, not the destination or the date: `pricing_table`,
  `help_center`, `sign_in_terms`, not `docs_link` or `nov_2026`.
- Reuse a campaign already used for the same place in that repository.

## Which links

Tag a link when all of these hold:

- A person clicks or opens it: an `href`, `window.open`, `shell.openExternal`,
  a URL shown for them to follow.
- It goes to a comfy.org host: `comfy.org`, `www.comfy.org`, `docs.comfy.org`,
  `blog.comfy.org`, `registry.comfy.org`, and `cloud.comfy.org` or
  `platform.comfy.org` when the link leaves a different product for them.
- It leaves the product it sits in. A link within the same site (the website
  linking to its own pages, Cloud linking to its own routes) carries no UTMs:
  they would reset the visitor's session attribution.

Never tag:

- API calls, asset and image URLs, CSP entries, OAuth and checkout return
  URLs, URLs loaded in a webview as the app itself.
- `package.json` metadata, READMEs, test fixtures.
- Links that already carry a marketing campaign's UTMs on purpose (a paid or
  launch campaign run by marketing). Those follow marketing's naming.

Other query parameters (`template`, `utm_id`, `utm_content`) are kept; the
three parameters above are set by the helper and win over any existing value.

## How each repository does it

Each product repository has a `productLink(url, campaign)` helper that adds
the three parameters, and a lint rule that fails on a literal comfy.org link
URL that is not the first argument of `productLink`. Write links as:

```ts
productLink('https://docs.comfy.org/get_started/cloud', 'subscription_panel')
```

so the destination stays readable and searchable.

| Repository       | Helper                                             | Lint rule                                                            |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| ComfyUI_frontend | `src/platform/links/productLink.ts`                | `product-links/require-utm` (`tools/eslint-plugins/productLinks.ts`) |
| Comfy-Desktop    | `src/shared/productLink.ts`                        | `desktop/product-link-utm` (`scripts/eslint/product-link-utm.ts`)    |
| platform         | `utils/productLink.ts`                             | `product-links/require-utm` (`eslint-rules/productLinks.js`)         |
| comfy-website    | not enforced yet; same-site links never carry UTMs | none                                                                 |

The lint rule checks the hosts that are only ever link destinations
(`comfy.org`, `www.comfy.org`, `docs.comfy.org`, `blog.comfy.org`,
`registry.comfy.org`). `cloud.comfy.org` and `platform.comfy.org` are also API
origins, so the rule leaves them alone: wrap a cross-product link to them in
`productLink` by hand.

When a link is built from a base URL (a docs path helper, a locale prefix),
the helper that builds it takes the campaign and calls `productLink` once at
the end.
