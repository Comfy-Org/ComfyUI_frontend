import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { api } from '@/scripts/api'

const FREE_ROUTE = { method: 'POST', url: /\/api\/free$/ }

describe('api.freeMemory toast', () => {
  it.for([
    {
      name: 'models and cache cleared',
      freeExecutionCache: true,
      answer: () => new Response(null, { status: 200 }),
      expected: {
        kind: 'success',
        title: 'Models and Execution Cache have been cleared.'
      }
    },
    {
      name: 'models unloaded',
      freeExecutionCache: false,
      answer: () => new Response(null, { status: 200 }),
      expected: { kind: 'success', title: 'Models have been unloaded.' }
    },
    {
      name: 'server rejects the request',
      freeExecutionCache: false,
      answer: () => new Response(null, { status: 404 }),
      expected: {
        kind: 'error',
        title:
          'Unloading of models failed. Installed ComfyUI may be an outdated version.'
      }
    },
    {
      name: 'server unreachable',
      freeExecutionCache: false,
      answer: () => Promise.reject(new TypeError('offline')),
      expected: {
        kind: 'error',
        title: 'An error occurred while trying to unload models.'
      }
    }
  ])('$name', async ({ freeExecutionCache, answer, expected }) => {
    respondToFetch(FREE_ROUTE, answer)

    await api.freeMemory({ freeExecutionCache })

    expect(useToast().toasts).toEqual([expect.objectContaining(expected)])
  })
})
