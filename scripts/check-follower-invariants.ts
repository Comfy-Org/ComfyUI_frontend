import { existsSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
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
  'applyDelta',
  'clear',
  'delete',
  'format',
  'insert',
  'insertAfter',
  'insertEmbed',
  'push',
  'removeAttribute',
  'set',
  'setAttribute',
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

function propertyName(node: ts.PropertyName | ts.MemberName): string | null {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null
}

function unwrapped(expression: ts.Expression): ts.Expression {
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

function hasYType(type: ts.TypeNode | undefined): boolean {
  return (
    type !== undefined &&
    /(?:^|\.)Y\.(?:Array|Doc|Map|Text|XmlElement|XmlFragment|XmlText)(?:<|$)/.test(
      type.getText()
    )
  )
}

function isNewYDoc(expression: ts.Expression | undefined): boolean {
  if (!expression || !ts.isNewExpression(expression)) return false
  return (
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === 'Y' &&
    expression.expression.name.text === 'Doc'
  )
}

function hasAncestorMethod(
  source: ts.SourceFile,
  node: ts.Node,
  name: string
): boolean {
  let current = node.parent
  while (current !== source) {
    if (ts.isMethodDeclaration(current) && propertyName(current.name) === name)
      return true
    current = current.parent
  }
  return false
}

function isThisDoc(expression: ts.Expression): boolean {
  const value = unwrapped(expression)
  return (
    ts.isPropertyAccessExpression(value) &&
    value.name.text === 'doc' &&
    value.expression.kind === ts.SyntaxKind.ThisKeyword
  )
}

const Y_APPLY_UPDATES = new Set(['applyUpdate', 'applyUpdateV2'])

function isYjsImport(
  statement: ts.Statement
): statement is ts.ImportDeclaration {
  return (
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === 'yjs'
  )
}

function namedImports(
  statement: ts.ImportDeclaration
): readonly ts.ImportSpecifier[] {
  const bindings = statement.importClause?.namedBindings
  return bindings && ts.isNamedImports(bindings) ? bindings.elements : []
}

function isYApplyUpdate(
  expression: ts.Expression,
  applyUpdateNames: ReadonlySet<string>
): boolean {
  const value = unwrapped(expression)
  if (ts.isIdentifier(value)) return applyUpdateNames.has(value.text)
  return (
    ts.isPropertyAccessExpression(value) && Y_APPLY_UPDATES.has(value.name.text)
  )
}

function isAllowedFollowerApply(
  source: ts.SourceFile,
  call: ts.CallExpression
): boolean {
  return (
    basename(source.fileName) === 'followerDoc.ts' &&
    hasAncestorMethod(source, call, 'applyRemoteUpdate') &&
    call.arguments.length >= 2 &&
    isThisDoc(call.arguments[0])
  )
}

function isFollowerProperty(expression: ts.Expression): boolean {
  const value = unwrapped(expression)
  if (ts.isIdentifier(value)) return value.text === 'follower'
  return ts.isPropertyAccessExpression(value) && value.name.text === 'follower'
}

function isFollowerDocAccess(expression: ts.Expression): boolean {
  const value = unwrapped(expression)
  if (ts.isPropertyAccessExpression(value)) {
    if (value.name.text === 'doc' && isFollowerProperty(value.expression))
      return true
    return isFollowerDocAccess(value.expression)
  }
  if (ts.isCallExpression(value)) return isFollowerDocAccess(value.expression)
  return false
}

function calledMember(
  call: ts.CallExpression
): { name: string; receiver: ts.Expression } | null {
  const callee = unwrapped(call.expression)
  if (ts.isPropertyAccessExpression(callee))
    return { name: callee.name.text, receiver: callee.expression }
  if (
    ts.isElementAccessExpression(callee) &&
    ts.isStringLiteralLike(callee.argumentExpression)
  )
    return { name: callee.argumentExpression.text, receiver: callee.expression }
  return null
}

function addViolation(
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  node: ts.Node,
  message: string
): void {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source))
  violations.push({
    path: source.fileName,
    line: position.line + 1,
    column: position.character + 1,
    message
  })
}

