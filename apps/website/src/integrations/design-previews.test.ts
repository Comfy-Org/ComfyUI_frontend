import { describe, expect, it, vi } from 'vitest'

import { DESIGN_PREVIEW_ROUTES, isDesignPreviewBuild } from './design-previews'

describe('design previews', () => {
  it('stays out of production builds', () => {
    expect(isDesignPreviewBuild('production')).toBe(false)
  })

  it('builds on pull request previews and locally', () => {
    vi.stubEnv('VERCEL_ENV', undefined)

    expect([isDesignPreviewBuild('preview'), isDesignPreviewBuild()]).toEqual([
      true,
      true
    ])
  })

  it('reads VERCEL_ENV when no environment is passed', () => {
    vi.stubEnv('VERCEL_ENV', 'production')

    expect(isDesignPreviewBuild()).toBe(false)
  })

  it('builds every preview in English and Chinese', () => {
    expect(DESIGN_PREVIEW_ROUTES.map(({ pattern }) => pattern)).toEqual([
      '/hub-preview/node-graph-workflow',
      '/zh-CN/hub-preview/node-graph-workflow'
    ])
  })
})
