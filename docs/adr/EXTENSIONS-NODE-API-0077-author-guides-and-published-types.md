# ADR-EXTENSIONS-NODE-API-0077: Author guides and published types for the V4 node API

Date: 2026-11-16

## Status

Proposed

## Context

ADRs 0070 to 0076 define the V4 node API. A pack author needs to know how to
import and type it, how its parts are used, and how a V2 pack converts. The
repository already publishes its types as `@comfyorg/comfyui-frontend-types`
(`pnpm build:types`), and `src/types/index.ts` exports the V4 contract as the
`v4` namespace and types `window.comfy_v4`. The CI job
`ci-types-consumer` builds that bundle and compiles a consumer against it
(`tools/types-consumer-check`).

## Decision

1. The guides live in `docs/extensions/node-api-v4/`, beside the other
   extension documentation, and the extensions index links them. They are
   short: getting started, handles and documents, reading and editing,
   widgets, definitions and hooks, events and the queue, frontend execution,
   utilities, and the V2-to-V4 conversion table.
   Getting started shows the feature detection of ADR-EXTENSIONS-NODE-API-0070
   decision 7 (`window.comfy_v4`, then `import()`) for a pack that must also
   run on an editor without V4, and points a pack that defines or extends
   node types to `comfy.registerPack(import.meta)`.
2. The contract is not generated into a separate file. The published bundle
   is the contract a pack installs; a second copy in `docs/` would drift from
   it.
3. A pack types the module import with a one-line declaration file mapped to
   `/comfy/api/v4.js` through `paths` in its `tsconfig.json`. TypeScript
   refuses an ambient module declaration for an absolute path ("cannot specify
   relative module name"), so the published bundle cannot declare the module
   itself.
4. `check:types-consumer` compiles every `ts` block of the guides against the
   built bundle, with the declaration file of decision 3 taken from the guide
   that shows it. An example that no longer matches the contract fails the
   job, so the guides cannot drift from the types.
5. The conversion table has one row per V2 member or pattern a stored pack
   uses, and each zero-use member that was cut, with counts from the member
   census. The guest-SDK services (`comfy.files`, `clipboard`, `media`,
   `crypto`, `element`, `backend.ownFetch`) are listed with the browser APIs
   a converted pack uses, since they are not API members.

## Alternatives considered

- A hand-written `comfy-api.d.ts` in `docs/`, as the earlier attempt had. It
  duplicates the contract and carried host tags and census notes into the
  file authors read (review finding A-12).
- Declaring `/comfy/api/v4.js` in the published bundle. Not possible, per
  decision 3.
- Checking the examples with a separate script. The consumer check already
  builds and compiles against the published bundle in CI; adding the examples
  there costs one more set of files in the same program.

## Consequences

- The `ci-types-consumer` job runs only when a file outside `docs/` and
  `**/*.md` changes (`.github/actions/changes-filter`). A change to the guides
  alone does not run it; the examples are checked by the next pull request
  that does, or locally with `pnpm build:types && pnpm check:types-consumer`.
- Browser tests for the renderer-dependent members (review finding A-23) are
  not part of this change: they need a running backend.
