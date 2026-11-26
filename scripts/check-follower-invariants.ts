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

function enclosingPattern(pattern: ts.Node): ts.Node | undefined {
  const container = pattern.parent
  if (
    ts.isParenthesizedExpression(container) ||
    ts.isArrayLiteralExpression(container) ||
    ts.isSpreadElement(container)
  )
    return container
  if (ts.isPropertyAssignment(container) && container.initializer === pattern)
    return container.parent
}

function isAssignmentTarget(pattern: ts.Node): boolean {
  const container = pattern.parent
  return (
    (ts.isBinaryExpression(container) &&
      container.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      container.left === pattern) ||
    (ts.isForOfStatement(container) && container.initializer === pattern)
  )
}

function isDestructuringProperty(node: ts.Node): boolean {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node))
    return false
  let pattern: ts.Node = node.parent
  if (!ts.isObjectLiteralExpression(pattern)) return false
  for (
    let outer = enclosingPattern(pattern);
    outer;
    outer = enclosingPattern(pattern)
  )
    pattern = outer
  return isAssignmentTarget(pattern)
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

const CATALOG_KEYWORD = /\b(?:catalog|vocabulary)\b/i
const MOVING_REFERENCE =
  /(?:refs\/heads\/[\w.-]+|@(?:main|master|develop|HEAD)\b|\/(?:blob|tree)\/(?:main|master|develop|HEAD)(?:\/|\b)|raw\.githubusercontent\.com\/[^\s/]+\/[^\s/]+\/(?:main|master|develop|HEAD)(?:\/|\b)|[?&]ref=(?:main|master|develop|HEAD)\b)/i
const HOSTED_CITATION =
  /^https?:\/\/(?:github\.com|raw\.githubusercontent\.com)\//i
const PINNED_SHA = /^[0-9a-f]{40}$/i
const HOSTED_URL = /https?:\/\/[^\s'"`)\]}]+/gi
const BARE_MOVING_REFERENCE =
  /@(?:main|master|develop|HEAD)\b|refs\/heads\/[\w.-]+|[?&]ref=(?:main|master|develop|HEAD)\b/gi

function hasPinnedHostedRevision(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (parsed.hostname === 'raw.githubusercontent.com')
    return PINNED_SHA.test(segments[2] ?? '')
  const marker = segments.findIndex((segment) =>
    ['blob', 'tree', 'commit'].includes(segment)
  )
  return marker >= 0 && PINNED_SHA.test(segments[marker + 1] ?? '')
}

const citesMovingTarget = (url: string): boolean =>
  MOVING_REFERENCE.test(url) ||
  (HOSTED_CITATION.test(url) && !hasPinnedHostedRevision(url))

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

export { catalogPinnedBySha as checkCatalogPinnedBySha }

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
        'hardcodes an endpoint or absolute URL literal inside the follower seam — agent traffic must use the shared /api/agent/events transport'
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

/** The agent extension tree, wider than the follower seam. */
export const AGENT_SURFACE_PATTERNS = [
  'src/workbench/extensions/agent/**/*.ts',
  'src/workbench/extensions/agent/**/*.vue'
] as const

/** The one module allowed to construct the page's agent transport. */
export const PAGE_SESSION_OWNER =
  'src/workbench/extensions/agent/agentPageSession.ts'

const PAGE_SESSION_FACTORIES = new Set([
  'createAgentEventSource',
  'createAgentDocFrameTransport'
])

const isAgentSurfaceFile = (file: string): boolean =>
  file.startsWith('src/workbench/extensions/agent/') &&
  (file.endsWith('.ts') || file.endsWith('.vue')) &&
  !file.endsWith('.d.ts') &&
  !isTestOrFixture(file)

export function findAgentSurfaceFiles(repositoryRoot: string): string[] {
  return globSync([...AGENT_SURFACE_PATTERNS], { cwd: repositoryRoot })
    .map((file) => file.replaceAll('\\', '/'))
    .filter(isAgentSurfaceFile)
    .sort()
}

const SCRIPT_BLOCK =
  /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)<\/script\s*>/gi

