import { contains, modulesBySpecificity } from './records'
import type { Claim } from './records'
import type { DomainRecord } from './schema'

export const BOUNDARIES_PATH = 'docs/architecture/domains/boundaries.json'
const UNCLASSIFIED = 'unclassified'
const INVENTORY = '_inventory'

interface Zone {
  domain: DomainRecord
  name: string
  patterns: string[]
  isPublic: boolean
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

function moduleLayers(records: DomainRecord[]): LayeredModule[] {
  const layered: LayeredModule[] = []
  for (const outer of modulesBySpecificity(records)) {
    const layer = Math.max(
      0,
      ...layered
        .filter((inner) => contains(outer.module.path, inner.module.path))
        .map((inner) => inner.layer + Number(inner.record !== outer.record))
    )
    layered.push({ ...outer, layer })
  }
  return layered
}

function domainZones(domain: DomainRecord, layered: LayeredModule[]): Zone[] {
  const own = layered.filter(({ record }) => record === domain)
  const prefix = domain.deepImports === 'inventory' ? INVENTORY : domain.id
  return [
    {
      domain,
      name: `${domain.id}/public`,
      patterns: domain.publicEntryPoints,
      isPublic: true,
      layer: -1
    },
    ...[...new Set(own.map(({ layer }) => layer))].map((layer) => ({
      domain,
      name: layer ? `${prefix}/outer-${layer}` : prefix,
      patterns: domain.modules
        .filter((module) =>
          own.some((inner) => inner.module === module && inner.layer === layer)
        )
        .map(({ path }) => path),
      isPublic: false,
      layer
    }))
  ].filter(({ patterns }) => patterns.length)
}

function reachableFromOutside(zone: Zone): boolean {
  return zone.isPublic || zone.domain.deepImports === 'inventory'
}

function allowedTargets(source: Zone, zones: Zone[]): string[] {
  return zones
    .filter(
      (target) =>
        target.domain === source.domain || reachableFromOutside(target)
    )
    .map(({ name }) => name)
}

export function buildBoundaries(records: DomainRecord[]): FallowBoundaries {
  const layered = moduleLayers(records)
  const zones = records.flatMap((record) => domainZones(record, layered))
  const ordered = zones
    .filter(
      (zone, index) =>
        zones.findIndex(({ name }) => name === zone.name) === index
    )
    .map((zone) => ({
      ...zone,
      patterns: zones
        .filter(({ name }) => name === zone.name)
        .flatMap(({ patterns }) => patterns)
    }))
    .toSorted((a, b) => a.layer - b.layer)
  return {
    boundaries: {
      zones: [
        ...ordered.map(({ name, patterns }) => ({ name, patterns })),
        {
          name: UNCLASSIFIED,
          patterns: ['src/**', 'packages/*/src/**', 'tools/*/src/**']
        }
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
