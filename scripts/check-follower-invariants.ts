/**
 * Deterministic guards for the syntax-checkable CRDT follower invariants in
 * `.agents/checks/follower-boundary.md`.
 *
 * The file roster is deliberately explicit. Adding or moving a runtime seam
 * file requires updating this list and the tests; a missing listed file fails
 * closed instead of silently shrinking coverage.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export interface Violation {
  file: string
  line: number
  rule: string
  message: string
}

/**
 * Runtime files that receive document frames, project them through the graph
 * API, or mint and send local semantic operations on current `main`.
 */
export const FOLLOWER_CORE_FILES = [
  'src/workbench/extensions/agent/crdt/agentCrdtProjection.ts',
  'src/workbench/extensions/agent/crdt/agentCrdtTransport.ts',
  'src/workbench/extensions/agent/crdt/docChangeCollector.ts',
  'src/workbench/extensions/agent/crdt/docFrameClient.ts',
  'src/workbench/extensions/agent/crdt/docOpMinter.ts',
  'src/workbench/extensions/agent/crdt/followerDoc.ts',
  'src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts',
  'src/workbench/extensions/agent/crdt/liveGraphApplier.ts',
  'src/workbench/extensions/agent/crdt/opEnvelope.ts',
  'src/workbench/extensions/agent/crdt/opSender.ts',
  'src/workbench/extensions/agent/crdt/restoreOpMinter.ts',
  'src/workbench/extensions/agent/crdt/useAgentCrdtFollower.ts'
] as const

type AstCheck = (file: string, sourceFile: ts.SourceFile) => Violation[]

const FOLLOWER_CORE_FILE_SET = new Set<string>(FOLLOWER_CORE_FILES)

const isFollowerCoreFile = (file: string): boolean =>
  FOLLOWER_CORE_FILE_SET.has(file)

const isTestOrFixture = (file: string): boolean =>
  /\.(test|spec)\.ts$/.test(file) || file.includes('__fixtures__/')

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
}

function callName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = ts.isIdentifier(expression.expression)
      ? expression.expression.text
      : undefined
    return owner ? `${owner}.${expression.name.text}` : expression.name.text
  }
}

const OP_ID_MINTERS = new Set([
  'createUuidv4',
  'uuidv4',
  'uuid',
  'crypto.randomUUID',
  'mintOpId'
])

function isFreshOpId(expression: ts.Expression): boolean {
  return (
    ts.isCallExpression(expression) &&
    OP_ID_MINTERS.has(callName(expression.expression) ?? '')
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
  const parseDiagnostics = (
    sourceFile as ts.SourceFile & {
      parseDiagnostics: readonly ts.DiagnosticWithLocation[]
    }
  ).parseDiagnostics
  const violations = parseDiagnostics.map((diagnostic) => ({
    file,
    line: sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
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
  if (isTestOrFixture(file) || !isFollowerCoreFile(file)) return []
  const parsed = parse(file, source)
  return parsed.violations.length
    ? parsed.violations
    : check(file, parsed.sourceFile)
}

function noOutboundUpdateB64(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    const isAssignment =
      ts.isPropertyAssignment(node) && propertyName(node.name) === 'update_b64'
    const isShorthand =
      ts.isShorthandPropertyAssignment(node) && node.name.text === 'update_b64'
    if (!isAssignment && !isShorthand) return
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
  visit(sourceFile, (node) => {
    const objectAssignment =
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === 'op_id' &&
      isFreshOpId(node.initializer)
    const fieldAssignment =
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'op_id' &&
      isFreshOpId(node.right)
    if (!objectAssignment && !fieldAssignment) return
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

function singleApplier(file: string, sourceFile: ts.SourceFile): Violation[] {
  const violations: Violation[] = []
  const localApplier = /(?:^|\/)(?:applier|docHost|opApplier|docApplier)$/
  visit(sourceFile, (node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      return
    const moduleName = node.moduleSpecifier.text.replace(/\.(?:m?[jt]s)$/, '')
    if (
      moduleName === '@comfyorg/comfy-multi-player' ||
      !localApplier.test(moduleName)
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
  if (isTestOrFixture(file) || !isFollowerCoreFile(file)) return []
  const branchCitation =
    /(catalog|vocabulary)[^\n]{0,80}(refs\/heads\/[\w-]+|@(main|master|develop|HEAD)\b)/i
  return source.split('\n').flatMap((line, index) =>
    branchCitation.test(line)
      ? [
          {
            file,
            line: index + 1,
            rule: 'catalog-pinned-by-sha',
            message:
              'cites the widget catalog or vocabulary by a moving branch instead of a pinned SHA'
          }
        ]
      : []
  )
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
  const violations: Violation[] = []
  visit(sourceFile, (node) => {
    if (
      !ts.isIdentifier(node) ||
      !['DISTRIBUTION', 'isCloud', 'isDesktop'].includes(node.text)
    )
      return
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

function noHardcodedEndpoint(
  file: string,
  sourceFile: ts.SourceFile
): Violation[] {
  const violations: Violation[] = []
  const endpoint = /^(?:wss?|https?):\/\//
  visit(sourceFile, (node) => {
    const text =
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        ? node.text
        : undefined
    if (!text || !endpoint.test(text)) return
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

export const CHECKS = [
  checkNoOutboundUpdateB64,
  checkNoOpIdRegeneration,
  checkSingleApplier,
  checkCatalogPinnedBySha,
  checkNoScatteredDistributionChecks,
  checkNoHardcodedEndpoint
]

export function checkFile(file: string, source: string): Violation[] {
  if (isTestOrFixture(file) || !isFollowerCoreFile(file)) return []
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
  files: readonly string[] = FOLLOWER_CORE_FILES
): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
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
