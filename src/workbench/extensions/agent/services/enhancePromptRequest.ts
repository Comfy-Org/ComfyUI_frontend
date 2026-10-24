export type EnhancePromptInput = {
  prompt: string
}

export type EnhancePromptResult =
  | { ok: true; prompt: string }
  | { ok: false; reason: 'empty' | 'failed'; cause?: unknown }

export type EnhancePromptFn = (
  input: EnhancePromptInput
) => Promise<EnhancePromptResult>

const STUB_DELAY_MS = 1200
const STUB_SUFFIX =
  ' — enhanced with richer lighting, camera language, and material detail.'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function stubEnhancedPrompt(prompt: string): string {
  let base = prompt.trim()
  while (base.endsWith(STUB_SUFFIX)) {
    base = base.slice(0, -STUB_SUFFIX.length)
  }
  return `${base}${STUB_SUFFIX}`
}

/**
 * Design stub for the prompt-enhance call. Swap for the real agent/backend endpoint.
 */
export async function enhancePromptRequest(
  input: EnhancePromptInput
): Promise<EnhancePromptResult> {
  try {
    await wait(STUB_DELAY_MS)
    const prompt = input.prompt.trim()
    if (!prompt) return { ok: false, reason: 'empty' }
    return { ok: true, prompt: stubEnhancedPrompt(prompt) }
  } catch (cause) {
    return { ok: false, reason: 'failed', cause }
  }
}
