import type { Ref } from 'vue'

export const PROMPT_INPUT_FOCUSED_KEY = Symbol('promptInputFocused')
export type PromptInputFocusedContext = Ref<boolean>
