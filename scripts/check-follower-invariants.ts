import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { architectureExceptionSchema } from '@comfyorg/architecture/src/schema'

export interface Violation {
  file: string
  line: number
  rule: string
  message: string
}

export const FOLLOWER_SCOPE_PATTERNS = [
  'src/workbench/extensions/agent/crdt/**/*.ts',
  'src/workbench/extensions/agent/services/agent/**/*.ts'
] as const

type AstCheck = (file: string, sourceFile: ts.SourceFile) => Violation[]

const isTestOrFixture = (file: string): boolean =>
  /\.(test|spec)\.ts$/.test(file) ||
  file.includes('__fixtures__/') ||
  file.includes('__mocks__/')

const isFollowerSeamFile = (file: string): boolean =>
  FOLLOWER_SCOPE_PATTERNS.some((pattern) => {
    const directory = pattern.slice(0, pattern.indexOf('**'))
    return file.startsWith(directory)
  }) &&
  file.endsWith('.ts') &&
  !file.endsWith('.d.ts') &&
  !isTestOrFixture(file)

export function findFollowerFiles(repositoryRoot: string): string[] {
  return globSync([...FOLLOWER_SCOPE_PATTERNS], {
    cwd: repositoryRoot
  })
    .map((file) => file.replaceAll('\\', '/'))
    .filter(isFollowerSeamFile)
    .sort()
}

export const RULE_NAMES = [
  'no-outbound-update-b64',
  'no-op-id-regeneration',
  'catalog-pinned-by-sha',
  'no-scattered-distribution-checks',
  'no-hardcoded-endpoint',
  'op-layer-yjs-only'
] as const

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  )
}

function violation(
  file: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  rule: string,
  message: string
): Violation {
  return { file, line: lineOf(sourceFile, node), rule, message }
}

function visit(sourceFile: ts.SourceFile, inspect: (node: ts.Node) => void) {
  const walk = (node: ts.Node): void => {
    inspect(node)
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
}

function isFunctionLike(node: ts.Node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  )
}

const SIGNATURE_KINDS = [
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor
] as const

/** Kinds whose `var` declarations belong to them rather than to a nested block. */
const VAR_OWNER_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ...SIGNATURE_KINDS,
  ts.SyntaxKind.SourceFile,
  ts.SyntaxKind.ModuleBlock
])

const SCOPE_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ...VAR_OWNER_KINDS,
  ts.SyntaxKind.Block,
  ts.SyntaxKind.CaseBlock,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ClassExpression
])

const introducesScope = (node: ts.Node): boolean => SCOPE_KINDS.has(node.kind)

const isSignature = (node: ts.Node): node is ts.SignatureDeclaration =>
  (SIGNATURE_KINDS as readonly ts.SyntaxKind[]).includes(node.kind)

function eachBoundName(
  name: ts.BindingName,
  yieldName: (identifier: ts.Identifier, declaration: ts.Node) => void,
  declaration: ts.Node
): void {
  if (ts.isIdentifier(name)) {
    yieldName(name, declaration)
    return
  }
  for (const element of name.elements)
    if (ts.isBindingElement(element))
      eachBoundName(element.name, yieldName, element)
}

function isVarDeclaration(node: ts.VariableDeclaration): boolean {
  const list = node.parent
  return (
    ts.isVariableDeclarationList(list) &&
    (list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) === 0
  )
}

type AddBinding = (identifier: ts.Identifier, declaration: ts.Node) => void

function addVariableList(
  list: ts.VariableDeclarationList,
  add: AddBinding
): void {
  for (const declaration of list.declarations)
    eachBoundName(declaration.name, add, declaration)
}

function addSignatureBindings(
  scope: ts.SignatureDeclaration,
  add: AddBinding
): void {
  for (const parameter of scope.parameters)
    eachBoundName(parameter.name, add, parameter)
  for (const typeParameter of scope.typeParameters ?? [])
    add(typeParameter.name, typeParameter)
  // A function expression's own name is bound inside its own body, not outside.
  if (ts.isFunctionExpression(scope) && scope.name) add(scope.name, scope)
}

function addClassBindings(
  scope: ts.ClassDeclaration | ts.ClassExpression,
  add: AddBinding
): void {
  if (scope.name) add(scope.name, scope)
  for (const typeParameter of scope.typeParameters ?? [])
    add(typeParameter.name, typeParameter)
}

/** The statements a scope owns directly, flattened across a switch's clauses. */
function scopeStatements(scope: ts.Node): readonly ts.Statement[] {
  if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope))
    return scope.statements
  if (ts.isCaseBlock(scope))
    return scope.clauses.flatMap((clause) => [...clause.statements])
  return []
}

const isNamedDeclarationStatement = (
  node: ts.Node
): node is ts.DeclarationStatement =>
  ts.isFunctionDeclaration(node) ||
  ts.isClassDeclaration(node) ||
  ts.isEnumDeclaration(node) ||
  ts.isModuleDeclaration(node) ||
  ts.isTypeAliasDeclaration(node)

function addStatementBindings(scope: ts.Node, add: AddBinding): void {
  for (const statement of scopeStatements(scope)) {
    if (ts.isVariableStatement(statement))
      addVariableList(statement.declarationList, add)
    else if (ts.isImportDeclaration(statement))
      for (const binding of importedBindingNodes(statement))
        add(binding.name, binding.declaration)
    else if (ts.isImportEqualsDeclaration(statement))
      add(statement.name, statement)
    else if (
      isNamedDeclarationStatement(statement) &&
      statement.name &&
      ts.isIdentifier(statement.name)
    )
      add(statement.name, statement)
  }
}

