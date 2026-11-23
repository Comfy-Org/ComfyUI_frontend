export function parseJsonWithNonFinite<T = unknown>(
  text: string & { readonly parsedType?: T }
): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return JSON.parse(replaceNonFiniteTokens(text)) as T
  }
}

const NON_FINITE_TOKEN = /(?<![\w.-])(?:-?Infinity|NaN)(?![\w.])/y

function replaceNonFiniteTokens(text: string): string {
  const parts: string[] = []
  let inString = false
  let segmentStart = 0

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (inString && char === '\\') {
      index++
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    NON_FINITE_TOKEN.lastIndex = index
    if (!NON_FINITE_TOKEN.test(text)) continue

    parts.push(text.slice(segmentStart, index), 'null')
    segmentStart = NON_FINITE_TOKEN.lastIndex
    index = segmentStart - 1
  }

  if (!parts.length) return text

  console.warn(
    'JSON contained non-finite numeric tokens (NaN/Infinity); they were replaced with null.'
  )
  parts.push(text.slice(segmentStart))
  return parts.join('')
}