function addDiagnosticViolation(
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  diagnostic: ts.Diagnostic
): void {
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

function trackedName(name: string): boolean {
  return /(?:follower|semantic|shared)Doc$/i.test(name)
}

type SupportedDeclaration =
  | ts.VariableDeclaration
  | ts.BindingElement
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration

function sourceFile(sourceInput: FollowerSource): ts.SourceFile {
  return ts.createSourceFile(
    sourceInput.path,
    sourceInput.contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function addParseDiagnostics(
  violations: FollowerInvariantViolation[],
  source: ts.SourceFile,
  contents: string
): void {
  const diagnostics = ts.transpileModule(contents, {
    compilerOptions: { target: ts.ScriptTarget.Latest },
    reportDiagnostics: true
  }).diagnostics
  for (const diagnostic of diagnostics ?? [])
    addDiagnosticViolation(violations, source, diagnostic)
}

function sourceDeclarations(source: ts.SourceFile): SupportedDeclaration[] {
  const declarations: SupportedDeclaration[] = []
  const collect = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isBindingElement(node) ||
      ts.isParameter(node) ||
      ts.isPropertyDeclaration(node)
    )
      declarations.push(node)
    ts.forEachChild(node, collect)
  }
  collect(source)
  return declarations
}

function trackedDocReference(tracked: ReadonlySet<string>) {
  return (expression: ts.Expression): boolean => {
    const value = unwrapped(expression)
    if (ts.isIdentifier(value)) return tracked.has(value.text)
    if (isThisDoc(value) || isFollowerDocAccess(value)) return true
    if (ts.isPropertyAccessExpression(value))
      return trackedDocReference(tracked)(value.expression)
    if (ts.isCallExpression(value))
      return trackedDocReference(tracked)(value.expression)
    return false
  }
}

function declarationName(declaration: SupportedDeclaration): string | null {
  return ts.isIdentifier(declaration.name) ? declaration.name.text : null
}

function bindingSourceExpression(
  element: ts.BindingElement
): ts.Expression | undefined {
  let current: ts.Node = element.parent
  while (
    ts.isObjectBindingPattern(current) ||
    ts.isArrayBindingPattern(current) ||
    ts.isBindingElement(current)
  )
    current = current.parent
  return ts.isVariableDeclaration(current) ? current.initializer : undefined
}

function boundPropertyName(element: ts.BindingElement): string | null {
  return element.propertyName
    ? propertyName(element.propertyName)
    : ts.isIdentifier(element.name)
      ? element.name.text
      : null
}

function shouldTrackBindingElement(
  element: ts.BindingElement,
  referencesTrackedDoc: (expression: ts.Expression) => boolean
): boolean {
  const source = bindingSourceExpression(element)
  if (source === undefined) return false
  if (referencesTrackedDoc(source)) return true
  const bound = boundPropertyName(element)
  if (bound !== 'doc') return false
  const value = unwrapped(source)
  return isFollowerProperty(value) || value.kind === ts.SyntaxKind.ThisKeyword
}

function shouldTrackDeclaration(
  declaration: SupportedDeclaration,
  referencesTrackedDoc: (expression: ts.Expression) => boolean
): boolean {
  const name = declarationName(declaration)
  if (name === null) return false
  if (trackedName(name)) return true
  if (ts.isBindingElement(declaration))
    return shouldTrackBindingElement(declaration, referencesTrackedDoc)
  if (hasYType(declaration.type)) return true
  if (isNewYDoc(declaration.initializer)) return true
  return (
    declaration.initializer !== undefined &&
    referencesTrackedDoc(declaration.initializer)
  )
}

function trackedDocNames(declarations: readonly SupportedDeclaration[]) {
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

function applyUpdateAlias(
  declaration: SupportedDeclaration,
  applyUpdateNames: ReadonlySet<string>
): string | null {
  if (!ts.isIdentifier(declaration.name)) return null
  if (ts.isBindingElement(declaration))
    return Y_APPLY_UPDATES.has(boundPropertyName(declaration) ?? '')
      ? declaration.name.text
      : null
  return ts.isVariableDeclaration(declaration) &&
    declaration.initializer !== undefined &&
    isYApplyUpdate(declaration.initializer, applyUpdateNames)
    ? declaration.name.text
    : null
}

function yApplyUpdateNames(source: ts.SourceFile): ReadonlySet<string> {
  const names = new Set(Y_APPLY_UPDATES)
  for (const element of source.statements
    .filter(isYjsImport)
    .flatMap(namedImports))
    if (Y_APPLY_UPDATES.has((element.propertyName ?? element.name).text))
      names.add(element.name.text)
  for (const declaration of sourceDeclarations(source)) {
    const alias = applyUpdateAlias(declaration, names)
    if (alias !== null) names.add(alias)
  }
  return names
}

function inspectCalls(
  source: ts.SourceFile,
  tracked: ReadonlySet<string>,
  violations: FollowerInvariantViolation[]
): void {
  const referencesTrackedDoc = trackedDocReference(tracked)
  const applyUpdateNames = yApplyUpdateNames(source)
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (
        isYApplyUpdate(node.expression, applyUpdateNames) &&
        !isAllowedFollowerApply(source, node)
      )
        addViolation(
          violations,
          source,
          node,
          'only FollowerDoc.applyRemoteUpdate may integrate a Yjs update'
        )

      const member = calledMember(node)
      if (
        member &&
        MUTATING_METHODS.has(member.name) &&
        referencesTrackedDoc(member.receiver)
      )
        addViolation(
          violations,
          source,
          node,
          `follower code must not call ${member.name} on a shared document value`
        )
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}

function scanSource(sourceInput: FollowerSource): FollowerInvariantViolation[] {
  const source = sourceFile(sourceInput)
  const violations: FollowerInvariantViolation[] = []
  addParseDiagnostics(violations, source, sourceInput.contents)
  inspectCalls(source, trackedDocNames(sourceDeclarations(source)), violations)
  return violations
}

export function scanFollowerInvariantSources(
  repositoryRoot: string,
  sourcePaths: readonly string[] = FOLLOWER_SOURCE_PATHS
): FollowerInvariantViolation[] {
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

export function formatFollowerInvariantViolations(
  repositoryRoot: string,
  violations: readonly FollowerInvariantViolation[]
): string {
  return violations
    .map(
      ({ column, line, message, path }) =>
        `${relative(repositoryRoot, path)}:${line}:${column}: ${message}`
    )
    .join('\n')
}

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
