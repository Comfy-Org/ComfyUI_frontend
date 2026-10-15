import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { z } from 'zod'

import { listDirectory, readJson } from './outcome'
import type { Outcome } from './outcome'
import { domainRecordSchema, exceptionLedgerSchema } from './schema'
import type { ArchitectureException, DomainRecord } from './schema'

const DOMAINS_DIRECTORY = 'docs/architecture/domains'
const RECORDS_DIRECTORY = `${DOMAINS_DIRECTORY}/records`
const LEDGER_PATH = `${DOMAINS_DIRECTORY}/exceptions.json`
const SOURCE_FILE = /\.(ts|tsx|vue)$/

export interface ArchitectureWarning {
  message: string
  file: string
}

export interface ArchitectureConfiguration {
  exceptions: ArchitectureException[]
  records: DomainRecord[]
  sourceFiles: string[]
  warnings: ArchitectureWarning[]
}

function listSourceFiles(repositoryRoot: string): Outcome<string[]> {
  const entries = listDirectory(repositoryRoot, 'src', true)
  if (!entries.ok) return entries
  return {
    ok: true,
    value: entries.value
      .map((filename) => `src/${filename}`)
      .filter((filename) => SOURCE_FILE.test(filename))
      .sort()
  }
}

export function matchesModulePath(filename: string, path: string): boolean {
  return path.endsWith('/**')
    ? filename.startsWith(path.slice(0, -2))
    : filename === path
}

export const isClaimedBy = (file: string, record: DomainRecord) =>
  record.modules.some(({ path }) => matchesModulePath(file, path))

export const listUnclassifiedFiles = (
  records: DomainRecord[],
  sourceFiles: string[]
) =>
  sourceFiles.filter(
    (file) => !records.some((record) => isClaimedBy(file, record))
  )

function parseFile<T>(
  repositoryRoot: string,
  filename: string,
  schema: z.ZodType<T>
): Outcome<T> {
  const json = readJson(repositoryRoot, filename)
  if (!json.ok) return json
  const result = schema.safeParse(json.value)
  if (result.success) return { ok: true, value: result.data }
  const issues = result.error.issues.map(
    ({ path, message }) => `  ${path.join('.') || '(root)'}: ${message}`
  )
  return {
    ok: false,
    errors: [`${filename} is invalid:\n${issues.join('\n')}`]
  }
}

function loadRecordFiles(
  repositoryRoot: string
): Outcome<{ filename: string; record: DomainRecord }[]> {
  const entries = listDirectory(repositoryRoot, RECORDS_DIRECTORY, false)
  if (!entries.ok) return entries
  const parsed = entries.value
    .filter((filename) => filename.endsWith('.domain.json'))
    .sort()
    .map((name) => `${RECORDS_DIRECTORY}/${name}`)
    .map((filename) => ({
      filename,
      record: parseFile(repositoryRoot, filename, domainRecordSchema)
    }))
  const errors = parsed.flatMap(({ record }) =>
    record.ok ? [] : record.errors
  )
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: parsed.flatMap(({ filename, record }) =>
      record.ok ? [{ filename, record: record.value }] : []
    )
  }
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

function stalePathWarnings(
  records: { filename: string; record: DomainRecord }[],
  sourceFiles: string[]
): ArchitectureWarning[] {
  return records.flatMap(({ filename, record }) =>
    record.modules
      .filter(
        ({ path }) => !sourceFiles.some((f) => matchesModulePath(f, path))
      )
      .map(({ path }) => ({
        message: `${record.id} path matches no source files: ${path}. Remove or update it in ${filename}.`,
        file: filename
      }))
  )
}

function overlapErrors(
  records: DomainRecord[],
  sourceFiles: string[]
): string[] {
  const modules = records.flatMap((record) =>
    record.modules.map(({ path }) => ({ domain: record.id, path }))
  )
  return sourceFiles.flatMap((file) => {
    const owners = modules.filter(({ path }) => matchesModulePath(file, path))
    return owners.length > 1
      ? [
          `${file} is claimed by more than one module: ${owners.map(({ domain, path }) => `${domain} ${path}`).join(', ')}`
        ]
      : []
  })
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
): Outcome<ArchitectureConfiguration> {
  const recordFiles = loadRecordFiles(repositoryRoot)
  const ledger = parseFile(repositoryRoot, LEDGER_PATH, exceptionLedgerSchema)
  const sourceFiles = listSourceFiles(repositoryRoot)
  if (!recordFiles.ok || !ledger.ok || !sourceFiles.ok)
    return {
      ok: false,
      errors: [recordFiles, ledger, sourceFiles].flatMap((outcome) =>
        outcome.ok ? [] : outcome.errors
      )
    }
  const records = recordFiles.value.map(({ record }) => record)
  const { exceptions } = ledger.value
  const errors = [
    ...referenceErrors(records),
    ...overlapErrors(records, sourceFiles.value),
    ...referencedFileErrors(repositoryRoot, records),
    ...duplicates(exceptions.map(({ id }) => id)).map(
      (id) => `Exception id ${id} is declared more than once`
    )
  ]
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      exceptions,
      records,
      sourceFiles: sourceFiles.value,
      warnings: stalePathWarnings(recordFiles.value, sourceFiles.value)
    }
  }
}
