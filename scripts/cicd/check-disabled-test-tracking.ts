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

type TestDeclaration = DisabledDeclaration & {
  context: string
  disabled: boolean
  title: string
}

type ChangedFile = {
  basePath?: string
  path: string
}

const HUNK_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
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

function changedFiles(output: Buffer): ChangedFile[] {
  const fields = output.toString('utf8').split('\0')
  const files: ChangedFile[] = []

  for (let index = 0; fields[index];) {
    const status = fields[index++]
    if (status.startsWith('R') || status.startsWith('C')) {
      files.push({ basePath: fields[index++], path: fields[index++] })
    } else {
      const path = fields[index++]
      files.push({ basePath: status === 'A' ? undefined : path, path })
    }
  }

  return files
}

function lineOf(node: Node, sourceFile: SourceFile): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  )
}

function isTestReceiver(expression: LeftHandSideExpression): boolean {
  if (
    isIdentifier(expression) &&
    ['test', 'it', 'describe'].includes(expression.text)
  ) {
    return true
  }
  return (
    isPropertyAccessExpression(expression) &&
    isIdentifier(expression.expression) &&
    expression.expression.text === 'test' &&
    expression.name.text === 'describe'
  )
}

function disablingModifier(
  expression: LeftHandSideExpression
): MemberName | undefined {
  if (!isPropertyAccessExpression(expression)) return
  if (!['skip', 'fixme'].includes(expression.name.text)) return
  if (isTestReceiver(expression.expression)) return expression.name
}

function isDisablingArgument(argument: Expression): boolean {
  return (
    isStringLiteral(argument) ||
    isNoSubstitutionTemplateLiteral(argument) ||
    argument.kind === SyntaxKind.TrueKeyword
  )
}

function isTestCall(expression: LeftHandSideExpression): boolean {
  return (
    isTestReceiver(expression) ||
    (isPropertyAccessExpression(expression) &&
      isTestReceiver(expression.expression))
  )
}

function testDeclarations(source: string, path: string): TestDeclaration[] {
  const sourceFile = createSourceFile(path, source, ScriptTarget.Latest, true)
  const declarations: TestDeclaration[] = []

  function visit(node: Node): void {
    if (isCallExpression(node) && isTestCall(node.expression)) {
      const modifier = disablingModifier(node.expression)
      const argument = node.arguments[0]
      const title = node.arguments.find(
        (candidate) =>
          isStringLiteral(candidate) ||
          isNoSubstitutionTemplateLiteral(candidate)
      )

      declarations.push({
        context: node.arguments
          .filter(
            (candidate) =>
              candidate !== title && (!modifier || candidate !== argument)
          )
          .map((candidate) =>
            candidate.getText(sourceFile).replace(/\s+/g, ' ')
          )
          .join('|'),
        disabled: Boolean(
          modifier && node.arguments.length > 0 && isDisablingArgument(argument)
        ),
        line: lineOf(node.expression, sourceFile),
        relevantLines:
          modifier && node.arguments.length > 0
            ? [
                ...new Set([
                  lineOf(modifier, sourceFile),
                  lineOf(argument, sourceFile)
                ])
              ]
            : [lineOf(node.expression, sourceFile)],
        title: title?.text ?? ''
      })
    }
    forEachChild(node, visit)
  }

  visit(sourceFile)
  return declarations
}

export function disabledDeclarations(
  source: string,
  path = 'test.ts'
): DisabledDeclaration[] {
  return testDeclarations(source, path)
    .filter(({ disabled }) => disabled)
    .map(({ line, relevantLines }) => ({ line, relevantLines }))
}

function compareDeclarationRank(left: number[], right: number[]): number {
  for (const [index, value] of left.entries()) {
    const difference = value - right[index]
    if (difference !== 0) return difference
  }
  return 0
}

function correspondingBaseDeclarations(
  base: TestDeclaration[],
  head: TestDeclaration[],
  projectBaseLine: (line: number) => number
): Map<number, TestDeclaration> {
  const corresponding = new Map<number, TestDeclaration>()
  const matchedBase = new Set<number>()

  for (const [headIndex, headDeclaration] of head.entries()) {
    if (matchedBase.size === base.length) break
    const candidate = base
      .map((declaration, index) => ({ declaration, index }))
      .filter(({ index }) => !matchedBase.has(index))
      .sort((left, right) => {
        const rank = ({ declaration }: typeof left): number[] => [
          declaration.title === headDeclaration.title ? 0 : 1,
          declaration.context === headDeclaration.context ? 0 : 1,
          Math.abs(projectBaseLine(declaration.line) - headDeclaration.line)
        ]
        return compareDeclarationRank(rank(left), rank(right))
      })[0]
    matchedBase.add(candidate.index)
    corresponding.set(headIndex, candidate.declaration)
  }

  return corresponding
}

function captureNumber(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : Number(value)
}

function projectBaseLine(patch: string, baseLine: number): number {
  let offset = 0

  for (const rawLine of patch.split('\n')) {
    const hunk = HUNK_PATTERN.exec(rawLine)
    if (!hunk) continue

    const baseStart = Number(hunk[1])
    const baseCount = captureNumber(hunk[2], 1)
    const targetStart = Number(hunk[3])
    const targetCount = captureNumber(hunk[4], 1)
    if (baseLine < baseStart) return baseLine + offset
    if (baseCount > 0 && baseLine < baseStart + baseCount) {
      return targetStart + Math.min(baseLine - baseStart, targetCount - 1)
    }
    offset += targetCount - baseCount
  }

  return baseLine + offset
}

function addedTargetLines(patch: string): Set<number> {
  const added = new Set<number>()
  let targetLine: number | undefined

  for (const rawLine of patch.split('\n')) {
    const hunk = HUNK_PATTERN.exec(rawLine)
    if (hunk) {
      targetLine = Number(hunk[3])
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
  const changed = changedFiles(
    git(
      cwd,
      'diff',
      '--name-status',
      '-z',
      '-M20%',
      '--diff-filter=d',
      revision
    )
  ).filter(({ path }) => TEST_SOURCE_PATTERN.test(path))
  const violations: string[] = []

  for (const { basePath, path } of changed) {
    const patch = git(
      cwd,
      'diff',
      '-M20%',
      '--unified=0',
      '--no-color',
      '--no-ext-diff',
      revision,
      '--',
      ...(basePath && basePath !== path ? [basePath] : []),
      path
    ).toString('utf8')
    const source = git(cwd, 'show', `${headSha}:${path}`).toString('utf8')
    const baseSource = basePath
      ? git(cwd, 'show', `${baseSha}:${basePath}`).toString('utf8')
      : ''
    const sourceLines = source.split('\n')
    const addedLines = addedTargetLines(patch)
    const headDeclarations = testDeclarations(source, path)
    const correspondingBase = correspondingBaseDeclarations(
      testDeclarations(baseSource, path),
      headDeclarations,
      (line) => projectBaseLine(patch, line)
    )

    for (const [index, declaration] of headDeclarations.entries()) {
      if (
        declaration.disabled &&
        !correspondingBase.get(index)?.disabled &&
        declaration.relevantLines.some((line) => addedLines.has(line))
      ) {
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
