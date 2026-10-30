import { assert, describe, expect, it, vi } from 'vitest'

import { CUSTOM_NODE_FAILURES_TRUNCATED_FIELD } from '@/platform/telemetry/customNodeLoadTelemetry'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { CustomNodeLoadFailure } from './customNodeScripts'
import {
  isSafeExtensionBoot,
  reportCustomNodeLoadFailures,
  shouldLoadCustomNodeScript
} from './customNodeScripts'

describe('shouldLoadCustomNodeScript', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(
        shouldLoadCustomNodeScript(extension, { isCloudBuild: true })
      ).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(
        shouldLoadCustomNodeScript(extension, { isCloudBuild: false })
      ).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(
      shouldLoadCustomNodeScript('/extensions/core/foo.js', {
        isCloudBuild: false
      })
    ).toBe(false)
  })

  it('loads other extensions', () => {
    expect(
      shouldLoadCustomNodeScript('/extensions/comfyui-foo/main.js', {
        isCloudBuild: true
      })
    ).toBe(true)
  })

  it('leaves malformed extension entries to the isolated import failure path', () => {
    expect(
      shouldLoadCustomNodeScript('http://', {
        isCloudBuild: false,
        disabledExtensionPaths: ['/extensions/agent-cushions/']
      })
    ).toBe(true)
  })

  it.for([
    { extension: '/extensions/agent-cushions/main.js', expected: false },
    {
      extension: '/extensions/agent-cushions/nested/panel.js',
      expected: false
    },
    { extension: '/extensions/agent-cushions-extra/main.js', expected: true }
  ])(
    'admits $extension as $expected with a disabled extension path',
    ({ extension, expected }) => {
      expect(
        shouldLoadCustomNodeScript(extension, {
          isCloudBuild: false,
          disabledExtensionPaths: ['/extensions/agent-cushions/']
        })
      ).toBe(expected)
    }
  )

  it('skips every custom extension during a safe boot', () => {
    expect(
      shouldLoadCustomNodeScript('/extensions/comfyui-foo/main.js', {
        isCloudBuild: false,
        disableAllCustomExtensions: true
      })
    ).toBe(false)
  })
})

describe('loadCustomNodeScripts', () => {
  it('keeps disabled scripts inert on the CPU-reading import path', async () => {
    const { loadCustomNodeScripts } = await import('./customNodeScripts')
    const { api } = await import('@/scripts/api')
    const executed: string[] = []
    vi.stubGlobal('recordGateScript', (script: string) => executed.push(script))
    const attempt = crypto.randomUUID()
    vi.spyOn(api, 'fileURL').mockImplementation(
      (script) =>
        `data:text/javascript,globalThis.recordGateScript(${JSON.stringify(script)})#${attempt}`
    )

    await loadCustomNodeScripts(
      ['/extensions/blocked/main.js', '/extensions/enabled/main.js'],
      new AbortController().signal,
      Promise.resolve({ answer: 'none' }),
      { disabledExtensionPaths: ['/extensions/blocked/'] }
    )

    expect(executed).toEqual(['/extensions/enabled/main.js'])
  })
})

describe('isSafeExtensionBoot', () => {
  it.for([
    { search: '?safe', expected: true },
    { search: '?safe=1', expected: true },
    { search: '?safe=true', expected: true },
    { search: '?safe=0', expected: false },
    { search: '?safe=false', expected: false },
    { search: '', expected: false }
  ])('reads $search as $expected', ({ search, expected }) => {
    expect(isSafeExtensionBoot(search)).toBe(expected)
  })
})

const BROKEN = '/extensions/comfyui-broken/main.js'

const failureFor = (ext: string): CustomNodeLoadFailure => ({
  ext,
  error: new Error(`Cannot find module '${ext}'`)
})

