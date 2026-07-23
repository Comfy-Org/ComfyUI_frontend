import { describe, expect, it } from 'vitest'

import { shouldLoadExtension } from './extensionService'

describe('shouldLoadExtension', () => {
  it('skips the legacy Cloud RUM extension in cloud builds', () => {
    expect(shouldLoadExtension('/extensions/cloud/rum.js', true)).toBe(false)
  })

  it('keeps the legacy path available outside cloud builds', () => {
    expect(shouldLoadExtension('/extensions/cloud/rum.js', false)).toBe(true)
  })

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})
