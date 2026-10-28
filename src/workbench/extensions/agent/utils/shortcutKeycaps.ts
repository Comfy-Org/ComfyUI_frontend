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

interface Match {
  start: number
  end: number
  keys: string[]
}

function matchesIn(text: string, resolve: KeySequenceResolver): Match[] {
  return [...text.matchAll(new RegExp(MODIFIER_BEARING_COMBO, 'g'))].map(
    (match) => {
      const written = keysAsWritten(match[0])
      const commandId = canvasCommandForWrittenKeys(written)
      const bound = commandId ? resolve(commandId) : undefined
      return {
        start: match.index,
        end: match.index + match[0].length,
        keys: bound?.length ? bound : written
      }
    }
  )
}

function coveringMatches(
  matches: Match[],
  start: number,
  end: number
): Match[] {
  return matches.filter((match) => match.end > start && match.start < end)
}

function spliceMatches(node: Text, nodeStart: number, matches: Match[]): void {
  const text = node.data
  const nodeEnd = nodeStart + text.length
  const fragment = document.createDocumentFragment()
  let cursor = 0

  for (const match of coveringMatches(matches, nodeStart, nodeEnd)) {
    const localStart = Math.max(match.start, nodeStart) - nodeStart
    if (localStart > cursor) fragment.append(text.slice(cursor, localStart))
    if (match.start >= nodeStart) fragment.append(keycaps(match.keys))
    cursor = Math.min(match.end, nodeEnd) - nodeStart
  }

  if (cursor < text.length) fragment.append(text.slice(cursor))
  node.replaceWith(fragment)
}

/**
 * Rewrites one run of text nodes that read as a single stretch of prose. A combo
 * may straddle them, as `Press **Ctrl**+**B**` does, so matching happens on the
 * joined text and each match is spliced back into the nodes it covers. The
 * keycaps land in the node the match starts in; later nodes drop their covered
 * part.
 */
function rewriteRun(run: Text[], resolve: KeySequenceResolver): boolean {
  const matches = matchesIn(run.map((node) => node.data).join(''), resolve)
  if (matches.length === 0) return false

  let nodeStart = 0
  for (const node of run) {
    const length = node.data.length
    spliceMatches(node, nodeStart, matches)
    nodeStart += length
  }
  return true
}

function isProse(node: Text): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (NON_PROSE_ELEMENTS.has(parent.tagName)) return false
  }
  return true
}

/** The nearest ancestor that is not inline, which is as far as a run may reach. */
function blockOf(node: Text): Element | null {
  let parent = node.parentElement
  while (parent && INLINE_ELEMENTS.has(parent.tagName)) {
    parent = parent.parentElement
  }
  return parent
}

function proseRuns(root: DocumentFragment): Text[][] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const runs: Text[][] = []
  let current: Text[] = []
  let currentBlock: Element | null = null

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const block = isProse(node) ? blockOf(node) : null
    if (!block || block !== currentBlock) {
      if (current.length > 0) runs.push(current)
      current = []
      currentBlock = block
    }
    if (block) current.push(node)
  }
  if (current.length > 0) runs.push(current)
  return runs
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

  let rewritten = false
  for (const run of proseRuns(template.content)) {
    if (rewriteRun(run, resolve)) rewritten = true
  }
  return rewritten ? template.innerHTML : html
}