describe('reportCustomNodeLoadFailures', () => {
  it('stays silent when nothing failed', () => {
    reportCustomNodeLoadFailures([])

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a whole load as one typed error naming the failing packs', () => {
    const firstError = new Error(`Cannot find module '${BROKEN}'`)
    const secondError = new Error("Cannot find module '/extensions/b/b.js'")
    const failures = [
      { ext: BROKEN, error: firstError },
      { ext: '/extensions/b/b.js', error: secondError }
    ]

    reportCustomNodeLoadFailures(failures)

    expect(reportError).toHaveBeenCalledOnce()
    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof AggregateError)
    expect(cause.message).toBe('Error loading extensions')
    expect(cause.stack).toContain(
      `Failed extensions: ${BROKEN}, /extensions/b/b.js`
    )
    expect(options).toMatchObject({
      errorType: 'error_loading_extension',
      surface: 'platform',
      level: 'warning'
    })
    expect(options.tags).toEqual({ failed_extension_count: 2 })
    expect(options.context).toEqual({
      failures: [
        {
          ext: BROKEN,
          message: `Cannot find module '${BROKEN}'`,
          stack: expect.stringContaining(`Cannot find module '${BROKEN}'`)
        },
        {
          ext: '/extensions/b/b.js',
          message: "Cannot find module '/extensions/b/b.js'",
          stack: expect.stringContaining(
            "Cannot find module '/extensions/b/b.js'"
          )
        }
      ]
    })
  })

  it('keeps a batch at the cap untruncated', () => {
    reportCustomNodeLoadFailures(
      Array.from({ length: 10 }, (_, i) =>
        failureFor(`/extensions/pack-${i}/main.js`)
      )
    )

    expect(vi.mocked(reportError).mock.calls[0][1].context).not.toHaveProperty(
      CUSTOM_NODE_FAILURES_TRUNCATED_FIELD
    )
  })

  it('elides the tail once past the naming cap', () => {
    const failures = Array.from({ length: 13 }, (_, i) =>
      failureFor(`/extensions/pack-${i}/main.js`)
    )

    reportCustomNodeLoadFailures(failures)

    const [cause, options] = vi.mocked(reportError).mock.calls[0]
    assert(cause instanceof AggregateError)
    expect(cause.message).toBe('Error loading extensions')
    expect(cause.errors).toHaveLength(10)
    expect(cause.stack).not.toContain('/extensions/pack-10/main.js')
    expect(options.tags).toMatchObject({ failed_extension_count: 13 })
    expect(options.context?.failures).toHaveLength(10)
    expect(options.context?.[CUSTOM_NODE_FAILURES_TRUNCATED_FIELD]).toBe(true)
  })

  it('caps each failure path, message, and stack', () => {
    const error = new Error('m'.repeat(5000))
    error.stack = 's'.repeat(5000)

    reportCustomNodeLoadFailures([
      { ext: `/extensions/comfyui-foo/${'a'.repeat(600)}.js`, error }
    ])

    expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual([
      {
        ext: `/extensions/comfyui-foo/${'a'.repeat(488)}`,
        message: 'm'.repeat(2048),
        stack: 's'.repeat(2048)
      }
    ])
  })

  it.for([
    {
      name: 'an unserializable non-Error value',
      error: Object.create(null, {
        toJSON: {
          value: () => {
            throw new Error('serialization failed')
          }
        }
      })
    },
    {
      name: 'an Error whose message and stack getters throw',
      error: Object.defineProperties(new Error('unused'), {
        message: {
          get: () => {
            throw new Error('message getter failed')
          }
        },
        stack: {
          get: () => {
            throw new Error('stack getter failed')
          }
        }
      })
    },
    {
      name: 'a revoked proxy',
      error: (() => {
        const { proxy, revoke } = Proxy.revocable({}, {})
        revoke()
        return proxy
      })()
    }
  ])('reports $name as an unknown load failure', ({ error }) => {
    reportCustomNodeLoadFailures([{ ext: BROKEN, error }])

    expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual([
      {
        ext: BROKEN,
        message: 'Unknown extension load failure',
        stack: undefined
      }
    ])
  })

  it('records a stack only when the rejection is an Error', () => {
    reportCustomNodeLoadFailures([
      {
        ext: BROKEN,
        error: {
          message: 'thrown object',
          stack: 'at run (/extensions/comfyui-other/main.js:1:1)'
        }
      }
    ])

    expect(vi.mocked(reportError).mock.calls[0][1].context?.failures).toEqual([
      { ext: BROKEN, message: 'thrown object', stack: undefined }
    ])
  })

  it('does not pair its own console line with the report', () => {
    reportCustomNodeLoadFailures([failureFor(BROKEN)])

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
