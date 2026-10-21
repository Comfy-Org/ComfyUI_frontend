import { describe, expect, it } from 'vitest'

import {
  creatorEntityId,
  hubCreatorPath,
  isCreatorUsername
} from './creator-path'

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

describe('creatorEntityId', () => {
  it.for([
    { username: 'purz', id: 'https://comfy.org/hub/creators/purz/#creator' },
    {
      username: 'ComfyUI',
      id: 'https://comfy.org/hub/creators/comfyui/#creator'
    }
  ])('names $username by the English profile URL', ({ username, id }) => {
    expect(creatorEntityId('https://comfy.org', username)).toBe(id)
  })
})

describe('isCreatorUsername', () => {
  it.for([
    { username: 'purz', valid: true },
    { username: 'Comfy-Creator', valid: true },
    { username: 'a'.repeat(30), valid: true },
    { username: 'a'.repeat(31), valid: false },
    { username: '..', valid: false },
    { username: '../admin', valid: false },
    { username: '-purz', valid: false },
    { username: 'pu rz', valid: false }
  ])('accepts $username: $valid', ({ username, valid }) => {
    expect(isCreatorUsername(username)).toBe(valid)
  })
})
