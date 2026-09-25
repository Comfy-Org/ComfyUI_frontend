import { useMounted } from '@vueuse/core'
import {
  computed,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  watch
} from 'vue'

import { cinematicEditingForm } from '../lib/workshop/cinematic-studio/editing'
import type { CreationSettings } from '../lib/workshop/cinematic-studio/creations'
import type { WorkshopModelDetail } from '../config/models-catalogue'
import { fetchModelsPage } from '../config/models-page-data'
import { router_render } from '../config/router-render'
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
  readonly references: readonly File[]
  readonly preview?: string
  readonly settings?: CreationSettings
  readonly seed?: number
  readonly video?: CinematicVideoSettings
  readonly editing?: { readonly sourceFile: File; readonly resolution?: string }
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

  let controller: AbortController | undefined

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
    signal: AbortSignal
  ) {
    try {
      if ((model.modality === 'video') !== Boolean(request.video))
        throw new WorkshopRouterError('validation')
      const result = await router_render(
        model.slug,
        request.video || request.editing
          ? {}
          : {
              prompt: request.prompt,
              aspect_ratio: request.aspect,
              resolution: request.resolutionPixels,
              ...(request.seed !== undefined ? { seed: request.seed } : {}),
              ...(request.references.length
                ? { reference_images: request.references }
                : {})
            },
        {
          model,
          ...(request.editing
            ? {
                form: cinematicEditingForm(model, {
                  sourceFile: request.editing.sourceFile,
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
      dispatch({ type: 'takeSucceeded', id, output })
      return true
    } catch (error) {
      if (signal.aborted) return false
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
    const startedFor = session.value
    if (rendering.value || gate.value !== 'ready' || !startedFor) return
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
    const attempt = new AbortController()
    controller = attempt
    try {
      const model = await loadModel(request.modelSlug)
      for (const id of ids) {
        if (attempt.signal.aborted) break
        const completed = await renderTake(
          id,
          model,
          request,
          startedFor,
          attempt.signal
        )
        if (!completed) {
          dispatch({ type: 'rendersCancelled' })
          break
        }
      }
    } catch {
      if (!attempt.signal.aborted)
        ids.forEach((id) =>
          dispatch({ type: 'takeFailed', id, reason: 'unavailable' })
        )
    } finally {
      if (controller === attempt) controller = undefined
      void refreshWorkshopCredits({ force: true })
    }
  }

  function cancel() {
    controller?.abort()
    controller = undefined
    dispatch({ type: 'rendersCancelled' })
  }

  watch(
    () => [session.value?.uid, session.value?.workspace.id],
    ([uid, workspace], [previousUid, previousWorkspace]) => {
      if (uid !== previousUid || workspace !== previousWorkspace) {
        cancel()
        releaseRouterOutputs(
          reel.value.takes.flatMap((take) =>
            take.status === 'done' ? [take.output] : []
          )
        )
        reel.value = EMPTY_REEL
      }
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
    reel: shallowReadonly(reel),
    gate,
    session,
    rendering,
    generate,
    cancel,
    select: (id: string) => dispatch({ type: 'selected', id })
  }
}
