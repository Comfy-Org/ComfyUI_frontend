import type realAxios from 'axios'
import { vi } from 'vitest'

const axios: Pick<typeof realAxios, 'get'> = {
  get: vi.fn()
}

export default axios
