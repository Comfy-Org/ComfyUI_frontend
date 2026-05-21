# `src/services/registries/`

D18 Phase 1 scaffolding — empty registry modules that the loader will
populate in Phase 2 once side-effect registration is removed from
`@/services/extension-api-service`.

Each module owns one extension kind:

- `nodeExtensionRegistry.ts` — outputs of `defineNode(...)`
- `widgetExtensionRegistry.ts` — outputs of `defineWidget(...)`
- `appExtensionRegistry.ts` — outputs of `defineExtension(...)`

These modules are intentionally minimal in Phase 1. They expose the
`register / getAll / clearForTesting` shape the future loader will call,
and a stub adapter the existing service will switch to in Phase 2.

See `decisions/D18-pure-functions-loader-registration.md` for the full
plan and rationale.
