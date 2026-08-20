# Mutation testing

Stryker measures whether the test suite detects behavioral regressions in the load-bearing CRDT code. The initial scope is deliberately limited to `src/applier.ts`, `src/stamps.ts`, and `src/project.ts`; tests and the rest of `src/` are not mutated.

The baseline measured on 2026-08-20 is **63.70% overall** (`applier.ts` 62.91%, `stamps.ts` 65.26%, `project.ts` 65.87%). The configured break threshold is **60%**, a small margin below the baseline so CI detects regressions without rejecting the current suite.

Run mutation testing locally with Node 22 or newer:

```sh
npm ci
npm run build
npm run test:mutation
```

Stryker writes local HTML and JSON reports under `reports/mutation/`; generated reports and `.stryker-tmp/` are ignored. Because mutation testing is substantially slower than the regular suite, `.github/workflows/mutation.yml` runs only nightly and by manual `workflow_dispatch`, not on every pull request.
