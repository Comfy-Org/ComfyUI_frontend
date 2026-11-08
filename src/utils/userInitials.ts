const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

function lettersOf(word: string): string[] {
  const codePoints = Array.from(word)
  const letters = codePoints.filter((codePoint) =>
    LETTER_OR_DIGIT.test(codePoint)
  )
  return letters.length > 0 ? letters : codePoints
}

export function getUserInitials(
  displayName: string | null | undefined,
  email: string | null | undefined
): string | undefined {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  const emailLocalPart = email?.trim().split('@')[0] ?? ''
  const letters =
    words.length > 1
      ? [lettersOf(words[0])[0], lettersOf(words[words.length - 1])[0]]
      : lettersOf(words[0] ?? emailLocalPart).slice(0, 2)

  return letters.join('').toLocaleUpperCase() || undefined
}
