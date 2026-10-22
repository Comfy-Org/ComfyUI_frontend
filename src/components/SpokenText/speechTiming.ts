export const WORD_STAGGER_MS = 35
const TALK_WORD_ANIMATION_MS = 350
const WORD_REVEAL_BUDGET_MS = 900

interface SpeechPart {
  text: string
  pauseBeforeMs?: number
}

export type TalkToken = {
  text: string
  delayMs?: number
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export function talkTokens(
  text: string,
  startMs: number,
  staggerMs: number = WORD_STAGGER_MS
): TalkToken[] {
  let wordIndex = 0
  return text.split(/(\s+)/).flatMap((part) => {
    if (part.length === 0) return []
    if (/^\s+$/.test(part)) return [{ text: part }]
    const token = { text: part, delayMs: startMs + wordIndex * staggerMs }
    wordIndex += 1
    return [token]
  })
}

export function wordRevealStaggerMs(wordCount: number): number {
  if (wordCount <= 0) return WORD_STAGGER_MS
  return Math.min(WORD_STAGGER_MS, WORD_REVEAL_BUDGET_MS / wordCount)
}

export function spokenTextDurationMs(
  text: string,
  startMs = 0,
  staggerMs: number = WORD_STAGGER_MS
): number {
  const count = splitWords(text).length
  if (count === 0) return startMs
  return startMs + (count - 1) * staggerMs + TALK_WORD_ANIMATION_MS
}

/**
 * Word start times for successive spoken parts; `next` is when a following word would start.
 */
export function speechTiming(parts: readonly SpeechPart[]): {
  starts: number[]
  next: number
} {
  return parts.reduce<{ starts: number[]; next: number }>(
    ({ starts, next }, { text, pauseBeforeMs = 0 }) => {
      const start = next + pauseBeforeMs
      return {
        starts: [...starts, start],
        next: start + splitWords(text).length * WORD_STAGGER_MS
      }
    },
    { starts: [], next: 0 }
  )
}
