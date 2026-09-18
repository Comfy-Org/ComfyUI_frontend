import { vi } from 'vitest'
import type realAxios from 'axios'

export default {
  get: vi.fn<typeof realAxios.get>()
}
