import { describe, expect, it } from 'vitest'

import { workshopAppHref } from './apps'

describe('workshopAppHref', () => {
  it.for([
    { app: 'studio', href: '/models/apps/cinematic-studio' },
    { app: 'reshoot', href: '/models/apps/reshoot' }
  ] as const)('puts $app at $href', ({ app, href }) => {
    expect(workshopAppHref(app, 'en')).toBe(href)
  })
})
