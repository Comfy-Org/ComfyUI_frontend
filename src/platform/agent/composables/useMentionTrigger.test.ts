import { ref } from 'vue'
import { describe, expect, test } from 'vitest'

import { useMentionTrigger } from '@/platform/agent/composables/useMentionTrigger'

describe('useMentionTrigger', () => {
  test('detects an @mention immediately before the caret', () => {
    const input = ref('check @load')
    const { isMentionActive, mentionQuery } = useMentionTrigger(
      input,
      () => input.value.length
    )

    expect(isMentionActive.value).toBe(true)
    expect(mentionQuery.value).toBe('load')
  })

  test('is inactive when there is no @ before the caret', () => {
    const input = ref('just some text')
    const { isMentionActive } = useMentionTrigger(
      input,
      () => input.value.length
    )

    expect(isMentionActive.value).toBe(false)
  })

  test('closes when whitespace is typed after the @mention', () => {
    const input = ref('check @load')
    const { isMentionActive, update } = useMentionTrigger(
      input,
      () => input.value.length
    )
    expect(isMentionActive.value).toBe(true)

    input.value = 'check @load '
    update()

    expect(isMentionActive.value).toBe(false)
  })

  test('is inactive when @ is part of another word (not preceded by whitespace)', () => {
    const input = ref('user@load')
    const { isMentionActive } = useMentionTrigger(
      input,
      () => input.value.length
    )

    expect(isMentionActive.value).toBe(false)
  })

  test('tracks the correct trigger range for splicing out the mention text', () => {
    const input = ref('check @load')
    const { triggerRange } = useMentionTrigger(input, () => input.value.length)

    expect(triggerRange.value).toEqual({ start: 6, end: 11 })
  })

  test('close() resets active state, query, and trigger range', () => {
    const input = ref('check @load')
    const { isMentionActive, mentionQuery, triggerRange, close } =
      useMentionTrigger(input, () => input.value.length)

    close()

    expect(isMentionActive.value).toBe(false)
    expect(mentionQuery.value).toBe('')
    expect(triggerRange.value).toBeNull()
  })

  test('update() closes the mention when the caret moves outside the trigger range', () => {
    const input = ref('@load rest of message')
    let caret = 4
    const { isMentionActive, update } = useMentionTrigger(input, () => caret)
    expect(isMentionActive.value).toBe(true)

    caret = 0
    update()

    expect(isMentionActive.value).toBe(false)
  })
})
