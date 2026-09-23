import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { RuleTester } from 'oxlint/plugins-dev'
import * as ts from 'typescript'

type Rule = Parameters<RuleTester['run']>[1]
type Context = Parameters<Extract<Rule, { create: unknown }>['create']>[0]
type Node = Parameters<Context['sourceCode']['getScope']>[0]

const PINIA_MODULES = new Set(['pinia', '@pinia/testing'])
const PINIA_FACTORIES = new Set(['createPinia', 'createTestingPinia'])
const compilerOptions: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { '@/*': [resolve(import.meta.dirname, '../../src/*')] }
}

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

export const useGlobalPinia: Rule = {
  create(context) {
    const modules = new Map<string, boolean>()
    function isPiniaModule(
      specifier: string,
      importer = context.filename
    ): boolean {
      if (PINIA_MODULES.has(specifier)) return true
      if (!specifier.startsWith('.') && !specifier.startsWith('@/'))
        return false
      const resolved = ts.resolveModuleName(
        specifier,
        importer,
        compilerOptions,
        ts.sys
      ).resolvedModule?.resolvedFileName
      if (!resolved) return false
      const cached = modules.get(resolved)
      if (cached !== undefined) return cached
      modules.set(resolved, false)
      const source = ts.createSourceFile(
        resolved,
        readFileSync(resolved, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
      const factories = new Set<string>()
      const namespaces = new Set<string>()
      for (const statement of source.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== 'pinia'
        )
          continue
        const bindings = statement.importClause?.namedBindings
        if (bindings && ts.isNamespaceImport(bindings))
          namespaces.add(bindings.name.text)
        if (bindings && ts.isNamedImports(bindings)) {
          for (const binding of bindings.elements) {
            if ((binding.propertyName ?? binding.name).text === 'defineStore')
              factories.add(binding.name.text)
          }
        }
      }
      function definesStore(node: ts.Node): boolean {
        if (ts.isCallExpression(node)) {
          const callee = node.expression
          if (ts.isIdentifier(callee) && factories.has(callee.text)) return true
          if (
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            namespaces.has(callee.expression.text) &&
            callee.name.text === 'defineStore'
          )
            return true
        }
        return ts.forEachChild(node, definesStore) ?? false
      }
      const result =
        definesStore(source) ||
        source.statements.some(
          (statement) =>
            ts.isExportDeclaration(statement) &&
            !statement.isTypeOnly &&
            (!statement.exportClause ||
              !ts.isNamedExports(statement.exportClause) ||
              statement.exportClause.elements.some(
                (specifier) => !specifier.isTypeOnly
              )) &&
            statement.moduleSpecifier &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            isPiniaModule(statement.moduleSpecifier.text, resolved)
        )
      modules.set(resolved, result)
      return result
    }

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
        const reference = importedReference(context, node.callee)
        if (
          reference?.source !== 'vitest' ||
          reference.path.length !== 2 ||
          !['vi', 'vitest'].includes(reference.path[0])
        )
          return
        const argument = node.arguments.at(0)
        if (!argument) return
        const method = reference.path[1]
        if (method === 'mock' || method === 'doMock') {
          const source = literal(
            argument.type === 'ImportExpression' ? argument.source : argument
          )
          if (source && isPiniaModule(source)) reportMock(node)
        }
        if (method === 'spyOn' || method === 'mocked') {
          const target = importedReference(context, argument)
          if (!target || !isPiniaModule(target.source)) return
          const name =
            method === 'spyOn' ? literal(node.arguments[1]) : target.path.at(-1)
          if (PINIA_MODULES.has(target.source) || name?.startsWith('use'))
            reportMock(node)
        }
      }
    }
  }
}
