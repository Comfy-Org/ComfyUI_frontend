import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GENERATED_PACKAGE = '@comfyorg/ingest-types'

/**
 * The generated barrel currently re-exports ~1000 names. A near-empty parse
 * means the generator's output shape changed and this rule has silently stopped
 * protecting anything, so fail loudly rather than pass everything.
 */
const MIN_EXPECTED_EXPORTS = 100

interface Identifier {
  readonly type: 'Identifier'
  readonly name: string
}

interface QualifiedName {
  readonly type: 'TSQualifiedName'
  readonly left?: Identifier
  readonly right?: Identifier
}

interface TypeNode {
  readonly type: string
  readonly typeName?: Identifier | QualifiedName
}

interface NamedDeclaration {
  readonly id: Identifier
}

interface TypeAliasDeclaration extends NamedDeclaration {
  readonly typeAnnotation?: TypeNode
}

interface RuleContext {
  report(descriptor: { node: unknown; message: string }): void
}

/**
 * Read the exported names out of the generated barrel's source text. The barrel
 * re-exports types only, so importing it yields nothing at runtime to inspect.
 */
function parseGeneratedTypeNames(): ReadonlySet<string> {
  const barrelPath = fileURLToPath(import.meta.resolve(GENERATED_PACKAGE))
  const source = readFileSync(barrelPath, 'utf8')
  const exportBlock = source.slice(
    source.indexOf('{') + 1,
    source.lastIndexOf('}')
  )
  const names = exportBlock
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entry))

  if (names.length < MIN_EXPECTED_EXPORTS) {
    throw new Error(
      `Parsed only ${names.length} export names from ${barrelPath}, expected at least ${MIN_EXPECTED_EXPORTS}. The generated barrel format likely changed; update tools/oxlint-plugins/comfyIngestTypes.ts.`
    )
  }
  return new Set(names)
}

let cachedNames: ReadonlySet<string> | undefined

function generatedTypeNames(): ReadonlySet<string> {
  cachedNames ??= parseGeneratedTypeNames()
  return cachedNames
}

/**
 * `type Foo = z.infer<typeof zFoo>` — the Zod schema is the deliberate runtime
 * source of truth for locally validated payloads, so the name overlap is not a
 * hand-rolled copy of the generated type.
 */
function isZodInference(annotation: TypeNode): boolean {
  if (annotation.type !== 'TSTypeReference') return false
  const typeName = annotation.typeName
  if (typeName?.type !== 'TSQualifiedName') return false
  return typeName.left?.name === 'z' && typeName.right?.name === 'infer'
}

/**
 * `type Foo = PreviewSubscribeResponse['new_plan']` and
 * `type Foo = components['schemas']['Foo']` derive from a generated type rather
 * than duplicating one. This is the pattern docs/guidance/typescript.md endorses
 * and also covers types sourced from `@comfyorg/registry-types`, whose export
 * names overlap with the ingest API's.
 */
function isDerivedFromExistingType(annotation: TypeNode): boolean {
  return annotation.type === 'TSIndexedAccessType'
}

function duplicateMessage(name: string): string {
  return `'${name}' is already exported from ${GENERATED_PACKAGE}. Import it instead of redeclaring — local copies drift from the API contract (see docs/guidance/typescript.md).`
}

const noDuplicateIngestType = {
  create(context: RuleContext) {
    const reportIfDuplicate = (node: NamedDeclaration) => {
      const { name } = node.id
      if (!generatedTypeNames().has(name)) return
      context.report({ node: node.id, message: duplicateMessage(name) })
    }

    return {
      TSInterfaceDeclaration(node: NamedDeclaration) {
        reportIfDuplicate(node)
      },
      TSTypeAliasDeclaration(node: TypeAliasDeclaration) {
        const annotation = node.typeAnnotation
        if (
          annotation &&
          (isZodInference(annotation) || isDerivedFromExistingType(annotation))
        ) {
          return
        }
        reportIfDuplicate(node)
      }
    }
  }
}

export default {
  meta: { name: 'comfy' },
  rules: { 'no-duplicate-ingest-type': noDuplicateIngestType }
}
