import { matchesModulePath } from './records'
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
}

export interface FallowBoundaries {
  boundaries: {
    zones: Array<{ name: string; patterns: string[] }>
    rules: Array<{ from: string; allow: string[] }>
  }
}

function domainZones(domain: DomainRecord): Zone[] {
  return ROLES.flatMap((role) => {
    const paths = domain.modules
      .filter((module) => module.role === role)
      .map(({ path }) => path)
    const entries = domain.publicEntryPoints.filter((entry) =>
      paths.some((path) => matchesModulePath(entry, path))
    )
    return [
      {
        domain,
        name: `${domain.id}/${role}/public`,
        patterns: entries,
        isPublic: true,
        role
      },
      {
        domain,
        name: `${domain.id}/${role}`,
        patterns: paths,
        isPublic: false,
        role
      }
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
  const zones = records.flatMap(domainZones)
  const ordered = [
    ...zones.filter(({ isPublic }) => isPublic),
    ...zones.filter(({ isPublic }) => !isPublic)
  ]
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
