import type { ReferenceFile } from '../lib/workshop/cinematic-studio/reference-bundles'
import { useMounted } from '@vueuse/core'
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowReadonly,
  shallowRef,
  watch
} from 'vue'

import { cinematicEditingForm } from '../lib/workshop/cinematic-studio/editing'
import { cinematicImageForm } from '../lib/workshop/cinematic-studio/models'
import type { CreationSettings } from '../lib/workshop/cinematic-studio/creations'
import type { WorkshopModelDetail } from '../config/models-catalogue'
import { fetchModelsPage } from '../config/models-page-data'
import { router_render } from '../config/router-render'
import { collectWorkshopRouter } from '../config/workshop-router-queue'
import {
  readCinematicJournal,
  writeCinematicJournal,
  removeCinematicJournal,
  subscribeCinematicJournal
} from '../lib/workshop/cinematic-studio/journal'
import type { CinematicJournalEntry } from '../lib/workshop/cinematic-studio/journal'
import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../config/workshop-credits'
import { releaseRouterOutputs } from '../config/workshop-response'
import { WorkshopRouterError } from '../config/workshop-router-errors'
import type { WorkshopSession } from '../config/workshop-session-state'
import { useWorkshopSession } from '../config/workshop-session-state'
import { workshopIdempotencyKey } from '../config/workshop-snippets'
import { createWorkshopUrlUploader } from '../config/workshop-url-upload'
import type { AspectRatio } from '../lib/workshop/cinematic-studio/catalog'
import { studioGate } from '../lib/workshop/cinematic-studio/gate'
import type { CinematicVideoSettings } from '../lib/workshop/cinematic-studio/video'
import { cinematicVideoForm } from '../lib/workshop/cinematic-studio/video'
import type { Reel, ReelEvent } from '../lib/workshop/cinematic-studio/reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel
} from '../lib/workshop/cinematic-studio/reel'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../scripts/posthog'

export interface ShotRequest {
  readonly modelSlug: string
  readonly prompt: string
  readonly aspect: AspectRatio
  readonly resolutionPixels: number
  readonly takes: number
  readonly referenceFiles?: readonly ReferenceFile[]
  readonly references: readonly File[]
  readonly preview?: string
  readonly settings?: CreationSettings
  readonly seed?: number
  readonly video?: CinematicVideoSettings
  readonly editing?: {
    readonly sourceFile: File
    readonly sourceFiles?: readonly File[]
    readonly resolution?: string
  }
}

/**
 * Runs a shot as one Router request per take, through the same render path,
 * credentials and credit gate as a model page. Models load lazily from their
 * page data, so the studio never ships the catalogue to the client.
 */