function scriptOf(file: string, source: string): string {
  if (!file.endsWith('.vue')) return source
  const blank = (text: string): string => text.replaceAll(/[^\n]/g, ' ')
  let result = ''
  let cursor = 0
  for (const match of source.matchAll(SCRIPT_BLOCK)) {
    const [, openingTag, script] = match
    const start = match.index + openingTag.length
    result += blank(source.slice(cursor, start)) + script
    cursor = start + script.length
  }
  return result + blank(source.slice(cursor))
}

function calledFactory(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return
  const { expression } = node
  const name = ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : undefined
  return name !== undefined && PAGE_SESSION_FACTORIES.has(name)
    ? name
    : undefined
}

const mentionsFactoryName = (source: string): boolean =>
  [...PAGE_SESSION_FACTORIES].some((name) => source.includes(name))

const atPath = (file: string, violations: Violation[]): Violation[] =>
  violations.map((violation) => ({ ...violation, file }))

function pageSessionOwnsTransport(file: string, source: string): Violation[] {
  if (!isAgentSurfaceFile(file) || file === PAGE_SESSION_OWNER) return []
  if (!mentionsFactoryName(source)) return []
  const parsed = parse(
    file.endsWith('.vue') ? `${file}.ts` : file,
    scriptOf(file, source)
  )
  if (parsed.violations.length) return atPath(file, parsed.violations)
  const violations: Violation[] = []
  visit(parsed.sourceFile, (node) => {
    const factory = calledFactory(node)
    if (factory === undefined) return
    violations.push({
      file,
      line: lineOf(parsed.sourceFile, node),
      rule: 'page-session-owns-transport',
      message: `calls ${factory}() outside ${PAGE_SESSION_OWNER} — the agent event source and the doc-frame transport are page-session resources, so a component that constructs one also destroys it on unmount and closes the socket the follower session needs to resubscribe over`
    })
  })
  return violations
}

export { pageSessionOwnsTransport as checkPageSessionOwnsTransport }

/** The one module allowed to attach a human-write-leg op producer. */
export const OP_PRODUCER_OWNER =
  'src/workbench/extensions/agent/agentPageOpMinter.ts'

/** Factories that attach an op producer: one of these owns a `detach`. */
const OP_PRODUCER_FACTORIES = new Set(['attachDocOpMinter'])

/**
 * Receivers whose `detach()` stops an op producer or the sender it feeds.
 * Extend this when a producer is added, which is the whole maintenance cost of
 * the rule below.
 */
const OP_PRODUCER_RECEIVERS = new Set(['docOpMinter', 'opSender', 'coalescer'])

/**
 * Disposal routes a panel close reaches. `onBeforeUnmount` alone is too narrow
 * to state the rule with: a producer `detach()` is a thunk in a keyed step list
 * (`runPanelTeardown`) or in an array passed to `runFollowerTeardown` inside an
 * `onScopeDispose`, and unmount stops the scope. A guard that looked only for
 * the Vue hook names would find no caller and report the invariant held.
 */
const PANEL_CLOSE_DISPOSAL_ROUTES = new Set([
  'onBeforeUnmount',
  'onUnmounted',
  'onScopeDispose',
  'runPanelTeardown',
  'runFollowerTeardown',
  'stop'
])

function producerFactory(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return
  const { expression } = node
  const name = ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : undefined
  return name !== undefined && OP_PRODUCER_FACTORIES.has(name)
    ? name
    : undefined
}

/** `<receiver>.detach()` where the receiver is a known op producer. */
function producerDetach(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return
  const callee = node.expression
  if (!ts.isPropertyAccessExpression(callee)) return
  if (callee.name.text !== 'detach') return
  const receiver = callee.expression
  const name = ts.isIdentifier(receiver)
    ? receiver.text
    : ts.isPropertyAccessExpression(receiver)
      ? receiver.name.text
      : undefined
  return name !== undefined && OP_PRODUCER_RECEIVERS.has(name)
    ? name
    : undefined
}

