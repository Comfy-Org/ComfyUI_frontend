import { claimFiles, matchesModulePath } from './records'
import type { Claim } from './records'
import { ROLES, ROLE_DEPENDENCIES } from './schema'
import type { ArchitecturalRole, DomainRecord } from './schema'

export const BOUNDARIES_PATH = 'docs/architecture/domains/boundaries.json'
const UNCLASSIFIED = 'unclassified'

interface Zone {
  domain: DomainRecord
  name: string
  patterns: string[]
  isPublic: boolean
  role: ArchitecturalRole
  layer: number
}

export interface FallowBoundaries {
  boundaries: {
    zones: Array<{ name: string; patterns: string[] }>
    rules: Array<{ from: string; allow: string[] }>
  }
}

type Layers = ReadonlyMap<string, number>

const contains = (outer: string, inner: string) =>
  outer !== inner &&
  outer.endsWith('/**') &&
  matchesModulePath(inner.replace(/\*\*$/, ''), outer)

/**
 * Fallow puts a file in the first zone whose patterns match it. A path that
 * contains another domain's or role's path therefore goes in a later layer,
 * so the more specific path claims the files it names. Records without
 * nested paths keep one layer.
 */
function moduleLayers(records: DomainRecord[]): Layers {
  const modules = records.flatMap((record) =>
    record.modules.map(({ path, role }) => ({
      path,
      key: `${record.id}/${role}`
    }))
  )
  const layers = new Map<string, number>()
  const layerOf = (module: (typeof modules)[number]): number => {
    const known = layers.get(module.path)
    if (known !== undefined) return known
    const layer = Math.max(
      0,
      ...modules
        .filter((inner) => contains(module.path, inner.path))
        .map((inner) => layerOf(inner) + (inner.key === module.key ? 0 : 1))
    )
    layers.set(module.path, layer)
    return layer
  }
  for (const module of modules) layerOf(module)
  return layers
}

function domainZones(
  domain: DomainRecord,
  layers: Layers,
  entryClaims: ReadonlyMap<string, Claim>
): Zone[] {
  return ROLES.flatMap((role) => {
    const paths = domain.modules
      .filter((module) => module.role === role)
      .map(({ path }) => path)
    const entries = domain.publicEntryPoints.filter((entry) => {
      const claim = entryClaims.get(entry)
      return claim?.record === domain && claim.module.role === role
    })
    const byLayer = new Map<number, string[]>()
    for (const path of paths) {
      const layer = layers.get(path) ?? 0
      byLayer.set(layer, [...(byLayer.get(layer) ?? []), path])
    }
    return [
      {
        domain,
        name: `${domain.id}/${role}/public`,
        patterns: entries,
        isPublic: true,
        role,
        layer: -1
      },
      ...[...byLayer].map(([layer, patterns]) => ({
        domain,
        name: layer
          ? `${domain.id}/${role}/outer-${layer}`
          : `${domain.id}/${role}`,
        patterns,
        isPublic: false,
        role,
        layer
      }))
    ].filter(({ patterns }) => patterns.length)
  })
}

function permits(consumer: DomainRecord, producer: DomainRecord): boolean {
  return (
    consumer.allowedDependencies.includes(producer.id) &&
    producer.allowedConsumers.includes(consumer.id)
  )
}

function reachableFromOutside(zone: Zone): boolean {
  return zone.isPublic || zone.domain.deepImports === 'inventory'
}

function allowedTargets(source: Zone, zones: Zone[]): string[] {
  const roles: readonly ArchitecturalRole[] = ROLE_DEPENDENCIES[source.role]
  return zones
    .filter(
      (target) =>
        roles.includes(target.role) &&
        (target.domain === source.domain ||
          (permits(source.domain, target.domain) &&
            reachableFromOutside(target)))
    )
    .map(({ name }) => name)
}

export function buildBoundaries(records: DomainRecord[]): FallowBoundaries {
  const layers = moduleLayers(records)
  const entryClaims = claimFiles(
    records,
    records.flatMap(({ publicEntryPoints }) => publicEntryPoints)
  )
  const zones = records.flatMap((record) =>
    domainZones(record, layers, entryClaims)
  )
  const ordered = zones.toSorted((a, b) => a.layer - b.layer)
  return {
    boundaries: {
      zones: [
        ...ordered.map(({ name, patterns }) => ({ name, patterns })),
        { name: UNCLASSIFIED, patterns: ['src/**'] }
      ],
      rules: [
        ...ordered.map((zone) => ({
          from: zone.name,
          allow: [...allowedTargets(zone, ordered), UNCLASSIFIED]
        })),
        {
          from: UNCLASSIFIED,
          allow: [
            ...ordered.filter(reachableFromOutside).map(({ name }) => name),
            UNCLASSIFIED
          ]
        }
      ]
    }
  }
}
