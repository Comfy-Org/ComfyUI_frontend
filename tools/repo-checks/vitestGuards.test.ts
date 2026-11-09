import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { readTracked, trackedFiles } from './trackedFiles'

const NETWORK_GUARDS = new Set(['vitest.network.setup.ts', 'vitest.setup.ts'])
const TIMER_GUARD = 'vitest.timer.setup.ts'

const PROJECTS_WITHOUT_TIMER_GUARD = [
  'apps/billing-web/vitest.config.ts',
  'packages/billing-contract/vitest.config.ts (billing-contract)',
  'packages/test-utils/vitest.config.ts (test-utils)',
  'vite.config.mts (isolated-stores)',
  'vite.config.mts (tooling)',
  'vitest.matrix.config.mts'
]

interface Project {
  readonly label: string
  readonly setupFiles: ReadonlySet<string>
}

function propertyName(node: ts.Node): string | undefined {
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    return ts.isIdentifier(node.name) ? node.name.text : undefined
  }
  return undefined
}

function stringLiteralsIn(node: ts.Node): string[] {
  if (ts.isStringLiteralLike(node)) return [node.text]
  return node.getChildren().flatMap(stringLiteralsIn)
}

function projectName(setupFiles: ts.Node): string | undefined {
  const owner = setupFiles.parent
  if (!ts.isObjectLiteralExpression(owner)) return undefined
  const name = owner.properties.find(
    (property) => propertyName(property) === 'name'
  )
  return name && ts.isPropertyAssignment(name)
    ? stringLiteralsIn(name.initializer)[0]
    : undefined
}

function setupFileValues(source: ts.SourceFile): ts.Expression[] {
  const values: ts.Expression[] = []
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && propertyName(node) === 'setupFiles') {
      values.push(node.initializer)
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'setupFiles'
    ) {
      values.push(node.right)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return values
}

function constInitializers(source: ts.SourceFile): Map<string, ts.Expression> {
  const initializers = new Map<string, ts.Expression>()
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      initializers.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return initializers
}

function referencedSetupFiles(
  value: ts.Expression,
  initializers: Map<string, ts.Expression>
): Set<string> {
  const elements = ts.isArrayLiteralExpression(value)
    ? [...value.elements]
    : [value]
  return new Set(
    elements
      .flatMap((element) => {
        const resolved = ts.isIdentifier(element)
          ? (initializers.get(element.text) ?? element)
          : element
        return stringLiteralsIn(resolved)
      })
      .map((literal) => path.basename(literal))
  )
}

function isVitestConfig(file: string, text: string): boolean {
  return path.basename(file).startsWith('vitest') || /\btest\s*:/.test(text)
}

function vitestProjects(): Project[] {
  return trackedFiles(
    'vite.config.*',
    'vitest*.config.*',
    '**/vite.config.*',
    '**/vitest*.config.*'
  )
    .map((file) => ({ file, text: readTracked(file) }))
    .filter(({ file, text }) => isVitestConfig(file, text))
    .flatMap(({ file, text }) => {
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true
      )
      const initializers = constInitializers(source)
      const values = setupFileValues(source)
      if (values.length === 0) return [{ label: file, setupFiles: new Set() }]
      return values.map((value) => {
        const name = projectName(value.parent)
        return {
          label: name ? `${file} (${name})` : file,
          setupFiles: referencedSetupFiles(value, initializers)
        }
      })
    })
}

describe('Vitest isolation guards', () => {
  it('loads the network guard in every Vitest project', () => {
    const unguarded = vitestProjects()
      .filter(
        ({ setupFiles }) =>
          ![...setupFiles].some((file) => NETWORK_GUARDS.has(file))
      )
      .map(({ label }) => label)

    expect(unguarded).toEqual([])
  })

  it('loads the timer guard everywhere except the known exceptions', () => {
    const withoutTimers = vitestProjects()
      .filter(({ setupFiles }) => !setupFiles.has(TIMER_GUARD))
      .map(({ label }) => label)
      .toSorted()

    expect(withoutTimers).toEqual(PROJECTS_WITHOUT_TIMER_GUARD)
  })
})
