import { usePreferredReducedMotion } from '@vueuse/core'
import type { InjectionKey, Ref } from 'vue'
import { computed, onScopeDispose, shallowRef } from 'vue'

import {
  splitWords,
  spokenTextDurationMs,
  wordRevealStaggerMs
} from '@/components/SpokenText/speechTiming'
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

const MIN_SHIMMER_MS = 250

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

export function useEnhancePrompt(options: {
  prompt: Ref<string>
  request?: EnhancePromptFn
}) {
  const prompt = options.prompt
  const request = options.request ?? enhancePromptRequest
  const reducedMotion = usePreferredReducedMotion()
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

  async function enhance() {
    if (state.value.phase !== 'idle') return

    const original = prompt.value
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
      prompt.value = result.prompt
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

    prompt.value = result.prompt
    activeController = null
    state.value = { phase: 'idle' }
  }

  onScopeDispose(abortActive)

  return {
    phase,
    isProcessing,
    isRevealing,
    isLocked,
    revealText,
    revealStaggerMs,
    enhance
  }
}
