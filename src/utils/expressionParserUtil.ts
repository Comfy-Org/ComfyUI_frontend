type Token = { t: string }
interface IdentifierNode {
  type: 'Identifier'
  name: string
}
interface UnaryNode {
  type: 'Unary'
  op: '!'
  left?: never
  right?: never
  arg: ASTNode
}
interface BinaryNode {
  type: 'Binary'
  op: '&&' | '||' | '==' | '!=' | '<' | '>' | '<=' | '>='
  left: ASTNode
  right: ASTNode
}
interface LiteralNode {
  type: 'Literal'
  value: ContextValue
}
type ASTNode = IdentifierNode | UnaryNode | BinaryNode | LiteralNode
export type ContextValue = string | number | boolean

const OP_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '>': 3,
  '<=': 3,
  '>=': 3
}

// hoist and reuse the regex, avoid re‑allocating literal each call
const TOKEN_REGEX =
  /\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|==|!=|<=|>=|&&|\|\||<|>|[A-Za-z0-9_.]+|!|\(|\))\s*/g
// cache parsed ASTs per expression
const astCache = new Map<string, ASTNode>()

/**
 * Tokenizes a context key expression string.
 * @param expr The expression string (e.g., "key1 && !key2 || (key3 && key4)").
 * @returns An array of tokens.
 * @throws Error if invalid characters are found.
 */
export function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  // clone/reset regex state
  const re = new RegExp(TOKEN_REGEX)
  let m: RegExpExecArray | null
  while ((m = re.exec(expr))) {
    if (m.index !== pos) {
      throw new Error(`Invalid character in expression at pos ${pos}`)
    }
    tokens.push({ t: m[1] })
    pos = re.lastIndex
  }
  if (pos !== expr.length) {
    throw new Error(`Invalid character in expression at pos ${pos}`)
  }
  return tokens
}

/**
 * Parses a sequence of tokens into an Abstract Syntax Tree (AST).
 * Implements a simple recursive descent parser for boolean expressions
 * with precedence (NOT > AND > OR) and parentheses.
 * @param tokens The array of tokens from `tokenize`.
 * @returns The root node of the AST.
 * @throws Error on syntax errors (e.g., mismatched parentheses, unexpected tokens).
 */
export function parseAST(tokens: Token[]): ASTNode {
  let i = 0

  function peek(): string | undefined {
    return tokens[i]?.t
  }

  function consume(expected?: string): string {
    const tok = tokens[i++]?.t
    if (expected && tok !== expected) {
      throw new Error(`Expected ${expected}, got ${tok ?? 'end of input'}`)
    }
    if (!tok) {
      throw new Error(`Expected ${expected}, got end of input`)
    }
    return tok
  }

  function parsePrimary(): ASTNode {
    if (peek() === '!') {
      consume('!')
      return { type: 'Unary', op: '!', arg: parsePrimary() }
    }
    if (peek() === '(') {
      consume('(')
      const expr = parseExpression(0)
      consume(')')
      return expr
    }
    const tok = consume()
    // string literal?
    if (
      (tok[0] === '"' && tok[tok.length - 1] === '"') ||
      (tok[0] === "'" && tok[tok.length - 1] === "'")
    ) {
      const raw = tok.slice(1, -1).replace(/\\(.)/g, '$1')
      return { type: 'Literal', value: raw }
    }
    // numeric literal?
    if (/^\d+(\.\d+)?$/.test(tok)) {
      return { type: 'Literal', value: Number(tok) }
    }
    // identifier
    if (!/^[A-Za-z0-9_.]+$/.test(tok)) {
      throw new Error(`Invalid identifier: ${tok}`)
    }
    return { type: 'Identifier', name: tok }
  }

  function parseExpression(minPrec: number): ASTNode {
    let left = parsePrimary()
    while (true) {
      const tok = peek()
      const prec = tok ? OP_PRECEDENCE[tok] : undefined
      if (prec === undefined || prec < minPrec) break
      consume(tok)
      const right = parseExpression(prec + 1)
      // cast tok to the exact operator union
      left = { type: 'Binary', op: tok as BinaryNode['op'], left, right }
    }
    return left
  }

  const ast = parseExpression(0)
  if (i < tokens.length) {
    throw new Error(`Unexpected token ${peek()}`)
  }
  return ast
}

/**
 * Converts a ContextValue or undefined to boolean.
 */
function toBoolean(val: ContextValue | undefined): boolean {
  if (val === undefined) return false
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val !== 0
  if (typeof val === 'string') return val.length > 0
  return false
}

/**
 * Retrieves raw value of an AST node for equality checks.
 */
function getRawValue(
  node: ASTNode,
  getContextKey: (key: string) => ContextValue | undefined
): ContextValue | boolean {
  if (node.type === 'Literal') return node.value
  if (node.type === 'Identifier') {
    const val = getContextKey(node.name)
    return val === undefined ? false : val
  }
  return evalAst(node, getContextKey)
}

/**
 * Evaluates an AST node recursively.
 * @param node The AST node to evaluate.
 * @param getContextKey A function to retrieve the boolean value of a context key identifier.
 * @returns The boolean result of the evaluation.
 * @throws Error for unknown AST node types.
 */
export function evalAst(
  node: ASTNode,
  getContextKey: (key: string) => ContextValue | undefined
): boolean {
  switch (node.type) {
    case 'Literal':
      return toBoolean(node.value)
    case 'Identifier':
      return toBoolean(getContextKey(node.name))
    case 'Unary':
      return !evalAst(node.arg, getContextKey)
    case 'Binary': {
      const { op, left, right } = node
      if (op === '&&' || op === '||') {
        const l = evalAst(left, getContextKey)
        const r = evalAst(right, getContextKey)
        return op === '&&' ? l && r : l || r
      }
      const lRaw = getRawValue(left, getContextKey)
      const rRaw = getRawValue(right, getContextKey)
      switch (op) {
        case '==':
          return lRaw === rRaw
        case '!=':
          return lRaw !== rRaw
        case '<':
          return (lRaw as any) < (rRaw as any)
        case '>':
          return (lRaw as any) > (rRaw as any)
        case '<=':
          return (lRaw as any) <= (rRaw as any)
        case '>=':
          return (lRaw as any) >= (rRaw as any)
        default:
          throw new Error(`Unsupported operator: ${op}`)
      }
    }
    default:
      throw new Error(`Unknown AST node type: ${(node as ASTNode).type}`)
  }
}

/**
 * Parses and evaluates a context key expression string.
 *
 * @param expr The expression string (e.g., "key1 && !key2").
 * @param getContextKey A function to resolve context key identifiers to boolean values.
 * @returns The boolean result of the expression.
 * @throws Error on parsing or evaluation errors.
 */
export function evaluateExpression(
  expr: string,
  getContextKey: (key: string) => ContextValue | undefined
): boolean {
  if (!expr) return true

  try {
    let ast: ASTNode
    if (astCache.has(expr)) {
      ast = astCache.get(expr)!
    } else {
      const tokens = tokenize(expr)
      ast = parseAST(tokens)
      astCache.set(expr, ast)
    }
    return evalAst(ast, getContextKey)
  } catch (error) {
    console.error(`Error evaluating expression "${expr}":`, error)
    return false
  }
}
