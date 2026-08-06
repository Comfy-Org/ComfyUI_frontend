import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GENERATED_PACKAGE = '@comfyorg/ingest-types'
const PLUGIN_SOURCE = 'tools/oxlint-plugins/comfyIngestTypes.ts'

/**
 * The generated barrel currently re-exports ~1000 names. A near-empty parse
 * means the generator's output shape changed and this rule has silently stopped
 * protecting anything, so fail loudly rather than pass everything.
 */
const MIN_EXPECTED_EXPORTS = 100

const exportDeclarationStart = /^[ \t]*export\b/gm
const supportedExportBlock = /[ \t]*export\s+type\s*\{([^}]*)\}/y
const exportSpecifier = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/

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

function declarationAt(source: string, index: number): string {
  const lineEnd = source.indexOf('\n', index)
  return source.slice(index, lineEnd === -1 ? undefined : lineEnd).trim()
}

function unsupported(construct: string, detail: string): Error {
  return new Error(
    `Unsupported ${construct} '${detail}' in ${GENERATED_PACKAGE}. Update ${PLUGIN_SOURCE} to handle the generated barrel's current format.`
  )
}

/**
 * Collect the names a barrel makes importable, taking the alias side of
 * `Foo as Bar` since that is the name a local declaration would shadow.
 *
 * Every export declaration must be understood. A form this cannot read — a
 * wildcard re-export, say — would otherwise hide names behind it while the
 * remaining blocks still satisfy the sufficiency guard, leaving the rule
 * quietly under-enforcing, so anything unrecognized throws instead.
 */
export function collectExportedNames(source: string): Set<string> {
  const names = new Set<string>()
  for (const declaration of source.matchAll(exportDeclarationStart)) {
    supportedExportBlock.lastIndex = declaration.index
    const block = supportedExportBlock.exec(source)
    if (!block) {
      throw unsupported(
        'export declaration',
        declarationAt(source, declaration.index)
      )
    }
    for (const rawSpecifier of block[1].split(',')) {
      const specifier = rawSpecifier.trim()
      if (specifier === '') continue
      const parsed = exportSpecifier.exec(specifier)
      if (!parsed) {
        throw unsupported('export specifier', specifier)
      }
      names.add(parsed[2] ?? parsed[1])
    }
  }
  return names
}

/**
 * The barrel re-exports types only, so importing it yields nothing at runtime to
 * inspect; its source text is the only available description of the contract.
 */
function parseGeneratedTypeNames(): ReadonlySet<string> {
  const barrelPath = fileURLToPath(import.meta.resolve(GENERATED_PACKAGE))
  const names = collectExportedNames(readFileSync(barrelPath, 'utf8'))

  if (names.size < MIN_EXPECTED_EXPORTS) {
    throw new Error(
      `Parsed only ${names.size} export names from ${barrelPath}, expected at least ${MIN_EXPECTED_EXPORTS}. The generated barrel format likely changed; update ${PLUGIN_SOURCE}.`
    )
  }
  return names
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
