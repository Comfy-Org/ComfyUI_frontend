import { computed, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { getPackUpdateStatus } from '@/platform/customNodes/manager/composables/nodePack/packUpdateStatus'

type NodePack = components['schemas']['Node']
type NodeVersion = components['schemas']['NodeVersion']
type LookupState =
  | { status: 'loading' }
  | {
      status: 'ready' | 'error'
      versions: Map<string, NodeVersion | undefined>
    }

export function usePackUpdateStatuses(packs: MaybeRefOrGetter<NodePack[]>) {
  const manager = useComfyManagerStore()
  const registry = useComfyRegistryStore()
  const state = shallowRef<LookupState>({
    status: 'ready',
    versions: new Map()
  })
  const unresolvedPacks = computed(() =>
    toValue(packs).filter((pack) => {
      const status = getPackUpdateStatus(pack, manager)
      return (
        pack.id &&
        status.isInstalled &&
        !status.isNightly &&
        pack.latest_version &&
        pack.latest_version.status !== 'NodeVersionStatusActive'
      )
    })
  )

  watch(
    unresolvedPacks,
    async (candidates, _, onCleanup) => {
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      if (!candidates.length) {
        state.value = { status: 'ready', versions: new Map() }
        return
      }
      state.value = { status: 'loading' }
      const versions = new Map<string, NodeVersion | undefined>()
      const results = await Promise.all(
        candidates.map(async (pack) => {
          if (!pack.id) return true
          const params = {
            id: pack.id,
            advertisedVersion: pack.latest_version?.version,
            advertisedStatus: pack.latest_version?.status
          }
          const releases = await registry.getActivePackVersions.call(params)
          if (releases === null) {
            registry.getActivePackVersions.evict(params)
            return false
          }
          versions.set(pack.id, releases[0])
          return true
        })
      )
      if (!controller.signal.aborted) {
        state.value = {
          status: results.every(Boolean) ? 'ready' : 'error',
          versions
        }
      }
    },
    { immediate: true }
  )

  return {
    getStatus: (pack: NodePack) =>
      getPackUpdateStatus(
        pack,
        manager,
        pack.latest_version?.status === 'NodeVersionStatusActive'
          ? pack.latest_version
          : state.value.status === 'loading'
            ? undefined
            : state.value.versions.get(pack.id ?? '')
      ),
    isLoading: computed(() => state.value.status === 'loading'),
    hasError: computed(() => state.value.status === 'error')
  }
}
