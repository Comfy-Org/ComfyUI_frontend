import { isDeepStrictEqual, parseArgs } from 'node:util'

import { BOUNDARIES_PATH, buildBoundaries } from './boundaries'
import { buildCatalog, parseCodeowners } from './catalog'
import { attempt, readJson, readText, writeFormatted } from './outcome'
import type { Outcome } from './outcome'
import { listUnclassifiedFiles, loadArchitectureConfiguration } from './records'
import type { ArchitectureWarning } from './records'
import { censusSuppressions, ledgerErrors } from './suppressions'

const MODES = ['catalog', 'check', 'update'] as const
type Mode = (typeof MODES)[number]

interface ArchitectureReport {
  errors: string[]
  warnings: ArchitectureWarning[]
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const failure = (errors: string[]): ArchitectureReport => ({
  errors,
  warnings: []
})

export function runArchitecture(
  repositoryRoot: string,
  mode: Mode
): ArchitectureReport {
  const loaded = loadArchitectureConfiguration(repositoryRoot)
  if (!loaded.ok) return failure(loaded.errors)
  const configuration = loaded.value
  const warnings = [
    ...configuration.warnings,
    ...listUnclassifiedFiles(
      configuration.records,
      configuration.sourceFiles
    ).map((file) => ({
      message: `${file} is not claimed by any domain. Add it to a module in docs/architecture/domains/records.`,
      file
    }))
  ]
  if (mode === 'catalog') {
    const codeowners = readText(repositoryRoot, 'CODEOWNERS')
    if (!codeowners.ok) return failure(codeowners.errors)
    process.stdout.write(
      json(buildCatalog(configuration, parseCodeowners(codeowners.value)))
    )
    return { errors: [], warnings }
  }
  const boundaries = buildBoundaries(configuration.records)
  if (mode === 'update') {
    const written = writeFormatted(
      repositoryRoot,
      BOUNDARIES_PATH,
      json(boundaries)
    )
    return { errors: written.ok ? [] : written.errors, warnings }
  }
  const suppressions = censusSuppressions(
    repositoryRoot,
    configuration.sourceFiles
  )
  if (!suppressions.ok) return failure(suppressions.errors)
  const committedBoundaries = readJson(repositoryRoot, BOUNDARIES_PATH)
  const inSync =
    committedBoundaries.ok &&
    isDeepStrictEqual(committedBoundaries.value, boundaries)
  return {
    errors: [
      ...ledgerErrors(suppressions.value, configuration.exceptions),
      ...(inSync
        ? []
        : [`${BOUNDARIES_PATH} is out of date; run pnpm architecture:update`])
    ],
    warnings
  }
}

const escapeWorkflowCommand = (text: string) =>
  text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')

const escapeWorkflowProperty = (text: string) =>
  escapeWorkflowCommand(text).replaceAll(':', '%3A').replaceAll(',', '%2C')

const bulletSection = (title: string, lines: string[]) =>
  lines.length
    ? `${title} (${lines.length}):\n${lines.map((line) => `- ${line}`).join('\n')}\n`
    : ''

/** Renders a report as plain text, or as GitHub Actions annotations. */
export function formatReport(
  { errors, warnings }: ArchitectureReport,
  githubActions: boolean
): string {
  if (!githubActions)
    return (
      bulletSection(
        'Warnings',
        warnings.map(({ message }) => message)
      ) + bulletSection('Errors', errors)
    )
  return [
    ...warnings.map(
      ({ message, file }) =>
        `::warning file=${escapeWorkflowProperty(file)},title=Architecture::${escapeWorkflowCommand(message)}\n`
    ),
    ...errors.map(
      (error) => `::error title=Architecture::${escapeWorkflowCommand(error)}\n`
    )
  ].join('')
}

function parseMode(args: string[]): Outcome<Mode> {
  const parsed = attempt('parse arguments', () =>
    parseArgs({
      args,
      options: Object.fromEntries(
        MODES.map((mode) => [mode, { type: 'boolean' as const }])
      )
    })
  )
  if (!parsed.ok) return parsed
  const modes = MODES.filter((mode) => parsed.value.values[mode])
  return modes.length === 1
    ? { ok: true, value: modes[0] }
    : {
        ok: false,
        errors: [`Pass exactly one of ${MODES.map((m) => `--${m}`).join(', ')}`]
      }
}

/** Runs the CLI and returns its exit code. */
export function main(args: string[], repositoryRoot: string): number {
  const githubActions = process.env.GITHUB_ACTIONS === 'true'
  const mode = parseMode(args)
  if (!mode.ok) {
    process.stderr.write(formatReport(failure(mode.errors), githubActions))
    return 1
  }
  const run = attempt(`run architecture ${mode.value}`, () =>
    runArchitecture(repositoryRoot, mode.value)
  )
  const report = run.ok ? run.value : failure(run.errors)
  process.stderr.write(formatReport(report, githubActions))
  if (report.errors.length) {
    process.stderr.write(
      `Architecture ${mode.value} failed with ${report.errors.length} error(s)\n`
    )
    return 1
  }
  if (mode.value !== 'catalog')
    process.stdout.write(
      `Architecture ${mode.value} passed with ${report.warnings.length} warning(s)\n`
    )
  return 0
}

if (import.meta.main)
  process.exitCode = main(process.argv.slice(2), process.cwd())
