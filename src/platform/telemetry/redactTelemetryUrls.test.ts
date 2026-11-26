import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  REDACTION_SENTINEL,
  redactTelemetryError,
  redactTelemetryUrls,
  redactTelemetryValues
} from '@comfyorg/telemetry/redactTelemetryUrls'

function replaceStackFormatter(replacement?: PropertyDescriptor): void {
  const original = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace')
  setStackFormatter(replacement)
  onTestFinished(() => setStackFormatter(original))
}

function setStackFormatter(descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(Error, 'prepareStackTrace', descriptor)
  } else {
    Reflect.deleteProperty(Error, 'prepareStackTrace')
  }
}

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
      kind: 'protocol-relative credentials glued on by an apostrophe',
      input: "https://a.test/x'//user:secret@b.test/y",
      expected: "https://a.test/x'//b.test/y"
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
      kind: 'bare-word fragment key containing a dot',
      input: 'cb#a.b=SECRET',
      expected: 'cb'
    },
    {
      kind: 'bare-word fragment key containing brackets',
      input: 'callback#filter[x]=SECRET',
      expected: 'callback'
    },
    {
      kind: 'query value containing a space',
      input: 'GET /api/view?filename=my file.png&token=SECRET',
      expected: 'GET /api/view'
    },
    {
      kind: 'query value containing more than one space',
      input: 'GET /api/view?filename=my big file name.png&token=SECRET',
      expected: 'GET /api/view'
    },
    {
      kind: 'bare token with a spaced query value',
      input: 'callback?f=a b&token=SECRET',
      expected: 'callback'
    },
    {
      kind: 'relative-word query with a valueless leading parameter',
      input: 'callback?flag&access_token=SECRET',
      expected: 'callback'
    },
    {
      kind: 'relative-word dotted query with a valueless leading parameter',
      input: 'asset.glb?raw&token=SECRET',
      expected: 'asset.glb'
    },
    {
      kind: 'relative-word query with an empty leading parameter',
      input: 'next?&token=SECRET',
      expected: 'next'
    },
    {
      kind: 'relative-word fragment with a valueless leading parameter',
      input: 'cb#flag&access_token=SECRET',
      expected: 'cb'
    },
    {
      kind: 'relative-word query with multiple valueless leading parameters',
      input: 'callback?a&b&c&access_token=SECRET',
      expected: 'callback'
    },
    {
      kind: 'digit-led root segment before more path',
      input: 'GET /1/x?token=SECRET',
      expected: 'GET /1/x'
    },
    {
      kind: 'bare query with no URL-shaped prefix',
      input: '?token=secret',
      expected: ''
    },
    {
      kind: 'bare fragment with no URL-shaped prefix',
      input: '#access_token=x',
      expected: ''
    },
    {
      kind: 'bare query with a spaced value',
      input: '?q=a b&token=SECRET',
      expected: ''
    },
    {
      kind: 'bare fragment with a spaced value',
      input: '#access_token=a b&token=SECRET',
      expected: ''
    },
    {
      kind: 'bare query with a bracketed key and a spaced value',
      input: '?filter[id]=a b&token=SECRET',
      expected: ''
    },
    {
      kind: 'bare query starting with a valueless flag',
      input: '?flag&access_token=SECRET',
      expected: ''
    },
    {
      kind: 'bare fragment starting with a valueless flag',
      input: '#flag&token=SECRET',
      expected: ''
    },
    {
      kind: 'bare query starting with an empty parameter before an ampersand',
      input: '?&token=SECRET',
      expected: ''
    },
    {
      kind: 'bare query starting with an empty key before an equals sign',
      input: '?=x&token=SECRET',
      expected: ''
    },
    {
      kind: 'numeric query value resembling stack coordinates',
      input: 'https://h/x?secret=12:30:45',
      expected: 'https://h/x'
    },
    {
      kind: 'numeric fragment value resembling stack coordinates',
      input: 'https://h/x#secret=12:30:45',
      expected: 'https://h/x'
    }
  ])('$kind', ({ input, expected }) => {
    it('redacts URL metadata', () => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    })
  })

  it('redacts a query value containing an apostrophe without leaking the rest of the query', () => {
    const redacted = redactTelemetryUrls(
      "https://h/api/search?q=o'brien&token=SECRET"
    )
    expect(redacted).toBe('https://h/api/search')
  })

  describe.for([
    {
      kind: 'two apostrophes glued by a comma inside a query value',
      input: "https://h/x?q=o','&token=SECRET"
    },
    {
      kind: 'two apostrophes glued by a period inside a query value',
      input: "https://h/x?q=a'.'&token=SECRET"
    },
    {
      kind: 'ordinary query text after the second apostrophe',
      input: "https://h/x?q=o','b&token=SECRET"
    },
    {
      kind: 'a bare fragment after the second apostrophe',
      input: "https://h/x?q=o','b#SECRET"
    },
    {
      kind: 'a bare question after the second apostrophe',
      input: "https://h/x?q=o','b?SECRET"
    }
  ])('$kind', ({ input }) => {
    it('does not let a later token survive unredacted', () => {
      expect(redactTelemetryUrls(input)).toBe('https://h/x')
    })
  })

  it.for([
    "https://h/x?q=o','b',&token=SECRET",
    "'https://h/x?q=o','b',&token=SECRET",
    "'https://h/x?q=o','b',&SECRET",
    "'https://h/x?q=o','b',;token=SECRET",
    "'https://h/x?q=o','b',token=SECRET",
    "https://h/x?q=o','SECRET'"
  ])('fails closed on ambiguous query continuations: %s', (input) => {
    expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
  })

  it('fails closed on an ambiguous query continuation after a spaced match', () => {
    expect(redactTelemetryUrls("https://h/x?q=a b&k=1','SECRET'")).toBe(
      REDACTION_SENTINEL
    )
  })

  it.for([
    {
      kind: 'a quoted phrase ending in a URL with ordinary text after the quote',
      input: "Request 'GET /api/history?max_items=64' failed",
      expected: "Request 'GET /api/history' failed"
    },
    {
      kind: 'a parenthesized diagnostic ending in a quoted URL',
      input: "HTTPError('Not Found for url: https://h/x?expand=1')",
      expected: "HTTPError('Not Found for url: https://h/x')"
    },
    {
      kind: 'a quoted phrase containing a URL followed by more prose',
      input: "see 'the URL https://h/y?t=2' for details",
      expected: "see 'the URL https://h/y' for details"
    }
  ])('does not fail closed on $kind', ({ input, expected }) => {
    expect(redactTelemetryUrls(input)).toBe(expected)
  })

  describe.for([
    {
      kind: 'a semicolon-glued suffix after the query apostrophe',
      input: "https://h/x?q=o';token=SECRET",
      expected: 'https://h/x'
    },
    {
      kind: 'a quoted URL followed by sentence punctuation',
      input: "'https://h/x?token=SECRET'.",
      expected: "'https://h/x'."
    },
    {
      kind: 'a quoted URL followed by an exclamation mark',
      input: "say 'https://h/x?token=S'!",
      expected: "say 'https://h/x'!"
    },
    {
      kind: 'a closing punctuation run before another quoted value',
      input: "('https://h/x?t=1'),'next'",
      expected: "('https://h/x'),'next'"
    },
    {
      kind: 'a period-glued suffix after the query apostrophe',
      input: "https://h/x?q=a'.b&token=SECRET",
      expected: 'https://h/x'
    },
    {
      kind: 'sentence punctuation after the next quoted diagnostic',
      input: "('https://h/x?t=1'),'next.value'.",
      expected: "('https://h/x'),'next.value'."
    }
  ])('$kind', ({ input, expected }) => {
    it('redacts a query apostrophe without leaking the rest of the query', () => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    })
  })

  it.for(['next.value', '/next/path', 'next phrase'])(
    'preserves a quoted diagnostic containing %s',
    (diagnostic) => {
      expect(redactTelemetryUrls(`('https://h/x?t=1'),'${diagnostic}'`)).toBe(
        `('https://h/x'),'${diagnostic}'`
      )
    }
  )

  it.for(['', '!', '~', ':', '+', '-'])(
    'redacts a later explicit authority after %s glue',
    (glue) => {
      expect(
        redactTelemetryUrls(`https://a.test/x${glue}https://user:pw@b.test/y`)
      ).toBe(`https://a.test/x${glue}https://b.test/y`)
    }
  )

  it.for([
    {
      kind: 'a query parameter value',
      input:
        'https://auth.example/login?redirect_uri=https://app.example/reset/abc123',
      expected: 'https://auth.example/login'
    },
    {
      kind: 'a fragment value',
      input:
        'https://auth.example/login#redirect_uri=https://app.example/reset/abc123',
      expected: 'https://auth.example/login'
    }
  ])(
    "does not treat a scheme-bearing URL nested inside the current URL's $kind as a glued-URL boundary",
    ({ input, expected }) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  it.for([
    {
      kind: 'its own trailing query',
      input: 'https://auth/login?redirect_uri=https://app/reset/abc123?mode=1'
    },
    {
      kind: 'its own trailing fragment',
      input: 'https://auth/login?redirect_uri=https://app/reset/abc123#state'
    }
  ])(
    'drops the rest of the token once the outer query has opened, even when the nested URL has $kind',
    ({ input }) => {
      expect(redactTelemetryUrls(input)).toBe('https://auth/login')
    }
  )

  it.for([
    {
      kind: 'a comma',
      input: 'https://h/x?urls=a,https://b/reset/T&token=SECRET'
    },
    {
      kind: 'a pipe',
      input: 'https://h/x?urls=a|https://b/reset/T&token=SECRET'
    },
    {
      kind: 'a semicolon',
      input: 'https://h/x?urls=a;https://b/reset/T&token=SECRET'
    },
    {
      kind: 'a literal slash',
      input: 'https://h/x?urls=a/https://b/reset/T&token=SECRET'
    }
  ])(
    'does not treat a URL glued on by $kind as a boundary when it has no query of its own and is still inside the current query',
    ({ input }) => {
      expect(redactTelemetryUrls(input)).toBe('https://h/x')
    }
  )

  it.for([
    ["['a/b?t=1','c/d?t=2']", "['a/b','c/d']"],
    ["['/x?t=1','/y?t=2']", "['/x','/y']"],
    ["['callback?code=1','next?code=2']", "['callback','next']"]
  ])(
    'redacts relative URL arrays without merging elements: %s',
    ([input, expected]) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  it.for(['', '/a!'])('preserves //...@ inside the path after %s', (prefix) => {
    const redacted = redactTelemetryUrls(
      `https://safe.example${prefix}//path@user.com?token=secret`
    )
    expect(redacted).toBe(`https://safe.example${prefix}//path@user.com`)
  })

  it.for([
    {
      kind: 'a single trailing dot',
      input: 'file.?token=SECRET',
      expected: 'file.'
    },
    {
      kind: 'multiple trailing dots',
      input: 'a.b.?token=SECRET',
      expected: 'a.b.'
    }
  ])(
    'redacts a relative query when the word ends in $kind before the question mark',
    ({ input, expected }) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  it('does not leak a quoted value after a restart the token pattern would not redact', () => {
    expect(redactTelemetryUrls("'https://h/x?q=o','a.?k=SECRET'")).toBe(
      "'https://h/x','a.'"
    )
  })

  describe.for([
    {
      kind: 'a single-quoted URL',
      input: "GET 'https://h/x?token=SECRET'",
      expected: "GET 'https://h/x'"
    },
    {
      kind: 'a single-quoted URL followed by more text',
      input: "Load failed: 'https://h/a?token=S', retrying",
      expected: "Load failed: 'https://h/a', retrying"
    },
    {
      kind: 'single-quoted URLs in a stringified array',
      input: "['https://h/a?t=1','https://user:pw@h/b?t=2']",
      expected: "['https://h/a','https://h/b']"
    },
    {
      kind: 'a single-quoted URL with a spaced query value followed by more text',
      input: "'https://h/x?q=a b&token=S' more text",
      expected: "'https://h/x' more text"
    }
  ])('$kind', ({ input, expected }) => {
    it('redacts URL metadata without swallowing the closing quote', () => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    })
  })

  it.for([
    {
      kind: 'a quoted bare query followed by more text',
      input: "log '?token=SECRET' after",
      expected: "log '' after"
    },
    {
      kind: 'a bare query inside a JSON string value',
      input: '{"q":"?a=1","node":5}',
      expected: '{"q":"","node":5}'
    },
    {
      kind: 'a regex-literal lookahead that is not a bare query',
      input: "Unexpected token '??='",
      expected: "Unexpected token '?'"
    }
  ])('$kind', ({ input, expected }) => {
    expect(redactTelemetryUrls(input)).toBe(expected)
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
    { kind: 'a bare question', text: 'Can this work?' },
    {
      kind: 'a CSS selector with ids',
      text: 'body > div#graph-canvas-container.absolute > canvas#graph-canvas'
    },
    {
      kind: 'a click-event invoker string',
      text: 'BUTTON#run.onclick'
    },
    {
      kind: 'a bare fragment token with no separator and no equals sign',
      text: 'callback#SECRET'
    }
  ])('$kind', ({ text }) => {
    it('survives redaction unchanged', () => {
      expect(redactTelemetryUrls(text)).toBe(text)
    })
  })

  it('preserves stack coordinates only outside URL metadata', () => {
    expect(
      redactTelemetryUrls(
        'https://a/b,https://user:pw@c/d?t=1; at f (https://host/a.js?v=1:12:9) at g (https://host/b.js:23:7)'
      )
    ).toBe(
      'https://a/b,https://c/d; at f (https://host/a.js) at g (https://host/b.js:23:7)'
    )
  })

  it.for([
    {
      kind: 'an unrelated ampersand in ordinary text before the URL',
      input: 'A & B failed at https://example.test?token=secret',
      expected: 'A & B failed at https://example.test'
    },
    {
      kind: 'an unrelated ampersand glued into a word before the URL',
      input: 'R&D failed: https://h/x?t=1',
      expected: 'R&D failed: https://h/x'
    },
    {
      kind: 'an unrelated ampersand in a header above stack frames',
      input:
        'A & B\nat f (https://host/a.js?v=1:12:9)\nat g (https://host/b.js:23:7)',
      expected: 'A & B\nat f (https://host/a.js)\nat g (https://host/b.js:23:7)'
    }
  ])('does not fail closed on $kind', ({ input, expected }) => {
    expect(redactTelemetryUrls(input)).toBe(expected)
  })

  it.for(['https://h/x?f=a>1&token=SECRET', 'https://h/x?f=a<1&token=SECRET'])(
    'fails closed when leftover metadata starts right at a token boundary character: %s',
    (input) => {
      expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
    }
  )

  it.for([
    {
      kind: 'an unrelated ampersand in the single word right after the URL',
      input: 'https://h/x?t=1 R&D department',
      expected: 'https://h/x R&D department'
    },
    {
      kind: 'an unrelated ampersand after a quoted URL',
      input: "'https://h/x?t=1' R&D",
      expected: "'https://h/x' R&D"
    }
  ])('does not fail closed on $kind', ({ input, expected }) => {
    expect(redactTelemetryUrls(input)).toBe(expected)
  })

  it('fails closed when a dangling key=value pair follows a spaced query value interrupted by a token boundary character', () => {
    expect(redactTelemetryUrls('https://h/x?f=a b>1&token=SECRET')).toBe(
      REDACTION_SENTINEL
    )
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
          `https://user:one@a.test/x${boundary}https://user:two@b.test/y?token=2`
        )
      ).toBe(`https://a.test/x${expected}https://b.test/y`)
    })
  })

  it.for([
    {
      kind: 'brackets',
      input:
        'https://user:one@a.test/x?token=1][https://user:two@b.test/y?token=2',
      expected: 'https://a.test/x'
    },
    {
      kind: 'a pipe',
      input: 'https://h/x?a=b|https://h/reset/TOKEN123?token=SECRET',
      expected: 'https://h/x'
    }
  ])(
    'drops everything after an open query, including a glued-on URL ($kind)',
    ({ input, expected }) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  it('strips userinfo from a second URL glued on by a comma with an uppercase scheme', () => {
    const redacted = redactTelemetryUrls(
      'https://a.test/x,HTTPS://user:pw@b.test/y'
    )
    expect(redacted).toBe('https://a.test/x,HTTPS://b.test/y')
  })

  it('strips userinfo from a second URL glued on by punctuation with no recognized boundary', () => {
    const redacted = redactTelemetryUrls(
      'https://a.test/x|https://user:pw@b.test/y'
    )
    expect(redacted).toBe('https://a.test/x|https://b.test/y')
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
        `https://a.test/x${boundary}https://user:secret@b.test/y?token=2`
      )
    ).toBe(`https://a.test/x${boundary}https://b.test/y`)
  })

  it('redacts text longer than the redaction limit outright', () => {
    expect(redactTelemetryUrls('a.'.repeat(20_000))).toBe(REDACTION_SENTINEL)
  })

  it('redacts a query value with several spaces', () => {
    const spaces = 'word '.repeat(20)
    expect(
      redactTelemetryUrls(`https://h/x?filename=${spaces}&token=SECRET`)
    ).toBe('https://h/x')
  })

  it('does not disable the glued-boundary guard when a trailing fragment belongs to the outer URL', () => {
    expect(
      redactTelemetryUrls(
        'https://auth/login?redirect_uri=https://app/cb&access_token=SECRET#state'
      )
    ).toBe('https://auth/login')
  })

  it('redacts a key containing a dot after a spaced query value', () => {
    expect(redactTelemetryUrls('https://h/x?q=a b&api.key=SECRET')).toBe(
      'https://h/x'
    )
  })

  it.for([
    [
      '["/api/view?filename=a.png&type=output","/api/view?filename=b.png&type=output"]',
      '["/api/view","/api/view"]'
    ],
    ['{"url":"/a?v=1","team":"R&D"}', '{"url":"/a","team":"R&D"}']
  ])(
    'does not let one recognized URL token bleed ambiguity into the next: %s',
    ([input, expected]) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  it.for([
    '?f=a>1&token=SECRET',
    '?f=a b>1&token=SECRET',
    "?q=o','b',&token=SECRET"
  ])(
    'applies the same ambiguity scrutiny to where bare metadata stops: %s',
    (input) => {
      expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
    }
  )

  it('does not collapse separate lines when a spaced tail spans a newline', () => {
    const input =
      'Failed:\n/api/view?filename=a.png&type=output\nretrying\n/api/view?filename=b.png&type=output'
    expect(redactTelemetryUrls(input)).toBe(
      'Failed:\n/api/view\nretrying\n/api/view'
    )
  })

  it('fails closed when more than 32 valueless leading parameters precede a real key=value pair', () => {
    const input = `callback?${'a&'.repeat(33)}token=SECRET`
    expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
  })

  it('still redacts normally when valueless leading parameters stay within the bound', () => {
    const input = `callback?${'a&'.repeat(10)}token=SECRET`
    expect(redactTelemetryUrls(input)).toBe('callback')
  })

  it('does not let the pre-space query segment run through a closing quote', () => {
    expect(
      redactTelemetryUrls("Load 'https://h/a?v=1' failed for 'x&y=2'")
    ).toBe("Load 'https://h/a' failed for 'x&y=2'")
  })

  it.for([
    'https://h/x?q=price > 100&token=SECRET',
    `https://h/x?q=a ${'b '.repeat(101)}&token=SECRET`,
    'https://h/x#q=price > 100&token=SECRET'
  ])(
    'fails closed on a dangling key=value pair beyond the first word when the spaced pattern cannot consume the value: %s',
    (input) => {
      expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
    }
  )

  it.for([
    'GET /api/view?path="/models/x"&token=SECRET',
    'https://h/x?a="https://b/c"&token=SECRET',
    'https://h/x?f=a>/b&token=SECRET'
  ])(
    "does not let an embedded token with no own tail scrutiny shorten another match's ambiguous-tail scan: %s",
    (input) => {
      expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
    }
  )

  it.for([
    ['["?a=1","/x?t=2&k=3"]', '["","/x"]'],
    [
      '{"q":"?page=2","src":"/api/view?filename=x.png&type=output"}',
      '{"q":"","src":"/api/view"}'
    ],
    ['["?a=1","/x?t=2&k=3","note"]', '["","/x","note"]']
  ])(
    'does not let a neighboring URL token swallow a bare-metadata tail scan: %s',
    ([input, expected]) => {
      expect(redactTelemetryUrls(input)).toBe(expected)
    }
  )

  describe('combinatorial follow-up checks', () => {
    it.for([
      [
        '["/api/view?filename=a b&api.key=1","/api/view?filename=b.png&type=output"]',
        '["/api/view","/api/view"]'
      ],
      [
        '["https://auth/login?redirect_uri=https://app/cb&access_token=S#state","/next?t=1"]',
        '["https://auth/login","/next"]'
      ],
      [
        '["https://auth/login?redirect_uri=https://app/reset/x?mode=1,https://b/y&token=S","/next?t=1"]',
        '["https://auth/login","/next"]'
      ],
      [
        'Load \'https://h/a?v=1\' failed for \'x&y=2\' and ["cb?api.key=1","cb2?flag&access_token=2"]',
        'Load \'https://h/a\' failed for \'x&y=2\' and ["cb","cb2"]'
      ],
      ['["cb?f=a b&api.key=1","note: R&D"]', '["cb","note: R&D"]']
    ])(
      'combines this round with earlier-round axes: %s',
      ([input, expected]) => {
        expect(redactTelemetryUrls(input)).toBe(expected)
      }
    )

    it('fails closed on a JSON-array element with an overflowing valueless-parameter chain', () => {
      const input = `["callback?${'a&'.repeat(33)}token=SECRET","next?t=1"]`
      expect(redactTelemetryUrls(input)).toBe(REDACTION_SENTINEL)
    })
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
    expect(redacted.error.stack).toBe('at load (https://example.com/load.js)')
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

  it('fails closed when a rejected value cannot be stringified', () => {
    const value: object = Object.create(null)

    expect(redactTelemetryError(value).message).toBe('[Redacted]')
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

  it('disambiguates distinct keys that redact to the same string instead of dropping one', () => {
    const redacted = redactTelemetryValues({
      'https://h/x~2': 'literal',
      'https://h/x?job=1': 'ok',
      'https://h/x?job=2': 'timeout',
      'https://h/x?job=3': 'failed'
    })

    expect(redacted).toEqual({
      'https://h/x~2': 'literal',
      'https://h/x': 'ok',
      'https://h/x~3': 'timeout',
      'https://h/x~4': 'failed'
    })
  })

  it('reserves a literal key that looks like a generated suffix even when it comes after the collision', () => {
    const redacted = redactTelemetryValues({
      'https://h/x?job=1': 'a',
      'https://h/x?job=2': 'b',
      'https://h/x~2': 'c'
    })

    expect(redacted).toEqual({
      'https://h/x': 'a',
      'https://h/x~3': 'b',
      'https://h/x~2': 'c'
    })
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

  it('clears the auto-captured stack when the source error had no real stack', () => {
    const error = new Error('plain message')
    Object.defineProperty(error, 'stack', {
      value: undefined,
      enumerable: true
    })

    const redacted = redactTelemetryError(error)

    expect(redacted.stack).toBeUndefined()
  })

  it('does not fall through to a prototype stack accessor when the own stack value is a non-string', () => {
    const getter = vi.fn(
      () => 'at f (https://user:secret@example.com/a?token=x:1:2)'
    )
    class HostileStackError extends Error {}
    const original = Object.getOwnPropertyDescriptor(
      HostileStackError.prototype,
      'stack'
    )
    Object.defineProperty(HostileStackError.prototype, 'stack', {
      configurable: true,
      get: getter
    })
    try {
      const error = new HostileStackError('safe message')
      Object.defineProperty(error, 'stack', {
        configurable: true,
        value: undefined
      })

      const redacted = redactTelemetryError(error)

      expect(redacted.stack).toBeUndefined()
      expect(getter).not.toHaveBeenCalled()
    } finally {
      if (original) {
        Object.defineProperty(HostileStackError.prototype, 'stack', original)
      } else {
        Reflect.deleteProperty(HostileStackError.prototype, 'stack')
      }
    }
  })

  it('fails closed for an own stack property with a non-string, non-undefined value instead of consulting the prototype', () => {
    const error = new Error('safe message')
    Object.defineProperty(error, 'stack', { configurable: true, value: 123 })

    const redacted = redactTelemetryError(error)

    expect(redacted.stack).toBe(REDACTION_SENTINEL)
  })

  it('preserves a naturally captured stack instead of redacting it outright', () => {
    replaceStackFormatter()
    const error = new Error('https://user:secret@example.com/a?token=x')

    const redacted = redactTelemetryError(error)

    const sourceFrames = error.stack?.split('\n').slice(1) ?? []

    expect(sourceFrames.length).toBeGreaterThan(0)
    expect(redacted.stack?.split('\n').slice(1)).toEqual(sourceFrames)
    expect(redacted.stack).toContain('example.com/a')
    expect(redacted.stack).not.toContain('secret')
  })

  it('treats a formatter present since before this module was imported as custom', async () => {
    const formatter = vi.fn(() => 'API_KEY=FORMATTER_SECRET')
    replaceStackFormatter({ configurable: true, value: formatter })
    vi.resetModules()
    onTestFinished(() => {
      vi.resetModules()
    })
    const freshModule = await import('@comfyorg/telemetry/redactTelemetryUrls')
    const error = new Error('safe message')

    expect(freshModule.redactTelemetryError(error).stack).toBe(
      REDACTION_SENTINEL
    )
    expect(formatter).not.toHaveBeenCalled()
  })

  it('fails closed for a non-native stack accessor inherited from Error.prototype, even when installed before this module was imported', async () => {
    const originalPrototypeStack = Object.getOwnPropertyDescriptor(
      Error.prototype,
      'stack'
    )
    const prototypeGetter = function (this: { __fakeStack?: string }) {
      return this.__fakeStack
    }
    Object.defineProperty(Error.prototype, 'stack', {
      configurable: true,
      get: prototypeGetter
    })
    replaceStackFormatter()
    vi.resetModules()
    try {
      const freshModule =
        await import('@comfyorg/telemetry/redactTelemetryUrls')
      const error: Error & { __fakeStack?: string } = new Error('safe message')
      Reflect.deleteProperty(error, 'stack')
      error.__fakeStack = 'at f (https://user:secret@example.com/a?token=x:1:2)'

      const redacted = freshModule.redactTelemetryError(error)

      expect(redacted.stack).toBe(freshModule.REDACTION_SENTINEL)
    } finally {
      if (originalPrototypeStack) {
        Object.defineProperty(Error.prototype, 'stack', originalPrototypeStack)
      } else {
        Reflect.deleteProperty(Error.prototype, 'stack')
      }
      vi.resetModules()
    }
  })

  it('fails closed for a non-native stack accessor installed on Error.prototype after this module was already imported', () => {
    const original = Object.getOwnPropertyDescriptor(Error.prototype, 'stack')
    const prototypeGetter = function (this: { __fakeStack?: string }) {
      return this.__fakeStack
    }
    Object.defineProperty(Error.prototype, 'stack', {
      configurable: true,
      get: prototypeGetter
    })
    try {
      const error: Error & { __fakeStack?: string } = new Error('safe message')
      Reflect.deleteProperty(error, 'stack')
      error.__fakeStack = 'at f (https://user:secret@example.com/a?token=x:1:2)'

      const redacted = redactTelemetryError(error)

      expect(redacted.stack).toBe(REDACTION_SENTINEL)
    } finally {
      if (original) {
        Object.defineProperty(Error.prototype, 'stack', original)
      } else {
        Reflect.deleteProperty(Error.prototype, 'stack')
      }
    }
  })

  it.for([
    {
      kind: 'an inherited name accessor',
      create: () => {
        const callback = vi.fn(() => 'secret')
        class HostileNameError extends Error {
          override get name() {
            return callback()
          }
        }
        return { error: new HostileNameError('plain message'), callback }
      }
    },
    ...(['name', 'message'] as const).map((key) => ({
      kind: `an object-valued ${key}`,
      create: () => {
        const callback = vi.fn(() => 'API_KEY=COERCED_SECRET')
        const error = Object.defineProperty(new Error('safe'), key, {
          value: { toString: callback }
        })
        return { error, callback }
      }
    }))
  ])('does not invoke $kind while reading the stack', ({ create }) => {
    replaceStackFormatter()
    const { error, callback } = create()
    const redacted = redactTelemetryError(error)

    expect(redacted.stack).toBe(REDACTION_SENTINEL)
    expect(callback).not.toHaveBeenCalled()
  })

  it.for([
    { kind: 'plain', bind: (getter: () => string) => getter },
    {
      kind: 'bound one renamed to match the native getter',
      bind: (getter: () => string) =>
        Object.defineProperty(getter.bind(null), 'name', { value: '' })
    }
  ])('does not invoke a $kind JavaScript stack accessor', ({ bind }) => {
    replaceStackFormatter()
    const getter = vi.fn(() => 'API_KEY=SUPER_SECRET')
    const error = Object.defineProperty(new Error('safe'), 'stack', {
      enumerable: true,
      get: bind(getter)
    })

    const redacted = redactTelemetryError(error)

    expect(redacted.stack).toBe(REDACTION_SENTINEL)
    expect(getter).not.toHaveBeenCalled()
  })

  it('reads the native stack getter without dispatching through its own call property', () => {
    replaceStackFormatter()
    const nativeGetter = Object.getOwnPropertyDescriptor(
      new Error(),
      'stack'
    )?.get
    assert(nativeGetter)
    const call = vi.fn(() => 'API_KEY=SUPER_SECRET')
    Object.defineProperty(nativeGetter, 'call', {
      configurable: true,
      value: call
    })
    onTestFinished(() => {
      Reflect.deleteProperty(nativeGetter, 'call')
    })

    const redacted = redactTelemetryError(new Error('safe'))

    expect(call).not.toHaveBeenCalled()
    expect(redacted.stack).toMatch(/^Error: safe\n/)
  })

  it.for([
    {
      kind: 'value',
      create: () => {
        const callback = vi.fn(() => 'API_KEY=FORMATTER_SECRET')
        return { callback, descriptor: { value: callback } }
      }
    },
    {
      kind: 'accessor',
      create: () => {
        const callback = vi.fn(() => () => 'API_KEY=FORMATTER_SECRET')
        return { callback, descriptor: { get: callback } }
      }
    }
  ])('does not invoke a custom $kind stack formatter', ({ create }) => {
    const { callback, descriptor } = create()
    const error = new Error('safe')
    replaceStackFormatter({ configurable: true, ...descriptor })

    const redacted = redactTelemetryError(error)

    expect(redacted.stack).toBe(REDACTION_SENTINEL)
    expect(callback).not.toHaveBeenCalled()
  })
})
