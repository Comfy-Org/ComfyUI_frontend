import { useMounted } from '@vueuse/core'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { WorkshopModelDetail } from '../config/models-catalogue'
import { router_render } from '../config/router-render'
import { useWorkshopSession } from '../config/workshop-session-state'
import {
  useWorkshopCredits,
  refreshWorkshopCredits
} from '../config/workshop-credits'
import { releaseRouterOutputs } from '../config/workshop-response'
import { workshopIdempotencyKey } from '../config/workshop-snippets'
import { useWorkshopAuthFlag, useWorkshopEnabled } from '../scripts/posthog'
import { studioGate } from '../lib/workshop/cinematic-studio/gate'
import type { StudioGate } from '../lib/workshop/cinematic-studio/gate'
import {
  EnhancementError,
  enhancementReview,
  enhancementResult,
  applyEnhancement,
  isEnhancementModel
} from '../lib/workshop/cinematic-studio/enhancement'
import type {
  EnhancementInput,
  EnhancementReview,
  EnhancementSuggestion,
  EnhancementFailure
} from '../lib/workshop/cinematic-studio/enhancement'
import type { RunOutput } from '../config/workshop-run'
import { isCinematicDemo } from './useCinematicDemoRun'

interface Options {
  model: () => WorkshopModelDetail | undefined
  input: () => EnhancementInput
  namespace: () => string
}
interface Review extends EnhancementReview {
  readonly model: WorkshopModelDetail
  readonly scope: string
  readonly inputKey: string
  readonly id: string
}
interface Runtime {
  readonly gate: ComputedRef<StudioGate>
  scope(): string
  execute(review: Review, signal: AbortSignal): Promise<readonly RunOutput[]>
  refresh(): void
}

/** Demo branches before session/credit hooks: no credentials, billing reads or Router calls. */
export function useCinematicEnhancement(options: Options) {
  const mounted = useMounted()
  const demo = isCinematicDemo()
  if (demo)
    return controller(
      options,
      {
        gate: computed(() =>
          mounted.value && isEnhancementModel(options.model())
            ? 'ready'
            : 'unavailable'
        ),
        scope: () => `demo:${options.namespace()}`,
        async execute() {
          return [
            {
              kind: 'text',
              url: '',
              fileName: 'demo-enhancement.json',
              text: JSON.stringify({
                stop_reason: 'end_turn',
                content: [
                  {
                    type: 'text',
                    text: 'Gentle changes in light reveal natural surface textures.'
                  }
                ],
                usage: { input_tokens: 0, output_tokens: 0 }
              })
            }
          ]
        },
        refresh() {}
      },
      true
    )
  const { user, session, sessionFailure, settled, ensureFresh } =
    useWorkshopSession()
  const { balance } = useWorkshopCredits()
  const enabled = useWorkshopEnabled()
  const auth = useWorkshopAuthFlag()
  const scope = () =>
    JSON.stringify([
      options.namespace(),
      user.value?.uid,
      session.value?.uid,
      session.value?.workspace.id
    ])
  return controller(
    options,
    {
      scope,
      gate: computed(() =>
        studioGate({
          runEnabled:
            enabled.value && import.meta.env.PUBLIC_WORKSHOP_ROUTER_RUN === '1',
          modelRunnable: isEnhancementModel(options.model()),
          mounted: mounted.value,
          authAvailable: auth.value && !sessionFailure.value,
          sessionSettled: settled.value && !(user.value && !session.value),
          role: session.value?.role,
          outOfCredits:
            balance.value.status === 'ok' && balance.value.credits <= 0
        })
      ),
      async execute(review, signal) {
        const startedFor = session.value
        if (!startedFor || scope() !== review.scope)
          throw new EnhancementError('changed')
        const result = await router_render(
          review.modelSlug,
          {},
          {
            model: review.model,
            form: review.form,
            signal,
            idempotencyKey: review.id,
            token: async () => {
              const credential = await ensureFresh(undefined, { signal })
              signal.throwIfAborted()
              if (
                scope() !== review.scope ||
                credential?.status !== 'ok' ||
                credential.session.uid !== startedFor.uid ||
                credential.session.workspace.id !== startedFor.workspace.id
              )
                throw new EnhancementError('changed')
              return credential.session.token
            }
          }
        )
        return result.outputs
      },
      refresh() {
        void refreshWorkshopCredits({ force: true })
      }
    },
    false
  )
}

