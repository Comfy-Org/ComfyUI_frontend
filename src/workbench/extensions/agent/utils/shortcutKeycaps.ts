import {
  canonicalCombo,
  canvasCommandForWrittenKeys,
  modifierLabel
} from '@/platform/keybindings/canvasActionShortcuts'

/** Reports every key sequence a command is bound to now. */
export type KeySequenceResolver = (commandId: string) => string[][]

const NON_PROSE_ELEMENTS = new Set([
  'CODE',
  'PRE',
  'KBD',
  'A',
  'SCRIPT',
  'STYLE'
])

const INLINE_ELEMENTS = new Set([
  'SPAN',
  'STRONG',
  'EM',
  'B',
  'I',
  'U',
  'S',
  'SMALL',
  'MARK',
  'SUB',
  'SUP',
  'Q',
  'CITE',
  'ABBR',
  'TIME',
  'VAR',
  'SAMP',
  'DFN',
  'BDI',
  'BDO',
  'FONT',
  'INS',
  'DEL',
  'RUBY',
  'RT',
  'RP'
])

const MODIFIER = String.raw`ctrl|control|cmd|command|meta|⌘|alt|option|opt|⌥|shift|⇧`

const MODIFIER_SLOT = String.raw`(?:${MODIFIER})(?:\s*/\s*(?:${MODIFIER})){0,3}`

const NAMED_KEY = String.raw`f\d{1,2}|enter|return|escape|esc|spacebar|space|tab|delete|del|backspace|home|end|pageup|pagedown|up|down|left|right`

const SINGLE_KEY =
  String.raw`[a-z0-9` + '`' + String.raw`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?]`

const MODIFIER_BEARING_COMBO =
  String.raw`(?<![a-z0-9/])${MODIFIER_SLOT}(?:\s*\+\s*${MODIFIER_SLOT}){0,3}` +
  String.raw`\s*\+\s*(?:${NAMED_KEY}|${SINGLE_KEY})(?![a-z0-9])`

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

function slotKey(slot: string): string | undefined {
  const spellings = slot.split('/')
  if (spellings.length === 1) return modifierLabel(slot) ?? slot
  if (spellings.some((spelling) => !spelling.trim())) return slot

  const labels = spellings.map((spelling) => modifierLabel(spelling.trim()))
  const [first] = labels
  return first && labels.every((label) => label === first) ? first : undefined
}

function comboKeys(combo: string): string[] | undefined {
  const slots = combo.split(/\s*\+\s*/)
  const keys: string[] = []
  for (const [index, slot] of slots.entries()) {
    if (!slot) {
      if (index > 0 && index === slots.length - 1) keys.push('+')
      continue
    }
    const key = slotKey(slot)
    if (key === undefined) return undefined
    keys.push(key)
  }
  return keys
}

function liveKeys(
  written: string[],
  resolve: KeySequenceResolver
): string[] | undefined {
  const commandId = canvasCommandForWrittenKeys(written)
  if (!commandId) return written

  const bound = resolve(commandId)
  const asWritten = canonicalCombo(written)
  return bound.find((keys) => canonicalCombo(keys) === asWritten) ?? bound.at(0)
}

interface Match {
  start: number
  end: number
  keys: string[]
}

function matchesIn(text: string, resolve: KeySequenceResolver): Match[] {
  const matches: Match[] = []
  for (const match of text.matchAll(new RegExp(MODIFIER_BEARING_COMBO, 'gi'))) {
    const written = comboKeys(match[0])
    const keys = written && liveKeys(written, resolve)
    if (keys) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        keys
      })
    }
  }
  return matches
}

function spliceMatches(node: Text, nodeStart: number, matches: Match[]): void {
  const text = node.data
  const nodeEnd = nodeStart + text.length
  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of matches) {
    const localStart = Math.max(match.start, nodeStart) - nodeStart
    if (localStart > cursor) fragment.append(text.slice(cursor, localStart))
    if (match.start >= nodeStart) fragment.append(keycaps(match.keys))
    cursor = Math.min(match.end, nodeEnd) - nodeStart
  }

  if (cursor < text.length) fragment.append(text.slice(cursor))
  node.replaceWith(fragment)
}

function rewriteRun(run: Text[], resolve: KeySequenceResolver): boolean {
  const matches = matchesIn(run.map((node) => node.data).join(''), resolve)
  if (matches.length === 0) return false

  let nodeStart = 0
  let pending = 0
  for (const node of run) {
    const nodeEnd = nodeStart + node.data.length
    let past = pending
    while (past < matches.length && matches[past].start < nodeEnd) past++
    spliceMatches(node, nodeStart, matches.slice(pending, past))
    while (pending < matches.length && matches[pending].end <= nodeEnd)
      pending++
    nodeStart = nodeEnd
  }
  return true
}

function isProse(node: Text): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (NON_PROSE_ELEMENTS.has(parent.tagName)) return false
  }
  return true
}

function blockOf(node: Text): Element | null {
  let parent = node.parentElement
  while (parent && INLINE_ELEMENTS.has(parent.tagName)) {
    parent = parent.parentElement
  }
  return parent
}

function proseRuns(root: DocumentFragment): Text[][] {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  )
  const runs: Text[][] = []
  let current: Text[] = []
  let currentBlock: Element | null = null

  const endRun = () => {
    if (current.length > 0) runs.push(current)
    current = []
    currentBlock = null
  }

  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (!INLINE_ELEMENTS.has((node as Element).tagName)) endRun()
      continue
    }
    const text = node as Text
    const block = isProse(text) ? blockOf(text) : null
    if (!block || block !== currentBlock) {
      endRun()
      currentBlock = block
    }
    if (block) current.push(text)
  }
  endRun()
  return runs
}

/** Renders the key combos in reply HTML as keycaps showing the user's binding. */
export function renderShortcutKeycaps(
  html: string,
  resolve: KeySequenceResolver
): string {
  if (!html.includes('+')) return html

  const template = document.createElement('template')
  template.innerHTML = html

  let rewritten = false
  for (const run of proseRuns(template.content)) {
    if (rewriteRun(run, resolve)) rewritten = true
  }
  return rewritten ? template.innerHTML : html
}
