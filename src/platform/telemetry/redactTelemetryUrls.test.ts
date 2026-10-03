import { describe, expect, it } from 'vitest'

import {
  redactTelemetryUrls,
  redactTelemetryValues
} from './redactTelemetryUrls'

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
      kind: 'single-segment relative query',
      input: 'model.glb?token=SECRET',
      expected: 'model.glb'
    },
    {
      kind: 'bracketed query keys',
      input: 'https://h/api/view?filter[id]=1&token=SECRET',
      expected: 'https://h/api/view'
    }
  ])('$kind', ({ input, expected }) => {
    it('redacts URL metadata', () => {
      expect(redactTelemetryUrls(input)).toBe(expected)
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
    const boundary = '['.repeat(20_000)
    expect(
      redactTelemetryUrls(
        `https://a.test/x?token=1${boundary}https://user:secret@b.test/y?token=2`
      )
    ).toBe(`https://a.test/x${boundary}https://b.test/y`)
  }, 500)
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
    let shared: Record<string, unknown> = {
      url: 'https://example.com/a?token=secret'
    }
    for (let depth = 0; depth < 30; depth++) {
      shared = { left: shared, right: shared }
    }

    const redacted = redactTelemetryValues({ shared })?.shared
    if (typeof redacted !== 'object' || redacted === null) {
      throw new Error('Expected a redacted shared object')
    }
    if (!('left' in redacted) || !('right' in redacted)) {
      throw new Error('Expected the shared branches')
    }
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
    expect(redacted).toBeDefined()
    if (!redacted) throw new Error('Expected redacted telemetry values')

    if (!(redacted.error instanceof Error)) {
      throw new Error('Expected redacted Error')
    }
    expect(redacted.error.message).toBe('failed https://example.com/a.glb')
    expect(redacted.error.name).toBe('AssetLoadError https://example.com/name')
    expect(redacted.error.stack).toBe(
      'at load (https://example.com/load.js:1:2)'
    )
    if (!(redacted.error.cause instanceof Error)) {
      throw new Error('Expected redacted Error cause')
    }
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
    const root: Record<string, unknown> = {}
    let current = root
    for (let depth = 0; depth < 100_000; depth++) {
      const next: Record<string, unknown> = {}
      current.next = next
      current = next
    }
    current.url = 'https://user:secret@example.com/model.glb?token=private'

    let redacted: unknown = redactTelemetryValues(root)
    for (let depth = 0; depth < 32; depth++) {
      if (
        typeof redacted !== 'object' ||
        redacted === null ||
        !('next' in redacted)
      ) {
        throw new Error(`Expected object with next at depth ${depth}`)
      }
      redacted = redacted.next
    }
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
    if (!redacted) throw new Error('Expected redacted telemetry values')

    expect(redacted.array).toBe('[Redacted]')
    if (!(redacted.error instanceof Error)) {
      throw new Error('Expected redacted Error')
    }
    expect(redacted.error.message).toBe('[Redacted]')
    expect(message).not.toHaveBeenCalled()
  })
})
