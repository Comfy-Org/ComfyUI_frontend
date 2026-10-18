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
  claims: Map<string, Claim>
  unclassifiedFiles: string[]
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

type Module = DomainRecord['modules'][number]

export interface Claim {
  record: DomainRecord
  module: Module
}

const specificity = (path: string) =>
  path.endsWith('/**') ? path.length : Number.MAX_SAFE_INTEGER

/**
 * Every module, most specific path first: a file path outranks any directory,
 * and a deeper directory outranks a shallower one. A path only comes after
 * the paths it contains.
 */
export const modulesBySpecificity = (records: DomainRecord[]): Claim[] =>
  records
    .flatMap((record) => record.modules.map((module) => ({ record, module })))
    .toSorted((a, b) => specificity(b.module.path) - specificity(a.module.path))

export const contains = (outer: string, inner: string) =>
  outer !== inner &&
  outer.endsWith('/**') &&
  inner.startsWith(outer.slice(0, -2))

export const sameRole = (a: Claim, b: Claim) =>
  a.record === b.record && a.module.role === b.module.role

/**
 * Maps each file to the most specific module path that matches it, so a
 * directory can claim everything below it while nested paths override parts
 * of it.
 */
export function claimFiles(
  records: DomainRecord[],
  files: string[]
): Map<string, Claim> {
  const modules = modulesBySpecificity(records)
  const claims = new Map<string, Claim>()
  for (const file of files) {
    const claim = modules.find(({ module }) =>
      matchesModulePath(file, module.path)
    )
    if (claim) claims.set(file, claim)
  }
  return claims
}

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
  sourceFiles: string[],
  claims: Map<string, Claim>
): ArchitectureWarning[] {
  const claimed = new Set([...claims.values()].map(({ module }) => module))
  return records.flatMap(({ filename, record }) =>
    record.modules
      .filter((module) => !claimed.has(module))
      .map(({ path }) => ({
        message: sourceFiles.some((f) => matchesModulePath(f, path))
          ? `${record.id} path claims no source files because more specific paths claim all of them: ${path}. Remove it from ${filename}.`
          : `${record.id} path matches no source files: ${path}. Remove or update it in ${filename}.`,
        file: filename
      }))
  )
}

/**
 * A path is redundant when the nearest path enclosing it has the same domain
 * and role: removing it hands its files to that path unchanged.
 */
function redundantPathWarnings(
  records: { filename: string; record: DomainRecord }[]
): ArchitectureWarning[] {
  const modules = modulesBySpecificity(records.map(({ record }) => record))
  return records.flatMap(({ filename, record }) =>
    record.modules.flatMap((module) => {
      const outer = modules.find((enclosing) =>
        contains(enclosing.module.path, module.path)
      )
      return outer && sameRole(outer, { record, module })
        ? [
            {
              message: `${record.id} path repeats the role of the enclosing ${outer.module.path}: ${module.path}. Remove it from ${filename}.`,
              file: filename
            }
          ]
        : []
    })
  )
}

function overlapErrors(records: DomainRecord[]): string[] {
  const claimants = new Map<string, string[]>()
  for (const record of records) {
    for (const { path } of record.modules) {
      claimants.set(path, [...(claimants.get(path) ?? []), record.id])
    }
  }
  return [...claimants]
    .filter(([, domains]) => domains.length > 1)
    .map(
      ([path, domains]) =>
        `${path} is claimed by more than one module: ${domains.join(', ')}`
    )
}

function referencedFileErrors(
  repositoryRoot: string,
  records: DomainRecord[],
  claims: Map<string, Claim>
): string[] {
  return records.flatMap((record) => {
    const missing = [
      ...record.publicEntryPoints,
      ...record.characterizationScenarios.flatMap(({ checks }) => checks),
      ...record.adrs
    ].filter((filename) => !existsSync(join(repositoryRoot, filename)))
    return [
      ...missing.map(
        (filename) => `${record.id} references missing file ${filename}`
      ),
      ...record.publicEntryPoints
        .filter(
          (entry) =>
            !missing.includes(entry) && claims.get(entry)?.record !== record
        )
        .map(
          (entry) =>
            `${record.id} public entry point is outside its modules: ${entry}`
        )
    ]
  })
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
  const claims = claimFiles(records, sourceFiles.value)
  const errors = [
    ...referenceErrors(records),
    ...overlapErrors(records),
    ...referencedFileErrors(repositoryRoot, records, claims),
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
      claims,
      unclassifiedFiles: sourceFiles.value.filter((file) => !claims.has(file)),
      warnings: [
        ...stalePathWarnings(recordFiles.value, sourceFiles.value, claims),
        ...redundantPathWarnings(recordFiles.value)
      ]
    }
  }
}
