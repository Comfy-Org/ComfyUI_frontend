import { vi } from 'vitest'

vi.mock('@tanstack/vue-virtual', async () => {
  const { computed } = await import('vue')

  return {
    useVirtualizer: (options: {
      count: number
      estimateSize: (index: number) => number
      getItemKey?: (index: number) => number | string
    }) =>
      computed(() => {
        let start = 0
        const items = Array.from({ length: options.count }, (_, index) => {
          const size = options.estimateSize(index)
          const item = {
            key: options.getItemKey?.(index) ?? index,
            index,
            start,
            size
          }

          start += size
          return item
        })

        return {
          getVirtualItems: () => items,
          getTotalSize: () => start
        }
      })
  }
})
