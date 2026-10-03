import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { api } from '@/scripts/api'

import { shouldLoadExtension, useExtensionService } from './extensionService'

vi.mock(import('@/extensions/core/index'), () => ({}))

describe('loadExtensions', () => {
  it('isolates a malformed extension and still loads healthy extensions', async () => {
    const brokenExtension = 'data:text/javascript,export const value = }'
    const healthyExtension = `data:text/javascript,${encodeURIComponent(
      'window.dispatchEvent(new Event("healthyExtensionLoaded"))'
    )}`
    const onLoaded = vi.fn()
    window.addEventListener('healthyExtensionLoaded', onLoaded)
    onTestFinished(() => {
      window.removeEventListener('healthyExtensionLoaded', onLoaded)
    })
    vi.spyOn(api, 'getExtensions').mockResolvedValue([
      brokenExtension,
      healthyExtension
    ])
    vi.spyOn(api, 'fileURL').mockImplementation((url) => url)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      useExtensionService().loadExtensions()
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      'Error loading extension',
      brokenExtension,
      expect.any(SyntaxError)
    )
    expect(onLoaded).toHaveBeenCalledOnce()
  })
})

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})
