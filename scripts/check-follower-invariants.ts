import { globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

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

/**
 * Suppression path for the residue these rules get wrong.
 *
 * A rule tight enough to be useful still mis-fires eventually, and the only escape
 * hatch for a required check must not be "edit the checker". A directive comment keeps
 * the exception in the source it suppresses, with the same four fields
 * `tools/architecture`'s `exceptionLedgerSchema` requires of an architecture exception:
 *
 *   // follower-invariant-allow-next-line no-scattered-distribution-checks
 *   // owner: @handle; rationale: why the rule is wrong here;
 *   // sunset: 2026-12-31; removal: what makes this deletable
 *   const isCloud = readSomethingElse()
 *
 * Fail-closed in all three degenerate cases: an incomplete, unparsable or past-sunset
 * directive suppresses nothing and reports itself, and a directive that matches no
 * violation reports itself too, so an exception cannot go quiet after it is merged.
 */
const SUPPRESSION_DIRECTIVE =
  /follower-invariant-allow-next-line\s+([a-z0-9-]+)/
const SUPPRESSION_FIELD = /\b(owner|rationale|sunset|removal)\s*:\s*([^;]+)/g
const REQUIRED_SUPPRESSION_FIELDS = [
  'owner',
  'rationale',
  'sunset',
  'removal'
] as const
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
    const directive = SUPPRESSION_DIRECTIVE.exec(line)
    if (!directive) return
    let cursor = index + 1
    while (cursor < lines.length && isCommentLine(lines[cursor])) cursor += 1
    suppressions.push({
      rule: directive[1],
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

function suppressionProblem(
  suppression: Suppression,
  now: string
): string | undefined {
  const { rule, fields } = suppression
  if (!(RULE_NAMES as readonly string[]).includes(rule))
    return `names unknown rule "${rule}"`
  const missing = REQUIRED_SUPPRESSION_FIELDS.filter(
    (field) => !fields.get(field)
  )
  if (missing.length)
    return `is missing required field(s) ${missing.join(', ')}`
  const owner = fields.get('owner') ?? ''
  if (!/^@\S+$/.test(owner)) return `names owner "${owner}", not an @handle`
  const sunset = fields.get('sunset') ?? ''
  if (!ISO_DATE.test(sunset) || Number.isNaN(Date.parse(sunset)))
    return `has sunset "${sunset}", which is not a YYYY-MM-DD date`
  if (sunset < now) return `expired on ${sunset}`
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

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  )
}

/**
 * The name a function-like node is reachable by from a call site: its own name, or
 * the variable/property it is assigned to.
 */
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
 * Whether evaluating this expression mints a fresh id. A nested function body is
 * skipped: defining a minter is not calling one, and conflating the two is what let
 * `const nextOpId = () => crypto.randomUUID()` read as a minted value rather than as
 * a minter, leaving its call sites unrecognised.
 */
function expressionMintsOpId(
  expression: ts.Expression,
  minters: ReadonlySet<string>
): boolean {
  if (isFunctionLike(expression)) return false
  let minted = false
  const walk = (node: ts.Node): void => {
    if (minted || (node !== expression && isFunctionLike(node))) return
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : memberName(node.expression)
      if (name && minters.has(name)) minted = true
    }
    if (!minted) ts.forEachChild(node, walk)
  }
  walk(expression)
  return minted
}

function functionReturnsMintedOpId(
  node: ts.Node,
  minted: MintedOpIds
): boolean {
  const { body } = node as ts.FunctionLikeDeclaration
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
  /** Callables that yield a fresh id, seeded with the known uuid primitives. */
  functions: ReadonlySet<string>
  /** Variables that hold an already-minted id. */
  values: ReadonlySet<string>
}

/**
 * Both sets grow to a fixpoint together, so a minter reached through a chain of local
 * helpers is still recognised as one.
 *
 * Accepted limit: this is one file at a time, with no type information, so a minter
 * that lives in *another* module and is imported here is not recognised. Closing that
 * needs either cross-file resolution or the blunter inversion — flagging every `op_id`
 * whose right-hand side is a call — and the inversion flags legitimate reads such as
 * `{ op_id: String(op.op_id) }`. On a required check, a false positive costs more than
 * this residue does: see `no-scattered-distribution-checks` below, which was reported
 * for exactly that. The in-file helper closed here is the refactor that actually
 * happens to a line that mints an id.
 */
function mintedOpIds(sourceFile: ts.SourceFile): MintedOpIds {
  const functions = new Set<string>(OP_ID_MINTERS)
  const values = new Set<string>()
  const minted: MintedOpIds = { functions, values }

  const learnMinter = (node: ts.Node): boolean => {
    const name = functionLikeName(node)
    if (!name || functions.has(name)) return false
    if (!functionReturnsMintedOpId(node, minted)) return false
    functions.add(name)
    return true
  }

  const learnMintedValue = (node: ts.VariableDeclaration): boolean => {
    if (!ts.isIdentifier(node.name) || values.has(node.name.text)) return false
    if (!node.initializer || !isFreshOpId(node.initializer, minted))
      return false
    values.add(node.name.text)
    return true
  }

  let changed = true
  while (changed) {
    changed = false
    visit(sourceFile, (node) => {
      if (isFunctionLike(node)) changed = learnMinter(node) || changed
      else if (ts.isVariableDeclaration(node))
        changed = learnMintedValue(node) || changed
    })
  }
  return minted
}

function isFreshOpId(expression: ts.Expression, minted: MintedOpIds): boolean {
  return (
    expressionMintsOpId(expression, minted.functions) ||
    (ts.isIdentifier(expression) && minted.values.has(expression.text))
  )
}

function isFreshOpIdAssignment(node: ts.Node, minted: MintedOpIds): boolean {
  if (ts.isPropertyAssignment(node))
    return (
      propertyName(node.name) === 'op_id' &&
      isFreshOpId(node.initializer, minted)
    )
  if (ts.isShorthandPropertyAssignment(node))
    return node.name.text === 'op_id' && minted.values.has(node.name.text)
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
  const minted = mintedOpIds(sourceFile)
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

/**
 * This rule reads the installed package rather than the repository's own sources, so
 * its input can change without any pull request touching it. Name the cause in the
 * message: the person who sees it red is usually not the person who moved the pin.
 */
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
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const specifier = moduleSpecifier(node)
    if (
      specifier === undefined ||
      specifier.startsWith('.') ||
      specifier.startsWith('/') ||
      specifier === 'yjs' ||
      specifier.startsWith('yjs/')
    )
      return
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
  let installed: string | undefined
  try {
    installed = installedLabel(JSON.parse(manifestSource))
  } catch {
    installed = undefined
  }
  const runtimeFiles = globSync('dist/**/*.js', { cwd: packageRoot }).sort()
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

function catalogPinnedBySha(file: string, source: string): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const violations: Violation[] = []
  const citation = /\b(catalog|vocabulary)\b/gi
  const movingReference =
    /(?:refs\/heads\/[\w.-]+|@(main|master|develop|HEAD)\b|\/(?:blob|tree)\/(?:main|master|develop|HEAD)(?:\/|\b)|raw\.githubusercontent\.com\/[^\s/]+\/[^\s/]+\/(?:main|master|develop|HEAD)(?:\/|\b)|[?&]ref=(?:main|master|develop|HEAD)\b)/i
  for (const match of source.matchAll(citation)) {
    const start = match.index
    const window = source.slice(start, start + 240)
    const hostedCitation =
      /https?:\/\/(?:github\.com|raw\.githubusercontent\.com)\//i.test(window)
    if (
      !movingReference.test(window) &&
      (!hostedCitation || /\b[0-9a-f]{40}\b/i.test(window))
    )
      continue
    violations.push({
      file,
      line: source.slice(0, start).split('\n').length,
      rule: 'catalog-pinned-by-sha',
      message:
        'cites the widget catalog or vocabulary without a pinned commit SHA'
    })
  }
  return violations
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

/** The architectural exemptions, stated in CRDT-FOLLOWER-0025 rather than per-site. */
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

/** Declarations whose own `name` introduces a binding rather than reading one. */
const BINDING_DECLARATIONS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration
])

