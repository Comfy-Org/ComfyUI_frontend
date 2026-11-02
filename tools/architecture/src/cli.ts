import { isDeepStrictEqual, parseArgs } from 'node:util'

import { BOUNDARIES_PATH, buildBoundaries } from './boundaries'
import { buildCatalog, parseCodeowners } from './catalog'
import {
  attempt,
  readJson,
  readText,
  writeFormatted,
  writeText
} from './outcome'
import type { Outcome } from './outcome'
import { loadArchitectureConfiguration } from './records'
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
    ...configuration.unclassifiedFiles.map((file) => ({
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
  const boundaries = buildBoundaries(configuration)
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

function escapeWorkflowCommand(text: string): string {
  return text
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
}

function escapeWorkflowProperty(text: string): string {
  return escapeWorkflowCommand(text)
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C')
}

function bulletSection(title: string, lines: string[]): string {
  return lines.length
    ? `${title} (${lines.length}):\n${lines.map((line) => `- ${line}`).join('\n')}\n`
    : ''
}

const MARKDOWN_LIST_LIMIT = 50

function escapeMarkdown(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/[\\`*_[\]~|#]/g, '\\$&')
}

function markdownList(lines: string[]): string {
  return [
    ...lines
      .slice(0, MARKDOWN_LIST_LIMIT)
      .map((line) => `- ${escapeMarkdown(line).replaceAll('\n', '\n  ')}`),
    ...(lines.length > MARKDOWN_LIST_LIMIT
      ? [`- …and ${lines.length - MARKDOWN_LIST_LIMIT} more`]
      : [])
  ].join('\n')
}

function markdownSection(title: string, lines: string[]): string {
  return lines.length
    ? `### ${title} (${lines.length})\n\n${markdownList(lines)}\n`
    : ''
}

function formatMarkdown({ errors, warnings }: ArchitectureReport): string {
  return [
    markdownSection('Errors', errors),
    markdownSection(
      'Warnings',
      warnings.map(({ message }) => message)
    )
  ]
    .filter(Boolean)
    .join('\n')
}

function formatText({ errors, warnings }: ArchitectureReport): string {
  return (
    bulletSection(
      'Warnings',
      warnings.map(({ message }) => message)
    ) + bulletSection('Errors', errors)
  )
}

function formatAnnotations({ errors, warnings }: ArchitectureReport): string {
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

/** Renders a report as plain text, GitHub Actions annotations, or a Markdown PR report section. */
export function formatReport(
  report: ArchitectureReport,
  format: 'text' | 'github' | 'markdown'
): string {
  if (format === 'github') return formatAnnotations(report)
  if (format === 'markdown') return formatMarkdown(report)
  return formatText(report)
}

interface CliOptions {
  mode: Mode
  reportFile: string | undefined
}

function parseOptions(args: string[]): Outcome<CliOptions> {
  const parsed = attempt('parse arguments', () =>
    parseArgs({
      args,
      options: {
        catalog: { type: 'boolean' },
        check: { type: 'boolean' },
        update: { type: 'boolean' },
        report: { type: 'string' }
      }
    })
  )
  if (!parsed.ok) return parsed
  const { values } = parsed.value
  const modes = MODES.filter((mode) => values[mode])
  if (modes.length !== 1)
    return {
      ok: false,
      errors: [`Pass exactly one of ${MODES.map((m) => `--${m}`).join(', ')}`]
    }
  if (values.report === '')
    return { ok: false, errors: ['--report requires a file path'] }
  return { ok: true, value: { mode: modes[0], reportFile: values.report } }
}

/** Runs the CLI and returns its exit code. */
export function main(args: string[], repositoryRoot: string): number {
  const format = process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'text'
  const options = parseOptions(args)
  if (!options.ok) {
    process.stderr.write(formatReport(failure(options.errors), format))
    return 1
  }
  const { mode, reportFile } = options.value
  const run = attempt(`run architecture ${mode}`, () =>
    runArchitecture(repositoryRoot, mode)
  )
  const ran = run.ok ? run.value : failure(run.errors)
  const written = reportFile
    ? writeText(repositoryRoot, reportFile, formatReport(ran, 'markdown'))
    : undefined
  const report =
    written && !written.ok
      ? { ...ran, errors: [...ran.errors, ...written.errors] }
      : ran
  process.stderr.write(formatReport(report, format))
  if (report.errors.length) {
    process.stderr.write(
      `Architecture ${mode} failed with ${report.errors.length} error(s)\n`
    )
    return 1
  }
  if (mode !== 'catalog')
    process.stdout.write(
      `Architecture ${mode} passed with ${report.warnings.length} warning(s)\n`
    )
  return 0
}

if (import.meta.main)
  process.exitCode = main(process.argv.slice(2), process.cwd())