/** Whether `node` sits inside a call a panel close reaches. */
function insideAPanelCloseRoute(node: ts.Node): boolean {
  // `ts.Node.parent` is typed non-nullable but is absent on a SourceFile, so
  // the walk stops on the kind rather than on a falsy check.
  // The cast is load-bearing: `ts.Node.parent` is typed non-nullable but is
  // absent on a SourceFile, so without it the loop guard reads as always
  // truthy and the walk has no terminator the type checker believes in.
  let parent = node.parent as ts.Node | undefined
  while (parent !== undefined) {
    if (ts.isCallExpression(parent)) {
      const callee = parent.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined
      if (name !== undefined && PANEL_CLOSE_DISPOSAL_ROUTES.has(name))
        return true
    }
    parent = parent.parent
  }
  return false
}

/**
 * The two modules whose disposal is session or page teardown rather than a
 * panel close, so a producer `detach()` on a disposal route inside them is
 * correct rather than a violation.
 *
 * This is a real narrowing of the rule and the premise it rests on is
 * load-bearing: the session seam's `onScopeDispose` runs
 * `runFollowerTeardown`, which detaches the sender and the coalescer, and that
 * scope is owned by the follower session registry. A panel close releases only
 * the panel's consumer claim while the page keeps its own, so the holder count
 * never reaches zero and the scope is not stopped — which is exactly what
 * `followerSessionLifetime.test.ts` pins in both directions. Were the page
 * claim removed, the session owner would legitimately become panel-reachable
 * again and this exemption would be wrong; that is why the pin, not this list,
 * is the control.
 */
const SESSION_DISPOSAL_OWNERS = new Set([
  'src/workbench/extensions/agent/crdt/useAgentCrdtFollower.ts',
  'src/workbench/extensions/agent/agentPageOpMinter.ts'
])

/**
 * Every op producer outlives the panel. Two halves, because one without the
 * other passes while the defect stands: nothing outside the producer owner may
 * attach a producer (so nothing else holds a `detach` to call), and no producer
 * `detach()` may sit on a route a panel close reaches.
 */
function opProducersOutliveThePanel(file: string, source: string): Violation[] {
  if (!isAgentSurfaceFile(file)) return []
  const mentionsAFactory = [...OP_PRODUCER_FACTORIES].some((name) =>
    source.includes(name)
  )
  if (!mentionsAFactory && !source.includes('.detach(')) return []
  const parsed = parse(
    file.endsWith('.vue') ? `${file}.ts` : file,
    scriptOf(file, source)
  )
  if (parsed.violations.length) return atPath(file, parsed.violations)
  const violations: Violation[] = []
  visit(parsed.sourceFile, (node) => {
    const factory = producerFactory(node)
    if (factory !== undefined && file !== OP_PRODUCER_OWNER)
      violations.push({
        file,
        line: lineOf(parsed.sourceFile, node),
        rule: 'op-producers-outlive-the-panel',
        message: `calls ${factory}() outside ${OP_PRODUCER_OWNER} — the op producer mints at the command site and its lifetime is the page, so a component that attaches one also detaches it on unmount and a hand edit made with the panel closed then mints nothing at all: no operation, no retained batch, nothing for the next resubscribe to replay; see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Stage 2`
      })
    const receiver = producerDetach(node)
    if (
      receiver !== undefined &&
      !SESSION_DISPOSAL_OWNERS.has(file) &&
      insideAPanelCloseRoute(node)
    )
      violations.push({
        file,
        line: lineOf(parsed.sourceFile, node),
        rule: 'op-producers-outlive-the-panel',
        message: `detaches the ${receiver} op producer from a disposal route a panel close reaches — closing the Agent panel is an ordinary one-click unmount, and an edit made while it is closed must still mint, be held, and replay with its original op_id after the next acknowledged resubscribe; see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Stage 2`
      })
  })
  return violations
}

export { opProducersOutliveThePanel as checkOpProducersOutliveThePanel }

/** The one module allowed to own a follower session's lifetime. */
export const FOLLOWER_SESSION_OWNER =
  'src/workbench/extensions/agent/crdt/useAgentCrdtFollower.ts'

