import { CANVAS_ACTION_COMMAND_IDS } from '@/platform/keybindings/canvasActionShortcuts'

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LONGEST_ACTION_PHRASE_FIRST = Object.keys(CANVAS_ACTION_COMMAND_IDS).sort(
  (a, b) => b.length - a.length
)

const ACTION_SOURCE = `\\b(${LONGEST_ACTION_PHRASE_FIRST.map(escapeRegExp).join('|')})\\b`

const MODIFIER = String.raw`[Cc]trl|CTRL|[Cc]ontrol|[Cc]md|[Cc]ommand|⌘|[Aa]lt|ALT|[Oo]ption|[Oo]pt|⌥|[Ss]hift|SHIFT|⇧`

const NAMED_KEY = String.raw`F\d{1,2}|Enter|Return|Esc(?:ape)?|Space(?:bar)?|Tab|Delete|Del|Backspace|Home|End|PageUp|PageDown|Up|Down|Left|Right`

const SINGLE_KEY =
  String.raw`[A-Za-z0-9` +
  '`' +
  String.raw`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?]`

const MODIFIER_BEARING_COMBO = String.raw`(?:${MODIFIER})(?:\s*\+\s*(?:${MODIFIER}|${NAMED_KEY}|${SINGLE_KEY}))+`

const AFTER_SENTENCE_END = /(?<=[.!?;\n])/

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
  return combo
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
}

function soleActionCommandId(sentence: string): string | undefined {
  const commandIds = new Set<string>()
  for (const match of sentence.matchAll(new RegExp(ACTION_SOURCE, 'gi'))) {
    const phrase =
      match[1].toLowerCase() as keyof typeof CANVAS_ACTION_COMMAND_IDS
    commandIds.add(CANVAS_ACTION_COMMAND_IDS[phrase])
  }
  return commandIds.size === 1 ? [...commandIds][0] : undefined
}

function appendSentenceWithKeycaps(
  fragment: DocumentFragment,
  sentence: string,
  resolve: KeySequenceResolver
): void {
  const commandId = soleActionCommandId(sentence)
  const bound = commandId ? resolve(commandId) : undefined
  const unambiguousLiveKeys = bound && bound.length > 0 ? bound : undefined

  let cursor = 0
  for (const match of sentence.matchAll(
    new RegExp(MODIFIER_BEARING_COMBO, 'g')
  )) {
    const start = match.index
    if (start > cursor) fragment.append(sentence.slice(cursor, start))
    fragment.append(keycaps(unambiguousLiveKeys ?? keysAsWritten(match[0])))
    cursor = start + match[0].length
  }
  fragment.append(sentence.slice(cursor))
}

function rewriteTextNode(node: Text, resolve: KeySequenceResolver): boolean {
  const text = node.data
  if (!new RegExp(MODIFIER_BEARING_COMBO).test(text)) return false

  const sentences = text.split(AFTER_SENTENCE_END)
  const reassembledLength = sentences.reduce((n, s) => n + s.length, 0)
  if (reassembledLength !== text.length) return false

  const fragment = document.createDocumentFragment()
  for (const sentence of sentences) {
    appendSentenceWithKeycaps(fragment, sentence, resolve)
  }
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
 * Renders the keyboard shortcuts in one block of rendered reply HTML as `<kbd>`
 * keycaps, replacing a combo with the keys `resolve` reports whenever the
 * sentence holding it names exactly one canvas action. Prose that carries no
 * combo, and text inside code, links and existing keycaps, are left untouched.
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
