import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef, toRaw, watch } from 'vue'

import { useNodeAccountScope } from '@/platform/customNodes/composables/useNodeAccountScope'
import { useCloudNodeRegistry } from '@/platform/customNodes/composables/useCloudNodeRegistry'
import { flattenWorkflowNodes } from '@/platform/workflow/core/utils/workflowFlattening'
import {
  currentCompletedWorkflowDocumentId,
  onWorkflowWarningsReady
} from '@/platform/workflow/core/utils/workflowLoadEvents'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  applyPublicationNodeTypes,
  completionExecutionFromVerifiedReport,
  publicationFromVerifiedReport,
  selectedPublisherRevision
} from '../utils/selectedPublisherRevision'
import type {
  CompletionExecutionMode,
  InstalledPublication
} from '../utils/selectedPublisherRevision'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { createMagicPatchClient } from '../services/magicPatchClient'
import { createMagicPatchConversion } from '../utils/magicPatchConversion'
import type { ConversionState } from '../utils/magicPatchConversion'
import {
  workflowPackBindings,
  workflowPackCandidates
} from '../utils/workflowPackCandidates'
import type { WorkflowPackBinding } from '../utils/workflowPackCandidates'
import {
  remainingPackErrors,
  remappedPackNodes
} from '../utils/resolvedPackErrors'
import type { RemappedPackNode } from '../utils/resolvedPackErrors'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import { missingPackCandidates } from '../utils/missingPackCandidates'
import { unresolvedWorkflowPacks } from '../utils/unresolvedWorkflowPacks'
import type { UnresolvedWorkflowPack } from '../utils/unresolvedWorkflowPacks'
import { createWorkflowSourcePreparation } from '../utils/workflowSourcePreparation'
import type { WorkflowSourceState } from '../utils/workflowSourcePreparation'

export type PackConversion = {
  revision: CloudNodeRegistryRevision
  state: ConversionState
  report?: unknown
  executionMode?: CompletionExecutionMode
  observedAt?: number
}
export type WorkflowSourceJob = {
  pack: UnresolvedWorkflowPack
} & WorkflowSourceState

