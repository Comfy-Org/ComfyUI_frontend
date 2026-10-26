import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { usePagedList } from './usePagedList'

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i)

describe('usePagedList', () => {
  it('shows a page at a time until every item is out', () => {
    const { shown, total, hasMore, showMore } = usePagedList(numbers(5), 2)

    expect(shown.value).toEqual([0, 1])
    expect(total.value).toBe(5)
    showMore()
    showMore()
    expect(shown.value).toEqual(numbers(5))
    expect(hasMore.value).toBe(false)
  })

  it('starts again from the first page when the list itself changes', async () => {
    const items = ref(numbers(5))
    const { shown, showMore } = usePagedList(items, 2)

    showMore()
    items.value = numbers(6)
    await nextTick()

    expect(shown.value).toEqual([0, 1])
  })
})
