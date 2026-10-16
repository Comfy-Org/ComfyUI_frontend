import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

export const FOLLOWER_SOURCE_PATHS = [
  'src/workbench/extensions/agent/crdt/followerDoc.ts',
  'src/workbench/extensions/agent/crdt/useAgentCrdtFollower.ts',
  'src/workbench/extensions/agent/crdt/agentCrdtProjection.ts',
  'src/workbench/extensions/agent/crdt/liveGraphApplier.ts',
  'src/workbench/extensions/agent/crdt/docChangeCollector.ts'
] as const

const MUTATING_METHODS = new Set([
  'clear',
  'delete',
  'insert',
  'push',
  'set',
  'transact',
  'unshift'
])

export type FollowerInvariantViolation = {
  column: number
  line: number
  message: string
  path: string
}

export type FollowerSource = {
  contents: string
  path: string
}

const propertyName = (node: ts.PropertyName | ts.MemberName): string | null =>
  ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null

const unwrapped = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression
  return current
}

const hasYType = (type: ts.TypeNode | undefined): boolean =>
  type !== undefined &&
  /(?:^|\.)Y\.(?:Array|Doc|Map)(?:<|$)/.test(type.getText())

const isNewYDoc = (expression: ts.Expression | undefined): boolean => {
  if (!expression || !ts.isNewExpression(expression)) return false
  return (
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === 'Y' &&
    expression.expression.name.text === 'Doc'
  )
}

const hasAncestorMethod = (
  source: ts.SourceFile,
  node: ts.Node,
  name: string
): boolean => {
  let current = node.parent
  while (current !== source) {
    if (ts.isMethodDeclaration(current) && propertyName(current.name) === name)
      return true
    current = current.parent
  }
  return false
}

const isThisDoc = (expression: ts.Expression): boolean => {
  const value = unwrapped(expression)
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === 'doc' &&
    value.expression.kind === ts.SyntaxKind.ThisKeyword
  )
}

const isYApplyUpdate = (expression: ts.Expression): boolean => {
  const value = unwrapped(expression)
  if (ts.isIdentifier(value)) return value.text === 'applyUpdate'
  return (
    ts.isPropertyAccessExpression(value) && value.name.text === 'applyUpdate'
  )
}

const isAllowedFollowerApply = (
  source: ts.SourceFile,
  call: ts.CallExpression
): boolean =>
  source.fileName.endsWith('/followerDoc.ts') &&
  hasAncestorMethod(source, call, 'applyRemoteUpdate') &&
  call.arguments.length >= 2 &&
  isThisDoc(call.arguments[0])

const isFollowerProperty = (expression: ts.Expression): boolean => {
  const value = unwrapped(expression)
  if (ts.isIdentifier(value)) return value.text === 'follower'
  return ts.isPropertyAccessExpression(value) && value.name.text === 'follower'
}

const isFollowerDocAccess = (expression: ts.Expression): boolean => {
  const value = unwrapped(expression)
  if (ts.isPropertyAccessExpression(value)) {
    if (value.name.text === 'doc' && isFollowerProperty(value.expression))
      return true
    return isFollowerDocAccess(value.expression)
  }
  if (ts.isCallExpression(value)) return isFollowerDocAccess(value.expression)
  return false
}

const mutationName = (call: ts.CallExpression): string | null =>
  ts.isPropertyAccessExpression(call.expression) &&
  MUTATING_METHODS.has(call.expression.name.text)
    ? call.expression.name.text
    : null

const addViolation = (
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  node: ts.Node,
  message: string
): void => {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source))
  violations.push({
    path: source.fileName,
    line: position.line + 1,
    column: position.character + 1,
    message
  })
}

const addDiagnosticViolation = (
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  diagnostic: ts.Diagnostic
): void => {
  const position = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
  violations.push({
    path: source.fileName,
    line: position.line + 1,
    column: position.character + 1,
    message: `cannot inspect malformed TypeScript: ${ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    )}`
  })
}

const trackedName = (name: string): boolean =>
  /(?:follower|semantic|shared)Doc$/i.test(name)

type SupportedDeclaration =
  | ts.VariableDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration

const sourceFile = (sourceInput: FollowerSource): ts.SourceFile =>
  ts.createSourceFile(
    sourceInput.path,
    sourceInput.contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )

const addParseDiagnostics = (
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  contents: string
): void => {
  const diagnostics = ts.transpileModule(contents, {
    compilerOptions: { target: ts.ScriptTarget.Latest },
    reportDiagnostics: true
  }).diagnostics
  for (const diagnostic of diagnostics ?? [])
    addDiagnosticViolation(violations, source, diagnostic)
}

