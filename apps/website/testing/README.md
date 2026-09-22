# MODELS PR gate

`CI: Website E2E` calls the reusable
[`CI: MODELS`](../../../.github/workflows/ci-models.yaml) workflow. Its single
verdict contributes to the existing required `website-e2e` check; no new branch
protection setting is needed.

One change filter selects the entire MODELS gate for pull requests, merge-queue
candidates and pushes to main. It covers Models code/data, imported shared
dependencies, tests and build configuration. Unrelated application, careers,
affiliate and documentation changes skip the MODELS checks. A failed filter or
unexpectedly skipped test job fails the verdict.

For relevant changes, one job with a 15-minute timeout runs:

1. MODELS unit and validation tests, with coverage. The all-published-model grid
   added by [#18450](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18450) is
   collected automatically when that PR merges.
2. The build with Workshop excluded and its existing route-exclusion assertion.
3. The build with Models RUN enabled against the test environment.
4. Offline MODELS browser tests, including desktop and mobile cases.

The browser fixture blocks external traffic; these checks do not buy credits,
upload to production or submit paid generations. Reports are retained for 30 days.

`models-test-scope.ts` partitions unit tests and coverage sources. Models-specific
browser files and individual `@models` cases belong to this gate. General website
jobs use `WEBSITE_TEST_SCOPE=website`, so they do not run those tests again.
Shared authentication/navigation tests retain general website ownership. Both
coverage flags contribute to website coverage, without carrying forward stale
reports. Without a scope setting, local commands still run the complete suite.

```sh
pnpm --filter @comfyorg/website test:models
pnpm --filter @comfyorg/website test:models:browser
```

Build first for the browser command; see [the browser guide](../e2e/README.md).
When adding a Models dependency, update
[`models.yaml`](../../../.github/filters/models.yaml). When moving tests, verify
that Models and website collections have no overlap and together contain every
test from the unfiltered suite. Keep mixed-file Models cases tagged `@models`.

The focused `test:router-validation` command is also added by #18450.
The paid workflows in [#18313](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18313)
remain separate: smoke every six hours, image/audio daily, video weekly. Their
preflight can call `test:router-validation`; it selects the same published pages
as the live sweep. This PR gate does not establish live provider health or turn
the scheduled workflows into a production deployment gate. That dependency must
be wired when the live workflows and their accounts are enabled.
