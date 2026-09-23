import { vi } from 'vitest'
import type { st as realSt, t as realT } from '@/i18n'

export const t = vi.fn<typeof realT>((key) => String(key))
export const st = vi.fn<typeof realSt>(
  (key, fallbackMessage) => fallbackMessage || key
)
