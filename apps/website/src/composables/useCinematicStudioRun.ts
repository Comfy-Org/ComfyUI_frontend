import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, readonly, shallowRef, watch } from 'vue'

import type { WorkshopModelDetail } from '../config/models-catalogue'
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
import { canRunModel, studioGate } from '../lib/workshop/cinematic-studio/gate'
import type { Reel, ReelEvent } from '../lib/workshop/cinematic-studio/reel'
import {
  EMPTY_REEL,
  isRendering,
  reduceReel
} from '../lib/workshop/cinematic-studio/reel'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../scripts/posthog'

interface ShotRequest {
  readonly prompt: string
  readonly aspect: AspectRatio
  readonly resolutionPixels: number
  readonly takes: number
  readonly references: readonly File[]
}

/**
 * Runs a shot as one Router request per take, through the same render path,
 * credentials and credit gate as the rest of the model page.
 */
export function useCinematicStudioRun(model: WorkshopModelDetail) {
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
      modelRunnable: canRunModel(model),
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
    request: ShotRequest,
    startedFor: WorkshopSession,
    signal: AbortSignal
  ) {
    try {
      const result = await router_render(
        model.slug,
        {
          prompt: request.prompt,
          aspect_ratio: request.aspect,
          resolution: request.resolutionPixels,
          ...(request.references.length
            ? { reference_images: request.references }
            : {})
        },
        {
          model,
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
        return
      }
      if (!output) throw new WorkshopRouterError('response', result.requestId)
      dispatch({ type: 'takeSucceeded', id, output })
    } catch (error) {
      if (signal.aborted) return
      dispatch({
        type: 'takeFailed',
        id,
        reason: error instanceof WorkshopRouterError ? error.reason : 'client'
      })
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
      modelSlug: model.slug,
      aspect: request.aspect
    })
    const attempt = new AbortController()
    controller = attempt
    try {
      await Promise.all(
        ids.map((id) => renderTake(id, request, startedFor, attempt.signal))
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
    session,
    rendering,
    generate,
    cancel,
    select: (id: string) => dispatch({ type: 'selected', id })
  }
}
