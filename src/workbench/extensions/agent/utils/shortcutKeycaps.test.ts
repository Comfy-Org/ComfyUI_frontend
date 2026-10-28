import { describe, expect, it } from 'vitest'

import { renderShortcutKeycaps } from './shortcutKeycaps'

const BYPASS = 'Comfy.Canvas.ToggleSelectedNodes.Bypass'

const defaults: Record<string, string[]> = {
  [BYPASS]: ['Ctrl', 'b'],
  'Comfy.Canvas.ToggleSelectedNodes.Mute': ['Ctrl', 'm'],
  'Comfy.QueuePrompt': ['Ctrl', 'Enter'],
  'Comfy.SaveWorkflow': ['Ctrl', 's'],
  'Comfy.Graph.ConvertToSubgraph': ['Ctrl', 'Shift', 'e']
}

const resolveDefaults = (commandId: string) => defaults[commandId]
const resolveNothing = () => undefined

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
    const rebound = (commandId: string) =>
      commandId === BYPASS ? ['Alt', 'q'] : undefined
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass the upscaler.</p>',
      rebound
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
    expect(out).not.toContain('Ctrl')
  })

  it('rewrites a Mac-shaped combo to the label the settings panel shows', () => {
    const rebound = (commandId: string) =>
      commandId === BYPASS ? ['Alt', 'q'] : undefined
    const out = renderShortcutKeycaps(
      '<p>Press Cmd+B to bypass it.</p>',
      rebound
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
    const rebound = (commandId: string) =>
      commandId === BYPASS ? ['Alt', 'q'] : defaults[commandId]
    const out = renderShortcutKeycaps(
      '<p>Use Ctrl+B to bypass or Ctrl+M to mute</p>',
      rebound
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>M</kbd>')
  })

  it('resolves a combo whose action word sits in another inline element', () => {
    const rebound = (commandId: string) =>
      commandId === BYPASS ? ['Alt', 'q'] : undefined
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to <strong>bypass</strong> the node.</p>',
      rebound
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Q</kbd>')
  })

  it('reads a combo that markdown emphasis split across elements', () => {
    const rebound = (commandId: string) =>
      commandId === BYPASS ? ['Alt', 'q'] : undefined
    const out = renderShortcutKeycaps(
      '<p>Press <strong>Ctrl</strong>+<strong>B</strong> to bypass it.</p>',
      rebound
    )
    const text = new DOMParser().parseFromString(out, 'text/html').body
      .textContent
    expect(text).toBe('Press Alt+Q to bypass it.')
  })

  it('does not join text across a block boundary', () => {
    const html = '<li>Ends with Ctrl</li><li>+B starts the next</li>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('does not join text across a code span', () => {
    const html = '<p>Ctrl<code>x</code>+B is not a shortcut.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('keeps a plus that is the key rather than the separator', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Alt+Shift++ to zoom in.</p>',
      resolveNothing
    )
    expect(out).toContain('<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>+</kbd>')
  })

  it('leaves a word that begins with a key letter alone', () => {
    const html = '<p>Ctrl+click a node to add it to the selection.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('leaves a modifier run followed by a word alone', () => {
    const html = '<p>Ctrl+Shift+click to bypass several at once.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('leaves a drag gesture alone rather than keycapping its first letter', () => {
    const html = '<p>Shift+drag to move the group, or Alt+drag to copy it.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('does not read a modifier out of the end of a longer word', () => {
    const html = '<p>The salt+B variant is not a shortcut.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('injects nothing into a sentence that named an action but no key', () => {
    const html = '<p>Select the node and bypass it.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

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
      resolveNothing
    )
    const text = new DOMParser().parseFromString(out, 'text/html').body
      .textContent
    expect(text).toBe('Done. Press Ctrl+B to bypass it; the node stays wired.')
  })

  it('falls back to what the model wrote when the command is unbound', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass it.</p>',
      resolveNothing
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
  })

  it('is stable when applied to its own output, as a streamed reply re-renders', () => {
    const once = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass it.</p>',
      resolveDefaults
    )
    expect(renderShortcutKeycaps(once, resolveDefaults)).toBe(once)
  })

  it('escapes a key label instead of letting it become markup', () => {
    const hostile = () => ['<img src=x onerror=alert(1)>', 'b']
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+B to bypass it.</p>',
      hostile
    )
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })
})
