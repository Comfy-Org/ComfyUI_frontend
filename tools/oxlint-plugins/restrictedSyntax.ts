const ERROR_ASSERTION_MESSAGE =
  'Do not use Error type assertions. Use `instanceof Error` narrowing or `toError()` from @/utils/errorUtil instead. See issue #11429.'
const DOM_INSPECTION_MESSAGE =
  'Do not inspect the DOM inside a computed. Derive from a store instead. See docs/guidance/state-and-effects.md.'
const DOUBLE_ASSERTION_MESSAGE =
  'Do not bypass type checking with `as unknown as`. Narrow or construct the value instead. In tests, use `fromPartial` from @total-typescript/shoehorn when a partial fixture is intentional.'
const DOM_METHOD_MESSAGES = new Map([
  [
    'getBoundingClientRect',
    'Do not measure the DOM inside a computed - every recompute becomes a layout read. Derive from a store instead. See docs/guidance/state-and-effects.md.'
  ],
  ['getComputedStyle', DOM_INSPECTION_MESSAGE],
  ['querySelector', DOM_INSPECTION_MESSAGE],
  ['querySelectorAll', DOM_INSPECTION_MESSAGE]
])

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

interface ImportDeclaration extends Node {
  readonly source: StringLiteral
  readonly specifiers: readonly Node[]
  readonly importKind?: 'type' | 'value'
}

interface ImportSpecifier extends Node {
  readonly type: 'ImportSpecifier'
  readonly imported: Identifier
  readonly local: Identifier
  readonly importKind?: 'type' | 'value'
}

interface ExportDeclaration extends Node {
  readonly source?: StringLiteral
}

interface MemberExpression extends Node {
  readonly type: 'MemberExpression'
  readonly property: Node
}

interface CallExpression extends Node {
  readonly type: 'CallExpression'
  readonly callee: Node
}

interface TypeReference extends Node {
  readonly typeName: Node
}

interface TypeAssertion extends Node {
  readonly type: 'TSAsExpression'
  readonly expression: Node
  readonly typeAnnotation: Node
}

interface PendingAssertion {
  readonly node: TypeAssertion
  readonly inner: TypeAssertion
}

interface RuleFixer {
  insertTextBefore(node: Node, text: string): unknown
  replaceText(node: Node, text: string): unknown
}

interface RuleContext {
  readonly filename: string
  readonly sourceCode: {
    getAncestors(node: Node): readonly Node[]
    getText(node: Node): string
  }
  report(descriptor: {
    node: Node
    message: string
    fix?: (fixer: RuleFixer) => unknown
  }): void
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

function isIdentifier(node: Node): node is Identifier {
  return (
    node.type === 'Identifier' &&
    'name' in node &&
    typeof node.name === 'string'
  )
}

function isImportSpecifier(node: Node): node is ImportSpecifier {
  return (
    node.type === 'ImportSpecifier' &&
    'imported' in node &&
    'local' in node &&
    isNode(node.imported) &&
    isNode(node.local) &&
    isIdentifier(node.imported) &&
    isIdentifier(node.local)
  )
}

function isTypeAssertion(node: Node): node is TypeAssertion {
  return (
    node.type === 'TSAsExpression' &&
    'expression' in node &&
    'typeAnnotation' in node &&
    isNode(node.expression) &&
    isNode(node.typeAnnotation)
  )
}

function identifierName(node: Node): string | undefined {
  return isIdentifier(node) ? node.name : undefined
}

function importedLocalName(
  node: ImportDeclaration,
  importedName: string
): string | undefined {
  const specifier = node.specifiers.find(
    (specifier) =>
      isImportSpecifier(specifier) &&
      specifier.importKind !== 'type' &&
      specifier.imported.name === importedName
  )
  return specifier && isImportSpecifier(specifier)
    ? specifier.local.name
    : undefined
}

function availableHelperName(usedNames: ReadonlySet<string>): string {
  if (!usedNames.has('fromAny')) return 'fromAny'
  if (!usedNames.has('fromAnyRuntime')) return 'fromAnyRuntime'

  let suffix = 2
  while (usedNames.has(`fromAnyRuntime${suffix}`)) suffix++
  return `fromAnyRuntime${suffix}`
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

function restrictModules(source: string, message: string) {
  function reportRestrictedModule(
    context: RuleContext,
    node: ImportDeclaration | ExportDeclaration
  ) {
    if (node.source?.value === source) context.report({ node, message })
  }

  return {
    create(context: RuleContext) {
      return {
        ImportDeclaration(node: ImportDeclaration) {
          reportRestrictedModule(context, node)
        },
        ExportNamedDeclaration(node: ExportDeclaration) {
          reportRestrictedModule(context, node)
        },
        ExportAllDeclaration(node: ExportDeclaration) {
          reportRestrictedModule(context, node)
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

export const noUnknownDoubleAssertion = {
  meta: { fixable: 'code' },
  create(context: RuleContext) {
    let fromAny: string | undefined
    let program: Node
    const withoutHelper: PendingAssertion[] = []
    const usedNames = new Set<string>()
    const filename = context.filename.replaceAll('\\', '/')
    const canInsertHelper =
      /(?:\.test\.|\.spec\.)/.test(filename) &&
      !filename.includes('/browser_tests/')

    const replacement = (
      node: TypeAssertion,
      inner: TypeAssertion,
      helper: string
    ) => {
      return `${helper}<${context.sourceCode.getText(node.typeAnnotation)}, unknown>(${context.sourceCode.getText(inner.expression)})`
    }

    return {
      Program(node: Node) {
        program = node
      },
      'Program:exit'() {
        if (fromAny || withoutHelper.length === 0 || !canInsertHelper) return

        const helper = availableHelperName(usedNames)
        withoutHelper.forEach(({ node, inner }, index) => {
          const fix = (fixer: RuleFixer) => {
            const replacementFix = fixer.replaceText(
              node,
              replacement(node, inner, helper)
            )
            return index === 0
              ? [
                  fixer.insertTextBefore(
                    program,
                    `import { fromAny${helper === 'fromAny' ? '' : ` as ${helper}`} } from '@total-typescript/shoehorn'\n`
                  ),
                  replacementFix
                ]
              : replacementFix
          }
          context.report({ node, message: DOUBLE_ASSERTION_MESSAGE, fix })
        })
      },
      Identifier(node: Identifier) {
        usedNames.add(node.name)
      },
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source.value !== '@total-typescript/shoehorn') return
        if (node.importKind === 'type') return
        fromAny ??= importedLocalName(node, 'fromAny')
      },
      TSAsExpression(node: TypeAssertion) {
        if (!isTypeAssertion(node.expression)) return
        const inner = node.expression
        if (inner.typeAnnotation.type !== 'TSUnknownKeyword') return

        if (!fromAny) {
          if (canInsertHelper) {
            withoutHelper.push({ node, inner })
            return
          }
        }

        const helper = fromAny
        const fix = helper
          ? (fixer: RuleFixer) =>
              fixer.replaceText(node, replacement(node, inner, helper))
          : undefined

        context.report({ node, message: DOUBLE_ASSERTION_MESSAGE, fix })
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
  '@/schemas/apiSchema',
  'This module was removed. Use a generated or domain-owned contract as documented in browser_tests/README.md.'
)

export const noNewZodServerResponseSchema = restrictModules(
  'zod',
  'Avoid introducing new hand-written zod schemas under src/schemas/ for server responses. Use generated types from @comfyorg/ingest-types instead. Only keep a hand-written schema if the ComfyUI webserver clearly diverges from the cloud ingest spec.'
)
