import { describe, expect, it } from 'vitest'

import { workshopAppAt, workshopAppHref } from './apps'

describe('Workshop app pages', () => {
  it.for([
    { app: 'studio', href: '/models/apps/cinematic-studio' },
    { app: 'reshoot', href: '/models/apps/reshoot' }
  ] as const)('puts $app at $href', ({ app, href }) => {
    expect(workshopAppHref(app, 'en')).toBe(href)
    expect(workshopAppAt(`${href}/`, 'en')).toBe(app)
    expect(workshopAppAt(href, 'en')).toBe(app)
  })

  it('names no app for any other page', () => {
    expect(workshopAppAt('/models/', 'en')).toBeUndefined()
    expect(workshopAppAt('/models/apps/other/', 'en')).toBeUndefined()
  })
})
