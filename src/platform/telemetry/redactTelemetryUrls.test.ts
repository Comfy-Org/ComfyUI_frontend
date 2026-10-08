import { assert, describe, expect, it } from 'vitest'

import {
  redactTelemetryUrls,
  redactTelemetryValues
} from './redactTelemetryUrls'

function denselySharedValue(): Record<string, unknown> {
  let shared: Record<string, unknown> = {
    url: 'https://example.com/a?token=secret'
  }
  for (let depth = 0; depth < 30; depth++) {
    shared = { left: shared, right: shared }
  }
  return shared
}

function overBudgetValue(): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let current = root
  for (let depth = 0; depth < 100_000; depth++) {
    const next: Record<string, unknown> = {}
    current.next = next
    current = next
  }
  current.url = 'https://user:secret@example.com/model.glb?token=private'
  return root
}

function followNext(value: unknown, count: number): unknown {
  let current = value
  for (let depth = 0; depth < count; depth++) {
    assert.isObject(current)
    assert.property(current, 'next')
    current = (current as Record<string, unknown>).next
  }
  return current
}

describe('redactTelemetryUrls', () => {
  describe.for([
    {
      kind: 'absolute query',
      input: 'https://example.com/model.glb?email=a@b.com&token=private',
      expected: 'https://example.com/model.glb'
    },
    {
      kind: 'absolute credentials and fragment',
      input: 'https://user:p@ss@example.com/model.glb#token=private',
      expected: 'https://example.com/model.glb'
    },
    {
      kind: 'protocol-relative credentials',
      input: '//user:secret@example.com/model.glb?token=private',
      expected: '//example.com/model.glb'
    },
    {
      kind: 'credentials containing URL sub-delimiters',
      input: 'https://user:pa,ss;word@example.com/model.glb',
      expected: 'https://example.com/model.glb'
    },
    {
      kind: 'query values containing URL sub-delimiters',
      input: 'https://example.com/model.glb?token=private,still;private',
      expected: 'https://example.com/model.glb'
    },
    {
      kind: 'root-relative query',
      input: '/api/view?sig=SECRET&x=1?y=2',
      expected: '/api/view'
    },
    {
      kind: 'root-relative single-character segment',
      input: 'GET /v?token=SECRET failed',
      expected: 'GET /v failed'
    },
    {
      kind: 'root-relative nested single-character segments',
      input: 'GET /a/b?token=SECRET failed',
      expected: 'GET /a/b failed'
    },
    {
      kind: 'root-relative digit-led segment',
      input: 'GET /1a?token=SECRET failed',
      expected: 'GET /1a failed'
    },
    {
      kind: 'uppercase scheme',
      input: 'HTTPS://user:secret@example.com/model.glb?token=private',
      expected: 'HTTPS://example.com/model.glb'
    },
    {
      kind: 'IPv6 authority with credentials',
      input: 'http://user:secret@[::1]:8188/model.glb?token=private',
      expected: 'http://[::1]:8188/model.glb'
    },
    {
      kind: 'credentials with no scheme and no path',
      input: '//user:secret@example.com?token=private',
      expected: '//example.com'
    },
    {
      kind: 'URL nested in an outer query',
      input: 'https://a.test/cb?next=https%3A%2F%2Fb.test%2F%3Ftoken%3Dprivate',
      expected: 'https://a.test/cb'
    },
    {
      kind: 'empty authority',
      input: 'https:///model.glb?token=private',
      expected: 'https:///model.glb'
    },
    {
      kind: 'scheme with no authority',
      input: 'https://',
      expected: 'https://'
    },
    {
      kind: 'single-segment relative query',
      input: 'model.glb?token=SECRET',
      expected: 'model.glb'
    },
    {
      kind: 'bracketed query keys',
      input: 'https://h/api/view?filter[id]=1&token=SECRET',
      expected: 'https://h/api/view'
    },
    {
      kind: 'site-root OAuth callback',
      input: '/?code=SECRET',
      expected: '/'
    },
    {
      kind: 'single-digit root path',
      input: '/1?token=SECRET',
      expected: '/1'
    },
    {
      kind: 'bare callback route',
      input: 'callback?code=SECRET',
      expected: 'callback'
    },
    {
      kind: 'relative fragment without an equals sign',
      input: 'model.glb#private',
      expected: 'model.glb'
    },
    {
      kind: 'query value containing a space',
      input: 'GET /api/view?filename=my file.png&token=SECRET',
      expected: 'GET /api/view'
    }
  ])('$kind', ({ input, expected }) => {
    it('redacts URL metadata', () => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    })
  })

  describe.for([
    { kind: 'a fraction with a query suffix', text: 'ratio 1/2?token=secret' },
    {
      kind: 'a fraction with a spaced query suffix',
      text: 'ratio 1/2?x=a b&y=c'
    },
    { kind: 'a progress fraction', text: 'progress 3/4 done' },
    { kind: 'a route with an id', text: 'GET /api/jobs/42 -> 500' },
    { kind: 'a route with no query', text: '/api/userdata/workflows' },
    { kind: 'an absolute file path', text: '/home/u/models/x.safetensors' },
    { kind: 'a Windows file path', text: 'C:\\Users\\u\\workflow.json' },
    { kind: 'a version string', text: 'comfyui 1.2.3 ready' },
    { kind: 'a bare question', text: 'Can this work?' }
  ])('$kind', ({ text }) => {
    it('survives redaction unchanged', () => {
      expect(redactTelemetryUrls(text)).toBe(text)
    })
  })

  it('redacts adjacent URLs without consuming punctuation or stack locations', () => {
    expect(
      redactTelemetryUrls(
        'https://a/b,https://user:pw@c/d?t=1; at f (https://host/a.js?v=1:12:9)'
      )
    ).toBe('https://a/b,https://c/d; at f (https://host/a.js:12:9)')
  })

  describe.for([
    { boundary: '][', expected: '][', kind: 'square brackets' },
    { boundary: ')(', expected: ')(', kind: 'parentheses' },
    { boundary: '}{', expected: '}{', kind: 'braces' },
    { boundary: ',;', expected: ',;', kind: 'separators' }
  ])('$kind', ({ boundary, expected }) => {
    it('redacts URL starts glued by punctuation', () => {
      expect(
        redactTelemetryUrls(
          `https://user:one@a.test/x?token=1${boundary}https://user:two@b.test/y?token=2`
        )
      ).toBe(`https://a.test/x${expected}https://b.test/y`)
    })
  })

  it('redacts proxy-like paths without changing ordinary question text', () => {
    expect(
      redactTelemetryUrls(
        'Can this work? proxy/https://user:secret@c.test/z?token=3'
      )
    ).toBe('Can this work? proxy/https://c.test/z')
  })

  it('redacts query data from relative path references', () => {
    expect(
      redactTelemetryUrls(
        'request api/view?token=SECRET and assets/a.glb#private'
      )
    ).toBe('request api/view and assets/a.glb')
  })

  it('peels long punctuation suffixes without changing the URL payload', () => {
    const trailing = ')'.repeat(1_000)
    expect(
      redactTelemetryUrls(
        `https://user:secret@example.com/model.glb?token=private${trailing}`
      )
    ).toBe(`https://example.com/model.glb${trailing}`)
  })

  it('handles long glued-URL punctuation runs within a bounded time', () => {
    const boundary = '['.repeat(10_000)
    expect(
      redactTelemetryUrls(
        `https://a.test/x?token=1${boundary}https://user:secret@b.test/y?token=2`
      )
    ).toBe(`https://a.test/x${boundary}https://b.test/y`)
  })

  it('handles a long dotted non-URL run without pathological rescanning', () => {
    const text = 'a.'.repeat(20_000)
    expect(redactTelemetryUrls(text)).toBe('[Redacted]')
  })
})

