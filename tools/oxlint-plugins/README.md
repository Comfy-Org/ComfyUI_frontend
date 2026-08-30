# Custom Oxlint rules

## `comfy/no-new-error-throw`

This rule prevents new direct `throw new Error(...)` expressions in first-party
production code while existing expressions are removed incrementally. It
implements the migration direction in
[ADR 0019](../../docs/adr/0019-unified-recoverable-diagnostics.md) and
[FE-1859](https://linear.app/comfyorg/issue/FE-1859/audit-and-replace-unsafe-throw-new-error-paths-with-fail-safe-handling).

The rule covers `src/**/*.{ts,tsx,vue}` and excludes declarations, tests,
specs, stories, test and fixture trees, generated and vendor trees,
`src/extensions/core/**`, `src/scripts/**`, `src/__ecs_matrix__/**`, and files
already ignored as generated code. Browser tests, tools, scripts, apps, and
packages are outside this initial policy.

Only a `ThrowStatement` whose argument is a direct `new Error(...)` using the
unshadowed global `Error` is matched. Rethrows, other thrown values,
`TypeError`, domain-specific error classes, aliases, and shadowed bindings are
not matched.

The checked-in baseline records normalized token fingerprints and
multiplicities per file. Formatting, comments, and line moves do not change a
fingerprint. New or changed fingerprints, increased duplicates, and stale
allowances fail lint. The baseline check also catches allowances left behind
when a file is deleted.

After deleting an existing expression or moving it unchanged, update the
baseline:

```sh
pnpm no-new-error-baseline:update
```

The updater refuses new fingerprints. `pnpm oxlint:main` checks that the
generated baseline is current before linting.

Do not add inline disables or broaden the exclusions. If ADR 0019 requires a
new fail-closed `throw new Error(...)` contract, add one entry to
`noNewErrorThrowExceptions.json` with the file, fingerprint printed by the lint
diagnostic, multiplicity, issue or decision reference, and concise rationale.
The exception must be reviewed as part of the same change.