function controller(options: Options, runtime: Runtime, demo: boolean) {
  const review = shallowRef<Review>()
  const result = shallowRef<EnhancementSuggestion>()
  const completedBrief = shallowRef<EnhancementReview['brief']>()
  const completedInputKey = ref('')
  const edited = ref('')
  const busy = ref(false)
  const error = ref<EnhancementFailure | 'request' | undefined>()
  let abort: AbortController | undefined
  const inputKey = () => JSON.stringify(options.input())
  const canConfirm = computed(
    () =>
      !!review.value &&
      !busy.value &&
      runtime.gate.value === 'ready' &&
      runtime.scope() === review.value.scope &&
      review.value.inputKey === inputKey() &&
      options.model()?.slug === review.value.modelSlug
  )
  function reset() {
    abort?.abort()
    abort = undefined
    busy.value = false
    review.value = undefined
    result.value = undefined
    completedBrief.value = undefined
    completedInputKey.value = ''
    edited.value = ''
    error.value = undefined
  }
  function prepare() {
    if (busy.value || runtime.gate.value !== 'ready') return
    const model = options.model()
    if (!model) return
    try {
      review.value = {
        ...enhancementReview(model, options.input()),
        model,
        scope: runtime.scope(),
        inputKey: inputKey(),
        id: workshopIdempotencyKey()
      }
      result.value = undefined
      edited.value = ''
      error.value = undefined
    } catch (cause) {
      error.value = cause instanceof EnhancementError ? cause.reason : 'input'
    }
  }
  async function confirm(acknowledged: boolean) {
    if (!acknowledged || !canConfirm.value || !review.value) return
    const request = review.value
    const attempt = new AbortController()
    abort = attempt
    busy.value = true
    error.value = undefined
    let outputs: readonly RunOutput[] = []
    try {
      outputs = await runtime.execute(request, attempt.signal)
      if (attempt.signal.aborted || runtime.scope() !== request.scope) return
      const suggestion = enhancementResult(outputs, request.brief)
      completedBrief.value = request.brief
      completedInputKey.value = request.inputKey
      result.value = suggestion
      edited.value = result.value.suggestion
    } catch (cause) {
      if (!attempt.signal.aborted)
        error.value =
          cause instanceof EnhancementError ? cause.reason : 'request'
    } finally {
      releaseRouterOutputs(outputs)
      // Consume this confirmation even on failure: never implicitly resubmit an uncertain request.
      if (abort === attempt) {
        abort = undefined
        busy.value = false
        review.value = undefined
      }
      if (!demo) runtime.refresh()
    }
  }
  const proposed = computed(() => {
    if (!result.value || !completedBrief.value) return undefined
    if (completedInputKey.value !== inputKey()) return undefined
    try {
      return applyEnhancement(
        completedBrief.value,
        options.input().scene,
        edited.value
      )
    } catch {
      return undefined
    }
  })
  const applyError = computed(() => {
    if (!result.value || !completedBrief.value) return undefined
    if (completedInputKey.value !== inputKey()) return 'changed'
    try {
      applyEnhancement(
        completedBrief.value,
        options.input().scene,
        edited.value
      )
      return undefined
    } catch (cause) {
      return cause instanceof EnhancementError ? cause.reason : 'length'
    }
  })
  watch(runtime.scope, reset, { flush: 'sync' })
  onScopeDispose(reset)
  return {
    demo,
    gate: runtime.gate,
    review,
    result,
    edited,
    proposed,
    applyError,
    busy,
    error,
    canConfirm,
    prepare,
    confirm,
    reset
  }
}
