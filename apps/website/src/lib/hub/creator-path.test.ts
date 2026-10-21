import { describe, expect, it } from 'vitest'

import { hubCreatorPath } from './creator-path'

describe('hubCreatorPath', () => {
  it.for([
    { username: 'purz', locale: 'en', path: '/hub/creators/purz/' },
    { username: 'ComfyUI', locale: 'en', path: '/hub/creators/comfyui/' },
    { username: 'purz', locale: 'zh-CN', path: '/zh-CN/hub/creators/purz/' },
    { username: 'a b/c', locale: 'en', path: '/hub/creators/a%20b%2Fc/' }
  ])('links $username in $locale to $path', ({ username, locale, path }) => {
    expect(hubCreatorPath(username, locale)).toBe(path)
  })
})
