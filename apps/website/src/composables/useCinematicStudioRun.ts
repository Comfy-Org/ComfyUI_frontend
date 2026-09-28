import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, readonly, shallowRef, watch } from 'vue'

import type { WorkshopModelDetail } from '../config/models-catalogue'
import { fetchModelsPage } from '../config/models-page-data'
import type { PreparedRouterRender } from '../config/router-render'
import { router_render } from '../config/router-render'
import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../config/workshop-credits'
import { releaseRouterOutputs } from '../config/workshop-response'
import {
  WorkshopRouterError,
  workshopRunMayStillSettle
} from '../config/workshop-router-errors'
import type { WorkshopSession } from '../config/workshop-session-state'
import { useWorkshopSession } from '../config/workshop-session-state'
import { workshopIdempotencyKey } from '../config/workshop-snippets'
import { createWorkshopUrlUploader } from '../config/workshop-url-upload'
import type { AspectRatio } from '../lib/workshop/cinematic-studio/catalog'
import { studioGate } from '../lib/workshop/cinematic-studio/gate'
import type { Reel, ReelEvent } from '../lib/workshop/cinematic-studio/reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel
} from '../lib/workshop/cinematic-studio/reel'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../scripts/posthog'

interface ShotRequest {
  readonly modelSlug: string
  readonly referenceSlug?: string
  readonly prompt: string
  readonly aspect: AspectRatio
  readonly resolutionPixels: number
  readonly takes: number
  readonly references: readonly File[]
  readonly preview?: string
}

interface UnsettledTake {
  readonly key: string
  readonly prepared?: PreparedRouterRender
}

const fileIds = new WeakMap<File, string>()
function fileId(file: File): string {
  const known = fileIds.get(file)
  if (known) return known
  const id = crypto.randomUUID()
  fileIds.set(file, id)
  return id
}

function takeFingerprint(
  startedFor: WorkshopSession,
  slug: string,
  request: ShotRequest,
  index: number
): string {
  return JSON.stringify([
    startedFor.uid,
    startedFor.workspace.id,
    slug,
    request.prompt,
    request.aspect,
    request.resolutionPixels,
    request.references.map(fileId),
    index
  ])
}

function shotParameters(request: ShotRequest) {
  return {
    prompt: request.prompt,
    aspect_ratio: request.aspect,
    resolution: request.resolutionPixels,
    ...(request.references.length
      ? { reference_images: request.references }
      : {})
  }
}

function takeFailure(id: string, error: unknown): ReelEvent {
  return error instanceof WorkshopRouterError
    ? {
        type: 'takeFailed',
        id,
        reason: error.reason,
        requestId: error.requestId ?? undefined
      }
    : { type: 'takeFailed', id, reason: 'client' }
}

function mayStillSettle(error: unknown): boolean {
  return (
    error instanceof WorkshopRouterError && workshopRunMayStillSettle(error)
  )
}

/**
 * Runs a shot as one Router request per take, through the same render path,
 * credentials and credit gate as a model page. Models load lazily from their
 * page data, so the studio never ships the catalogue to the client.
 * `shotCost` is the least the shot being directed is estimated to cost.
 */
