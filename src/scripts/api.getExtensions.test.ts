import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

describe('api.getExtensions', () => {
  it.for([
    { name: 'empty list', paths: [] },
    {
      name: 'multiple paths',
      paths: ['/extensions/core.js', '/extensions/custom/widget.js']
    }
  ])('returns $name unchanged', async ({ paths }) => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json(paths))

    await expect(api.getExtensions()).resolves.toEqual(paths)
  })

  it.for([
    { name: 'object envelope', payload: { extensions: [] } },
    { name: 'non-string entry', payload: ['/extensions/core.js', 17] },
    { name: 'null list', payload: null }
  ])('rejects $name', async ({ payload }) => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json(payload))

    await expect(api.getExtensions()).rejects.toMatchObject({
      name: 'ZodError'
    })
  })
})
