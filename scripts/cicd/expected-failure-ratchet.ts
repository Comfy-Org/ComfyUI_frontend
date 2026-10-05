import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import ts from 'typescript'
import { z } from 'zod'

import { isMainModule } from '../isMainModule'

type ExpectedFailureKind = 'playwright' | 'vitest'

interface ExpectedFailure {
  id: string
  kind: ExpectedFailureKind
  file: string
  line: number
  title: string
}

const baselineEntrySchema = z.object({
  id: z.string().min(1),
  classification: z.enum(['infrastructure-assertion', 'live-defect'])
})
const baselineSchema = z.object({ entries: z.array(baselineEntrySchema) })
type BaselineEntry = z.infer<typeof baselineEntrySchema>

const LIVE_DEFECT_CEILING = 25

const SOURCE_ROOTS = [
  'apps',
  'browser_tests',
  'build',
  'packages',
  'scripts',
  'src',
  'tools'
]
const SOURCE_EXTENSIONS = new Set(['.cts', '.mts', '.ts', '.tsx'])

function isTestExpression(
  expression: ts.Expression,
  playwrightRunners: ReadonlySet<string>
): boolean {
  if (ts.isIdentifier(expression)) return playwrightRunners.has(expression.text)
  if (!ts.isPropertyAccessExpression(expression)) return false

  const { root } = callChain(expression)
  return (
    root !== undefined &&
    playwrightRunners.has(root) &&
    ['fixme', 'only', 'skip'].includes(expression.name.text)
  )
}

function titleText(node: ts.Expression | undefined): string | undefined {
  if (!node) return
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  return `<expression:${node.getText().replace(/\s+/g, ' ')}>`
}

function hasTestBody(node: ts.CallExpression): boolean {
  const body = node.arguments.at(-1)
  return Boolean(
    body && (ts.isArrowFunction(body) || ts.isFunctionExpression(body))
  )
}

function testTitle(
  node: ts.CallExpression,
  runner: string | undefined,
  playwrightRunners: ReadonlySet<string>
): string {
  if (node.arguments.length > 1 && hasTestBody(node)) {
    const declaredTitle = titleText(node.arguments.at(0))
    if (declaredTitle) return declaredTitle
  }

  for (
    let parent = node.parent;
    parent !== node.getSourceFile();
    parent = parent.parent
  ) {
    if (!ts.isCallExpression(parent)) continue

    const { root } = callChain(parent.expression)
    if (
      root !== runner ||
      !isTestExpression(parent.expression, playwrightRunners)
    )
      continue

    const title = titleText(parent.arguments.at(0))
    if (title) return title
  }

  return '<declaration-level>'
}

function callChain(expression: ts.Expression): {
  root?: string
  properties: string[]
} {
  if (ts.isIdentifier(expression)) {
    return { root: expression.text, properties: [] }
  }
  if (ts.isCallExpression(expression)) return callChain(expression.expression)
  if (!ts.isPropertyAccessExpression(expression)) return { properties: [] }

  const chain = callChain(expression.expression)
  return { ...chain, properties: [...chain.properties, expression.name.text] }
}

function importedPlaywrightRunners(node: ts.Node): string[] {
  if (
    !ts.isImportDeclaration(node) ||
    !ts.isStringLiteral(node.moduleSpecifier) ||
    !node.moduleSpecifier.text.includes('/fixtures/')
  )
    return []
  const bindings = node.importClause?.namedBindings
  if (!bindings || !ts.isNamedImports(bindings)) return []
  return bindings.elements
    .filter(({ propertyName, name }) =>
      /(?:fixture|test)$/i.test((propertyName ?? name).text)
    )
    .map(({ name }) => name.text)
}

function createsRunner(
  initializer: ts.CallExpression,
  runners: ReadonlySet<string>
): boolean {
  const { root, properties } = callChain(initializer.expression)
  if (root !== undefined && runners.has(root) && properties.includes('extend'))
    return true
  return (
    root === 'mergeTests' &&
    initializer.arguments.some(
      (argument) => ts.isIdentifier(argument) && runners.has(argument.text)
    )
  )
}

function derivedRunner(
  node: ts.Node,
  runners: ReadonlySet<string>
): string | undefined {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    createsRunner(node.initializer, runners)
  )
    return node.name.text
}

function forOfRunnerAliases(
  node: ts.Node,
  runners: ReadonlySet<string>
): string[] {
  if (!ts.isForOfStatement(node)) return []
  const valuesExpression = ts.isAsExpression(node.expression)
    ? node.expression.expression
    : node.expression
  if (
    !ts.isVariableDeclarationList(node.initializer) ||
    !ts.isArrayLiteralExpression(valuesExpression)
  )
    return []
  const binding = node.initializer.declarations[0].name
  if (!ts.isArrayBindingPattern(binding)) return []

  return binding.elements.flatMap((element, index) => {
    if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name))
      return []
    const values = valuesExpression.elements.map((value) =>
      ts.isArrayLiteralExpression(value) ? value.elements[index] : null
    )
    return values.length > 0 &&
      values.every(
        (value) => value && ts.isIdentifier(value) && runners.has(value.text)
      )
      ? [element.name.text]
      : []
  })
}

