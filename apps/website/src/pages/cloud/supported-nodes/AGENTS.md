# Cloud Nodes Pages

Build-time catalog of custom-node packs preinstalled on Comfy Cloud. Index at `/cloud/supported-nodes`, per-pack details at `/cloud/supported-nodes/[pack]`, both also under `/zh-CN/`.

## Sources

- **Cloud `/api/object_info`** — authoritative list of nodes available on Comfy Cloud (auth: `WEBSITE_CLOUD_API_KEY`)
- **ComfyUI Custom Node Registry** ([dashboard](https://registry.comfy.org), API at `https://api.comfy.org/nodes`) — public pack metadata (banner, icon, description, downloads, stars, license, version, repo, publisher)

The registry is the same one the in-app Manager dialog reads from. For reference and additional reading, see the existing client wrappers in `src/`:

- [`src/services/comfyRegistryService.ts`](../../../../../../src/services/comfyRegistryService.ts) — typed wrappers around `/nodes`, `/nodes/search`, `/nodes/{id}`, `/nodes/{id}/versions/{version}/comfy-nodes`, etc.
- [`src/stores/comfyRegistryStore.ts`](../../../../../../src/stores/comfyRegistryStore.ts) — cached store + `getPacksByIds` batch helper
- [`packages/registry-types/src/comfyRegistryTypes.ts`](../../../../../../packages/registry-types/src/comfyRegistryTypes.ts) — generated OpenAPI types
- Public docs: <https://docs.comfy.org/registry>

## Build pipeline

| File                                                                                                                    | Role                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`pages/cloud/supported-nodes.astro`](./supported-nodes.astro) and [`[pack].astro`](./supported-nodes/%5Bpack%5D.astro) | Page shells (and `zh-CN` twins)                                         |
| [`utils/cloudNodes.build.ts`](../../../utils/cloudNodes.build.ts)                                                       | `loadPacksForBuild()` shared by index + detail routes                   |
| [`utils/cloudNodes.ts`](../../../utils/cloudNodes.ts)                                                                   | Cloud `object_info` fetcher with retry, sanitization, snapshot fallback |
| [`utils/cloudNodes.registry.ts`](../../../utils/cloudNodes.registry.ts)                                                 | Registry enrichment (batches of 50, soft-fail)                          |
| [`utils/cloudNodes.ci.ts`](../../../utils/cloudNodes.ci.ts)                                                             | GitHub Actions annotations + step summary                               |
| [`utils/escapeJsonLd.ts`](../../../utils/escapeJsonLd.ts)                                                               | XSS-safe `<script type="application/ld+json">` serializer               |
| [`composables/useFilteredPacks.ts`](../../../composables/useFilteredPacks.ts)                                           | Search + sort logic for the index page                                  |
| [`composables/useNodesByCategory.ts`](../../../composables/useNodesByCategory.ts)                                       | Group nodes by category, alphabetized                                   |
| [`scripts/refresh-cloud-nodes-snapshot.ts`](../../../../scripts/refresh-cloud-nodes-snapshot.ts)                        | Manual `pnpm cloud-nodes:refresh-snapshot`                              |
| [`packages/object-info-parser`](../../../../../../packages/object-info-parser)                                          | Shared Zod schemas, classifier, `sanitizeUserContent`                   |

## Key invariants

- **Sanitization is mandatory.** The cloud `/api/object_info` endpoint mixes the calling user's uploaded files into combo input lists; `sanitizeUserContent()` strips them before the snapshot is written. Tests in [`packages/object-info-parser/src/__tests__/sanitizeUserContent.test.ts`](../../../../../../packages/object-info-parser/src/__tests__/sanitizeUserContent.test.ts).
- **All remote data is Zod-validated.** `cloudNodes.schema.ts` validates the cloud envelope; `@comfyorg/object-info-parser` validates each node def; `cloudNodes.registry.ts` validates the registry response shape with a passthrough Zod schema (defense-in-depth on top of the generated OpenAPI types). The fetcher never trusts a network response.
- **JSON-LD must be escaped.** Pack metadata is registry-controlled; route every `<script type="application/ld+json">` payload through `escapeJsonLd()`.
- **Index and detail share one fetch.** Both call `loadPacksForBuild()` so the static routes can never diverge from the rendered list.
- **No `PUBLIC_` prefix on env vars.** Astro inlines `PUBLIC_*` into the client bundle; build-time secrets never start with that prefix.

## Why `Pack` is a domain projection, not the raw registry `Node`

`apps/website/src/data/cloudNodes.ts` defines its own `Pack` and `PackNode` types instead of re-exporting `components['schemas']['Node']` from `@comfyorg/registry-types`. That is intentional:

- A `Pack` joins **two upstream sources** — the cloud `object_info` shape (which has `python_module`, `category`, `display_name`, etc.) and the registry `Node` shape (which has `banner_url`, `downloads`, `github_stars`, etc.). Neither shape on its own captures both.
- A `Pack` is **post-sanitization**. Combo input lists, user-uploaded filenames, and any other build-time-stripped data are guaranteed gone by the time the type appears. The raw `Node` carries fields we never expose.
- A `Pack` adds **safe-URL invariants** (banner / icon / repo all flow through `safeExternalUrl()` before becoming part of the type), which the registry's optional `string` fields don't encode.

The `Pack`/`PackNode` types live next to the snapshot they describe; the validated build-time projections feed Astro's static routes directly. The OpenAPI-generated `Node` type is still consumed inside `cloudNodes.registry.ts` as `RegistryPack` for the upstream fetch.
