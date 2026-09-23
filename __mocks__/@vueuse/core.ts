import type { useEventListener as realUseEventListener } from '@vueuse/core'
import { vi } from 'vitest'

export const useEventListener = vi.fn<typeof realUseEventListener>(() =>
  vi.fn()
)