const sourceDeclarations = (source: ts.SourceFile): SupportedDeclaration[] => {
  const declarations: SupportedDeclaration[] = []
  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isPropertyDeclaration(node)
    )
      declarations.push(node)
    ts.forEachChild(node, collect)
  }
  collect(source)
  return declarations
}

const trackedDocReference =
  (tracked: ReadonlySet<string>) =>
  (expression: ts.Expression): boolean => {
    const value = unwrapped(expression)
    if (ts.isIdentifier(value)) return tracked.has(value.text)
    if (isThisDoc(value) || isFollowerDocAccess(value)) return true
    if (ts.isPropertyAccessExpression(value))
      return trackedDocReference(tracked)(value.expression)
    if (ts.isCallExpression(value))
      return trackedDocReference(tracked)(value.expression)
    return false
  }

const declarationName = (declaration: SupportedDeclaration): string | null =>
  ts.isIdentifier(declaration.name) ? declaration.name.text : null

const shouldTrackDeclaration = (
  declaration: SupportedDeclaration,
  referencesTrackedDoc: (expression: ts.Expression) => boolean
): boolean => {
  const name = declarationName(declaration)
  if (name === null) return false
  if (trackedName(name) || hasYType(declaration.type)) return true
  if (isNewYDoc(declaration.initializer)) return true
  return (
    declaration.initializer !== undefined &&
    referencesTrackedDoc(declaration.initializer)
  )
}

const trackedDocNames = (declarations: readonly SupportedDeclaration[]) => {
  const tracked = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const declaration of declarations) {
      const name = declarationName(declaration)
      if (name === null || tracked.has(name)) continue
      const referencesTrackedDoc = trackedDocReference(tracked)
      if (shouldTrackDeclaration(declaration, referencesTrackedDoc)) {
        tracked.add(name)
        changed = true
      }
    }
  }
  return tracked
}

const inspectCalls = (
  source: ts.SourceFile,
  tracked: ReadonlySet<string>,
  violations: FollowerInvariantViolation[]
): void => {
  const referencesTrackedDoc = trackedDocReference(tracked)
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (
        isYApplyUpdate(node.expression) &&
        !isAllowedFollowerApply(source, node)
      )
        addViolation(
          violations,
          source,
          node,
          'only FollowerDoc.applyRemoteUpdate may integrate a Yjs update'
        )

      const method = mutationName(node)
      if (
        method &&
        ts.isPropertyAccessExpression(node.expression) &&
        referencesTrackedDoc(node.expression.expression)
      )
        addViolation(
          violations,
          source,
          node,
          `follower code must not call ${method} on a shared document value`
        )
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}

const scanSource = (
  sourceInput: FollowerSource
): FollowerInvariantViolation[] => {
  const source = sourceFile(sourceInput)
  const violations: FollowerInvariantViolation[] = []
  addParseDiagnostics(violations, source, sourceInput.contents)
  inspectCalls(source, trackedDocNames(sourceDeclarations(source)), violations)
  return violations
}

export const scanFollowerInvariantSources = (
  repositoryRoot: string,
  sourcePaths: readonly string[] = FOLLOWER_SOURCE_PATHS
): FollowerInvariantViolation[] => {
  const sources: FollowerSource[] = []
  const violations: FollowerInvariantViolation[] = []
  for (const sourcePath of sourcePaths) {
    const absolutePath = join(repositoryRoot, sourcePath)
    if (!existsSync(absolutePath)) {
      violations.push({
        path: sourcePath,
        line: 1,
        column: 1,
        message: 'required follower source is missing'
      })
      continue
    }
    sources.push({
      path: absolutePath,
      contents: readFileSync(absolutePath, 'utf8')
    })
  }
  return [...violations, ...sources.flatMap(scanSource)]
}

export const scanFollowerInvariantSource = scanSource

export const formatFollowerInvariantViolations = (
  repositoryRoot: string,
  violations: readonly FollowerInvariantViolation[]
): string =>
  violations
    .map(
      ({ column, line, message, path }) =>
        `${relative(repositoryRoot, path)}:${line}:${column}: ${message}`
    )
    .join('\n')

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isMain) {
  const repositoryRoot = process.cwd()
  const violations = scanFollowerInvariantSources(repositoryRoot)
  if (violations.length > 0)
    throw new Error(
      `Follower invariant violations:\n${formatFollowerInvariantViolations(
        repositoryRoot,
        violations
      )}`
    )
  process.stdout.write('Follower invariant validation passed\n')
}
