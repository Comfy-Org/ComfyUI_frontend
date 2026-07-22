import { ref, watch } from 'vue'
import type { Ref } from 'vue'

interface TriggerRange {
  start: number
  end: number
}

/**
 * Detects an in-progress `@word` mention immediately before the caret in a
 * plain textarea, e.g. `input` = "check @load" with the caret at the end
 * yields `mentionQuery` = "load". Callers must call `update()` on caret
 * moves that don't change `input` (e.g. arrow keys, clicks).
 */
export function useMentionTrigger(
  input: Ref<string>,
  getCaretIndex: () => number
) {
  const isMentionActive = ref(false)
  const mentionQuery = ref('')
  const triggerRange = ref<TriggerRange | null>(null)

  function close() {
    isMentionActive.value = false
    mentionQuery.value = ''
    triggerRange.value = null
  }

  function update() {
    const caret = getCaretIndex()
    const textBeforeCaret = input.value.slice(0, caret)
    const atIndex = textBeforeCaret.lastIndexOf('@')
    if (atIndex === -1) return close()

    const charBefore = textBeforeCaret[atIndex - 1]
    if (charBefore !== undefined && !/\s/.test(charBefore)) return close()

    const query = textBeforeCaret.slice(atIndex + 1)
    if (/\s/.test(query)) return close()

    isMentionActive.value = true
    mentionQuery.value = query
    triggerRange.value = { start: atIndex, end: caret }
  }

  watch(input, update, { immediate: true })

  return { isMentionActive, mentionQuery, triggerRange, update, close }
}
