export const WORD_STAGGER_MS = 35

interface SpeechPart {
  text: string
  pauseBeforeMs?: number
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/**
 * Returns each part's start in milliseconds and the next word's start.
 * Starts include per-part pauses and WORD_STAGGER_MS between words.
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
