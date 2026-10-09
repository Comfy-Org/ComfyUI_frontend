export const WORD_STAGGER_MS = 35

interface SpeechPart {
  text: string
  pauseBeforeMs?: number
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/**
 * Paces parts of a message like speech: each part starts after the previous
 * one's last word plus its pause, and words within a part are staggered.
 * `next` is when a word following the last part would start.
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
