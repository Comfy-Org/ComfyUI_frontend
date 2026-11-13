import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// node rather than `sha256sum`, which is coreutils and absent on macOS, so the
// pre-push hook that runs this would fail there rather than on a real drift.
const spec = new URL('../openapi.yaml', import.meta.url)
const record = new URL('../openapi.yaml.sha256', import.meta.url)

const [recorded] = readFileSync(record, 'utf8').trim().split(/\s+/)
const actual = createHash('sha256').update(readFileSync(spec)).digest('hex')

if (actual !== recorded) {
  console.error(
    [
      'openapi.yaml no longer matches openapi.yaml.sha256.',
      `  recorded ${recorded}`,
      `  actual   ${actual}`,
      '',
      'The spec is vendored from Comfy-Org/ComfyUI at a pinned commit and must stay',
      'byte-identical to it, so the hash can be checked against core. Either it was',
      'refreshed without updating the pin and the README, or a formatter reindented',
      'it — that changes nothing in the generated types, so nothing else fails.'
    ].join('\n')
  )
  process.exit(1)
}
