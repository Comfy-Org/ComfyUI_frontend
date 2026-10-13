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

export type PackConversion = {
  revision: CloudNodeRegistryRevision
  state: ConversionState
  report?: unknown
  executionMode?: CompletionExecutionMode
}

export const useMagicPatchBatchStore = defineStore('magicPatchBatch', () => {
  const identity = useNodeAccountScope()
  const workflow = useWorkflowStore()
  const registry = useCloudNodeRegistry()
  const missing = useMissingNodesErrorStore()
  const definitions = useNodeDefStore()
  const candidates = shallowRef<CloudNodeRegistryRevision[]>([])
  const originalGraph = shallowRef<ComfyWorkflowJSON>()
  const jobs = shallowRef<PackConversion[]>([])
  const consentOpen = ref(false)
  const submitting = ref(false)
  const reloading = ref(false)
  const verifying = ref(false)
  const verifiedCompletion = shallowRef<{
    key: string
    publications: InstalledPublication[]
  }>()
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
  const completedRequests = computed(
    () =>
      jobs.value.length > 0 &&
      jobs.value.every(
        ({ state }) =>
          state.phase === 'active' &&
          state.request.state === 'ready' &&
          typeof state.request.report_sha256 === 'string' &&
          /^[a-f0-9]{64}$/u.test(state.request.report_sha256) &&
          !state.disconnected
      )
  )
  const settled = computed(
    () =>
      jobs.value.length > 0 &&
      jobs.value.every(
        ({ state }) =>
          state.phase === 'error' ||
          (state.phase === 'active' &&
            ['ready', 'failed', 'withdrawn'].includes(state.request.state))
      )
  )
  const completionKey = computed(() =>
    completedRequests.value
      ? jobs.value
          .map(({ state }) =>
            state.phase === 'active'
              ? `${state.request.id}:${state.request.status_version}:${state.request.report_sha256 ?? ''}`
              : ''
          )
          .join('|')
      : undefined
  )
  const ready = computed(
    () =>
      Boolean(completionKey.value) &&
      verifiedCompletion.value?.key === completionKey.value
  )
  function dismissFinished() {
    if (settled.value && !ready.value) reset()
  }
  const visible = computed(() => jobs.value.length > 0 && !acknowledged.value)

  function reset() {
    epoch++
    controllers.forEach((controller) => controller.dispose())
    controllers.clear()
    candidates.value = []
    originalGraph.value = undefined
    jobs.value = []
    consentOpen.value = false
    submitting.value = false
    reloading.value = false
    verifying.value = false
    verifiedCompletion.value = undefined
    acknowledged.value = false
    actionFailed.value = false
    completionReason.value = undefined
    completionAnnounced.value = false
    completionAttempted = undefined
    client = undefined
  }
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
    [completionKey, verifying],
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
      !identity.current(discovery.owner) ||
      discovery.workflow !== toRaw(workflow.activeWorkflow) ||
      discovery.documentId !== currentCompletedWorkflowDocumentId() ||
      offeredDocument === discovery.documentId ||
      visible.value ||
      consentOpen.value
    )
      return
    const nodes = flattenWorkflowNodes(app.rootGraph.serialize())
    const revisions = (registry.catalog.value?.revisions ?? []).filter(
      (revision) =>
        revision.node_api_version === 1 &&
        Boolean(revision.upstream_commit) &&
        nodes.some((node) => {
          const version = node.properties?.ver
          return (
            node.properties?.cnr_id === revision.pack_id &&
            revision.nodes.includes(node.type) &&
            (typeof version !== 'string' ||
              !/^[a-f0-9]{64}$/u.test(version) ||
              version === revision.revision_id)
          )
        })
    )
    offer(revisions)
  }

  function offer(revisions: CloudNodeRegistryRevision[]) {
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
    if (!eligible.length) return
    owner = identity.capture()
    document = toRaw(workflow.activeWorkflow)
    documentId = currentCompletedWorkflowDocumentId()
    offeredDocument = documentId
    originalGraph.value = structuredClone(
      app.rootGraph.serialize()
    ) as ComfyWorkflowJSON
    candidates.value = eligible
    consentOpen.value = true
  }
  function dismissConsent() {
    consentOpen.value = false
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
    const original = originalGraph.value
    reset()
    originalGraph.value = original
    const batchEpoch = epoch
    current = () => batchEpoch === epoch && identity.current(owner)
    client = createMagicPatchClient(
      (...args) => api.fetchApi(...args),
      current,
      identity
    )
    jobs.value = selected.map((revision) => ({
      revision,
      state: { phase: 'idle' }
    }))
    for (const revision of selected) {
      const controller = createMagicPatchConversion(
        client,
        (state) => {
          jobs.value = jobs.value.map((job) =>
            job.revision.revision_id === revision.revision_id
              ? { ...job, state }
              : job
          )
        },
        current
      )
      controllers.set(revision.revision_id, controller)
    }
    submitting.value = true
    try {
      for (const revision of selected) {
        if (!current()) return
        await controllers.get(revision.revision_id)?.start({
          pack_id: revision.pack_id,
          revision_id: revision.revision_id
        })
      }
    } finally {
      if (current()) submitting.value = false
    }
  }
  async function refresh() {
    for (const job of jobs.value) {
      if (!current()) return
      if (
        job.state.phase === 'active' &&
        ['waiting_conversion', 'waiting_install', 'ready'].includes(
          job.state.request.state
        )
      )
        await controllers.get(job.revision.revision_id)?.refresh()
    }
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
  async function verifyCompletion() {
    if (!completedRequests.value || verifying.value || !current()) return false
    const batchCurrent = current
    const completion = completionKey.value
    const sameCompletion = () =>
      batchCurrent() &&
      completedRequests.value &&
      completionKey.value === completion
    const reject = (code: string, cause?: unknown) =>
      batchCurrent() ? fail(code, cause ?? code) : false
    verifying.value = true
    verifiedCompletion.value = undefined
    actionFailed.value = false
    completionReason.value = undefined
    try {
      if (!(await registry.load()) || !sameCompletion())
        return reject('registry_unavailable')
      const installed: CloudNodeRegistryRevision[] = []
      const publications: InstalledPublication[] = []
      const executionModes = new Map<string, CompletionExecutionMode>()
      for (const job of jobs.value) {
        if (job.state.phase !== 'active' || !registry.catalog.value)
          return false
        const digest = job.state.request.report_sha256
        if (!digest || !client) return reject('publication_report_unavailable')
        const report = await client.report(job.state.request.id, digest)
        if (!sameCompletion()) return false
        if (!report.ok)
          return reject('publication_report_unverified', report.error.code)
        const executionMode = completionExecutionFromVerifiedReport(
          report.value,
          job.state.request
        )
        if (!executionMode) return reject('completion_execution_unverified')
        const publication = publicationFromVerifiedReport(
          report.value,
          job.state.request,
          job.revision
        )
        if (!publication) return reject('publication_association_unavailable')
        const target = selectedPublisherRevision(
          publication,
          registry.catalog.value
        )
        if (!target) return reject('release_unavailable')
        const revisionId = target.revision_id
        if (!target.pinned && !(await registry.setPin(revisionId, true, false)))
          return reject('pin_failed')
        if (!sameCompletion()) return false
        const confirmed =
          registry.catalog.value &&
          selectedPublisherRevision(publication, registry.catalog.value)
        if (
          !confirmed?.pinned ||
          !registry.catalog.value?.pins.includes(revisionId)
        )
          return reject('pin_unconfirmed')
        installed.push(confirmed)
        publications.push(publication)
        executionModes.set(job.revision.revision_id, executionMode)
      }
      await app.reloadNodeDefs()
      if (!sameCompletion()) return false
      if (
        installed.some((revision) =>
          revision.nodes.some((name) => {
            const definition = definitions.nodeDefsByName[name]
            return (
              !definition?.python_module ||
              definition.python_module === 'custom_nodes.frontend_only' ||
              definition.comfy_cloud_revision_id !== revision.revision_id
            )
          })
        )
      )
        return reject('definitions_unavailable')
      if (!completion) return false
      jobs.value = jobs.value.map((job) => ({
        ...job,
        executionMode: executionModes.get(job.revision.revision_id)
      }))
      verifiedCompletion.value = { key: completion, publications }
      return true
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
      if (!(await verifyCompletion()) || !sameDocument()) return false
      const publications = verifiedCompletion.value?.publications
      if (!publications) return false
      const loaded = await useWorkflowService().reloadCurrentWorkflow(
        sameDocument,
        (graph) =>
          applyPublicationNodeTypes(graph, publications, originalGraph.value)
      )
      if (!batchCurrent()) return false
      if (
        !loaded ||
        toRaw(workflow.activeWorkflow) !== document ||
        missing.missingNodesError?.nodeTypes.length
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
    originalGraph: computed(() => originalGraph.value),
    jobs,
    consentOpen,
    submitting,
    reloading,
    verifying,
    acknowledged,
    actionFailed,
    completionReason,
    completionAnnounced,
    ready,
    visible,
    settled,
    dismissFinished,
    offer,
    dismissConsent,
    confirm,
    refresh,
    retry,
    cancel,
    readReport,
    acknowledge
  }
})
