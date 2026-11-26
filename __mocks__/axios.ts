import { vi } from 'vitest'
import type realAxios from 'axios'

const axios: Pick<typeof realAxios, 'get'> = {
  get: vi.fn()
}

export default axios