function playwrightRunnerNames(sourceFile: ts.SourceFile): Set<string> {
  const runners = new Set(['test'])

  function visit(node: ts.Node) {
    importedPlaywrightRunners(node).forEach((name) => runners.add(name))
    const runner = derivedRunner(node, runners)
    if (runner) runners.add(runner)
    forOfRunnerAliases(node, runners).forEach((name) => runners.add(name))
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return runners
}

function vitestRunnerNames(sourceFile: ts.SourceFile): Set<string> {
  const runners = new Set(['it', 'test'])

  function visit(node: ts.Node) {
    const runner = derivedRunner(node, runners)
    if (runner) runners.add(runner)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return runners
}

function isVitestFailure(
  root: string | undefined,
  properties: string[],
  vitestRunners: ReadonlySet<string>
) {
  return (
    root !== undefined &&
    vitestRunners.has(root) &&
    properties.includes('fails')
  )
}

function isPlaywrightFailure(
  root: string | undefined,
  properties: string[],
  playwrightRunners: ReadonlySet<string>
) {
  return (
    root !== undefined &&
    properties.includes('fail') &&
    playwrightRunners.has(root)
  )
}

function expectedFailureKind(
  node: ts.CallExpression,
  playwrightRunners: ReadonlySet<string>,
  vitestRunners: ReadonlySet<string>
): ExpectedFailureKind | undefined {
  if (ts.isCallExpression(node.parent) && node.parent.expression === node)
    return

  const { root, properties } = callChain(node.expression)
  if (isVitestFailure(root, properties, vitestRunners)) return 'vitest'
  if (isPlaywrightFailure(root, properties, playwrightRunners))
    return 'playwright'
}

function vitestTitle(node: ts.CallExpression): string {
  return titleText(node.arguments.at(0)) ?? '<missing-title>'
}

export function inspectSource(source: string, file: string): ExpectedFailure[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const playwrightRunners = /^(?:browser_tests|apps\/[^/]+\/e2e)\//.test(file)
    ? playwrightRunnerNames(sourceFile)
    : new Set<string>()
  const vitestRunners = vitestRunnerNames(sourceFile)
  const found: Omit<ExpectedFailure, 'id'>[] = []

  function visit(node: ts.Node) {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const kind = expectedFailureKind(node, playwrightRunners, vitestRunners)

    if (kind) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      const { root } = callChain(node.expression)
      const title =
        kind === 'vitest'
          ? vitestTitle(node)
          : testTitle(node, root, playwrightRunners)
      found.push({ kind, file, line: position.line + 1, title })
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const occurrences = new Map<string, number>()
  return found.map((entry) => {
    const fingerprint = `${entry.kind}:${entry.file}:${entry.title}`
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1
    occurrences.set(fingerprint, occurrence)
    return { ...entry, id: `${fingerprint}:${occurrence}` }
  })
}

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name)
      if (entry.isDirectory()) return sourceFiles(entryPath)
      return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : []
    })
  )
  return nested.flat()
}

async function buildInventory(
  repositoryRoot = process.cwd()
): Promise<ExpectedFailure[]> {
  const files = (
    await Promise.all(
      SOURCE_ROOTS.map((root) => sourceFiles(path.join(repositoryRoot, root)))
    )
  ).flat()

  return (
    await Promise.all(
      files.map(async (absoluteFile) => {
        const file = path
          .relative(repositoryRoot, absoluteFile)
          .split(path.sep)
          .join('/')
        return inspectSource(await readFile(absoluteFile, 'utf8'), file)
      })
    )
  )
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id))
}

function validateBaseline(value: unknown): BaselineEntry[] {
  const entries = baselineSchema.parse(value).entries
  const ids = entries.map(({ id }) => id)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Expected-failure baseline contains duplicate IDs.')
  }
  return entries
}

async function run() {
  const inventory = await buildInventory()
  const baselinePath = path.join(
    process.cwd(),
    'scripts/cicd/expected-failure-baseline.json'
  )
  const baseline = validateBaseline(
    JSON.parse(await readFile(baselinePath, 'utf8')) as unknown
  )
  const actualIds = new Set(inventory.map(({ id }) => id))
  const baselineIds = new Set(baseline.map(({ id }) => id))
  const added = inventory.filter(({ id }) => !baselineIds.has(id))
  const removed = baseline.filter(({ id }) => !actualIds.has(id))
  const liveDefects = baseline.filter(
    ({ classification }) => classification === 'live-defect'
  ).length

  if (
    added.length === 0 &&
    removed.length === 0 &&
    liveDefects === LIVE_DEFECT_CEILING
  ) {
    console.log(
      `Expected-failure baseline matches: ${liveDefects} live defects, ${baseline.length - liveDefects} infrastructure assertions.`
    )
    return
  }

  for (const entry of added) {
    console.error(
      `Unclassified expected failure: ${entry.file}:${entry.line} — ${entry.id}`
    )
  }
  for (const entry of removed) {
    console.error(
      `Resolved or renamed expected failure still in baseline: ${entry.id}`
    )
  }
  if (liveDefects !== LIVE_DEFECT_CEILING) {
    console.error(
      `Live-defect count ${liveDefects} must equal LIVE_DEFECT_CEILING (${LIVE_DEFECT_CEILING}); lower the ceiling when a pin is fixed.`
    )
  }
  console.error(
    'Update scripts/cicd/expected-failure-baseline.json: remove resolved entries and classify each addition as "live-defect" or "infrastructure-assertion".'
  )
  process.exitCode = 1
}

if (isMainModule(import.meta.url)) await run()
