import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface WorkflowFile {
  path: string
  contents: string
}

interface ActionUse {
  action: string
  ref: string
  version: string
  location: string
}

const USES_LINE = /^\s*(?:-\s+)?uses:\s*['"]?([^\s'"#]+)['"]?(?:\s+#\s*(\S+))?/
const COMMIT_SHA = /^[0-9a-f]{40}$/

function parseUses({ path, contents }: WorkflowFile): ActionUse[] {
  return contents.split('\n').flatMap((line, index) => {
    const match = USES_LINE.exec(line)
    if (!match) return []
    const [, target, comment] = match
    const at = target.lastIndexOf('@')
    if (target.startsWith('./') || target.startsWith('docker://') || at < 0)
      return []
    if (target.includes('/.github/workflows/')) return []
    const ref = target.slice(at + 1)
    const [owner, repo] = target.slice(0, at).split('/')
    return [
      {
        action: `${owner}/${repo}`.toLowerCase(),
        ref,
        version: COMMIT_SHA.test(ref) && comment ? comment : ref,
        location: `${path}:${index + 1}`
      }
    ]
  })
}

function majorOf(version: string): string {
  return /^v?(\d+)/.exec(version)?.[1] ?? version
}

function hasDrift(uses: ActionUse[]): boolean {
  const majors = new Set(uses.map((use) => majorOf(use.version)))
  const shas = new Set(
    uses.map((use) => use.ref).filter((ref) => COMMIT_SHA.test(ref))
  )
  return majors.size > 1 || shas.size > 1
}

export function findVersionDrift(files: WorkflowFile[]): string[] {
  const allUses = files.flatMap(parseUses)
  return [...new Set(allUses.map((use) => use.action))]
    .map((action) => allUses.filter((use) => use.action === action))
    .filter(hasDrift)
    .map((uses) =>
      [
        `${uses[0].action} is used at more than one version:`,
        ...uses.map((use) => `  ${use.version}  ${use.location}`)
      ].join('\n')
    )
}

if (import.meta.main) {
  const root = '.github'
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => /^(workflows|actions)\/.*\.ya?ml$/.test(file))
    .map((file) => ({
      path: join(root, file),
      contents: readFileSync(join(root, file), 'utf8')
    }))
  const drift = findVersionDrift(files)
  if (drift.length > 0) {
    process.stderr.write(`${drift.join('\n\n')}\n`)
    process.exitCode = 1
  }
}