/** A `catch (error)` binding, or the `let`/`const` a `for` header introduces. */
function addLoopAndCatchBindings(scope: ts.Node, add: AddBinding): void {
  if (ts.isCatchClause(scope)) {
    const declaration = scope.variableDeclaration
    if (declaration) eachBoundName(declaration.name, add, declaration)
    return
  }
  const isLoop =
    ts.isForStatement(scope) ||
    ts.isForInStatement(scope) ||
    ts.isForOfStatement(scope)
  if (!isLoop) return
  const { initializer } = scope
  if (initializer && ts.isVariableDeclarationList(initializer))
    addVariableList(initializer, add)
}

/**
 * `var` ignores block scope, so a function body owns the `var`s of its nested blocks.
 * Without this a `var` read beside its block reads as unbound.
 */
function addHoistedVars(scope: ts.Node, add: AddBinding): void {
  if (!VAR_OWNER_KINDS.has(scope.kind)) return
  const collect = (node: ts.Node): void => {
    if (node !== scope && (isSignature(node) || ts.isClassDeclaration(node)))
      return
    if (ts.isVariableDeclaration(node) && isVarDeclaration(node))
      eachBoundName(node.name, add, node)
    ts.forEachChild(node, collect)
  }
  ts.forEachChild(scope, collect)
}

/**
 * Names declared *directly* in one scope, so a reference can be resolved by walking
 * ancestors instead of consulting a file-wide set. The file-wide set is what let an
 * out-of-scope declaration exempt an ambient read and let one function's local poison
 * another's — both measured false results rather than theoretical ones.
 */
function ownDeclarations(scope: ts.Node): Map<string, ts.Node> {
  const declarations = new Map<string, ts.Node>()
  const add: AddBinding = (identifier, declaration) => {
    if (!declarations.has(identifier.text))
      declarations.set(identifier.text, declaration)
  }

  if (isSignature(scope)) addSignatureBindings(scope, add)
  if (ts.isClassDeclaration(scope) || ts.isClassExpression(scope))
    addClassBindings(scope, add)
  addLoopAndCatchBindings(scope, add)
  addStatementBindings(scope, add)
  addHoistedVars(scope, add)
  return declarations
}

export interface ScopeIndex {
  /** The declaration a reference resolves to, or undefined when it is unbound. */
  resolve: (node: ts.Identifier) => ts.Node | undefined
}

function scopeIndex(): ScopeIndex {
  const cache = new Map<ts.Node, Map<string, ts.Node>>()
  const declarationsOf = (scope: ts.Node): Map<string, ts.Node> => {
    let own = cache.get(scope)
    if (!own) {
      own = ownDeclarations(scope)
      cache.set(scope, own)
    }
    return own
  }
  return {
    resolve: (node) => {
      // Every node sits under a SourceFile, which always introduces a scope, so the
      // walk terminates there rather than on a nullish parent.
      for (let current: ts.Node = node; ; current = current.parent) {
        if (!introducesScope(current)) continue
        const declaration = declarationsOf(current).get(node.text)
        if (declaration !== undefined && declaration !== node)
          return declaration
        if (ts.isSourceFile(current)) return undefined
      }
    }
  }
}

/**
 * The four metadata fields are `architectureExceptionSchema`'s, picked from it rather
 * than restated, so this surface cannot drift from the ledger it claims to follow.
 */
const suppressionMetadataSchema = architectureExceptionSchema.pick({
  owner: true,
  rationale: true,
  sunset: true,
  removalCriteria: true
})

const SUPPRESSION_MARKER = /follower-invariant-allow-next-line\b[ \t]*(\S*)/
const REQUIRED_SUPPRESSION_FIELDS = [
  'owner',
  'rationale',
  'sunset',
  'removalCriteria'
] as const
const SUPPRESSION_FIELD = new RegExp(
  `\\b(${REQUIRED_SUPPRESSION_FIELDS.join('|')})\\s*:\\s*([^;]+)`,
  'g'
)

export interface Suppression {
  rule: string
  directiveLine: number
  targetLine: number
  fields: Map<string, string>
}

const isCommentLine = (line: string): boolean =>
  /^\s*(?:\/\/|\/\*|\*)/.test(line)

function suppressionFields(lines: readonly string[]): Map<string, string> {
  const fields = new Map<string, string>()
  for (const line of lines)
    for (const [, key, value] of line.matchAll(SUPPRESSION_FIELD))
      if (!fields.has(key))
        fields.set(key, value.replace(/\*\/\s*$/, '').trim())
  return fields
}

