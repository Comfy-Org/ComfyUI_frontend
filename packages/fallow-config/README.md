# @comfyorg/fallow-config

Shared Fallow policy used by ComfyUI_frontend and available to other Comfy repos.
The preset is a single JSON file with no code; Fallow resolves it natively.

## Usage

Install the preset and the tested CLI version:

```sh
npm install --save-dev --save-exact @comfyorg/fallow-config@0.0.1 fallow@3.24.1
```

Add `extends` to the repository's existing `.fallowrc.jsonc`:

```json
{
  "extends": "npm:@comfyorg/fallow-config"
}
```

Keep repository-specific entry points, framework roles, exclusions, and export
exceptions in that file. Fallow merges the local config over
the preset. The shared settings are `duplicates.minOccurrences: 3`,
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

## Development and release

Run `pnpm --filter @comfyorg/fallow-config test` to pack the package, install it
into clean npm consumers offline, and exercise the installed preset with the
pinned Fallow CLI.

Publish through the repository's **Publish Package** workflow after merge to
`main`, selecting `fallow-config`, version `0.0.1`, and dist-tag `latest`.
The first release needs that manual dispatch; subsequent version bumps use the
existing **Version Bump Package** and release-label merge workflow.