/** Those, plus the positions that name a type member, a key, or an import binding. */
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

/**
 * Whether this identifier *introduces* a name rather than reading one — a declared
 * binding, a type member, or the member half of `flags.isCloud`. A shorthand property
 * (`{ isCloud }`) is deliberately absent: that one does read a binding.
 */
function isDeclarationName(node: ts.Identifier): boolean {
  const { parent } = node
  return NAME_POSITIONS.has(parent.kind) && namedNode(parent) === node
}

function declaredBindingName(node: ts.Node): string | undefined {
  if (!BINDING_DECLARATIONS.has(node.kind)) return
  const name = namedNode(node)
  return name && ts.isIdentifier(name) ? name.text : undefined
}

function importedBindings(node: ts.ImportDeclaration): string[] {
  const clause = node.importClause
  if (!clause) return []
  const names = clause.name ? [clause.name.text] : []
  const bindings = clause.namedBindings
  if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text)
  if (bindings && ts.isNamedImports(bindings))
    for (const element of bindings.elements) names.push(element.name.text)
  return names
}

/**
 * Split the file's names into the ones that came from the distribution module and the
 * ones it declared itself. This is the distinction the rule is actually about: a
 * reference to an imported `isCloud` is a distribution branch, while a field or local
 * that happens to be *spelled* `isCloud` is a name, and `CRDT-FOLLOWER-0025` protects
 * the former. Declaration-vs-reference is also why evasion closes back on itself —
 * writing `const isCloud = DISTRIBUTION === 'cloud'` clears the local but flags
 * `DISTRIBUTION`.
 */
