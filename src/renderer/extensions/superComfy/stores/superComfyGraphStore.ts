import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { useEventListener, watchDebounced } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useAppCatalog } from '@/renderer/extensions/superComfy/apps/appCatalog'
import type { AppCatalogEntry } from '@/renderer/extensions/superComfy/apps/appCatalog'
import { resolveAppContract } from '@/renderer/extensions/superComfy/apps/appContract'
import { createAppExecutor } from '@/renderer/extensions/superComfy/apps/appExecutor'
import { appFailureMessage } from '@/renderer/extensions/superComfy/apps/appSource'
import {
  NODE_WIDTH,
  placeNode
} from '@/renderer/extensions/superComfy/canvas/canvasGeometry'
import { createEngine } from '@/renderer/extensions/superComfy/engine/createEngine'
import { emptyDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  AppNode,
  GenerateNode,
  IoNode,
  Modality,
  NodeId,
  PortRef,
  SessionId,
  SuperGraphDocument,
  SuperNode
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  canConnect,
  findNode
} from '@/renderer/extensions/superComfy/engine/graphTopology'
import {
  initialRuntime,
  reduceSuperComfy
} from '@/renderer/extensions/superComfy/engine/reduce'
import type {
  ConnectOutcome,
  RunSummary,
  SuperComfyEvent,
  SuperComfyState
} from '@/renderer/extensions/superComfy/engine/types'
import { uploadMediaFiles } from '@/renderer/extensions/superComfy/media/superMedia'
import { resolveModelContract } from '@/renderer/extensions/superComfy/router/routerCatalog'
import { createRouterExecutor } from '@/renderer/extensions/superComfy/router/routerExecutor'

import { createSuperGraphSaver, loadSuperGraph } from './superComfyPersistence'
import type { SaveLocation, SuperGraphSaver } from './superComfyPersistence'

export const RUN_LIMIT = 50
const NODES_IN_PARALLEL = 2
const AUTOSAVE_DELAY_MS = 1000
const AUTOSAVE_MAX_WAIT_MS = 5000

function executableFields() {
  return {
    runCount: 1,
    values: {},
    inline: {},
    runs: {},
    result: null
  }
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([entry]) => entry !== key)
  )
}

function isStaleApp(
  node: AppNode,
  entries: readonly AppCatalogEntry[]
): boolean {
  const entry = entries.find(({ path }) => path === node.workflowPath)
  return (
    !node.contract || !entry || entry.lastModified !== node.contract.version
  )
}

