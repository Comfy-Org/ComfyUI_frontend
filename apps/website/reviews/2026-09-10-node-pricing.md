# Models node-price estimates

The shared evaluator was extracted from `src/composables/node/useNodePricing.ts`
to `packages/shared-frontend-utils/src/nodePricing.ts`. The graph editor and
node-library badge use that same implementation; Models does not import the
graph, node store, or editor components.

The Models page evaluates actual ComfyUI `price_badge` JSONata declarations at
build time. It preserves declared ranges, approximate markers, and units such
as per-image or per-second. It labels the result as a node-default estimate,
not a Router billing quote. Changing playground inputs does not change this
static estimate. Actual charges still come from the backend.

## Source and refresh

- Source: ComfyUI commit `b08e6cf35fac50d3ca8470dffb3f9a1fbb7187d2`.
- Explicit Router-to-node bindings: `src/data/workshop-node-pricing-bindings.json`.
- Generated rules and dependency defaults: `src/data/workshop-node-pricing.json`.
- Generated data stays one record per line and is excluded from formatting.
- No API key, Torch, Python, or ComfyUI checkout is needed to build the website.
  The optional refresh command needs a ComfyUI checkout with its Python `.venv`:

```sh
pnpm --filter @comfyorg/website generate:workshop-node-pricing /path/to/ComfyUI
```

The exporter calls `GET_NODE_INFO_V1()`; it does not execute a node, scrape
prices with regular expressions, read user uploads, or submit a paid request.
It refuses tracked schema/node edits, unknown model choices, missing badges,
and missing widget defaults. The shared snapshot parser rejects missing
dependencies and duplicate Router bindings.

## Initial coverage and limits

Fourteen exact Router IDs are mapped across FLUX, Seedream, and Grok, supplying
estimates on 20 published model/use-case pages in the verified build. Other
models retain “Cost depends on the model and settings.” In particular, the
ComfyUI Kontext nodes in this source do not declare a price badge; no replacement
rate is invented. Generation-only Grok image rules are not used for edit routes.
Image-edit/animation use cases supply a connected reference-image context, so
FLUX's declared reference-image range is retained.

Follow-ups: extend only verified Router-to-node mappings; refresh the pinned
source when node prices change; use a request-specific Router quote if the
backend later exposes one. Do not restore `workshop-display.json`'s editorial
`pricing.creditsPerRun` as an exact charge or as a missing-data fallback.

## Verification

- 94 editor/shared pricing tests and six website pricing tests pass. Coverage
  includes ranges, units, different settings, invalid rules, exact model/use-case
  matching, missing defaults, and duplicate bindings.
- Website typecheck passes (zero errors/warnings, seven existing hints).
- Full website unit suite: 3,949 tests pass. Root typecheck, changed-file lint,
  and the dependency audit pass.
- Enabled website build succeeds. Playwright confirms the Seedream estimate
  and caveat at desktop and mobile widths, with no horizontal page overflow.
- Disabled preview-environment build: 747 HTML pages, only the existing
  `/models/index.html`, no legacy Workshop routes, and no Models-detail links
  on either the English or Chinese homepage.
- Regeneration is byte-identical: 14 records in 16 lines. SHA-256:
  `5af4cd2d18e6db27d5c4d570359d504b73e5072a281d127c51a5b1e4b8dc58c5`.
- Standalone shared-package typecheck reports existing errors in the unchanged
  `src/piiUtil.test.ts:55–56` (`$set`/`$set_once` missing on the fixture type).
  No pricing-file errors were reported.