export function findSuppressions(source: string): Suppression[] {
  const lines = source.split('\n')
  const suppressions: Suppression[] = []
  lines.forEach((line, index) => {
    const marker = SUPPRESSION_MARKER.exec(line)
    if (!marker) return
    let cursor = index + 1
    while (cursor < lines.length && isCommentLine(lines[cursor])) cursor += 1
    suppressions.push({
      // A marker with no rule argument is recorded with an empty rule so it reaches
      // the invalid-directive path. Requiring the argument to parse before recording
      // left a bare marker completely undiagnosed.
      rule: marker[1],
      directiveLine: index + 1,
      targetLine: cursor + 1,
      fields: suppressionFields(lines.slice(index, cursor))
    })
  })
  return suppressions
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Phrase a schema rejection in the vocabulary of the directive, not of zod. */
function metadataProblem(
  fields: ReadonlyMap<string, string>,
  issue: { path: PropertyKey[]; message: string }
): string {
  const field = String(issue.path[0] ?? '')
  const value = fields.get(field) ?? ''
  if (field === 'owner') return `names owner "${value}", not an @handle`
  if (field === 'sunset')
    return `has sunset "${value}", which is not a YYYY-MM-DD date`
  return `has an invalid ${field} "${value}": ${issue.message}`
}

function suppressionProblem(
  suppression: Suppression,
  now: string
): string | undefined {
  const { rule, fields } = suppression
  if (!rule) return 'does not name a rule'
  if (!(RULE_NAMES as readonly string[]).includes(rule))
    return `names unknown rule "${rule}"`
  const missing = REQUIRED_SUPPRESSION_FIELDS.filter(
    (field) => !fields.get(field)
  )
  if (missing.length)
    return `is missing required field(s) ${missing.join(', ')}`
  const parsed = suppressionMetadataSchema.safeParse(Object.fromEntries(fields))
  if (!parsed.success) return metadataProblem(fields, parsed.error.issues[0])
  if (parsed.data.sunset < now) return `expired on ${parsed.data.sunset}`
}

export function applySuppressions(
  file: string,
  source: string,
  violations: readonly Violation[],
  rules: readonly string[] = RULE_NAMES,
  now: string = today()
): Violation[] {
  const scoped = findSuppressions(source).filter(
    ({ rule }) =>
      rules.includes(rule) || !(RULE_NAMES as readonly string[]).includes(rule)
  )
  if (!scoped.length) return [...violations]
  const problems: Violation[] = []
  const active: Suppression[] = []
  for (const suppression of scoped) {
    const problem = suppressionProblem(suppression, now)
    if (!problem) {
      active.push(suppression)
      continue
    }
    problems.push({
      file,
      line: suppression.directiveLine,
      rule: 'suppression-invalid',
      message: `follower-invariant suppression ${problem} — it suppresses nothing; see .agents/checks/follower-boundary.md`
    })
  }
  const used = new Set<Suppression>()
  const kept = violations.filter((entry) => {
    const match = active.find(
      ({ rule, targetLine }) => rule === entry.rule && targetLine === entry.line
    )
    if (!match) return true
    used.add(match)
    return false
  })
  const unused = active
    .filter((suppression) => !used.has(suppression))
    .map(({ rule, directiveLine, targetLine }) => ({
      file,
      line: directiveLine,
      rule: 'suppression-unused',
      message: `follower-invariant suppression for ${rule} matches no violation on line ${targetLine} — delete it`
    }))
  return [...kept, ...problems, ...unused]
}

function propertyName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  )
    return name.expression.text
}

function memberName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (
    ts.isElementAccessExpression(expression) &&
    (ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  )
    return expression.argumentExpression.text
}

const OP_ID_MINTERS = new Set<string>([
  'createUuidv4',
  'uuidv4',
  'uuid',
  'randomUUID',
  'mintOpId'
])

function functionLikeName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text
  if (ts.isMethodDeclaration(node)) return propertyName(node.name)
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return
  const { parent } = node
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  if (ts.isPropertyAssignment(parent)) return propertyName(parent.name)
}

/**
 * Whether this node by itself yields a fresh id. A reference to a value that already
 * holds a minted id carries that provenance through any wrapper, which is what makes
 * `return String(id)` mint while `String(op.op_id)` does not.
 */
function nodeMintsOpId(
  node: ts.Node,
  root: ts.Expression,
  minted: MintedOpIds
): boolean {
  if (ts.isCallExpression(node)) return callMintsOpId(node, minted)
  if (node === root || !ts.isIdentifier(node)) return false
  return !isDeclarationName(node) && referencesMintedValue(node, minted)
}

function expressionMintsOpId(
  expression: ts.Expression,
  minted: MintedOpIds
): boolean {
  if (isFunctionLike(expression)) return false
  let mints = false
  const walk = (node: ts.Node): void => {
    if (mints || (node !== expression && isFunctionLike(node))) return
    if (nodeMintsOpId(node, expression, minted)) mints = true
    else ts.forEachChild(node, walk)
  }
  walk(expression)
  return mints
}

/** The receiver of an `X.bind(…)` call, which names a callable without invoking it. */
function boundReceiver(expression: ts.Expression): ts.Expression | undefined {
  if (!ts.isCallExpression(expression)) return
  const callee = expression.expression
  if (
    (ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)) &&
    memberName(callee) === 'bind'
  )
    return callee.expression
}

/** A minter named without being called: `crypto.randomUUID`, or `X.bind(…)` of one. */
function minterReferenceName(
  expression: ts.Expression,
  minted: MintedOpIds
): string | undefined {
  if (ts.isParenthesizedExpression(expression))
    return minterReferenceName(expression.expression, minted)
  const bound = boundReceiver(expression)
  if (bound) return minterReferenceName(bound, minted)
  const name = ts.isIdentifier(expression)
    ? expression.text
    : memberName(expression)
  return name !== undefined && minted.functions.has(name) ? name : undefined
}

function callMintsOpId(node: ts.CallExpression, minted: MintedOpIds): boolean {
  const callee = ts.isParenthesizedExpression(node.expression)
    ? node.expression.expression
    : node.expression
  const name = ts.isIdentifier(callee) ? callee.text : memberName(callee)
  return Boolean(name && minted.functions.has(name))
}

