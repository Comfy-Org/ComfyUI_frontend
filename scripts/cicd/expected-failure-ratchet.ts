import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import ts from 'typescript'

export type ExpectedFailureKind = 'playwright' | 'vitest'

export interface ExpectedFailure {
  id: string
  kind: ExpectedFailureKind
  file: string
  line: number
  title: string
}

interface BaselineEntry {
  id: string
  classification: 'infrastructure-assertion' | 'live-defect'
}

const SOURCE_ROOTS = ['browser_tests', 'src']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

const propertyCall = (
  node: ts.CallExpression
): { object: string; property: string } | undefined => {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return
  }

  return {
    object: node.expression.expression.getText(),
    property: node.expression.name.text
  }
}

const isTestExpression = (expression: ts.Expression): boolean => {
  if (ts.isIdentifier(expression)) {
    return expression.text === 'it' || expression.text === 'test'
  }
  if (!ts.isPropertyAccessExpression(expression)) return false

  const object = expression.expression.getText()
  return (
    (object === 'it' || object === 'test') &&
    ['fixme', 'only', 'skip'].includes(expression.name.text)
  )
}

const testTitle = (node: ts.Node): string => {
  for (
    let parent = node.parent;
    parent !== node.getSourceFile();
    parent = parent.parent
  ) {
    if (!ts.isCallExpression(parent)) continue

    if (!isTestExpression(parent.expression)) continue

    const title = parent.arguments.at(0)
    if (
      title &&
      (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))
    ) {
      return title.text
    }
  }

  return '<declaration-level>'
}

const expectedFailureKind = (
  node: ts.CallExpression
): ExpectedFailureKind | undefined => {
  const call = propertyCall(node)
  if (call?.property === 'fails' && ['it', 'test'].includes(call.object)) {
    return 'vitest'
  }
  if (call?.object === 'test' && call.property === 'fail') return 'playwright'
}

const vitestTitle = (node: ts.CallExpression): string => {
  const value = node.arguments.at(0)
  return value &&
    (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : '<dynamic-title>'
}

export const inspectSource = (
  source: string,
  file: string
): ExpectedFailure[] => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const found: Omit<ExpectedFailure, 'id'>[] = []

  const visit = (node: ts.Node) => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const kind = expectedFailureKind(node)

    if (kind) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      const title = kind === 'vitest' ? vitestTitle(node) : testTitle(node)
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

const sourceFiles = async (root: string): Promise<string[]> => {
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

export const buildInventory = async (
  repositoryRoot = process.cwd()
): Promise<ExpectedFailure[]> => {
  const files = (
    await Promise.all(
      SOURCE_ROOTS.map((root) => sourceFiles(path.join(repositoryRoot, root)))
    )
  ).flat()

  return (
    await Promise.all(
      files.map(async (absoluteFile) => {
        const file = path.relative(repositoryRoot, absoluteFile)
        return inspectSource(await readFile(absoluteFile, 'utf8'), file)
      })
    )
  )
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id))
}

const run = async () => {
  const inventory = await buildInventory()
  if (process.argv.includes('--print')) {
    console.log(JSON.stringify(inventory, null, 2))
    return
  }

  const baselinePath = path.join(
    process.cwd(),
    'scripts/cicd/expected-failure-baseline.json'
  )
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as {
    entries: BaselineEntry[]
  }
  const actualIds = new Set(inventory.map(({ id }) => id))
  const baselineIds = new Set(baseline.entries.map(({ id }) => id))
  const added = inventory.filter(({ id }) => !baselineIds.has(id))
  const removed = baseline.entries.filter(({ id }) => !actualIds.has(id))

  if (added.length === 0 && removed.length === 0) {
    const liveDefects = baseline.entries.filter(
      ({ classification }) => classification === 'live-defect'
    ).length
    console.log(
      `Expected-failure baseline matches: ${liveDefects} live defects, ${baseline.entries.length - liveDefects} infrastructure assertions.`
    )
    return
  }

  for (const entry of added) {
    console.error(
      `Unclassified expected failure: ${entry.file}:${entry.line} — ${entry.title}`
    )
  }
  for (const entry of removed) {
    console.error(
      `Resolved or renamed expected failure still in baseline: ${entry.id}`
    )
  }
  console.error(
    'Classify additions and remove resolved entries in expected-failure-baseline.json.'
  )
  process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) await run()