export function useCinematicStudioRun(modelCount: number) {
  const { user, session, sessionFailure, settled, ensureFresh } =
    useWorkshopSession()
  const { balance } = useWorkshopCredits()
  const workshopEnabled = useWorkshopEnabled()
  const authEnabled = useWorkshopAuthFlag()
  const mounted = useMounted()
  const uploadUrl = createWorkshopUrlUploader()

  const reel = shallowRef<Reel>(EMPTY_REEL)
  const dispatch = (event: ReelEvent) => {
    reel.value = reduceReel(reel.value, event)
  }
  const rendering = computed(() => isRendering(reel.value))
  const pending = shallowRef<readonly CinematicJournalEntry[]>([])
  const recoveryError = ref(false)
  const namespace = computed(() =>
    session.value
      ? JSON.stringify([session.value.uid, session.value.workspace.id])
      : undefined
  )
  function reloadJournal() {
    if (!mounted.value || !namespace.value) {
      pending.value = []
      return
    }
    try {
      pending.value = readCinematicJournal(namespace.value)
    } catch {
      recoveryError.value = true
    }
  }
  onMounted(reloadJournal)
  onScopeDispose(
    subscribeCinematicJournal((changed) => {
      if (changed === namespace.value) reloadJournal()
    })
  )
  function record(
    scope: string,
    entry: CinematicJournalEntry,
    required = false
  ) {
    if (scope === namespace.value)
      pending.value = [
        ...pending.value.filter((item) => item.id !== entry.id),
        entry
      ]
    try {
      writeCinematicJournal(scope, entry)
    } catch (error) {
      if (scope === namespace.value) recoveryError.value = true
      if (required) throw error
    }
  }

  const gate = computed(() =>
    studioGate({
      runEnabled:
        workshopEnabled.value &&
        import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN === '1',
      modelRunnable: modelCount > 0,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      outOfCredits:
        !rendering.value &&
        balance.value.status === 'ok' &&
        balance.value.credits <= 0
    })
  )

  const models = new Map<string, Promise<WorkshopModelDetail>>()
  function loadModel(slug: string): Promise<WorkshopModelDetail> {
    const cached = models.get(slug)
    if (cached) return cached
    const loading = fetchModelsPage(slug).then((page) => page.model)
    loading.catch(() => models.delete(slug))
    models.set(slug, loading)
    return loading
  }

  interface Attempt {
    controller: AbortController
    namespace: string
    cancelRequested: boolean
    journaled?: boolean
    entry?: CinematicJournalEntry
  }
  let active: Attempt | undefined
  const attemptIsCurrent = (attempt: Attempt) =>
    !attempt.controller.signal.aborted && active === attempt

  async function tokenFor(startedFor: WorkshopSession, signal: AbortSignal) {
    const credential = await ensureFresh(undefined, { signal })
    signal.throwIfAborted()
    if (
      credential?.status !== 'ok' ||
      credential.session.uid !== startedFor.uid ||
      credential.session.workspace.id !== startedFor.workspace.id
    )
      throw new WorkshopRouterError('unavailable')
    return credential.session.token
  }

  async function renderTake(
    id: string,
    model: WorkshopModelDetail,
    request: ShotRequest,
    startedFor: WorkshopSession,
    attempt: Attempt
  ) {
    const signal = attempt.controller.signal
    const entry: CinematicJournalEntry = {
      id,
      modelSlug: model.slug,
      contractId: model.execution?.id ?? '',
      prompt: request.prompt,
      aspect: request.aspect,
      startedAt:
        reel.value.takes.find((take) => take.id === id)?.startedAt ??
        Date.now(),
      settings: request.settings,
      status: 'unknown'
    }
    attempt.entry = entry
    try {
      if ((model.modality === 'video') !== Boolean(request.video))
        throw new WorkshopRouterError('validation')
      const result = await router_render(
        model.slug,
        {},
        {
          model,
          ...(!request.video && !request.editing
            ? {
                form: cinematicImageForm(model, {
                  prompt: request.prompt,
                  aspect: request.aspect,
                  resolutionPixels: request.resolutionPixels,
                  seed: request.seed,
                  references: request.references
                })
              }
            : {}),
          ...(request.editing
            ? {
                form: cinematicEditingForm(model, {
                  sourceFile: request.editing.sourceFile,
                  sourceFiles: request.editing.sourceFiles,
                  seed: request.seed,
                  prompt: request.prompt,
                  aspect: request.aspect,
                  resolution: request.editing.resolution
                })
              }
            : {}),
          ...(request.video
            ? {
                form: cinematicVideoForm(
                  model,
                  request.prompt,
                  request.aspect,
                  request.video
                )
              }
            : {}),
          signal,
          cancelOnAbort: () => attempt.cancelRequested,
          onPrepared: () => {
            record(attempt.namespace, entry, true)
            attempt.journaled = true
          },
          onQueuedRequest: (requestId) => {
            attempt.entry = {
              ...entry,
              requestId,
              status: attempt.cancelRequested ? 'cancelRequested' : 'pending'
            }
            record(attempt.namespace, attempt.entry)
          },
          idempotencyKey: id,
          token: () => tokenFor(startedFor, signal),
          uploadFile: async (file, uploadSignal) =>
            uploadUrl(
              file,
              await tokenFor(startedFor, signal),
              JSON.stringify([startedFor.uid, startedFor.workspace.id]),
              uploadSignal
            )
        }
      )
      const output = result.outputs.at(0)
      releaseRouterOutputs(result.outputs.slice(1))
      if (signal.aborted) {
        if (output) releaseRouterOutputs([output])
        return false
      }
      if (!output) throw new WorkshopRouterError('response', result.requestId)
      record(attempt.namespace, {
        ...(attempt.entry ?? entry),
        status: 'complete'
      })
      dispatch({ type: 'takeSucceeded', id, output })
      return true
    } catch (error) {
      if (signal.aborted) return false
      if (
        error instanceof WorkshopRouterError &&
        error.requestSettlement === 'terminal'
      )
        record(attempt.namespace, {
          ...(attempt.entry ?? entry),
          status: 'terminal'
        })
      dispatch(
        error instanceof WorkshopRouterError
          ? {
              type: 'takeFailed',
              id,
              reason: error.reason,
              requestId: error.requestId ?? undefined
            }
          : { type: 'takeFailed', id, reason: 'client' }
      )
      return false
    }
  }

  async function generate(request: ShotRequest) {
    return generateBatch([request])
  }
  async function generateBatch(requests: readonly ShotRequest[]) {
    const startedFor = session.value
    if (
      rendering.value ||
      gate.value !== 'ready' ||
      !startedFor ||
      !requests.length ||
      requests.length > 3
    )
      return
    if (
      requests.length > 1 &&
      requests.some((request) => !request.video || request.takes !== 1)
    )
      return
    const jobs = requests.flatMap((request) => {
      const ids = Array.from({ length: request.takes }, () =>
        workshopIdempotencyKey()
      )
      dispatch({
        type: 'shotStarted',
        ids,
        prompt: request.prompt,
        modelSlug: request.modelSlug,
        aspect: request.aspect,
        startedAt: Date.now(),
        preview: request.preview,
        settings: request.settings
      })
      return ids.map((id) => ({ id, request }))
    })
    const attempt: Attempt = {
      controller: new AbortController(),
      namespace: JSON.stringify([startedFor.uid, startedFor.workspace.id]),
      cancelRequested: false
    }
    active = attempt
    try {
      const loaded = await Promise.all(
        jobs.map(({ request }) => loadModel(request.modelSlug))
      )
      // Validate every clip's declared settings before submitting any clip.
      jobs.forEach(({ request }, index) => {
        if (request.video)
          cinematicVideoForm(
            loaded[index],
            request.prompt,
            request.aspect,
            request.video
          )
      })
      for (const [index, { id, request }] of jobs.entries()) {
        if (attempt.controller.signal.aborted) break
        attempt.journaled = false
        const completed = await renderTake(
          id,
          loaded[index],
          request,
          startedFor,
          attempt
        )
        if (!completed) {
          if (attemptIsCurrent(attempt)) dispatch({ type: 'rendersCancelled' })
          break
        }
      }
    } catch {
      if (!attempt.controller.signal.aborted)
        jobs.forEach(({ id }) =>
          dispatch({ type: 'takeFailed', id, reason: 'unavailable' })
        )
    } finally {
      if (active === attempt) active = undefined
      void refreshWorkshopCredits({ force: true })
    }
  }

  function stop(cancelRequested: boolean) {
    if (active) {
      active.cancelRequested = cancelRequested
      if (cancelRequested && active.entry && active.journaled)
        record(active.namespace, { ...active.entry, status: 'cancelRequested' })
      active.controller.abort()
    }
    active = undefined
    dispatch({ type: 'rendersCancelled' })
  }
  function cancel() {
    stop(true)
  }

  async function recover(id: string) {
    const startedFor = session.value
    const entry = pending.value.find((item) => item.id === id)
    if (
      !startedFor ||
      !entry?.requestId ||
      entry.status === 'terminal' ||
      rendering.value
    )
      return
    recoveryError.value = false
    const attempt: Attempt = {
      controller: new AbortController(),
      namespace: JSON.stringify([startedFor.uid, startedFor.workspace.id]),
      cancelRequested: false,
      journaled: true,
      entry
    }
    active = attempt
    const signal = attempt.controller.signal
    releaseRouterOutputs(
      reel.value.takes.flatMap((take) =>
        take.id === id && take.status === 'done' ? [take.output] : []
      )
    )
    reel.value = {
      ...reel.value,
      takes: reel.value.takes.filter((take) => take.id !== id)
    }
    dispatch({
      type: 'shotStarted',
      ids: [id],
      prompt: entry.prompt,
      modelSlug: entry.modelSlug,
      aspect: entry.aspect,
      startedAt: entry.startedAt,
      settings: entry.settings
    })
    try {
      const model = await loadModel(entry.modelSlug)
      signal.throwIfAborted()
      if (!model.execution || model.execution.id !== entry.contractId)
        throw new WorkshopRouterError('unavailable')
      const result = await collectWorkshopRouter({
        contract: model.execution,
        requestId: entry.requestId,
        token: await tokenFor(startedFor, signal),
        freshToken: () => tokenFor(startedFor, signal),
        signal,
        cancelOnAbort: () => attempt.cancelRequested
      })
      const output = result.outputs.find(
        (item) => item.purpose !== 'response-metadata'
      )
      releaseRouterOutputs(result.outputs.filter((item) => item !== output))
      if (signal.aborted) {
        if (output) releaseRouterOutputs([output])
        return
      }
      if (!output) throw new WorkshopRouterError('response', result.requestId)
      record(attempt.namespace, { ...entry, status: 'complete' })
      dispatch({ type: 'takeSucceeded', id, output })
    } catch (error) {
      if (signal.aborted) return
      if (
        error instanceof WorkshopRouterError &&
        error.requestSettlement === 'terminal'
      )
        record(attempt.namespace, { ...entry, status: 'terminal' })
      dispatch({
        type: 'takeFailed',
        id,
        reason: error instanceof WorkshopRouterError ? error.reason : 'client',
        requestId: entry.requestId
      })
      recoveryError.value = true
    } finally {
      if (active === attempt) active = undefined
      void refreshWorkshopCredits({ force: true })
    }
  }

  function dismissRecovery(id: string) {
    const entry = pending.value.find((item) => item.id === id)
    if (
      !namespace.value ||
      !entry ||
      !['unknown', 'terminal'].includes(entry.status) ||
      rendering.value
    )
      return
    try {
      removeCinematicJournal(namespace.value, id)
    } catch {
      recoveryError.value = true
    }
  }

  watch(
    () => [session.value?.uid, session.value?.workspace.id],
    ([uid, workspace], [previousUid, previousWorkspace]) => {
      if (uid !== previousUid || workspace !== previousWorkspace) {
        stop(false)
        releaseRouterOutputs(
          reel.value.takes.flatMap((take) =>
            take.status === 'done' ? [take.output] : []
          )
        )
        reel.value = EMPTY_REEL
        pending.value = []
        recoveryError.value = false
        reloadJournal()
      }
    }
  )

  onScopeDispose(() => {
    stop(false)
    releaseRouterOutputs(
      reel.value.takes.flatMap((take) =>
        take.status === 'done' ? [take.output] : []
      )
    )
  })

  return {
    reel: shallowReadonly(reel),
    gate,
    session,
    rendering,
    pending: shallowReadonly(pending),
    recoveryError,
    recover,
    dismissRecovery,
    generate,
    generateBatch,
    cancel,
    select: (id: string) => dispatch({ type: 'selected', id })
  }
}
