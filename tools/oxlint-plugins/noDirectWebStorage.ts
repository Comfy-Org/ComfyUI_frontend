import type { AnyNode, Rule } from './astTypes'

const STORAGE_GLOBALS = new Set(['localStorage', 'sessionStorage'])
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self'])
const VUEUSE_STORAGE_COMPOSABLES = new Set([
  'useLocalStorage',
  'useSessionStorage',
  'useStorage',
  'useStorageAsync'
])

export const noDirectWebStorage: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Route Web Storage access through the fault-tolerant provider in @comfyorg/shared-frontend-utils/safeStorage'
    },
    schema: [],
    messages: {
      global:
        "Do not touch `{{name}}` directly: reading it throws a SecurityError when the browser blocks storage. Use safeLocalStorage / safeSessionStorage from '@comfyorg/shared-frontend-utils/safeStorage'.",
      composable:
        "Do not use VueUse `{{name}}`: it reads the storage global unguarded. Use useSafeLocalStorage / useSafeSessionStorage from '@/platform/storage/useSafeStorage'."
    }
  },
  create(context) {
    function staticName(key: AnyNode, computed: boolean): string | undefined {
      if (!computed && key.type === 'Identifier') return key.name
      if (key.type === 'Literal' && typeof key.value === 'string')
        return key.value
      return undefined
    }

    function isLocallyDeclared(node: AnyNode, name: string): boolean {
      for (
        let scope: ReturnType<typeof context.sourceCode.getScope> | null =
          context.sourceCode.getScope(node);
        scope && scope.type !== 'global';
        scope = scope.upper
      ) {
        if (scope.set.has(name)) return true
      }
      return false
    }

    function isVueuseNamespace(node: AnyNode, name: string): boolean {
      for (
        let scope: ReturnType<typeof context.sourceCode.getScope> | null =
          context.sourceCode.getScope(node);
        scope;
        scope = scope.upper
      ) {
        const variable = scope.set.get(name)
        if (variable)
          return variable.defs.some(
            (def) =>
              def.type === 'ImportBinding' &&
              def.node.type === 'ImportNamespaceSpecifier' &&
              def.parent?.type === 'ImportDeclaration' &&
              def.parent.source.value === '@vueuse/core'
          )
      }
      return false
    }

    function unwrap(node: AnyNode): AnyNode {
      let current = node
      while (
        current.type === 'TSAsExpression' ||
        current.type === 'TSNonNullExpression' ||
        current.type === 'TSSatisfiesExpression' ||
        current.type === 'ParenthesizedExpression'
      )
        current = current.expression
      return current
    }

    function isGlobalObject(target: AnyNode): boolean {
      const node = unwrap(target)
      return (
        node.type === 'Identifier' &&
        GLOBAL_OBJECTS.has(node.name) &&
        !isLocallyDeclared(node, node.name)
      )
    }

    return {
      'Program:exit'() {
        const globalScope = context.sourceCode.scopeManager.globalScope
        if (!globalScope) return
        for (const reference of globalScope.through) {
          const { identifier } = reference
          if (!STORAGE_GLOBALS.has(identifier.name)) continue
          context.report({
            node: identifier,
            messageId: 'global',
            data: { name: identifier.name }
          })
        }
      },
      MemberExpression(node) {
        const name = staticName(node.property, node.computed)
        if (name === undefined) return
        if (STORAGE_GLOBALS.has(name)) {
          if (isGlobalObject(node.object))
            context.report({ node, messageId: 'global', data: { name } })
          return
        }
        if (
          node.object.type === 'Identifier' &&
          isVueuseNamespace(node.object, node.object.name) &&
          VUEUSE_STORAGE_COMPOSABLES.has(name)
        ) {
          context.report({ node, messageId: 'composable', data: { name } })
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern') return
        if (!node.init) return
        const init = unwrap(node.init)
        if (init.type !== 'Identifier') return
        const fromGlobal = isGlobalObject(init)
        const fromVueuse = isVueuseNamespace(init, init.name)
        if (!fromGlobal && !fromVueuse) return
        const banned = fromGlobal ? STORAGE_GLOBALS : VUEUSE_STORAGE_COMPOSABLES
        for (const property of node.id.properties) {
          if (property.type !== 'Property') continue
          const name = staticName(property.key, property.computed)
          if (name === undefined || !banned.has(name)) continue
          context.report({
            node: property,
            messageId: fromGlobal ? 'global' : 'composable',
            data: { name }
          })
        }
      },
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type') return
        if (node.source?.value !== '@vueuse/core') return
        for (const specifier of node.specifiers) {
          if (
            specifier.exportKind !== 'type' &&
            specifier.local.type === 'Identifier' &&
            VUEUSE_STORAGE_COMPOSABLES.has(specifier.local.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'composable',
              data: { name: specifier.local.name }
            })
          }
        }
      },
      ImportDeclaration(node) {
        if (node.importKind === 'type') return
        if (node.source.value !== '@vueuse/core') return
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind !== 'type' &&
            specifier.imported.type === 'Identifier' &&
            VUEUSE_STORAGE_COMPOSABLES.has(specifier.imported.name)
          ) {
            context.report({
              node: specifier,
              messageId: 'composable',
              data: { name: specifier.imported.name }
            })
          }
        }
      }
    }
  }
}
