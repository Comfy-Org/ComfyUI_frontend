import { computed, onMounted, ref, shallowRef, watch } from 'vue'
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

export type NodePackRow =
  | {
      kind: 'inBuild'
      key: string
      name: string
      pack: NodePack | null
      label: NodePackVersionLabel
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

function inBuildRow(
  entry: BuildCustomNode,
  pack: NodePack | null
): NodePackRow {
  return {
    kind: 'inBuild',
    key: `build:${registryIdOf(entry) ?? entry.name}`,
    name: pack?.name ?? entry.name,
    pack,
    label: buildNodeLabel(entry)
  }
}

function packRow(pack: NodePack, session: BuildSession): NodePackRow {
  const pick = session.picks.find((picked) => picked.pack.id === pack.id)
  const choice = pick?.choice ?? defaultVersionChoice(pack)
  if (!choice) return { kind: 'unavailable', key: pack.id, pack }
  return { kind: 'pickable', key: pack.id, pack, choice, picked: !!pick }
}

/**
 * The picker's rows: the Build's own packs first on an empty first page, then
 * the Comfy Registry's matches for `query`.
 */
export function useNodePackRows(
  session: () => BuildSession,
  query: Ref<string>,
  page: Ref<number>
) {
  const results = shallowRef<NodePack[]>([])
  const hasMore = ref(false)
  const status = ref<NodePackSearchStatus>('loading')
  const buildPacks = shallowRef<NodePack[]>([])
  let latestRequest = 0

  async function fetchPage() {
    const request = ++latestRequest
    status.value = 'loading'
    const outcome = await buildCustomNodesService.searchNodePacks(
      query.value,
      page.value
    )
    if (request !== latestRequest) return
    if (!outcome.ok) {
      status.value = 'failed'
      return
    }
    results.value = outcome.value.packs
    hasMore.value = outcome.value.hasMore
    status.value = 'ready'
  }

  async function fetchBuildPacks() {
    const ids = session().build.build.custom_nodes.flatMap(
      (entry) => registryIdOf(entry) ?? []
    )
    buildPacks.value = await buildCustomNodesService.getNodePacks(ids)
  }

  watch([query, page], fetchPage, { immediate: true })
  onMounted(fetchBuildPacks)

  const showsBuildFirst = computed(() => query.value === '' && page.value === 0)

  const rows = computed<NodePackRow[]>(() => {
    const current = session()
    const entries = current.build.build.custom_nodes
    const leading = showsBuildFirst.value
      ? entries.map((entry) =>
          inBuildRow(
            entry,
            buildPacks.value.find((pack) => pack.id === registryIdOf(entry)) ??
              null
          )
        )
      : []
    const listed = results.value.flatMap((pack) => {
      const entry = buildEntryFor(pack, entries)
      if (!entry) return [packRow(pack, current)]
      return showsBuildFirst.value ? [] : [inBuildRow(entry, pack)]
    })
    return [...leading, ...listed]
  })

  return { rows, status, hasMore, retry: fetchPage }
}
