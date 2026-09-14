/**
 * Recases a string that arrives entirely in capitals ("STAGING ENVIRONMENT").
 * A string that carries its own casing is left alone, so proper nouns and
 * punctuation survive.
 */
export function toTitleCase(text: string): string {
  if (text !== text.toUpperCase()) return text
  return text
    .toLowerCase()
    .replace(/(?<=^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
}
