import { contains, modulesBySpecificity, sameRole } from './records'
import type { ArchitectureConfiguration, Claim } from './records'
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

interface LayeredModule extends Claim {
  layer: number
}

/**
 * Fallow puts a file in the first zone whose patterns match it. A path that
 * contains another domain's or role's path therefore goes in a later layer,
 * so the more specific path claims the files it names. Records without
 * nested paths keep one layer.
 */
function moduleLayers(records: DomainRecord[]): LayeredModule[] {
  const layered: LayeredModule[] = []
  for (const outer of modulesBySpecificity(records)) {
    const layer = Math.max(
      0,
      ...layered
        .filter((inner) => contains(outer.module.path, inner.module.path))
        .map((inner) => inner.layer + Number(!sameRole(inner, outer)))
    )
    layered.push({ ...outer, layer })
  }
  return layered
}

function domainZones(
  domain: DomainRecord,
  layered: LayeredModule[],
  claims: ReadonlyMap<string, Claim>
): Zone[] {
  return ROLES.flatMap((role) => {
    const own = layered.filter(
      ({ record, module }) => record === domain && module.role === role
    )
    const entries = domain.publicEntryPoints.filter((entry) =>
      own.some(({ module }) => module === claims.get(entry)?.module)
    )
    const layers = [...new Set(own.map(({ layer }) => layer))]
    return [
      {
        domain,
        name: `${domain.id}/${role}/public`,
        patterns: entries,
        isPublic: true,
        role,
        layer: -1
      },
      ...layers.map((layer) => ({
        domain,
        name: layer
          ? `${domain.id}/${role}/outer-${layer}`
          : `${domain.id}/${role}`,
        patterns: domain.modules
          .filter((module) =>
            own.some(
              (inner) => inner.module === module && inner.layer === layer
            )
          )
          .map(({ path }) => path),
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

export function buildBoundaries({
  records,
  claims
}: Pick<ArchitectureConfiguration, 'records' | 'claims'>): FallowBoundaries {
  const layered = moduleLayers(records)
  const zones = records.flatMap((record) =>
    domainZones(record, layered, claims)
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