/** The one module allowed to mint and replace a document's semantic replica. */
export const FOLLOWER_REPLICA_OWNER =
  'src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts'

const SESSION_OWNED_CONSTRUCTIONS = new Map<string, string>([
  ['LayoutFollowerBridge', FOLLOWER_SESSION_OWNER],
  ['AgentCrdtProjection', FOLLOWER_SESSION_OWNER],
  ['startAgentCrdtFollower', FOLLOWER_SESSION_OWNER],
  ['FollowerDoc', FOLLOWER_REPLICA_OWNER]
])

function sessionOwnedName(node: ts.Node): string | undefined {
  const callee = ts.isNewExpression(node)
    ? node.expression
    : ts.isCallExpression(node)
      ? node.expression
      : undefined
  if (callee === undefined) return
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined
  return name !== undefined && SESSION_OWNED_CONSTRUCTIONS.has(name)
    ? name
    : undefined
}

function sessionOwnsFollowerLifetime(
  file: string,
  source: string
): Violation[] {
  if (!isAgentSurfaceFile(file)) return []
  const names = [...SESSION_OWNED_CONSTRUCTIONS.keys()].filter(
    (name) =>
      SESSION_OWNED_CONSTRUCTIONS.get(name) !== file && source.includes(name)
  )
  if (names.length === 0) return []
  const parsed = parse(
    file.endsWith('.vue') ? `${file}.ts` : file,
    scriptOf(file, source)
  )
  if (parsed.violations.length) return atPath(file, parsed.violations)
  const violations: Violation[] = []
  visit(parsed.sourceFile, (node) => {
    const name = sessionOwnedName(node)
    if (name === undefined) return
    const owner = SESSION_OWNED_CONSTRUCTIONS.get(name)
    if (owner === undefined || owner === file) return
    violations.push({
      file,
      line: lineOf(parsed.sourceFile, node),
      rule: 'session-owns-follower-lifetime',
      message: `constructs ${name} outside ${owner} — the workflow document owns the follower session, so only the session owner creates and disposes the replica, the projection and the seam; see docs/adr/CRDT-FOLLOWER-0052-the-workflow-document-owns-the-follower-session.md Decisions 1 to 3`
    })
  })
  return violations
}

export { sessionOwnsFollowerLifetime as checkSessionOwnsFollowerLifetime }

export function checkFile(file: string, source: string): Violation[] {
  if (!isFollowerSeamFile(file)) return []
  const parsed = parse(file, source)
  if (parsed.violations.length) return parsed.violations
  return [
    ...noOutboundUpdateB64(file, parsed.sourceFile),
    ...catalogPinnedBySha(file, source),
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

/** Run the agent-surface rules, whose scope is wider than the follower seam. */
export function checkAgentSurfaceFiles(
  repositoryRoot: string,
  files?: readonly string[]
): Violation[] {
  const violations: Violation[] = []
  const selectedFiles = files ?? findAgentSurfaceFiles(repositoryRoot)
  if (selectedFiles.length === 0) {
    return [
      {
        file: AGENT_SURFACE_PATTERNS.join(', '),
        line: 1,
        rule: 'agent-surface-empty',
        message: 'no production agent surface files matched the declared scope'
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
        message: `cannot read declared agent surface file: ${error instanceof Error ? error.message : String(error)}`
      })
      continue
    }
    violations.push(...pageSessionOwnsTransport(file, source))
    violations.push(...sessionOwnsFollowerLifetime(file, source))
    violations.push(...opProducersOutliveThePanel(file, source))
  }
  return violations
}

function main(): void {
  const repositoryRoot = process.cwd()
  const files = findFollowerFiles(repositoryRoot)
  const surfaceFiles = findAgentSurfaceFiles(repositoryRoot)
  const violations = [
    ...checkFollowerFiles(repositoryRoot, files),
    ...checkAgentSurfaceFiles(repositoryRoot, surfaceFiles)
  ]
  if (violations.length === 0) {
    process.stdout.write(
      `Follower invariant guard passed (${files.length} seam files, ` +
        `${surfaceFiles.length} agent surface files scanned)\n`
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
