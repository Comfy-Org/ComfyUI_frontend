---
name: publishing-a-new-package
description: 'Publishes a new package from this monorepo to npm under @comfyorg and proves it is consumable from another repo. Covers workflow scaffolding, the first-publish 404, catalog: rewriting, trusted publishing, and the consumer smoke test. Use when adding a package to packages/, publishing to npm for the first time, or when an npm publish workflow fails.'
---

# Publishing a New Package

Getting a package onto npm is not done when the workflow goes green. It is done
when someone in another repo can install it and it works. Most of the failures
below happen after the "publish succeeded" line.

## The first publish is different

**A brand-new package name will fail the first CI publish unless the token was
scoped for it**, and the error does not say so. npm returns:

```text
[E404] 404 Not Found - PUT https://registry.npmjs.org/@comfyorg%2fyour-package
```

A 404 on `PUT` means the token may publish _existing_ packages in the scope but
may not _create_ a new name — a granular token whose write access is a
hand-picked package list cannot include a package that does not exist yet. It
reads like "the package doesn't exist" — which is true and irrelevant — and
sends you looking for a workflow bug that isn't there. `--access public` is
already set; the registry URL is already right.

Two ways out, both fine:

1. Give the CI token read+write on the whole `@comfyorg` scope — the narrowest
   grant that can create a new name, and preferable to all-packages access —
   then re-run the workflow.
2. Publish once by hand, then make sure the CI token covers the new name.

Trusted publishing (OIDC) cannot bootstrap either — npm requires the package to
exist before a trusted publisher can be configured ([npm/cli#8544](https://github.com/npm/cli/issues/8544)).
So the ordering is always: first publish by token → configure trusted publisher
→ switch CI to OIDC.

## Never `npm publish` from this repo

Workspace packages use pnpm catalog specifiers:

```json
"dependencies": { "@iconify/utils": "catalog:" }
```

`pnpm publish` rewrites those to real ranges when it packs. `npm publish` ships
the literal string `"catalog:"`, and every consumer install breaks. The tarball
looks fine locally either way — the damage only shows up in the consumer.

Check before you publish anything:

```sh
cd packages/<name>
pnpm pack --pack-destination /tmp
tar -xzOf /tmp/comfyorg-<name>-<version>.tgz package/package.json | jq .dependencies
```

Every value must be a real range. If you see `catalog:`, you used the wrong tool.

## Scaffolding the workflows

Copy the four-workflow set from an existing package such as `design-system`:

| Workflow                      | Role                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `publish-<pkg>.yaml`          | `workflow_call` + `workflow_dispatch`; does the publish |
| `publish-<pkg>-on-merge.yaml` | fires on merged PR with the `Release` label             |
| `version-bump-<pkg>.yaml`     | dispatch → opens a version PR labelled `Release`        |
| `ci-<pkg>-pack.yaml`          | on PR — typecheck + assert tarball contents             |

The pack check must allowlist `package.json`, `LICENSE`, **and `README.md`**.
npm force-includes all three regardless of the `files` field, so a guard that
only permits the first two rejects any package that has a readme.

## Before the first publish

- **Write a README.** Without one the npm page renders empty, which defeats
  publishing for another team to discover.
- **Declare peer dependencies.** Anything the consumer must supply — Tailwind,
  Vue — belongs in `peerDependencies`, not `devDependencies`. A devDependency
  tells the consumer nothing.
- **Export `./package.json`.** Tooling reads it; an `exports` map that omits it
  throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Check `files` against the exports map.** Every path in `exports` must be
  covered by `files`, or the target is simply absent from the tarball. Nothing
  catches this at install time — neither `npm pack` nor `npm install` resolves
  export targets — so it surfaces as a consumer resolution error the first time
  something imports that entry.

## Releasing after the first time

Run the version-bump workflow → it opens a PR labelled `Release` → merge it →
`publish-<pkg>-on-merge` publishes and posts to Slack. A manual dispatch at an
already-published version is a **no-op**: the `Check if version already on npm`
step finds it and skips. If you want to test the pipeline, you need a new
version number.

## Prove it is consumable

This is the step people skip, and it is the only one that finds real problems.
In a _different_ repo — ideally one on npm rather than pnpm, since that is the
path where `catalog:` would explode:

```sh
npm install @comfyorg/<name>
```

Then import it somewhere real, build, and grep the build output to confirm the
thing you imported actually reached the bundle. Import **every** entry in the
`exports` map while you are there — a subpath whose target never made it into
the tarball fails only here. A green build proves the import resolved; it does
not prove the values landed. For CSS, point the check at the consumer's own
build output — the path below is Nuxt's, so substitute whatever your consumer
emits:

```sh
grep -o -- "--your-token:[^;]*" .output/public/_nuxt/*.css
```

Open that consumer change as a PR and keep the preview link — it is the
evidence that the publish worked end to end.

## Trusted publishing

Once the package exists, configure it on npmjs.com under package settings:

- Organization / repository / **workflow filename** — use the reusable workflow
  that actually runs the publish (`publish-<pkg>.yaml`), not the on-merge wrapper.
- **Environment name — leave blank** unless the publish job declares
  `environment:`. A mismatch fails every publish.
- **Allow `npm publish` only.** `npm stage publish` publishes unlisted pending
  manual approval; we do not use it.

Then grant OIDC at **both** workflow layers — the caller job that does
`uses: ./.github/workflows/publish-<pkg>.yaml`, and the publish job inside the
reusable workflow. A called workflow can never hold more than the calling job
does, so setting this on the inner job alone leaves it with no token and the
publish quietly falls back to `NPM_TOKEN`:

```yaml
permissions:
  contents: read
  id-token: write
```

Keep `NODE_AUTH_TOKEN` in place until an OIDC publish has actually succeeded.
`[WARN] Skipped OIDC` in the log means it silently fell back to the token —
treat that as a failure to chase down, not a warning to scroll past. Suspect
`pnpm/action-setup` first: every workflow here still pins `v4.4.0`
(`fc06bc1257f339d1d5d8b3a19a8cae5388b55320`), the version that broke pnpm's OIDC
publish in [pnpm#11513](https://github.com/pnpm/pnpm/issues/11513) — closed once
the reporter bumped the action, not by a pnpm release. Only after a real OIDC
publish should you tighten the org to require 2FA and disallow tokens; doing it
earlier removes the only working path.

## Announce it

Post the npm link, the install line, and the consumer PR preview link. "It's
published" is not actionable; "here is the import and here is it working" is.
