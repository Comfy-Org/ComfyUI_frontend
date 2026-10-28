import { describe, expect, it } from 'vitest'

import { renderShortcutKeycaps } from './shortcutKeycaps'

const BYPASS = 'Comfy.Canvas.ToggleSelectedNodes.Bypass'

const defaults: Record<string, string[]> = {
  [BYPASS]: ['Ctrl', 'b'],
  'Comfy.Canvas.ToggleSelectedNodes.Mute': ['Ctrl', 'm'],
  'Comfy.QueuePrompt': ['Ctrl', 'Enter'],
  'Comfy.Graph.ConvertToSubgraph': ['Ctrl', 'Shift', 'e']
}

const resolveDefaults = (commandId: string) => defaults[commandId]
const resolveNothing = () => undefined

describe('renderShortcutKeycaps', () => {
  it('leaves a reply with no key combo untouched, without parsing it', () => {
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

  it("replaces a wrong key with the user's bound one when the sentence names the action", () => {
    const out = renderShortcutKeycaps(
      '<p>Select the node and press Ctrl+Shift+B to bypass it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
    expect(out).not.toContain('Shift')
  })

  it('uses a rebound key rather than the shipped default', () => {
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
    const out = renderShortcutKeycaps(
      '<p>Press Cmd+B to bypass it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
  })

  it('styles but does not re-key a sentence naming two different actions', () => {
    const out = renderShortcutKeycaps(
      '<p>Use Ctrl+B to bypass or Ctrl+M to mute</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>M</kbd>')
  })

  it('pairs each sentence with its own action', () => {
    const out = renderShortcutKeycaps(
      '<p>Press Ctrl+X to bypass it. Then press Ctrl+Y to mute it.</p>',
      resolveDefaults
    )
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>B</kbd>')
    expect(out).toContain('<kbd>Ctrl</kbd>+<kbd>M</kbd>')
  })

  it('injects nothing into a sentence that named an action but no key', () => {
    const html = '<p>Select the node and bypass it.</p>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('never rewrites inside code, a link, or an existing keycap', () => {
    const html =
      '<p><code>Ctrl+B</code> and <a href="https://example.com">Ctrl+B</a> and <kbd>Ctrl+B</kbd> to bypass</p>'
    const out = renderShortcutKeycaps(html, resolveDefaults)
    expect(out).toBe(html)
  })

  it('leaves a fenced code block alone', () => {
    const html = '<pre><code>ctrl+b bypass</code></pre>'
    expect(renderShortcutKeycaps(html, resolveDefaults)).toBe(html)
  })

  it('keeps the surrounding prose, including the sentence delimiter', () => {
    const out = renderShortcutKeycaps(
      '<p>Done. Press Ctrl+B to bypass it; the node stays wired.</p>',
      resolveDefaults
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

  it('leaves a word that begins with a key letter alone', () => {
    const html = '<p>Ctrl+click a node to add it to the selection.</p>'
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
