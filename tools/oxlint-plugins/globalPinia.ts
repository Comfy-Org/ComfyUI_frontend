import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { RuleTester } from 'oxlint/plugins-dev'
import * as ts from 'typescript'

type Rule = Parameters<RuleTester['run']>[1]
type Context = Parameters<Extract<Rule, { create: unknown }>['create']>[0]
type Node = Parameters<Context['sourceCode']['getScope']>[0]

const PINIA_MODULES = new Set(['pinia', '@pinia/testing'])
const PINIA_FACTORIES = new Set(['createPinia', 'createTestingPinia'])
const VITEST_MOCK_METHODS = new Set(['mock', 'doMock', 'spyOn', 'mocked'])
const MAY_EXPORT_STORE =
  /\bdefineStore\b|^\s*export\s*(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\b/m
const compilerOptions: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { '@/*': [resolve(import.meta.dirname, '../../src/*')] }
}
const resolutionCache = ts.createModuleResolutionCache(
  process.cwd(),
  (fileName) => fileName,
  compilerOptions
)
type PiniaModuleCacheEntry = {
  mtimeMs: number
  result: boolean
  dependencies: Map<string, number>
}
const piniaModules = new Map<string, PiniaModuleCacheEntry>()

function literal(node: Node | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined
  }
}

function propertyName(node: Node): string | undefined {
  return node.type === 'Identifier' ? node.name : literal(node)
}

function importedReference(
  context: Context,
  node: Node,
  seen = new Set<Node>()
): { source: string; path: string[] } | undefined {
  if (seen.has(node)) return
  seen.add(node)
  if (node.type === 'AwaitExpression' || node.type === 'ChainExpression') {
    return importedReference(
      context,
      node.type === 'AwaitExpression' ? node.argument : node.expression,
      seen
    )
  }
  if (node.type === 'ImportExpression') {
    const source = literal(node.source)
    if (source) return { source, path: [] }
  }
  if (node.type === 'MemberExpression') {
    const base = importedReference(context, node.object, seen)
    const name = node.computed
      ? literal(node.property)
      : propertyName(node.property)
    if (base && name) return { ...base, path: [...base.path, name] }
  }
  if (node.type !== 'Identifier') return
  let scope: ReturnType<Context['sourceCode']['getScope']> | null =
    context.sourceCode.getScope(node)
  while (scope) {
    const variable = scope.set.get(node.name)
    if (variable) {
      for (const definition of variable.defs) {
        if (
          definition.type === 'ImportBinding' &&
          definition.parent?.type === 'ImportDeclaration'
        ) {
          return {
            source: definition.parent.source.value,
            path:
              definition.node.type === 'ImportSpecifier'
                ? [propertyName(definition.node.imported) ?? '']
                : []
          }
        }
        if (
          definition.node.type === 'VariableDeclarator' &&
          definition.node.init
        ) {
          const base = importedReference(context, definition.node.init, seen)
          if (definition.node.id.type !== 'ObjectPattern') return base
          const property = definition.node.id.properties.find(
            (property) =>
              property.type === 'Property' &&
              property.value.type === 'Identifier' &&
              property.value.name === node.name
          )
          if (base && property?.type === 'Property') {
            const name = propertyName(property.key)
            if (name) return { ...base, path: [...base.path, name] }
          }
        }
      }
      if (variable.defs.length) return
    }
    scope = scope.upper
  }
  if (node.name === 'vi' || node.name === 'vitest') {
    return { source: 'vitest', path: [node.name] }
  }
}

function resolveLocalModule(
  specifier: string,
  importer: string
): string | undefined {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return
  return ts.resolveModuleName(
    specifier,
    importer,
    compilerOptions,
    ts.sys,
    resolutionCache
  ).resolvedModule?.resolvedFileName
}

function piniaNamedBindings(
  statement: ts.Statement
): ts.NamedImportBindings | undefined {
  if (!ts.isImportDeclaration(statement)) return
  if (
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.moduleSpecifier.text !== 'pinia'
  )
    return
  return statement.importClause?.namedBindings
}

function piniaImportBindings(source: ts.SourceFile) {
  const factories = new Set<string>()
  const namespaces = new Set<string>()
  for (const statement of source.statements) {
    const bindings = piniaNamedBindings(statement)
    if (!bindings) continue
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text)
      continue
    }
    for (const binding of bindings.elements) {
      if ((binding.propertyName ?? binding.name).text === 'defineStore')
        factories.add(binding.name.text)
    }
  }
  return { factories, namespaces }
}

function definesStore(source: ts.SourceFile): boolean {
  const { factories, namespaces } = piniaImportBindings(source)
  if (factories.size === 0 && namespaces.size === 0) return false

  function isDefineStoreCall(callee: ts.Expression): boolean {
    if (ts.isIdentifier(callee)) return factories.has(callee.text)
    return (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      namespaces.has(callee.expression.text) &&
      callee.name.text === 'defineStore'
    )
  }
  function visit(node: ts.Node): boolean {
    if (ts.isCallExpression(node) && isDefineStoreCall(node.expression))
      return true
    return ts.forEachChild(node, visit) ?? false
  }
  return visit(source)
}

function hasValueExports(statement: ts.ExportDeclaration): boolean {
  if (statement.isTypeOnly) return false
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause))
    return true
  return statement.exportClause.elements.some(
    (specifier) => !specifier.isTypeOnly
  )
}

function valueReexportSpecifiers(source: ts.SourceFile): string[] {
  return source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    hasValueExports(statement) &&
    statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : []
  )
}