export function useCinematicStudioRun(
  modelCount: number,
  shotCost: () => number | undefined = () => undefined
) {
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

  const credits = computed(() =>
    balance.value.status === 'ok' ? balance.value.credits : undefined
  )
  const gateFor = (cost: number | undefined) =>
    studioGate({
      runEnabled:
        workshopEnabled.value &&
        import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN === '1',
      modelRunnable: modelCount > 0,
      mounted: mounted.value,
      authAvailable: authEnabled.value && !sessionFailure.value,
      sessionSettled: settled.value && !(user.value && !session.value),
      role: session.value?.role,
      credits: rendering.value ? undefined : credits.value,
      cost
    })
  const gate = computed(() => gateFor(shotCost()))

  const models = new Map<string, Promise<WorkshopModelDetail>>()
  function loadModel(slug: string): Promise<WorkshopModelDetail> {
    const cached = models.get(slug)
    if (cached) return cached
    const loading = fetchModelsPage(slug).then((page) => page.model)
    loading.catch(() => models.delete(slug))
    models.set(slug, loading)
    return loading
  }

  let controller: AbortController | undefined

  const unsettledTakes = new Map<string, UnsettledTake>()
  function unsettledTakeFor(fingerprint: string): UnsettledTake {
    const take = unsettledTakes.get(fingerprint) ?? {
      key: workshopIdempotencyKey()
    }
    unsettledTakes.set(fingerprint, take)
    return take
  }

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
    index: number,
    model: WorkshopModelDetail,
    request: ShotRequest,
    startedFor: WorkshopSession,
    signal: AbortSignal
  ) {
    const fingerprint = takeFingerprint(startedFor, model.slug, request, index)
    const { key, prepared } = unsettledTakeFor(fingerprint)
    try {
      const result = await router_render(model.slug, shotParameters(request), {
        model,
        signal,
        idempotencyKey: key,
        prepared,
        onPrepared: (ready) => {
          unsettledTakes.set(fingerprint, { key, prepared: ready })
        },
        token: () => tokenFor(startedFor, signal),
        uploadFile: async (file, uploadSignal) =>
          uploadUrl(
            file,
            await tokenFor(startedFor, signal),
            JSON.stringify([startedFor.uid, startedFor.workspace.id]),
            uploadSignal
          )
      })
      unsettledTakes.delete(fingerprint)
      const output = result.outputs.at(0)
      releaseRouterOutputs(result.outputs.slice(1))
      if (signal.aborted) {
        if (output) releaseRouterOutputs([output])
        return
      }
      if (!output) throw new WorkshopRouterError('response', result.requestId)
      dispatch({ type: 'takeSucceeded', id, output })
    } catch (error) {
      if (signal.aborted) return
      if (!mayStillSettle(error)) unsettledTakes.delete(fingerprint)
      dispatch(takeFailure(id, error))
    }
  }

  interface TakePlan {
    readonly id: string
    readonly index: number
    readonly slug: string
    readonly request: ShotRequest
  }
  const plans = new Map<string, TakePlan>()

  async function runTakes(
    takes: readonly TakePlan[],
    startedFor: WorkshopSession
  ) {
    const attempt = new AbortController()
    controller = attempt
    try {
      await Promise.all(
        takes.map(async ({ id, index, slug, request }) =>
          renderTake(
            id,
            index,
            await loadModel(slug),
            request,
            startedFor,
            attempt.signal
          )
        )
      )
    } catch {
      if (!attempt.signal.aborted)
        takes.forEach(({ id }) =>
          dispatch({ type: 'takeFailed', id, reason: 'unavailable' })
        )
    } finally {
      if (controller === attempt) controller = undefined
      void refreshWorkshopCredits({ force: true })
    }
  }

  async function generate(request: ShotRequest) {
    const startedFor = session.value
    const slug = request.references.length
      ? request.referenceSlug
      : request.modelSlug
    if (rendering.value || gate.value !== 'ready' || !startedFor || !slug)
      return
    const takes = Array.from({ length: request.takes }, (_, index) => ({
      id: workshopIdempotencyKey(),
      index,
      slug,
      request
    }))
    takes.forEach((take) => plans.set(take.id, take))
    dispatch({
      type: 'shotStarted',
      ids: takes.map(({ id }) => id),
      prompt: request.prompt,
      modelSlug: request.modelSlug,
      aspect: request.aspect,
      startedAt: Date.now(),
      preview: request.preview
    })
    await runTakes(takes, startedFor)
  }

  /** Retries settled takes; the shot being directed does not price them. */
  async function retry(...ids: string[]) {
    const startedFor = session.value
    if (rendering.value || gateFor(undefined) !== 'ready' || !startedFor) return
    const retried = ids.flatMap((id) => {
      const plan = plans.get(id)
      const take = reel.value.takes.find((candidate) => candidate.id === id)
      return plan && (take?.status === 'failed' || take?.status === 'cancelled')
        ? [plan]
        : []
    })
    if (!retried.length) return
    const startedAt = Date.now()
    retried.forEach(({ id }) =>
      dispatch({ type: 'takeRetried', id, startedAt })
    )
    await runTakes(retried, startedFor)
  }

  function cancel() {
    controller?.abort()
    controller = undefined
    dispatch({ type: 'rendersCancelled' })
  }

  watch(
    () => [session.value?.uid, session.value?.workspace.id],
    ([uid, workspace], [previousUid, previousWorkspace]) => {
      if (uid !== previousUid || workspace !== previousWorkspace) cancel()
    }
  )

  onScopeDispose(() => {
    cancel()
    releaseRouterOutputs(
      reel.value.takes.flatMap((take) =>
        take.status === 'done' ? [take.output] : []
      )
    )
  })

  return {
    reel: readonly(reel),
    gate,
    credits,
    session,
    rendering,
    generate,
    retry,
    cancel,
    select: (id: string) => dispatch({ type: 'selected', id })
  }
}
