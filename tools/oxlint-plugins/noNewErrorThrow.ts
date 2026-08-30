import { createRequire } from 'node:module'
import path from 'node:path'

const requireFrom = createRequire(import.meta.url)

interface Node {
  readonly type: string
}

interface Identifier extends Node {
  readonly type: 'Identifier'
  readonly name: string
}

interface NewExpression extends Node {
  readonly type: 'NewExpression'
  readonly callee: Node
}

interface ThrowStatement extends Node {
  readonly type: 'ThrowStatement'
  readonly argument?: Node
}

interface Program extends Node {
  readonly type: 'Program'
}

interface SourceCode {
  getText(node: Node): string
  getTokens(node: Node): readonly Node[]
  isGlobalReference(node: Identifier): boolean
}

interface RuleContext {
  readonly cwd: string
  readonly filename: string
  readonly sourceCode: SourceCode
  report(descriptor: { node: Node; message: string }): void
}

export type NoNewErrorThrowAllowances = Readonly<
  Record<string, Readonly<Record<string, number>>>
>

export interface NoNewErrorThrowException {
  readonly file: string
  readonly expression: string
  readonly count: number
  readonly reference: string
  readonly rationale: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readAllowances(value: unknown): NoNewErrorThrowAllowances {
  if (!isRecord(value)) throw new TypeError('Invalid no-new-error baseline')

  const result: Record<string, Record<string, number>> = {}
  for (const [file, fingerprints] of Object.entries(value)) {
    if (!isRecord(fingerprints)) {
      throw new TypeError(`Invalid no-new-error baseline for ${file}`)
    }
    result[file] = {}
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      if (!Number.isInteger(count) || Number(count) < 1) {
        throw new TypeError(`Invalid no-new-error count for ${file}`)
      }
      result[file][fingerprint] = Number(count)
    }
  }
  return result
}

function readExceptions(value: unknown): readonly NoNewErrorThrowException[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Invalid no-new-error exception list')
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.file !== 'string' ||
      entry.file.trim() === '' ||
      typeof entry.expression !== 'string' ||
      entry.expression.trim() === '' ||
      !Number.isInteger(entry.count) ||
      Number(entry.count) < 1 ||
      typeof entry.reference !== 'string' ||
      entry.reference.trim() === '' ||
      typeof entry.rationale !== 'string' ||
      entry.rationale.trim() === ''
    ) {
      throw new TypeError('Invalid no-new-error exception')
    }
    return {
      file: entry.file,
      expression: entry.expression,
      count: Number(entry.count),
      reference: entry.reference,
      rationale: entry.rationale
    }
  })
}

const rawBaseline: unknown = requireFrom('./noNewErrorThrowBaseline.json')
const baseline = readAllowances(rawBaseline)

const rawExceptions: unknown = requireFrom('./noNewErrorThrowExceptions.json')
export const noNewErrorThrowExceptions = readExceptions(rawExceptions)

function exceptionAllowances(
  exceptions: readonly NoNewErrorThrowException[]
): NoNewErrorThrowAllowances {
  const allowances: Record<string, Record<string, number>> = {}
  for (const exception of exceptions) {
    const fileAllowances = (allowances[exception.file] ??= {})
    fileAllowances[exception.expression] =
      (fileAllowances[exception.expression] ?? 0) + exception.count
  }
  return allowances
}

function mergeFileAllowances(
  file: string,
  allowances: NoNewErrorThrowAllowances,
  exceptions: NoNewErrorThrowAllowances
): Readonly<Record<string, number>> {
  const merged: Record<string, number> = { ...allowances[file] }
  for (const [fingerprint, count] of Object.entries(exceptions[file] ?? {})) {
    merged[fingerprint] = (merged[fingerprint] ?? 0) + count
  }
  return merged
}

function relativeFilename(context: RuleContext): string {
  return path.relative(context.cwd, context.filename).replaceAll(path.sep, '/')
}

function directGlobalErrorConstruction(
  context: RuleContext,
  node: ThrowStatement
): NewExpression | undefined {
  const argument = node.argument
  if (argument?.type !== 'NewExpression') return
  const expression = argument as NewExpression
  if (expression.callee.type !== 'Identifier') return
  const callee = expression.callee as Identifier
  return callee.name === 'Error' && context.sourceCode.isGlobalReference(callee)
    ? expression
    : undefined
}

function noNewErrorThrowFingerprint(
  sourceCode: SourceCode,
  expression: NewExpression
): string {
  return sourceCode
    .getTokens(expression)
    .map((token) => sourceCode.getText(token))
    .join(' ')
}

export function createNoNewErrorThrowRule(
  allowances: NoNewErrorThrowAllowances,
  approvedExceptions: readonly NoNewErrorThrowException[] = []
) {
  const exceptions = exceptionAllowances(approvedExceptions)

  return {
    create(context: RuleContext) {
      const file = relativeFilename(context)
      const allowed = mergeFileAllowances(file, allowances, exceptions)
      const actual = new Map<string, number>()

      return {
        ThrowStatement(node: ThrowStatement) {
          const expression = directGlobalErrorConstruction(context, node)
          if (!expression) return

          const fingerprint = noNewErrorThrowFingerprint(
            context.sourceCode,
            expression
          )
          const count = (actual.get(fingerprint) ?? 0) + 1
          actual.set(fingerprint, count)
          if (count <= (allowed[fingerprint] ?? 0)) return

          context.report({
            node: expression,
            message: `Do not add \`throw new Error(...)\` in production code. Preserve an approved fail-closed contract with a centralized entry in noNewErrorThrowExceptions.json, or use the recoverable diagnostics contract from ADR 0019. Fingerprint: ${fingerprint}`
          })
        },
        'Program:exit'(node: Program) {
          for (const [fingerprint, count] of Object.entries(allowed)) {
            if ((actual.get(fingerprint) ?? 0) >= count) continue
            context.report({
              node,
              message: `Stale no-new-error allowance for ${fingerprint}. Regenerate the baseline or prune the approved exception.`
            })
          }
        }
      }
    }
  }
}

export const noNewErrorThrow = createNoNewErrorThrowRule(
  baseline,
  noNewErrorThrowExceptions
)

export const collectNoNewErrorThrow = {
  create(context: RuleContext) {
    return {
      ThrowStatement(node: ThrowStatement) {
        const expression = directGlobalErrorConstruction(context, node)
        if (!expression) return
        context.report({
          node: expression,
          message: noNewErrorThrowFingerprint(context.sourceCode, expression)
        })
      }
    }
  }
}