function distributionBindings(sourceFile: ts.SourceFile): {
  imported: ReadonlySet<string>
  declared: ReadonlySet<string>
} {
  const imported = new Set<string>()
  const declared = new Set<string>()
  visit(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = staticModuleSpecifier(node) ?? ''
      const target = DISTRIBUTION_MODULE.test(specifier) ? imported : declared
      for (const name of importedBindings(node)) target.add(name)
      return
    }
    const declaration = declaredBindingName(node)
    if (declaration) declared.add(declaration)
  })
  return { imported, declared }
}

/** `import … from '@/platform/distribution/*'`, which is the unambiguous case. */
function distributionModuleImport(node: ts.Node): string | undefined {
  if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return
  const specifier = moduleSpecifier(node)
  if (specifier === undefined || !DISTRIBUTION_MODULE.test(specifier)) return
  return `imports the distribution module "${specifier}"`
}

function buildEnvironmentRead(node: ts.Node): string | undefined {
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'env' &&
    ts.isMetaProperty(node.expression)
  )
    return 'reads a build-time environment flag'
}

function keyedDistributionRead(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | undefined {
  if (
    !ts.isElementAccessExpression(node) ||
    !ts.isStringLiteralLike(node.argumentExpression) ||
    !DISTRIBUTION_FLAGS.includes(node.argumentExpression.text) ||
    isTypePosition(node, sourceFile)
  )
    return
  return `reads the distribution flag "${node.argumentExpression.text}"`
}

/**
 * The narrowed case: a *reference* to a flag, either imported from the distribution
 * module or ambient. A declared binding, type member or key of the same spelling is a
 * name rather than a branch, and passes.
 */
function distributionFlagRead(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  bindings: { imported: ReadonlySet<string>; declared: ReadonlySet<string> }
): string | undefined {
  if (
    !ts.isIdentifier(node) ||
    isDeclarationName(node) ||
    isTypePosition(node, sourceFile)
  )
    return
  if (bindings.imported.has(node.text))
    return `branches on the imported distribution flag "${node.text}"`
  if (
    DISTRIBUTION_FLAGS.includes(node.text) &&
    !bindings.declared.has(node.text)
  )
    return `branches on the ambient distribution flag "${node.text}"`
}

function noScatteredDistributionChecks(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  if (ownsADistributionBranch(file)) return []
  const bindings = distributionBindings(sourceFile)
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const detail =
      distributionModuleImport(node) ??
      buildEnvironmentRead(node) ??
      keyedDistributionRead(node, sourceFile) ??
      distributionFlagRead(node, sourceFile, bindings)
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
  // Discover once and pass the result through, so the count in the success message
  // describes the set that was actually scanned.
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
