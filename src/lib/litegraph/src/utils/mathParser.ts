type Token = { type: 'number'; value: number } | { type: 'op'; value: string }

function tokenize(input: string): Token[] | undefined {
  const tokens: Token[] = []
  const re = /(\d+(?:\.\d*)?|\.\d+)|([+\-*/%()])/g
  let lastIndex = 0

  for (const match of input.matchAll(re)) {
    const gap = input.slice(lastIndex, match.index)
    if (gap.trim()) return undefined
    lastIndex = match.index + match[0].length

    if (match[1]) tokens.push({ type: 'number', value: parseFloat(match[1]) })
    else tokens.push({ type: 'op', value: match[2] })
  }

  if (input.slice(lastIndex).trim()) return undefined
  return tokens
}

/**
 * Evaluates a basic arithmetic expression string containing
 * `+`, `-`, `*`, `/`, `%`, parentheses, and decimal numbers.
 * Returns `undefined` for empty or malformed input.
 */
export function evaluateMathExpression(input: string): number | undefined {
  const tokenized = tokenize(input)
  if (!tokenized || tokenized.length === 0) return undefined

  const tokens: Token[] = tokenized
  let pos = 0
  let depth = 0
  const MAX_DEPTH = 200

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function consume(): Token {
    return tokens[pos++]
  }

  function primary(): number | undefined {
    const t = peek()
    if (!t) return undefined

    if (t.type === 'number') {
      consume()
      return t.value
    }

    if (t.type === 'op' && t.value === '(') {
      if (++depth > MAX_DEPTH) return undefined
      consume()
      const result = expr()
      if (result === undefined) return undefined
      const closing = peek()
      if (!closing || closing.type !== 'op' || closing.value !== ')') {
        return undefined
      }
      consume()
      depth--
      return result
    }

    return undefined
  }

  function unary(): number | undefined {
    const t = peek()
    if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume()
      const operand = unary()
      if (operand === undefined) return undefined
      return t.value === '-' ? -operand : operand
    }
    return primary()
  }

  function factor(): number | undefined {
    let left = unary()
    if (left === undefined) return undefined

    while (
      peek()?.type === 'op' &&
      (peek()!.value === '*' || peek()!.value === '/' || peek()!.value === '%')
    ) {
      const op = consume().value
      const right = unary()
      if (right === undefined) return undefined
      left =
        op === '*' ? left * right : op === '/' ? left / right : left % right
    }
    return left
  }

  function expr(): number | undefined {
    let left = factor()
    if (left === undefined) return undefined

    while (
      peek()?.type === 'op' &&
      (peek()!.value === '+' || peek()!.value === '-')
    ) {
      const op = consume().value
      const right = factor()
      if (right === undefined) return undefined
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  const result = expr()
  if (result === undefined || pos !== tokens.length) return undefined
  return result === 0 ? 0 : result
}
