import { describe, expect, it } from 'vitest'

import { DESIGN_PREVIEW_ROUTES, isDesignPreviewBuild } from './design-previews'

describe('design previews', () => {
  it('stays out of production builds', () => {
    expect(isDesignPreviewBuild('production')).toBe(false)
  })

  it('builds on pull request previews and locally', () => {
    expect(isDesignPreviewBuild('preview')).toBe(true)
    expect(isDesignPreviewBuild(undefined)).toBe(true)
  })

  it('builds every preview in English and Chinese', () => {
    const patterns = DESIGN_PREVIEW_ROUTES.map(({ pattern }) => pattern)
    for (const pattern of patterns.filter((p) => !p.startsWith('/zh-CN/')))
      expect(patterns).toContain(`/zh-CN${pattern}`)
  })
})
