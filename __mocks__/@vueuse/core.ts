import { vi } from 'vitest'
import type { useEventListener as realUseEventListener } from '@vueuse/core'

export const useEventListener = vi.fn<typeof realUseEventListener>(() =>
  vi.fn()
)
