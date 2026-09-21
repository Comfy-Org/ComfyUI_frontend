import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import type {
  Expression,
  LeftHandSideExpression,
  MemberName,
  Node,
  SourceFile
} from 'typescript'
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isStringLiteral,
  ScriptTarget,
  SyntaxKind
} from 'typescript'

type DisabledDeclaration = {
  line: number
  relevantLines: number[]
}

const HUNK_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/
const TEST_SOURCE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/
const RESTORATION_INTENT_PATTERN =
  /(?:re-?enabl(?:e|ed|ing)?|restor(?:e|ed|es|ing|ation)|disabled[- ]test(?:[\s-]+follow-?up)?|test[\s-]+restoration)/i
const RESTORATION_REFERENCE_PATTERN =
  /(?:#\d+|https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/(?:issues|pull)\/\d+|https:\/\/linear\.app\/comfyorg\/issue\/[A-Z]+-\d+(?:\/[^\s]*)?)/i

function git(cwd: string, ...args: string[]): Buffer {
  return execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function lineOf(node: Node, sourceFile: SourceFile): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  )
}

function disablingModifier(
  expression: LeftHandSideExpression
): MemberName | undefined {
  if (!isPropertyAccessExpression(expression)) return
  if (expression.name.text !== 'skip' && expression.name.text !== 'fixme')
    return

  const receiver = expression.expression
  if (
    isIdentifier(receiver) &&
    ['test', 'it', 'describe'].includes(receiver.text)
  ) {
    return expression.name
  }
  if (
    isPropertyAccessExpression(receiver) &&
    isIdentifier(receiver.expression) &&
    receiver.expression.text === 'test' &&
    receiver.name.text === 'describe'
  ) {
    return expression.name
  }
}

function isDisablingArgument(argument: Expression): boolean {
  return (
    isStringLiteral(argument) ||
    isNoSubstitutionTemplateLiteral(argument) ||
    argument.kind === SyntaxKind.TrueKeyword
  )
}

export function disabledDeclarations(
  source: string,
  path = 'test.ts'
): DisabledDeclaration[] {
  const sourceFile = createSourceFile(path, source, ScriptTarget.Latest, true)
  const declarations: DisabledDeclaration[] = []

  function visit(node: Node): void {
    if (isCallExpression(node)) {
      const modifier = disablingModifier(node.expression)
      if (modifier && node.arguments.length > 0) {
        const argument = node.arguments[0]
        if (isDisablingArgument(argument)) {
          declarations.push({
            line: lineOf(node.expression, sourceFile),
            relevantLines: [
              ...new Set([
                lineOf(modifier, sourceFile),
                lineOf(argument, sourceFile)
              ])
            ]
          })
        }
      }
    }
    forEachChild(node, visit)
  }

  visit(sourceFile)
  return declarations
}

function addedTargetLines(patch: string): Set<number> {
  const added = new Set<number>()
  let targetLine: number | undefined

  for (const rawLine of patch.split('\n')) {
    const hunk = HUNK_PATTERN.exec(rawLine)
    if (hunk) {
      targetLine = Number(hunk[1])
    } else if (targetLine !== undefined && rawLine.startsWith('+')) {
      added.add(targetLine)
      targetLine += 1
    } else if (targetLine !== undefined && rawLine.startsWith(' ')) {
      targetLine += 1
    }
  }

  return added
}

export function findViolations(
  cwd: string,
  baseSha: string,
  headSha: string
): string[] {
  const revision = `${baseSha}...${headSha}`
  const changedPaths = git(
    cwd,
    'diff',
    '--name-only',
    '-z',
    '--diff-filter=d',
    revision
  )
    .toString('utf8')
    .split('\0')
    .filter((path) => path && TEST_SOURCE_PATTERN.test(path))
  const violations: string[] = []

  for (const path of changedPaths) {
    const patch = git(
      cwd,
      'diff',
      '--unified=0',
      '--no-color',
      '--no-ext-diff',
      revision,
      '--',
      path
    ).toString('utf8')
    const source = git(cwd, 'show', `${headSha}:${path}`).toString('utf8')
    const sourceLines = source.split('\n')
    const addedLines = addedTargetLines(patch)

    for (const declaration of disabledDeclarations(source, path)) {
      if (declaration.relevantLines.some((line) => addedLines.has(line))) {
        const content = sourceLines[declaration.line - 1]?.trim() ?? ''
        violations.push(`  ${path}:${declaration.line}: ${content}`)
      }
    }
  }

  return violations
}

export function hasRestorationReference(body: string): boolean {
  return body
    .split(/\r?\n/)
    .some(
      (line) =>
        RESTORATION_INTENT_PATTERN.test(line) &&
        RESTORATION_REFERENCE_PATTERN.test(line)
    )
}

export function main(
  args: string[],
  cwd = process.cwd(),
  body = process.env.PR_BODY ?? ''
): number {
  if (args.length !== 2) {
    console.error(
      'usage: check-disabled-test-tracking.ts <base_sha> <head_sha>'
    )
    return 2
  }

  const [baseSha, headSha] = args
  try {
    const violations = findViolations(cwd, baseSha, headSha)
    if (violations.length === 0) {
      process.stdout.write('No newly disabled tests in this pull request.\n')
      return 0
    }

    if (hasRestorationReference(body)) {
      process.stdout.write(
        'This pull request disables tests and names the restoration work:\n'
      )
      process.stdout.write(`\n${violations.join('\n')}\n`)
      return 0
    }

    console.error(
      '::error::This pull request disables a test but its body names no restoration work.'
    )
    console.error(`\nNewly disabled:\n\n${violations.join('\n')}`)
    console.error(
      '\nAdd a tracking issue or follow-up PR with explicit restoration intent, for example:\n\n' +
        '  Re-enabled by #12345\n' +
        '  Test restoration tracked in https://linear.app/comfyorg/issue/FE-1234\n\n' +
        'If a test is being retired, delete it instead of disabling it.'
    )
    return 1
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`::error::Could not inspect disabled tests: ${detail}`)
    return 2
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  process.exitCode = main(process.argv.slice(2))
}
