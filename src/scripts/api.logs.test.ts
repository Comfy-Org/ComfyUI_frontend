import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

vi.mock(import('axios'))

describe('api.getLogs', () => {
  it.for([
    {
      name: 'local JSON string',
      data: '2026-09-15T12:34:56 - ready\n',
      expected: '2026-09-15T12:34:56 - ready\n'
    },
    {
      name: 'cloud JSON array',
      data: [{ level: 'info', message: 'System is running normally' }],
      expected:
        '[\n  {\n    "level": "info",\n    "message": "System is running normally"\n  }\n]'
    },
    {
      name: 'empty response body',
      data: undefined,
      expected: ''
    }
  ])('returns text for $name', async ({ data, expected }) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data })

    await expect(api.getLogs()).resolves.toBe(expected)
  })
})
