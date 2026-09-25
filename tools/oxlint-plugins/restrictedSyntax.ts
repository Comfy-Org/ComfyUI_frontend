const ERROR_ASSERTION_MESSAGE =
  'Do not use Error type assertions. Use `instanceof Error` narrowing or `toError()` from @/utils/errorUtil instead. See issue #11429.'
const DOM_INSPECTION_MESSAGE =
  'Do not inspect the DOM inside a computed. Derive from a store instead. See docs/guidance/state-and-effects.md.'
const DOM_METHOD_MESSAGES = new Map([
  [
    'getBoundingClientRect',
    'Do not measure the DOM inside a computed - every recompute becomes a layout read. Derive from a store instead. See docs/guidance/state-and-effects.md.'
  ],
  ['getComputedStyle', DOM_INSPECTION_MESSAGE],
  ['querySelector', DOM_INSPECTION_MESSAGE],
  ['querySelectorAll', DOM_INSPECTION_MESSAGE]
])
const PRIMEVUE_MODULE = /^(?:primevue(?:\/|$)|@primevue(?:\/|$))/
const ES2023_ARRAY_COPY_METHODS = new Set([
  'toReversed',
  'toSorted',
  'toSpliced',
  'with'
])
const ES2023_ARRAY_COPY_MESSAGE =
  'ES2023 array method is not polyfilled for build target es2022; use the matching ES2022-safe non-mutating equivalent.'

interface Node {
  readonly type: string
}

interface Identifier extends Node {
  readonly type: 'Identifier'
  readonly name: string
}

interface StringLiteral extends Node {
  readonly value: string
}

interface Literal extends Node {
  readonly type: 'Literal'
  readonly value: unknown
}

interface TemplateLiteral extends Node {
  readonly type: 'TemplateLiteral'
  readonly expressions: readonly Node[]
  readonly quasis: readonly { readonly value: { readonly cooked?: string } }[]
}

interface ImportDeclaration extends Node {
  readonly source: StringLiteral
}

interface ImportExpression extends Node {
  readonly source: Node
}

interface ExportDeclaration extends Node {
  readonly source?: StringLiteral
}

interface MemberExpression extends Node {
  readonly type: 'MemberExpression'
  readonly computed: boolean
  readonly object: Node
  readonly property: Node
}

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Node
}

interface AssignmentExpression extends Node {
  readonly type: 'AssignmentExpression'
  readonly left: Node
}

interface UnaryExpression extends Node {
  readonly type: 'UnaryExpression'
  readonly argument: Node
  readonly operator: string
}

interface TypeReference extends Node {
  readonly typeName: Node
}

interface RuleContext {
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
  }
  report(descriptor: { node: Node; message: string }): void
}

function identifierName(node: Node): string | undefined {
  return node.type === 'Identifier' ? (node as Identifier).name : undefined
}

function staticString(node: Node): string | undefined {
  if (node.type === 'Literal') {
    const { value } = node as Literal
    return typeof value === 'string' ? value : undefined
  }
  if (node.type === 'TemplateLiteral') {
    const { expressions, quasis } = node as TemplateLiteral
    return expressions.length === 0 ? quasis[0]?.value.cooked : undefined
  }
}

function staticPropertyName(member: MemberExpression): string | undefined {
  return member.computed
    ? staticString(member.property)
    : identifierName(member.property)
}

const SELECTION_PROJECTIONS = new Set([
  'selected',
  'selectedItems',
  'selected_nodes'
])

function selectionProjection(node: Node): string | undefined {
  if (node.type !== 'MemberExpression') return
  const member = node as MemberExpression
  const name = staticPropertyName(member)
  return SELECTION_PROJECTIONS.has(name ?? '')
    ? name
    : selectionProjection(member.object)
}

function reportsSelectionStoreWrite(node: MemberExpression): boolean {
  if (
    staticPropertyName(node) !== 'apply' ||
    node.object.type !== 'CallExpression'
  )
    return false
  return (
    identifierName((node.object as CallExpression).callee) ===
    'useSelectionStore'
  )
}

function restrictImports(
  isRestricted: (source: string) => boolean,
  message: string
) {
  return {
    create(context: RuleContext) {
      return {
        ImportDeclaration(node: ImportDeclaration) {
          if (isRestricted(node.source.value)) context.report({ node, message })
        }
      }
    }
  }
}

function restrictModules(
  isRestricted: (source: string) => boolean,
  message: string
) {
  function reportRestrictedModule(
    context: RuleContext,
    node: Node,
    source: string | undefined
  ) {
    if (source !== undefined && isRestricted(source)) {
      context.report({ node, message })
    }
  }

  return {
    create(context: RuleContext) {
      return {
        ImportDeclaration(node: ImportDeclaration) {
          reportRestrictedModule(context, node, node.source.value)
        },
        ImportExpression(node: ImportExpression) {
          reportRestrictedModule(context, node, staticString(node.source))
        },
        ExportNamedDeclaration(node: ExportDeclaration) {
          reportRestrictedModule(context, node, node.source?.value)
        },
        ExportAllDeclaration(node: ExportDeclaration) {
          reportRestrictedModule(context, node, node.source?.value)
        }
      }
    }
  }
}

