#!/usr/bin/env node
/**
 * Point this workspace at a specific comfy-multi-player commit instead of the pinned
 * release, for the `CI: CRDT Skew Alarm` workflow. Run from the repo root.
 *
 * The override MUST live in pnpm-workspace.yaml. pnpm 11 no longer reads the `pnpm`
 * field of package.json: it warns "keys were ignored" and resolves the pin anyway, so a
 * package.json override produces a green run that never tested upstream at all.
 *
 * The matching `allowBuilds` entry is not optional either. allowBuilds is keyed by the
 * resolved reference, and without an entry pnpm skips comfy-multi-player's `prepare`
 * script; `dist/` is then absent and every import fails in a way that reads as a skew
 * signal rather than a harness fault.
 *
 * Usage: node .github/scripts/crdt-skew-override.mjs --spec <tarball-url>
 */
import { readFileSync, writeFileSync } from 'node:fs'

const PACKAGE = '@comfyorg/comfy-multi-player'
const WORKSPACE_FILE = 'pnpm-workspace.yaml'

function parseArgs(argv) {
  const args = { spec: null, file: WORKSPACE_FILE }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--spec') args.spec = argv[++i]
    else if (argv[i] === '--file') args.file = argv[++i]
  }
  return args
}

function fail(message) {
  process.stderr.write(`::error::${message}\n`)
  process.exit(1)
}

const { spec, file } = parseArgs(process.argv.slice(2))
if (!spec) fail('crdt-skew-override: --spec <tarball-url> is required')

const lines = readFileSync(file, 'utf8').split('\n')

/** Insert `entry` as the first member of the top-level `block:` mapping. */
function inject(block, entry) {
  const at = lines.findIndex((line) => line.trimEnd() === `${block}:`)
  if (at === -1) {
    fail(
      `${file} has no top-level '${block}:' block; the skew alarm's override mechanism needs updating`
    )
  }
  lines.splice(at + 1, 0, entry)
}

inject('overrides', `  '${PACKAGE}': '${spec}'`)
inject('allowBuilds', `  '${PACKAGE}@${spec}': true`)

writeFileSync(file, lines.join('\n'))
process.stdout.write(`${file}: ${PACKAGE} -> ${spec}\n`)
