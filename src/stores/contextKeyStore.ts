import { get, set, unset } from 'lodash'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * Tokenizes a context key expression string.
 * @param expr The expression string (e.g., "key1 && !key2 || (key3 && key4)").
 * @returns An array of tokens.
 * @throws Error if invalid characters are found.
 */
function tokenize(expr: string): { t: string }[] {
  const tokens: { t: string }[] = []
  const re = /\s*([A-Za-z0-9_.]+|==|!=|&&|\|\||!|\(|\))\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(expr))) {
    tokens.push({ t: m[1] })
  }
  if (re.lastIndex !== expr.length) {
    throw new Error(`Invalid character in expression at pos ${re.lastIndex}`)
  }
  return tokens
}

const OP_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3
}

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
  op: '&&' | '||' | '==' | '!='
  left: ASTNode
  right: ASTNode
}
type ASTNode = IdentifierNode | UnaryNode | BinaryNode

/**
 * Parses a sequence of tokens into an Abstract Syntax Tree (AST).
 * Implements a simple recursive descent parser for boolean expressions
 * with precedence (NOT > AND > OR) and parentheses.
 * @param tokens The array of tokens from `tokenize`.
 * @returns The root node of the AST.
 * @throws Error on syntax errors (e.g., mismatched parentheses, unexpected tokens).
 */
function parseAST(tokens: Token[]): ASTNode {
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

  function parsePrimary(): any {
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
    const id = consume()
    if (!/^[A-Za-z0-9_.]+$/.test(id)) {
      throw new Error(`Invalid identifier: ${id}`)
    }
    return { type: 'Identifier', name: id }
  }

  function parseExpression(minPrec: number): any {
    let left = parsePrimary()
    while (true) {
      const op = peek()
      const prec = op ? OP_PRECEDENCE[op] : undefined
      if (prec === undefined || prec < minPrec) break
      consume(op)
      const right = parseExpression(prec + 1)
      left = { type: 'Binary', op, left, right }
    }
    return left
  }

  const ast = parseExpression(0)
  if (i < tokens.length) {
    throw new Error(`Unexpected token ${peek()}`)
  }
  return ast
}

type ContextValue = string | number | boolean

function getNodeRawValue(
  node: ASTNode,
  getContextKey: (key: string) => ContextValue | undefined
): ContextValue | boolean {
  if (node.type === 'Identifier') {
    const raw = getContextKey(node.name)
    return raw === undefined ? false : raw
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
function evalAst(
  node: ASTNode,
  getContextKey: (key: string) => ContextValue | undefined
): boolean {
  switch (node.type) {
    case 'Identifier': {
      const raw = getContextKey(node.name)
      if (raw === undefined) return false
      if (typeof raw === 'boolean') return raw
      if (typeof raw === 'string') return raw.length > 0
      if (typeof raw === 'number') return raw !== 0
      return false
    }
    case 'Unary':
      return !evalAst(node.arg, getContextKey)
    case 'Binary': {
      const { op, left, right } = node
      if (op === '&&' || op === '||') {
        const l = evalAst(left, getContextKey)
        const r = evalAst(right, getContextKey)
        return op === '&&' ? l && r : l || r
      }
      const lRaw = getNodeRawValue(left, getContextKey)
      const rRaw = getNodeRawValue(right, getContextKey)
      return op === '==' ? lRaw === rRaw : lRaw !== rRaw
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
function evaluateExpression(
  expr: string,
  getContextKey: (key: string) => ContextValue | undefined
): boolean {
  if (!expr) return true

  try {
    const tokens = tokenize(expr)
    const ast = parseAST(tokens)
    return evalAst(ast, getContextKey)
  } catch (error) {
    console.error(`Error evaluating expression "${expr}":`, error)
    return false
  }
}

export const useContextKeyStore = defineStore('contextKeys', () => {
  const contextKeys = reactive<Record<string, ContextValue>>({})

  /**
   * Get a stored context key by path
   * @param {string} path - The path to the context key (e.g., 'a.b.c').
   * @returns {boolean|undefined} The value of the context key, or undefined if not found.
   */
  function getContextKey(path: string): ContextValue | undefined {
    return get(contextKeys, path)
  }

  /**
   * Set or update a context key value at a given path
   * @param {string} path - The path to the context key (e.g., 'a.b.c').
   * @param {boolean} value - The value to set for the context key.
   */
  function setContextKey(path: string, value: ContextValue) {
    set(contextKeys, path, value)
  }

  /**
   * Remove a context key by path
   * @param {string} path - The path to the context key to remove (e.g., 'a.b.c').
   */
  function removeContextKey(path: string) {
    unset(contextKeys, path)
  }

  /**
   * Clear all context keys
   */
  function clearAllContextKeys() {
    for (const key in contextKeys) {
      delete contextKeys[key]
    }
  }

  /**
   * Evaluates a context key expression string using the current context keys.
   * Returns false if the expression is invalid or if any referenced key is undefined.
   * @param {string} expr - The expression string (e.g., "key1 && !key2 || (key3 && key4)").
   * @returns {boolean} The result of the expression evaluation.
   */
  function evaluateCondition(expr: string): boolean {
    return evaluateExpression(expr, getContextKey)
  }

  return {
    contextKeys,
    getContextKey,
    setContextKey,
    removeContextKey,
    clearAllContextKeys,
    evaluateCondition
  }
})
