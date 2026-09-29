import { realpathSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'astro/zod'

import { workshopModelSchema } from '../src/content/workshop-models.schema'
import {
  workshopIdentityAuditSchema,
  workshopRouterAliasesSchema
} from '../src/config/workshop-router-identity'
import { parseRouterOpenApiSnapshot } from '../src/config/workshop-router-openapi'

export function compileWorkshopAliases(
  rawAudit: unknown,
  rawCatalog: unknown,
  rawSnapshots: unknown
): string {
  const audit = workshopIdentityAuditSchema.parse(rawAudit)
  const catalog = z.array(workshopModelSchema).parse(rawCatalog)
  const snapshots = z
    .array(z.unknown())
    .parse(rawSnapshots)
    .map(parseRouterOpenApiSnapshot)
  const legacyIds = new Set(catalog.map((entry) => entry.id))
  const nativeIds = new Set(snapshots.map((entry) => entry.id))
  const auditIds = new Set(audit.records.map((entry) => entry.legacyId))
  if (
    legacyIds.size !== catalog.length ||
    nativeIds.size !== snapshots.length ||
    auditIds.size !== audit.records.length ||
    auditIds.size !== legacyIds.size ||
    [...auditIds].some((id) => !legacyIds.has(id))
  )
    throw new Error('Identity audit must cover every catalog ID exactly once')
  if (snapshots.some((entry) => entry.sourceCommit !== audit.sourceCommit))
    throw new Error('Identity audit and Router snapshot commits differ')
  for (const record of audit.records) {
    if (
      (record.status === 'unavailable' && record.matches.length !== 0) ||
      (record.status !== 'unavailable' && record.matches.length === 0) ||
      new Set(record.matches.map((match) => match.routerId)).size !==
        record.matches.length ||
      record.matches.some((match) => !nativeIds.has(match.routerId))
    )
      throw new Error(`Invalid identity targets: ${record.legacyId}`)
  }
  const aliases = workshopRouterAliasesSchema.parse(
    audit.records
      .filter(
        (record) => record.status === 'verified' && record.matches.length === 1
      )
      .map((record) => ({
        id: record.legacyId,
        ...record.matches[0],
        sourceCommit: audit.sourceCommit,
        ...(record.displayPrimary ? { displayPrimary: true } : {}),
        ...(record.contentIssue ? { contentIssue: record.contentIssue } : {})
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  )
  const primaryTargets = aliases.filter((alias) => alias.displayPrimary)
  if (
    new Set(primaryTargets.map((alias) => alias.routerId)).size !==
    primaryTargets.length
  )
    throw new Error('Multiple primary display records for a Router identity')
  return `[\n${aliases.map((alias) => JSON.stringify(alias)).join(',\n')}\n]\n`
}

async function main() {
  const paths = [
    'src/data/workshop-router-identity-audit.json',
    'src/content/workshop-models.json',
    'src/data/workshop-router-openapi.snapshot.json'
  ]
  const [audit, catalog, snapshots] = await Promise.all(
    paths.map(
      async (path): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'))
    )
  )
  const output = 'src/content/workshop-router-aliases.json'
  const packed = compileWorkshopAliases(audit, catalog, snapshots)
  const previous = await readFile(output, 'utf8').catch((error: unknown) => {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return undefined
    throw error
  })
  if (packed !== previous) await writeFile(output, packed)
  console.warn(`${output}: ${packed.trimEnd().split('\n').length - 2} aliases`)
}

if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) === realpathSync(import.meta.filename)
)
  await main()
