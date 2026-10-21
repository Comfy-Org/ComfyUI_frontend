import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const FOLLOWER_CORE_DIRECTORY = 'src/workbench/extensions/agent/crdt'

const FOLLOWER_SEAM_PATH = `${FOLLOWER_CORE_DIRECTORY}/followerDoc.ts`

// The merge laboratory replays op streams into scratch documents it creates
// itself; it never holds the follower document.
const EXEMPT_FOLLOWER_SOURCES = new Set(['mergeScenarios.ts'])

function followerSourcePaths(repositoryRoot: string): string[] {
  const directory = join(repositoryRoot, FOLLOWER_CORE_DIRECTORY)
  const discovered = existsSync(directory)
    ? readdirSync(directory)
        .filter(
          (name) =>
            name.endsWith('.ts') &&
            !name.endsWith('.test.ts') &&
            !name.endsWith('.d.ts') &&
            !EXEMPT_FOLLOWER_SOURCES.has(name)
        )
        .map((name) => `${FOLLOWER_CORE_DIRECTORY}/${name}`)
    : []
  return [...new Set([FOLLOWER_SEAM_PATH, ...discovered])].sort()
}

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

type FollowerInvariantViolation = {
  column: number
  line: number
  message: string
  path: string
}

type FollowerSource = {
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
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression
  return current
}

const Y_SHARED_TYPE =
  /(?:^|\.)Y\.(?:Array|Doc|Map|Text|XmlElement|XmlFragment|XmlText)(?:<|$)/

