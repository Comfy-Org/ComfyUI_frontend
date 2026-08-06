import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type TypeScript from 'typescript'
import { fileURLToPath } from 'node:url'

const GENERATED_PACKAGE = '@comfyorg/ingest-types'
const PLUGIN_SOURCE = 'tools/oxlint-plugins/comfyIngestTypes.ts'

/**
 * The generated barrel currently re-exports ~1000 names. A near-empty parse
 * means the generator's output shape changed and this rule has silently stopped
 * protecting anything, so fail loudly rather than pass everything.
 */
const MIN_EXPECTED_EXPORTS = 100

const requireFrom = createRequire(import.meta.url)

/**
 * Loaded through `require` on first use rather than imported at module scope,
 * so lint runs that never touch a scoped file do not pay for the compiler.
 */
function loadTypeScript(): typeof TypeScript {
  return requireFrom('typescript')
}

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

function unsupportedDeclaration(text: string): Error {
  const summary = text.split('\n', 1)[0].trim().slice(0, 80)
  return new Error(
    `Unsupported export declaration '${summary}' in ${GENERATED_PACKAGE}. Update ${PLUGIN_SOURCE} to handle the generated barrel's current format.`
  )
}

function exportsAName(
  ts: typeof TypeScript,
  statement: TypeScript.Statement
): boolean {
  if (ts.isExportAssignment(statement)) return true
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    )
  )
}

/**
 * Collect the names a barrel makes importable, taking the alias side of
 * `Foo as Bar` since that is the name a local declaration would shadow.
 *
 * Every export must be understood. A form this cannot read — a wildcard
 * re-export, say — would otherwise hide names behind it while the remaining
 * exports still satisfy the sufficiency guard, leaving the rule quietly
 * under-enforcing, so anything unrecognized throws instead. This is why the
 * barrel is parsed rather than pattern-matched: scanning text cannot reliably
 * separate a real declaration from the word `export` in a comment or string,
 * nor find one that shares a line with another.
 */
export function collectExportedNames(source: string): Set<string> {
  const ts = loadTypeScript()
  const barrel = ts.createSourceFile(
    'barrel.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  )
  const names = new Set<string>()

  for (const statement of barrel.statements) {
    if (!ts.isExportDeclaration(statement)) {
      if (exportsAName(ts, statement)) {
        throw unsupportedDeclaration(statement.getText(barrel))
      }
      continue
    }
    const clause = statement.exportClause
    if (!statement.isTypeOnly || !clause || !ts.isNamedExports(clause)) {
      throw unsupportedDeclaration(statement.getText(barrel))
    }
    for (const element of clause.elements) {
      names.add(element.name.text)
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
