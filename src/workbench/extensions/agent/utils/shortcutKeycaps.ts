import { canvasCommandForWrittenKeys } from '@/platform/keybindings/canvasActionShortcuts'

/** Resolves a command id to the key labels it is currently bound to. */
export type KeySequenceResolver = (commandId: string) => string[] | undefined

const NON_PROSE_ELEMENTS = new Set([
  'CODE',
  'PRE',
  'KBD',
  'A',
  'SCRIPT',
  'STYLE'
])

const MODIFIER = String.raw`[Cc]trl|CTRL|[Cc]ontrol|[Cc]md|[Cc]ommand|⌘|[Aa]lt|ALT|[Oo]ption|[Oo]pt|⌥|[Ss]hift|SHIFT|⇧`

const NAMED_KEY = String.raw`F\d{1,2}|Enter|Return|Esc(?:ape)?|Space(?:bar)?|Tab|Delete|Del|Backspace|Home|End|PageUp|PageDown|Up|Down|Left|Right`

const SINGLE_KEY =
  String.raw`[A-Za-z0-9` +
  '`' +
  String.raw`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?]`

const MODIFIER_BEARING_COMBO = String.raw`(?<![A-Za-z0-9])(?:${MODIFIER})(?:\s*\+\s*(?:${MODIFIER}|${NAMED_KEY}|${SINGLE_KEY})(?![A-Za-z0-9]))+(?!\s*\+)`

function keyLabel(sequence: string): string {
  return sequence.length === 1 ? sequence.toUpperCase() : sequence
}

function keycaps(sequences: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment()
  sequences.forEach((sequence, index) => {
    if (index > 0) fragment.append('+')
    const kbd = document.createElement('kbd')
    kbd.textContent = keyLabel(sequence)
    fragment.append(kbd)
  })
  return fragment
}

function keysAsWritten(combo: string): string[] {
  const slots = combo.split(/\s*\+\s*/)
  const keys: string[] = []
  slots.forEach((slot, index) => {
    if (slot) keys.push(slot)
    else if (index > 0 && index === slots.length - 1) keys.push('+')
  })
  return keys
}

function rewriteTextNode(node: Text, resolve: KeySequenceResolver): boolean {
  const text = node.data
  const combos = [...text.matchAll(new RegExp(MODIFIER_BEARING_COMBO, 'g'))]
  if (combos.length === 0) return false

  const fragment = document.createDocumentFragment()
  let cursor = 0
  for (const match of combos) {
    const start = match.index
    if (start > cursor) fragment.append(text.slice(cursor, start))

    const written = keysAsWritten(match[0])
    const commandId = canvasCommandForWrittenKeys(written)
    const bound = commandId ? resolve(commandId) : undefined
    fragment.append(keycaps(bound?.length ? bound : written))

    cursor = start + match[0].length
  }
  fragment.append(text.slice(cursor))

  node.replaceWith(fragment)
  return true
}

function isProse(node: Text): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (NON_PROSE_ELEMENTS.has(parent.tagName)) return false
  }
  return true
}

/**
 * Renders the key combos in rendered reply HTML as `<kbd>` keycaps, re-keyed to
 * the user's own binding when the written combo is a canvas action's shipped
 * default. Text inside code, links and existing keycaps is left untouched.
 */
export function renderShortcutKeycaps(
  html: string,
  resolve: KeySequenceResolver
): string {
  if (!html.includes('+')) return html

  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT
  )

  const proseNodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (isProse(node)) proseNodes.push(node)
  }

  let rewritten = false
  for (const node of proseNodes) {
    if (rewriteTextNode(node, resolve)) rewritten = true
  }
  return rewritten ? template.innerHTML : html
}
