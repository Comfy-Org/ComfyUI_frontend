import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'

export type NodePackStatusFilter = 'all' | 'installed' | 'notInstalled'

export type NodePackSort = 'installs' | 'stars' | 'nameAsc' | 'nameDesc'

export const NODE_PACK_STATUS_FILTERS: readonly NodePackStatusFilter[] = [
  'all',
  'installed',
  'notInstalled'
]

export const NODE_PACK_SORTS: readonly NodePackSort[] = [
  'nameAsc',
  'nameDesc',
  'installs',
  'stars'
]

/** The license bucket of a pack that names no license. */
export const UNLISTED_LICENSE = ''

const KNOWN_LICENSES: Partial<Record<string, string>> = {
  mit: 'MIT',
  apache: 'Apache-2.0',
  'apache 2.0': 'Apache-2.0',
  'apache-2.0': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'apache license, version 2.0': 'Apache-2.0',
  'gpl 2.0': 'GPL-2.0',
  'gpl-2.0': 'GPL-2.0',
  'gpl-2.0-only': 'GPL-2.0',
  'gpl-2.0-or-later': 'GPL-2.0',
  gplv2: 'GPL-2.0',
  'gnu general public license v2': 'GPL-2.0',
  'gpl 3.0': 'GPL-3.0',
  'gpl-3.0': 'GPL-3.0',
  'gpl-3.0-only': 'GPL-3.0',
  'gpl-3.0-or-later': 'GPL-3.0',
  gpl3: 'GPL-3.0',
  gplv3: 'GPL-3.0',
  'gnu general public license v3': 'GPL-3.0',
  'gnu general public license v3.0': 'GPL-3.0',
  'lgpl-2.1': 'LGPL-2.1',
  'lgpl-3.0': 'LGPL-3.0',
  'agpl-3.0': 'AGPL-3.0',
  'agpl-3.0-only': 'AGPL-3.0',
  'agpl-3.0-or-later': 'AGPL-3.0',
  'gnu affero general public license v3': 'AGPL-3.0',
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  'mpl-2.0': 'MPL-2.0',
  unlicense: 'Unlicense',
  'cc0-1.0': 'CC0-1.0'
}

/** Folds the registry's license spellings onto one name per license. */
export function normalizeLicense(license: string): string {
  const value = license.trim()
  if (!value || /^(licen[cs]e|copying)(\.\w+)?$/i.test(value))
    return UNLISTED_LICENSE
  const folded = value.toLowerCase().replace(/\s+/g, ' ')
  const stripped = folded.replace(/[\s-]+licen[cs]e$/, '')
  return KNOWN_LICENSES[stripped] ?? KNOWN_LICENSES[folded] ?? value
}

/** Every license a pack in `packs` names, A to Z, with the unlisted bucket last. */
export function licenseOptions(packs: readonly NodePack[]): string[] {
  const licenses = new Set(packs.map((pack) => normalizeLicense(pack.license)))
  const named = [...licenses]
    .filter((license) => license !== UNLISTED_LICENSE)
    .sort((left, right) => left.localeCompare(right))
  return licenses.has(UNLISTED_LICENSE) ? [...named, UNLISTED_LICENSE] : named
}

function searchable(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matchesQuery(pack: NodePack, query: string): boolean {
  const wanted = searchable(query)
  return (
    wanted === '' ||
    searchable(pack.name).includes(wanted) ||
    searchable(pack.id).includes(wanted) ||
    searchable(pack.publisher).includes(wanted)
  )
}

export function matchesLicenses(
  pack: NodePack,
  licenses: ReadonlySet<string>
): boolean {
  return licenses.size === 0 || licenses.has(normalizeLicense(pack.license))
}

export function matchesStatus(
  filter: NodePackStatusFilter,
  { installed }: { installed: boolean }
): boolean {
  if (filter === 'installed') return installed
  if (filter === 'notInstalled') return !installed
  return true
}

const COMPARE: Record<NodePackSort, (a: NodePack, b: NodePack) => number> = {
  installs: (a, b) => b.installs - a.installs,
  stars: (a, b) => b.stars - a.stars,
  nameAsc: (a, b) => a.name.localeCompare(b.name),
  nameDesc: (a, b) => b.name.localeCompare(a.name)
}

export function comparePacks(sort: NodePackSort) {
  return COMPARE[sort]
}
