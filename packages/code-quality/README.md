# @comfyorg/code-quality

Shared tooling policy for Comfy repositories. The Fallow preset is exposed at
`@comfyorg/code-quality/fallow`; future tools can have their own subpaths.
The preset contains no code. Fallow 3.24.1 resolves npm subpaths as literal files,
so the extensionless `fallow` file uses TOML to extend `fallow.json`. The package
export points to the same JSON policy for consumers that use Node resolution.

## Usage

Install the preset and the tested CLI version:

```sh
npm install --save-dev --save-exact @comfyorg/code-quality@0.0.1 fallow@3.24.1
```

Add `extends` to the repository's existing `.fallowrc.jsonc`:

```json
{
  "extends": "npm:@comfyorg/code-quality/fallow",
  "ignoreDependencies": ["@comfyorg/code-quality"]
}
```

Fallow 3.24.1 does not credit the package dependency when loading an npm subpath.
Add only `@comfyorg/code-quality` to the local `ignoreDependencies` array to
avoid that false unused-dependency warning. Knip consumers need the same narrow
exception because Knip does not follow Fallow's `npm:` references.

Each repository owns its `.fallowrc.jsonc`. Keep repository-specific entry
points, framework roles, exclusions, rule overrides, and export exceptions there.
Fallow merges the local config over the preset. The shared settings are
`duplicates.minOccurrences: 3`,
`audit.gate: "new-only"` (Fallow 3.24.1's default, stated explicitly), and
`dev-dependencies-in-production: "error"`.
All other rule severities and thresholds retain Fallow 3.24.1's defaults.
Pin the `fallow` dev dependency and any Fallow CI action to 3.24.1 to keep
those defaults.

Baseline paths and contents stay in the consuming repository. The preset does
not require baseline files.
Fallow 3.24.1 deep-merges local `audit` fields over the preset, preserving the
shared gate. Any locally configured baseline files must exist; installing this
package does not create or refresh them.

Fallow supports path-specific `overrides[].rules` and
`health.thresholdOverrides`. Those remain local when they describe a particular
repository. See [Fallow configuration](https://fallow.tools/docs/configuration/overview/)
and [rule severity](https://fallow.tools/docs/configuration/rules/).

## Development and release

Run `pnpm --filter @comfyorg/code-quality test` to pack the package, install it
into clean npm consumers offline, and exercise the installed preset with the
pinned Fallow CLI.

Publish through the repository's **Publish Package** workflow after merge to
`main`, selecting `code-quality`, version `0.0.1`, and dist-tag `latest`.
The first release needs that manual dispatch; subsequent version bumps use the
existing **Version Bump Package** and release-label merge workflow.