function referencesMintedValue(
  node: ts.Identifier,
  minted: MintedOpIds
): boolean {
  const declaration = minted.scopes.resolve(node)
  return declaration !== undefined && minted.values.has(declaration)
}

function functionReturnsMintedOpId(
  node: ts.FunctionLikeDeclaration,
  minted: MintedOpIds
): boolean {
  const { body } = node
  if (!body) return false
  if (!ts.isBlock(body)) return isFreshOpId(body, minted)
  let mints = false
  const walk = (current: ts.Node): void => {
    if (mints || (current !== body && isFunctionLike(current))) return
    if (
      ts.isReturnStatement(current) &&
      current.expression &&
      isFreshOpId(current.expression, minted)
    ) {
      mints = true
      return
    }
    ts.forEachChild(current, walk)
  }
  walk(body)
  return mints
}

interface MintedOpIds {
  functions: ReadonlySet<string>
  /**
   * Declarations — not spellings — that hold an already-minted id. Keying on the
   * declaration is what stops one function's minted local from condemning an
   * unrelated local of the same name in another scope.
   */
  values: ReadonlySet<ts.Node>
  scopes: ScopeIndex
}

/**
 * Accepted limit: one file at a time with no type information, so a minter imported
 * from another module is not recognised. The alternative — flagging every `op_id`
 * whose right-hand side is a call — rejects legitimate reads such as
 * `{ op_id: String(op.op_id) }`, and on a required check a false positive costs more
 * than this residue. A minter reached by a same-file name is still resolved by
 * spelling rather than by declaration, so a shadowing non-minter of the same name in
 * another scope remains possible.
 */
function mintedOpIds(
  sourceFile: ts.SourceFile,
  scopes: ScopeIndex
): MintedOpIds {
  const functions = new Set<string>(OP_ID_MINTERS)
  const values = new Set<ts.Node>()
  const minted: MintedOpIds = { functions, values, scopes }

  const learnMinter = (node: ts.FunctionLikeDeclaration): boolean => {
    const name = functionLikeName(node)
    if (!name || functions.has(name)) return false
    if (!functionReturnsMintedOpId(node, minted)) return false
    functions.add(name)
    return true
  }

  const learnMinterAlias = (node: ts.VariableDeclaration): boolean => {
    if (!ts.isIdentifier(node.name) || functions.has(node.name.text))
      return false
    if (!node.initializer || isFunctionLike(node.initializer)) return false
    if (!minterReferenceName(node.initializer, minted)) return false
    functions.add(node.name.text)
    return true
  }

  const learnMintedValue = (node: ts.VariableDeclaration): boolean => {
    if (!ts.isIdentifier(node.name) || values.has(node)) return false
    if (!node.initializer || !isFreshOpId(node.initializer, minted))
      return false
    values.add(node)
    return true
  }

  let changed = true
  while (changed) {
    changed = false
    visit(sourceFile, (node) => {
      if (isFunctionLike(node)) changed = learnMinter(node) || changed
      else if (ts.isVariableDeclaration(node))
        changed = learnMinterAlias(node) || learnMintedValue(node) || changed
    })
  }
  return minted
}

function isFreshOpId(expression: ts.Expression, minted: MintedOpIds): boolean {
  return (
    expressionMintsOpId(expression, minted) ||
    (ts.isIdentifier(expression) && referencesMintedValue(expression, minted))
  )
}

function isFreshOpIdAssignment(node: ts.Node, minted: MintedOpIds): boolean {
  if (ts.isPropertyAssignment(node))
    return (
      propertyName(node.name) === 'op_id' &&
      isFreshOpId(node.initializer, minted)
    )
  if (ts.isShorthandPropertyAssignment(node))
    return (
      node.name.text === 'op_id' && referencesMintedValue(node.name, minted)
    )
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    memberName(node.left) === 'op_id' &&
    isFreshOpId(node.right, minted)
  )
}

function parse(file: string, source: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const { diagnostics = [] } = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true
  })
  const violations = diagnostics.map((diagnostic) => ({
    file,
    line:
      sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
    rule: 'syntax-error',
    message: `cannot inspect invalid TypeScript: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`
  }))
  return { sourceFile, violations }
}

function runAstCheck(
  file: string,
  source: string,
  check: AstCheck,
  rule: string
): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const parsed = parse(file, source)
  if (parsed.violations.length) return parsed.violations
  return applySuppressions(file, source, check(file, parsed.sourceFile), [rule])
}

function isDestructuringProperty(node: ts.Node): boolean {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node))
    return false
  const objectLiteral = node.parent
  let container = objectLiteral.parent
  let assignmentTarget: ts.Node = objectLiteral
  while (ts.isParenthesizedExpression(container)) {
    assignmentTarget = container
    container = container.parent
  }
  return (
    ts.isObjectLiteralExpression(objectLiteral) &&
    ts.isBinaryExpression(container) &&
    container.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    container.left === assignmentTarget
  )
}

function isOutboundUpdateField(node: ts.Node): boolean {
  if (isDestructuringProperty(node)) return false
  if (ts.isPropertyAssignment(node))
    return propertyName(node.name) === 'update_b64'
  if (ts.isShorthandPropertyAssignment(node))
    return node.name.text === 'update_b64'
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    memberName(node.left) === 'update_b64'
  )
}

function noOutboundUpdateB64(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    if (!isOutboundUpdateField(node)) return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'no-outbound-update-b64',
        'constructs an outbound update_b64 field — clients send stamped semantic ops; raw Yjs updates flow host to follower only'
      )
    )
  })
  return violations
}

