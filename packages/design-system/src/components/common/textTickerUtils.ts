export function splitTextAtWordBoundary(
  text: string,
  ratio: number
): [string, string] {
  if (ratio >= 1) return [text, '']
  const estimate = Math.floor(text.length * ratio)
  const before = text.lastIndexOf(' ', estimate)
  const breakIndex = before > 0 ? before : text.indexOf(' ')
  if (breakIndex <= 0) return [text, '']
  return [text.substring(0, breakIndex), text.substring(breakIndex + 1)]
}
