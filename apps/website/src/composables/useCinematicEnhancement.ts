import { useMounted } from '@vueuse/core'
import { z } from 'zod'
import { collectWorkshopRouter } from '../config/workshop-router-queue'
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
  execute(
    review: Review,
    signal: AbortSignal,
    admitted: (id: string) => void,
    requestId?: string
  ): Promise<readonly RunOutput[]>
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
      async execute(review, signal, admitted, requestId) {
        const startedFor = session.value
        if (!startedFor || scope() !== review.scope)
          throw new EnhancementError('changed')
        const token = async () => {
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
        if (requestId) {
          if (!review.model.execution) throw new EnhancementError('unavailable')
          const result = await collectWorkshopRouter({
            contract: review.model.execution,
            requestId,
            token: await token(),
            freshToken: token,
            signal,
            cancelOnAbort: false
          })
          return result.outputs
        }
        const result = await router_render(
          review.modelSlug,
          {},
          {
            model: review.model,
            form: review.form,
            signal,
            idempotencyKey: review.id,
            onQueuedRequest: admitted,
            onRequestId: (id) => {
              if (id) admitted(id)
            },
            cancelOnAbort: false,
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

const savedEnhancementSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(200),
    modelSlug: z.string().max(200),
    input: z.object({
      scene: z.string().max(6000),
      directions: z.string().max(6000),
      mode: z.enum(['image', 'video']),
      promptLimit: z.number().int().min(1).max(8000).optional()
    }),
    status: z.enum(['pending', 'uncertain', 'complete', 'failed']),
    failure: z
      .enum([
        'unavailable',
        'input',
        'room',
        'incomplete',
        'refused',
        'response',
        'length',
        'changed'
      ])
      .optional(),
    requestId: z.string().min(1).max(200).optional(),
    suggestion: z
      .object({
        original: z.string().max(6000),
        suggestion: z.string().max(2400),
        proposedPrompt: z.string().max(8000),
        inputTokens: z.number().nullable(),
        outputTokens: z.number().nullable()
      })
      .optional(),
    edited: z.string().max(10000).optional()
  })
  .strict()
type SavedEnhancement = z.infer<typeof savedEnhancementSchema>
function controller(options: Options, runtime: Runtime, demo: boolean) {
  const review = shallowRef<Review>()
  const result = shallowRef<EnhancementSuggestion>()
  const completedBrief = shallowRef<EnhancementReview['brief']>()
  const completedInputKey = ref('')
  const edited = ref('')
  const busy = ref(false)
  const error = ref<EnhancementFailure | 'request' | undefined>()
  const saved = shallowRef<SavedEnhancement>()
  const storageError = ref(false)
  const unresolved = computed(
    () =>
      saved.value?.status === 'pending' || saved.value?.status === 'uncertain'
  )
  const canRecover = computed(
    () =>
      !busy.value &&
      unresolved.value &&
      !!saved.value?.requestId &&
      isEnhancementModel(options.model()) &&
      options.model()?.slug === saved.value.modelSlug &&
      !['pending', 'signedOut', 'unavailable'].includes(runtime.gate.value)
  )
  const storageKey = (scope: string) =>
    `comfy-cinema-enhancement-v1:${encodeURIComponent(scope)}`
  function persist(scope = runtime.scope()) {
    try {
      if (saved.value)
        localStorage.setItem(
          storageKey(scope),
          JSON.stringify({
            ...saved.value,
            ...(result.value ? { edited: edited.value } : {})
          })
        )
      else localStorage.removeItem(storageKey(scope))
      storageError.value = false
    } catch {
      storageError.value = true
    }
  }
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
  function clear() {
    abort?.abort()
    abort = undefined
    busy.value = false
    review.value = undefined
    result.value = undefined
    completedBrief.value = undefined
    completedInputKey.value = ''
    edited.value = ''
    error.value = undefined
    saved.value = undefined
  }
  function reset() {
    if (busy.value || unresolved.value) return
    clear()
    persist()
  }
  function restore() {
    try {
      const text = localStorage.getItem(storageKey(runtime.scope()))
      if (!text || text.length > 40000) return
      const entry = savedEnhancementSchema.parse(JSON.parse(text))
      const model = options.model()
      if (!model || model.slug !== entry.modelSlug) return
      const brief = enhancementReview(model, entry.input).brief
      saved.value =
        entry.status === 'pending' ? { ...entry, status: 'uncertain' } : entry
      if (
        entry.status === 'complete' &&
        entry.suggestion &&
        entry.suggestion.original === brief.original
      ) {
        completedBrief.value = brief
        completedInputKey.value = JSON.stringify(entry.input)
        result.value = entry.suggestion
        edited.value = entry.edited ?? entry.suggestion.suggestion
      } else error.value = entry.failure ?? 'request'
    } catch {
      storageError.value = true
    }
  }
  function prepare() {
    if (busy.value || unresolved.value || runtime.gate.value !== 'ready') return
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
  async function confirm(acknowledged: boolean, recovering = false) {
    if (
      !recovering &&
      (!acknowledged || !canConfirm.value || !review.value || unresolved.value)
    )
      return
    if (recovering && !canRecover.value) return
    const entry = saved.value
    const model = options.model()
    const request =
      recovering && entry && model
        ? {
            ...enhancementReview(model, entry.input),
            model,
            scope: runtime.scope(),
            inputKey: JSON.stringify(entry.input),
            id: entry.id
          }
        : review.value
    if (!request) return
    if (!recovering)
      saved.value = {
        version: 1,
        id: request.id,
        modelSlug: request.modelSlug,
        input: JSON.parse(request.inputKey),
        status: 'pending'
      }
    persist()
    const attempt = new AbortController()
    abort = attempt
    busy.value = true
    error.value = undefined
    let outputs: readonly RunOutput[] = []
    try {
      outputs = await runtime.execute(
        request,
        attempt.signal,
        (id) => {
          if (
            attempt.signal.aborted ||
            runtime.scope() !== request.scope ||
            !saved.value
          )
            return
          saved.value = { ...saved.value, requestId: id }
          persist(request.scope)
        },
        recovering ? entry?.requestId : undefined
      )
      if (attempt.signal.aborted || runtime.scope() !== request.scope) return
      const suggestion = enhancementResult(
        outputs.filter((output) => output.purpose !== 'response-metadata'),
        request.brief
      )
      completedBrief.value = request.brief
      completedInputKey.value = request.inputKey
      result.value = suggestion
      edited.value = result.value.suggestion
      if (saved.value)
        saved.value = {
          ...saved.value,
          status: 'complete',
          suggestion,
          edited: edited.value
        }
      persist(request.scope)
    } catch (cause) {
      if (!attempt.signal.aborted) {
        error.value =
          cause instanceof EnhancementError ? cause.reason : 'request'
        if (saved.value)
          saved.value = {
            ...saved.value,
            status: cause instanceof EnhancementError ? 'failed' : 'uncertain',
            ...(cause instanceof EnhancementError
              ? { failure: cause.reason }
              : {})
          }
        persist(request.scope)
      }
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
  watch(
    edited,
    () => {
      if (result.value && saved.value?.status === 'complete') persist()
    },
    { flush: 'sync' }
  )
  watch(
    runtime.scope,
    (_, previous) => {
      if (previous && saved.value) persist(previous)
      clear()
      restore()
    },
    { flush: 'sync', immediate: true }
  )
  onScopeDispose(() => {
    persist()
    clear()
  })
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
    saved,
    unresolved,
    canRecover,
    storageError,
    recover: () => confirm(false, true),
    prepare,
    confirm,
    reset
  }
}