export function checkNoOutboundUpdateB64(
  file: string,
  source: string
): Violation[] {
  return runAstCheck(
    file,
    source,
    noOutboundUpdateB64,
    'no-outbound-update-b64'
  )
}

function noOpIdRegeneration(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  if (file.endsWith('/opEnvelope.ts')) return []
  const violations: Violation[] = []
  const minted = mintedOpIds(sourceFile, scopeIndex())
  visit(sourceFile, (node) => {
    if (!isFreshOpIdAssignment(node, minted)) return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'no-op-id-regeneration',
        'mints op_id outside opEnvelope.ts — retries must resend the creator-owned identity unchanged'
      )
    )
  })
  return violations
}

export function checkNoOpIdRegeneration(
  file: string,
  source: string
): Violation[] {
  return runAstCheck(file, source, noOpIdRegeneration, 'no-op-id-regeneration')
}

function staticModuleSpecifier(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
    return node.moduleSpecifier.text
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  )
    return node.moduleSpecifier.text
}

function importEqualsSpecifier(node: ts.Node): string | undefined {
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteral(node.moduleReference.expression)
  )
    return node.moduleReference.expression.text
}

function dynamicImportSpecifier(node: ts.Node): string | undefined {
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length > 0 &&
    ts.isStringLiteralLike(node.arguments[0])
  )
    return node.arguments[0].text
}

function moduleSpecifier(node: ts.Node): string | undefined {
  return (
    staticModuleSpecifier(node) ??
    importEqualsSpecifier(node) ??
    dynamicImportSpecifier(node)
  )
}

const OP_LAYER_PACKAGE_PATH =
  'node_modules/@comfyorg/comfy-multi-player' as const

function opLayerPurityViolation(
  file: string,
  line: number,
  dependency: string,
  installed?: string
): Violation {
  const cause = installed
    ? ` — this is the installed ${installed}, not this pull request's diff; repin the package in pnpm-workspace.yaml`
    : ''
  return {
    file,
    line,
    rule: 'op-layer-yjs-only',
    message: `breaks CRDT invariant #3 (the op layer is yjs-only): found runtime dependency ${dependency}${cause} — see CRDT-FOLLOWER-0025`
  }
}

function runtimeDependencyNames(manifest: unknown): string[] | undefined {
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    Array.isArray(manifest)
  )
    return
  const entries = Object.entries(manifest)
  return ['dependencies', 'optionalDependencies', 'peerDependencies'].flatMap(
    (field) => {
      const value = entries.find(([key]) => key === field)?.[1]
      return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
        ? Object.keys(value)
        : []
    }
  )
}

function installedLabel(manifest: unknown): string | undefined {
  if (typeof manifest !== 'object' || manifest === null) return
  const { name, version } = manifest as { name?: unknown; version?: unknown }
  if (typeof name !== 'string' || typeof version !== 'string') return
  return `${name}@${version}`
}

export function checkOpLayerManifest(
  file: string,
  source: string
): Violation[] {
  let manifest: unknown
  try {
    manifest = JSON.parse(source)
  } catch (error) {
    return [
      opLayerPurityViolation(
        file,
        1,
        `unreadable manifest (${error instanceof Error ? error.message : String(error)})`
      )
    ]
  }
  const dependencies = runtimeDependencyNames(manifest)
  if (dependencies === undefined)
    return [opLayerPurityViolation(file, 1, 'invalid manifest shape')]
  const installed = installedLabel(manifest)
  return dependencies
    .filter((dependency) => dependency !== 'yjs')
    .map((dependency) => opLayerPurityViolation(file, 1, dependency, installed))
}

const isLocalOrYjs = (specifier: string): boolean =>
  specifier.startsWith('.') ||
  specifier.startsWith('/') ||
  specifier === 'yjs' ||
  specifier.startsWith('yjs/')

/** A `require(…)` or `import(…)` whose argument is not a bare string literal. */
function isRuntimeLoad(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return true
  return ts.isIdentifier(node.expression) && node.expression.text === 'require'
}

function constantStrings(sourceFile: ts.SourceFile): Map<string, string> {
  const constants = new Map<string, string>()
  visit(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteralLike(node.initializer)
    )
      constants.set(node.name.text, node.initializer.text)
  })
  return constants
}

/** The specifier a runtime load names, or the reason it could not be determined. */
function loadedSpecifier(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  constants: ReadonlyMap<string, string>
): string {
  const argument = node.arguments.at(0)
  if (argument && ts.isStringLiteralLike(argument)) return argument.text
  if (argument && ts.isIdentifier(argument)) {
    const resolved = constants.get(argument.text)
    if (resolved !== undefined) return resolved
  }
  return `an unverifiable runtime load (${node.getText(sourceFile).slice(0, 80)})`
}

/**
 * Fail closed on a load this classifier cannot resolve. A package can reach forbidden
 * runtime code without declaring a manifest dependency, and treating an unresolvable
 * `import(name)` like an ordinary non-import node reported nothing at all.
 */
export function checkOpLayerRuntimeImports(
  file: string,
  source: string,
  installed?: string
): Violation[] {
  const parsed = parse(file, source)
  if (parsed.violations.length)
    return [
      opLayerPurityViolation(file, 1, 'invalid built JavaScript', installed)
    ]
  const { sourceFile } = parsed
  const constants = constantStrings(sourceFile)
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const specifier =
      moduleSpecifier(node) ??
      (isRuntimeLoad(node)
        ? loadedSpecifier(node, sourceFile, constants)
        : undefined)
    if (specifier === undefined || isLocalOrYjs(specifier)) return
    violations.push(
      opLayerPurityViolation(
        file,
        lineOf(sourceFile, node),
        specifier,
        installed
      )
    )
  })
  return violations
}

