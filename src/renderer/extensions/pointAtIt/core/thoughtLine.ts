import { messages } from './messages'
import type { ThinkingLog } from './thinkingLog'

const SENTENCE_END = /[.!?…]["')\]]*$/
const BOUNDARY = /(?<=[.!?…]["')\]]*)\s+|\n+/

/** Markdown marks the model may put around its thinking, which read as noise. */
function plain(thought: string): string {
  return thought
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s*/, '')
    .trim()
}

/**
 * The most recent complete thought in thinking that is still arriving.
 *
 * The provider streams thinking in fragments that can end mid-word, so a
 * thought is cut at the end of a sentence or at a line break. The sentence
 * still being written is left out until it is complete, or until the
 * thinking is done; before the first one completes this is ''.
 */
export function latestThought(
  text: string,
  { done }: { done: boolean }
): string {
  const thoughts = text
    .split(BOUNDARY)
    .map(plain)
    .filter((thought) => thought !== '')
  const last = thoughts.at(-1)
  if (last === undefined) return ''
  const finished = done || SENTENCE_END.test(last) || /\n\s*$/.test(text)
  return finished ? last : (thoughts.at(-2) ?? '')
}

/**
 * The one line shown while a request thinks: its latest complete thought, or
 * the plain waiting line before there is one.
 */
export function waitingLine(thinking: ThinkingLog | null): string {
  return (
    latestThought(thinking?.text ?? '', { done: thinking?.done ?? false }) ||
    messages.askWaiting
  )
}
