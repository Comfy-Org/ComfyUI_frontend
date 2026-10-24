import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

const root = path.resolve(import.meta.dirname, '..')
const targets = process.argv.slice(2)
const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/oxlint/bin/oxlint'),
    '--format=json',
    ...(targets.length ? targets : ['src'])
  ],
  { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
)

if (result.error || (result.status !== 0 && result.status !== 1)) {
  console.error(result.error ?? result.stderr)
  process.exit(1)
}

const report = z
  .object({
    diagnostics: z.array(
      z.object({
        code: z.string().optional(),
        filename: z.string(),
        labels: z.array(z.object({ span: z.object({ line: z.number() }) }))
      })
    )
  })
  .parse(JSON.parse(result.stdout))
const baseline = z
  .partialRecord(
    z.string(),
    z.partialRecord(z.string(), z.object({ count: z.number() }))
  )
  .parse(
    JSON.parse(
      readFileSync(path.join(root, 'oxlint-suppressions.json'), 'utf8')
    )
  )
const throws = report.diagnostics.filter(
  ({ code }) => code === 'comfy(no-new-error-throw)'
)
const files = [...new Set(throws.map(({ filename }) => filename))]
  .sort()
  .map((file) => {
    const lines = throws
      .filter(({ filename }) => filename === file)
      .flatMap(({ labels }) => labels.map(({ span }) => span.line))
    const allowed = baseline[file]?.['comfy/no-new-error-throw']?.count ?? 0
    return {
      file,
      count: lines.length,
      baseline: allowed,
      excess: Math.max(0, lines.length - allowed),
      lines
    }
  })

console.log(
  JSON.stringify(
    {
      violations: throws.length,
      excess: files.reduce((sum, file) => sum + file.excess, 0),
      files
    },
    null,
    2
  )
)