const RUNTIME_EXTENSIONS = ['.js', '.mjs', '.cjs'] as const

/**
 * Every path the manifest nominates as runtime code: `main`, `module`, `browser` and
 * every string leaf of `exports`. Globbing `dist/**` alone passed a package whose
 * declared entry was `./dist/entry.mjs` and whose only `.js` file was unrelated.
 */
function declaredEntryPoints(manifest: unknown): string[] {
  if (typeof manifest !== 'object' || manifest === null) return []
  const entries = new Set<string>()
  const record = manifest as Record<string, unknown>
  for (const field of ['main', 'module', 'browser', 'types'] as const) {
    const value = record[field]
    if (typeof value === 'string' && field !== 'types') entries.add(value)
  }
  const collect = (value: unknown): void => {
    if (typeof value === 'string') {
      entries.add(value)
      return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'types') continue
      collect(nested)
    }
  }
  collect(record['exports'])
  return [...entries]
    .map((entry) => entry.replace(/^\.\//, '').replaceAll('\\', '/'))
    .filter((entry) => entry.length > 0 && !entry.startsWith('..'))
}

export function checkOpLayerPurity(repositoryRoot: string): Violation[] {
  const packageRoot = resolve(repositoryRoot, OP_LAYER_PACKAGE_PATH)
  const manifestFile = `${OP_LAYER_PACKAGE_PATH}/package.json`
  let manifestSource: string
  try {
    manifestSource = readFileSync(resolve(repositoryRoot, manifestFile), 'utf8')
  } catch (error) {
    return [
      opLayerPurityViolation(
        manifestFile,
        1,
        `unreadable manifest (${error instanceof Error ? error.message : String(error)})`
      )
    ]
  }

  const violations = checkOpLayerManifest(manifestFile, manifestSource)
  let manifest: unknown
  try {
    manifest = JSON.parse(manifestSource)
  } catch {
    manifest = undefined
  }
  const installed = installedLabel(manifest)
  const glob = globSync(
    RUNTIME_EXTENSIONS.map((extension) => `dist/**/*${extension}`),
    { cwd: packageRoot }
  ).map((file) => file.replaceAll('\\', '/'))

  const entryPoints = declaredEntryPoints(manifest)
  const unsupported = entryPoints.filter(
    (entry) =>
      !RUNTIME_EXTENSIONS.some((extension) => entry.endsWith(extension))
  )
  for (const entry of unsupported)
    violations.push(
      opLayerPurityViolation(
        `${OP_LAYER_PACKAGE_PATH}/${entry}`,
        1,
        `an unsupported runtime layout: entry "${entry}" is not one of ${RUNTIME_EXTENSIONS.join(', ')}`,
        installed
      )
    )

  const runtimeFiles = [
    ...new Set([
      ...glob,
      ...entryPoints.filter((entry) =>
        RUNTIME_EXTENSIONS.some((extension) => entry.endsWith(extension))
      )
    ])
  ].sort()

  if (runtimeFiles.length === 0) {
    violations.push(
      opLayerPurityViolation(
        `${OP_LAYER_PACKAGE_PATH}/dist/**/*.js`,
        1,
        'no built runtime files',
        installed
      )
    )
    return violations
  }

  for (const relativeFile of runtimeFiles) {
    const file = `${OP_LAYER_PACKAGE_PATH}/${relativeFile}`
    let source: string
    try {
      source = readFileSync(resolve(packageRoot, relativeFile), 'utf8')
    } catch (error) {
      violations.push(
        opLayerPurityViolation(
          file,
          1,
          `unreadable runtime file (${error instanceof Error ? error.message : String(error)})`,
          installed
        )
      )
      continue
    }
    violations.push(...checkOpLayerRuntimeImports(file, source, installed))
  }
  return violations
}

const CATALOG_KEYWORD = /\b(?:catalog|vocabulary)\b/i
const MOVING_REFERENCE =
  /(?:refs\/heads\/[\w.-]+|@(?:main|master|develop|HEAD)\b|\/(?:blob|tree)\/(?:main|master|develop|HEAD)(?:\/|\b)|raw\.githubusercontent\.com\/[^\s/]+\/[^\s/]+\/(?:main|master|develop|HEAD)(?:\/|\b)|[?&]ref=(?:main|master|develop|HEAD)\b)/i
const HOSTED_CITATION =
  /^https?:\/\/(?:github\.com|raw\.githubusercontent\.com)\//i
const PINNED_SHA = /\b[0-9a-f]{40}\b/i

const HOSTED_URL = /https?:\/\/[^\s'"`)\]}]+/gi
const BARE_MOVING_REFERENCE =
  /@(?:main|master|develop|HEAD)\b|refs\/heads\/[\w.-]+|[?&]ref=(?:main|master|develop|HEAD)\b/gi

const citesMovingTarget = (url: string): boolean =>
  MOVING_REFERENCE.test(url) ||
  (HOSTED_CITATION.test(url) && !PINNED_SHA.test(url))

/**
 * Scan the references, then ask whether a catalog keyword sits beside one. Scanning
 * from the keyword forward missed every bare URL, because in
 * `https://…/blob/main/catalog.json` the keyword is in the filename — after the branch
 * it needed to see.
 */
function catalogPinnedBySha(file: string, source: string): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const nearbyKeyword = (start: number, end: number): boolean =>
    CATALOG_KEYWORD.test(
      source.slice(Math.max(0, start - 240), Math.min(source.length, end + 240))
    )

  const offsets: number[] = []
  const urlSpans: [number, number][] = []
  for (const match of source.matchAll(HOSTED_URL)) {
    const end = match.index + match[0].length
    urlSpans.push([match.index, end])
    if (nearbyKeyword(match.index, end) && citesMovingTarget(match[0]))
      offsets.push(match.index)
  }

  // A moving reference cited without a URL at all — `catalog @main`. Skip the ones
  // already inside a matched URL so one citation reports once.
  for (const match of source.matchAll(BARE_MOVING_REFERENCE)) {
    const end = match.index + match[0].length
    const insideUrl = urlSpans.some(
      ([from, to]) => match.index >= from && end <= to
    )
    if (!insideUrl && nearbyKeyword(match.index, end)) offsets.push(match.index)
  }

  return offsets.map((start) => ({
    file,
    line: source.slice(0, start).split('\n').length,
    rule: 'catalog-pinned-by-sha',
    message:
      'cites the widget catalog or vocabulary without a pinned commit SHA'
  }))
}

export function checkCatalogPinnedBySha(
  file: string,
  source: string
): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  return applySuppressions(file, source, catalogPinnedBySha(file, source), [
    'catalog-pinned-by-sha'
  ])
}

