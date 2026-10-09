import type {
  ListTestWorkflowEntriesData,
  TestWorkflowCollections,
  TestWorkflowFacets,
  TestWorkflowPage
} from '@comfyorg/ingest-types/test-workflows'
import {
  zTestWorkflowCollections,
  zTestWorkflowFacets,
  zTestWorkflowPage
} from '@comfyorg/ingest-types/test-workflows/zod'
import type { ZodType } from 'zod'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { useNodeAccountScope } from '@/platform/customNodes/composables/useNodeAccountScope'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type {
  CommunityWorkflowDetail,
  TestWorkflowGraphVariant
} from '../utils/cloudWorkflowAdaptation'
import {
  getCloudAdaptation,
  verifyCloudWorkflow,
  workflowDigest,
  zCommunityWorkflowDetail
} from '../utils/cloudWorkflowAdaptation'

type Filters = NonNullable<ListTestWorkflowEntriesData['query']>
type Data = {
  collections: TestWorkflowCollections['collections']
  collectionsTruncated: boolean
  page: TestWorkflowPage | null
  facets: TestWorkflowFacets | null
  selected: CommunityWorkflowDetail | null
}
type State =
  | { phase: 'idle' | 'ready' | 'loading'; data: Data }
  | { phase: 'failed'; data: Data; status: number }

const empty = (): Data => ({
  collections: [],
  collectionsTruncated: false,
  page: null,
  facets: null,
  selected: null
})

export function useTestWorkflowLibrary(
  fetchLibrary: typeof api.fetchApi = (route, options) =>
    api.fetchApi(route, options)
) {
  const request = createRequest(fetchLibrary)
  const identity = useNodeAccountScope()
  const state = shallowRef<State>({ phase: 'idle', data: empty() })
  const collection = ref('')
  let active: AbortController | null = null
  let sequence = 0
  let filters: Filters = {}

  function reset() {
    sequence += 1
    active?.abort()
    collection.value = ''
    filters = {}
    state.value = { phase: 'idle', data: empty() }
  }
  watch(identity.scope, reset, { flush: 'sync' })
  onScopeDispose(reset)

  async function command(operation: (signal: AbortSignal) => Promise<Data>) {
    const scope = identity.capture()
    if (scope.scope === null) return false
    active?.abort()
    active = new AbortController()
    const controller = active
    const current = ++sequence
    const data = state.value.data
    state.value = { phase: 'loading', data }
    try {
      const next = await operation(controller.signal)
      if (current !== sequence || !identity.current(scope)) return false
      state.value = { phase: 'ready', data: next }
      return true
    } catch (error) {
      if (current !== sequence || !identity.current(scope)) return false
      state.value = {
        phase: 'failed',
        data,
        status: error instanceof LibraryRequestError ? error.status : 0
      }
      reportError(new Error('Test workflow library request failed'), {
        errorType: 'test_workflow_library_request_failed'
      })
      return false
    }
  }

  function root(id: string) {
    return `/test-workflow-library/collections/${encodeURIComponent(id)}`
  }

  async function initialize() {
    const success = await command(async (signal) => {
      const collections = await request(
        '/test-workflow-library/collections',
        zTestWorkflowCollections,
        signal
      )
      return {
        ...empty(),
        collections: collections.collections,
        collectionsTruncated: collections.truncated
      }
    })
    const [onlyCollection] = state.value.data.collections
    if (success && state.value.data.collections.length === 1)
      return chooseCollection(onlyCollection.id)
    return success
  }

  async function search(nextFilters: Filters = filters, cursor = '') {
    const id = collection.value
    if (!id) return false
    const previous = state.value.data
    const success = await command(async (signal) => {
      const query = new URLSearchParams({ limit: '24' })
      for (const [key, value] of Object.entries(nextFilters)) {
        if (
          value !== undefined &&
          value !== '' &&
          key !== 'limit' &&
          key !== 'cursor'
        )
          query.set(key, String(value))
      }
      if (cursor) query.set('cursor', cursor)
      const page = await request(
        `${root(id)}/entries?${query}`,
        zTestWorkflowPage,
        signal
      )
      const facets =
        previous.facets ??
        (await request(`${root(id)}/facets`, zTestWorkflowFacets, signal))
      return { ...previous, page, facets, selected: null }
    })
    if (success) filters = nextFilters
    return success
  }

  async function chooseCollection(id: string) {
    collection.value = id
    filters = {}
    state.value = {
      phase: 'ready',
      data: { ...state.value.data, page: null, facets: null, selected: null }
    }
    return search({})
  }

  async function select(hash: string) {
    const id = collection.value
    const previous = state.value.data
    return command(async (signal) => {
      const selected = await request(
        `${root(id)}/entries/${encodeURIComponent(hash)}`,
        zCommunityWorkflowDetail,
        signal
      )
      if (
        selected.summary.workflow_sha256 !== hash ||
        selected.metadata.workflow_sha256 !== hash
      )
        throw new LibraryRequestError(0)
      return { ...previous, selected }
    })
  }

  async function open(variant: TestWorkflowGraphVariant = 'original') {
    const hash = state.value.data.selected?.summary.workflow_sha256
    if (!hash) return false
    const id = collection.value
    const previous = state.value.data
    const scope = identity.capture()
    return command(async (signal) => {
      const query =
        variant === 'cloud'
          ? 'include_workflow=true&include_cloud_workflow=true'
          : 'include_workflow=true'
      const record = await request(
        `${root(id)}/entries/${encodeURIComponent(hash)}?${query}`,
        zCommunityWorkflowDetail,
        signal
      )
      if (signal.aborted || !identity.current(scope))
        throw new LibraryRequestError(0)
      if (
        !record.workflow_json ||
        record.summary.workflow_sha256 !== hash ||
        record.metadata.workflow_sha256 !== hash
      )
        throw new LibraryRequestError(0)
      const graph =
        variant === 'cloud'
          ? record.community_cloud_workflow_json
          : record.workflow_json
      if (!graph) throw new LibraryRequestError(0)
      const valid =
        variant === 'cloud'
          ? await verifyCloudWorkflow(record, record.workflow_json, graph)
          : (await workflowDigest(graph)) === hash
      if (!valid || signal.aborted || !identity.current(scope))
        throw new LibraryRequestError(0)
      const suffix =
        variant === 'cloud'
          ? `-cloud-${getCloudAdaptation(record)?.workflow_sha256.slice(0, 12)}`
          : ''
      await app.handleFile(
        new File([graph], `test-workflow-${hash.slice(0, 12)}${suffix}.json`, {
          type: 'application/json'
        })
      )
      return { ...previous, selected: record }
    })
  }

  function closeDetails() {
    state.value = {
      ...state.value,
      data: { ...state.value.data, selected: null }
    }
  }

  return {
    state,
    collection,
    data: computed(() => state.value.data),
    busy: computed(() => state.value.phase === 'loading'),
    initialize,
    chooseCollection,
    search,
    select,
    open,
    closeDetails
  }
}

class LibraryRequestError extends Error {
  constructor(readonly status: number) {
    super('Test workflow library request refused')
  }
}

function createRequest(fetchLibrary: typeof api.fetchApi) {
  return async function request<T>(
    route: string,
    schema: ZodType<T>,
    signal: AbortSignal
  ): Promise<T> {
    const response = await fetchLibrary(route, { signal, cache: 'no-store' })
    if (!response.ok) throw new LibraryRequestError(response.status)
    const result = schema.safeParse(await response.json())
    if (!result.success) throw new LibraryRequestError(0)
    return result.data
  }
}
