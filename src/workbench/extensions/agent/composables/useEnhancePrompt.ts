import { usePreferredReducedMotion } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, onScopeDispose, shallowRef } from 'vue'

import { enhancePromptRequest } from '@/workbench/extensions/agent/services/enhancePromptRequest'
import type { EnhancePromptFn } from '@/workbench/extensions/agent/services/enhancePromptRequest'

export type EnhancePromptPhase = 'idle' | 'processing' | 'revealing'

export type EnhancePromptState =
  | { phase: 'idle' }
  | { phase: 'processing'; original: string }
  | { phase: 'revealing'; original: string; target: string }

export type RevealPromptInput = {
  text: string
  write: (shown: string) => void
  signal: AbortSignal
}

export type RevealPrompt = (input: RevealPromptInput) => Promise<void>

const WORD_REVEAL_MS = 24

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

export async function revealPromptText({
  text,
  write,
  signal
}: RevealPromptInput): Promise<void> {
  const parts = text.split(/(\s+)/)
  let shown = ''
  for (const part of parts) {
    if (signal.aborted) return
    shown += part
    write(shown)
    if (!(await wait(WORD_REVEAL_MS, signal))) return
  }
}

export function useEnhancePrompt(options: {
  prompt: Ref<string>
  request?: EnhancePromptFn
  reveal?: RevealPrompt
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

  function abortActive() {
    activeController?.abort()
    activeController = null
    if (state.value.phase === 'revealing') {
      prompt.value = state.value.original
    }
    state.value = { phase: 'idle' }
  }

  async function enhance() {
    if (state.value.phase !== 'idle') return

    const original = prompt.value
    const controller = new AbortController()
    activeController = controller
    state.value = { phase: 'processing', original }

    const result = await request({ prompt: original })
    if (controller.signal.aborted) return
    if (!result.ok) {
      activeController = null
      state.value = { phase: 'idle' }
      return
    }

    state.value = {
      phase: 'revealing',
      original,
      target: result.prompt
    }

    const reveal =
      options.reveal ??
      (reducedMotion.value === 'reduce'
        ? async ({ text, write }: RevealPromptInput) => {
            write(text)
          }
        : revealPromptText)

    await reveal({
      text: result.prompt,
      write: (shown) => {
        if (!controller.signal.aborted) prompt.value = shown
      },
      signal: controller.signal
    })

    if (activeController !== controller) return
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
    enhance
  }
}