function exportsPiniaStore(
  resolved: string,
  text: string,
  dependencies: Map<string, number>
): boolean {
  if (!MAY_EXPORT_STORE.test(text)) return false
  const source = ts.createSourceFile(resolved, text, ts.ScriptTarget.Latest)
  return (
    definesStore(source) ||
    valueReexportSpecifiers(source).some((specifier) =>
      isPiniaModule(specifier, resolved, dependencies)
    )
  )
}

function addDependencies(
  target: Map<string, number> | undefined,
  source: Map<string, number>
) {
  if (!target) return
  for (const [file, mtimeMs] of source) target.set(file, mtimeMs)
}

function dependenciesAreFresh(dependencies: Map<string, number>): boolean {
  for (const [file, mtimeMs] of dependencies) {
    if (statSync(file, { throwIfNoEntry: false })?.mtimeMs !== mtimeMs)
      return false
  }
  return true
}

function resolveExistingLocalModule(specifier: string, importer: string) {
  const cached = resolveLocalModule(specifier, importer)
  if (cached) {
    const stat = statSync(cached, { throwIfNoEntry: false })
    if (stat) return { resolved: cached, mtimeMs: stat.mtimeMs }
    piniaModules.delete(cached)
  }

  resolutionCache.clear()
  const resolved = resolveLocalModule(specifier, importer)
  if (!resolved) return
  const stat = statSync(resolved, { throwIfNoEntry: false })
  if (stat) return { resolved, mtimeMs: stat.mtimeMs }
}

function isPiniaModule(
  specifier: string,
  importer: string,
  parentDependencies?: Map<string, number>
): boolean {
  if (PINIA_MODULES.has(specifier)) return true
  const module = resolveExistingLocalModule(specifier, importer)
  if (!module) return false
  const { resolved, mtimeMs } = module
  parentDependencies?.set(resolved, mtimeMs)
  const cached = piniaModules.get(resolved)
  if (
    cached?.mtimeMs === mtimeMs &&
    dependenciesAreFresh(cached.dependencies)
  ) {
    addDependencies(parentDependencies, cached.dependencies)
    return cached.result
  }
  const dependencies = new Map<string, number>()
  piniaModules.set(resolved, { mtimeMs, result: false, dependencies })
  const result = exportsPiniaStore(
    resolved,
    readFileSync(resolved, 'utf8'),
    dependencies
  )
  piniaModules.set(resolved, { mtimeMs, result, dependencies })
  addDependencies(parentDependencies, dependencies)
  return result
}

function vitestMethod(context: Context, callee: Node): string | undefined {
  const reference = importedReference(context, callee)
  if (reference?.source !== 'vitest' || reference.path.length !== 2) return
  return ['vi', 'vitest'].includes(reference.path[0])
    ? reference.path[1]
    : undefined
}

function vitestMockCall(
  context: Context,
  node: Extract<Node, { type: 'CallExpression' }>
): { method: string; argument: Node } | undefined {
  if (
    node.callee.type === 'MemberExpression' &&
    !VITEST_MOCK_METHODS.has(propertyName(node.callee.property) ?? '')
  )
    return
  const method = vitestMethod(context, node.callee)
  const argument = node.arguments.at(0)
  if (!method || !VITEST_MOCK_METHODS.has(method) || !argument) return
  return { method, argument }
}

function mocksPiniaModule(argument: Node, importer: string): boolean {
  const source = literal(
    argument.type === 'ImportExpression' ? argument.source : argument
  )
  return source !== undefined && isPiniaModule(source, importer)
}

function spiesOnPiniaStore(
  context: Context,
  node: Extract<Node, { type: 'CallExpression' }>,
  method: string,
  argument: Node
): boolean {
  const target = importedReference(context, argument)
  if (!target || !isPiniaModule(target.source, context.filename)) return false
  if (PINIA_MODULES.has(target.source)) return true
  const name =
    method === 'spyOn' ? literal(node.arguments[1]) : target.path.at(-1)
  return name?.startsWith('use') ?? false
}

export const useGlobalPinia: Rule = {
  create(context) {
    function reportCreation(node: Node) {
      context.report({
        node,
        message:
          'Use the global testing Pinia from vitest.setup.ts. Configure real store state and action spies instead of creating another Pinia.'
      })
    }
    function reportMock(node: Node) {
      context.report({
        node,
        message:
          'Do not mock Pinia or store composables. Use the global testing Pinia and vi.mocked(store.action) for action stubs.'
      })
    }

    return {
      ImportDeclaration(node) {
        if (!PINIA_MODULES.has(node.source.value) || node.importKind === 'type')
          return
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            PINIA_FACTORIES.has(propertyName(specifier.imported) ?? '')
          )
            reportCreation(specifier)
        }
      },
      MemberExpression(node) {
        if (!PINIA_FACTORIES.has(propertyName(node.property) ?? '')) return
        const reference = importedReference(context, node)
        if (
          reference &&
          PINIA_MODULES.has(reference.source) &&
          reference.path.length === 1 &&
          PINIA_FACTORIES.has(reference.path[0])
        )
          reportCreation(node)
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !node.init) return
        const reference = importedReference(context, node.init)
        if (
          !reference ||
          !PINIA_MODULES.has(reference.source) ||
          reference.path.length
        )
          return
        for (const property of node.id.properties) {
          if (
            property.type === 'Property' &&
            PINIA_FACTORIES.has(propertyName(property.key) ?? '')
          )
            reportCreation(property)
        }
      },
      CallExpression(node) {
        const call = vitestMockCall(context, node)
        if (!call) return
        const { method, argument } = call
        const mocked =
          method === 'mock' || method === 'doMock'
            ? mocksPiniaModule(argument, context.filename)
            : spiesOnPiniaStore(context, node, method, argument)
        if (mocked) reportMock(node)
      }
    }
  }
}