function hasYType(type: ts.TypeNode | undefined): boolean {
  if (type === undefined) return false
  const constituents = ts.isUnionTypeNode(type) ? type.types : [type]
  return constituents.some((constituent) =>
    Y_SHARED_TYPE.test(constituent.getText())
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

function isFollowerDocApplyRemoteUpdate(
  method: ts.SignatureDeclaration | undefined
): boolean {
  return (
    method !== undefined &&
    ts.isMethodDeclaration(method) &&
    propertyName(method.name) === 'applyRemoteUpdate' &&
    ts.isClassDeclaration(method.parent) &&
    method.parent.name?.text === 'FollowerDoc'
  )
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

function isYApplyUpdate(expression: ts.Expression, aliases: Tracking): boolean {
  const value = unwrapped(expression)
  if (ts.isIdentifier(value))
    return Y_APPLY_UPDATES.has(value.text) || isTracked(aliases, value)
  if (ts.isPropertyAccessExpression(value))
    return Y_APPLY_UPDATES.has(value.name.text)
  return (
    ts.isElementAccessExpression(value) &&
    ts.isStringLiteralLike(value.argumentExpression) &&
    Y_APPLY_UPDATES.has(value.argumentExpression.text)
  )
}

function isAllowedFollowerApply(
  source: ts.SourceFile,
  call: ts.CallExpression
): boolean {
  return (
    basename(source.fileName) === 'followerDoc.ts' &&
    isFollowerDocApplyRemoteUpdate(ts.findAncestor(call, ts.isFunctionLike)) &&
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

function sourceChecker(source: ts.SourceFile): ts.TypeChecker {
  const host: ts.CompilerHost = {
    fileExists: (fileName) => fileName === source.fileName,
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => '',
    getDefaultLibFileName: () => 'lib.d.ts',
    getNewLine: () => '\n',
    getSourceFile: (fileName) =>
      fileName === source.fileName ? source : undefined,
    readFile: () => undefined,
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined
  }
  const program = ts.createProgram(
    [source.fileName],
    { noLib: true, noResolve: true },
    host
  )
  if (!program.getSourceFiles().includes(source))
    throw new Error(`cannot bind follower source ${source.fileName}`)
  return program.getTypeChecker()
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
  function collect(node: ts.Node): void {
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

type Tracking = {
  checker: ts.TypeChecker
  tracked: Set<ts.Node>
}

function declarationOf(
  checker: ts.TypeChecker,
  node: ts.Node
): ts.Node | undefined {
  const symbol = checker.getSymbolAtLocation(node)
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0]
}

function isTracked({ checker, tracked }: Tracking, node: ts.Node): boolean {
  const declaration = declarationOf(checker, node)
  return declaration !== undefined && tracked.has(declaration)
}

function trackedDocReference(tracking: Tracking) {
  function references(expression: ts.Expression): boolean {
    const value = unwrapped(expression)
    if (ts.isIdentifier(value)) return isTracked(tracking, value)
    if (isThisDoc(value) || isFollowerDocAccess(value)) return true
    if (ts.isPropertyAccessExpression(value))
      return value.expression.kind === ts.SyntaxKind.ThisKeyword
        ? isTracked(tracking, value.name)
        : references(value.expression)
    if (ts.isElementAccessExpression(value)) return references(value.expression)
    if (ts.isCallExpression(value))
      return [value.expression, ...value.arguments].some(references)
    return false
  }
  return references
}

function declarationName(declaration: SupportedDeclaration): string | null {
  return ts.isIdentifier(declaration.name) ? declaration.name.text : null
}

function iteratedExpression(
  declaration: ts.VariableDeclaration
): ts.Expression | undefined {
  const list = declaration.parent
  return ts.isVariableDeclarationList(list) && ts.isForOfStatement(list.parent)
    ? list.parent.expression
    : undefined
}

function callbackReceiver(
  parameter: ts.ParameterDeclaration
): ts.Expression | undefined {
  const callback = parameter.parent
  if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
    return undefined
  const call = callback.parent
  return ts.isCallExpression(call) && call.arguments.includes(callback)
    ? calledMember(call)?.receiver
    : undefined
}

function declarationSource(
  declaration: Exclude<SupportedDeclaration, ts.BindingElement>
): ts.Expression | undefined {
  if (ts.isVariableDeclaration(declaration))
    return declaration.initializer ?? iteratedExpression(declaration)
  if (ts.isParameter(declaration))
    return declaration.initializer ?? callbackReceiver(declaration)
  return declaration.initializer
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
  return ts.isVariableDeclaration(current) || ts.isParameter(current)
    ? declarationSource(current)
    : undefined
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
  const source = declarationSource(declaration)
  return source !== undefined && referencesTrackedDoc(source)
}

function instanceofSharedTypeDeclarations(
  source: ts.SourceFile,
  checker: ts.TypeChecker
): Set<ts.Node> {
  const declarations = new Set<ts.Node>()
  function collect(node: ts.Node): void {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
      Y_SHARED_TYPE.test(node.right.getText())
    ) {
      const value = unwrapped(node.left)
      const declaration = ts.isIdentifier(value)
        ? declarationOf(checker, value)
        : undefined
      if (declaration) declarations.add(declaration)
    }
    ts.forEachChild(node, collect)
  }
  collect(source)
  return declarations
}

function trackedDocs(source: ts.SourceFile, checker: ts.TypeChecker): Tracking {
  const declarations = sourceDeclarations(source)
  const tracking = {
    checker,
    tracked: instanceofSharedTypeDeclarations(source, checker)
  }
  const referencesTrackedDoc = trackedDocReference(tracking)
  let changed = true
  while (changed) {
    changed = false
    for (const declaration of declarations) {
      if (tracking.tracked.has(declaration)) continue
      if (shouldTrackDeclaration(declaration, referencesTrackedDoc)) {
        tracking.tracked.add(declaration)
        changed = true
      }
    }
  }
  return tracking
}

function isApplyUpdateAlias(
  declaration: SupportedDeclaration,
  aliases: Tracking
): boolean {
  if (!ts.isIdentifier(declaration.name)) return false
  if (ts.isBindingElement(declaration))
    return Y_APPLY_UPDATES.has(boundPropertyName(declaration) ?? '')
  return (
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer !== undefined &&
    isYApplyUpdate(declaration.initializer, aliases)
  )
}

function yApplyUpdateAliases(
  source: ts.SourceFile,
  checker: ts.TypeChecker
): Tracking {
  const aliases: Tracking = { checker, tracked: new Set() }
  for (const element of source.statements
    .filter(isYjsImport)
    .flatMap(namedImports))
    if (Y_APPLY_UPDATES.has((element.propertyName ?? element.name).text))
      aliases.tracked.add(element)
  for (const declaration of sourceDeclarations(source))
    if (isApplyUpdateAlias(declaration, aliases))
      aliases.tracked.add(declaration)
  return aliases
}

function inspectCalls(
  source: ts.SourceFile,
  tracking: Tracking,
  violations: FollowerInvariantViolation[]
): void {
  const referencesTrackedDoc = trackedDocReference(tracking)
  const applyUpdateAliases = yApplyUpdateAliases(source, tracking.checker)
  function inspect(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (
        isYApplyUpdate(node.expression, applyUpdateAliases) &&
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

export function scanFollowerInvariantSource(
  sourceInput: FollowerSource
): FollowerInvariantViolation[] {
  const source = sourceFile(sourceInput)
  const violations: FollowerInvariantViolation[] = []
  addParseDiagnostics(violations, source, sourceInput.contents)
  inspectCalls(source, trackedDocs(source, sourceChecker(source)), violations)
  return violations
}

export function scanFollowerInvariantSources(
  repositoryRoot: string
): FollowerInvariantViolation[] {
  const sources: FollowerSource[] = []
  const violations: FollowerInvariantViolation[] = []
  for (const sourcePath of followerSourcePaths(repositoryRoot)) {
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
  return [...violations, ...sources.flatMap(scanFollowerInvariantSource)]
}

function formatFollowerInvariantViolations(
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
