import { describe, expect, it } from 'vitest'

import { quoteYamlScalar, unquoteYamlScalar } from './yamlScalar'

describe('quoteYamlScalar', () => {
  it('quotes an ordinary value', () => {
    expect(quoteYamlScalar('What is Comfy?')).toBe('"What is Comfy?"')
  })

  it('escapes a quote so the scalar does not end early', () => {
    expect(quoteYamlScalar('the "Run" button')).toBe('"the \\"Run\\" button"')
  })

  /**
   * The FAQ writer escaped `"` and not `\`, so a value holding a backslash
   * produced an invalid YAML escape — `question: "50\% off"` — and corrupted
   * the frontmatter of the file it had just written.
   */
  it('escapes a backslash', () => {
    expect(quoteYamlScalar('50\\% off')).toBe('"50\\\\% off"')
  })

  /**
   * A newline ends the line the scalar lives on, so the question regex stops
   * matching and the writer throws `no double-quoted question` while verifying
   * its own output — reporting a parse failure instead of a content problem.
   */
  it('escapes a newline rather than breaking the line', () => {
    expect(quoteYamlScalar('two\nlines')).toBe('"two\\nlines"')
  })

  it('escapes a trailing backslash, which would otherwise escape the quote', () => {
    expect(quoteYamlScalar('ends with\\')).toBe('"ends with\\\\"')
  })
})

describe('round trip', () => {
  /**
   * The two must be exact inverses. They were not: both writers escaped on the
   * way out and only reversed `\"` on the way back, so a value carrying a
   * backslash came back with it doubled — and each pass through the pipeline
   * doubled it again.
   */
  it.for([
    'plain',
    'the "Run" button',
    '50\\% off',
    'ends with\\',
    'two\nlines',
    'both \\ and " together',
    '\\"already escaped looking\\"'
  ])('survives %j unchanged', (value) => {
    const quoted = quoteYamlScalar(value)

    expect(unquoteYamlScalar(quoted.slice(1, -1))).toBe(value)
  })
})
