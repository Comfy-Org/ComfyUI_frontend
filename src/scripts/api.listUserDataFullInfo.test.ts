import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '@comfyorg/api-client/ComfyApi'
import { api } from '@/scripts/api'

describe('api.listUserDataFullInfo', () => {
  it('returns an empty list for a missing directory', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 404 })
    )

    await expect(api.listUserDataFullInfo('workflows')).resolves.toEqual([])
  })

  it('throws UnauthorizedError on a 401', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 401 })
    )

    await expect(api.listUserDataFullInfo('workflows')).rejects.toThrow(
      UnauthorizedError
    )
  })

  it('throws a plain Error on other failures', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 500 })
    )

    const failure = api.listUserDataFullInfo('workflows')
    await expect(failure).rejects.toThrow(
      "Error getting user data list 'workflows': 500"
    )
    await expect(failure).rejects.not.toBeInstanceOf(UnauthorizedError)
  })
})