export const useSuperComfyGraphStore = defineStore('superComfyGraph', () => {
  const state = shallowRef<SuperComfyState>({
    doc: emptyDocument(),
    runtime: initialRuntime()
  })
  const loadStatus = ref<'idle' | 'loading' | 'ready'>('idle')
  const saveLocation = ref<SaveLocation>('userdata')
  const lastSummary = ref<RunSummary | null>(null)
  const nodeErrors = ref<Record<NodeId, string>>({})
  const uploads = ref<Record<NodeId, number>>({})
  const appCatalog = useAppCatalog()
  let saver: SuperGraphSaver | null = null
  let loading: Promise<void> | null = null

  const isBusy = computed(
    () => Object.keys(state.value.runtime.sessions).length > 0
  )

  function dispatch(event: SuperComfyEvent) {
    state.value = reduceSuperComfy(state.value, event)
  }

  const engine = createEngine({
    getState: () => state.value,
    dispatch,
    executors: {
      generate: createRouterExecutor(),
      app: createAppExecutor()
    },
    newSessionId: () => crypto.randomUUID(),
    now: Date.now,
    limits: { runsPerNode: RUN_LIMIT, nodesInParallel: NODES_IN_PARALLEL }
  })

  let unsaved: SuperGraphDocument | null = null

  watch(
    () => state.value.doc,
    (doc) => {
      unsaved = doc
    },
    { flush: 'sync' }
  )

  watchDebounced(
    () => state.value.doc,
    async (doc) => {
      if (!saver || unsaved !== doc) return
      saveLocation.value = await saver.save(doc)
      if (unsaved === doc) unsaved = null
    },
    { debounce: AUTOSAVE_DELAY_MS, maxWait: AUTOSAVE_MAX_WAIT_MS }
  )

  useEventListener(window, 'pagehide', () => {
    if (saver && unsaved) saver.keepInBrowser(unsaved)
  })

  async function load() {
    loadStatus.value = 'loading'
    const loaded = await loadSuperGraph()
    saver = createSuperGraphSaver(loaded)
    saveLocation.value = loaded.location
    dispatch({ type: 'documentLoaded', doc: loaded.doc })
    unsaved = null
    if (loaded.recovered) useToast().warning(t('superComfy.loadFailed'))
    if (loaded.readFailed) useToast().warning(t('superComfy.loadUnavailable'))
    loadStatus.value = 'ready'
  }

  function ensureLoaded(): Promise<void> {
    loading ??= load()
    return loading
  }

  function setNodeError(nodeId: NodeId, message: string | null) {
    nodeErrors.value =
      message === null
        ? without(nodeErrors.value, nodeId)
        : { ...nodeErrors.value, [nodeId]: message }
  }

  function addNode(node: SuperNode): NodeId {
    const spot = placeNode(
      state.value.doc,
      { x: node.x, y: node.y },
      node.width
    )
    dispatch({ type: 'nodeAdded', node: { ...node, ...spot } })
    return node.id
  }

  function addIoNode(modality: Modality, at: Point): NodeId {
    const node: IoNode = {
      id: crypto.randomUUID(),
      kind: 'io',
      modality,
      items: [],
      x: at.x,
      y: at.y,
      width: NODE_WIDTH.io
    }
    return addNode(node)
  }

  function addGenerateNode(modality: Modality, at: Point): NodeId {
    const node: GenerateNode = {
      ...executableFields(),
      id: crypto.randomUUID(),
      kind: 'generate',
      modality,
      modelId: null,
      modelLabel: null,
      contract: null,
      settingsOpen: true,
      x: at.x,
      y: at.y,
      width: NODE_WIDTH.generate
    }
    return addNode(node)
  }

  async function resolveApp(nodeId: NodeId): Promise<void> {
    const node = findNode(state.value.doc, nodeId)
    if (node?.kind !== 'app') return
    const resolved = await resolveAppContract(node.workflowPath)
    if (!resolved.ok) {
      setNodeError(nodeId, appFailureMessage(resolved))
      return
    }
    setNodeError(nodeId, null)
    dispatch({
      type: 'appContractResolved',
      nodeId,
      workflowPath: node.workflowPath,
      title: resolved.title,
      contract: resolved.contract
    })
  }

  async function refreshApp(nodeId: NodeId): Promise<void> {
    await appCatalog.sync().catch(() => undefined)
    await resolveApp(nodeId)
  }

  async function addAppNode(
    entry: AppCatalogEntry,
    at: Point
  ): Promise<NodeId> {
    const node: AppNode = {
      ...executableFields(),
      id: crypto.randomUUID(),
      kind: 'app',
      workflowPath: entry.path,
      title: entry.title,
      contract: null,
      settingsOpen: false,
      x: at.x,
      y: at.y,
      width: NODE_WIDTH.app
    }
    addNode(node)
    await resolveApp(node.id)
    return node.id
  }

  async function refreshStaleApps(): Promise<void> {
    const listed = await appCatalog.refresh().then(
      () => true,
      () => false
    )
    if (!listed) return
    const entries = appCatalog.apps.value
    const stale = state.value.doc.nodes.filter(
      (node): node is AppNode =>
        node.kind === 'app' && isStaleApp(node, entries)
    )
    await Promise.all(stale.map(({ id }) => resolveApp(id)))
  }

  function removeNodes(ids: readonly NodeId[]) {
    dispatch({ type: 'nodesRemoved', nodeIds: [...ids] })
    nodeErrors.value = Object.fromEntries(
      Object.entries(nodeErrors.value).filter(([id]) => !ids.includes(id))
    )
  }

  function connect(from: PortRef, to: PortRef): ConnectOutcome {
    const outcome = canConnect(state.value.doc, from, to)
    if (outcome.ok) {
      dispatch({ type: 'edgeConnected', id: crypto.randomUUID(), from, to })
    }
    return outcome
  }

  async function pickModel(nodeId: NodeId, modelId: string): Promise<void> {
    const node = findNode(state.value.doc, nodeId)
    if (node?.kind !== 'generate') return
    setNodeError(nodeId, null)
    dispatch({ type: 'modelPicked', nodeId, modelId })
    const resolved = await resolveModelContract(modelId, node.modality)
    const current = findNode(state.value.doc, nodeId)
    if (current?.kind !== 'generate' || current.modelId !== modelId) return
    if (!resolved.ok) {
      setNodeError(nodeId, resolved.message)
      return
    }
    dispatch({
      type: 'modelContractResolved',
      nodeId,
      modelId,
      modelLabel: resolved.label,
      contract: resolved.contract
    })
  }

  function adjustUploads(nodeId: NodeId, delta: number) {
    const count = (uploads.value[nodeId] ?? 0) + delta
    uploads.value =
      count > 0
        ? { ...uploads.value, [nodeId]: count }
        : without(uploads.value, nodeId)
  }

  async function uploadFiles(
    nodeId: NodeId,
    files: readonly File[]
  ): Promise<void> {
    const node = findNode(state.value.doc, nodeId)
    if (node?.kind !== 'io' || files.length === 0) return
    const modality = node.modality
    if (modality === 'text') return
    adjustUploads(nodeId, 1)
    try {
      const outcome = await uploadMediaFiles(files, modality)
      if (outcome.ok) {
        dispatch({
          type: 'itemsAdded',
          nodeId,
          items: outcome.items,
          mode: 'append'
        })
      } else {
        useToast().error(
          t('superComfy.media.uploadFailed', { reason: outcome.reason })
        )
      }
    } finally {
      adjustUploads(nodeId, -1)
    }
  }

  function isUploading(nodeId: NodeId): boolean {
    return (uploads.value[nodeId] ?? 0) > 0
  }

  async function runGraph(): Promise<RunSummary> {
    const summary = await engine.runGraph()
    lastSummary.value = summary
    return summary
  }

  function runNode(nodeId: NodeId): Promise<RunSummary> {
    return engine.runNode(nodeId)
  }

  function stop(sessionId?: SessionId) {
    engine.stop(sessionId)
  }

  return {
    state,
    loadStatus,
    saveLocation,
    lastSummary,
    nodeErrors,
    isBusy,
    ensureLoaded,
    dispatch,
    addIoNode,
    addGenerateNode,
    addAppNode,
    removeNodes,
    connect,
    pickModel,
    refreshApp,
    refreshStaleApps,
    uploadFiles,
    isUploading,
    runGraph,
    runNode,
    stop
  }
})
