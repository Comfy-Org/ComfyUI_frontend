# @comfyorg/fallow-config

Shared Fallow policy used by ComfyUI_frontend and available to other Comfy repos.
This package contains JSON only; Fallow resolves it natively.

## Usage

Install the preset and the tested CLI version:

```sh
npm install --save-dev --save-exact @comfyorg/fallow-config@0.1.0 fallow@3.24.1
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
Pin the CLI in both package scripts and CI actions to preserve those defaults.

The preset uses `.fallow-baselines/{dead-code,health,dupes}.json` in the consuming
repository. Baseline contents stay in that repository. Fallow 3.24.1 replaces the
entire `audit` object when a local config supplies one; repeat the gate and all
three paths together if a consumer needs different baseline locations.
The three baseline files must exist; installing this package does not create or
refresh them.

Fallow supports path-specific `overrides[].rules` and
`health.thresholdOverrides`. Those remain local when they describe a particular
repository. See [Fallow configuration](https://fallow.tools/docs/configuration/overview/)
and [rule severity](https://fallow.tools/docs/configuration/rules/).

## Development and release

Run `pnpm --filter @comfyorg/fallow-config test` to pack the package, install it
into clean npm consumers offline, and exercise the installed preset with the
pinned Fallow CLI.

Publish through the repository's **Publish Package** workflow after merge to
`main`, selecting `fallow-config`, version `0.1.0`, and dist-tag `latest`.
The first release needs that manual dispatch; subsequent version bumps use the
existing **Version Bump Package** and release-label merge workflow.
