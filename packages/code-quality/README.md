# @comfyorg/code-quality

Shared code quality policy for Comfy repositories. The Fallow preset is a single
JSON file at `@comfyorg/code-quality/fallow.json`, with no executable code.
Fallow 3.24.1 resolves this file directly.

## Usage

Install the preset and the tested CLI version:

```sh
pnpm add --save-dev --save-exact @comfyorg/code-quality@0.0.1 fallow@3.24.1
```

Add `extends` to the repository's existing `.fallowrc.jsonc`:

```json
{
  "extends": "npm:@comfyorg/code-quality/fallow.json",
  "ignoreDependencies": ["@comfyorg/code-quality"]
}
```

Fallow 3.24.1 does not credit the package dependency when loading an npm subpath.
Add only `@comfyorg/code-quality` to the local `ignoreDependencies` array to
avoid that false unused-dependency warning. Knip consumers need the same narrow
exception because Knip does not follow Fallow's `npm:` references.

## Shared policy

This preset starts with the policy already used by Frontend:

- Report duplication from three occurrences, avoiding the default two-copy noise.
- Fail when production code imports a development dependency.
- Gate only newly introduced findings so existing debt does not block adoption.
  This is Fallow 3.24.1's default, kept explicit as shared policy.

The dependency lets repositories adopt reviewed policy changes through one
package version bump instead of copying settings. It does not add a broader
rule set or bundle the Fallow CLI. All other severities and thresholds retain
Fallow 3.24.1's defaults.
Pin the `fallow` dev dependency and any Fallow CI action to 3.24.1 to keep
those defaults.

Each repository owns its `.fallowrc.jsonc`. Keep repository-specific entry
points, framework roles, exclusions, rule overrides, and export exceptions there.
Fallow merges the local config over the preset.

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
