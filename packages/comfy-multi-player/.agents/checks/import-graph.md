# Import-graph review

Validate import boundaries and detect circular dependencies. This reinforces purity (KA-3, FC-3) at the module-graph level and complements `scripts/check-purity.mjs`.

## Steps

1. Check availability: `npx --yes dependency-cruiser --version`. If unavailable, skip and report: "Skipped: dependency-cruiser not available (`npm i -D dependency-cruiser`)".
2. Identify changed directories from the diff.
3. Run over `src`. `--no-config` *disables* configuration loading, so it must not be combined with a repo config. If `.dependency-cruiser.js` or `.dependency-cruiser.cjs` exists, run WITHOUT `--no-config` so the repo's layer rules apply (dependency-cruiser auto-detects the file); use `--no-config` only when neither file exists:
   ```bash
   # repo config present (preferred):
   npx --yes dependency-cruiser --output-type json --do-not-follow "node_modules" --include-only "^src" src
   # no repo config:
   npx --yes dependency-cruiser --no-config --output-type json --do-not-follow "node_modules" --include-only "^src" src
   ```
4. Parse the JSON. Flag any module with `.circular == true` (major, category architecture) and any rule violation (`error`→major, `warn`→minor, `info`→nitpick).

## Repo-specific rules

- The pure op layer (`applier`, `project`, `mint`, `stamps`, `doc`, `migrate`, `types`) must import only each other and `yjs`. Any import of a DOM, framework, LiteGraph, server-only, filesystem, or network module from these files is a blocking FC-3 finding — report it here even if dependency-cruiser has no rule for it.
- Circular imports among the pure modules are a design smell that makes the package harder to tree-shake and reason about; report and suggest extracting the shared type/util.
- Do not flag test-only imports (`test/**`) reaching into `src`.

## Error handling

- If `npx` or the tool is unavailable, skip and report.
- If more than 50 violations, report the first 20 and the total.
- If none, report "No issues found."
