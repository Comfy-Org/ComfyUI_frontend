import { describe, expect, it, vi } from 'vitest'

import { DESIGN_PREVIEW_ROUTES, injectDesignPreviews } from './design-previews'

describe('design previews', () => {
  it.for([
    { vercelEnv: 'production', injected: [] },
    {
      vercelEnv: 'preview',
      injected: [
        '/hub-preview/node-graph-workflow',
        '/zh-CN/hub-preview/node-graph-workflow'
      ]
    },
    {
      vercelEnv: undefined,
      injected: [
        '/hub-preview/node-graph-workflow',
        '/zh-CN/hub-preview/node-graph-workflow'
      ]
    }
  ])(
    'VERCEL_ENV=$vercelEnv injects $injected.length routes',
    ({ vercelEnv, injected }) => {
      vi.stubEnv('VERCEL_ENV', vercelEnv)
      const injectRoute = vi.fn()

      injectDesignPreviews(injectRoute)

      expect(injectRoute.mock.calls.map(([route]) => route.pattern)).toEqual(
        injected
      )
    }
  )

  it('points every preview route at the node graph page', () => {
    expect(
      DESIGN_PREVIEW_ROUTES.map(({ entrypoint }) =>
        entrypoint.endsWith(
          'src/routes/design-previews/node-graph-workflow.astro'
        )
      )
    ).toEqual([true, true])
  })
})
