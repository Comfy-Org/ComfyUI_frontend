import { computed, onMounted, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import { buildCustomNodesService } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import type {
  BuildCustomNode,
  NodePack
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import type {
  NodePackVersionChoice,
  NodePackVersionLabel
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import {
  buildEntryFor,
  buildNodeLabel,
  defaultVersionChoice,
  registryIdOf
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import type {
  NodePackSort,
  NodePackStatusFilter
} from '@/platform/workspace/buildCustomNodes/nodePackTable'
import {
  comparePacks,
  licenseOptions,
  matchesLicenses,
  matchesQuery,
  matchesStatus
} from '@/platform/workspace/buildCustomNodes/nodePackTable'

const NODE_PACK_PAGE_SIZE = 25

export type NodePackRow =
  | {
      kind: 'inBuild'
      key: string
      pack: NodePack
      label: NodePackVersionLabel
      listed: boolean
    }
  | {
      kind: 'pickable'
      key: string
      pack: NodePack
      choice: NodePackVersionChoice
      picked: boolean
    }
  | { kind: 'unavailable'; key: string; pack: NodePack }

export type NodePackSearchStatus = 'loading' | 'ready' | 'failed'

export interface NodePackView {
  query: string
  status: NodePackStatusFilter
  licenses: ReadonlySet<string>
  sort: NodePackSort
}

function packOfEntry(entry: BuildCustomNode): NodePack {
  return {
    id: registryIdOf(entry) ?? entry.name,
    name: entry.name,
    publisher: '',
    installs: 0,
    stars: 0,
    license: '',
    repository: 'repository' in entry ? entry.repository : undefined
  }
}

function rowOf(
  pack: NodePack,
  session: BuildSession,
  listed: boolean
): NodePackRow {
  const entry = buildEntryFor(pack, session.build.build.custom_nodes)
  if (entry)
    return {
      kind: 'inBuild',
      key: `build:${pack.id}`,
      pack,
      label: buildNodeLabel(entry),
      listed
    }
  const pick = session.picks.find((picked) => picked.pack.id === pack.id)
  const choice = pick?.choice ?? defaultVersionChoice(pack)
  if (!choice) return { kind: 'unavailable', key: pack.id, pack }
  return { kind: 'pickable', key: pack.id, pack, choice, picked: !!pick }
}

function isInstalled(row: NodePackRow): boolean {
  return row.kind === 'inBuild' || (row.kind === 'pickable' && row.picked)
}

function buildPacksMissingFrom(
  index: readonly NodePack[],
  session: BuildSession
): NodePack[] {
  return session.build.build.custom_nodes
    .filter(
      (entry) =>
        !index.some((pack) => buildEntryFor(pack, [entry]) !== undefined)
    )
    .map(packOfEntry)
}

/**
 * The picker's table over the whole Comfy Registry index: searched, filtered
 * and sorted in the browser like the platform wizard, with the Build's own
 * packs first.
 */
export function useNodePackRows(
  session: () => BuildSession,
  view: () => NodePackView,
  page: Ref<number>
) {
  const index = shallowRef<NodePack[]>([])
  const status = ref<NodePackSearchStatus>('loading')

  async function loadIndex() {
    status.value = 'loading'
    const outcome = await buildCustomNodesService.listNodePacks()
    if (!outcome.ok) {
      status.value = 'failed'
      return
    }
    index.value = outcome.value
    status.value = 'ready'
  }

  onMounted(loadIndex)

  const licenses = computed(() => licenseOptions(index.value))

  const matchingRows = computed<NodePackRow[]>(() => {
    const current = session()
    const { query, status: statusFilter, licenses: picked, sort } = view()
    const unlisted = buildPacksMissingFrom(index.value, current)
    const packs = [...unlisted, ...index.value]
      .filter(
        (pack) => matchesQuery(pack, query) && matchesLicenses(pack, picked)
      )
      .sort(comparePacks(sort))
    const rows = packs
      .map((pack) => rowOf(pack, current, !unlisted.includes(pack)))
      .filter((row) =>
        matchesStatus(statusFilter, { installed: isInstalled(row) })
      )
    return [
      ...rows.filter((row) => row.kind === 'inBuild'),
      ...rows.filter((row) => row.kind !== 'inBuild')
    ]
  })

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(matchingRows.value.length / NODE_PACK_PAGE_SIZE))
  )

  const rows = computed(() =>
    matchingRows.value.slice(
      page.value * NODE_PACK_PAGE_SIZE,
      (page.value + 1) * NODE_PACK_PAGE_SIZE
    )
  )

  return { rows, status, pageCount, licenses, retry: loadIndex }
}
