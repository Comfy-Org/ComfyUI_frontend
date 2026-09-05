# Purity and portability review

Apply this profile to changes to `src/**`, exports, package metadata, build configuration, and dependencies. It protects KA-3 and FC-3.

- Positively verify that `yjs` is the only declared and resolved production dependency root. `scripts/check-purity.mjs` walks `pnpm list --prod --json --depth Infinity`; a denylist alone is insufficient.
- Reject DOM globals, UI frameworks, LiteGraph, browser-only APIs, server-only APIs, credentials, filesystem, network, and process-specific state in applier, projection, or mint paths.
- Verify the built public entrypoint imports in bare Node without creating globals and remains browser-compatible.
- Treat any second op-to-document implementation, including one in Go, as a blocking FC-3 violation. Browser and Node doc host must consume this package.
- Require `pnpm run build`, `pnpm run check:purity`, `pnpm run check:imports`, and `pnpm test`. `check:purity` reasons about the installed dependency tree and a bare-Node import of `dist/`; `check:imports` covers the same contract at the module-graph level, which is where a per-file DOM or server-only import is visible.
- Read `check:purity`'s exit code, not only its output: `0` pure, `1` violation, `2` preconditions missing (no `dist/`, no `node_modules`). Exit `2` is INCONCLUSIVE — run `pnpm install && pnpm run build` and retry; never record it as a pass.

<!-- Staleness anchors for the exit codes and the gate list this profile restates. -->
<!-- claim: runtime dependency roots exactly {yjs} (declared and resolved production graph) :: scripts/check-purity.mjs -->
<!-- claim: dist/index.js not found — run `pnpm run build` before check:purity :: scripts/check-purity.mjs -->
<!-- claim: "check:imports": "node scripts/check-import-graph.mjs" :: package.json -->
<!-- claim: "check:purity": "node scripts/check-purity.mjs" :: package.json -->

## Machine-consumed copies

This profile's opening line already scopes it to "package metadata, build configuration, and
dependencies", so it owns the two `.coderabbit.yaml` `path_instructions` entries below as well as
the `src/**` half of its own subject. The blocks are the **source** of those entries:
`pnpm run gen:coderabbit` emits the YAML from them and `pnpm run check:coderabbit` fails CI if the two
disagree. Edit the block, never the generated region. See
[`README.md`](README.md#the-machine-consumed-copy-coderabbityaml).

Both blocks were audited against the code for
[#80](https://github.com/Comfy-Org/comfy-multi-player/issues/80). That audit removed an incomplete
illustrative list of guard scripts and expanded the CI contract to cover every package gate.

<!-- coderabbit-instructions: scripts/** -->
```text
These scripts collectively provide the machine-enforced guards for the
invariants. Changes that weaken a guard (turning a positive assertion into a
denylist, skipping the corpus SHA check, or making a gate non-fatal) are
correctness issues. Keep the purity gate a positive yjs-only assertion, not
merely a denylist (issue #22).
```
<!-- /coderabbit-instructions -->

<!-- coderabbit-instructions: {package.json,tsconfig*.json,stryker.config.mjs} -->
```text
Guard the build and package contract. The production dependency set must stay
yjs-only (KA-3/FC-3) — flag any new runtime dependency. Cite the frozen
vocabulary/catalog by SHA, never a moving branch (FC-10). Do not remove or
make non-fatal the verify:corpus, build, check:purity, check:stateless,
check:profile-claims, check:coderabbit, check:imports, check:pins, test, or
test:clock-matrix scripts. Workspace CI is owned by
../../.github/workflows/ci-comfy-multi-player.yaml.
```
<!-- /coderabbit-instructions -->

Each block's load-bearing phrase is anchored into the generated file, so a body replaced with
plausible-sounding prose fails CI rather than regenerating cleanly. Needles are space-free because
the YAML carries them in a folded scalar, where any space is a legal line break — and each must be
**unique to its own block**: the first draft anchored the build/CI block on `yjs-only`, which also
appears in the `scripts/**` block, so that whole instruction could be replaced with "Looks fine to
me." and both gates stayed green. Anchoring is only as good as the needle's uniqueness, and the way
to know is to blank each body in turn and watch which claim goes stale.

<!-- claim: denylist :: .coderabbit.yaml -->
<!-- claim: collectively :: .coderabbit.yaml -->
<!-- claim-absent: check-purity, :: .coderabbit.yaml -->
<!-- claim: check:profile-claims :: .coderabbit.yaml -->
<!-- claim-absent: corpus-verify :: .coderabbit.yaml -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