const DISTRIBUTION_MODULE = /(?:^|\/)platform\/distribution(?:\/|$)/
const DISTRIBUTION_FLAGS: readonly string[] = [
  'DISTRIBUTION',
  '__DISTRIBUTION__',
  '__IS_NIGHTLY__',
  'isCloud',
  'isDesktop',
  'isNightly'
]

function ownsADistributionBranch(file: string): boolean {
  return (
    file.endsWith('/services/agent/agentAuth.ts') ||
    file.endsWith('/crdt/crdtDebugGate.ts') ||
    file.endsWith('/crdt/crdtDebugReport.ts')
  )
}

function isTypePosition(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  for (
    let current = node.parent;
    current !== sourceFile;
    current = current.parent
  )
    if (
      ts.isTypeNode(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeAliasDeclaration(current)
    )
      return true
  return false
}

const BINDING_DECLARATIONS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration
])

const NAME_POSITIONS: ReadonlySet<ts.SyntaxKind> = new Set([
  ...BINDING_DECLARATIONS,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.PropertyAccessExpression,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ImportClause,
  ts.SyntaxKind.NamespaceImport,
  ts.SyntaxKind.ExportSpecifier
])

function namedNode(node: ts.Node): ts.Node | undefined {
  return (node as { name?: ts.Node }).name
}

/** A shorthand property (`{ isCloud }`) is deliberately absent: that one reads a binding. */
function isDeclarationName(node: ts.Identifier): boolean {
  const { parent } = node
  return NAME_POSITIONS.has(parent.kind) && namedNode(parent) === node
}

function importedBindingNodes(
  node: ts.ImportDeclaration
): { name: ts.Identifier; declaration: ts.Node }[] {
  const clause = node.importClause
  if (!clause) return []
  const bound = clause.name
    ? [{ name: clause.name, declaration: clause as ts.Node }]
    : []
  const bindings = clause.namedBindings
  if (bindings && ts.isNamespaceImport(bindings))
    bound.push({ name: bindings.name, declaration: bindings })
  if (bindings && ts.isNamedImports(bindings))
    for (const element of bindings.elements)
      bound.push({ name: element.name, declaration: element })
  return bound
}

const importedBindings = (node: ts.ImportDeclaration): string[] =>
  importedBindingNodes(node).map(({ name }) => name.text)

/**
 * Names the file took from the distribution module. Everything else is resolved
 * lexically at each reference, because a file-wide "declared" set answers the wrong
 * question: it reports whether the spelling exists somewhere, not whether a
 * declaration is in scope at the read.
 */
function distributionImports(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const imported = new Set<string>()
  visit(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node)) return
    const specifier = staticModuleSpecifier(node) ?? ''
    if (DISTRIBUTION_MODULE.test(specifier))
      for (const name of importedBindings(node)) imported.add(name)
  })
  return imported
}

function distributionModuleImport(node: ts.Node): string | undefined {
  const specifier = moduleSpecifier(node)
  if (specifier === undefined || !DISTRIBUTION_MODULE.test(specifier)) return
  return `imports the distribution module "${specifier}"`
}

function buildEnvironmentRead(node: ts.Node): string | undefined {
  if (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)) &&
    memberName(node) === 'env' &&
    ts.isMetaProperty(node.expression)
  )
    return 'reads a build-time environment flag'
}

/**
 * `x['isCloud']`, but only where `x` itself carries distribution provenance. Keyed on
 * the member name alone it rejected `const flags = { isCloud: false }; flags['isCloud']`
 * while allowing the identical dot access.
 */
function keyedDistributionRead(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  imported: ReadonlySet<string>,
  scopes: ScopeIndex
): string | undefined {
  if (
    !ts.isElementAccessExpression(node) ||
    !ts.isStringLiteralLike(node.argumentExpression) ||
    !DISTRIBUTION_FLAGS.includes(node.argumentExpression.text) ||
    isTypePosition(node, sourceFile)
  )
    return
  const receiver = node.expression
  if (!ts.isIdentifier(receiver)) return
  const locallyBound =
    !imported.has(receiver.text) && scopes.resolve(receiver) !== undefined
  if (locallyBound) return
  return `reads the distribution flag "${node.argumentExpression.text}"`
}

