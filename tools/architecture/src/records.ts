import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { z } from 'zod'

import { domainRecordSchema, exceptionLedgerSchema } from './schema'
import type { ArchitectureException, DomainRecord } from './schema'

const DOMAINS_DIRECTORY = 'docs/architecture/domains'
const RECORDS_DIRECTORY = `${DOMAINS_DIRECTORY}/records`
const LEDGER_PATH = `${DOMAINS_DIRECTORY}/exceptions.json`
const SOURCE_FILE = /\.(ts|tsx|vue)$/

export interface ArchitectureConfiguration {
  exceptions: ArchitectureException[]
  records: DomainRecord[]
  sourceFiles: string[]
}

function listSourceFiles(repositoryRoot: string): string[] {
  return readdirSync(join(repositoryRoot, 'src'), { recursive: true })
    .map((filename) => `src/${String(filename).replaceAll('\\', '/')}`)
    .filter((filename) => SOURCE_FILE.test(filename))
    .sort()
}

export function matchesModulePath(filename: string, path: string): boolean {
  return path.endsWith('/**')
    ? filename.startsWith(path.slice(0, -2))
    : filename === path
}

function parseFile<T>(
  repositoryRoot: string,
  filename: string,
  schema: z.ZodType<T>
): T {
  const result = schema.safeParse(
    JSON.parse(readFileSync(join(repositoryRoot, filename), 'utf8'))
  )
  if (result.success) return result.data
  const issues = result.error.issues.map(
    ({ path, message }) => `  ${path.join('.') || '(root)'}: ${message}`
  )
  throw new Error(`${filename} is invalid:\n${issues.join('\n')}`)
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, i) => values.indexOf(value) !== i))]
}

function referenceErrors(records: DomainRecord[]): string[] {
  const ids = new Set(records.map(({ id }) => id))
  return [
    ...duplicates(records.map(({ id }) => id)).map(
      (id) => `Domain id ${id} is declared more than once`
    ),
    ...records.flatMap((record) =>
      [...record.allowedDependencies, ...record.allowedConsumers]
        .filter((id) => !ids.has(id))
        .map((id) => `${record.id} references unknown domain ${id}`)
    )
  ]
}

function moduleErrors(
  records: DomainRecord[],
  sourceFiles: string[]
): string[] {
  const modules = records.flatMap((record) =>
    record.modules.map(({ path }) => ({ domain: record.id, path }))
  )
  const unmatched = modules
    .filter(({ path }) => !sourceFiles.some((f) => matchesModulePath(f, path)))
    .map(
      ({ domain, path }) => `${domain} path matches no source files: ${path}`
    )
  const overlapping = sourceFiles.flatMap((file) => {
    const owners = modules.filter(({ path }) => matchesModulePath(file, path))
    return owners.length > 1
      ? [
          `${file} is claimed by more than one module: ${owners.map(({ domain, path }) => `${domain} ${path}`).join(', ')}`
        ]
      : []
  })
  return [...unmatched, ...overlapping]
}

function referencedFileErrors(
  repositoryRoot: string,
  records: DomainRecord[]
): string[] {
  return records.flatMap((record) => [
    ...[
      ...record.publicEntryPoints,
      ...record.characterizationScenarios.flatMap(({ checks }) => checks),
      ...record.adrs
    ]
      .filter((filename) => !existsSync(join(repositoryRoot, filename)))
      .map((filename) => `${record.id} references missing file ${filename}`),
    ...record.publicEntryPoints
      .filter(
        (entry) =>
          !record.modules.some(({ path }) => matchesModulePath(entry, path))
      )
      .map(
        (entry) =>
          `${record.id} public entry point is outside its modules: ${entry}`
      )
  ])
}

export function loadArchitectureConfiguration(
  repositoryRoot: string
): ArchitectureConfiguration {
  const records = readdirSync(join(repositoryRoot, RECORDS_DIRECTORY))
    .filter((filename) => filename.endsWith('.domain.json'))
    .sort()
    .map((filename) =>
      parseFile(
        repositoryRoot,
        `${RECORDS_DIRECTORY}/${filename}`,
        domainRecordSchema
      )
    )
  const { exceptions } = parseFile(
    repositoryRoot,
    LEDGER_PATH,
    exceptionLedgerSchema
  )
  const sourceFiles = listSourceFiles(repositoryRoot)
  const errors = [
    ...referenceErrors(records),
    ...moduleErrors(records, sourceFiles),
    ...referencedFileErrors(repositoryRoot, records),
    ...duplicates(exceptions.map(({ id }) => id)).map(
      (id) => `Exception id ${id} is declared more than once`
    )
  ]
  if (errors.length) throw new Error(errors.join('\n'))
  return { exceptions, records, sourceFiles }
}
