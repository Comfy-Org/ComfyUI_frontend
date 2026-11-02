import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'

import { renderShortcutKeycaps } from './shortcutKeycaps'

const BYPASS = 'Comfy.Canvas.ToggleSelectedNodes.Bypass'

const defaults: Record<string, string[][]> = {
  [BYPASS]: [['Ctrl', 'b']],
  'Comfy.Canvas.ToggleSelectedNodes.Mute': [['Ctrl', 'm']],
  'Comfy.QueuePrompt': [['Ctrl', 'Enter']],
  'Comfy.SaveWorkflow': [['Ctrl', 's']],
  'Comfy.Graph.ConvertToSubgraph': [['Ctrl', 'Shift', 'e']],
  'Comfy.Canvas.SelectAll': [['Ctrl', 'a']],
  'Comfy.Canvas.ZoomIn': [
    ['Alt', '='],
    ['Alt', 'Shift', '+'],
    ['Alt', '+']
  ]
}

const resolveDefaults = (commandId: string) => defaults[commandId] ?? []
const rebindBypassTo = (keys: string[]) => (commandId: string) =>
  commandId === BYPASS ? [keys] : (defaults[commandId] ?? [])
const resolveNothing = () => []

describe('renderShortcutKeycaps', () => {
  it('leaves a reply with no key combo untouched', () => {
    const html = '<p>Your image is ready.</p>'
    expect(renderShortcutKeycaps(html, resolveNothing)).toBe(html)
  })

  it('wraps a combo the model wrote in keycaps', () => {
    const out = renderShortcutKeycaps(
      '<p>Hit Ctrl+Shift+P to open the palette.</p>',
      resolveNothing
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>')
  })

  it('uses the rebound key when the model wrote the shipped default', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass the upscaler.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
    expect(out).not.toContain('Ctrl')
  })

  it('rewrites a Mac-shaped combo to the label the settings panel shows', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Cmd+B to bypass it.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
  })

  it('never re-keys a combo that is not a canvas action default', () => {
    const out = renderShortcutKeycaps(
      '<p>Hit Ctrl+Z to undo, then save.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>Z</kbd>')
    expect(out).not.toContain('<kbd>S</kbd>')
  })

  it('does not borrow a binding from an unrelated action word in the sentence', () => {
    const out = renderShortcutKeycaps(
      '<p>Copy it with Ctrl+C, then run the graph.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>C</kbd>')
    expect(out).not.toContain('Enter')
  })

  it('leaves a wrong key the model invented as written', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+Shift+B to bypass it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>')
  })

  it('re-keys each combo to its own command', () => {
    const out = renderShortcutKeycaps(
      '<p>Use Ctrl+B to bypass or Ctrl+M to mute</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>M</kbd>')
  })

  it('resolves a combo whose action word sits in another inline element', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to <strong>bypass</strong> the node.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
  })

  it('reads a combo that markdown emphasis split across elements', () => {
    const out = renderShortcutKeycaps(
      '<p>Press <strong>Ctrl</strong>+<strong>B</strong> to bypass it.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    const text = new DOMParser().parseFromString(out, 'text/html').body
      .textContent
    expect(text).toBe('Press Alt+Q to bypass it.')
  })

  it('reads a cross-platform alternation as one combo', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl/Cmd+B to bypass it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
    expect(out).not.toContain('Ctrl/')
  })

  it('re-keys a cross-platform alternation without leaving half of it in prose', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Cmd/Ctrl+B to bypass it.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    const text = new DOMParser().parseFromString(out, 'text/html').body
      .textContent
    expect(text).toBe('Press Alt+Q to bypass it.')
  })

  it('keeps a combo the command is still bound to, rather than its sibling default', () => {
    const out = renderShortcutKeycaps(
      '<p>Use Alt++ to zoom in.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>+</kbd>')
    expect(out).not.toContain('<kbd>=</kbd>')
  })

  it('reads two shortcuts joined by a plus as two combos', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+C + Ctrl+V to duplicate it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>C</kbd>')
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>V</kbd>')
    expect(out).not.toContain('<kbd>C</kbd>+<kbd>Ctrl</kbd>')
  })

  it.for([
    [
      'a line break',
      '<p>Ctrl<br>+B is not a shortcut.</p>',
      '<p>Ctrl<br>+B is not a shortcut.</p>'
    ],
    [
      'a block boundary',
      '<li>Ends with Ctrl</li><li>+B starts the next</li>',
      '<li>Ends with Ctrl</li><li>+B starts the next</li>'
    ],
    [
      'a code span',
      '<p>Ctrl<code>x</code>+B is not a shortcut.</p>',
      '<p>Ctrl<code>x</code>+B is not a shortcut.</p>'
    ],
    [
      'an alternation of different modifiers',
      '<p>Ctrl/Alt+B is not one shortcut.</p>',
      '<p>Ctrl/Alt+B is not one shortcut.</p>'
    ],
    [
      'a word that begins with a key letter',
      '<p>Ctrl+click a node to add it to the selection.</p>',
      '<p>Ctrl+click a node to add it to the selection.</p>'
    ],
    [
      'a modifier run followed by a word',
      '<p>Ctrl+Shift+click to bypass several at once.</p>',
      '<p>Ctrl+Shift+click to bypass several at once.</p>'
    ],
    [
      'a drag gesture',
      '<p>Shift+drag to move the group, or Alt+drag to copy it.</p>',
      '<p>Shift+drag to move the group, or Alt+drag to copy it.</p>'
    ],
    [
      'a modifier at the end of a longer word',
      '<p>The salt+B variant is not a shortcut.</p>',
      '<p>The salt+B variant is not a shortcut.</p>'
    ],
    [
      'an action with no key',
      '<p>Select the node and bypass it.</p>',
      '<p>Select the node and bypass it.</p>'
    ]
  ])('leaves the HTML unchanged across %s', ([, html, expected]) => {
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(expected)
  })

  it('reads a combo the model wrote in capitals', () => {
    const out = renderShortcutKeycaps(
      '<p>Press CMD+B to bypass it.</p>',
      rebindBypassTo(['Alt', 'q'])
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
  })

  it('folds a named-key synonym onto the key the command ships', () => {
    const out = renderShortcutKeycaps(
      '<p>Hit Cmd+Return to queue it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>Enter</kbd>')
  })

  it('keeps a plus that is the key rather than the separator', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Alt+Shift++ to zoom in.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>+</kbd>')
  })

  it(
    'scans a long run of modifiers with no key in bounded time',
    { timeout: 60_000 },
    () => {
      const hostile = `<p>${'Ctrl+'.repeat(16000)}</p>`

      const started = performance.now()
      const out = renderShortcutKeycaps(hostile, resolveDefaults)
      const elapsed = performance.now() - started

      expect(out).toBe(hostile)
      expect(elapsed).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(1000)
    }
  )

  it('never rewrites inside code, a link, or an existing keycap', () => {
    const html =
      '<p><code>Ctrl+B</code> and <a href="https://example.com">Ctrl+B</a> and <kbd>Ctrl+B</kbd> to bypass</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('leaves a fenced code block alone', () => {
    const html = '<pre><code>ctrl+b bypass</code></pre>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('keeps the surrounding prose', () => {
    const out = renderShortcutKeycaps(
      '<p>Done. Press Ctrl+B to bypass it; the node stays wired.</p>',
      resolveDefaults
    )
    const text = new DOMParser().parseFromString(out, 'text/html').body
      .textContent
    expect(text).toBe('Done. Press Ctrl+B to bypass it; the node stays wired.')
  })

  it('leaves a stale default as prose when the command is unbound', () => {
    const html = '<p>Press Ctrl+B to bypass it.</p>'
    expect(renderShortcutKeycaps(html, resolveNothing)).toBe(html)
  })

  it('is stable when applied to its own output, as a streamed reply re-renders', () => {
    const once = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass it.</p>',
      resolveDefaults
    )
    expect(renderShortcutKeycaps(once, resolveDefaults)).toBe(once)
  })

  it('escapes a key label instead of letting it become markup', () => {
    const hostile = () => [['<img src=x onerror=alert(1)>', 'b']]
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass it.</p>',
      hostile
    )
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })
})
