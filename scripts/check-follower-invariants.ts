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

export const FOLLOWER_CORE_FILES = findFollowerFiles(process.cwd())

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

function expressionMintsOpId(expression: ts.Expression): boolean {
  let minted = false
  const walk = (node: ts.Node): void => {
    if (minted) return
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : memberName(node.expression)
      if (name && OP_ID_MINTERS.has(name)) minted = true
    }
    if (!minted) ts.forEachChild(node, walk)
  }
  walk(expression)
  return minted
}

function mintedOpIdIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const minted = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    visit(sourceFile, (node) => {
      if (
        !ts.isVariableDeclaration(node) ||
        !ts.isIdentifier(node.name) ||
        !node.initializer ||
        minted.has(node.name.text)
      )
        return
      if (
        expressionMintsOpId(node.initializer) ||
        (ts.isIdentifier(node.initializer) && minted.has(node.initializer.text))
      ) {
        minted.add(node.name.text)
        changed = true
      }
    })
  }
  return minted
}

function isFreshOpId(
  expression: ts.Expression,
  mintedIdentifiers: ReadonlySet<string>
): boolean {
  return (
    expressionMintsOpId(expression) ||
    (ts.isIdentifier(expression) && mintedIdentifiers.has(expression.text))
  )
}

function isFreshOpIdAssignment(
  node: ts.Node,
  mintedIdentifiers: ReadonlySet<string>
): boolean {
  if (ts.isPropertyAssignment(node))
    return (
      propertyName(node.name) === 'op_id' &&
      isFreshOpId(node.initializer, mintedIdentifiers)
    )
  if (ts.isShorthandPropertyAssignment(node))
    return node.name.text === 'op_id' && mintedIdentifiers.has(node.name.text)
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    memberName(node.left) === 'op_id' &&
    isFreshOpId(node.right, mintedIdentifiers)
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
  check: AstCheck
): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const parsed = parse(file, source)
  return parsed.violations.length
    ? parsed.violations
    : check(file, parsed.sourceFile)
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
  return runAstCheck(file, source, noOutboundUpdateB64)
}

function noOpIdRegeneration(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  if (file.endsWith('/opEnvelope.ts')) return []
  const violations: Violation[] = []
  const mintedIdentifiers = mintedOpIdIdentifiers(sourceFile)
  visit(sourceFile, (node) => {
    if (!isFreshOpIdAssignment(node, mintedIdentifiers)) return
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
  return runAstCheck(file, source, noOpIdRegeneration)
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

function singleApplier(file: string, sourceFile: ts.SourceFile): Violation[] {
  const violations: Violation[] = []
  const localApplier =
    /(?:^|\/)(?:applier|docHost|opApplier|docApplier)(?:\/index)?(?:\.[cm]?[jt]sx?)?$/
  visit(sourceFile, (node) => {
    const specifier = moduleSpecifier(node)
    if (specifier === undefined) return
    if (
      specifier.startsWith('@comfyorg/comfy-multi-player') ||
      !localApplier.test(specifier)
    )
      return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'single-applier',
        'imports a local applier — conflict resolution must come from the pinned @comfyorg/comfy-multi-player package'
      )
    )
  })
  return violations
}

export function checkSingleApplier(file: string, source: string): Violation[] {
  return runAstCheck(file, source, singleApplier)
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
  return catalogPinnedBySha(file, source)
}

function noScatteredDistributionChecks(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  if (
    file.endsWith('/services/agent/agentAuth.ts') ||
    file.endsWith('/crdt/crdtDebugGate.ts') ||
    file.endsWith('/crdt/crdtDebugReport.ts')
  )
    return []
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const identifier =
      ts.isIdentifier(node) &&
      [
        'DISTRIBUTION',
        '__DISTRIBUTION__',
        'isCloud',
        'isDesktop',
        'isNightly'
      ].includes(node.text)
    const environment =
      ts.isPropertyAccessExpression(node) &&
      node.getText(sourceFile).startsWith('import.meta.env')
    const keyedDistribution =
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      ['isCloud', 'isDesktop', 'isNightly'].includes(
        node.argumentExpression.text
      )
    if (!identifier && !environment && !keyedDistribution) return
    violations.push(
      violation(
        file,
        sourceFile,
        node,
        'no-scattered-distribution-checks',
        'references a distribution branch inside the follower seam — only agentAuth.ts chooses credentials by distribution'
      )
    )
  })
  return violations
}

export function checkNoScatteredDistributionChecks(
  file: string,
  source: string
): Violation[] {
  return runAstCheck(file, source, noScatteredDistributionChecks)
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
  return runAstCheck(file, source, noHardcodedEndpoint)
}

export function checkFile(file: string, source: string): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const parsed = parse(file, source)
  if (parsed.violations.length) return parsed.violations
  return [
    ...noOutboundUpdateB64(file, parsed.sourceFile),
    ...noOpIdRegeneration(file, parsed.sourceFile),
    ...singleApplier(file, parsed.sourceFile),
    ...catalogPinnedBySha(file, source),
    ...noScatteredDistributionChecks(file, parsed.sourceFile),
    ...noHardcodedEndpoint(file, parsed.sourceFile)
  ]
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
  const violations = checkFollowerFiles(process.cwd())
  if (violations.length === 0) {
    process.stdout.write(
      `Follower invariant guard passed (${FOLLOWER_CORE_FILES.length} files scanned)\n`
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
