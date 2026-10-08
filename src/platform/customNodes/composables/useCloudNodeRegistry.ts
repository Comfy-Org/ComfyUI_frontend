import type {
  CloudNodeRegistry,
  CloudNodeRegistryPinRequest
} from '@comfyorg/ingest-types'
import { zCloudNodeRegistry } from '@comfyorg/ingest-types/zod'
import { computed, shallowRef } from 'vue'

import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { reportError } from '@/platform/telemetry/reportError'

type RegistryFailure =
  | { reason: 'http'; status: number }
  | { reason: 'invalidCatalog' }
  | { reason: 'network' }

type RegistryState =
  | { phase: 'idle'; catalog: null }
  | { phase: 'loading'; catalog: CloudNodeRegistry | null }
  | { phase: 'ready'; catalog: CloudNodeRegistry }
  | { phase: 'saving'; catalog: CloudNodeRegistry; revisionId: string }
  | {
      phase: 'error'
      catalog: CloudNodeRegistry | null
      failure: RegistryFailure
    }

export function useCloudNodeRegistry() {
  const state = shallowRef<RegistryState>({ phase: 'idle', catalog: null })
  const catalog = computed(() => state.value.catalog)
  const busy = computed(
    () => state.value.phase === 'loading' || state.value.phase === 'saving'
  )

  const fail = (
    previous: CloudNodeRegistry | null,
    failure: RegistryFailure,
    cause: unknown = failure
  ) => {
    state.value = { phase: 'error', catalog: previous, failure }
    reportError(cause, { errorType: 'cloud_node_registry_request_failed' })
    return false
  }

  const requestCatalog = async (
    route: string,
    options: RequestInit,
    previous: CloudNodeRegistry | null
  ) => {
    try {
      const response = await api.fetchApi(route, options)
      if (!response.ok) {
        return fail(previous, { reason: 'http', status: response.status })
      }
      const parsed = zCloudNodeRegistry.safeParse(await response.json())
      if (!parsed.success) {
        return fail(previous, { reason: 'invalidCatalog' }, parsed.error)
      }
      if (
        parsed.data.revisions.some((revision) => {
          const receipt = revision.verification
          return (
            Boolean(revision.comfy_verified) !== Boolean(receipt) ||
            (receipt &&
              (revision.node_api_version !== 2 ||
                receipt.revision_id !== revision.revision_id ||
                new Set(receipt.tested_nodes).size !==
                  receipt.tested_nodes.length ||
                receipt.tested_nodes.some(
                  (node) => !revision.nodes.includes(node)
                )))
          )
        })
      ) {
        return fail(previous, { reason: 'invalidCatalog' })
      }
      try {
        await app.reloadNodeDefs()
      } catch (error) {
        return fail(parsed.data, { reason: 'network' }, error)
      }
      state.value = { phase: 'ready', catalog: parsed.data }
      return true
    } catch (error) {
      return fail(previous, { reason: 'network' }, error)
    }
  }

  const load = async () => {
    if (busy.value) return false
    const previous = state.value.catalog
    state.value = { phase: 'loading', catalog: previous }
    return requestCatalog('/customnodes/registry', { method: 'GET' }, previous)
  }

  const setPin = async (revisionId: string, pinned: boolean) => {
    if (state.value.phase !== 'ready') return false
    const previous = state.value.catalog
    const revision = previous.revisions.find(
      (item) => item.revision_id === revisionId
    )
    if (
      pinned &&
      (!revision ||
        revision.node_api_version !== 2 ||
        !revision.upstream_commit)
    ) {
      return false
    }
    const body: CloudNodeRegistryPinRequest = {
      revision_id: revisionId,
      pinned
    }
    state.value = { phase: 'saving', catalog: previous, revisionId }
    return requestCatalog(
      '/customnodes/registry/pins',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      previous
    )
  }

  return { state, catalog, busy, load, setPin }
}
