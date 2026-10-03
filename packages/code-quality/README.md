# @comfyorg/code-quality

![Package checks](https://github.com/Comfy-Org/ComfyUI_frontend/actions/workflows/ci-code-quality.yaml/badge.svg)

One version for Comfy's code-quality engines and reusable policy. Install as a
**dev dependency** with npm or pnpm; Node 22.13+ (22.x) or 24+ is required.

```sh
npm install --save-dev --save-exact @comfyorg/code-quality@next
npx comfy-code-quality lint
npx comfy-code-quality format --check
npx comfy-code-quality audit --base origin/main --json > fallow-results.json
```

The package pins ESLint, Oxlint, the matching overlap adapter, TypeScript/parser,
Vue/import/test plugins, Oxfmt, Prettier, and Fallow. Prettier stays on Platform's existing 3.5.3 to avoid an unrelated formatting migration. It does not run app builds,
typechecks, or tests. Framework-specific ESLint plugins remain local.

## Consumer configuration

Create `code-quality.config.json` with native arguments and local scopes:

```json
{
  "lint": {
    "oxlint": ["src", "--type-aware"],
    "eslint": ["src", "--cache"]
  },
  "format": { "engine": "oxfmt", "args": ["src", "scripts"] },
  "audit": ["--quiet"]
}
```

Omit `lint.oxlint` to use ESLint alone. Keep all ESLint rules enabled in that mode.
In hybrid mode, apply the exported `oxlint` overlap adapter only to the files
actually checked by Oxlint. In particular, Astro and Vue template policy must
remain covered by ESLint. The wrapper does not silently disable any rules.

`lint` runs Oxlint first and stops on failure, then runs ESLint. `--fix` applies
to both. Additional lint/format paths append to configured arguments; they do
not narrow an existing scope. `format` writes; `format --check` only checks.
`audit --base` compares tracked working-tree changes against an explicit commit,
uses a zero-context diff to filter added lines, and removes its temporary diff.
Commit or stage new files before auditing. It never refreshes baselines.

`-c/--config` selects the wrapper JSON file. `-h/--help` and `-V/--version` work
without a config. `-b` aliases audit's `--base`. Native tool output passes through,
including JSON audit output on stdout. Native failure statuses pass through;
usage/config/spawn errors go to stderr with exit 2. No package-specific environment
variables are required; engines retain their documented environment behavior.

For existing scripts and baseline administration, `comfy-code-quality exec <tool>
[args...]` runs the pinned `eslint`, `oxlint`, `oxfmt`, `prettier`, or `fallow`
with native arguments and no wrapper config. For example,
`comfy-code-quality exec fallow dead-code --save-baseline .fallow-baselines/dead-code.json`.
This explicit native command can write a baseline; `audit` never does.

## Presets and adapters

- `@comfyorg/code-quality/eslint`: rule-only `imports(namespace)`, `vueTemplates`,
  `asyncSafety`, `browserTests`, and `unitTests`; plus pinned plugins/parsers.
  Spread a policy into a locally scoped flat-config object. `imports('import')`
  composes with Nuxt's existing import plugin; the default is `import-x`.
  Typed async rules need the consumer's TypeScript project/parser options.
- `@comfyorg/code-quality/plugin`: portable `no-js-private-class-members` rule.
- `@comfyorg/code-quality/oxlint.json`: native type-import policy. Extend it from
  local `.oxlintrc.json`; keep local suppressions and application restrictions.
- Fallow: set `"extends": "npm:@comfyorg/code-quality/dist/presets/fallow.json"` in
  `.fallowrc.json`. The preset sets new-only gating, three-copy duplication, and
  production dev-dependency checks. Entry points, overrides and baselines stay local.
- `@comfyorg/code-quality/format`: named `frontend` (Oxfmt) and `platform`
  (Prettier) profiles. For example, in `prettier.config.mjs`:
  `export { platform as default } from '@comfyorg/code-quality/format'`.
  Oxfmt also supports an `oxfmt.config.ts` exporting `frontend`; spread it to add
  local `ignorePatterns`. Ignore files stay in the consumer.

Nuxt consumers keep `withNuxt` and its generated configuration. Import shared
rule objects into that composition; do not register another copy of plugins
already supplied by Nuxt. ESLint editor integrations may still require a direct
ESLint dependency aligned with this package; the command always uses our engine.

## Verification and releases

```sh
pnpm -C packages/code-quality check
pnpm -C packages/code-quality test:coverage
pnpm -C packages/code-quality smoke:pack npm
pnpm -C packages/code-quality smoke:pack pnpm
open packages/code-quality/coverage/index.html
```

Unit tests cover config/usage failures. Packed-consumer tests run the installed
binary through PATH, valid/invalid Vue and TypeScript, async/test guardrails,
hybrid mode, formatter check/write/idempotence, and Fallow new/inherited findings.
Help has a five-second startup budget. Coverage reports include text, HTML and
LCOV; subprocess engine behavior is verified by smoke tests, not coverage totals.

Release through the existing version-bump/Release-PR workflow after CI support
lands. Alpha versions go to `next`. Rule or engine changes that reject previously
passing code require an explicitly documented breaking release, including during
alpha. Consumers commit exact manifest and lockfile updates together; roll back
by reverting that update and reinstalling the lockfile. A successful tarball test
is not proof of registry publication or Platform adoption.

Last measured: 2026-10-02 23:48 PDT. Fourteen tests pass; in-process coverage is
39.13% lines. Subprocess CLI paths and the native engines are exercised by the
installed-command smoke tests and are not included in that coverage total.
