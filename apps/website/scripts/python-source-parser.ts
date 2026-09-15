export function sliceBalanced(source: string, openIndex: number): string {
  const open = source[openIndex]
  const close = open === '(' ? ')' : open === '[' ? ']' : '}'
  let depth = 0
  let inString: string | null = null
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') i++
      else if (source.startsWith(inString, i)) {
        i += inString.length - 1
        inString = null
      }
      continue
    }
    if (source.startsWith('"""', i)) {
      inString = '"""'
      i += 2
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(openIndex + 1, i)
    }
  }
  throw new Error(
    `Unbalanced ${open} at index ${openIndex} while parsing node schema`
  )
}