describe('redactTelemetryValues', () => {
  it('redacts URL credentials inside nested console arguments', () => {
    expect(
      redactTelemetryValues({
        arguments: [
          'Error loading model:',
          { message: 'failed https://user:secret@example.com/a.glb?token=x' }
        ]
      })
    ).toEqual({
      arguments: [
        'Error loading model:',
        { message: 'failed https://example.com/a.glb' }
      ]
    })
  })

  it('preserves repeated DAG values while still marking ancestor cycles', () => {
    const shared = { url: 'https://example.com/a?token=secret' }
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic

    expect(
      redactTelemetryValues({ first: shared, second: shared, cyclic })
    ).toEqual({
      first: { url: 'https://example.com/a' },
      second: { url: 'https://example.com/a' },
      cyclic: { self: '[Circular]' }
    })
  })

  it('memoizes densely shared objects instead of rewalking every path', () => {
    const redacted = redactTelemetryValues({ shared: denselySharedValue() })
      ?.shared as Record<string, unknown>

    assert.isObject(redacted)
    assert.property(redacted, 'left')
    assert.property(redacted, 'right')
    expect(redacted.left).toBe(redacted.right)
  })

  it('redacts errors and URLs while failing closed for other object instances', () => {
    const error = new Error(
      'failed https://user:secret@example.com/a.glb?token=x'
    )
    error.name =
      'AssetLoadError https://user:secret@example.com/name?token=private'
    Object.defineProperty(error, 'stack', {
      configurable: true,
      value: 'at load (https://user:secret@example.com/load.js?token=x:1:2)',
      writable: true
    })
    const cause = new Error(
      'cause https://user:secret@example.com/cause.glb?token=x'
    )
    cause.cause = error
    error.cause = cause
    const date = new Date()
    const url = new URL(
      'https://user:secret@example.com/model.glb?token=private#fragment'
    )
    const getter = vi.fn(() => 'https://example.com/a?token=x')
    const value = Object.defineProperty({}, 'unsafe', {
      enumerable: true,
      get: getter
    })

    const redacted = redactTelemetryValues({ error, date, url, value })
    assert.exists(redacted)

    assert.instanceOf(redacted.error, Error)
    expect(redacted.error.message).toBe('failed https://example.com/a.glb')
    expect(redacted.error.name).toBe('AssetLoadError https://example.com/name')
    expect(redacted.error.stack).toBe(
      'at load (https://example.com/load.js:1:2)'
    )
    assert.instanceOf(redacted.error.cause, Error)
    expect(redacted.error.cause.message).toBe(
      'cause https://example.com/cause.glb'
    )
    expect(redacted.error.cause.cause).toBe('[Circular]')
    expect(redacted.date).toBe('[Redacted]')
    expect(redacted.url).toBe('https://example.com/model.glb')
    expect(redacted.value).toEqual({})
    expect(getter).not.toHaveBeenCalled()
  })

  it('passes through proxies that reject reflection without throwing', () => {
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()

    expect(redactTelemetryValues({ proxy })?.proxy).toBe('[Redacted]')
  })

  it('fails closed for values beyond the traversal budgets', () => {
    const redacted = followNext(redactTelemetryValues(overBudgetValue()), 32)
    expect(redacted).toBe('[Redacted]')
  })

  it('fails closed without invoking hostile array or Error accessors', () => {
    const array = Proxy.revocable<unknown[]>([], {})
    array.revoke()
    const message = vi.fn(() => 'secret')
    const error = Object.defineProperty(new Error(), 'message', {
      enumerable: true,
      get: message
    })

    const redacted = redactTelemetryValues({ array: array.proxy, error })
    assert.exists(redacted)

    expect(redacted.array).toBe('[Redacted]')
    assert.instanceOf(redacted.error, Error)
    expect(redacted.error.message).toBe('[Redacted]')
    expect(message).not.toHaveBeenCalled()
  })

  it('drops functions and preserves sparse array positions', () => {
    const values: unknown[] = []
    values[2] = 'https://example.com/a?token=secret'
    Object.assign(values, {
      meta: 'https://example.com/meta?token=secret'
    })

    const redacted = redactTelemetryValues({ callback: () => 'secret', values })

    expect(redacted?.callback).toBe('[Redacted]')
    expect(redacted?.values).toStrictEqual(
      Object.assign([], { 2: 'https://example.com/a' })
    )
  })

  it('redacts record keys without treating __proto__ as a setter', () => {
    const value = JSON.parse(
      '{"https://example.com/a?token=secret":"failed","__proto__":{"safe":true}}'
    )

    const redacted = redactTelemetryValues({ value })?.value

    expect(redacted).toEqual(
      Object.fromEntries([
        ['https://example.com/a', 'failed'],
        ['__proto__', { safe: true }]
      ])
    )
    expect(Object.getPrototypeOf(redacted)).toBeNull()
  })

  it('preserves inherited Error names and empty messages', () => {
    const error = new TypeError()
    Object.defineProperty(error, 'stack', {
      configurable: true,
      value: undefined
    })

    const redacted = redactTelemetryValues({ error })?.error

    assert.instanceOf(redacted, Error)
    expect(redacted.name).toBe('TypeError')
    expect(redacted.message).toBe('')
  })
})
