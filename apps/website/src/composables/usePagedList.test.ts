import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { usePagedList } from './usePagedList'

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i)

describe('usePagedList', () => {
  it('shows one page, then the next on request, until the list runs out', () => {
    const { shown, hasMore, showMore } = usePagedList(numbers(5), 2)
    expect(shown.value).toEqual([0, 1])
    expect(hasMore.value).toBe(true)

    showMore()
    showMore()
    expect(shown.value).toEqual([0, 1, 2, 3, 4])
    expect(hasMore.value).toBe(false)
  })

  it('starts again from one page when the list changes', async () => {
    const items = ref(numbers(5))
    const { shown, showMore } = usePagedList(items, 2)
    showMore()
    expect(shown.value).toHaveLength(4)

    items.value = numbers(4)
    await nextTick()
    expect(shown.value).toEqual([0, 1])
  })
})
