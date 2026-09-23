import { describe, expect, it } from 'vitest'

import { renderWorkshopRequestTemplate } from './workshop-request-template'

describe('replacement-only Router templates', () => {
  it('preserves text and native value types without interpreting inserted content', () => {
    const prompt =
      '"}], "injected": true, "x": "\n\\ 😀 $repl_number("missing")'
    const body = renderWorkshopRequestTemplate(
      '{"content":[{"text":$repl_string("prompt")}],"count":$repl_number("count"),"sound":$repl_boolean("sound"),"items":$repl_json("items")}',
      { prompt, count: 0, sound: false, items: ['a', 'b'] }
    )
    expect(body).toEqual({
      content: [{ text: prompt }],
      count: 0,
      sound: false,
      items: ['a', 'b']
    })
  })

  it('leaves literal JSON strings alone', () => {
    expect(
      renderWorkshopRequestTemplate(
        '{"text":"$repl_string(\\"literal\\")"}',
        {}
      )
    ).toEqual({ text: '$repl_string("literal")' })
  })

  it.for([
    '{"x":$repl_string("missing")}',
    '{"x":$repl_number("text")}',
    '{"x":$repl_number("infinite")}',
    '{"x":$repl_eval("text")}',
    '{"x":$repl_string("text", (() => 1)())}',
    '{"x":$repl_string("text") + "extra"}',
    '{$repl_string("text"):1}',
    '{"x":$repl_string("text", "unsupported-format")}',
    '{"x":$repl_string("text"}',
    '{"x":"unterminated}'
  ])(
    'rejects missing values, type errors and template logic: %s',
    (template) => {
      expect(() =>
        renderWorkshopRequestTemplate(template, {
          text: 'hello',
          infinite: Infinity
        })
      ).toThrow()
    }
  )
})