function distributionFlagRead(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  imported: ReadonlySet<string>,
  scopes: ScopeIndex
): string | undefined {
  if (
    !ts.isIdentifier(node) ||
    isDeclarationName(node) ||
    isTypePosition(node, sourceFile)
  )
    return
  if (imported.has(node.text))
    return `branches on the imported distribution flag "${node.text}"`
  if (
    DISTRIBUTION_FLAGS.includes(node.text) &&
    scopes.resolve(node) === undefined
  )
    return `branches on the ambient distribution flag "${node.text}"`
}

function noScatteredDistributionChecks(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  if (ownsADistributionBranch(file)) return []
  const imported = distributionImports(sourceFile)
  const scopes = scopeIndex()
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const detail =
      distributionModuleImport(node) ??
      buildEnvironmentRead(node) ??
      keyedDistributionRead(node, sourceFile, imported, scopes) ??
      distributionFlagRead(node, sourceFile, imported, scopes)
    if (detail === undefined) return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'no-scattered-distribution-checks',
        `${detail} inside the follower seam — only agentAuth.ts chooses credentials by distribution`
      )
    )
  })
  return violations
}

export function checkNoScatteredDistributionChecks(
  file: string,
  source: string
): Violation[] {
  return runAstCheck(
    file,
    source,
    noScatteredDistributionChecks,
    'no-scattered-distribution-checks'
  )
}

function endpointText(node: ts.Node): string | undefined {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node)
  )
    return node.text
}

const ALLOWED_AGENT_EVENT_PATHS = new Set([
  '/agent/events',
  '/api/agent/events'
])

function hasEndpointContext(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node = node
  while (current !== sourceFile) {
    if (
      ts.isNewExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'WebSocket'
    )
      return true
    if (
      ts.isPropertyAssignment(current) &&
      propertyName(current.name) === 'endpoint'
    )
      return true
    current = current.parent
  }
  return false
}

function isHardcodedEndpoint(
  node: ts.Node,
  sourceFile: ts.SourceFile
): boolean {
  const text = endpointText(node)
  if (!text) return false
  if (/^(?:(?:wss?|https?):\/\/|\/\/)/i.test(text)) return true
  if (!text.startsWith('/')) return false
  if (ALLOWED_AGENT_EVENT_PATHS.has(text)) return false
  return (
    /^\/(?:ws|socket)(?:\/|$)/i.test(text) ||
    hasEndpointContext(node, sourceFile)
  )
}

function noHardcodedEndpoint(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    if (!isHardcodedEndpoint(node, sourceFile)) return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'no-hardcoded-endpoint',
        'hardcodes an endpoint inside the follower seam — agent traffic must use the shared /api/agent/events transport'
      )
    )
  })
  return violations
}

export function checkNoHardcodedEndpoint(
  file: string,
  source: string
): Violation[] {
  return runAstCheck(file, source, noHardcodedEndpoint, 'no-hardcoded-endpoint')
}

export function checkFile(file: string, source: string): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const parsed = parse(file, source)
  if (parsed.violations.length) return parsed.violations
  return applySuppressions(file, source, [
    ...noOutboundUpdateB64(file, parsed.sourceFile),
    ...noOpIdRegeneration(file, parsed.sourceFile),
    ...catalogPinnedBySha(file, source),
    ...noScatteredDistributionChecks(file, parsed.sourceFile),
    ...noHardcodedEndpoint(file, parsed.sourceFile)
  ])
}

export function checkFollowerFiles(
  repositoryRoot: string,
  files?: readonly string[]
): Violation[] {
  const violations: Violation[] = []
  const selectedFiles = files ?? findFollowerFiles(repositoryRoot)
  if (selectedFiles.length === 0) {
    return [
      {
        file: FOLLOWER_SCOPE_PATTERNS.join(', '),
        line: 1,
        rule: 'follower-scope-empty',
        message: 'no production follower seam files matched the declared scope'
      }
    ]
  }
  for (const file of selectedFiles) {
    let source: string
    try {
      source = readFileSync(resolve(repositoryRoot, file), 'utf8')
    } catch (error) {
      violations.push({
        file,
        line: 1,
        rule: 'declared-file-unreadable',
        message: `cannot read declared follower seam file: ${error instanceof Error ? error.message : String(error)}`
      })
      continue
    }
    violations.push(...checkFile(file, source))
  }
  return violations
}

function main(): void {
  const repositoryRoot = process.cwd()
  const files = findFollowerFiles(repositoryRoot)
  const violations = [
    ...checkFollowerFiles(repositoryRoot, files),
    ...checkOpLayerPurity(repositoryRoot)
  ]
  if (violations.length === 0) {
    process.stdout.write(
      `Follower invariant guard passed (${files.length} files scanned)\n`
    )
    return
  }
  process.stderr.write(
    `Follower invariant guard found ${violations.length} violation(s):\n\n` +
      violations
        .map(
          (entry) =>
            `${entry.file}:${entry.line} [${entry.rule}] ${entry.message}`
        )
        .join('\n') +
      '\n\nSee .agents/checks/follower-boundary.md and ' +
      'docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md\n'
  )
  process.exitCode = 1
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main()
}
