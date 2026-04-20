import { execSync } from 'node:child_process'

const FROZEN_DIRS = [
  'src/composables/',
  'src/stores/',
  'src/services/'
] as const

function getNewlyAddedFiles(): string[] {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=A', {
      encoding: 'utf8'
    })
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function main() {
  const added = getNewlyAddedFiles()
  const offenders = added.filter((f) =>
    FROZEN_DIRS.some((dir) => f.startsWith(dir))
  )

  if (offenders.length === 0) return

  const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
  const bold = (s: string) => `\x1b[1m${s}\x1b[0m`

  process.stdout.write(
    `\n${yellow(bold('⚠  Frozen directory warning'))}\n` +
      `The following directories are being wound down — new files should\n` +
      `generally live under src/components/ (co-located with the feature)\n` +
      `or inside a feature folder under src/platform/ or src/workbench/.\n\n` +
      `Frozen: ${FROZEN_DIRS.join(', ')}\n\n` +
      `New files detected in frozen directories:\n` +
      offenders.map((f) => `  - ${f}`).join('\n') +
      `\n\n` +
      `This is a warning only; the commit will proceed. If this placement\n` +
      `is intentional, no action needed.\n\n`
  )
}

main()
