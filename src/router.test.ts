import { expect, it } from 'vitest'

import { createAppRouter } from '@/router'

it('takes its base path from the URL at construction rather than at import', async () => {
  window.history.replaceState(null, '', '/ComfyUI/')

  const router = await createAppRouter()

  expect(router.options.history.base).toBe('/ComfyUI')
})