export const useMagicPatchBatchStore = defineStore('magicPatchBatch', () => {
  const identity = useNodeAccountScope()
  const workflow = useWorkflowStore()
  const registry = useCloudNodeRegistry()
  const missing = useMissingNodesErrorStore()
  const definitions = useNodeDefStore()
  const candidates = shallowRef<CloudNodeRegistryRevision[]>([])
  const pendingSourcePacks = shallowRef<UnresolvedWorkflowPack[]>([])
  const originalGraph = shallowRef<ComfyWorkflowJSON>()
  const originalBindings = shallowRef<WorkflowPackBinding[]>([])
  const jobs = shallowRef<PackConversion[]>([])
  const sourceJobs = shallowRef<WorkflowSourceJob[]>([])
  const consentOpen = ref(false)
  const resolvingPack = ref(false)
  const submitting = ref(false)
  const reloading = ref(false)
  const verifying = ref(false)
  const verifiedPacks = shallowRef(
    new Map<string, { key: string; publication: InstalledPublication }>()
  )
  const latestGraph = shallowRef<ComfyWorkflowJSON>()
  const graphChanged = () => {
    if (jobs.value.length && app.isGraphReady)
      latestGraph.value = app.rootGraph.serialize() as ComfyWorkflowJSON
  }
  api.addEventListener('graphChanged', graphChanged)
  onScopeDispose(() => api.removeEventListener('graphChanged', graphChanged))
  const verifiedCompletion = computed(() => {
    const key = completionKey.value
    if (
      !key ||
      installedRevisionIds.value.length !==
        jobs.value.filter((job) => requestKey(job)).length
    )
      return
    return {
      key,
      publications: installedRevisionIds.value.flatMap(
        (id) => verifiedPacks.value.get(id)?.publication ?? []
      )
    }
  })
  const acknowledged = ref(false)
  const actionFailed = ref(false)
  const completionReason = ref<string | undefined>()
  const completionAnnounced = ref(false)
  let owner = identity.capture()
  let document = toRaw(workflow.activeWorkflow)
  let documentId = currentCompletedWorkflowDocumentId()
  let offeredDocument: string | undefined
  let discovery:
    | {
        owner: ReturnType<typeof identity.capture>
        workflow: NonNullable<typeof workflow.activeWorkflow>
        documentId: string
      }
    | undefined
  let completionAttempted: string | undefined
  let epoch = 0
  let current = () => false
  let client: ReturnType<typeof createMagicPatchClient> | undefined
  const controllers = new Map<
    string,
    ReturnType<typeof createMagicPatchConversion>
  >()
  const sourceControllers = new Map<
    string,
    ReturnType<typeof createWorkflowSourcePreparation>
  >()
  const completedRequests = computed(
    () =>
      jobs.value.length > 0 &&
      sourceJobs.value.every((job) => job.phase === 'error') &&
      jobs.value.some((job) => requestKey(job)) &&
      jobs.value.every(
        (job) =>
          requestKey(job) ||
          job.state.phase === 'error' ||
          (job.state.phase === 'active' &&
            ['failed', 'withdrawn'].includes(job.state.request.state))
      )
  )
  function requestKey(job: PackConversion) {
    const { state } = job
    return state.phase === 'active' &&
      state.request.state === 'ready' &&
      typeof state.request.report_sha256 === 'string' &&
      /^[a-f0-9]{64}$/u.test(state.request.report_sha256) &&
      !state.disconnected
      ? `${state.request.id}:${state.request.status_version}:${state.request.report_sha256}`
      : undefined
  }
  const readyRequestsKey = computed(() =>
    jobs.value.flatMap((job) => requestKey(job) ?? []).join('|')
  )
  const installedRevisionIds = computed(() =>
    jobs.value.flatMap((job) => {
      const key = requestKey(job)
      const verified = verifiedPacks.value.get(job.revision.revision_id)
      const target =
        verified &&
        registry.catalog.value &&
        selectedPublisherRevision(verified.publication, registry.catalog.value)
      return key &&
        verified?.key === key &&
        target?.pinned &&
        registry.catalog.value?.pins.includes(target.revision_id) &&
        definitionsInstalled(target)
        ? [job.revision.revision_id]
        : []
    })
  )
  const pendingNodeErrors = computed(() => {
    const errors = missing.missingNodesError?.nodeTypes ?? []
    if (
      !installedRevisionIds.value.length ||
      !app.isGraphReady ||
      !current() ||
      toRaw(workflow.activeWorkflow) !== document ||
      currentCompletedWorkflowDocumentId() !== documentId
    )
      return errors
    const publications = installedRevisionIds.value.flatMap(
      (id) => verifiedPacks.value.get(id)?.publication ?? []
    )
    return remainingPackErrors(
      errors,
      latestGraph.value ?? (app.rootGraph.serialize() as ComfyWorkflowJSON),
      publications,
      originalGraph.value,
      originalBindings.value
    )
  })
  const settled = computed(
    () =>
      (jobs.value.length > 0 || sourceJobs.value.length > 0) &&
      sourceJobs.value.every((job) => job.phase === 'error') &&
      jobs.value.every(
        ({ state }) =>
          state.phase === 'error' ||
          (state.phase === 'active' &&
            ['ready', 'failed', 'withdrawn'].includes(state.request.state))
      )
  )
  const completionKey = computed(() =>
    completedRequests.value
      ? jobs.value.flatMap((job) => requestKey(job) ?? []).join('|')
      : undefined
  )
  const ready = computed(
    () =>
      Boolean(completionKey.value) &&
      verifiedCompletion.value?.key === completionKey.value &&
      installedRevisionIds.value.length > 0
  )
  function dismissFinished() {
    if (settled.value && !ready.value && !installedRevisionIds.value.length)
      reset()
  }
  const visible = computed(
    () =>
      (jobs.value.length > 0 || sourceJobs.value.length > 0) &&
      !acknowledged.value
  )

  function reset() {
    epoch++
    controllers.forEach((controller) => controller.dispose())
    controllers.clear()
    sourceControllers.forEach((controller) => controller.dispose())
    sourceControllers.clear()
    candidates.value = []
    pendingSourcePacks.value = []
    originalGraph.value = undefined
    originalBindings.value = []
    jobs.value = []
    sourceJobs.value = []
    consentOpen.value = false
    submitting.value = false
    reloading.value = false
    verifying.value = false
    verifiedPacks.value = new Map()
    latestGraph.value = undefined
    acknowledged.value = false
    actionFailed.value = false
    completionReason.value = undefined
    completionAnnounced.value = false
    completionAttempted = undefined
    client = undefined
  }
  onScopeDispose(reset)
  watch(
    identity.scope,
    () => {
      discovery = undefined
      offeredDocument = undefined
      reset()
    },
    { flush: 'sync' }
  )
  onScopeDispose(
    onWorkflowWarningsReady(() => {
      if (
        consentOpen.value &&
        currentCompletedWorkflowDocumentId() !== documentId
      ) {
        consentOpen.value = false
        candidates.value = []
        pendingSourcePacks.value = []
      }
      const completedDocument = currentCompletedWorkflowDocumentId()
      const activeWorkflow = toRaw(workflow.activeWorkflow)
      if (
        !completedDocument ||
        !activeWorkflow ||
        visible.value ||
        offeredDocument === completedDocument
      )
        return
      discovery = {
        owner: identity.capture(),
        workflow: activeWorkflow,
        documentId: completedDocument
      }
      discoverWorkflowPacks()
      void registry.load()
    })
  )
  watch(registry.catalog, discoverWorkflowPacks)
  watch(
    [readyRequestsKey, verifying],
    ([key, loading]) => {
      if (
        key &&
        key !== completionAttempted &&
        !loading &&
        !acknowledged.value
      ) {
        completionAttempted = key
        void verifyCompletion()
      }
    },
    { flush: 'post' }
  )

  function discoverWorkflowPacks() {
    if (
      !discovery ||
      !registry.catalog.value ||
      !identity.current(discovery.owner) ||
      discovery.workflow !== toRaw(workflow.activeWorkflow) ||
      discovery.documentId !== currentCompletedWorkflowDocumentId() ||
      offeredDocument === discovery.documentId ||
      visible.value ||
      consentOpen.value
    )
      return
    const nodes = flattenWorkflowNodes(app.rootGraph.serialize())
    const revisions = nodes.flatMap((node) =>
      workflowPackCandidates(node, registry.catalog.value?.revisions ?? [])
    )
    offer(
      revisions,
      unresolvedWorkflowPacks(
        app.rootGraph.serialize(),
        missing.missingNodesError?.nodeTypes ?? [],
        registry.catalog.value?.revisions ?? []
      )
    )
  }

  function offer(
    revisions: CloudNodeRegistryRevision[],
    unresolved: UnresolvedWorkflowPack[] = []
  ) {
    if (
      visible.value ||
      !identity.current(identity.capture()) ||
      !currentCompletedWorkflowDocumentId() ||
      !workflow.activeWorkflow
    )
      return
    const eligible = [
      ...new Map(
        revisions
          .filter(
            (revision) =>
              revision.node_api_version === 1 && revision.upstream_commit
          )
          .map((revision) => [revision.revision_id, revision])
      ).values()
    ]
    if (!eligible.length && !unresolved.length) return
    if (jobs.value.length) reset()
    owner = identity.capture()
    document = toRaw(workflow.activeWorkflow)
    documentId = currentCompletedWorkflowDocumentId()
    offeredDocument = documentId
    originalGraph.value = structuredClone(
      app.rootGraph.serialize()
    ) as ComfyWorkflowJSON
    originalBindings.value = workflowPackBindings(
      originalGraph.value,
      registry.catalog.value?.revisions ?? eligible
    )
    candidates.value = eligible
    pendingSourcePacks.value = unresolved
    consentOpen.value = true
  }
  function convertedMissingPack(group: MissingPackGroup) {
    if (!app.isGraphReady) return []
    return missingPackCandidates(
      app.rootGraph,
      [group],
      registry.catalog.value?.revisions ?? [],
      2
    )
  }
  async function offerMissingPack(group: MissingPackGroup) {
    if (resolvingPack.value || visible.value || !app.isGraphReady) return
    const capturedOwner = identity.capture()
    const capturedDocument = currentCompletedWorkflowDocumentId()
    const capturedWorkflow = toRaw(workflow.activeWorkflow)
    if (
      !identity.current(capturedOwner) ||
      !capturedDocument ||
      !capturedWorkflow
    )
      return
    resolvingPack.value = true
    try {
      if (!registry.catalog.value && !(await registry.load()))
        return 'registry_unavailable'
      if (
        !identity.current(capturedOwner) ||
        capturedDocument !== currentCompletedWorkflowDocumentId() ||
        capturedWorkflow !== toRaw(workflow.activeWorkflow)
      )
        return
      if (convertedMissingPack(group).length) return 'already_converted'
      const revisions = missingPackCandidates(
        app.rootGraph,
        [group],
        registry.catalog.value?.revisions ?? []
      )
      const unresolved = unresolvedWorkflowPacks(
        app.rootGraph.serialize(),
        group.nodeTypes,
        registry.catalog.value?.revisions ?? []
      )
      if (!revisions.length && !unresolved.length)
        return 'registry_source_not_found'
      offer(revisions, unresolved)
    } finally {
      resolvingPack.value = false
    }
  }
  function dismissConsent() {
    consentOpen.value = false
  }
  async function startConversion(
    revision: CloudNodeRegistryRevision,
    batchClient: ReturnType<typeof createMagicPatchClient>,
    batchCurrent: () => boolean,
    expectedSourceRef?: string
  ) {
    if (!batchCurrent() || controllers.has(revision.revision_id)) return
    if (
      !jobs.value.some(
        (job) => job.revision.revision_id === revision.revision_id
      )
    )
      jobs.value = [...jobs.value, { revision, state: { phase: 'idle' } }]
    const controller = createMagicPatchConversion(
      batchClient,
      (state) => {
        if (!batchCurrent()) return
        jobs.value = jobs.value.map((job) =>
          job.revision.revision_id === revision.revision_id
            ? {
                ...job,
                state,
                observedAt:
                  job.observedAt ??
                  (state.phase === 'active' ? Date.now() : undefined)
              }
            : job
        )
      },
      batchCurrent
    )
    controllers.set(revision.revision_id, controller)
    const selected = jobs.value.map((job) => job.revision)
    const hints = flattenWorkflowNodes(
      originalGraph.value ?? { nodes: [] }
    ).flatMap((node) => {
      const version = node.properties?.ver
      return workflowPackCandidates(node, selected).some(
        (candidate) => candidate.revision_id === revision.revision_id
      ) &&
        typeof version === 'string' &&
        version.length > 0 &&
        !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(version)
        ? [{ type: node.type, version }]
        : []
    })
    await controller.start(
      { pack_id: revision.pack_id, revision_id: revision.revision_id },
      hints,
      expectedSourceRef
    )
  }

  async function confirm() {
    if (
      !consentOpen.value ||
      submitting.value ||
      !identity.current(owner) ||
      toRaw(workflow.activeWorkflow) !== document ||
      currentCompletedWorkflowDocumentId() !== documentId
    )
      return
    const selected = candidates.value
    const unresolved = pendingSourcePacks.value
    const original = originalGraph.value
    const bindings = originalBindings.value
    reset()
    originalGraph.value = original
    originalBindings.value = bindings
    const batchEpoch = epoch
    const batchOwner = owner
    const batchCurrent = () =>
      batchEpoch === epoch && identity.current(batchOwner)
    current = batchCurrent
    const batchClient = createMagicPatchClient(
      (...args) => api.fetchApi(...args),
      batchCurrent,
      identity
    )
    client = batchClient
    jobs.value = selected.map((revision) => ({
      revision,
      state: { phase: 'idle' }
    }))
    sourceJobs.value = unresolved.map((pack) => ({ pack, phase: 'resolving' }))
    submitting.value = true
    try {
      for (const pack of unresolved) {
        if (!batchCurrent()) return
        const controller = createWorkflowSourcePreparation(
          batchClient,
          batchCurrent,
          (state) => {
            if (!batchCurrent()) return
            sourceJobs.value =
              state.phase === 'resolved'
                ? sourceJobs.value.filter((job) => job.pack.key !== pack.key)
                : sourceJobs.value.map((job) =>
                    job.pack.key === pack.key ? { pack, ...state } : job
                  )
          },
          async (source, sourceRef) => {
            if (!batchCurrent() || !(await registry.load()) || !batchCurrent())
              return false
            const matches =
              registry.catalog.value?.revisions.filter(
                (revision) =>
                  revision.pack_id === source.pack_id &&
                  [source.revision_id, source.registry_revision_id].includes(
                    revision.revision_id
                  ) &&
                  revision.upstream_commit === source.upstream_commit &&
                  revision.node_api_version === 1 &&
                  pack.nodeTypes.every((type) => revision.nodes.includes(type))
              ) ?? []
            if (matches.length !== 1 || !originalGraph.value) return false
            const revision = matches[0]!
            originalBindings.value = workflowPackBindings(
              originalGraph.value,
              registry.catalog.value?.revisions ?? [revision]
            )
            await startConversion(
              revision,
              batchClient,
              batchCurrent,
              sourceRef
            )
            return batchCurrent()
          }
        )
        sourceControllers.set(pack.key, controller)
        await controller.start(pack)
      }
      for (const revision of selected) {
        if (!batchCurrent()) return
        await startConversion(revision, batchClient, batchCurrent)
      }
    } finally {
      if (batchCurrent()) submitting.value = false
    }
  }
  async function refresh() {
    const batchCurrent = current
    for (const controller of [...sourceControllers.values()]) {
      if (!batchCurrent()) return
      await controller.refresh()
    }
    for (const job of jobs.value) {
      if (!batchCurrent()) return
      if (
        job.state.phase === 'preparing' ||
        (job.state.phase === 'active' &&
          ['waiting_conversion', 'waiting_install', 'ready'].includes(
            job.state.request.state
          ))
      )
        await controllers.get(job.revision.revision_id)?.refresh()
    }
    if (batchCurrent()) await verifyCompletion()
  }
  function retry(id: string) {
    return controllers.get(id)?.retry()
  }
  function cancel(id: string) {
    return controllers.get(id)?.cancel()
  }
  async function readReport(id: string) {
    const job = jobs.value.find((item) => item.revision.revision_id === id)
    if (
      !client ||
      job?.state.phase !== 'active' ||
      !job.state.request.report_sha256
    )
      return
    const batchCurrent = current
    const digest = job.state.request.report_sha256
    const result = await client.report(
      job.state.request.id,
      job.state.request.report_sha256
    )
    if (!batchCurrent()) return
    if (result.ok)
      jobs.value = jobs.value.map((item) =>
        item.revision.revision_id === id &&
        item.state.phase === 'active' &&
        item.state.request.report_sha256 === digest
          ? { ...item, report: result.value }
          : item
      )
    else actionFailed.value = true
  }
  function fail(code: string, cause: unknown = code) {
    actionFailed.value = true
    completionReason.value = code
    reportError(cause, {
      errorType: 'magic_patch_reload_failed',
      tags: { code }
    })
    return false
  }
  function definitionsInstalled(revision: CloudNodeRegistryRevision) {
    return revision.nodes.every((name) => {
      const definition = definitions.nodeDefsByName[name]
      return Boolean(
        definition?.python_module &&
        definition.python_module !== 'custom_nodes.frontend_only' &&
        definition.comfy_cloud_revision_id === revision.revision_id &&
        definition.comfy_cloud_pack_id === revision.pack_id &&
        definition.comfy_cloud_prepared === true
      )
    })
  }
  async function verifyCompletion(force = false) {
    const pending = jobs.value.filter((job) => {
      const key = requestKey(job)
      return (
        key &&
        (force ||
          !installedRevisionIds.value.includes(job.revision.revision_id))
      )
    })
    if (!pending.length) return ready.value
    if (verifying.value || !current()) return false
    const batchCurrent = current
    const reject = (code: string, cause?: unknown) =>
      batchCurrent() ? fail(code, cause ?? code) : false
    verifying.value = true
    actionFailed.value = false
    completionReason.value = undefined
    try {
      if (!(await registry.load()) || !batchCurrent())
        return reject('registry_unavailable')
      for (const job of pending) {
        if (!batchCurrent()) return false
        if (job.state.phase !== 'active' || !registry.catalog.value)
          return false
        const key = requestKey(job)
        const sameRequest = () =>
          batchCurrent() &&
          jobs.value.some(
            (currentJob) =>
              currentJob.revision.revision_id === job.revision.revision_id &&
              requestKey(currentJob) === key
          )
        const verified = new Map(verifiedPacks.value)
        verified.delete(job.revision.revision_id)
        verifiedPacks.value = verified
        try {
          const digest = job.state.request.report_sha256
          if (!digest || !client) {
            reject('publication_report_unavailable')
            continue
          }
          const report = await client.report(job.state.request.id, digest)
          if (!sameRequest()) continue
          if (!report.ok) {
            reject('publication_report_unverified', report.error.code)
            continue
          }
          const executionMode = completionExecutionFromVerifiedReport(
            report.value,
            job.state.request
          )
          if (!executionMode) {
            reject('completion_execution_unverified')
            continue
          }
          const publication = publicationFromVerifiedReport(
            report.value,
            job.state.request,
            job.revision
          )
          if (!publication) {
            reject('publication_association_unavailable')
            continue
          }
          const target = selectedPublisherRevision(
            publication,
            registry.catalog.value
          )
          if (!target) {
            reject('release_unavailable')
            continue
          }
          const revisionId = target.revision_id
          if (
            !target.pinned &&
            !(await registry.setPin(revisionId, true, false))
          ) {
            reject('pin_failed')
            continue
          }
          if (!sameRequest()) continue
          const confirmed =
            registry.catalog.value &&
            selectedPublisherRevision(publication, registry.catalog.value)
          if (
            !confirmed?.pinned ||
            !registry.catalog.value?.pins.includes(revisionId)
          ) {
            reject('pin_unconfirmed')
            continue
          }
          await app.reloadNodeDefs()
          if (!sameRequest()) continue
          if (!definitionsInstalled(confirmed)) {
            reject('definitions_unavailable')
            continue
          }
          if (!key) continue
          verifiedPacks.value = new Map(verifiedPacks.value).set(
            job.revision.revision_id,
            { key, publication }
          )
          jobs.value = jobs.value.map((job) => ({
            ...job,
            ...(job.revision.revision_id === publication.sourceRevisionId
              ? { executionMode }
              : {})
          }))
        } catch (cause) {
          reject('unexpected', cause)
        }
      }
      return ready.value
    } catch (cause) {
      return reject('unexpected', cause)
    } finally {
      if (batchCurrent()) verifying.value = false
    }
  }
  async function acknowledge() {
    if (!ready.value || acknowledged.value || reloading.value || !current())
      return false
    const batchCurrent = current
    const completion = completionKey.value
    const sameDocument = () =>
      batchCurrent() &&
      ready.value &&
      completionKey.value === completion &&
      toRaw(workflow.activeWorkflow) === document &&
      Boolean(documentId) &&
      currentCompletedWorkflowDocumentId() === documentId
    const reject = (code: string, cause?: unknown) =>
      batchCurrent() ? fail(code, cause ?? code) : false
    reloading.value = true
    actionFailed.value = false
    completionReason.value = undefined
    try {
      if (!sameDocument()) return reject('workflow_changed')
      if (!(await verifyCompletion(true)) || !sameDocument()) return false
      const publications = verifiedCompletion.value?.publications
      if (!publications) return false
      let targets = new Map<string, RemappedPackNode>()
      const loaded = await useWorkflowService().reloadCurrentWorkflow(
        sameDocument,
        (graph) => {
          const before = structuredClone(graph)
          const mapped = applyPublicationNodeTypes(
            graph,
            publications,
            originalGraph.value,
            originalBindings.value
          )
          targets = remappedPackNodes(before, mapped)
          return mapped
        }
      )
      if (!batchCurrent()) return false
      const targetStillMissing = missing.missingNodesError?.nodeTypes.some(
        (error) => {
          const type = typeof error === 'string' ? error : error.type
          if (typeof error === 'string' || error.nodeId == null)
            return [...targets.values()].some(
              (target) =>
                target.sourceType === type || target.installedType === type
            )
          const id = tryNormalizeNodeExecutionId(error.nodeId)
          const target = id && targets.get(id)
          return (
            target &&
            (target.sourceType === type || target.installedType === type)
          )
        }
      )
      if (
        !loaded ||
        toRaw(workflow.activeWorkflow) !== document ||
        targetStillMissing
      )
        return reject('reload_failed')
      acknowledged.value = true
      return true
    } catch (cause) {
      return reject('unexpected', cause)
    } finally {
      if (batchCurrent()) reloading.value = false
    }
  }
  return {
    candidates,
    pendingSourcePacks,
    originalGraph: computed(() => originalGraph.value),
    jobs,
    sourceJobs,
    consentOpen,
    resolvingPack,
    submitting,
    reloading,
    verifying,
    acknowledged,
    actionFailed,
    completionReason,
    completionAnnounced,
    ready,
    installedRevisionIds,
    pendingNodeErrors,
    visible,
    settled,
    dismissFinished,
    offer,
    convertedMissingPack,
    offerMissingPack,
    dismissConsent,
    confirm,
    refresh,
    retry,
    cancel,
    readReport,
    acknowledge
  }
})
