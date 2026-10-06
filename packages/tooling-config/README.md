# @comfyorg/tooling-config

Shared tooling policy for Comfy repositories. The Fallow preset is exposed at
`@comfyorg/tooling-config/fallow`; future tools can have their own subpaths.
The preset contains no code. Fallow 3.24.1 resolves npm subpaths as literal files,
so the extensionless `fallow` file uses TOML to extend `fallow.json`. The package
export points to the same JSON policy for consumers that use Node resolution.

## Usage

Install the preset and the tested CLI version:

```sh
npm install --save-dev --save-exact @comfyorg/tooling-config@0.0.1 fallow@3.24.1
```

Add `extends` to the repository's existing `.fallowrc.jsonc`:

```json
{
  "extends": "npm:@comfyorg/tooling-config/fallow",
  "ignoreDependencies": ["@comfyorg/tooling-config"]
}
```

Fallow 3.24.1 does not credit the package dependency when loading an npm subpath.
Add only `@comfyorg/tooling-config` to the local `ignoreDependencies` array to
avoid that false unused-dependency warning. Knip consumers need the same narrow
exception because Knip does not follow Fallow's `npm:` references.

Each repository owns its `.fallowrc.jsonc`. Keep repository-specific entry
points, framework roles, exclusions, rule overrides, and export exceptions there.
Do not copy ComfyUI_frontend's config into Platform: its Vite/Astro roots and
LiteGraph extension exceptions do not describe Platform's Nuxt app. Fallow merges
the local config over the preset. The shared settings are `duplicates.minOccurrences: 3`,
`audit.gate: "new-only"`, and `dev-dependencies-in-production: "error"`.
All other rule severities and thresholds retain Fallow 3.24.1's defaults.
Pin the `fallow` dev dependency and any Fallow CI action to 3.24.1 to keep
those defaults.

Baseline paths and contents stay in the consuming repository. The preset does
not require baseline files. ComfyUI_frontend keeps its existing
`.fallow-baselines/{dead-code,health,dupes}.json` paths in its local `audit` block.
Fallow 3.24.1 deep-merges local `audit` fields over the preset, preserving the
shared gate. Any locally configured baseline files must exist; installing this
package does not create or refresh them.

Fallow supports path-specific `overrides[].rules` and
`health.thresholdOverrides`. Those remain local when they describe a particular
repository. See [Fallow configuration](https://fallow.tools/docs/configuration/overview/)
and [rule severity](https://fallow.tools/docs/configuration/rules/).

## Repository-specific configuration

ComfyUI_frontend extends this preset in its root `.fallowrc.jsonc`, retaining
its Vite/Astro entry points, tooling/test roles, generated-code exclusions,
public extension exports, and baseline paths.

Platform can add the same `extends` to its existing Nuxt config after this
package is published. Retain Platform's local convention roots, generated-output
exclusions, baseline paths, and rules. For example, a Nuxt consumer can configure
an i18n entry point and a path-specific exception without changing shared policy:

```json
{
  "extends": "npm:@comfyorg/tooling-config/fallow",
  "ignoreDependencies": ["@comfyorg/tooling-config"],
  "entry": ["i18n/i18n.config.ts"],
  "ignorePatterns": [".nuxt/**", ".output/**"],
  "overrides": [
    {
      "files": ["services/legacy/**"],
      "rules": { "unused-exports": "warn" }
    }
  ]
}
```

This is an example of local policy, not a replacement for Platform's config.
Fallow's Nuxt plugin discovers convention entry points from the local `nuxt`
dependency. Extra build scripts belong in a local `framework` entry with
`entryPointRole: "support"`; adding them as runtime roots can incorrectly flag
their development dependencies. Object fields merge, while local arrays replace
inherited arrays. The shared preset contains no repository paths or exclusions.

## Development and release

Run `pnpm --filter @comfyorg/tooling-config test` to pack the package, install it
into clean npm consumers offline, and exercise the installed preset with the
pinned Fallow CLI.

Publish through the repository's **Publish Package** workflow after merge to
`main`, selecting `tooling-config`, version `0.0.1`, and dist-tag `latest`.
The first release needs that manual dispatch; subsequent version bumps use the
existing **Version Bump Package** and release-label merge workflow.
