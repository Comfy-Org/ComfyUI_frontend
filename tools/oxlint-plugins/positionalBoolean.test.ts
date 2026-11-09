import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noPositionalBooleanParams } from './positionalBoolean'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-positional-boolean-params', noPositionalBooleanParams, {
  valid: [
    {
      name: 'a lone flag, an options object, a widened union, and an overload signature',
      code: `
export function setVisible(visible: boolean) {}
export function setVisibleFor(this: Window, visible: boolean) {}
export function select(node: Node, options: { append?: boolean } = {}) {}
export function deselect(node: Node, options?: boolean | DeselectOptions) {}
export function legacy(node: Node, append: boolean): void
export function legacy(node: Node, options?: unknown) {}
`
    },
    {
      name: 'functions and methods outside the public surface',
      code: `
function local(node: Node, append: boolean) {}
export const helpers = { toggle(id: string, on: boolean) {} }
class Canvas {
  private draw(fg: boolean, bg: boolean) {}
  protected clear(all: boolean, emit: boolean) {}
  #reset(hard: boolean, emit: boolean) {}
  set flag(value: boolean) {}
  constructor(id: string, visible: boolean) {}
}
`
    }
  ],
  invalid: [
    {
      name: 'exported functions with a flag beside other parameters',
      code: `
export function select(node: Node, append: boolean) {}
export const toggle = (id: string, on = false) => {}
export default function (name: string, strict: boolean | undefined) {}
`,
      errors: [
        { messageId: 'positionalBoolean' },
        { messageId: 'positionalBoolean' },
        { messageId: 'positionalBoolean' }
      ]
    },
    {
      name: 'a public method with optional flags reports each flag',
      code: `
export class Canvas {
  deselectAll(keep?: Node, sendEvent?: boolean, redraw?: true) {}
  static create(id: string, debug: boolean) {}
}
`,
      errors: [
        { messageId: 'positionalBoolean' },
        { messageId: 'positionalBoolean' },
        { messageId: 'positionalBoolean' }
      ]
    }
  ]
})
