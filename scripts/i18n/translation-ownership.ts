import { createHash } from 'node:crypto'
import { z } from 'zod'

import type {
  LocaleObject,
  LocaleTrackedLeaf,
  LocaleValue
} from './locale-tree'
import { collectLeaves, getLeaf, pathKey } from './locale-tree'
import { auditProtectedLiterals } from './protected-tokens'

export const machineTranslationsSchema = z.object({
  version: z.literal(1),
  files: z.record(
    z.string(),
    z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/))
  )
})

export function translationDigest(value: LocaleTrackedLeaf): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function projectLocale(
  source: LocaleObject,
  values: ReadonlyMap<string, LocaleTrackedLeaf>,
  parent: string[] = []
): LocaleObject {
  return Object.fromEntries(
    Object.entries(source)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap<[string, LocaleValue]>(([key, value]) => {
        const path = [...parent, key]
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          const child = projectLocale(value, values, path)
          return Object.keys(child).length > 0 ? [[key, child]] : []
        }
        const selected = values.get(pathKey(path))
        return selected === undefined ? [] : [[key, structuredClone(selected)]]
      })
  )
}

export function partitionOwnedLocale(
  source: LocaleObject,
  existing: LocaleObject,
  machineTranslations: Readonly<Record<string, string>>,
  excludedPrefixes: readonly string[]
): { source: LocaleObject; retained: Map<string, LocaleTrackedLeaf> } {
  const eligible = new Map<string, LocaleTrackedLeaf>()
  const retained = new Map<string, LocaleTrackedLeaf>()
  for (const [key, leaf] of collectLeaves(source)) {
    const current = getLeaf(existing, leaf.path)
    if (
      current !== undefined &&
      machineTranslations[key] !== translationDigest(current)
    ) {
      retained.set(key, current)
      continue
    }
    const name = leaf.path.join('.')
    if (
      excludedPrefixes.some(
        (prefix) => name === prefix || name.startsWith(`${prefix}.`)
      )
    ) {
      continue
    }
    eligible.set(key, leaf.value)
  }
  return { source: projectLocale(source, eligible), retained }
}

export function auditRetainedTranslations(
  source: LocaleObject,
  retained: ReadonlyMap<string, LocaleTrackedLeaf>,
  strict: boolean = false,
  knownViolations: ReadonlySet<string> = new Set()
): string[] {
  const intentionalEmptyKeys = [...retained]
    .filter(([, value]) => value === '')
    .map(([key]) => key)
  return auditProtectedLiterals(
    source,
    projectLocale(source, retained),
    new Set(intentionalEmptyKeys),
    strict,
    knownViolations
  )
}
