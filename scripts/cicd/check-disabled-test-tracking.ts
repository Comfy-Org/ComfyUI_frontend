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
  disabled: boolean
  title: string
}

type ChangedFile = {
  basePath?: string
  path: string
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

function changedFiles(output: Buffer): ChangedFile[] {
  const fields = output.toString('utf8').split('\0')
  const files: ChangedFile[] = []

  for (let index = 0; fields[index]; ) {
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

function correspondingBaseDeclarations(
  base: TestDeclaration[],
  head: TestDeclaration[]
): Map<number, TestDeclaration> {
  const costs = Array.from({ length: base.length + 1 }, (_, baseIndex) =>
    Array.from(
      { length: head.length + 1 },
      (_, headIndex) => baseIndex + headIndex
    )
  )

  for (let baseIndex = 1; baseIndex <= base.length; baseIndex += 1) {
    for (let headIndex = 1; headIndex <= head.length; headIndex += 1) {
      const substitution =
        costs[baseIndex - 1][headIndex - 1] +
        (base[baseIndex - 1].title === head[headIndex - 1].title ? 0 : 1)
      costs[baseIndex][headIndex] = Math.min(
        substitution,
        costs[baseIndex - 1][headIndex] + 1,
        costs[baseIndex][headIndex - 1] + 1
      )
    }
  }

  const corresponding = new Map<number, TestDeclaration>()
  let baseIndex = base.length
  let headIndex = head.length
  while (baseIndex > 0 && headIndex > 0) {
    const substitution =
      costs[baseIndex - 1][headIndex - 1] +
      (base[baseIndex - 1].title === head[headIndex - 1].title ? 0 : 1)
    if (
      costs[baseIndex][headIndex] ===
      costs[baseIndex][headIndex - 1] + 1
    ) {
      headIndex -= 1
    } else if (costs[baseIndex][headIndex] === substitution) {
      corresponding.set(headIndex - 1, base[baseIndex - 1])
      baseIndex -= 1
      headIndex -= 1
    } else if (
      costs[baseIndex][headIndex] ===
      costs[baseIndex - 1][headIndex] + 1
    ) {
      baseIndex -= 1
    }
  }

  return corresponding
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
  const changed = changedFiles(
    git(cwd, 'diff', '--name-status', '-z', '-M', '--diff-filter=d', revision)
  ).filter(({ path }) => TEST_SOURCE_PATTERN.test(path))
  const violations: string[] = []

  for (const { basePath, path } of changed) {
    const patch = git(
      cwd,
      'diff',
      '-M',
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
      headDeclarations
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
