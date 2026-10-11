import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual, parseArgs } from 'node:util'

import { BOUNDARIES_PATH, buildBoundaries } from './boundaries'
import { buildCatalog, parseCodeowners } from './catalog'
import { loadArchitectureConfiguration } from './records'
import { censusSuppressions, ledgerErrors } from './suppressions'

const MODES = ['catalog', 'check', 'update'] as const
type Mode = (typeof MODES)[number]

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export function runArchitecture(repositoryRoot: string, mode: Mode): string[] {
  const configuration = loadArchitectureConfiguration(repositoryRoot)
  if (mode === 'catalog') {
    const codeowners = readFileSync(join(repositoryRoot, 'CODEOWNERS'), 'utf8')
    process.stdout.write(
      json(buildCatalog(configuration, parseCodeowners(codeowners)))
    )
    return []
  }
  const boundaries = buildBoundaries(configuration.records)
  const boundariesFile = join(repositoryRoot, BOUNDARIES_PATH)
  if (mode === 'update') {
    writeFileSync(boundariesFile, json(boundaries))
    return []
  }
  const inSync =
    existsSync(boundariesFile) &&
    isDeepStrictEqual(
      JSON.parse(readFileSync(boundariesFile, 'utf8')),
      boundaries
    )
  return [
    ...ledgerErrors(
      censusSuppressions(repositoryRoot, configuration.sourceFiles),
      configuration.exceptions
    ),
    ...(inSync
      ? []
      : [`${BOUNDARIES_PATH} is out of date; run pnpm architecture:update`])
  ]
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: Object.fromEntries(
      MODES.map((mode) => [mode, { type: 'boolean' as const }])
    )
  })
  const modes = MODES.filter((mode) => values[mode])
  if (modes.length !== 1)
    throw new Error(
      `Pass exactly one of ${MODES.map((m) => `--${m}`).join(', ')}`
    )
  const errors = runArchitecture(process.cwd(), modes[0])
  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`)
    process.exitCode = 1
  } else if (modes[0] !== 'catalog') {
    process.stdout.write(`Architecture ${modes[0]} passed\n`)
  }
}
