---
name: publishing-a-new-package
description: 'Publishes a new package from this monorepo to npm under @comfyorg and proves it is consumable from another repo. Covers registering the package with the shared release workflows, the first-publish 404, catalog: rewriting, trusted publishing, and the consumer smoke test. Use when adding a package to packages/, publishing to npm for the first time, or when an npm publish workflow fails.'
---

# Publishing a New Package

Getting a package onto npm is not done when the workflow goes green. It is done
when someone in another repo can install it and it works. Most of the failures
below happen after the "publish succeeded" line.

`docs/adr/RELEASES-PACKAGES-0033-sdk-packages-release-through-version-bump-prs.md`
records the release model: packages release through version-bump PRs, not
changesets.

## The shared release workflows

Publishable packages share one set of workflows. Each lists its packages
explicitly, so a new package must be added to every list:

| Workflow                        | Role                                                                                      | Where the package is listed                     |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `version-bump-package.yaml`     | Dispatch: bumps the version and opens a PR labelled `Release`                             | `package` choice options and the `case` mapping |
| `publish-package-on-merge.yaml` | On a merged `Release` PR, publishes each package whose version changed and notifies Slack | `paths` filter and the package loop             |
| `publish-package.yaml`          | Reusable publish job (`workflow_call` + `workflow_dispatch` from `main`)                  | `package` choice options and the `case` mapping |
| `ci-packages-pack.yaml`         | On PR: typecheck, build, tarball check and the consumer smoke test                        | `paths` filter and the `package` matrix         |
| `pr-publish-report.yaml`        | Posts the release links on the merged PR                                                  | Not package-specific                            |

Also add the package to `PUBLISHED_PACKAGES` in
`packages/account-core/scripts/smokePack.ts`, which packs every publishable
package, installs the tarballs into a clean npm project and imports every
entry.

`publish-package.yaml` refuses to publish a manifest that still sets
`"private": true`. Removing that flag in a reviewed PR is the latch that
allows the first release.

`@comfyorg/design-system` still has its own `version-bump-design-system.yaml`,
`publish-design-system.yaml`, `publish-design-system-on-merge.yaml` and
`ci-design-system-pack.yaml`. Do not copy that set for a new package.

## Releasing

Run `version-bump-package.yaml` for the package. It opens a PR labelled
`Release`; merge it, and `publish-package-on-merge.yaml` publishes the new
version. Prerelease versions publish to `next`, others to `latest`. A publish at
an already-published version is a **no-op**: the `Check if version already on
npm` step finds it and skips. To test the pipeline you need a new version
number.

Packages that ADR-RELEASES-PACKAGES-0033 holds on a prerelease line are gated
in `version-bump-package.yaml`; promoting one means amending that ADR and the
gate.

## The first publish is different

**A brand-new package name will fail the first CI publish unless the token was
scoped for it**, and the error does not say so. npm returns:

```text
[E404] 404 Not Found - PUT https://registry.npmjs.org/@comfyorg%2fyour-package
```

A 404 on `PUT` means the token may publish _existing_ packages in the scope but
may not _create_ a new name. A granular token whose write access is a
hand-picked package list cannot include a package that does not exist yet. It
reads like "the package doesn't exist", which is true and irrelevant, and sends
you looking for a workflow bug that isn't there. `--access public` is already
set; the registry URL is already right.

Two ways out, both fine:

1. Give the CI token read+write on the whole `@comfyorg` scope (the narrowest
   grant that can create a new name, and preferable to all-packages access),
   then re-run the workflow.
2. Publish once by hand with `pnpm publish` (never `npm publish`; see below),
   then make sure the CI token covers the new name.

Trusted publishing (OIDC) cannot bootstrap either: npm requires the package to
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
looks fine locally either way; the damage only shows up in the consumer.

`ci-packages-pack.yaml` rejects a packed manifest that still contains
`catalog:` or `workspace:` ranges. To check by hand:

```sh
pnpm -C packages/account-core run check:pack "$PWD/packages/<name>"
```

## Before the first publish

- **Write a README.** Without one the npm page renders empty, which defeats
  publishing for another team to discover. The tarball check allows
  `package.json`, `LICENSE` and `README.md` at the root, because npm
  force-includes all three regardless of `files`.
- **Declare peer dependencies.** Anything the consumer must supply, such as
  Tailwind or Vue, belongs in `peerDependencies`, not `devDependencies`. A
  devDependency tells the consumer nothing.
- **Export `./package.json`.** Tooling reads it; an `exports` map that omits it
  throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Check `files` against the exports map.** Every path in `exports` must be
  covered by `files`, or the target is simply absent from the tarball. Neither
  `npm pack` nor `npm install` resolves export targets, so it surfaces as a
  consumer resolution error the first time something imports that entry.

## Prove it is consumable

`smoke:pack` proves the tarballs install and import from a clean npm project.
Still prove it in a real consumer: in a _different_ repo, ideally one on npm
rather than pnpm, since that is the path where `catalog:` would explode:

```sh
npm install @comfyorg/<name>
```

Then import it somewhere real, build, and grep the build output to confirm the
thing you imported actually reached the bundle. Import **every** entry in the
`exports` map. A green build proves the import resolved; it does not prove the
values landed. For CSS, point the check at the consumer's own build output. The
path below is Nuxt's, so substitute whatever your consumer emits:

```sh
grep -o -- "--your-token:[^;]*" .output/public/_nuxt/*.css
```

Open that consumer change as a PR and keep the preview link. It is the evidence
that the publish worked end to end.

## Trusted publishing

Once the package exists, configure it on npmjs.com under package settings:

- Organization / repository / **workflow filename**: `publish-package.yaml`, the
  reusable workflow that runs the publish, not the on-merge wrapper.
- **Environment name: leave blank** unless the publish job declares
  `environment:`. A mismatch fails every publish.
- **Allow `npm publish` only.** `npm stage publish` publishes unlisted pending
  manual approval; we do not use it.

OIDC must be granted at **both** workflow layers: the caller job in
`publish-package-on-merge.yaml` that does
`uses: ./.github/workflows/publish-package.yaml`, and the publish job inside the
reusable workflow. A called workflow can never hold more than the calling job
does. Both already declare:

```yaml
permissions:
  contents: read
  id-token: write
```

Keep `NODE_AUTH_TOKEN` in place until an OIDC publish has actually succeeded.
`[WARN] Skipped OIDC` in the log means it silently fell back to the token;
treat that as a failure to chase down, not a warning to scroll past. Older
`pnpm/action-setup` releases broke pnpm's OIDC publish
([pnpm#11513](https://github.com/pnpm/pnpm/issues/11513)), so check the pinned
version first. Only after a real OIDC publish should you tighten the org to
require 2FA and disallow tokens; doing it earlier removes the only working
path.

## Announce it

Post the npm link, the install line, and the consumer PR preview link. "It's
published" is not actionable; "here is the import and here is it working" is.
