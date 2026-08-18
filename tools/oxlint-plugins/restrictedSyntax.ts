import type {
  ImportDeclaration,
  Node,
  RuleContext,
  TypeReference
} from './oxlintPluginTypes'

const ERROR_ASSERTION_MESSAGE =
  'Do not use Error type assertions. Use `instanceof Error` narrowing or `toError()` from @/utils/errorUtil instead. See issue #11429.'

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

function isZodImport(source: string): boolean {
  return source === 'zod'
}

function isPlaywrightImport(source: string): boolean {
  return source.startsWith('@playwright')
}

export const noUnsafeErrorAssertion = {
  create(context: RuleContext) {
    return {
      TSTypeReference(node: TypeReference) {
        if (
          node.typeName.type !== 'Identifier' ||
          node.typeName.name !== 'Error' ||
          !context.sourceCode
            .getAncestors(node)
            .some(
              (ancestor) =>
                ancestor.type === 'TSAsExpression' ||
                ancestor.type === 'TSTypeAssertion'
            )
        ) {
          return
        }
        context.report({ node, message: ERROR_ASSERTION_MESSAGE })
      }
    }
  }
}

export const noNewZodForRemoteApiTypes = restrictImports(
  isZodImport,
  'Do not hand-write new Zod schemas for remote API types. Use generated types from packages/ingest-types (@comfyorg/ingest-types) instead. See browser_tests/README.md "Sources of truth for mock types".'
)

export const noMisplacedSpecFiles = reportProgram(
  '.spec.ts files are only allowed under browser_tests/tests/ or apps/*/e2e/'
)

export const noPlaywrightImportsInFixtureData = restrictImports(
  isPlaywrightImport,
  'fixtures/data/ must contain only static data. No Playwright imports allowed.'
)

export const noUnitTestFilesInBrowserTests = reportProgram(
  '.test.ts files are not allowed in browser_tests/tests/; use .spec.ts instead'
)