function reportProgram(message: string) {
  return {
    create(context: RuleContext) {
      return {
        Program(node: Node) {
          context.report({ node, message })
        }
      }
    }
  }
}

export const noUnsafeErrorAssertion = {
  create(context: RuleContext) {
    return {
      TSTypeReference(node: TypeReference) {
        if (
          identifierName(node.typeName) !== 'Error' ||
          !context.sourceCode
            .getAncestors(node)
            .some(
              ({ type }) =>
                type === 'TSAsExpression' || type === 'TSTypeAssertion'
            )
        ) {
          return
        }
        context.report({ node, message: ERROR_ASSERTION_MESSAGE })
      }
    }
  }
}

export const noDomInComputed = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        if (node.callee.type !== 'MemberExpression') return
        const method = identifierName(
          (node.callee as MemberExpression).property
        )
        const message = method && DOM_METHOD_MESSAGES.get(method)
        if (
          message &&
          context.sourceCode.getAncestors(node).some((ancestor) => {
            if (ancestor.type !== 'CallExpression') return false
            return (
              identifierName((ancestor as CallExpression).callee) === 'computed'
            )
          })
        ) {
          context.report({ node, message })
        }
      }
    }
  }
}

export const noDirectSelectionWrite = {
  create(context: RuleContext) {
    function report(node: Node) {
      context.report({
        node,
        message:
          'Route canvas selection changes through LGraphCanvas selection APIs.'
      })
    }

    return {
      AssignmentExpression(node: AssignmentExpression) {
        if (selectionProjection(node.left)) report(node)
      },
      UnaryExpression(node: UnaryExpression) {
        if (node.operator === 'delete' && selectionProjection(node.argument))
          report(node)
      },
      CallExpression(node: CallExpression) {
        if (node.callee.type !== 'MemberExpression') return
        const member = node.callee as MemberExpression
        const method = staticPropertyName(member)
        if (
          (selectionProjection(member.object) === 'selectedItems' &&
            (method === 'add' || method === 'delete' || method === 'clear')) ||
          reportsSelectionStoreWrite(member)
        ) {
          report(node)
        }
      }
    }
  }
}

export const noJsPrivateClassMembers = {
  create(context: RuleContext) {
    return {
      PrivateIdentifier(node: Node) {
        const parent = context.sourceCode.getAncestors(node).at(-1)
        if (
          parent?.type === 'PropertyDefinition' ||
          parent?.type === 'MethodDefinition'
        ) {
          context.report({
            node,
            message:
              'Do not use JavaScript hard-private class members. Use TypeScript private members instead.'
          })
        }
      }
    }
  }
}

export const noNewZodForRemoteApiTypes = restrictImports(
  (source) => source === 'zod',
  'Do not hand-write new Zod schemas for remote API types. Use generated types from packages/ingest-types (@comfyorg/ingest-types) instead. See browser_tests/README.md "Sources of truth for mock types".'
)

export const noMisplacedSpecFiles = reportProgram(
  '.spec.ts files are only allowed under browser_tests/tests/ or apps/*/e2e/'
)

export const noPlaywrightImportsInFixtureData = restrictImports(
  (source) => source.startsWith('@playwright'),
  'fixtures/data/ must contain only static data. No Playwright imports allowed.'
)

export const noUnitTestFilesInBrowserTests = reportProgram(
  '.test.ts files are not allowed in browser_tests/tests/; use .spec.ts instead'
)

export const noDeprecatedApiSchema = restrictModules(
  (source) => source === '@/schemas/apiSchema',
  'This module was removed. Use a generated or domain-owned contract as documented in browser_tests/README.md.'
)

export const noNewZodServerResponseSchema = restrictModules(
  (source) => source === 'zod',
  'Avoid introducing new hand-written zod schemas under src/schemas/ for server responses. Use generated types from @comfyorg/ingest-types instead. Only keep a hand-written schema if the ComfyUI webserver clearly diverges from the cloud ingest spec.'
)

export const noPrimeVueImports = restrictModules(
  (source) => PRIMEVUE_MODULE.test(source),
  'New PrimeVue usage is banned per the PrimeVue removal effort. Remove this import. scripts/primevue-import-allowlist.json only shrinks; do not add entries.'
)

export const noEs2023ArrayCopyMethod = {
  create(context: RuleContext) {
    return {
      CallExpression(node: CallExpression) {
        if (node.callee.type !== 'MemberExpression') return
        const method = staticPropertyName(node.callee as MemberExpression)
        if (method !== undefined && ES2023_ARRAY_COPY_METHODS.has(method)) {
          context.report({ node, message: ES2023_ARRAY_COPY_MESSAGE })
        }
      }
    }
  }
}
