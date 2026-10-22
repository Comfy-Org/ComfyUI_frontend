import { usePreferredReducedMotion } from '@vueuse/core'
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import { computed, nextTick, onScopeDispose, shallowRef, toValue } from 'vue'

import {
  splitWords,
  spokenTextDurationMs,
  wordRevealStaggerMs
} from '@/components/SpokenText/speechTiming'
import type { WidgetId } from '@/types/widgetId'
import { enhancePromptRequest } from '@/workbench/extensions/agent/services/enhancePromptRequest'
import type { EnhancePromptFn } from '@/workbench/extensions/agent/services/enhancePromptRequest'

type EnhancePromptViewState = {
  isLocked: Ref<boolean>
  isProcessing: Ref<boolean>
  isRevealing: Ref<boolean>
  revealText: Ref<string>
  revealStaggerMs: Ref<number>
}

export const EnhancePromptStateKey: InjectionKey<EnhancePromptViewState> =
  Symbol('EnhancePromptState')

type EnhancePromptState =
  | { phase: 'idle' }
  | { phase: 'processing'; original: string }
  | { phase: 'revealing'; original: string; target: string }

type EnhancePromptApi = {
  phase: ComputedRef<EnhancePromptState['phase']>
  isProcessing: ComputedRef<boolean>
  isRevealing: ComputedRef<boolean>
  isLocked: ComputedRef<boolean>
  revealText: ComputedRef<string>
  revealStaggerMs: ComputedRef<number>
  enhance: () => Promise<void>
}

const MIN_SHIMMER_MS = 250

type BoundPrompt = {
  prompt: Ref<string>
  textarea?: MaybeRefOrGetter<HTMLTextAreaElement | null | undefined>
}

type SharedSession = {
  api: Omit<EnhancePromptApi, 'enhance'>
  enhanceFrom: (
    source: Ref<string>,
    request: EnhancePromptFn,
    reducedMotion: { value: string }
  ) => Promise<void>
  bind: (binding: BoundPrompt) => void
  unbind: (prompt: Ref<string>) => boolean
  abortActive: () => void
}

const sharedSessions = new Map<WidgetId, SharedSession>()

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }
    const id = setTimeout(() => resolve(true), ms)
    const cancel = () => {
      clearTimeout(id)
      resolve(false)
    }
    signal.addEventListener('abort', cancel, { once: true })
  })
}

function animationsDisabled(): boolean {
  return (
    document.documentElement.classList.contains('disable-animations') ||
    document.body.classList.contains('disable-animations')
  )
}

async function writePrompts(bindings: Iterable<BoundPrompt>, value: string) {
  const scrolls = [...bindings].map((binding) => {
    const el = toValue(binding.textarea)
    return { el, scrollTop: el?.scrollTop }
  })
  for (const binding of bindings) binding.prompt.value = value
  await nextTick()
  for (const { el, scrollTop } of scrolls) {
    if (el && scrollTop !== undefined) el.scrollTop = scrollTop
  }
}

function createSession(): SharedSession {
  const bindings = new Set<BoundPrompt>()
  const state = shallowRef<EnhancePromptState>({ phase: 'idle' })
  let activeController: AbortController | null = null

  const phase = computed(() => state.value.phase)
  const isProcessing = computed(() => state.value.phase === 'processing')
  const isRevealing = computed(() => state.value.phase === 'revealing')
  const isLocked = computed(() => state.value.phase !== 'idle')
  const revealText = computed(() =>
    state.value.phase === 'revealing' ? state.value.target : ''
  )
  const revealStaggerMs = computed(() =>
    wordRevealStaggerMs(splitWords(revealText.value).length)
  )

  function abortActive() {
    activeController?.abort()
    activeController = null
    state.value = { phase: 'idle' }
  }

  async function enhanceFrom(
    source: Ref<string>,
    request: EnhancePromptFn,
    reducedMotion: { value: string }
  ) {
    if (state.value.phase !== 'idle') return

    const original = source.value
    const controller = new AbortController()
    activeController = controller
    state.value = { phase: 'processing', original }

    const [result, held] = await Promise.all([
      request({ prompt: original }),
      wait(MIN_SHIMMER_MS, controller.signal)
    ])
    if (!held) return
    if (!result.ok) {
      activeController = null
      state.value = { phase: 'idle' }
      return
    }

    if (reducedMotion.value === 'reduce' || animationsDisabled()) {
      await writePrompts(bindings, result.prompt)
      activeController = null
      state.value = { phase: 'idle' }
      return
    }

    state.value = {
      phase: 'revealing',
      original,
      target: result.prompt
    }

    const revealed = await wait(
      spokenTextDurationMs(result.prompt, 0, revealStaggerMs.value),
      controller.signal
    )
    if (!revealed) return

    await writePrompts(bindings, result.prompt)
    activeController = null
    state.value = { phase: 'idle' }
  }

  return {
    api: {
      phase,
      isProcessing,
      isRevealing,
      isLocked,
      revealText,
      revealStaggerMs
    },
    enhanceFrom,
    bind(binding) {
      bindings.add(binding)
    },
    unbind(prompt) {
      for (const binding of bindings) {
        if (binding.prompt === prompt) bindings.delete(binding)
      }
      return bindings.size === 0
    },
    abortActive
  }
}

export function useEnhancePrompt(options: {
  prompt: Ref<string>
  request?: EnhancePromptFn
  widgetId?: WidgetId
  textarea?: MaybeRefOrGetter<HTMLTextAreaElement | null | undefined>
}): EnhancePromptApi {
  const request = options.request ?? enhancePromptRequest
  const reducedMotion = usePreferredReducedMotion()
  const widgetId = options.widgetId
  const session = widgetId
    ? (sharedSessions.get(widgetId) ??
      (() => {
        const created = createSession()
        sharedSessions.set(widgetId, created)
        return created
      })())
    : createSession()

  session.bind({ prompt: options.prompt, textarea: options.textarea })

  onScopeDispose(() => {
    const empty = session.unbind(options.prompt)
    if (!empty) return
    session.abortActive()
    if (widgetId && sharedSessions.get(widgetId) === session) {
      sharedSessions.delete(widgetId)
    }
  })

  return {
    ...session.api,
    enhance: () => session.enhanceFrom(options.prompt, request, reducedMotion)
  }
}
