import { CANVAS_ACTION_COMMAND_IDS } from '@/platform/keybindings/canvasActionShortcuts'

/**
 * Renders the keyboard shortcuts in an agent reply as keycaps, using the keys
 * the user is actually bound to rather than the ones the model remembers.
 *
 * The model learned its shortcuts from training data, so it sometimes names a
 * key that is wrong for this build, and it always names the wrong one for a user
 * who rebound the action. Both are fixed here rather than in the prompt: the
 * frontend owns the keybinding registry, so it can answer per user and per
 * preset, and it costs no prompt tokens on the turns where shortcuts never come
 * up (DES-779).
 *
 * Two things happen, and only ever inside prose:
 *
 *   1. Every modifier-bearing key combo becomes `<kbd>` keycaps. Matching the
 *      shape of a combo rather than the words around it is language
 *      independent, which matters because most agent traffic is not English.
 *   2. When the sentence holding a combo names exactly one canvas action we
 *      have a command for, the combo is replaced by that command's CURRENT
 *      keys. Two different action words in one sentence make the pairing a
 *      guess, and a confidently wrong key is the bug being fixed, so those are
 *      styled and otherwise left alone.
 *
 * Nothing is injected into prose that did not already contain a combo: a reply
 * naming an action without a key is left exactly as written. Code spans, fenced
 * code, link text and existing keycaps are never touched.
 */

/** The user's current key labels for a command, or undefined when unbound. */
export type KeySequenceResolver = (commandId: string) => string[] | undefined

/** Elements whose text is not prose, so is never rewritten. */
const SKIPPED_ANCESTORS = new Set([
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

// Longest phrase first, so a two-word phrase is never cut in half by its own
// first word.
const ACTION_SOURCE = `\\b(${Object.keys(CANVAS_ACTION_COMMAND_IDS)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|')})\\b`

// Modifier spellings the model actually emits, including the macOS glyphs and
// the Cmd/Option names a Mac-shaped reply uses. The app itself labels Meta as
// `Ctrl` (keyCombo.ts MODIFIER_KEY_LABELS) and has no Mac-specific labels, so a
// resolved combo reads `Ctrl` whatever the model wrote, and matches what the
// Keybindings settings panel shows that user.
const MODIFIER = String.raw`[Cc]trl|CTRL|[Cc]ontrol|[Cc]md|[Cc]ommand|⌘|[Aa]lt|ALT|[Oo]ption|[Oo]pt|⌥|[Ss]hift|SHIFT|⇧`

const NAMED_KEY = String.raw`F\d{1,2}|Enter|Return|Esc(?:ape)?|Space(?:bar)?|Tab|Delete|Del|Backspace|Home|End|PageUp|PageDown|Up|Down|Left|Right`

const SINGLE_KEY =
  String.raw`[A-Za-z0-9` +
  '`' +
  String.raw`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?]`

// A combo is a modifier plus at least one further token. A bare key ("press P")
// is deliberately not matched: with no modifier it cannot be told apart from
// ordinary prose.
const COMBO_SOURCE = String.raw`(?:${MODIFIER})(?:\s*\+\s*(?:${MODIFIER}|${NAMED_KEY}|${SINGLE_KEY}))+`

/**
 * Sentence-ish spans, so a combo is only paired with the words beside it. The
 * lookbehind keeps the delimiter on the span it ended, which is what lets the
 * pieces be reassembled byte for byte.
 */
const SENTENCE_SPLIT = /(?<=[.!?;\n])/

/**
 * Formats one key label the way the Keybindings settings panel does. That panel
 * capitalizes through CSS, which an agent reply's `<kbd>` does not, so a
 * single-character key is upper-cased here instead of rendering as `Ctrl+b`.
 */
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

/** The combo as the model wrote it, split into the tokens to put in keycaps. */
function writtenSequences(combo: string): string[] {
  return combo
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
}

/**
 * The single canvas action named in `sentence`, or undefined when it names none
 * or names two different ones.
 */
function soleActionCommandId(sentence: string): string | undefined {
  const commandIds = new Set<string>()
  for (const match of sentence.matchAll(new RegExp(ACTION_SOURCE, 'gi'))) {
    const phrase =
      match[1].toLowerCase() as keyof typeof CANVAS_ACTION_COMMAND_IDS
    commandIds.add(CANVAS_ACTION_COMMAND_IDS[phrase])
  }
  return commandIds.size === 1 ? [...commandIds][0] : undefined
}

/**
 * Rewrites one sentence into `fragment`, returning nothing: the caller relies on
 * the pieces appending in order so the node reassembles exactly.
 */
function appendSentence(
  fragment: DocumentFragment,
  sentence: string,
  resolve: KeySequenceResolver
): void {
  const commandId = soleActionCommandId(sentence)
  const bound = commandId ? resolve(commandId) : undefined
  const liveKeys = bound && bound.length > 0 ? bound : undefined

  let cursor = 0
  for (const match of sentence.matchAll(new RegExp(COMBO_SOURCE, 'g'))) {
    const start = match.index
    if (start > cursor) fragment.append(sentence.slice(cursor, start))
    fragment.append(keycaps(liveKeys ?? writtenSequences(match[0])))
    cursor = start + match[0].length
  }
  fragment.append(sentence.slice(cursor))
}

function rewriteTextNode(node: Text, resolve: KeySequenceResolver): boolean {
  const text = node.data
  if (!new RegExp(COMBO_SOURCE).test(text)) return false

  const sentences = text.split(SENTENCE_SPLIT)
  // The split has to reassemble the original exactly, or the rewrite would
  // silently drop prose. Leave the node alone if it somehow does not.
  if (sentences.reduce((n, s) => n + s.length, 0) !== text.length) return false

  const fragment = document.createDocumentFragment()
  for (const sentence of sentences) {
    appendSentence(fragment, sentence, resolve)
  }
  node.replaceWith(fragment)
  return true
}

function isProse(node: Text): boolean {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (SKIPPED_ANCESTORS.has(parent.tagName)) return false
  }
  return true
}

/**
 * Rewrites the shortcuts in one block of already-rendered, already-sanitized
 * reply HTML. The result is sanitized again downstream, and nothing here is
 * built from an HTML string (only `createElement` and text nodes), so no markup
 * can be smuggled through a key label.
 */
export function renderShortcutKeycaps(
  html: string,
  resolve: KeySequenceResolver
): string {
  // Every combo this matches contains a `+`, so a reply without one cannot need
  // rewriting and never pays for a parse.
  if (!html.includes('+')) return html

  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT
  )

  // Collected first: replacing a node mid-walk invalidates the walker.
  const candidates: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (isProse(node)) candidates.push(node)
  }

  let rewritten = false
  for (const node of candidates) {
    if (rewriteTextNode(node, resolve)) rewritten = true
  }
  return rewritten ? template.innerHTML : html
}
