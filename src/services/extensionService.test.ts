import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import { importCustomExtension, shouldLoadExtension } from './extensionService'

vi.mock(import('@/platform/telemetry/reportError'))

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

describe('importCustomExtension', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('reports a rejected import once and keeps the load going', async () => {
    const ext = '/extensions/comfyui-broken/main.js'

    await expect(importCustomExtension(ext)).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][1]).toMatchObject({
      errorType: 'extension_load_failed',
      surface: 'platform',
      level: 'warning',
      tags: { extension: ext }
    })
  })

  it('does not pair its own console line with the report', async () => {
    // reportError writes the console record itself, so a second one here would
    // emit the same failure twice — once as an untyped console error.
    await importCustomExtension('/extensions/comfyui-broken/main.js')

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
