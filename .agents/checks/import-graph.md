---
name: import-graph
description: Validates import rules, detects circular dependencies, and enforces layer boundaries using dependency-cruiser
severity-default: high
tools: [Bash, Read]
---

Run dependency-cruiser import graph analysis on changed files to detect circular dependencies, orphan modules, and import rule violations.

> **Note:** The circular dependency scan in step 4 targets `src/` specifically, since this is a frontend app with source code under `src/`.

## Steps

1. Check if dependency-cruiser is available:
   ```bash
   pnpm dlx dependency-cruiser --version
   ```
   If not available, skip this check and report: "Skipped: dependency-cruiser not available. Install with: `pnpm add -D dependency-cruiser`"

> **Install:** `pnpm add -D dependency-cruiser`

2. Identify changed directories from the diff.

3. Determine config to use:
   - If `.dependency-cruiser.js` or `.dependency-cruiser.cjs` exists in the repo root, use it (dependency-cruiser auto-detects it). This config may enforce layer architecture rules (e.g., base → platform → workbench → renderer import direction):
     ```bash
     pnpm dlx dependency-cruiser --output-type json <changed_directories> 2>/dev/null
     ```
   - If no config exists, run with built-in defaults:
     ```bash
     pnpm dlx dependency-cruiser --no-config --output-type json <changed_directories> 2>/dev/null
     ```

4. Also check for circular dependencies specifically across `src/`:

   ```bash
   pnpm dlx dependency-cruiser --no-config --output-type json --do-not-follow "node_modules" --include-only "^src" src 2>/dev/null
   ```

   Look for modules where `.circular == true` in the output.

5. Parse the JSON output. Each violation has:
   - `rule.name`: the violated rule
   - `rule.severity`: error, warn, info
   - `from`: importing module
   - `to`: imported module

6. Map violation severity:
   - `error` → `major`
   - `warn` → `minor`
   - `info` → `nitpick`
   - Circular dependencies → `major` (category: architecture)
   - Orphan modules → `nitpick` (category: dx)

7. Report each violation with: the rule name, source and target modules, file path, and a suggestion (usually move the import or extract an interface).

## What It Catches

| Rule                     | What It Detects                                      |
| ------------------------ | ---------------------------------------------------- |
| `no-circular`            | Circular dependency chains (A → B → C → A)           |
| `no-orphans`             | Modules with no incoming or outgoing dependencies    |
| `not-to-dev-dep`         | Production code importing devDependencies            |
| `no-duplicate-dep-types` | Same dependency in multiple sections of package.json |
| Custom layer rules       | Import direction violations (e.g., base → platform)  |

## Error Handling

- If pnpm dlx is not available, skip and report the error.
- If the config file fails to parse, fall back to `--no-config`.
- If there are more than 50 violations, report the first 20 and note the total count.
- If no violations are found, report "No issues found."
